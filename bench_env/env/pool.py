"""
环境池 - 管理多个并行环境实例 (async version)。

支持三种隔离级别：
- pages: 多 Page，共享 Context（最轻量，适用于 namespace 隔离的模拟器）
- contexts: 多 Context，共享 Browser（中等隔离）
- browsers: 多 Browser 进程（完全隔离）

额外支持 num_browsers 参数：
  当 num_browsers > 1 且 isolation=pages 时，创建多个 Browser 进程，
  将 N 个 page 均匀分配到各 browser/context 中，兼顾轻量和多核利用。
"""

from __future__ import annotations

import asyncio
import math
import os
from enum import Enum
from typing import TYPE_CHECKING, Iterator

from bench_env.logger import get_logger

if TYPE_CHECKING:
    from bench_env.env.mobile_gym import MobileGymEnv

logger = get_logger(__name__)


class Isolation(str, Enum):
    """并行隔离级别"""
    PAGES = "pages"
    CONTEXTS = "contexts"
    BROWSERS = "browsers"


class EnvPool:
    """
    环境池 - 管理多个 MobileGymEnv 实例 (async)。
    
    Usage:
        async with EnvPool(url, n=4, isolation="browsers") as pool:
            await asyncio.gather(*[
                run_task(pool[i], tasks[i])
                for i in range(len(pool))
            ])
    """
    
    def __init__(
        self,
        url: str,
        n: int = 1,
        isolation: Isolation | str = Isolation.PAGES,
        num_browsers: int = 0,
        headless: bool = True,
        proxy: str | None = None,
        coord_space: str = "norm_0_1000",
        delay_after_action: float = 0.8,
        viewport_size: tuple[int, int] = (360, 800),
        physical_size: tuple[int, int] = (1080, 2400),
        device_scale_factor: float = 3,
        verbose: bool = True,
    ):
        self.url = url
        self.n = max(1, n)
        self.isolation = Isolation(isolation)
        self.num_browsers = max(0, num_browsers)
        self.headless = headless
        self.proxy = proxy
        self.coord_space = coord_space
        self.delay_after_action = delay_after_action
        self.viewport_size = viewport_size
        self.physical_size = physical_size
        self.device_scale_factor = device_scale_factor
        self.verbose = verbose
        
        self._pw = None
        self._browsers: list = []
        self._contexts: list = []
        self._envs: list[MobileGymEnv] = []

    async def __aenter__(self) -> "EnvPool":
        await self._setup()
        return self

    async def __aexit__(self, *args):
        await self._cleanup()

    def __iter__(self) -> Iterator["MobileGymEnv"]:
        return iter(self._envs)

    def __len__(self) -> int:
        return len(self._envs)

    def __getitem__(self, idx: int) -> "MobileGymEnv":
        return self._envs[idx]

    @property
    def envs(self) -> list["MobileGymEnv"]:
        return self._envs

    def _make_env_kwargs(self) -> dict:
        """生成 MobileGymEnv 的通用参数"""
        return {
            "url": self.url,
            "viewport_size": self.viewport_size,
            "physical_size": self.physical_size,
            "device_scale_factor": self.device_scale_factor,
            "headless": self.headless,
            "proxy": self.proxy,
            "coord_space": self.coord_space,
            "delay_after_action": self.delay_after_action,
            "verbose": self.verbose,
        }

    def _resolve_num_browsers(self) -> int:
        """Resolve effective browser count.

        - num_browsers=0 (auto): pages/contexts → 1, browsers → N
        - num_browsers>0: clamp to [1, N]
        """
        if self.num_browsers > 0:
            return min(self.num_browsers, self.n)
        # Auto defaults
        if self.isolation == Isolation.BROWSERS:
            return self.n
        return 1

    async def _setup(self):
        """创建环境实例

        拓扑由 (isolation, num_browsers) 共同决定：

        ┌─────────────┬──────────────┬──────────────────────────────┐
        │ isolation    │ num_browsers │ 拓扑                         │
        ├─────────────┼──────────────┼──────────────────────────────┤
        │ pages       │ 1 (default)  │ 1 browser, 1 context, N pages│
        │ pages       │ B>1          │ B browsers, B contexts,      │
        │             │              │ N pages 均分到各 context      │
        │ contexts    │ 1 (default)  │ 1 browser, N contexts        │
        │ contexts    │ B>1          │ B browsers, N contexts 均分   │
        │ browsers    │ N (default)  │ N browsers, N pages (1:1)    │
        └─────────────┴──────────────┴──────────────────────────────┘
        """
        from playwright.async_api import async_playwright
        from bench_env.env.mobile_gym import MobileGymEnv

        env_kwargs = self._make_env_kwargs()
        launch_args: dict = {"headless": self.headless}
        if self.proxy:
            launch_args["proxy"] = {"server": self.proxy}

        nb = self._resolve_num_browsers()

        if self.isolation == Isolation.BROWSERS:
            # 共享 1 个 Playwright server，每个 env 拿独立 browser
            # 隔离性不变（独立 Chromium 进程），但省掉 N-1 个 Node.js 进程
            self._pw = await async_playwright().start()
            for i in range(self.n):
                browser = await self._pw.chromium.launch(**launch_args)
                self._browsers.append(browser)
                self._envs.append(MobileGymEnv(**env_kwargs, browser=browser, worker_id=i))

        elif self.isolation == Isolation.CONTEXTS:
            # 多 context（可跨多个 browser）— 每个 Env 自己创建 context + route
            self._pw = await async_playwright().start()
            browsers = [await self._pw.chromium.launch(**launch_args) for _ in range(nb)]
            self._browsers.extend(browsers)
            for i in range(self.n):
                browser = browsers[i % nb]
                self._envs.append(MobileGymEnv(**env_kwargs, browser=browser, worker_id=i))

        else:  # PAGES
            self._pw = await async_playwright().start()
            ctx_args = MobileGymEnv.get_context_args(
                self.viewport_size[0], self.viewport_size[1], self.device_scale_factor
            )
            if nb <= 1:
                # 原有行为：1 browser, 1 context, N pages
                browser = await self._pw.chromium.launch(**launch_args)
                context = await browser.new_context(**ctx_args)
                await MobileGymEnv.setup_context_routes(context)
                self._browsers.append(browser)
                for i in range(self.n):
                    self._envs.append(MobileGymEnv(**env_kwargs, context=context, worker_id=i))
                logger.info(
                    f"EnvPool: 1 browser, 1 context, {self.n} pages"
                )
            else:
                # 多 Browser 多 Page：B browsers, 每个 browser 1 context,
                # N pages 均匀分到各 context
                browsers = [await self._pw.chromium.launch(**launch_args) for _ in range(nb)]
                self._browsers.extend(browsers)
                self._contexts = []
                for browser in browsers:
                    ctx = await browser.new_context(**ctx_args)
                    await MobileGymEnv.setup_context_routes(ctx)
                    self._contexts.append(ctx)
                for i in range(self.n):
                    ctx = self._contexts[i % nb]
                    self._envs.append(MobileGymEnv(**env_kwargs, context=ctx, worker_id=i))
                logger.info(
                    f"EnvPool: {nb} browsers × ~{math.ceil(self.n / nb)} pages/browser "
                    f"= {self.n} pages total"
                )

        # 分批启动环境,避免连接风暴。browsers iso 高并发时还要躲 inotify 上限:
        # 每个 chromium 进程会占 ~2 个 inotify instances(IDB seed 解压、文件系统层),
        # host 默认 fs.inotify.max_user_instances=128(无 sudo 改不了)。
        # batch_size=8 + sleep=3s 让任意时刻 in-init chromium ≤ ceil(22/3)*8 ≈ 64,
        # 远低于 128。详情见 docs/runbooks/bench-inotify-limit.md。
        # contexts/pages iso 的 browser 进程数通常很少,无需 3s 长 sleep。
        batch_size = 8
        default_batch_sleep_s = "3.0" if self.isolation == Isolation.BROWSERS and self.n >= 192 else "0.3"
        batch_sleep_s = float(os.environ.get("MOBILE_GYM_POOL_BATCH_SLEEP_S", default_batch_sleep_s))
        start_errors: list[Exception] = []
        for batch_start in range(0, len(self._envs), batch_size):
            batch = self._envs[batch_start:batch_start + batch_size]
            results = await asyncio.gather(
                *[env.start() for env in batch],
                return_exceptions=True,
            )
            start_errors.extend(r for r in results if isinstance(r, Exception))
            if batch_start + batch_size < len(self._envs):
                await asyncio.sleep(batch_sleep_s)
        if start_errors:
            logger.error(
                f"EnvPool start errors: {len(start_errors)}/{len(self._envs)}. "
                f"First error: {type(start_errors[0]).__name__}: {start_errors[0]}"
            )

    async def _cleanup(self):
        """清理资源"""
        # 关闭所有环境（page）
        for i, env in enumerate(self._envs):
            try:
                await env.close()
            except Exception as e:
                logger.debug(f"EnvPool: env[{i}].close() failed: {type(e).__name__}: {e}")
        self._envs.clear()

        # 关闭池创建的 context（多 browser PAGES 模式下）
        for i, ctx in enumerate(self._contexts):
            try:
                await ctx.close()
            except Exception as e:
                logger.debug(f"EnvPool: context[{i}].close() failed: {type(e).__name__}: {e}")
        self._contexts.clear()

        # 关闭共享的 browser（如果有）
        for i, browser in enumerate(self._browsers):
            try:
                await browser.close()
            except Exception as e:
                logger.debug(f"EnvPool: browser[{i}].close() failed: {type(e).__name__}: {e}")
        self._browsers.clear()
        
        if self._pw:
            try:
                await self._pw.stop()
            except Exception as e:
                logger.debug(f"EnvPool: playwright.stop() failed: {type(e).__name__}: {e}")
            self._pw = None
