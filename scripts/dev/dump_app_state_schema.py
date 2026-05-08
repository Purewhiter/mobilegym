#!/usr/bin/env python3
"""
dump_app_state_schema.py

从运行中的 localhost:3000 获取真实的 __SIM__.getState() 数据结构，
生成 Markdown 文档。

前提：
  - 先运行 `npm run dev` 启动服务
  - 已安装 Python 包 `playwright`，并已执行 `python -m playwright install chromium`（首次）

采样前会 **`await __SIM__.preloadAllAppStores()`**：用与构建时一致的 glob 预加载全部
`apps/*/state.ts`、`system/*/state.ts`，让各 App 的 Zustand 在 storeRegistry 里注册。
仅靠 `warmUpAllApps` 时，lazy  chunk 在 headless 里往往来不及在固定等待时间内加载完，
所以 `getState().apps` 会远少于你在浏览器里手动点开过的 App。

可选 `--warm-ui`：在预加载之后再调用 `warmUpAllApps()`（挂载各 Task，较重）。

用法：
    python scripts/dev/dump_app_state_schema.py
    python scripts/dev/dump_app_state_schema.py --url http://localhost:3000
    python scripts/dev/dump_app_state_schema.py --out docs/os-services/APP_STATE_API.md
    python scripts/dev/dump_app_state_schema.py --settle-ms 2000
    python scripts/dev/dump_app_state_schema.py --warm-ui
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]

from playwright.sync_api import sync_playwright

# preload（及可选 warmUp）之后再等待 persist 等收尾的时间（毫秒）
DEFAULT_SETTLE_MS = 1200

# App 显示名称
APP_DISPLAY_NAMES = {
    "wechat": "微信",
    "bilibili": "哔哩哔哩",
    "x": "X (Twitter)",
    "redbook": "小红书",
    "map": "地图",
    "notes": "备忘录",
    "qqmusic": "QQ音乐",
    "wechat_reading": "微信读书",
    "tencent_meeting": "腾讯会议",
    "weather": "天气",
    "calculator": "计算器",
    "browser": "浏览器",
}


def fetch_state_from_server(url: str, settle_ms: int, warm_ui: bool) -> Dict[str, Any]:
    """从运行中的服务获取 __SIM__.getState()（先 preload 全部 state.ts，可选再 warmUp UI）"""
    print(f"🌐 连接到 {url}...\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=90_000)
            page.wait_for_function(
                "() => window.__SIM__ && typeof window.__SIM__.getState === 'function'",
                timeout=30_000,
            )
            page.wait_for_function(
                "() => typeof window.__SIM__.preloadAllAppStores === 'function'",
                timeout=10_000,
            )

            n_stores = page.evaluate(
                """async () => {
                  await window.__SIM__.preloadAllAppStores();
                  return Object.keys(window.__SIM__.getState().apps || {}).length;
                }"""
            )
            print(f"📦 已 preloadAllAppStores()，当前 getState().apps 含 {n_stores} 个条目")

            if warm_ui:
                n_installed = page.evaluate(
                    """() => {
                      const n = window.__SIM__.getState().os.installedApps.length;
                      window.__SIM__.warmUpAllApps();
                      return n;
                    }"""
                )
                print(f"📲 已 warmUpAllApps()（{n_installed} 个已安装包）")

            print(f"⏳ 再等待 {settle_ms}ms（persist / 渲染收尾）…\n")
            page.wait_for_timeout(settle_ms)

            state = page.evaluate("() => window.__SIM__.getState()")
            print("✅ 成功获取 __SIM__.getState()\n")
            return state
        finally:
            browser.close()


def analyze_structure(obj: Any, prefix: str = "", max_depth: int = 5, current_depth: int = 0) -> List[Dict]:
    """分析对象结构，返回路径列表"""
    paths = []
    
    if current_depth >= max_depth or obj is None:
        return paths
    
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_path = f"{prefix}.{key}" if prefix else key
            
            if isinstance(value, dict):
                paths.append({"path": full_path, "type": "object"})
                paths.extend(analyze_structure(value, full_path, max_depth, current_depth + 1))
            elif isinstance(value, list):
                if len(value) > 0 and isinstance(value[0], dict):
                    paths.append({"path": full_path, "type": "array<object>", "count": len(value)})
                    paths.extend(analyze_structure(value[0], f"{full_path}[]", max_depth, current_depth + 1))
                elif len(value) > 0:
                    item_type = type(value[0]).__name__
                    paths.append({"path": full_path, "type": f"array<{item_type}>", "count": len(value)})
                else:
                    paths.append({"path": full_path, "type": "array", "count": 0})
            else:
                value_type = type(value).__name__
                example = ""
                if isinstance(value, str) and len(value) > 0:
                    # 将换行符替换为空格，然后截断
                    clean_value = value.replace('\n', ' ').replace('\r', '').strip()
                    # 移除连续空格
                    while '  ' in clean_value:
                        clean_value = clean_value.replace('  ', ' ')
                    # 转义 Markdown 表格特殊字符
                    clean_value = clean_value.replace('|', '\\|')
                    if len(clean_value) < 50:
                        example = clean_value
                    else:
                        example = clean_value[:47] + "..."
                elif isinstance(value, (int, float, bool)):
                    example = str(value)
                paths.append({"path": full_path, "type": value_type, "example": example})
    
    return paths


def generate_markdown(state: Dict[str, Any]) -> str:
    """生成 Markdown 文档"""
    lines = []
    today = datetime.now().strftime("%Y-%m-%d")
    
    lines.append("# App State API 文档")
    lines.append("")
    lines.append(
        f"> 由 `scripts/dev/dump_app_state_schema.py` 自动生成于 {today}，"
        "从运行中的服务直接获取 `__SIM__.getState()`"
    )
    lines.append("")
    lines.append("本文档描述 `__SIM__.getState()` 返回的**真实**数据结构。")
    lines.append("")
    
    # OS 状态
    lines.append("## OS 状态")
    lines.append("")
    lines.append("```javascript")
    lines.append("const os = __SIM__.getState().os;")
    lines.append("```")
    lines.append("")
    
    if state.get("os"):
        os_paths = analyze_structure(state["os"], "", 3)
        lines.append("| 路径 | 类型 | 示例 |")
        lines.append("|------|------|------|")
        for item in os_paths:
            example = f"`{item['example']}`" if item.get("example") else (f"({item['count']} 项)" if "count" in item else "")
            item_type = item['type'].replace('<', '&lt;').replace('>', '&gt;')
            lines.append(f"| `os.{item['path']}` | {item_type} | {example} |")
        lines.append("")
    
    # Apps 概览
    lines.append("## Apps 概览")
    lines.append("")
    lines.append("```javascript")
    lines.append("const apps = __SIM__.getState().apps;")
    lines.append("```")
    lines.append("")
    
    apps = state.get("apps", {})
    app_ids = list(apps.keys())
    
    lines.append("| App ID | 名称 | 顶层字段 |")
    lines.append("|--------|------|----------|")
    
    for app_id in app_ids:
        display_name = APP_DISPLAY_NAMES.get(app_id, app_id)
        app_state = apps.get(app_id, {})
        top_fields = ", ".join(app_state.keys()) if app_state else "-"
        lines.append(f"| `{app_id}` | {display_name} | `{top_fields}` |")
    lines.append("")
    
    # 每个 App 的详细字段
    lines.append("## 各 App 状态字段详情")
    lines.append("")
    
    for app_id in app_ids:
        display_name = APP_DISPLAY_NAMES.get(app_id, app_id)
        app_state = apps.get(app_id, {})
        
        lines.append(f"### {display_name} (`{app_id}`)")
        lines.append("")
        lines.append("**访问方式**:")
        lines.append("```javascript")
        lines.append(f"const state = __SIM__.getState().apps.{app_id};")
        lines.append("```")
        lines.append("")
        
        if not app_state:
            lines.append("> 该 App 当前无状态数据")
            lines.append("")
            continue
        
        paths = analyze_structure(app_state, "", 5)
        
        if paths:
            lines.append("**字段结构**:")
            lines.append("")
            lines.append("| 路径 | 类型 | 示例/数量 |")
            lines.append("|------|------|----------|")
            
            for item in paths:
                extra = ""
                if item.get("example"):
                    extra = f"`{item['example']}`"
                elif "count" in item:
                    extra = f"({item['count']} 项)"
                # 转义类型中的 < > 防止被当作 HTML 标签
                item_type = item['type'].replace('<', '&lt;').replace('>', '&gt;')
                lines.append(f"| `{item['path']}` | {item_type} | {extra} |")
            lines.append("")
    
    # 使用示例
    lines.append("## 使用示例")
    lines.append("")
    lines.append("### JavaScript: 获取状态")
    lines.append("```javascript")
    lines.append("// 获取完整状态")
    lines.append("const state = __SIM__.getState();")
    lines.append("")
    lines.append("// 获取 OS 状态")
    lines.append("console.log(state.os.activeAppId);       // 当前 App")
    lines.append("console.log(state.os.runningApps);       // 运行中的 App")
    lines.append("")
    lines.append("// 获取微信用户")
    lines.append("console.log(state.apps.wechat.user.name);")
    lines.append("console.log(state.apps.wechat.user.settings.privacy);")
    lines.append("```")
    lines.append("")
    lines.append("### Python (eval_state.py / judger.py)")
    lines.append("```python")
    lines.append("def check_task(input):")
    lines.append('    # input 来自 _build_judge_input()')
    lines.append('    route = input["route"]')
    lines.append('    apps = input["apps"]')
    lines.append('    os_state = input["os"]')
    lines.append("    ")
    lines.append("    # 检查路由")
    lines.append('    if route.get("path") != "/settings":')
    lines.append("        return False")
    lines.append("    ")
    lines.append("    # 检查微信用户设置")
    lines.append('    wechat = apps.get("wechat", {})')
    lines.append('    privacy = wechat.get("user", {}).get("settings", {}).get("privacy", {})')
    lines.append('    return privacy.get("momentsRange") == "最近三天"')
    lines.append("```")
    lines.append("")
    
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="从运行中的服务获取 App State API 文档")
    parser.add_argument("--url", default="http://localhost:3000", help="服务地址")
    parser.add_argument(
        "--out",
        default=str(REPO_ROOT / "docs" / "os-services" / "APP_STATE_API.md"),
        help="输出文件路径",
    )
    parser.add_argument(
        "--settle-ms",
        type=int,
        default=DEFAULT_SETTLE_MS,
        help=f"preload（及可选 warmUp）之后等待稳定的毫秒数（默认 {DEFAULT_SETTLE_MS}）",
    )
    parser.add_argument(
        "--warm-ui",
        action="store_true",
        help="预加载 store 后再调用 warmUpAllApps()（创建全部 Task，较慢）",
    )
    args = parser.parse_args()
    
    print("🔍 从运行中的服务获取 __SIM__.getState()...\n")
    
    try:
        state = fetch_state_from_server(args.url, args.settle_ms, args.warm_ui)
        
        # 生成 Markdown
        markdown = generate_markdown(state)
        
        # 写入文件
        output_path = Path(args.out).resolve()
        output_path.write_text(markdown, encoding="utf-8")
        
        print(f"✅ 已生成: {output_path}\n")
        
        # 显示摘要
        apps = state.get("apps", {})
        print("📊 摘要:")
        print(f"   - OS 状态: {len(state.get('os', {}))} 个字段")
        print(f"   - Apps: {len(apps)} 个")
        for app_id, app_state in apps.items():
            field_count = len(app_state) if app_state else 0
            print(f"     - {app_id}: {field_count} 个顶层字段")
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        print("\n请确保:")
        print("  1. 已运行 `npm run dev` 启动服务")
        print(f"  2. 服务运行在 {args.url}")
        sys.exit(1)


if __name__ == "__main__":
    main()
