"""
RealDeviceEnv - ADB-based real device environment.

This module provides a lightweight ADB interface for controlling real Android devices
or standard emulators. It supports visual-based agents (VLM) through screenshots and
basic touch interactions.
"""

from __future__ import annotations

import asyncio
import shlex
import subprocess
from typing import Any, Optional, Tuple, TYPE_CHECKING

from bench_env.logger import get_logger
from bench_env.env.base import Action, ActionType, BaseMobileEnv, Observation, StepResult

if TYPE_CHECKING:
    from bench_env.task.base import BaseTask

logger = get_logger(__name__)


# App name -> package name mapping (from Open-AutoGLM)
# Supports both Chinese names and English aliases
APP_PACKAGES: dict[str, str] = {
    # ==================== Mobile-Gym Simulator Apps ====================
    # WeChat
    "微信": "com.tencent.mm",
    "WeChat": "com.tencent.mm",
    "wechat": "com.tencent.mm",
    # RedBook (小红书)
    "小红书": "com.xingin.xhs",
    "RedBook": "com.xingin.xhs",
    "redbook": "com.xingin.xhs",
    "xiaohongshu": "com.xingin.xhs",
    # Alipay (支付宝)
    "支付宝": "com.eg.android.AlipayGphone",
    "Alipay": "com.eg.android.AlipayGphone",
    "alipay": "com.eg.android.AlipayGphone",
    # Bilibili (B站)
    "哔哩哔哩": "tv.danmaku.bili",
    "bilibili": "tv.danmaku.bili",
    "Bilibili": "tv.danmaku.bili",
    "B站": "tv.danmaku.bili",
    # Map (地图) - Google Maps
    "Map": "com.google.android.apps.maps",
    "map": "com.google.android.apps.maps",
    "Google Maps": "com.google.android.apps.maps",
    "googlemaps": "com.google.android.apps.maps",
    # 高德地图
    "高德地图": "com.autonavi.minimap",
    "amap": "com.autonavi.minimap",
    "gaode": "com.autonavi.minimap",
    # QQ Music (QQ音乐)
    "QQ音乐": "com.tencent.qqmusic",
    "QQMusic": "com.tencent.qqmusic",
    "qqmusic": "com.tencent.qqmusic",
    # Spotify
    "Spotify": "com.spotify.music",
    "spotify": "com.spotify.music",
    # Tencent Meeting (腾讯会议)
    "腾讯会议": "com.tencent.wemeet.app",
    "TencentMeeting": "com.tencent.wemeet.app",
    "tencent_meeting": "com.tencent.wemeet.app",
    "tencentmeeting": "com.tencent.wemeet.app",
    "wemeet": "com.tencent.wemeet.app",
    # WeChat Reading (微信读书)
    "微信读书": "com.tencent.weread",
    "WechatReading": "com.tencent.weread",
    "wechat_reading": "com.tencent.weread",
    "wechatreading": "com.tencent.weread",
    "weread": "com.tencent.weread",
    # X (Twitter)
    "X": "com.twitter.android",
    "x": "com.twitter.android",
    "Twitter": "com.twitter.android",
    "twitter": "com.twitter.android",
    # Weather (天气) - MIUI
    "天气": "com.miui.weather2",
    "Weather": "com.miui.weather2",
    "weather": "com.miui.weather2",
    # Notes (备忘录) - MIUI
    "备忘录": "com.miui.notes",
    "Notes": "com.miui.notes",
    "notes": "com.miui.notes",
    # Gallery (相册) - MIUI
    "相册": "com.miui.gallery",
    "Gallery": "com.miui.gallery",
    "gallery": "com.miui.gallery",
    # FileManager (文件管理)
    "文件管理": "com.android.fileexplorer",
    "FileManager": "com.android.fileexplorer",
    "file_manager": "com.android.fileexplorer",
    "filemanager": "com.android.fileexplorer",
    "Files": "com.android.fileexplorer",
    # Calculator (计算器) - MIUI
    "计算器": "com.miui.calculator",
    "Calculator": "com.miui.calculator",
    "calculator": "com.miui.calculator",
    # Browser (浏览器)
    "浏览器": "com.android.browser",
    "Browser": "com.android.browser",
    "browser": "com.android.browser",
    # Calendar (日历)
    "日历": "com.android.calendar",
    "Calendar": "com.android.calendar",
    "calendar": "com.android.calendar",
    # SMS (短信)
    "短信": "com.android.mms",
    "Messages": "com.android.mms",
    "sms": "com.android.mms",

    # ==================== Other Common Apps ====================
    # Social & Messaging
    "QQ": "com.tencent.mobileqq",
    "微博": "com.sina.weibo",
    "weibo": "com.sina.weibo",
    "Telegram": "org.telegram.messenger",
    "WhatsApp": "com.whatsapp",
    # E-commerce
    "淘宝": "com.taobao.taobao",
    "taobao": "com.taobao.taobao",
    "京东": "com.jingdong.app.mall",
    "jd": "com.jingdong.app.mall",
    "拼多多": "com.xunmeng.pinduoduo",
    "pinduoduo": "com.xunmeng.pinduoduo",
    "Temu": "com.einnovation.temu",
    "eBay": "com.ebay.mobile",
    "ebay": "com.ebay.mobile",
    # Lifestyle & Social
    "豆瓣": "com.douban.frodo",
    "douban": "com.douban.frodo",
    "知乎": "com.zhihu.android",
    "zhihu": "com.zhihu.android",
    "Reddit": "com.reddit.frontpage",
    "Quora": "com.quora.android",
    # Maps & Navigation
    "百度地图": "com.baidu.BaiduMap",
    "baidumap": "com.baidu.BaiduMap",
    "Google Maps": "com.google.android.apps.maps",
    # Food & Services
    "美团": "com.sankuai.meituan",
    "meituan": "com.sankuai.meituan",
    "大众点评": "com.dianping.v1",
    "饿了么": "me.ele",
    "eleme": "me.ele",
    "肯德基": "com.yek.android.kfc.activitys",
    "McDonald": "com.mcdonalds.app",
    # Travel
    "携程": "ctrip.android.view",
    "ctrip": "ctrip.android.view",
    "铁路12306": "com.MobileTicket",
    "12306": "com.MobileTicket",
    "railway12306": "com.MobileTicket",
    "去哪儿": "com.Qunar",
    "滴滴出行": "com.sdu.didi.psnger",
    "didi": "com.sdu.didi.psnger",
    "Booking": "com.booking",
    "Expedia": "com.expedia.bookings",
    # Video & Entertainment
    "抖音": "com.ss.android.ugc.aweme",
    "douyin": "com.ss.android.ugc.aweme",
    "TikTok": "com.zhiliaoapp.musically",
    "tiktok": "com.zhiliaoapp.musically",
    "快手": "com.smile.gifmaker",
    "kuaishou": "com.smile.gifmaker",
    "腾讯视频": "com.tencent.qqlive",
    "爱奇艺": "com.qiyi.video",
    "iqiyi": "com.qiyi.video",
    "优酷视频": "com.youku.phone",
    "youku": "com.youku.phone",
    # Music & Audio
    "网易云音乐": "com.netease.cloudmusic",
    "netease_music": "com.netease.cloudmusic",
    "喜马拉雅": "com.ximalaya.ting.android",
    "ximalaya": "com.ximalaya.ting.android",
    # Productivity
    "飞书": "com.ss.android.lark",
    "feishu": "com.ss.android.lark",
    "Gmail": "com.google.android.gm",
    # Browser
    "Chrome": "com.android.chrome",
    "chrome": "com.android.chrome",
    # System
    "Settings": "com.android.settings",
    "settings": "com.android.settings",
    "设置": "com.android.settings",
    "Clock": "com.android.deskclock",
    "Contacts": "com.android.contacts",
    "Google Play Store": "com.android.vending",
    # AI & Tools
    "豆包": "com.larus.nova",
    "doubao": "com.larus.nova",
    "Duolingo": "com.duolingo",
    # Reading
    "番茄小说": "com.dragon.read",
    # News
    "腾讯新闻": "com.tencent.news",
    "今日头条": "com.ss.android.article.news",
    "toutiao": "com.ss.android.article.news",
}


def _package_to_app_name(package: str) -> Optional[str]:
    """Convert package name to app display name."""
    for name, pkg in APP_PACKAGES.items():
        if pkg == package or package.startswith(pkg):
            return name
    return None


class ActionHandler:
    """Base class for action handlers (Real Device)."""
    def __init__(self, env: "RealDeviceEnv"):
        self.env = env
        
    async def execute(self, action: Action) -> None:
        raise NotImplementedError


class ClickHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        x, y = self.env._parse_point(action.data.get("point"))
        await self.env._tap(x, y)


class TypeHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        value = str(action.data.get("value", ""))
        point = action.data.get("point")
        clear = bool(action.data.get("clear", False))
        if point:
            x, y = self.env._parse_point(point)
            await self.env._tap(x, y)
        if clear:
            await self.env._clear_input()
        await self.env._type_text(value)


class DoubleTapHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        x, y = self.env._parse_point(action.data.get("point"))
        await self.env._tap(x, y)
        await asyncio.sleep(0.08)
        await self.env._tap(x, y)


class LongPressHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        x, y = self.env._parse_point(action.data.get("point"))
        duration = int(action.data.get("duration", 800))
        await self.env._long_press(x, y, duration_ms=duration)


class SwipeHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        x1, y1 = self.env._parse_point(action.data.get("point1"))
        x2, y2 = self.env._parse_point(action.data.get("point2"))
        duration = int(action.data.get("duration", 300))
        await self.env._swipe(x1, y1, x2, y2, duration_ms=duration)


class BackHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        await self.env._press_key("KEYCODE_BACK")


class HomeHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        await self.env._press_key("KEYCODE_HOME")


class RecentHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        await self.env._press_key("KEYCODE_APP_SWITCH")


class EnterHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        await self.env._press_key("KEYCODE_ENTER")


class DragHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        x1, y1 = self.env._parse_point(action.data.get("point1"))
        x2, y2 = self.env._parse_point(action.data.get("point2"))
        duration = int(action.data.get("duration", 2000))
        await self.env._swipe(x1, y1, x2, y2, duration_ms=duration)


class WaitHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        secs = float(action.data.get("value", 1.0))
        await asyncio.sleep(max(0.0, secs))


class AwakeHandler(ActionHandler):
    async def execute(self, action: Action) -> None:
        app_name = str(action.data.get("value", "")).strip()
        if app_name:
            await self.env._launch_app(app_name)


class RealDeviceEnv(BaseMobileEnv):
    """
    ADB-based real Android device environment.

    This is a lightweight implementation for real device support.

    Limitations:
    - Text Input: Uses YADB for Chinese/Unicode input (auto-installed on first run).
      Falls back to `adb shell input text` for ASCII-only if YADB fails.
    - Observation: Visual only (screenshot). No XML/ViewHierarchy dumping.
    - App Launch: Basic `monkey` launch.
    - State injection: Not supported (no set_state, no answer_sheet app).

    Example usage (once implemented):
        env = RealDeviceEnv(
            device_serial="emulator-5554",  # or real device serial
            adb_path="~/Android/Sdk/platform-tools/adb",
        )
        env.start()
        obs = env.reset(task)
        ...
    """

    # No JSON state mutation on a real device — grounded-mode answer_sheet
    # injection and similar state-seeding hooks must be skipped.
    supports_state_injection: bool = False

    def __init__(
        self,
        *,
        device_serial: Optional[str] = None,
        adb_path: str = "adb",
        physical_size: Tuple[int, int] = (1080, 2400),
        coord_space: str = "norm_0_1000",
        delay_after_action: float = 1.0,
    ):
        """
        Initialize RealDeviceEnv.
        
        Args:
            device_serial: Device serial number (from `adb devices`)
            adb_path: Path to adb executable
            physical_size: Device screen size (width, height)
            coord_space: Coordinate space ("norm_0_1000", "norm_0_1", or "physical")
            delay_after_action: Delay after each action in seconds
        """
        self.device_serial = device_serial
        self.adb_path = adb_path
        self.physical_width, self.physical_height = physical_size
        self.coord_space = coord_space
        self.delay_after_action = delay_after_action

        self._task: Optional[BaseTask] = None
        self._step_count = 0
        self._done = False
        self._agent_message: Optional[str] = None
        self._agent_answer: Optional[str] = None
        # package -> "package/MainActivity", resolved lazily via pm resolve-activity.
        # Empty string = resolution failed previously (skip and fall back to monkey).
        self._main_activity_cache: dict[str, str] = {}

        from bench_env.env.stopwatch import StopWatch
        self.stopwatch = StopWatch()

        # Initialize handlers
        self._handlers: dict[ActionType, ActionHandler] = {
            ActionType.CLICK: ClickHandler(self),
            ActionType.DOUBLE_TAP: DoubleTapHandler(self),
            ActionType.LONG_PRESS: LongPressHandler(self),
            ActionType.TYPE: TypeHandler(self),
            ActionType.SWIPE: SwipeHandler(self),
            ActionType.DRAG: DragHandler(self),
            ActionType.BACK: BackHandler(self),
            ActionType.HOME: HomeHandler(self),
            ActionType.RECENT: RecentHandler(self),
            ActionType.ENTER: EnterHandler(self),
            ActionType.WAIT: WaitHandler(self),
            ActionType.AWAKE: AwakeHandler(self),
        }

    async def start(self) -> "RealDeviceEnv":
        """Connect to device and initialize required tools."""
        # Check connectivity
        out = await self._adb("shell", "getprop", "ro.product.model")
        if not out:
            raise RuntimeError(f"Failed to connect to device {self.device_serial}")
        logger.info(f"Connected to {out.strip()}")
        
        # Initialize YADB for Chinese text input
        await self._init_yadb()
        
        return self
    
    async def _init_yadb(self) -> None:
        """
        Initialize YADB (Yet Another Debug Bridge) for Chinese text input.
        
        Checks if yadb is installed on device, if not, pushes it from local project.
        """
        logger.debug("Checking YADB installation...")
        
        # Check if yadb exists and has correct md5
        YADB_MD5 = "29a0cd3b3adea92350dd5a25594593df"
        result = await self._adb("shell", "md5sum", "/data/local/tmp/yadb")
        
        if YADB_MD5 in result:
            logger.info("YADB is already installed on the device")
            return
        
        logger.info("YADB not found or outdated on device, need to install...")
        
        # Find yadb file in project
        import os
        bench_env_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        project_root = os.path.dirname(bench_env_dir)
        yadb_paths = [
            os.path.join(bench_env_dir, "yadb"),  # bench_env/yadb (preferred)
            os.path.join(project_root, "gelab-zero", "yadb"),
            os.path.join(project_root, "yadb"),
        ]
        
        yadb_path = None
        for path in yadb_paths:
            if os.path.exists(path):
                yadb_path = path
                logger.debug(f"Found YADB at: {yadb_path}")
                break
        
        if not yadb_path:
            logger.warning("YADB not found in any of the expected paths:")
            for path in yadb_paths:
                logger.warning(f"  - {path}")
            logger.warning("Chinese text input may not work. "
                          "Please manually push yadb to /data/local/tmp/yadb")
            return
        
        # Push yadb to device
        logger.info(f"Pushing YADB from {yadb_path} to device...")
        push_result = await self._adb_push(yadb_path, "/data/local/tmp/yadb")
        if not push_result:
            logger.error("Failed to push YADB to device")
            return
        logger.info(f"YADB pushed: {push_result.strip()}")
        
        # Set executable permission
        logger.debug("Setting YADB executable permission...")
        chmod_result = await self._adb("shell", "chmod", "+x", "/data/local/tmp/yadb")
        
        # Verify installation
        verify_result = await self._adb("shell", "md5sum", "/data/local/tmp/yadb")
        if YADB_MD5 in verify_result:
            logger.info("YADB installed and verified successfully")
        else:
            logger.warning(f"YADB installed but MD5 mismatch. Expected: {YADB_MD5}, Got: {verify_result.strip()}")
    
    async def _adb_push(self, local_path: str, remote_path: str) -> str:
        """Push a file to the device."""
        cmd = [self.adb_path]
        if self.device_serial:
            cmd.extend(["-s", self.device_serial])
        cmd.extend(["push", local_path, remote_path])
        
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            logger.error(f"[ADB Push Error] {stderr.decode()}")
            return ""
        # Modern `adb push` writes progress / "1 file pushed" to stderr and
        # leaves stdout empty; returning stdout here made callers that check
        # `if not push_result:` treat a successful push as a failure. Return
        # a non-empty sentinel on success and log the stderr diagnostics.
        stderr_text = stderr.decode().strip()
        if stderr_text:
            logger.debug(f"[ADB Push] {stderr_text}")
        return "ok"

    async def close(self) -> None:
        """Disconnect from device."""
        pass

    async def reset(self, app_ids: list[str] | None = None) -> None:
        """Reset for a new episode.

        `app_ids` is accepted for signature parity with MobileGymEnv but
        ignored: on real devices we always force-stop every package listed in
        APP_PACKAGES so the next episode starts from a fully clean background,
        regardless of which apps the task declares.
        """
        self._step_count = 0
        self._done = False
        self._agent_message = None
        self._agent_answer = None

        await self._press_key("KEYCODE_HOME")
        await asyncio.sleep(0.1)

        # Force-stop every package listed in APP_PACKAGES so each episode starts from
        # a clean background. We only touch apps we explicitly benchmark — system
        # components (Launcher, IME, SystemUI) are left untouched.
        for pkg in {p for p in APP_PACKAGES.values() if "." in p}:
            await self._adb("shell", "am", "force-stop", pkg)
        await asyncio.sleep(0.3)

        # Second HOME press: most launchers (MIUI, Pixel) scroll back to the first
        # page on a second HOME while already on the launcher.
        await self._press_key("KEYCODE_HOME")
        await asyncio.sleep(0.1)

    async def step(self, action: Action) -> StepResult:
        self._step_count += 1
        action_type = action.action_type

        if action_type == ActionType.ANSWER:
            value = str(action.data.get("value", ""))
            self._agent_answer = value
            logger.info(f"ANSWER: {value}")
            return StepResult(
                await self._get_observation(),
                False,
                {"action_type": ActionType.ANSWER, "answer": value},
            )
        
        if action_type == ActionType.COMPLETE:
            self._done = True
            self._agent_message = action.data.get("return", "")
            return StepResult(await self._get_observation(), True, 
                              {"stop_reason": ActionType.COMPLETE, "message": self._agent_message})
                              
        if action_type == ActionType.ABORT:
            self._done = True
            self._agent_message = action.data.get("value", "")
            return StepResult(await self._get_observation(), True,
                              {"stop_reason": ActionType.ABORT, "message": self._agent_message})

        handler = self._handlers.get(action_type)
        if handler:
            await handler.execute(action)
        else:
            logger.warning(f"Unknown action: {action_type}")
            
        await asyncio.sleep(self.delay_after_action)
        return StepResult(await self._get_observation(), False, {})

    async def get_observation(self) -> Observation:
        """Public observation API (avoid calling private _get_observation)."""
        return await self._get_observation()

    async def get_state(self, required_apps: list[str] | None = None) -> dict[str, Any]:
        """
        Get current environment state.

        NOTE: This lightweight real-device env is visual-only; structured app/os
        state is not available yet, so we return an empty dict.
        """
        return {}

    async def open_app(
        self, 
        app_name: str, 
        timeout_ms: int = 8000,
        wait_stable: bool = False,
    ) -> None:
        """
        Open an application.

        For real devices, `app_name` is treated as a package name (or "package/activity").
        
        Args:
            app_name: App ID or package name
            timeout_ms: Timeout (ignored for ADB)
            wait_stable: Wait for app to stabilize (for real devices, we just add a delay)
        """
        # Ignore timeout_ms for now; ADB calls are best-effort.
        if not app_name:
            return
        if "/" in app_name:
            pkg, act = app_name.split("/", 1)
            await self._launch_app(pkg, act)
        else:
            await self._launch_app(app_name)
        
        # For real devices, wait a bit for app to stabilize
        if wait_stable:
            await asyncio.sleep(2.0)

    async def go_home(self) -> None:
        """Press HOME key to return to launcher."""
        await self._press_key("KEYCODE_HOME")
        await asyncio.sleep(1.0)

    @property
    def agent_message(self) -> Optional[str]:
        return self._agent_message

    @property
    def agent_answer(self) -> Optional[str]:
        return self._agent_answer

    def get_device_size(self) -> Tuple[int, int]:
        return self.physical_width, self.physical_height

    # ==================== ADB Command Helpers ====================

    async def _adb(self, *args: str) -> str:
        """Execute ADB command asynchronously."""
        cmd = [self.adb_path]
        if self.device_serial:
            cmd.extend(["-s", self.device_serial])
        cmd.extend(args)
        
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            logger.error(f"[ADB Error] cmd={cmd} err={stderr.decode()}")
            return ""
        return stdout.decode()

    async def _get_observation(self) -> Observation:
        png_bytes = await self._screenshot()

        # Get current app info
        current_app = await self._get_current_app()

        # NOTE: XML dump / ViewHierarchy is not implemented in this lightweight version.
        # This environment currently supports VLM-based agents (Visual Only).
        return Observation(
            screenshot_bytes=png_bytes,
            route={"app": current_app} if current_app else {},
            state={},
            step_idx=self._step_count,
        )

    async def _screenshot(self) -> bytes:
        """Capture screenshot via ADB."""
        # Use exec-out screencap -p for raw PNG stream (faster than shell)
        cmd = [self.adb_path]
        if self.device_serial:
            cmd.extend(["-s", self.device_serial])
        cmd.extend(["exec-out", "screencap", "-p"])
        
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        return stdout

    def _parse_point(self, point: Any) -> Tuple[int, int]:
        if point is None:
            return self.physical_width // 2, self.physical_height // 2
        if isinstance(point, (list, tuple)) and len(point) >= 2:
            x, y = float(point[0]), float(point[1])
        else:
            return self.physical_width // 2, self.physical_height // 2

        if self.coord_space == "norm_0_1000":
            x = x / 1000.0 * self.physical_width
            y = y / 1000.0 * self.physical_height
        elif self.coord_space == "norm_0_1":
            x = x * self.physical_width
            y = y * self.physical_height
            
        return int(x), int(y)

    async def _tap(self, x: int, y: int) -> None:
        await self._adb("shell", "input", "tap", str(x), str(y))

    async def _long_press(self, x: int, y: int, duration_ms: int = 800) -> None:
        await self._adb("shell", "input", "swipe", str(x), str(y), str(x), str(y), str(duration_ms))

    async def _clear_input(self) -> None:
        """Clear current input field via Ctrl+A then Delete."""
        await self._adb("shell", "input", "keyevent", "KEYCODE_MOVE_HOME")
        await self._adb("shell", "input", "keyevent", "--longpress", "KEYCODE_SHIFT_LEFT", "KEYCODE_MOVE_END")
        await self._adb("shell", "input", "keyevent", "KEYCODE_DEL")

    async def _swipe(self, x1: int, y1: int, x2: int, y2: int, duration_ms: int = 300) -> None:
        await self._adb("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration_ms))

    async def _type_text(self, text: str) -> None:
        """
        Type text into the currently focused input field.
        
        Uses YADB for all text input (supports Chinese and Unicode).
        Falls back to basic `adb shell input text` for ASCII-only if YADB fails.
        """
        logger.debug(f"Typing text: {text[:30]}{'...' if len(text) > 30 else ''}")
        
        # Always try YADB first (supports both ASCII and Unicode)
        success = await self._type_via_yadb(text)
        
        if success:
            logger.debug("Text input via YADB successful")
        else:
            # Fallback to basic input for ASCII text
            is_ascii = all(ord(c) < 128 for c in text)
            if is_ascii:
                logger.debug("YADB failed, falling back to basic adb input text")
                escaped = shlex.quote(text)
                await self._adb("shell", "input", "text", escaped)
            else:
                logger.warning(f"Failed to input non-ASCII text (YADB not available): {text[:20]}...")
    
    async def _type_via_yadb(self, text: str) -> bool:
        """
        Type text using YADB (Yet Another Debug Bridge).
        
        Supports both ASCII and Chinese/Unicode text.
        Requires yadb to be pushed to /data/local/tmp/yadb on the device.
        """
        try:
            # adb shell 会在设备端再次解析命令；这里必须保留空格为同一个参数。
            shell_text = shlex.quote(text)
            result = await self._adb(
                "shell",
                "app_process",
                "-Djava.class.path=/data/local/tmp/yadb",
                "/data/local/tmp",
                "com.ysbing.yadb.Main",
                "-keyboard",
                shell_text
            )
            # YADB returns empty on success, check for errors
            if "error" in result.lower() or "exception" in result.lower():
                logger.debug(f"YADB returned error: {result}")
                return False
            return True
        except Exception as e:
            logger.debug(f"YADB input exception: {e}")
            return False

    async def _press_key(self, keycode: str) -> None:
        await self._adb("shell", "input", "keyevent", keycode)

    async def _launch_app(self, app_or_package: str, activity: Optional[str] = None) -> None:
        """
        Launch an app by name or package.

        Args:
            app_or_package: App name (e.g., "微信", "wechat") or package name (e.g., "com.tencent.mm")
            activity: Optional activity name
        """
        package = self._resolve_package(app_or_package)

        if activity:
            # Explicit activity requested — honor it verbatim.
            await self._adb("shell", "am", "start", "-n", f"{package}/{activity}")
            return

        # Prefer `am start --activity-clear-task` so the previous Task/Recents entry
        # is wiped and the app opens from its MainActivity — avoids state carry-over
        # between episodes (e.g. resuming the last opened book in WeChat Reading).
        #
        # Pass `-a MAIN -c LAUNCHER` explicitly so entry activities that inspect the
        # incoming intent (e.g. MIUI Messaging's MmsTabActivity) treat this as a
        # launcher click and land on the default home screen, instead of
        # dispatching to a secondary flow (like "compose new message").
        component = await self._resolve_main_activity(package)
        if component:
            await self._adb(
                "shell", "am", "start",
                "-a", "android.intent.action.MAIN",
                "-c", "android.intent.category.LAUNCHER",
                "--activity-clear-task",
                "-n", component,
            )
            return

        # Fallback: standard LAUNCHER intent via monkey (does NOT clear the task).
        await self._adb(
            "shell", "monkey", "-p", package,
            "-c", "android.intent.category.LAUNCHER", "1",
        )

    async def _resolve_main_activity(self, package: str) -> str:
        """Resolve `package/MainActivity` via `cmd package resolve-activity`.

        Returns the component string usable with `am start -n`, or empty string
        if resolution fails (caller should fall back to monkey).
        """
        if package in self._main_activity_cache:
            return self._main_activity_cache[package]

        output = await self._adb(
            "shell", "cmd", "package", "resolve-activity",
            "--brief", "-c", "android.intent.category.LAUNCHER", package,
        )
        component = ""
        for line in output.splitlines():
            line = line.strip()
            # Skip the priority/preferredOrder header line — the component line
            # contains a slash and no '=' assignments.
            if "/" in line and "=" not in line and line.startswith(package + "/"):
                component = line
                break
        self._main_activity_cache[package] = component
        return component
    
    def _resolve_package(self, app_or_package: str) -> str:
        """
        Resolve app name to package name.
        
        Checks APP_PACKAGES mapping first, otherwise returns the input as-is
        (assuming it's already a package name).
        """
        # Direct match in APP_PACKAGES
        if app_or_package in APP_PACKAGES:
            return APP_PACKAGES[app_or_package]
        
        # Case-insensitive match
        lower_name = app_or_package.lower()
        for name, pkg in APP_PACKAGES.items():
            if name.lower() == lower_name:
                return pkg
        
        # Check if it's already a package name (contains dots)
        if "." in app_or_package:
            return app_or_package
        
        logger.warning(f"Unknown app '{app_or_package}', using as package name directly")
        return app_or_package

    async def _get_current_app(self) -> Optional[str]:
        """
        Get the currently focused app name via ADB.
        
        Uses `dumpsys window` to find mCurrentFocus/mFocusedApp,
        then matches package name against APP_PACKAGES mapping.
        
        Returns:
            App display name (e.g., "微信") or None if not recognized.
        """
        output = await self._adb("shell", "dumpsys", "window")
        if not output:
            return None
        
        # Parse window focus info
        for line in output.split("\n"):
            if "mCurrentFocus" in line or "mFocusedApp" in line:
                # Extract package name from line like:
                # mCurrentFocus=Window{...com.tencent.mm/com.tencent.mm.ui.LauncherUI...}
                for app_name, package in APP_PACKAGES.items():
                    if package in line:
                        return app_name
        
        return None
