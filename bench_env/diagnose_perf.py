"""
性能诊断脚本：精确复现 task.setup() 流程，测量每个子步骤耗时。

用法：
    python -m bench_env.diagnose_perf --env-url http://localhost:3000 --apps redbook,wechat
    python -m bench_env.diagnose_perf --env-url http://localhost:3000 --apps redbook
"""
import asyncio
import base64
import gzip
import json as json_mod
import time
import argparse
from playwright.async_api import async_playwright


class Timer:
    """简易阶段计时器"""
    def __init__(self):
        self.t0 = time.perf_counter()
        self.results: list[tuple[str, float]] = []
        self._lap = self.t0

    def lap(self, label: str):
        now = time.perf_counter()
        dt = now - self._lap
        self.results.append((label, dt))
        print(f"  [{now - self.t0:6.2f}s] +{dt:.3f}s  {label}")
        self._lap = now

    def summary(self):
        total = time.perf_counter() - self.t0
        print(f"\n{'─' * 60}")
        print(f"  {'阶段':<40s} {'耗时':>8s} {'占比':>6s}")
        print(f"{'─' * 60}")
        for label, dt in self.results:
            pct = dt / total * 100
            bar = '█' * int(pct / 2)
            print(f"  {label:<40s} {dt:>7.3f}s {pct:>5.1f}% {bar}")
        print(f"{'─' * 60}")
        print(f"  {'总计':<40s} {total:>7.3f}s")


async def diagnose(env_url: str, app_ids: list[str]):
    timer = Timer()

    async with async_playwright() as pw:
        # ── 1. 启动浏览器 + context ─────────────────────────────
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 360, "height": 800},
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True,
            ignore_https_errors=True,
            user_agent=(
                "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Mobile Safari/537.36"
            ),
        )
        page = await context.new_page()
        timer.lap("browser + context + page 创建")

        # ── 2. 导航到页面 (对应 start() 中的 page.goto) ─────────
        await page.goto(env_url, wait_until="domcontentloaded")
        timer.lap("page.goto domcontentloaded")

        # ── 3. _reset_sim(): 调用 __SIM__.reset() + wait DOM ───
        # 模拟 reset() 的完整流程
        try:
            await page.evaluate("""async () => {
                if (window.__SIM__?.reset) { await window.__SIM__.reset(); return; }
                try { localStorage.clear(); } catch {}
                try { sessionStorage.clear(); } catch {}
                location.reload();
            }""")
        except Exception:
            pass
        timer.lap("__SIM__.reset() evaluate")

        try:
            await page.wait_for_load_state("domcontentloaded", timeout=15000)
        except Exception:
            pass
        timer.lap("_reset_sim: wait domcontentloaded")

        # ── 4. _wait_ready(): 等 __SIM__ 对象出现 ──────────────
        await page.wait_for_function(
            "() => Boolean(window.__SIM__ && typeof window.__SIM__.getState === 'function')",
            timeout=20000,
        )
        await page.wait_for_function(
            "() => Boolean(window.__SIM_FS__)",
            timeout=20000,
        )
        timer.lap("wait __SIM__ + __SIM_FS__ ready")

        # ── 5. _wait_ready(): waitForData ───────────────────────
        await page.evaluate(
            "async (ids) => { if (window.__SIM__?.waitForData) await window.__SIM__.waitForData(ids || undefined); }",
            app_ids,
        )
        timer.lap(f"waitForData({app_ids})")

        # ── 6. _get_state() — 逐层分解瓶颈 ──────────────────────
        # 6a: 主线程响应性
        await page.evaluate("() => 1")
        timer.lap("evaluate(() => 1) — 主线程响应性")

        # 6b: 只取 os 部分（不含 apps）
        await page.evaluate("""() => {
            const s = window.__SIM__?.getState;
            if (!s) return null;
            // 手动构造 os 部分，跳过 apps
            return { os: 'placeholder' };
        }""")
        timer.lap("evaluate trivial object")

        # 6c: getAllAppStates 耗时（只计算，不传输）
        await page.evaluate("""() => {
            const t0 = performance.now();
            const state = window.__SIM__?.getState?.();
            const t1 = performance.now();
            // 只返回耗时和大小估算，不传输完整 state
            const json = JSON.stringify(state);
            const t2 = performance.now();
            return {
                getState_ms: Math.round(t1 - t0),
                stringify_ms: Math.round(t2 - t1),
                json_bytes: json.length,
                app_keys: state?.apps ? Object.keys(state.apps) : [],
            };
        }""")
        timer.lap("getState() 在浏览器内计时 + stringify")

        # 6d: 测量各 app state 大小
        app_sizes = await page.evaluate("""() => {
            const t0 = performance.now();
            const state = window.__SIM__?.getState?.();
            const t1 = performance.now();
            if (!state?.apps) return { getState_ms: Math.round(t1-t0), apps: {} };
            const sizes = {};
            for (const [k, v] of Object.entries(state.apps)) {
                const s = JSON.stringify(v);
                sizes[k] = { bytes: s.length, keys: v ? Object.keys(v).length : 0 };
            }
            return { getState_ms: Math.round(t1-t0), apps: sizes };
        }""")
        timer.lap("getState() + 逐 app 测大小")

        # 打印 app 大小排行
        if isinstance(app_sizes, dict) and app_sizes.get("apps"):
            print(f"\n  ── App State 大小排行 (getState JS 耗时: {app_sizes.get('getState_ms', '?')}ms) ──")
            sorted_apps = sorted(app_sizes["apps"].items(), key=lambda x: -x[1]["bytes"])
            for name, info in sorted_apps[:15]:
                kb = info["bytes"] / 1024
                print(f"    {kb:8.1f} KB  ({info['keys']:3} keys)  {name}")
            total_kb = sum(v["bytes"] for v in app_sizes["apps"].values()) / 1024
            print(f"    {'─' * 40}")
            print(f"    {total_kb:8.1f} KB  总计")

        # 6e: 完整 getState — 直接传输（旧方式）
        await page.evaluate("() => window.__SIM__?.getState?.() || null")
        timer.lap("getState() 直接传输 (无压缩)")

        # 6f: 完整 getState — gzip 压缩传输（新方式，与 mobile_gym.py 生产路径一致）
        compressed_b64 = await page.evaluate(
            """async () => {
                const state = window.__SIM__?.getState?.();
                if (!state) return null;
                const json = JSON.stringify(state);
                const blob = new Blob([json]);
                const cs = new CompressionStream('gzip');
                const compressed = await new Response(blob.stream().pipeThrough(cs)).arrayBuffer();
                const bytes = new Uint8Array(compressed);
                const b64 = typeof bytes.toBase64 === 'function'
                    ? bytes.toBase64()
                    : (() => {
                        let s = '', C = 8192;
                        for (let i = 0; i < bytes.length; i += C)
                            s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + C, bytes.length)));
                        return btoa(s);
                    })();
                return b64;
            }"""
        )
        if compressed_b64:
            raw = gzip.decompress(base64.b64decode(compressed_b64))
            _state = json_mod.loads(raw)
            compressed_kb = len(compressed_b64) / 1024
            original_kb = len(raw) / 1024
            print(f"\n  ── 压缩效果: {original_kb:.0f}KB → {compressed_kb:.0f}KB (压缩比 {len(raw)/len(compressed_b64):.1f}x) ──")
        timer.lap("getState() gzip 压缩传输")

        # 6g: btoa 三种方法对比（在同一份压缩数据上）
        btoa_bench = await page.evaluate(
            """async () => {
                const state = window.__SIM__?.getState?.();
                if (!state) return null;
                const json = JSON.stringify(state);
                if (json.length < 100000) return {skipped: true, reason: `state too small (${json.length} bytes), gzip branch not triggered`};

                // 先压缩，拿到 bytes
                const blob = new Blob([json]);
                const cs = new CompressionStream('gzip');
                const compressed = await new Response(blob.stream().pipeThrough(cs)).arrayBuffer();
                const bytes = new Uint8Array(compressed);
                const RUNS = 5;

                // 方法 A：旧版 O(n) 逐字符循环
                let t0 = performance.now();
                for (let r = 0; r < RUNS; r++) {
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                    btoa(binary);
                }
                const ms_loop = (performance.now() - t0) / RUNS;

                // 方法 B：分块 apply
                t0 = performance.now();
                for (let r = 0; r < RUNS; r++) {
                    let s = '', C = 8192;
                    for (let i = 0; i < bytes.length; i += C)
                        s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + C, bytes.length)));
                    btoa(s);
                }
                const ms_chunk = (performance.now() - t0) / RUNS;

                // 方法 C：原生 toBase64()（Chrome 130+）
                let ms_native = null;
                if (typeof bytes.toBase64 === 'function') {
                    t0 = performance.now();
                    for (let r = 0; r < RUNS; r++) bytes.toBase64();
                    ms_native = (performance.now() - t0) / RUNS;
                }

                return {
                    skipped: false,
                    json_kb: Math.round(json.length / 1024),
                    compressed_kb: Math.round(bytes.length / 1024),
                    ms_loop: Math.round(ms_loop * 10) / 10,
                    ms_chunk: Math.round(ms_chunk * 10) / 10,
                    ms_native: ms_native !== null ? Math.round(ms_native * 10) / 10 : null,
                    has_native: typeof bytes.toBase64 === 'function',
                };
            }"""
        )
        if btoa_bench:
            if btoa_bench.get('skipped'):
                print(f"\n  ── btoa 对比：{btoa_bench['reason']} ──")
            else:
                print(f"\n  ── btoa 方法对比（state {btoa_bench['json_kb']}KB → 压缩后 {btoa_bench['compressed_kb']}KB，各跑 5 次取均值）──")
                print(f"    旧版 O(n) 循环:    {btoa_bench['ms_loop']:6.1f} ms")
                print(f"    分块 apply:        {btoa_bench['ms_chunk']:6.1f} ms  ({btoa_bench['ms_loop']/btoa_bench['ms_chunk']:.1f}x 加速)")
                if btoa_bench['ms_native'] is not None:
                    print(f"    原生 toBase64():   {btoa_bench['ms_native']:6.1f} ms  ({btoa_bench['ms_loop']/btoa_bench['ms_native']:.1f}x 加速)")
                else:
                    print(f"    原生 toBase64():   不支持（Chrome < 130）")
        timer.lap("btoa 三种方法对比")

        # ── 7. _get_observation() (screenshot) ──────────────────
        await page.screenshot(type="jpeg", quality=80)
        timer.lap("screenshot (initial)")

        # ── 8. open_app (逐个打开，单页面不支持并行) ─────────
        async def open_one_app(aid: str) -> list[tuple[str, float]]:
            """打开单个 app 并返回子步骤计时"""
            steps = []
            t = time.perf_counter()

            await page.evaluate("({a}) => window.__OS__?.openApp(a)", {"a": aid})
            steps.append((f"  openApp('{aid}') evaluate", time.perf_counter() - t))
            t = time.perf_counter()

            try:
                await page.wait_for_function("() => window.__OS__?.getAppRoute?.()?.app", timeout=8000)
            except Exception:
                pass
            steps.append((f"  wait __OS__.getAppRoute() ({aid})", time.perf_counter() - t))
            t = time.perf_counter()

            try:
                await page.wait_for_load_state("domcontentloaded", timeout=5000)
            except Exception:
                pass
            steps.append((f"  wait domcontentloaded ({aid})", time.perf_counter() - t))
            t = time.perf_counter()

            await asyncio.sleep(0.3)
            steps.append((f"  sleep 0.3s ({aid})", time.perf_counter() - t))

            return steps

        for aid in app_ids:
            steps = await open_one_app(aid)
            timer.lap(f"open_app('{aid}')")
            for label, dt in steps:
                print(f"    +{dt:.3f}s  {label}")

        # ── 9. go_home() ────────────────────────────────────────
        await page.evaluate("() => window.__OS__?.goHome()")
        await asyncio.sleep(0.3)
        timer.lap("go_home() + sleep")

        # ── 10. 最终 observation ────────────────────────────────
        await page.screenshot(type="jpeg", quality=80)
        timer.lap("screenshot (final)")

        # ── 汇总 ───────────────────────────────────────────────
        timer.summary()

        # ── 慢资源 Top 10 ──────────────────────────────────────
        perf_entries = await page.evaluate("""() => {
            return performance.getEntriesByType('resource').map(e => ({
                name: e.name.replace(location.origin, ''),
                duration: Math.round(e.duration),
                transferSize: e.transferSize || 0,
                initiatorType: e.initiatorType,
            }));
        }""")
        slowest = sorted(perf_entries, key=lambda x: -x["duration"])[:10]
        print(f"\n── 最慢资源 Top 10 ──")
        for e in slowest:
            kb = e['transferSize'] / 1024
            print(f"  {e['duration']:5}ms  {kb:6.1f}KB  [{e['initiatorType']}]  {e['name'][:80]}")

        await asyncio.sleep(1)
        await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="bench_env 启动性能诊断")
    parser.add_argument("--env-url", default="http://localhost:3000")
    parser.add_argument("--apps", default="redbook,wechat",
                        help="逗号分隔的 app ID 列表，如 redbook,wechat")
    args = parser.parse_args()

    app_ids = [a.strip() for a in args.apps.split(",")]
    asyncio.run(diagnose(args.env_url, app_ids))
