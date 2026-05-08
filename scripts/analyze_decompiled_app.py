#!/usr/bin/env python3
"""
反编译 APP 逻辑分析器

从反编译资源中自动提取 APP 的页面结构、显示逻辑、操作/跳转关系。
支持三种代码形态：
  1. H5/小程序 (JS in AMR/ZIP bundles) — 如 12306
  2. 原生 Android (smali + XML layouts)
  3. jadx 反编译 Java 源码

用法:
  python3 scripts/analyze_decompiled_app.py <decompiled_dir> [--output <output.json>]
  python3 scripts/analyze_decompiled_app.py <decompiled_dir> --skip-amr   # 跳过慢的 AMR 解压
  python3 scripts/analyze_decompiled_app.py <decompiled_dir> --quick      # 快速模式（跳过 AMR + 大文件）

搜索:
  python3 scripts/analyze_decompiled_app.py <decompiled_dir> -q "sort"
  python3 scripts/analyze_decompiled_app.py <decompiled_dir> -q "seat" --search-type constant
  python3 scripts/analyze_decompiled_app.py <decompiled_dir> --search-file result.json -q "price"

示例:
  python3 scripts/analyze_decompiled_app.py decompiled/Mobileticket_decompiled
  python3 scripts/analyze_decompiled_app.py decompiled/Calculator_decompiled --quick
"""

import argparse
import json
import os
import re
import sys
import signal
import zipfile
import tarfile
import tempfile
import shutil
from pathlib import Path
from collections import defaultdict
from typing import Any

# ─── 全局配置 ─────────────────────────────────────────────────────────

MAX_JS_SIZE = 1_500_000            # JS 文件超过 1.5MB 跳过（原 512KB）
MAX_JS_REGEX_LEN_FAST = 200_000    # 高频低价值模式（函数名列表）扫描前 200KB
AMR_TIMEOUT = 30                   # 单个 AMR 包处理超时（秒，原 10s）
QUICK_MODE = False

# 页面关联的业务关键词，用于过滤出 key_functions
_BUSINESS_KEYWORDS = frozenset([
    'ticket', 'train', 'seat', 'price', 'sort', 'filter', 'query', 'order',
    'pay', 'passenger', 'station', 'submit', 'check', 'valid', 'format',
    'display', 'show', 'book', 'reserve', 'cancel', 'refund', 'transfer',
])


class TimeoutError(Exception):
    pass

def _timeout_handler(signum, frame):
    raise TimeoutError("操作超时")


# ─── 通用工具 ────────────────────────────────────────────────────────

def count_files(root: str, ext: str) -> int:
    count = 0
    for _ in Path(root).rglob(f"*{ext}"):
        count += 1
        if count > 100:  # 不需要精确计数，够判断类型就行
            return count
    return count

def detect_app_type(root: str) -> str:
    """检测 APP 架构类型"""
    amr_count = count_files(root, ".amr")
    smali_count = count_files(root, ".smali")
    java_count = count_files(root, ".java")
    js_count = count_files(root, ".js")

    if amr_count > 0 or js_count > 5:
        return "h5"
    if java_count > 10:
        return "java"
    if smali_count > 0:
        return "native"
    return "unknown"


# ─── 层1: 静态资源提取（所有 APP 通用） ──────────────────────────────

def extract_manifest(root: str) -> dict:
    """从 AndroidManifest.xml 提取 Activity 列表和 Intent Filter"""
    manifest_path = os.path.join(root, "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        return {}

    with open(manifest_path, "r", errors="ignore") as f:
        content = f.read()

    result = {
        "package": "",
        "activities": [],
        "services": [],
        "receivers": [],
    }

    pkg_match = re.search(r'package="([^"]+)"', content)
    if pkg_match:
        result["package"] = pkg_match.group(1)

    for m in re.finditer(
        r'<activity[^>]*android:name="([^"]+)"[^>]*/?>',
        content, re.DOTALL
    ):
        name = m.group(1)
        block_start = m.start()
        block_end = content.find("</activity>", block_start)
        if block_end == -1:
            block_end = block_start + len(m.group(0))
        block = content[block_start:block_end]

        intent_actions = re.findall(r'android:name="([^"]*action[^"]*)"', block, re.IGNORECASE)
        categories = re.findall(r'android:name="([^"]*category[^"]*)"', block, re.IGNORECASE)
        is_launcher = any("LAUNCHER" in c for c in categories)
        is_main = any("MAIN" in a for a in intent_actions)
        exported = 'android:exported="true"' in block

        result["activities"].append({
            "name": name,
            "is_launcher": is_launcher and is_main,
            "exported": exported,
            "intent_actions": intent_actions,
        })

    return result


def extract_strings(root: str) -> dict[str, str]:
    """从 res/values/strings.xml 提取所有字符串资源"""
    strings = {}
    for values_dir in Path(root).glob("res/values*/strings.xml"):
        try:
            with open(values_dir, "r", errors="ignore") as f:
                content = f.read()
            for m in re.finditer(r'<string name="([^"]+)"[^>]*>([^<]*)</string>', content):
                strings[m.group(1)] = m.group(2)
        except Exception:
            pass
    return strings


def extract_layouts(root: str) -> list[dict]:
    """从 res/layout/ 提取布局文件结构"""
    layouts = []
    layout_dir = Path(root) / "res"
    if not layout_dir.exists():
        return layouts

    for xml_file in sorted(layout_dir.rglob("layout*/*.xml")):
        try:
            with open(xml_file, "r", errors="ignore") as f:
                content = f.read()

            layout_info = {
                "file": str(xml_file.relative_to(root)),
                "ids": [],
                "clickables": [],
                "texts": [],
                "scroll_views": [],
                "includes": [],
            }

            for m in re.finditer(r'android:id="@\+?id/([^"]+)"', content):
                layout_info["ids"].append(m.group(1))
            for m in re.finditer(r'android:onClick="([^"]+)"', content):
                layout_info["clickables"].append(m.group(1))
            for m in re.finditer(r'android:text="([^"]+)"', content):
                layout_info["texts"].append(m.group(1))
            for tag in ["ScrollView", "RecyclerView", "ListView", "ViewPager", "NestedScrollView"]:
                if tag in content:
                    layout_info["scroll_views"].append(tag)
            for m in re.finditer(r'<include[^>]*layout="@layout/([^"]+)"', content):
                layout_info["includes"].append(m.group(1))

            if layout_info["ids"] or layout_info["clickables"]:
                layouts.append(layout_info)
        except Exception:
            pass

    return layouts


def extract_json_configs(root: str) -> list[dict]:
    """提取 assets 目录下的 JSON 配置文件"""
    configs = []
    assets_dir = Path(root) / "assets"
    if not assets_dir.exists():
        return configs

    for json_file in sorted(assets_dir.rglob("*.json")):
        try:
            size = json_file.stat().st_size
            if size > 500_000:
                configs.append({"file": str(json_file.relative_to(root)), "size": size, "preview": "(too large)"})
                continue
            with open(json_file, "r", errors="ignore") as f:
                data = json.load(f)
            configs.append({
                "file": str(json_file.relative_to(root)),
                "size": size,
                "keys": list(data.keys()) if isinstance(data, dict) else f"array[{len(data)}]",
            })
        except Exception:
            configs.append({"file": str(json_file.relative_to(root)), "error": "parse_failed"})

    return configs


def extract_navigation_graphs(root: str) -> list[dict]:
    """提取 Android Navigation Graph (res/navigation/*.xml)"""
    nav_graphs = []
    nav_dir = Path(root) / "res"
    if not nav_dir.exists():
        return nav_graphs

    for xml_file in sorted(nav_dir.rglob("navigation*/*.xml")):
        try:
            with open(xml_file, "r", errors="ignore") as f:
                content = f.read()

            fragments = []
            for m in re.finditer(r'<fragment[^>]*android:name="([^"]+)"[^>]*android:id="@\+?id/([^"]+)"', content, re.DOTALL):
                frag = {"class": m.group(1), "id": m.group(2), "actions": []}
                frag_block_start = m.start()
                frag_block_end = content.find("</fragment>", frag_block_start)
                if frag_block_end == -1:
                    frag_block_end = frag_block_start + 200
                frag_block = content[frag_block_start:frag_block_end]
                for a in re.finditer(r'<action[^>]*android:id="@\+?id/([^"]+)"[^>]*app:destination="@id/([^"]+)"', frag_block):
                    frag["actions"].append({"action_id": a.group(1), "destination": a.group(2)})
                fragments.append(frag)

            if fragments:
                nav_graphs.append({
                    "file": str(xml_file.relative_to(root)),
                    "fragments": fragments,
                })
        except Exception:
            pass

    return nav_graphs


# ─── 层2: H5/小程序 JS 分析 ──────────────────────────────────────────

def extract_amr_bundles(root: str) -> list[dict]:
    """解压 AMR 包，提取内部 JS 文件列表和关键逻辑。每个 AMR 有超时保护。"""
    bundles = []
    assets_dir = Path(root) / "assets"
    if not assets_dir.exists():
        return bundles

    amr_files = sorted(assets_dir.glob("*.amr"))
    print(f"    发现 {len(amr_files)} 个 AMR 包")

    for idx, amr_file in enumerate(amr_files):
        amr_size = amr_file.stat().st_size
        print(f"    [{idx+1}/{len(amr_files)}] {amr_file.name} ({amr_size//1024}KB)...", end=" ", flush=True)
        bundle_info = {"file": amr_file.name, "size": amr_size, "js_files": [], "pages": []}
        tmp_dir = None
        try:
            # 设置超时（仅 Unix）
            old_handler = signal.signal(signal.SIGALRM, _timeout_handler)
            signal.alarm(AMR_TIMEOUT)

            tmp_dir = tempfile.mkdtemp(prefix="amr_")
            with zipfile.ZipFile(amr_file, "r") as zf:
                zf.extractall(tmp_dir)

            # 内部可能有 .tar
            for tar_file in Path(tmp_dir).rglob("*.tar"):
                tar_size = tar_file.stat().st_size
                if tar_size > 20 * 1024 * 1024:  # 跳过 >20MB 的 tar
                    bundle_info["js_files"].append({"file": tar_file.name, "skipped": "tar too large", "size": tar_size})
                    continue
                tar_extract = os.path.join(tmp_dir, "tar_inner")
                os.makedirs(tar_extract, exist_ok=True)
                with tarfile.open(tar_file, "r") as tf:
                    tf.extractall(tar_extract)

            # 收集所有 JS 文件
            js_count = 0
            for js_file in sorted(Path(tmp_dir).rglob("*.js")):
                rel = str(js_file.relative_to(tmp_dir))
                size = js_file.stat().st_size
                js_info = {"file": rel, "size": size}

                if size > MAX_JS_SIZE:
                    js_info["skipped"] = f"too large ({size//1024}KB > {MAX_JS_SIZE//1024}KB)"
                else:
                    try:
                        with open(js_file, "r", errors="ignore") as f:
                            content = f.read()
                        js_info["analysis"] = analyze_js_content(content, js_file.stem)
                    except TimeoutError:
                        js_info["error"] = "timeout"
                    except Exception as e:
                        js_info["error"] = str(e)[:100]

                bundle_info["js_files"].append(js_info)
                js_count += 1

            # 收集 HTML 页面
            for html_file in sorted(Path(tmp_dir).rglob("*.html")):
                rel = str(html_file.relative_to(tmp_dir))
                bundle_info["pages"].append(rel)

            signal.alarm(0)  # 取消超时
            signal.signal(signal.SIGALRM, old_handler)
            print(f"OK ({js_count} JS)")
            bundles.append(bundle_info)

        except TimeoutError:
            signal.alarm(0)
            bundle_info["error"] = f"timeout ({AMR_TIMEOUT}s)"
            print(f"TIMEOUT")
            bundles.append(bundle_info)
        except Exception as e:
            signal.alarm(0)
            bundle_info["error"] = str(e)[:200]
            print(f"ERROR: {str(e)[:80]}")
            bundles.append(bundle_info)
        finally:
            try:
                signal.alarm(0)
            except Exception:
                pass
            if tmp_dir and os.path.exists(tmp_dir):
                shutil.rmtree(tmp_dir, ignore_errors=True)

    return bundles


# ─── JS 提取器辅助函数 ───────────────────────────────────────────────

def _extract_vue_components(content: str) -> list[dict]:
    """提取 Vue 组件定义: methods, computed, watch, filters, props"""
    components = []

    for key in ("methods", "computed", "watch", "filters"):
        for m in re.finditer(rf'{key}\s*:\s*\{{', content):
            block = content[m.end():m.end() + 5000]
            names = re.findall(r'(\w{2,40})\s*:\s*function\s*\(', block)
            if not names and key == "watch":
                names = re.findall(r'["\']?(\w{2,40})["\']?\s*:\s*\{', block)
            if names:
                components.append({"type": key, "names": names[:50]})

    # props（数组或对象形式）
    for m in re.finditer(r'props\s*:\s*([\[{])', content):
        block = content[m.end() - 1:m.end() + 2000]
        if block.startswith('['):
            names = re.findall(r'"(\w+)"', block[:500])
        else:
            names = re.findall(r'(\w{2,30})\s*:', block[:500])
        if names:
            components.append({"type": "props", "names": names[:20]})

    return components


def _extract_event_handlers(content: str) -> list[dict]:
    """提取编译后的 Vue 事件处理器: on:{click:function(...){...}}"""
    handlers = []
    for m in re.finditer(r'on\s*:\s*\{(\w+)\s*:\s*function\s*\([^)]*\)\s*\{', content):
        event = m.group(1)
        start = m.end()
        snippet = content[start:start + 300]
        # 提取调用的方法
        calls = re.findall(r'(?:\w+)\.(\w{2,30})\s*\(', snippet)
        # 去重保序
        seen = set()
        unique_calls = []
        for c in calls:
            if c not in seen:
                seen.add(c)
                unique_calls.append(c)
        # 检查是否有导航
        navs = re.findall(r'(?:pushWindow|navigateTo|startApp|open)\s*\(["\']([^"\']+)', snippet)
        handler = {"event": event, "calls": unique_calls[:5]}
        if navs:
            handler["navigates"] = navs[:3]
        handler["snippet"] = snippet[:150]
        handlers.append(handler)
    return handlers[:80]


def _extract_display_conditions(content: str) -> list[dict]:
    """提取编译后的 v-if / v-show 条件显示逻辑"""
    conditions = []

    # v-if 编译形式: s.xxx ? s._e() : f(...)  — 条件为假时渲染
    for m in re.finditer(r'(\w+)\.(\w{2,40})\s*\?\s*\1\._e\(\)', content):
        conditions.append({
            "type": "v-if",
            "condition": m.group(2),
            "negated": False,
            "snippet": content[m.start():m.start() + 120],
        })

    # v-if 编译形式: s.xxx ? f(...) : s._e()  — 条件为真时渲染
    for m in re.finditer(r'(\w+)\.(\w{2,40})\s*\?[^:]{5,200}:\s*\1\._e\(\)', content):
        conditions.append({
            "type": "v-if",
            "condition": m.group(2),
            "negated": False,
        })

    # 取反形式: !s.xxx ? f(...) : s._e()
    for m in re.finditer(r'!(\w+)\.(\w{2,40})\s*\?', content):
        conditions.append({
            "type": "v-if",
            "condition": m.group(2),
            "negated": True,
        })

    # v-show 编译形式: directives:[{name:"show",... value:s.xxx, expression:"xxx"}]
    for m in re.finditer(r'name:"show"[^}]*expression:"([^"]+)"', content):
        conditions.append({
            "type": "v-show",
            "expression": m.group(1),
        })

    # 去重
    seen = set()
    unique = []
    for c in conditions:
        key = (c.get("type"), c.get("condition", c.get("expression", "")), c.get("negated", False))
        if key not in seen:
            seen.add(key)
            unique.append(c)

    return unique[:80]


def _extract_list_rendering(content: str) -> list[dict]:
    """提取编译后的 v-for: s._l(s.items, function(item, index){...})"""
    loops = []
    for m in re.finditer(r'(\w+)\._l\(\1\.(\w{2,40})\s*,\s*function\s*\((\w+)', content):
        collection = m.group(2)
        item_var = m.group(3)
        snippet = content[m.start():m.start() + 300]
        # 提取循环体中访问的属性
        rendered_props = re.findall(rf'{item_var}\.(\w{{2,30}})', snippet)
        # 去重保序
        seen = set()
        unique_props = []
        for p in rendered_props:
            if p not in seen:
                seen.add(p)
                unique_props.append(p)
        loops.append({
            "collection": collection,
            "item_var": item_var,
            "rendered_props": unique_props[:15],
        })
    return loops[:40]


def _extract_vue_filters(content: str) -> list[str]:
    """提取 Vue filter 调用: s._f("filterName")"""
    filters = set()
    for m in re.finditer(r'\._f\("(\w+)"\)', content):
        filters.add(m.group(1))
    return sorted(filters)


def _extract_sort_logic(content: str) -> list[dict]:
    """语义化解析 .sort() 调用 → {field, direction, type, raw}"""
    sorts = []
    for m in re.finditer(r'\.sort\s*\(\s*function\s*\((\w+)\s*,\s*(\w+)\)\s*\{', content):
        body = content[m.start():m.start() + 500]
        sort_info: dict[str, Any] = {}

        # 检测排序字段: a.field - b.field
        field_match = re.search(r'(\w+)\.(\w{2,30})\s*-\s*\w+\.\2', body)
        if field_match:
            sort_info["field"] = field_match.group(2)
        else:
            # a.field - b.field2 (不同变量名)
            field_match = re.search(r'\w+\.(\w{2,30})\s*-\s*\w+\.(\w{2,30})', body)
            if field_match and field_match.group(1) == field_match.group(2):
                sort_info["field"] = field_match.group(1)

        # localeCompare 字符串排序
        compare_match = re.search(r'(\w+)\.(\w{2,30})\.localeCompare', body)
        if compare_match:
            sort_info["field"] = compare_match.group(2)
            sort_info["type"] = "string"

        # 方向切换: *(e?-1:1) 或 *(n?-1:1)
        if re.search(r'\*\s*\(\w+\s*\?\s*-?\s*1\s*:\s*-?\s*1\)', body):
            sort_info["direction"] = "toggleable"

        # 时间排序: replace(":", "")
        if 'replace(":"' in body or "replace(':'" in body:
            sort_info["type"] = "time"

        # 价格字段
        if "field" not in sort_info:
            price_match = re.search(r'(\w*(?:[Pp]rice|[Cc]ost)\w*)', body)
            if price_match:
                sort_info["field"] = price_match.group(1)

        # 时间字段
        if "field" not in sort_info:
            time_match = re.search(r'(\w*(?:start_time|arrive_time|depart|train_date)\w*)', body)
            if time_match:
                sort_info["field"] = time_match.group(1)

        sort_info["raw"] = body[:200]
        sorts.append(sort_info)

    return sorts[:20]


def _extract_api_calls(content: str) -> list[dict]:
    """增强版 API 调用提取: 含 method 和 data 字段"""
    apis = []
    seen = set()

    # 模式1: api: "name"
    for m in re.finditer(r'api\s*:\s*"([^"]+)"', content):
        api_name = m.group(1)
        if api_name in seen:
            continue
        seen.add(api_name)
        api_info: dict[str, Any] = {"name": api_name}

        # 向前后 500 字符查找 method 和 data
        ctx_start = max(0, m.start() - 100)
        ctx_end = min(len(content), m.end() + 500)
        context = content[ctx_start:ctx_end]
        method_match = re.search(r'method\s*:\s*"([^"]+)"', context)
        if method_match:
            api_info["method"] = method_match.group(1)

        # 提取 data 字段名
        data_match = re.search(r'data\s*:\s*\{([^}]{5,500})\}', context)
        if data_match:
            data_keys = re.findall(r'(\w{2,30})\s*:', data_match.group(1))
            if data_keys:
                api_info["data_fields"] = data_keys[:15]

        apis.append(api_info)

    return apis


def _extract_data_parsers(content: str) -> list[dict]:
    """提取数据字段解析函数 (split/substring/charAt 模式)"""
    parsers = []
    for m in re.finditer(r'(\w{3,40})\s*:\s*function\s*\(\w+\)\s*\{', content):
        name = m.group(1)
        body = content[m.end():m.end() + 300]
        ops = [op for op in ['split', 'substring', 'charAt', 'replace', 'parseInt', 'parseFloat']
               if op in body]
        if not ops:
            continue
        parser: dict[str, Any] = {"name": name, "operations": ops}
        # 提取被解析的字段名
        field_match = re.search(r'\w+\.(\w{2,30})\.(?:split|substring|charAt)', body)
        if field_match:
            parser["field"] = field_match.group(1)
        parser["snippet"] = body[:150]
        parsers.append(parser)

    return parsers[:40]


# ─── JS 主分析函数 ───────────────────────────────────────────────────

def analyze_js_content(content: str, filename: str) -> dict:
    """分析单个 JS 文件，提取关键业务逻辑。"""
    analysis: dict[str, Any] = {"filename": filename, "size": len(content)}

    # 高频低价值模式用截断窗口
    scan_fast = content[:MAX_JS_REGEX_LEN_FAST]

    # 1. 常量映射 (全文 — 有界正则)
    const_maps = {}
    for m in re.finditer(r'(\w+_MAP)\s*=\s*\{([^}]{10,3000})\}', content):
        map_name = m.group(1)
        map_body = m.group(2)
        pairs = re.findall(r'["\']?(\w+)["\']?\s*:\s*["\']([^"\']*)["\']', map_body)
        if pairs:
            const_maps[map_name] = dict(pairs[:50])
    if const_maps:
        analysis["constant_maps"] = const_maps

    # 2. API 调用 (全文 — 增强版)
    apis = _extract_api_calls(content)
    if apis:
        analysis["api_calls"] = apis

    # 3. 路由/页面跳转 (快速窗口)
    routes = set()
    for m in re.finditer(r'(?:navigateTo|redirectTo|pushWindow|startApp)\s*\(\s*["\']([^"\']+)', scan_fast):
        routes.add(m.group(1))
    for m in re.finditer(r'(?:path|url|route)\s*:\s*["\']([^"\']{2,80})', scan_fast):
        val = m.group(1)
        if "/" in val and not val.startswith("http"):
            routes.add(val)
    if routes:
        analysis["routes"] = sorted(routes)[:50]

    # 4. 函数名 (快速窗口)
    functions = set()
    for m in re.finditer(r'(\w{4,40})\s*:\s*function\s*\(', scan_fast):
        functions.add(m.group(1))
    if functions and len(functions) < 300:
        analysis["functions"] = sorted(functions)

    # 5. Vue 组件结构 (全文)
    vue_comps = _extract_vue_components(content)
    if vue_comps:
        analysis["vue_components"] = vue_comps

    # 6. 事件处理器 (全文)
    handlers = _extract_event_handlers(content)
    if handlers:
        analysis["event_handlers"] = handlers

    # 7. 条件显示 v-if/v-show (全文)
    conditions = _extract_display_conditions(content)
    if conditions:
        analysis["display_conditions"] = conditions

    # 8. 列表渲染 v-for (全文)
    loops = _extract_list_rendering(content)
    if loops:
        analysis["list_rendering"] = loops

    # 9. Vue filter 调用 (全文)
    vue_filters = _extract_vue_filters(content)
    if vue_filters:
        analysis["vue_filters"] = vue_filters

    # 10. switch/case 映射 (全文)
    switch_maps = []
    for m in re.finditer(r'switch\s*\([^)]{1,30}\)\s*\{', content):
        block = content[m.end():m.end() + 2000]
        cases = re.findall(r'case\s*["\']([^"\']+)["\']\s*:\s*return\s*["\']([^"\']+)["\']', block)
        if cases:
            switch_maps.append(dict(cases))
    if switch_maps:
        analysis["switch_maps"] = switch_maps[:10]

    # 11. 排序逻辑 (全文 — 语义化)
    sorts = _extract_sort_logic(content)
    if sorts:
        analysis["sort_logic"] = sorts

    # 12. 数据解析器 (全文)
    parsers = _extract_data_parsers(content)
    if parsers:
        analysis["data_parsers"] = parsers

    # 13. 显示函数 (快速窗口)
    display_logic = []
    for m in re.finditer(
        r'(get\w{2,30}Content|show\w{2,30}|display\w{2,30}|format\w{2,30}|is\w{2,30}Train)\s*:\s*function',
        scan_fast
    ):
        func_name = m.group(1)
        start = m.start()
        snippet = scan_fast[start:start + 300]
        display_logic.append({"name": func_name, "body": snippet})
    if display_logic:
        analysis["display_functions"] = display_logic[:30]

    return analysis


# ─── 层3: Java 源码分析 ──────────────────────────────────────────────

def analyze_java_sources(root: str) -> dict:
    """分析 jadx 反编译的 Java 源码"""
    # 搜索多个可能的路径
    candidates = [
        Path(root) / "sources",
        Path(root),
    ]
    java_files = []
    sources_base = Path(root)
    for cand in candidates:
        if cand.exists():
            java_files = list(cand.rglob("*.java"))
            if java_files:
                sources_base = cand
                break

    result = {
        "activities": [],
        "fragments": [],
        "adapters": [],
        "navigation": [],
    }

    if not java_files:
        print(f"    未找到 Java 文件 (搜索路径: {[str(c) for c in candidates]})")
        return result

    print(f"    找到 {len(java_files)} 个 Java 文件")

    for java_file in java_files:
        try:
            size = java_file.stat().st_size
            if size > 500_000:  # 跳过超大 Java 文件
                continue
            with open(java_file, "r", errors="ignore") as f:
                content = f.read()

            rel_path = str(java_file.relative_to(root))

            if re.search(r'extends\s+\w*Activity', content):
                activity_info = analyze_java_class(content, rel_path, "activity")
                if activity_info:
                    result["activities"].append(activity_info)
            elif re.search(r'extends\s+\w*Fragment', content):
                frag_info = analyze_java_class(content, rel_path, "fragment")
                if frag_info:
                    result["fragments"].append(frag_info)
            elif re.search(r'extends\s+\w*Adapter', content):
                adapter_info = analyze_java_class(content, rel_path, "adapter")
                if adapter_info:
                    result["adapters"].append(adapter_info)
        except Exception:
            pass

    return result


def analyze_java_class(content: str, file_path: str, class_type: str):
    """分析单个 Java 类"""
    class_match = re.search(r'(?:public\s+)?class\s+(\w+)', content)
    if not class_match:
        return None

    info: dict[str, Any] = {
        "file": file_path,
        "class": class_match.group(1),
        "type": class_type,
    }

    layouts = re.findall(r'R\.layout\.(\w+)', content)
    if layouts:
        info["layouts"] = list(set(layouts))

    intents = []
    for m in re.finditer(r'Intent\s*\([^,]+,\s*(\w+)\.class\)', content):
        intents.append(m.group(1))
    for m in re.finditer(r'new\s+Intent\s*\(\s*"([^"]+)"', content):
        intents.append(m.group(1))
    if intents:
        info["navigates_to"] = list(set(intents))

    # onClick — 安全正则，不用 [^}]{0,500}
    click_handlers = []
    for m in re.finditer(r'setOnClickListener', content):
        start = m.start()
        snippet = content[start:start+400]
        inner_intents = re.findall(r'Intent\s*\([^,]+,\s*(\w+)\.class\)', snippet)
        inner_methods = re.findall(r'(\w{4,})\s*\(', snippet)
        click_handlers.append({
            "navigates_to": inner_intents,
            "calls": inner_methods[:5],
        })
    if click_handlers:
        info["click_handlers"] = click_handlers[:20]

    set_texts = []
    for m in re.finditer(r'(\w+)\.setText\s*\(([^)]+)\)', content):
        set_texts.append({"view": m.group(1), "value": m.group(2).strip()[:100]})
    if set_texts:
        info["display_bindings"] = set_texts[:30]

    visibility = []
    for m in re.finditer(r'(\w+)\.setVisibility\s*\(([^)]+)\)', content):
        visibility.append({"view": m.group(1), "value": m.group(2).strip()})
    if visibility:
        info["visibility_controls"] = visibility[:20]

    prefs = re.findall(r'getString\s*\(\s*"([^"]+)"', content)
    prefs += re.findall(r'putString\s*\(\s*"([^"]+)"', content)
    if prefs:
        info["preferences"] = list(set(prefs))[:20]

    return info


# ─── 层4: Smali 分析（原生 APP） ─────────────────────────────────────

def analyze_smali_sources(root: str, max_files: int = 500) -> dict:
    """从 smali 中提取关键信息（轻量级）"""
    smali_dir = Path(root) / "smali"
    if not smali_dir.exists():
        return {}

    result = {
        "activities": [],
        "fragments": [],
        "navigation_calls": [],
    }

    count = 0
    for smali_file in smali_dir.rglob("*.smali"):
        if count >= max_files:
            break
        try:
            size = smali_file.stat().st_size
            if size > 200_000:
                continue
            with open(smali_file, "r", errors="ignore") as f:
                content = f.read()

            rel_path = str(smali_file.relative_to(root))

            if ".super Landroid" in content and "Activity;" in content:
                class_match = re.search(r'\.class[^L]*L([^;]+);', content)
                if class_match:
                    class_name = class_match.group(1).replace("/", ".")
                    info: dict[str, Any] = {"class": class_name, "file": rel_path}

                    layouts = re.findall(r'const[^v]*v\d+,\s*(0x[0-9a-f]+).*?# layout:(\w+)', content)
                    if not layouts:
                        layouts = re.findall(r'sget[^,]+,\s*L[^;]+;->(\w+):I\s*#\s*layout', content)
                    if layouts:
                        info["layouts"] = [l[-1] if isinstance(l, tuple) else l for l in layouts]

                    intents = re.findall(r'const-class[^,]+,\s*L([^;]+);', content)
                    intents = [i.replace("/", ".") for i in intents if "Activity" in i or "Fragment" in i]
                    if intents:
                        info["navigates_to"] = list(set(intents))

                    result["activities"].append(info)

            elif ".super Landroid" in content and "Fragment;" in content:
                class_match = re.search(r'\.class[^L]*L([^;]+);', content)
                if class_match:
                    class_name = class_match.group(1).replace("/", ".")
                    result["fragments"].append({"class": class_name, "file": rel_path})

            count += 1
        except Exception:
            pass

    return result


# ─── 页面索引构建 ────────────────────────────────────────────────────

def build_page_index(result: dict) -> list[dict]:
    """从 AMR 包构建页面级索引: HTML 文件名 ↔ JS 文件名映射"""
    pages = []

    for bundle in result.get("amr_bundles", []):
        html_files = bundle.get("pages", [])
        js_map: dict[str, dict] = {}
        for js in bundle.get("js_files", []):
            # 从路径提取 stem: tar_inner/www/js/list-filter.27f0ac8.js → list-filter
            fname = js["file"].split("/")[-1]
            # 移除 .js 后缀，再移除 hash 部分
            stem = fname.replace(".js", "")
            parts = stem.rsplit(".", 1)
            if len(parts) == 2 and len(parts[1]) >= 6:
                stem = parts[0]
            js_map[stem] = js

        # 找 common.js（共享逻辑）
        common_js = js_map.get("common")

        for html in html_files:
            page_name = html.split("/")[-1].replace(".html", "")
            page_js = js_map.get(page_name)

            page_info: dict[str, Any] = {
                "page": page_name,
                "bundle": bundle["file"],
                "html": html,
            }

            if page_js:
                a = page_js.get("analysis", {})
                page_info["js_file"] = page_js["file"]
                page_info["js_size"] = page_js.get("size", 0)

                # 复制所有提取结果
                for key in ("api_calls", "routes", "event_handlers", "display_conditions",
                            "sort_logic", "vue_components", "vue_filters", "list_rendering",
                            "switch_maps", "data_parsers", "display_functions"):
                    val = a.get(key)
                    if val:
                        page_info[key] = val

                # constant_maps: 只保留名称列表
                if a.get("constant_maps"):
                    page_info["constant_maps"] = list(a["constant_maps"].keys())

                # 函数: 保留总数 + 业务关键函数
                funcs = a.get("functions", [])
                page_info["function_count"] = len(funcs)
                key_funcs = [f for f in funcs
                             if any(kw in f.lower() for kw in _BUSINESS_KEYWORDS)]
                if key_funcs:
                    page_info["key_functions"] = key_funcs

            # 附带共享逻辑概要
            if common_js and common_js.get("analysis"):
                ca = common_js["analysis"]
                shared = {}
                if ca.get("constant_maps"):
                    shared["constant_maps"] = list(ca["constant_maps"].keys())
                if ca.get("switch_maps"):
                    shared["switch_maps_count"] = len(ca["switch_maps"])
                if ca.get("sort_logic"):
                    shared["sort_logic_count"] = len(ca["sort_logic"])
                if shared:
                    page_info["shared"] = shared

            pages.append(page_info)

    return pages


# ─── 搜索功能 ────────────────────────────────────────────────────────

def search_analysis(data: dict, keyword: str, search_type: str = "all") -> list[dict]:
    """在分析结果中搜索关键词，返回按页面分组的匹配结果"""
    kw = keyword.lower()
    results = []

    # 搜索 page_index（主搜索目标）
    for page in data.get("page_index", []):
        hits = []

        if search_type in ("all", "page"):
            if kw in page.get("page", "").lower():
                hits.append({"category": "page_name", "match": page["page"]})

        if search_type in ("all", "api"):
            for api in page.get("api_calls", []):
                name = api["name"] if isinstance(api, dict) else api
                if kw in name.lower():
                    hits.append({"category": "api", "match": api})

        if search_type in ("all", "function"):
            for f in page.get("key_functions", []):
                if kw in f.lower():
                    hits.append({"category": "function", "match": f})

        if search_type in ("all", "route"):
            for r in page.get("routes", []):
                if kw in r.lower():
                    hits.append({"category": "route", "match": r})

        if search_type in ("all", "event"):
            for eh in page.get("event_handlers", []):
                searchable = " ".join([eh.get("event", "")] + eh.get("calls", []) + [eh.get("snippet", "")])
                if kw in searchable.lower():
                    hits.append({"category": "event_handler", "match": {
                        "event": eh["event"],
                        "calls": eh.get("calls", []),
                        "snippet": eh.get("snippet", ""),
                    }})

        if search_type in ("all", "condition"):
            for dc in page.get("display_conditions", []):
                searchable = dc.get("condition", "") + dc.get("expression", "") + dc.get("snippet", "")
                if kw in searchable.lower():
                    hits.append({"category": "display_condition", "match": dc})

        if search_type in ("all", "sort"):
            for sl in page.get("sort_logic", []):
                searchable = sl.get("field", "") + " " + sl.get("raw", "")
                if kw in searchable.lower():
                    hits.append({"category": "sort_logic", "match": {
                        k: v for k, v in sl.items() if k != "raw"
                    }})

        if search_type in ("all", "constant"):
            for cm in page.get("constant_maps", []):
                if kw in cm.lower():
                    hits.append({"category": "constant_map", "match": cm})

        if hits:
            results.append({
                "page": page.get("page"),
                "bundle": page.get("bundle"),
                "js_file": page.get("js_file"),
                "hits": hits,
            })

    # 搜索 constant_maps 值（跨所有 AMR 包）
    if search_type in ("all", "constant"):
        for bundle in data.get("amr_bundles", []):
            for js in bundle.get("js_files", []):
                a = js.get("analysis", {})
                for map_name, map_data in a.get("constant_maps", {}).items():
                    matched_entries = []
                    for k, v in map_data.items():
                        if kw in k.lower() or kw in v.lower():
                            matched_entries.append(f"{k}={v}")
                    if matched_entries:
                        results.append({
                            "page": "(constant)",
                            "bundle": bundle["file"],
                            "js_file": js["file"],
                            "hits": [{"category": "constant_value",
                                      "match": f"{map_name}: {', '.join(matched_entries[:10])}"}],
                        })

    # 搜索 switch_maps（跨所有 AMR 包）
    if search_type in ("all", "constant"):
        for bundle in data.get("amr_bundles", []):
            for js in bundle.get("js_files", []):
                a = js.get("analysis", {})
                for sm in a.get("switch_maps", []):
                    matched = []
                    for k, v in sm.items():
                        if kw in k.lower() or kw in v.lower():
                            matched.append(f"{k}→{v}")
                    if matched:
                        results.append({
                            "page": "(switch_map)",
                            "bundle": bundle["file"],
                            "js_file": js["file"],
                            "hits": [{"category": "switch_map",
                                      "match": ", ".join(matched[:10])}],
                        })

    # 搜索 display_functions 的代码片段
    if search_type in ("all", "function"):
        for bundle in data.get("amr_bundles", []):
            for js in bundle.get("js_files", []):
                a = js.get("analysis", {})
                for df in a.get("display_functions", []):
                    if kw in df["name"].lower() or kw in df["body"].lower():
                        results.append({
                            "page": "(display_function)",
                            "bundle": bundle["file"],
                            "js_file": js["file"],
                            "hits": [{"category": "display_function",
                                      "match": {"name": df["name"], "body": df["body"][:200]}}],
                        })

    return results


def print_search_results(results: list[dict], keyword: str):
    """格式化输出搜索结果"""
    if not results:
        print(f"\n搜索 \"{keyword}\" — 未找到匹配")
        return

    print(f"\n搜索 \"{keyword}\" — 找到 {len(results)} 个匹配\n")
    print("=" * 70)

    for r in results:
        page = r.get("page", "?")
        bundle = r.get("bundle", "?")
        js_file = r.get("js_file", "")
        print(f"\n📄 [{bundle}] {page}")
        if js_file:
            print(f"   JS: {js_file}")

        for hit in r["hits"]:
            cat = hit["category"]
            match = hit["match"]
            if isinstance(match, dict):
                match_str = json.dumps(match, ensure_ascii=False)
                if len(match_str) > 120:
                    match_str = match_str[:117] + "..."
            else:
                match_str = str(match)
                if len(match_str) > 120:
                    match_str = match_str[:117] + "..."
            print(f"   [{cat}] {match_str}")

    print(f"\n{'=' * 70}")
    print(f"共 {sum(len(r['hits']) for r in results)} 条命中")


# ─── 主流程 ──────────────────────────────────────────────────────────

def analyze_app(root: str, skip_amr: bool = False) -> dict:
    """分析一个反编译 APP 目录"""
    app_name = os.path.basename(root).replace("_decompiled", "").replace("_java", "")
    app_type = detect_app_type(root)

    print(f"[*] 分析 APP: {app_name}")
    print(f"[*] 架构类型: {app_type}")

    result: dict[str, Any] = {
        "app_name": app_name,
        "app_type": app_type,
        "root": root,
    }

    # 层1: 通用静态资源
    print("[*] 提取 AndroidManifest...")
    result["manifest"] = extract_manifest(root)

    print("[*] 提取字符串资源...")
    strings = extract_strings(root)
    result["strings_count"] = len(strings)
    result["strings_sample"] = {
        k: v for k, v in list(strings.items())[:100]
        if any('\u4e00' <= c <= '\u9fff' for c in v) or len(v) > 5
    }

    print("[*] 提取布局文件...")
    result["layouts"] = extract_layouts(root)
    print(f"    找到 {len(result['layouts'])} 个布局文件")

    print("[*] 提取 JSON 配置...")
    result["json_configs"] = extract_json_configs(root)

    print("[*] 提取导航图...")
    result["navigation_graphs"] = extract_navigation_graphs(root)

    # 层2: H5/小程序
    if app_type == "h5":
        if skip_amr:
            print("[*] 跳过 AMR 包分析 (--skip-amr)")
            result["amr_bundles"] = []
        else:
            print("[*] 解压并分析 AMR 包...")
            result["amr_bundles"] = extract_amr_bundles(root)

        # 分析 assets 下直接的 JS（这些通常是关键业务逻辑）
        print("[*] 分析 assets 下的 JS 文件...")
        js_files = sorted(Path(root).glob("assets/**/*.js"))
        # 排除 AMR 内的（已在上面处理）
        js_files = [f for f in js_files if f.suffix == ".js"]
        direct_js = []
        for js_file in js_files:
            try:
                size = js_file.stat().st_size
                info = {
                    "file": str(js_file.relative_to(root)),
                    "size": size,
                }
                if size > MAX_JS_SIZE:
                    info["skipped"] = f"too large ({size//1024}KB)"
                else:
                    with open(js_file, "r", errors="ignore") as f:
                        content = f.read()
                    info["analysis"] = analyze_js_content(content, js_file.stem)
                direct_js.append(info)
            except Exception:
                pass
        if direct_js:
            result["direct_js"] = direct_js
            print(f"    分析了 {len(direct_js)} 个 JS 文件")

        # 构建页面级索引
        print("[*] 构建页面索引...")
        result["page_index"] = build_page_index(result)
        print(f"    索引了 {len(result['page_index'])} 个页面")

    # 层3: Java 源码
    if app_type == "java":
        print("[*] 分析 Java 源码...")
        result["java_analysis"] = analyze_java_sources(root)

    # 也检查是否有同名的 _java 目录
    java_dir = root.replace("_decompiled", "_java")
    if os.path.isdir(java_dir) and java_dir != root:
        print(f"[*] 发现 jadx 反编译目录: {java_dir}")
        result["java_analysis"] = analyze_java_sources(java_dir)

    # 层4: Smali
    if app_type == "native":
        print("[*] 分析 smali（轻量级）...")
        result["smali_analysis"] = analyze_smali_sources(root)

    result["summary"] = generate_summary(result)
    return result


def generate_summary(result: dict) -> dict:
    """生成人类可读的摘要"""
    summary: dict[str, Any] = {
        "app_name": result["app_name"],
        "app_type": result["app_type"],
    }

    manifest = result.get("manifest", {})
    activities = manifest.get("activities", [])
    summary["total_activities"] = len(activities)
    summary["launcher_activity"] = next(
        (a["name"] for a in activities if a.get("is_launcher")), None
    )
    summary["total_layouts"] = len(result.get("layouts", []))

    nav_graphs = result.get("navigation_graphs", [])
    if nav_graphs:
        total_fragments = sum(len(g.get("fragments", [])) for g in nav_graphs)
        total_actions = sum(
            sum(len(f.get("actions", [])) for f in g.get("fragments", []))
            for g in nav_graphs
        )
        summary["nav_fragments"] = total_fragments
        summary["nav_actions"] = total_actions

    if result["app_type"] == "h5":
        bundles = result.get("amr_bundles", [])
        total_js = sum(len(b.get("js_files", [])) for b in bundles)
        total_pages = sum(len(b.get("pages", [])) for b in bundles)
        summary["amr_bundles"] = len(bundles)
        summary["total_js_files"] = total_js
        summary["total_h5_pages"] = total_pages

        # 新增: 提取统计
        stats = defaultdict(int)
        for bundle in bundles:
            for js in bundle.get("js_files", []):
                if js.get("skipped"):
                    stats["skipped_files"] += 1
                    continue
                a = js.get("analysis", {})
                stats["event_handlers"] += len(a.get("event_handlers", []))
                stats["display_conditions"] += len(a.get("display_conditions", []))
                stats["vue_components"] += len(a.get("vue_components", []))
                stats["sort_rules"] += len(a.get("sort_logic", []))
                stats["api_calls"] += len(a.get("api_calls", []))
                stats["data_parsers"] += len(a.get("data_parsers", []))
                stats["list_renderings"] += len(a.get("list_rendering", []))
                stats["vue_filters"] += len(a.get("vue_filters", []))
        summary["extraction_stats"] = dict(stats)

        # 页面索引统计
        page_index = result.get("page_index", [])
        summary["total_pages_indexed"] = len(page_index)
        summary["pages_with_api_calls"] = len([p for p in page_index if p.get("api_calls")])
        summary["pages_with_events"] = len([p for p in page_index if p.get("event_handlers")])
        summary["pages_with_sort"] = len([p for p in page_index if p.get("sort_logic")])

    java = result.get("java_analysis", {})
    if java:
        summary["java_activities"] = len(java.get("activities", []))
        summary["java_fragments"] = len(java.get("fragments", []))
        summary["java_adapters"] = len(java.get("adapters", []))

    smali = result.get("smali_analysis", {})
    if smali:
        summary["smali_activities"] = len(smali.get("activities", []))
        summary["smali_fragments"] = len(smali.get("fragments", []))

    return summary


# ─── CLI ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="反编译 APP 逻辑分析器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
搜索示例:
  %(prog)s decompiled/Mobileticket_decompiled -q "sort"
  %(prog)s decompiled/Mobileticket_decompiled -q "seat" --search-type constant
  %(prog)s decompiled/Mobileticket_decompiled --search-file result.json -q "price"
        """,
    )
    parser.add_argument("decompiled_dir", help="反编译目录路径")
    parser.add_argument("--output", "-o", help="输出 JSON 文件路径")
    parser.add_argument("--summary", "-s", action="store_true", help="只输出摘要")
    parser.add_argument("--skip-amr", action="store_true", help="跳过 AMR 包解压分析（最慢的部分）")
    parser.add_argument("--quick", action="store_true", help="快速模式（跳过 AMR + 限制分析范围）")
    parser.add_argument("--search", "-q", help="搜索关键词")
    parser.add_argument("--search-type", choices=["api", "function", "page", "route", "constant", "event", "condition", "sort", "all"],
                        default="all", help="限定搜索范围 (默认: all)")
    parser.add_argument("--search-file", help="从已有 JSON 文件搜索（跳过重新分析）")
    args = parser.parse_args()

    # 搜索模式: 从已有文件搜索
    if args.search and args.search_file:
        if not os.path.isfile(args.search_file):
            print(f"错误: 文件不存在: {args.search_file}", file=sys.stderr)
            sys.exit(1)
        with open(args.search_file, "r") as f:
            data = json.load(f)
        search_results = search_analysis(data, args.search, args.search_type)
        print_search_results(search_results, args.search)
        if args.output:
            with open(args.output, "w") as f:
                json.dump(search_results, f, ensure_ascii=False, indent=2)
            print(f"\n[✓] 搜索结果已写入: {args.output}")
        sys.exit(0)

    if not os.path.isdir(args.decompiled_dir):
        print(f"错误: 目录不存在: {args.decompiled_dir}", file=sys.stderr)
        sys.exit(1)

    global QUICK_MODE, MAX_JS_SIZE, MAX_JS_REGEX_LEN_FAST
    if args.quick:
        QUICK_MODE = True
        MAX_JS_SIZE = 256 * 1024
        MAX_JS_REGEX_LEN_FAST = 100_000
        args.skip_amr = True

    result = analyze_app(args.decompiled_dir, skip_amr=args.skip_amr)

    # 如果有搜索参数，执行搜索
    if args.search:
        search_results = search_analysis(result, args.search, args.search_type)
        print_search_results(search_results, args.search)
        # 仍然输出完整结果到文件
        if args.output:
            with open(args.output, "w") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"\n[✓] 完整结果已写入: {args.output}")
        sys.exit(0)

    if args.summary:
        output = result["summary"]
    else:
        output = result

    output_json = json.dumps(output, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output_json)
        print(f"\n[✓] 结果已写入: {args.output}")
    else:
        print("\n" + output_json)


if __name__ == "__main__":
    main()
