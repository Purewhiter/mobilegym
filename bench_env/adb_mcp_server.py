#!/usr/bin/env python3
"""
ADB MCP Server - 通过 ADB 控制真实 Android 手机

启动方法:
    python bench_env/adb_mcp_server.py

功能:
    - 截图、点击、双击、长按、滑动
    - 输入文本（支持中文，需要 YADB）
    - 返回、主页、打开应用
    - 获取 UI 层级结构
"""

import asyncio
import base64
import json
import shlex
from typing import Optional

import os
import shutil

try:
    from bench_env.layout_utils import parse_adb_elements
except ImportError:
    import sys as _sys
    from pathlib import Path as _Path
    _sys.path.insert(0, str(_Path(__file__).parent.parent))
    from bench_env.layout_utils import parse_adb_elements

# MCP SDK
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent, ImageContent
except ImportError:
    print("请先安装 mcp 包: pip install mcp") 
    raise

def find_adb_path() -> str:
    """查找 ADB 可执行文件的路径"""
    # Debug logging
    try:
        with open("/tmp/adb_mcp_debug.log", "w") as f:
            f.write(f"Searching for ADB...\n")
            f.write(f"PATH: {os.environ.get('PATH')}\n")
            f.write(f"HOME: {os.path.expanduser('~')}\n")
    except Exception:
        pass

    # 1. 尝试从 PATH 查找
    adb_in_path = shutil.which("adb")
    if adb_in_path:
        try:
            with open("/tmp/adb_mcp_debug.log", "a") as f:
                f.write(f"Found in PATH: {adb_in_path}\n")
        except: pass
        return adb_in_path
    
    # 2. 尝试常见路径
    home = os.path.expanduser("~")
    common_paths = [
        "/Users/purew/Library/Android/sdk/platform-tools/adb", # Explicit path
        os.path.join(home, "Library/Android/sdk/platform-tools/adb"),  # macOS Android Studio
        os.path.join(home, "AppData/Local/Android/Sdk/platform-tools/adb.exe"),  # Windows
        "/usr/bin/adb",
        "/usr/local/bin/adb",
        "/opt/homebrew/bin/adb",
        # Android Studio (Windows default)
        os.path.join(home, "AppData/Local/Android/sdk/platform-tools/adb.exe"),
    ]
    
    for path in common_paths:
        if os.path.exists(path) and os.access(path, os.X_OK):
            try:
                with open("/tmp/adb_mcp_debug.log", "a") as f:
                    f.write(f"Found in common paths: {path}\n")
            except: pass
            return path
            
    # 3. 回退到默认
    try:
        with open("/tmp/adb_mcp_debug.log", "a") as f:
            f.write("Not found, falling back to 'adb'\n")
    except: pass
    return "adb"

# ADB 配置
ADB_PATH = find_adb_path()
ADB_DEVICE_SERIAL: Optional[str] = None  # 设置为 None 使用默认设备，或指定设备序列号

# MCP 服务器
server = Server("adb-controller")

# 应用名称到包名的映射
APP_PACKAGES: dict[str, str] = {
    # 社交通讯
    "微信": "com.tencent.mm",
    "wechat": "com.tencent.mm",
    "WeChat": "com.tencent.mm",
    "QQ": "com.tencent.mobileqq",
    "qq": "com.tencent.mobileqq",
    # 小红书
    "小红书": "com.xingin.xhs",
    "redbook": "com.xingin.xhs",
    "RedBook": "com.xingin.xhs",
    # 支付宝
    "支付宝": "com.eg.android.AlipayGphone",
    "alipay": "com.eg.android.AlipayGphone",
    "Alipay": "com.eg.android.AlipayGphone",
    # 哔哩哔哩
    "哔哩哔哩": "tv.danmaku.bili",
    "bilibili": "tv.danmaku.bili",
    "Bilibili": "tv.danmaku.bili",
    "B站": "tv.danmaku.bili",
    # 地图
    "高德地图": "com.autonavi.minimap",
    "amap": "com.autonavi.minimap",
    "百度地图": "com.baidu.BaiduMap",
    # 短视频
    "抖音": "com.ss.android.ugc.aweme",
    "douyin": "com.ss.android.ugc.aweme",
    "快手": "com.smile.gifmaker",
    "kuaishou": "com.smile.gifmaker",
    # 天气
    "天气": "com.miui.weather2",
    "weather": "com.miui.weather2",
    # 系统
    "设置": "com.android.settings",
    "settings": "com.android.settings",
    "Settings": "com.android.settings",
    # 会议
    "腾讯会议": "com.tencent.wemeet.app",
    "wemeet": "com.tencent.wemeet.app",
    # 阅读
    "微信读书": "com.tencent.weread",
    "weread": "com.tencent.weread",
    # 音乐
    "QQ音乐": "com.tencent.qqmusic",
    "qqmusic": "com.tencent.qqmusic",
    "Spotify": "com.spotify.music",
    "spotify": "com.spotify.music",
    "网易云音乐": "com.netease.cloudmusic",
    # 购物
    "淘宝": "com.taobao.taobao",
    "taobao": "com.taobao.taobao",
    "京东": "com.jingdong.app.mall",
    "jd": "com.jingdong.app.mall",
    "拼多多": "com.xunmeng.pinduoduo",
    # 外卖
    "美团": "com.sankuai.meituan",
    "meituan": "com.sankuai.meituan",
    "饿了么": "me.ele",
    "eleme": "me.ele",
    # 出行
    "滴滴出行": "com.sdu.didi.psnger",
    "didi": "com.sdu.didi.psnger",
    "铁路12306": "com.MobileTicket",
    "12306": "com.MobileTicket",
    # 浏览器
    "Chrome": "com.android.chrome",
    "chrome": "com.android.chrome",
    # 社交媒体
    "微博": "com.sina.weibo",
    "weibo": "com.sina.weibo",
    "X": "com.twitter.android",
    "x": "com.twitter.android",
    "Twitter": "com.twitter.android",
}


# ==================== ADB 命令执行 ====================

async def adb_exec(*args: str, timeout: float | None = None) -> tuple[bool, str]:
    """执行 ADB 命令，返回 (成功, 输出)。timeout 单位为秒。"""
    cmd = [ADB_PATH]
    if ADB_DEVICE_SERIAL:
        cmd.extend(["-s", ADB_DEVICE_SERIAL])
    cmd.extend(args)
    
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return False, f"命令超时（{timeout}秒）"
        if proc.returncode != 0:
            return False, stderr.decode()
        return True, stdout.decode()
    except Exception as e:
        return False, str(e)


async def adb_exec_raw(*args: str) -> tuple[bool, bytes]:
    """执行 ADB 命令，返回原始字节（用于截图）"""
    cmd = [ADB_PATH]
    if ADB_DEVICE_SERIAL:
        cmd.extend(["-s", ADB_DEVICE_SERIAL])
    cmd.extend(args)
    
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            return False, stderr
        return True, stdout
    except Exception as e:
        return False, str(e).encode()


def resolve_package(app_name: str) -> str:
    """将应用名称解析为包名"""
    if app_name in APP_PACKAGES:
        return APP_PACKAGES[app_name]
    lower_name = app_name.lower()
    for name, pkg in APP_PACKAGES.items():
        if name.lower() == lower_name:
            return pkg
    # 如果包含点号，认为已经是包名
    if "." in app_name:
        return app_name
    return app_name


# ==================== MCP 工具定义 ====================

@server.list_tools()
async def list_tools() -> list[Tool]:
    """列出所有可用的工具"""
    return [
        Tool(
            name="adb_screenshot",
            description="截取真实手机屏幕，返回 PNG 图片",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="adb_tap",
            description="在真实手机上点击指定位置（物理像素坐标）",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X 坐标（物理像素）"},
                    "y": {"type": "number", "description": "Y 坐标（物理像素）"},
                },
                "required": ["x", "y"]
            }
        ),
        Tool(
            name="adb_double_tap",
            description="在真实手机上双击指定位置",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X 坐标（物理像素）"},
                    "y": {"type": "number", "description": "Y 坐标（物理像素）"},
                },
                "required": ["x", "y"]
            }
        ),
        Tool(
            name="adb_long_press",
            description="在真实手机上长按指定位置",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X 坐标（物理像素）"},
                    "y": {"type": "number", "description": "Y 坐标（物理像素）"},
                    "duration": {"type": "number", "description": "长按时长(ms)，默认 800", "default": 800},
                },
                "required": ["x", "y"]
            }
        ),
        Tool(
            name="adb_swipe",
            description="在真实手机上滑动",
            inputSchema={
                "type": "object",
                "properties": {
                    "x1": {"type": "number", "description": "起点 X"},
                    "y1": {"type": "number", "description": "起点 Y"},
                    "x2": {"type": "number", "description": "终点 X"},
                    "y2": {"type": "number", "description": "终点 Y"},
                    "duration": {"type": "number", "description": "滑动时长(ms)，默认 300", "default": 300},
                },
                "required": ["x1", "y1", "x2", "y2"]
            }
        ),
        Tool(
            name="adb_input",
            description="在真实手机上输入文本（需要先点击输入框）",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "要输入的文本"},
                },
                "required": ["text"]
            }
        ),
        Tool(
            name="adb_back",
            description="真实手机返回键",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="adb_home",
            description="真实手机主页键",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="adb_open_app",
            description="在真实手机上打开应用",
            inputSchema={
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "应用名称（如 微信、支付宝）或包名"},
                },
                "required": ["app_name"]
            }
        ),
        Tool(
            name="adb_ui_dump",
            description="获取真实手机的 UI 层级结构（XML 格式），用于想知道当前页面结构布局的情形。",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="adb_get_layout_elements",
            description="获取真实手机的 UI 元素列表（归一化到 360x800 视口坐标），用于与模拟器对比。返回扁平化的元素列表，每个元素包含 tag、id、text、bounds(x,y,width,height)。",
            inputSchema={
                "type": "object",
                "properties": {
                    "viewport_width": {"type": "integer", "description": "目标视口宽度，默认 360", "default": 360},
                    "viewport_height": {"type": "integer", "description": "目标视口高度，默认 800", "default": 800},
                },
            }
        ),
        Tool(
            name="adb_get_current_app",
            description="获取真实手机当前打开的应用",
            inputSchema={"type": "object", "properties": {}}
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """执行工具调用"""
    
    if name == "adb_screenshot":
        success, data = await adb_exec_raw("exec-out", "screencap", "-p")
        if success:
            b64 = base64.b64encode(data).decode()
            # 使用 ImageContent 直接返回图片，Cursor 可以直接显示
            return [ImageContent(
                type="image",
                data=b64,
                mimeType="image/png"
            )]
        result = {"success": False, "error": data.decode() if isinstance(data, bytes) else data}
    
    elif name == "adb_tap":
        x, y = int(arguments["x"]), int(arguments["y"])
        success, output = await adb_exec("shell", "input", "tap", str(x), str(y))
        result = {"success": success, "output": output}
    
    elif name == "adb_double_tap":
        x, y = int(arguments["x"]), int(arguments["y"])
        # 快速连续两次点击
        await adb_exec("shell", "input", "tap", str(x), str(y))
        await asyncio.sleep(0.1)
        success, output = await adb_exec("shell", "input", "tap", str(x), str(y))
        result = {"success": success, "output": output}
    
    elif name == "adb_long_press":
        x, y = int(arguments["x"]), int(arguments["y"])
        duration = int(arguments.get("duration", 800))
        # 长按用 swipe 到同一位置实现
        success, output = await adb_exec("shell", "input", "swipe", str(x), str(y), str(x), str(y), str(duration))
        result = {"success": success, "output": output}
    
    elif name == "adb_swipe":
        x1, y1 = int(arguments["x1"]), int(arguments["y1"])
        x2, y2 = int(arguments["x2"]), int(arguments["y2"])
        duration = int(arguments.get("duration", 300))
        success, output = await adb_exec("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration))
        result = {"success": success, "output": output}
    
    elif name == "adb_input":
        text = arguments["text"]
        # 尝试用 YADB 输入中文
        success, output = await adb_exec(
            "shell", "app_process",
            "-Djava.class.path=/data/local/tmp/yadb",
            "/data/local/tmp",
            "com.ysbing.yadb.Main",
            "-keyboard", text
        )
        if not success:
            # 回退到基本 input text（只支持 ASCII）
            escaped = shlex.quote(text)
            success, output = await adb_exec("shell", "input", "text", escaped)
        result = {"success": success, "output": output}
    
    elif name == "adb_back":
        success, output = await adb_exec("shell", "input", "keyevent", "KEYCODE_BACK")
        result = {"success": success, "output": output}
    
    elif name == "adb_home":
        success, output = await adb_exec("shell", "input", "keyevent", "KEYCODE_HOME")
        result = {"success": success, "output": output}
    
    elif name == "adb_open_app":
        app_name = arguments["app_name"]
        package = resolve_package(app_name)
        success, output = await adb_exec("shell", "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1")
        result = {"success": success, "package": package, "output": output}
    
    elif name == "adb_ui_dump":
        # uiautomator dump 在 UI 有持续动画时可能挂起（ERROR: could not get idle state）
        # 加超时 + 重试机制
        max_retries = 2
        dump_timeout = 10  # 秒
        dump_success = False
        dump_error = ""
        
        for attempt in range(max_retries):
            # 清理可能残留的旧文件
            await adb_exec("shell", "rm", "-f", "/sdcard/ui_dump.xml")
            
            success, output = await adb_exec(
                "shell", "uiautomator", "dump", "/sdcard/ui_dump.xml",
                timeout=dump_timeout
            )
            if success and "error" not in output.lower():
                dump_success = True
                break
            
            dump_error = output.strip() if output.strip() else "uiautomator dump 超时或失败"
            
            if attempt < max_retries - 1:
                # 短暂等待后重试，让动画/过渡有时间结束
                await asyncio.sleep(1)
        
        if dump_success:
            # 读取 dump 内容
            success, output = await adb_exec("shell", "cat", "/sdcard/ui_dump.xml")
            if success:
                result = {"success": True, "xml": output}
            else:
                result = {"success": False, "error": f"dump 成功但读取失败: {output}"}
        else:
            result = {
                "success": False,
                "error": f"UI dump 失败（重试 {max_retries} 次）: {dump_error}。"
                         f"可能原因: 当前界面有持续动画导致 uiautomator 无法获取 idle state。"
                         f"建议: 等动画结束后重试，或先按 Home 键回到主屏幕再操作。"
            }

    elif name == "adb_get_layout_elements":
        target_w = int(arguments.get("viewport_width", 360))
        target_h = int(arguments.get("viewport_height", 800))

        # 1. 获取屏幕密度
        density = 3.0  # 默认值
        success, density_output = await adb_exec("shell", "wm", "density")
        if success:
            for dline in density_output.split("\n"):
                dline_lower = dline.lower()
                val = dline.split(":")[-1].strip()
                try:
                    dpi = int(val)
                    if "override" in dline_lower:
                        density = dpi / 160.0
                        break
                    elif "physical" in dline_lower or "density" in dline_lower:
                        density = dpi / 160.0
                except ValueError:
                    continue

        # 2. 获取屏幕尺寸
        screen_w, screen_h = 1080, 2400
        success, size_output = await adb_exec("shell", "wm", "size")
        if success:
            for sline in size_output.split("\n"):
                if "size" in sline.lower():
                    parts = sline.split(":")[-1].strip().split("x")
                    if len(parts) == 2:
                        try:
                            screen_w, screen_h = int(parts[0]), int(parts[1])
                        except ValueError:
                            pass
                        break

        # 3. UI dump（复用重试逻辑）
        max_retries = 2
        dump_timeout = 10
        xml_content = None
        dump_error = ""

        for attempt in range(max_retries):
            await adb_exec("shell", "rm", "-f", "/sdcard/ui_dump.xml")
            success, output = await adb_exec(
                "shell", "uiautomator", "dump", "/sdcard/ui_dump.xml",
                timeout=dump_timeout
            )
            if success and "error" not in output.lower():
                success, xml_content = await adb_exec("shell", "cat", "/sdcard/ui_dump.xml")
                if success and xml_content:
                    break
                xml_content = None
            dump_error = output.strip() or "uiautomator dump 超时或失败"
            if attempt < max_retries - 1:
                await asyncio.sleep(1)

        if not xml_content:
            result = {"success": False, "error": f"UI dump 失败: {dump_error}"}
        else:
            # 4. 解析并归一化
            try:
                elements = parse_adb_elements(
                    xml_content, density, screen_w, screen_h, target_w, target_h
                )
                result = {
                    "success": True,
                    "data": {
                        "viewport": {"width": target_w, "height": target_h},
                        "source": "adb",
                        "density": round(density, 2),
                        "screen_px": {"width": screen_w, "height": screen_h},
                        "element_count": len(elements),
                        "elements": elements,
                    }
                }
            except Exception as e:
                result = {"success": False, "error": f"XML 解析失败: {e}"}
    
    elif name == "adb_get_current_app":
        success, output = await adb_exec("shell", "dumpsys", "window")
        if success:
            current_app = None
            current_line = None
            for line in output.split("\n"):
                if "mCurrentFocus" in line or "mFocusedApp" in line:
                    current_line = line
                    for app_name, package in APP_PACKAGES.items():
                        if package in line:
                            current_app = app_name
                            break
                    if current_app:
                        break
            result = {"success": True, "app": current_app, "raw": current_line}
        else:
            result = {"success": False, "error": output}
    
    else:
        result = {"success": False, "error": f"Unknown tool: {name}"}
    
    return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]


# ==================== 主函数 ====================

async def main():
    """启动 MCP 服务器"""
    print("[ADB MCP] Starting ADB MCP Server...")
    print("[ADB MCP] Make sure your device is connected (run 'adb devices' to check)")
    
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
