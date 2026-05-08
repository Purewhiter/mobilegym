#!/usr/bin/env python3
"""
MCP Server for Mobile Gym - WebSocket 桥接版本

启动方法:
    python bench_env/mcp_server.py

然后在 Cursor 的 MCP 设置中添加这个服务器。
"""

import asyncio
import json
import os
import sys
import uuid
import urllib.request
from typing import Any, Optional
import websockets
try:
    from websockets.asyncio.server import ServerConnection as WebSocketServerProtocol  # websockets >= 14
except ImportError:
    from websockets.server import WebSocketServerProtocol  # websockets < 14

try:
    from bench_env.layout_utils import normalize_sim_elements
except ImportError:
    from pathlib import Path as _Path
    sys.path.insert(0, str(_Path(__file__).parent.parent))
    from bench_env.layout_utils import normalize_sim_elements

# MCP SDK
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent, ImageContent
except ImportError:
    print("请先安装 mcp 包: pip install mcp", file=sys.stderr)
    raise

# 全局状态
ws_client: Optional[WebSocketServerProtocol] = None
_ws_upgrade_task: Optional[asyncio.Task] = None  # 防止升级任务被 GC
pending_requests: dict[str, asyncio.Future] = {}
server = Server("mobile-gym")
IS_PRIMARY = True  # True = 主实例(直连浏览器), False = 副实例(HTTP 转发)

# ── CDP 截图 (Chrome DevTools Protocol) ─────────────────────────────
CDP_PORT = int(os.environ.get("CDP_PORT", "9222"))
CDP_HOST = os.environ.get("CDP_HOST", "127.0.0.1")

async def cdp_screenshot() -> str:
    """通过 CDP 连接浏览器，截取 localhost:3000 页面，返回 base64 PNG。
    假设浏览器已通过开发者工具设置好分辨率，直接截图不修改设备指标。"""
    # 1. 获取 tab 列表
    url = f"http://{CDP_HOST}:{CDP_PORT}/json"
    loop = asyncio.get_event_loop()
    resp_text = await loop.run_in_executor(
        None, lambda: urllib.request.urlopen(url, timeout=3).read().decode()
    )
    tabs = json.loads(resp_text)

    # 2. 查找 localhost:3000 tab
    ws_url = None
    for tab in tabs:
        if "localhost:3000" in tab.get("url", ""):
            ws_url = tab.get("webSocketDebuggerUrl")
            break
    if not ws_url:
        raise RuntimeError("未找到 localhost:3000 页面。请在 Chrome 中打开该页面。")

    # 3. 直接截图，不修改设备指标（避免触发页面刷新/状态丢失）
    async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
        await ws.send(json.dumps({
            "id": 1, "method": "Page.captureScreenshot",
            "params": {"format": "png"}
        }))
        resp = json.loads(await ws.recv())
        base64_data = resp.get("result", {}).get("data", "")

    return base64_data

# ==================== WebSocket 服务器 ====================

async def ws_handler(websocket: WebSocketServerProtocol):
    """处理 WebSocket 连接"""
    global ws_client
    ws_client = websocket
    print(f"[WS] Client connected from {websocket.remote_address}", file=sys.stderr)
    
    try:
        async for message in websocket:
            try:
                response = json.loads(message)
                req_id = response.get("id")
                if req_id and req_id in pending_requests:
                    pending_requests[req_id].set_result(response)
            except json.JSONDecodeError:
                print(f"[WS] Invalid JSON: {message[:100]}", file=sys.stderr)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        ws_client = None
        print("[WS] Client disconnected", file=sys.stderr)


async def _try_upgrade_to_primary() -> bool:
    """副实例尝试升级为主实例（当原主实例已退出时）"""
    global IS_PRIMARY, _ws_upgrade_task

    async def _run_ws_forever():
        async with websockets.serve(ws_handler, "localhost", 8765):
            await asyncio.Future()  # 保持运行直到任务被取消

    try:
        task = asyncio.create_task(_run_ws_forever())
        await asyncio.sleep(0.1)  # 等待端口绑定
        if task.done():  # 绑定失败（如端口被占）
            return False
        _ws_upgrade_task = task  # 保持引用，防止 GC 取消任务
        http_server = await asyncio.start_server(handle_http_request, "localhost", HTTP_API_PORT)
        IS_PRIMARY = True
        print("[MCP] ★ 升级为主实例模式: WebSocket ws://localhost:8765 + HTTP :8766", file=sys.stderr)
        return True
    except Exception:
        return False


async def send_command_via_http(action: str, params: dict = None, timeout: float = 3.0) -> dict:
    """副实例模式：通过主实例的 HTTP API 转发命令。转发失败时自动尝试升级为主实例。"""
    url = f"http://localhost:{HTTP_API_PORT}/call"
    payload = json.dumps({"action": action, "params": params or {}}).encode()

    loop = asyncio.get_event_loop()
    def do_request():
        req = urllib.request.Request(
            url, data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout + 2) as resp:
            return json.loads(resp.read().decode())

    try:
        return await asyncio.wait_for(
            loop.run_in_executor(None, do_request),
            timeout=timeout + 3,
        )
    except Exception as e:
        # 转发失败 → 主实例可能已退出，尝试升级自己为主实例
        upgraded = await _try_upgrade_to_primary()
        if upgraded:
            # 升级成功，用主实例路径重新执行命令
            return await send_command(action, params, timeout)
        return {"success": False, "error": f"HTTP 转发失败且无法升级为主实例: {e}"}


async def send_command(action: str, params: dict = None, timeout: float = 3.0) -> dict:
    """发送命令到前端并等待响应

    Args:
        action: 要执行的动作
        params: 动作参数
        timeout: 超时时间（秒），默认 3 秒
    """
    global ws_client, pending_requests

    # 副实例模式：通过 HTTP 转发给主实例
    if not IS_PRIMARY:
        return await send_command_via_http(action, params, timeout)

    if ws_client is None:
        return {"success": False, "error": "No client connected. Please open localhost:3000 in browser."}

    req_id = str(uuid.uuid4())
    command = {
        "id": req_id,
        "action": action,
        "params": params or {}
    }

    future: asyncio.Future = asyncio.get_event_loop().create_future()
    pending_requests[req_id] = future

    try:
        await ws_client.send(json.dumps(command))
        response = await asyncio.wait_for(future, timeout=timeout)
        return response
    except asyncio.TimeoutError:
        return {"success": False, "error": f"Command timed out after {timeout}s"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        pending_requests.pop(req_id, None)


# ==================== MCP 工具定义 ====================

@server.list_tools()
async def list_tools() -> list[Tool]:
    """列出所有可用的工具"""
    return [
        Tool(
            name="mobile_screenshot",
            description="截取手机模拟器屏幕截图（通过 CDP 直接调用浏览器原生截图，360x800 视口，3x 缩放）。需要 Chrome 以 --remote-debugging-port=9222 启动。",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="mobile_tap",
            description="点击屏幕指定位置。坐标是 CSS 像素（视口为 360x800）",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X 坐标 (0-360)"},
                    "y": {"type": "number", "description": "Y 坐标 (0-800)"},
                },
                "required": ["x", "y"]
            }
        ),
        Tool(
            name="mobile_double_tap",
            description="双击屏幕指定位置",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X 坐标 (0-360)"},
                    "y": {"type": "number", "description": "Y 坐标 (0-800)"},
                },
                "required": ["x", "y"]
            }
        ),
        Tool(
            name="mobile_long_press",
            description="长按屏幕指定位置",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X 坐标 (0-360)"},
                    "y": {"type": "number", "description": "Y 坐标 (0-800)"},
                    "duration": {"type": "number", "description": "长按时长(ms)，默认 800", "default": 800},
                },
                "required": ["x", "y"]
            }
        ),
        Tool(
            name="mobile_swipe",
            description="在屏幕上滑动。坐标是 CSS 像素（视口为 360x800）",
            inputSchema={
                "type": "object",
                "properties": {
                    "x1": {"type": "number", "description": "起点 X"},
                    "y1": {"type": "number", "description": "起点 Y"},
                    "x2": {"type": "number", "description": "终点 X"},
                    "y2": {"type": "number", "description": "终点 Y"},
                    "duration": {"type": "number", "description": "滑动时长(ms)，默认 400", "default": 400},
                },
                "required": ["x1", "y1", "x2", "y2"]
            }
        ),
        Tool(
            name="mobile_type",
            description="输入文本",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "要输入的文本"},
                    "clear": {"type": "boolean", "description": "是否先清空原有内容，默认 false", "default": False},
                },
                "required": ["text"]
            }
        ),
        Tool(
            name="mobile_back",
            description="返回上一页",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="mobile_home",
            description="返回主屏幕",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="mobile_open_app",
            description="打开指定应用。支持的应用: 设置, 相册, 文件, 计算器, 备忘录, 微信, 天气, 哔哩哔哩, 腾讯会议, 支付宝, 地图, 小红书, Spotify, X",
            inputSchema={
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "应用名称（中文或英文）"},
                },
                "required": ["app_name"]
            }
        ),
        Tool(
            name="mobile_get_route",
            description="获取当前页面路由信息",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="mobile_ping",
            description="测试与前端的连接",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="mobile_tap_element",
            description="通过文本内容或 CSS 选择器点击元素。优先使用 text 参数按文本查找",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "要点击的元素包含的文本"},
                    "selector": {"type": "string", "description": "CSS 选择器（如 #id, .class, button）"},
                },
            }
        ),
        Tool(
            name="mobile_double_tap_element",
            description="通过文本内容或 CSS 选择器双击元素",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "要双击的元素包含的文本"},
                    "selector": {"type": "string", "description": "CSS 选择器（如 #id, .class, button）"},
                },
            }
        ),
        Tool(
            name="mobile_long_press_element",
            description="通过文本内容或 CSS 选择器长按元素",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "要长按的元素包含的文本"},
                    "selector": {"type": "string", "description": "CSS 选择器（如 #id, .class, button）"},
                    "duration": {"type": "number", "description": "长按时长(ms)，默认 800", "default": 800},
                },
            }
        ),
        Tool(
            name="mobile_get_elements",
            description="获取页面上的可见元素列表，用于了解页面结构。可选传入 CSS 选择器过滤",
            inputSchema={
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS 选择器，默认 * 获取所有元素"},
                },
            }
        ),
        Tool(
            name="mobile_get_layout_html",
            description="获取当前页面布局 HTML。可选 visible_only=true 仅导出当前视口可见内容（与安卓单屏 dump 对齐）",
            inputSchema={
                "type": "object",
                "properties": {
                    "visible_only": {
                        "type": "boolean",
                        "description": "是否仅导出当前视口可见内容",
                        "default": False,
                    },
                },
            }
        ),
        Tool(
            name="mobile_get_layout_elements",
            description="获取模拟器的 UI 元素列表（归一化到 360x800 视口坐标，过滤 SVG/容器噪声），用于与真机对比。返回扁平化的元素列表，每个元素包含 tag、id、text、bounds(x,y,width,height)。",
            inputSchema={
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS 选择器，默认 * 获取所有元素"},
                },
            }
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent | ImageContent]:
    """执行工具调用"""

    # ── 截图（CDP 原生） ──
    if name == "mobile_screenshot":
        try:
            base64_data = await cdp_screenshot()
            return [ImageContent(type="image", data=base64_data, mimeType="image/png")]
        except Exception as e:
            return [TextContent(type="text", text=json.dumps({
                "success": False,
                "error": f"CDP 截图失败: {e}. 请确保 Chrome 以 --remote-debugging-port=9222 启动。"
            }, ensure_ascii=False))]

    if name == "mobile_tap":
        result = await send_command("tap", {"x": arguments["x"], "y": arguments["y"]})
    
    elif name == "mobile_double_tap":
        result = await send_command("double_tap", {"x": arguments["x"], "y": arguments["y"]})
    
    elif name == "mobile_long_press":
        result = await send_command("long_press", {
            "x": arguments["x"],
            "y": arguments["y"],
            "duration": arguments.get("duration", 800),
        })
    
    elif name == "mobile_swipe":
        result = await send_command("swipe", {
            "x1": arguments["x1"],
            "y1": arguments["y1"],
            "x2": arguments["x2"],
            "y2": arguments["y2"],
            "duration": arguments.get("duration", 400),
        })
    
    elif name == "mobile_type":
        result = await send_command("type", {
            "text": arguments["text"],
            "clear": arguments.get("clear", False),
        })
    
    elif name == "mobile_back":
        result = await send_command("back", {})
    
    elif name == "mobile_home":
        result = await send_command("home", {})
    
    elif name == "mobile_open_app":
        result = await send_command("open_app", {"app_name": arguments["app_name"]})
    
    elif name == "mobile_get_route":
        result = await send_command("get_route", {})
    
    elif name == "mobile_ping":
        result = await send_command("ping", {})
    
    
    elif name == "mobile_tap_element":
        result = await send_command("tap_element", {
            "text": arguments.get("text"),
            "selector": arguments.get("selector"),
        })
    
    elif name == "mobile_double_tap_element":
        result = await send_command("double_tap_element", {
            "text": arguments.get("text"),
            "selector": arguments.get("selector"),
        })
    
    elif name == "mobile_long_press_element":
        result = await send_command("long_press_element", {
            "text": arguments.get("text"),
            "selector": arguments.get("selector"),
            "duration": arguments.get("duration", 800),
        })
    
    elif name == "mobile_get_elements":
        result = await send_command("get_elements", {
            "selector": arguments.get("selector", "*"),
        })
    
    elif name == "mobile_get_layout_html":
        result = await send_command("get_layout_html", {
            "visible_only": arguments.get("visible_only", False),
        }, timeout=30.0)

    elif name == "mobile_get_layout_elements":
        selector = arguments.get("selector", "*")
        raw_result = await send_command("get_elements", {"selector": selector})
        if not raw_result.get("success"):
            result = raw_result
        else:
            raw_elements = raw_result.get("data", {}).get("elements", [])
            elements = normalize_sim_elements(raw_elements)
            result = {
                "success": True,
                "data": {
                    "viewport": {"width": 360, "height": 800},
                    "source": "simulator",
                    "element_count": len(elements),
                    "elements": elements,
                }
            }
    
    else:
        result = {"success": False, "error": f"Unknown tool: {name}"}
    
    return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]


# ==================== HTTP API（供外部脚本调用） ====================

HTTP_API_PORT = 8766

async def handle_http_request(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """
    简易 HTTP API，让外部脚本直接调用 MCP 工具。
    
    用法:
        curl http://localhost:8766/get_elements?selector=button,span
        curl http://localhost:8766/get_layout_html?visible_only=true
        curl -X POST http://localhost:8766/call -d '{"action":"get_elements","params":{"selector":"*"}}'
    """
    try:
        request_line = await asyncio.wait_for(reader.readline(), timeout=5)
        request_str = request_line.decode().strip()

        # 读 headers，提取 Content-Length
        content_length = 0
        while True:
            line = await reader.readline()
            if line == b'\r\n' or line == b'\n' or not line:
                break
            header = line.decode().strip().lower()
            if header.startswith("content-length:"):
                content_length = int(header.split(":")[1].strip())

        # 读 body
        body = b""
        if content_length > 0:
            body = await asyncio.wait_for(reader.readexactly(content_length), timeout=5)

        # 解析请求
        parts = request_str.split()
        if len(parts) < 2:
            _http_respond(writer, 400, {"error": "Bad request"})
            return

        method, raw_path = parts[0], parts[1]
        # 手动解码 URL 编码
        from urllib.parse import unquote, urlparse, parse_qs
        parsed = urlparse(raw_path)
        path = parsed.path
        query = {k: v[0] for k, v in parse_qs(parsed.query).items()}

        # 路由
        if path == "/get_elements":
            selector = unquote(query.get("selector", "*"))
            result = await send_command("get_elements", {"selector": selector})
            _http_respond(writer, 200, result)
        elif path == "/get_layout_html":
            visible = query.get("visible_only", "false").lower() in ("true", "1")
            result = await send_command("get_layout_html", {"visible_only": visible}, timeout=30.0)
            _http_respond(writer, 200, result)
        elif path == "/get_layout_elements":
            selector = unquote(query.get("selector", "*"))
            raw_result = await send_command("get_elements", {"selector": selector})
            if raw_result.get("success"):
                raw_elements = raw_result.get("data", {}).get("elements", [])
                elements = normalize_sim_elements(raw_elements)
                _http_respond(writer, 200, {
                    "success": True,
                    "data": {
                        "viewport": {"width": 360, "height": 800},
                        "source": "simulator",
                        "element_count": len(elements),
                        "elements": elements,
                    }
                })
            else:
                _http_respond(writer, 200, raw_result)
        elif path == "/call" and method == "POST":
            try:
                payload = json.loads(body)
            except Exception as parse_err:
                _http_respond(writer, 400, {"error": f"Invalid JSON: {parse_err}"})
                return
            action = payload.get("action", "")
            params = payload.get("params", {})
            result = await send_command(action, params)
            _http_respond(writer, 200, result)
        elif path in ("/ping", "/health"):
            _http_respond(writer, 200, {"ok": True, "connected": ws_client is not None})
        else:
            _http_respond(writer, 404, {"error": f"Unknown endpoint: {path}"})
    except Exception as e:
        try:
            _http_respond(writer, 500, {"error": str(e)})
        except Exception:
            pass
    finally:
        writer.close()


def _http_respond(writer: asyncio.StreamWriter, status: int, body: dict):
    body_bytes = json.dumps(body, ensure_ascii=False).encode()
    status_text = {200: "OK", 400: "Bad Request", 404: "Not Found", 500: "Error"}.get(status, "")
    header = (
        f"HTTP/1.1 {status} {status_text}\r\n"
        f"Content-Type: application/json; charset=utf-8\r\n"
        f"Content-Length: {len(body_bytes)}\r\n"
        f"Access-Control-Allow-Origin: *\r\n"
        f"\r\n"
    )
    writer.write(header.encode() + body_bytes)


# ==================== 主函数 ====================

async def main():
    """启动 MCP 服务器。自动检测端口：
    - 端口可用 → 主实例模式（WebSocket + HTTP API + MCP stdio）
    - 端口被占 → 副实例模式（仅 MCP stdio，命令通过 HTTP 转发给主实例）
    """
    global IS_PRIMARY

    try:
        # websockets 15.x 必须用 async with，await serve() 不再绑定端口
        async with websockets.serve(ws_handler, "localhost", 8765):
            IS_PRIMARY = True
            print("[MCP] ★ 主实例模式: WebSocket server on ws://localhost:8765", file=sys.stderr)

            # 启动 HTTP API 服务器
            http_server = await asyncio.start_server(handle_http_request, "localhost", HTTP_API_PORT)
            print(f"[MCP]   HTTP API on http://localhost:{HTTP_API_PORT}", file=sys.stderr)

            # MCP stdio 服务器（在 WebSocket context 内运行，保持 WS 存活）
            print("[MCP] Waiting for MCP client...", file=sys.stderr)
            async with stdio_server() as (read_stream, write_stream):
                await server.run(read_stream, write_stream, server.create_initialization_options())
    except OSError:
        IS_PRIMARY = False
        print(f"[MCP] ★ 副实例模式: 端口 8765 已被占用，命令将通过 HTTP localhost:{HTTP_API_PORT} 转发", file=sys.stderr)

        # MCP stdio 服务器始终启动
        print("[MCP] Waiting for MCP client...", file=sys.stderr)
        async with stdio_server() as (read_stream, write_stream):
            await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
