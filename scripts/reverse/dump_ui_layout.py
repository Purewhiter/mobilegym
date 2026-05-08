#!/usr/bin/env python3
"""
Android UI Layout Dumper
从连接的 Android 手机导出当前屏幕的 UI 布局信息，支持 AI 复刻 app 界面。

=== 推荐用法: 交互式多屏采集 ===

  python scripts/reverse/dump_ui_layout.py --session my_app --apk-res decompiled/App/res

  交互流程: 在手机上导航到目标页面 → 按 Enter 采集 → 重复 → 按 q 结束
  输出: session_my_app/ 目录，包含每个屏幕的树形 JSON + 截图 + 滚动分段

=== 传统用法: 单次 dump ===

  python scripts/reverse/dump_ui_layout.py
  python scripts/reverse/dump_ui_layout.py --scroll --apk-res decompiled/App/res

主要参数:
  --session NAME  交互式多屏采集模式（推荐）
  --apk-res PATH  反编译 APK 的 res 目录，提取样式属性
  --scroll        [旧] 滚动并多次 dump
  --no-simplify   不简化 UI 树（保留所有中间包装层）
  --serial SN     指定设备序列号

依赖:
- adb (Android Debug Bridge)
- Python 3.x
- Pillow (可选，仅旧滚动拼接模式需要)

输出 (--session 模式):
- manifest.json:       会话元数据（屏幕列表、设备信息）
- screen_XX/
  - elements_tree.json: 树形 UI 层级 + 样式（AI 复刻核心数据）
  - screenshot.png:     屏幕截图
  - scroll_segments/:   滚动分段截图 + UI 树（如有可滚动区域）
  - layout_preview.html: 可视化 HTML 预览
"""

from __future__ import annotations

import subprocess
import os
import sys
import re
import struct
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
import argparse
import time
import html
import json
import shutil

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# 输出目录
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "ui_dumps"


def run_adb(command: list[str], timeout: int = 30, serial: str | None = None) -> tuple[bool, str]:
    """运行 adb 命令"""
    adb_cmd = ["adb"]
    if serial:
        adb_cmd += ["-s", serial]
    try:
        result = subprocess.run(
            adb_cmd + command,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.returncode == 0, result.stdout + result.stderr
    except FileNotFoundError:
        return False, "错误: 未找到 adb 命令，请确保已安装 Android SDK Platform Tools"
    except subprocess.TimeoutExpired:
        return False, "错误: adb 命令超时"


def check_device(serial: str | None = None) -> tuple[bool, str | None]:
    """检查是否有设备连接，返回 (ok, serial)"""
    success, output = run_adb(["devices", "-l"])
    if not success:
        print(output)
        return False, None
    
    lines = output.strip().split("\n")
    devices = [l.strip() for l in lines[1:] if l.strip()]
    
    if serial:
        for line in devices:
            cols = line.split()
            if cols and cols[0] == serial and len(cols) > 1 and cols[1] == "device":
                print(f"✓ 使用指定设备: {serial}")
                return True, serial
        print(f"错误: 未找到可用设备或设备不可用: {serial}")
        print("请确保设备已授权且处于 device 状态")
        return False, None

    usable = []
    for line in devices:
        cols = line.split()
        if len(cols) >= 2 and cols[1] == "device":
            usable.append(cols[0])

    if not usable:
        print("错误: 未检测到已连接且可用的设备")
        print("请确保:")
        print("  1. 手机已通过 USB 连接")
        print("  2. 已开启开发者选项和 USB 调试")
        print("  3. 已在手机上授权此电脑")
        print("  4. adb devices 显示为 device 状态")
        return False, None
    
    chosen = usable[0]
    print(f"✓ 检测到设备: {chosen}")
    return True, chosen


def get_screen_size(serial: str | None = None) -> tuple[int, int]:
    """获取屏幕尺寸"""
    success, output = run_adb(["shell", "wm", "size"], serial=serial)
    if success:
        # Physical size: 1080x2400
        for line in output.split("\n"):
            if "size" in line.lower():
                parts = line.split(":")[-1].strip().split("x")
                if len(parts) == 2:
                    return int(parts[0]), int(parts[1])
    return 1080, 2400  # 默认值


def dump_ui_xml(output_path: Path, serial: str | None = None) -> bool:
    """导出 UI 结构 XML"""
    print("正在导出 UI 结构...")
    
    # 在手机上生成 dump
    success, output = run_adb(["shell", "uiautomator", "dump", "/sdcard/ui_dump.xml"], serial=serial)
    if not success or "error" in output.lower():
        print(f"错误: 无法导出 UI 结构 - {output}")
        return False
    
    # 拉取到本地
    success, output = run_adb(["pull", "/sdcard/ui_dump.xml", str(output_path)], serial=serial)
    if not success:
        print(f"错误: 无法拉取文件 - {output}")
        return False
    
    # 清理手机上的临时文件
    run_adb(["shell", "rm", "/sdcard/ui_dump.xml"], serial=serial)
    
    print(f"✓ UI 结构已保存到: {output_path}")
    return True


def take_screenshot(output_path: Path, serial: str | None = None) -> bool:
    """截取当前屏幕"""
    print("正在截图...")
    
    # 在手机上截图
    success, output = run_adb(["shell", "screencap", "-p", "/sdcard/screenshot.png"], serial=serial)
    if not success:
        print(f"警告: 截图失败 - {output}")
        return False
    
    # 拉取到本地
    success, output = run_adb(["pull", "/sdcard/screenshot.png", str(output_path)], serial=serial)
    if not success:
        print(f"警告: 无法拉取截图 - {output}")
        return False
    
    # 清理
    run_adb(["shell", "rm", "/sdcard/screenshot.png"], serial=serial)
    
    print(f"✓ 截图已保存到: {output_path}")
    return True


def scroll_down(screen_size: tuple[int, int], serial: str | None = None) -> bool:
    """向下滚动屏幕（约 25% 屏幕高度，确保相邻截图有充分重叠）"""
    width, height = screen_size
    x = width // 2
    y1 = int(height * 0.62)
    y2 = int(height * 0.37)
    success, _ = run_adb(["shell", "input", "swipe", str(x), str(y1), str(x), str(y2), "400"], serial=serial)
    return success


def scroll_up(screen_size: tuple[int, int], serial: str | None = None) -> bool:
    """向上滚动屏幕"""
    width, height = screen_size
    x = width // 2
    y1 = int(height * 0.3)
    y2 = int(height * 0.8)
    success, _ = run_adb(["shell", "input", "swipe", str(x), str(y1), str(x), str(y2), "300"], serial=serial)
    return success


def parse_bounds(bounds_str: str) -> dict | None:
    """解析 bounds 字符串 '[left,top][right,bottom]'"""
    try:
        parts = bounds_str.replace("][", ",").replace("[", "").replace("]", "").split(",")
        left, top, right, bottom = map(int, parts)
        return {
            "left": left,
            "top": top,
            "right": right,
            "bottom": bottom,
            "width": right - left,
            "height": bottom - top,
            "center_x": (left + right) // 2,
            "center_y": (top + bottom) // 2
        }
    except:
        return None


def parse_ui_xml(xml_path: Path) -> list[dict]:
    """解析 UI XML 文件，提取元素信息"""
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception as e:
        print(f"错误: 无法解析 XML - {e}")
        return []
    
    elements = []
    
    def extract_element(node, depth=0):
        """递归提取元素信息"""
        attrib = node.attrib
        child_count = len(node)
        
        element = {
            "depth": depth,
            "class": attrib.get("class", ""),
            "resource_id": attrib.get("resource-id", ""),
            "text": attrib.get("text", ""),
            "content_desc": attrib.get("content-desc", ""),
            "clickable": attrib.get("clickable", "false") == "true",
            "scrollable": attrib.get("scrollable", "false") == "true",
            "bounds": None,
            "bounds_raw": attrib.get("bounds", ""),
            "is_leaf": child_count == 0,
        }
        
        if element["bounds_raw"]:
            element["bounds"] = parse_bounds(element["bounds_raw"])
        
        elements.append(element)
        
        for child in node:
            extract_element(child, depth + 1)
    
    extract_element(root)
    return elements


def parse_ui_xml_tree(xml_path: Path) -> dict | None:
    """
    解析 UI XML 文件，输出嵌套树形结构（dict）。
    每个节点包含 children 列表，保留完整的父子层级关系。
    """
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception as e:
        print(f"错误: 无法解析 XML - {e}")
        return None

    def build_node(xml_node: ET.Element) -> dict:
        attrib = xml_node.attrib
        cls = attrib.get("class", "")
        rid = attrib.get("resource-id", "")
        bounds_raw = attrib.get("bounds", "")
        bounds = parse_bounds(bounds_raw) if bounds_raw else None

        node: dict = {
            "tag": cls.split(".")[-1] if cls else "",
            "tag_full": cls,
            "id": rid.split("/")[-1] if rid else "",
            "id_full": rid,
            "text": attrib.get("text", ""),
            "content_desc": attrib.get("content-desc", ""),
            "clickable": attrib.get("clickable", "false") == "true",
            "scrollable": attrib.get("scrollable", "false") == "true",
            "bounds": bounds,
        }

        children = []
        for child in xml_node:
            children.append(build_node(child))

        if children:
            node["children"] = children

        return node

    return build_node(root)


def enrich_tree_with_apk(node: dict, layout_views: dict, drawable_shapes: dict,
                         dimens: dict, colors: dict, density: float,
                         sibling_text_sizes: set | None = None):
    """
    将 APK 资源中的样式属性合并到 UI 树节点上（就地修改）。
    递归处理整棵树。同一 id 多 layout 时优先选与兄弟 text_size_dp 一致的候选，否则取最小字号。
    """
    rid = node.get("id", "")
    if rid and rid in layout_views:
        raw = layout_views[rid]
        props = _pick_best_props(raw, sibling_text_sizes) if isinstance(raw, list) else raw
        # 文本样式
        if "text_size" in props:
            ts = props["text_size"]
            ts_unit = props.get("text_size_unit", "dp")
            if ts_unit in ("dp", "sp"):
                node["text_size_dp"] = ts
                node["text_size_px"] = round(ts * density)
            else:
                node["text_size_px"] = round(ts)
                node["text_size_dp"] = round(ts / density, 1) if density else ts
        if props.get("text_color"):
            node["text_color"] = props["text_color"]
        if props.get("font_family"):
            node["font_family"] = props["font_family"]
        if props.get("text_font_weight"):
            node["font_weight"] = props["text_font_weight"]
        if props.get("gravity"):
            node["gravity"] = props["gravity"]
        if props.get("letter_spacing") is not None:
            node["letter_spacing"] = props["letter_spacing"]
        if props.get("max_lines") is not None:
            node["max_lines"] = props["max_lines"]
        if props.get("ellipsize"):
            node["ellipsize"] = props["ellipsize"]
        # Padding
        for side in ("left", "right", "top", "bottom"):
            key = f"padding_{side}"
            val = props.get(key)
            if val is not None and val != 0:
                unit = props.get(f"{key}_unit", "dp")
                node.setdefault("padding", {})[side] = val
                node["padding"][f"{side}_unit"] = unit
        # Margin
        for side in ("left", "right", "top", "bottom"):
            key = f"margin_{side}"
            val = props.get(key)
            if val is not None and val != 0:
                unit = props.get(f"{key}_unit", "dp")
                node.setdefault("margin", {})[side] = val
                node["margin"][f"{side}_unit"] = unit
        # Layout 尺寸
        if props.get("layout_width") is not None:
            node["layout_width"] = props["layout_width"]
        if props.get("layout_height") is not None:
            node["layout_height"] = props["layout_height"]
        # 背景
        bg = props.get("background", "")
        if bg.startswith("@drawable/"):
            shape = drawable_shapes.get(bg[10:])
            if shape:
                node["bg_shape"] = shape
        elif bg.startswith("@color/"):
            resolved = colors.get(bg[7:], bg)
            node["bg_color"] = resolved
        elif bg.startswith("#"):
            node["bg_color"] = bg
        # 视觉属性
        if props.get("alpha") is not None and props["alpha"] != 1.0:
            node["alpha"] = props["alpha"]
        if props.get("visibility") and props["visibility"] != "visible":
            node["visibility"] = props["visibility"]
        # 图标 / 图像：ImageView 的 src，TextView 的 compound drawable
        if props.get("src"):
            node["src"] = props["src"]
        for pos in ("start", "end", "left", "right", "top", "bottom"):
            key = f"drawable_{pos}"
            if props.get(key):
                node[key] = props[key]

    # 递归处理子节点（传入已处理兄弟的 text_size_dp，便于多候选时选一致字号）
    children = node.get("children", [])
    for i, child in enumerate(children):
        sib = {c.get("text_size_dp") for c in children[:i] if c.get("text_size_dp") is not None}
        enrich_tree_with_apk(child, layout_views, drawable_shapes,
                             dimens, colors, density, sibling_text_sizes=sib)


def simplify_tree(node: dict) -> dict:
    """
    简化 UI 树：折叠无意义的中间包装层。
    规则：如果一个节点 没有 id、没有 text、没有 content_desc、不可交互，
    且只有一个子节点 → 用子节点替换它（保留子节点的全部信息）。
    """
    # 先递归简化子节点
    if "children" in node:
        node["children"] = [simplify_tree(c) for c in node["children"]]

    # 检查是否可折叠
    children = node.get("children", [])
    if (len(children) == 1
            and not node.get("id")
            and not node.get("text")
            and not node.get("content_desc")
            and not node.get("clickable")
            and not node.get("scrollable")
            and not node.get("text_size_dp")
            and not node.get("bg_shape")
            and not node.get("bg_color")):
        # 用子节点替换自身
        return children[0]

    return node



def extract_actionable_elements(node: dict) -> list[dict]:
    """
    Scanning the UI tree to extract a flat list of actionable elements.
    Returns a list of dicts:
    [
      {"id": "...", "type": "Button", "desc": "...", "bounds": "...", "actions": ["click", "scroll_up"]}
    ]
    """
    results = []

    def _get_desc(n):
        return n.get("content_desc") or n.get("text") or ""

    def _scan(n):
        actions = []
        
        # 1. Base Interactions
        if n.get("clickable"):
            actions.append("click")
        if n.get("long_clickable"):
            actions.append("long_click")
        if n.get("checkable"):
            actions.append("check")
        if n.get("editable") or n.get("tag_full", "").endswith("EditText"):
            actions.append("input")
            
        # 2. Scroll Interactions
        if n.get("scrollable"):
            # Infer direction based on aspect ratio
            w = n.get("width", 0)
            h = n.get("height", 0)
            if w > 0 and h > 0:
                aspect = w / h
                if aspect > 1.2: # Likely horizontal (e.g., TabBar, Gallery)
                    actions.extend(["scroll_left", "scroll_right"])
                elif aspect < 0.8: # Likely vertical (e.g., List)
                    actions.extend(["scroll_up", "scroll_down"])
                else: # Square-ish (e.g., Map, Grid), maybe both?
                    actions.extend(["scroll_up", "scroll_down", "scroll_left", "scroll_right"])
            else:
                # Default if no size info
                actions.extend(["scroll_forward", "scroll_backward"])
        
        # 3. Add to results if actionable
        if actions:
            item = {
                "id": n.get("id_full") or n.get("id"),
                "type": n.get("tag"), # e.g. TextView
                "desc": _get_desc(n),
                "text": n.get("text"),
                "bounds": n.get("bounds"), # coordinates
                "actions": actions
            }
            # Optional: Add verified status or standard icon name if we detected it
            if n.get("src_resolved"):
                item["icon"] = n.get("src_resolved")
                
            results.append(item)

        # 4. Recurse
        for child in n.get("children", []):
            _scan(child)

    _scan(node)
    return results


def get_focused_activity(serial: str | None = None) -> str | None:
    """获取当前前台 Activity 的 component name"""
    success, output = run_adb(["shell", "dumpsys", "activity", "activities"], timeout=10, serial=serial)
    if not success:
        return None
    # 查找 "mResumedActivity" 或 "topResumedActivity"
    for line in output.split('\n'):
        if 'ResumedActivity' in line or 'mFocusedActivity' in line:
            # 格式: "mResumedActivity: ActivityRecord{hash u0 com.pkg/com.pkg.Activity t123}"
            m = re.search(r'(\S+/\S+)\s+t\d+', line)
            if m:
                return m.group(1)
    return None


def dump_view_properties(serial: str | None = None, output_dir: Path | None = None) -> list[dict]:
    """
    通过 dumpsys 获取详细 View 属性（mTextSize, padding 等）。
    先检测前台 Activity，再针对性 dump 避免超时。
    返回 view 列表，每个 view 包含 resource_id, text, 和解析到的属性。
    """
    print("正在获取 View 详细属性 (dumpsys)...")

    # 1. 尝试只 dump 前台 Activity（更快、不易超时）
    focused = get_focused_activity(serial=serial)
    output = ""
    if focused:
        pkg = focused.split("/")[0]
        print(f"  前台 Activity: {focused}")
        success, output = run_adb(
            ["shell", "dumpsys", "activity", "top", pkg],
            timeout=30, serial=serial
        )
        if not success or 'DUMP TIMEOUT' in output:
            print("  警告: 针对性 dump 失败或超时，尝试备选方案...")
            output = ""

    # 2. 备选: 直接 dump top（可能超时但试一下）
    if not output or 'View Hierarchy' not in output:
        success, output = run_adb(
            ["shell", "dumpsys", "activity", "top"],
            timeout=30, serial=serial
        )
        if not success:
            print("  警告: 无法获取 dumpsys 数据")
            return []

    # 保存原始输出用于调试
    if output_dir:
        raw_path = output_dir / "dumpsys_raw.txt"
        with open(raw_path, "w", encoding="utf-8") as f:
            f.write(output)

    if 'View Hierarchy' not in output:
        if 'DUMP TIMEOUT' in output or 'Timeout' in output:
            print("  警告: dumpsys 超时，无法获取 View 属性（复杂应用的已知限制）")
        else:
            print("  警告: dumpsys 输出中未找到 View Hierarchy")
        return []

    views = []
    current_view = None

    # View 行格式: "  android.widget.TextView{hash V.ED.... ... 0,0-688,129 #7f0a0123 app:id/name}"
    view_re = re.compile(r'(\S+)\{[^}]*\b(\d+),(\d+)-(\d+),(\d+)\b')
    res_id_re = re.compile(r'\w[\w.]*:id/(\S+)')
    # 属性行: "      mText=Hello", "      mTextSize=48.0"
    prop_re = re.compile(r'^\s+(m\w+)=(.*)')

    PROPS_OF_INTEREST = {
        'mTextSize', 'mTextColor', 'mText',
        'mPaddingLeft', 'mPaddingRight', 'mPaddingTop', 'mPaddingBottom',
        'mMinWidth', 'mMinHeight', 'mTypeface',
    }

    in_hierarchy = False
    for line in output.split('\n'):
        stripped = line.strip()

        if 'View Hierarchy:' in line:
            in_hierarchy = True
            continue
        if not in_hierarchy:
            continue
        # 结束标志
        if stripped.startswith('Looper') or stripped.startswith('mCurrentFocus'):
            if current_view and current_view.get("props"):
                views.append(current_view)
            in_hierarchy = False
            current_view = None
            continue

        # 属性行
        prop_m = prop_re.match(line)
        if prop_m and current_view is not None:
            key = prop_m.group(1)
            val = prop_m.group(2).strip()
            if key in PROPS_OF_INTEREST:
                current_view["props"][key] = val
            continue

        # View 行
        view_m = view_re.search(stripped)
        if view_m:
            # 保存上一个
            if current_view and current_view.get("props"):
                views.append(current_view)

            cls = view_m.group(1)
            rid_m = res_id_re.search(stripped)
            res_id_short = rid_m.group(1) if rid_m else ""

            current_view = {
                "class": cls,
                "res_id_short": res_id_short,
                "props": {},
            }

    # 最后一个
    if current_view and current_view.get("props"):
        views.append(current_view)

    print(f"  解析到 {len(views)} 个有属性的 View")
    return views


def enrich_elements(elements: list[dict], dumpsys_views: list[dict]):
    """用 dumpsys 获取的属性丰富 uiautomator 元素数据，通过 resource-id 和 text 匹配"""

    # 构建查找索引: resource-id -> [view], text -> [view]
    by_rid = {}
    by_text = {}
    for v in dumpsys_views:
        rid = v["res_id_short"]
        if rid:
            by_rid.setdefault(rid, []).append(v)
        txt = v["props"].get("mText", "")
        if txt:
            by_text.setdefault(txt, []).append(v)

    matched = 0
    for e in elements:
        props = {}
        # 优先按 resource-id 匹配
        e_rid = e["resource_id"].split("/")[-1] if e["resource_id"] else ""
        if e_rid and e_rid in by_rid:
            candidates = by_rid[e_rid]
            # 如果有多个同 id 的，尝试通过 text 进一步确认
            if len(candidates) == 1:
                props = candidates[0]["props"]
            else:
                for c in candidates:
                    if c["props"].get("mText", "") == e["text"]:
                        props = c["props"]
                        break
                if not props:
                    props = candidates[0]["props"]
        # 其次按 text 匹配（仅对有文本且未匹配到的元素）
        elif e["text"] and e["text"] in by_text:
            candidates = by_text[e["text"]]
            props = candidates[0]["props"]

        if props:
            matched += 1

        # 字号 (px)
        text_size_raw = props.get("mTextSize", "")
        try:
            e["text_size_px"] = float(text_size_raw)
        except (ValueError, TypeError):
            e["text_size_px"] = None
        # Padding
        for side in ("Left", "Right", "Top", "Bottom"):
            key = f"mPadding{side}"
            try:
                e[f"padding_{side.lower()}"] = int(props.get(key, "0"))
            except (ValueError, TypeError):
                e[f"padding_{side.lower()}"] = 0
        # 计算内容区域（去掉 padding）
        if e["bounds"]:
            b = e["bounds"]
            pl, pr = e["padding_left"], e["padding_right"]
            pt, pb = e["padding_top"], e["padding_bottom"]
            e["content_bounds"] = {
                "left": b["left"] + pl,
                "top": b["top"] + pt,
                "right": b["right"] - pr,
                "bottom": b["bottom"] - pb,
                "width": max(0, b["width"] - pl - pr),
                "height": max(0, b["height"] - pt - pb),
            }
        else:
            e["content_bounds"] = None
    print(f"  匹配到 {matched}/{len(elements)} 个元素的详细属性")


def parse_apk_dimens(res_dir: Path) -> dict[str, str]:
    """
    解析反编译 APK 的 res/values/dimens.xml，返回 name -> value 字典。
    支持 dp/dip/sp/px 单位。
    """
    dimens = {}
    dimens_path = res_dir / "values" / "dimens.xml"
    if not dimens_path.exists():
        return dimens
    try:
        tree = ET.parse(dimens_path)
        for elem in tree.getroot().iter("dimen"):
            name = elem.get("name", "")
            val = (elem.text or "").strip()
            if name and val:
                dimens[name] = val
    except Exception as e:
        print(f"  警告: 无法解析 dimens.xml - {e}")
    return dimens


def parse_apk_colors(res_dir: Path) -> dict[str, str]:
    """解析反编译 APK 的 res/values/colors.xml"""
    colors = {}
    colors_path = res_dir / "values" / "colors.xml"
    if not colors_path.exists():
        return colors
    try:
        tree = ET.parse(colors_path)
        for elem in tree.getroot().iter("color"):
            name = elem.get("name", "")
            val = (elem.text or "").strip()
            if name and val:
                colors[name] = val
    except Exception as e:
        print(f"  警告: 无法解析 colors.xml - {e}")
    return colors


def parse_apk_strings(res_dir: Path) -> dict[str, str]:
    """解析反编译 APK 的 res/values/strings.xml，返回 name -> value"""
    strings = {}
    strings_path = res_dir / "values" / "strings.xml"
    if not strings_path.exists():
        return strings
    try:
        tree = ET.parse(strings_path)
        for elem in tree.getroot().iter("string"):
            name = elem.get("name", "")
            val = (elem.text or "").strip()
            if name and val:
                strings[name] = val
    except Exception as e:
        print(f"  警告: 无法解析 strings.xml - {e}")
    return strings


def parse_apk_styles(res_dir: Path, dimens: dict, colors: dict) -> dict[str, dict]:
    """
    解析反编译 APK 的 res/values/styles.xml，返回 style_name -> {属性字典}。
    属性字典 key 与 parse_apk_layouts 输出的 props key 保持一致。
    支持 parent 继承链（最多 5 层，防止循环）。
    """
    styles_raw: dict[str, dict] = {}  # name -> {"parent": str, "items": {android_attr: val}}
    styles_path = res_dir / "values" / "styles.xml"
    if not styles_path.exists():
        return {}
    try:
        tree = ET.parse(styles_path)
        for style_elem in tree.getroot().iter("style"):
            name = style_elem.get("name", "")
            if not name:
                continue
            parent = style_elem.get("parent", "")
            items = {}
            for item in style_elem.iter("item"):
                item_name = item.get("name", "")
                item_val = (item.text or "").strip()
                if item_name and item_val:
                    items[item_name] = item_val
            styles_raw[name] = {"parent": parent, "items": items}
    except Exception as e:
        print(f"  警告: 无法解析 styles.xml - {e}")
        return {}

    # 将 android 属性名映射到我们的 props key
    ATTR_MAP = {
        "android:textSize": "text_size_raw",
        "android:textColor": "text_color_raw",
        "android:fontFamily": "font_family",
        "android:textFontWeight": "text_font_weight",
        "android:lineSpacingMultiplier": "line_spacing_multiplier",
        "android:letterSpacing": "letter_spacing",
        "android:maxLines": "max_lines",
        "android:ellipsize": "ellipsize",
        "android:gravity": "gravity",
        "android:alpha": "alpha",
        "android:background": "background",
        "android:textAlignment": "text_alignment",
        "android:textDirection": "text_direction",
        "android:visibility": "visibility",
    }

    def resolve_style(name: str, depth: int = 0) -> dict:
        """递归解析 style 继承链"""
        if depth > 5 or name not in styles_raw:
            return {}
        raw = styles_raw[name]
        # 先继承 parent
        result = {}
        if raw["parent"]:
            parent_name = raw["parent"]
            if parent_name.startswith("@style/"):
                parent_name = parent_name[7:]
            result = resolve_style(parent_name, depth + 1)
        # 用自身属性覆盖
        for item_name, item_val in raw["items"].items():
            mapped_key = ATTR_MAP.get(item_name)
            if mapped_key:
                result[mapped_key] = item_val
        return result

    styles_resolved = {}
    for name in styles_raw:
        resolved = resolve_style(name)
        if resolved:
            # 后处理: 解析 dimen 和 color 引用
            props = {}
            for key, val in resolved.items():
                if key == "text_size_raw":
                    from_dimen = resolve_dimen_value(val, dimens)
                    num, unit = parse_dimen_to_number(from_dimen)
                    if num is not None:
                        props["text_size"] = num
                        props["text_size_unit"] = unit
                        props["text_size_raw"] = from_dimen
                elif key == "text_color_raw":
                    props["text_color"] = resolve_color_value(val, colors)
                else:
                    props[key] = val
            if props:
                styles_resolved[name] = props

    return styles_resolved


# 密度目录优先级：高密度优先，便于复刻时拿到清晰图
_DRAWABLE_DIR_ORDER = (
    "drawable-xxxhdpi", "drawable-xxhdpi", "drawable-xhdpi", "drawable-hdpi",
    "drawable-nodpi", "drawable",
)
_RASTER_EXTS = (".png", ".webp", ".jpg", ".jpeg")


def resolve_drawable(res_dir: Path, ref: str) -> Path | None:
    """
    根据反编译 res 目录解析 @drawable/name 为实际文件路径。
    优先栅格图（.png/.webp/.jpg），其次 .xml（vector 等）。
    ref: 如 "@drawable/icon_sunny"
    返回: 第一个找到的文件路径，未找到返回 None。
    """
    if not ref or not isinstance(ref, str) or not ref.startswith("@drawable/"):
        return None
    name = ref[10:].strip()
    if not name:
        return None
    for dir_name in _DRAWABLE_DIR_ORDER:
        drawable_dir = res_dir / dir_name
        if not drawable_dir.exists():
            continue
        for ext in _RASTER_EXTS:
            p = drawable_dir / (name + ext)
            if p.is_file():
                return p
        p = drawable_dir / (name + ".xml")
        if p.is_file():
            return p
    return None


def _android_vector_to_svg(xml_path: Path) -> str | None:
    """
    将 Android <vector> drawable XML 转为 SVG 字符串。
    仅处理简单 vector+path，未处理 group/animated-vector 等。
    """
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception:
        return None
    tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    if tag != "vector":
        return None
    ns = {"a": "http://schemas.android.com/apk/res/android"}
    w = root.get("width") or root.get("{http://schemas.android.com/apk/res/android}width") or "24dp"
    h = root.get("height") or root.get("{http://schemas.android.com/apk/res/android}height") or "24dp"
    vw = root.get("viewportWidth") or root.get("{http://schemas.android.com/apk/res/android}viewportWidth") or "24"
    vh = root.get("viewportHeight") or root.get("{http://schemas.android.com/apk/res/android}viewportHeight") or "24"
    vw = vw.replace("dp", "").strip()
    vh = vh.replace("dp", "").strip()
    w_clean = w.replace("dp", "").strip()
    h_clean = h.replace("dp", "").strip()
    paths = []
    for path_el in root.findall(".//*"):
        ptag = path_el.tag.split("}")[-1] if "}" in path_el.tag else path_el.tag
        if ptag != "path":
            continue
        path_data = path_el.get("pathData") or path_el.get("{http://schemas.android.com/apk/res/android}pathData")
        if not path_data:
            continue
        fill = path_el.get("fillColor") or path_el.get("{http://schemas.android.com/apk/res/android}fillColor") or "#000000"
        fill_alpha = path_el.get("fillAlpha") or path_el.get("{http://schemas.android.com/apk/res/android}fillAlpha") or "1"
        fill_type = path_el.get("fillType") or path_el.get("{http://schemas.android.com/apk/res/android}fillType") or ""
        fill_rule = ' fill-rule="evenodd"' if "evenOdd" in fill_type else ""
        paths.append(f'<path d="{path_data}" fill="{fill}" fill-opacity="{fill_alpha}"{fill_rule}/>')
    if not paths:
        return None
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}" width="{w_clean}" height="{h_clean}">'
        + "".join(paths) + "</svg>"
    )


def _placeholder_svg(name: str) -> str:
    """非 vector 的 XML drawable（如 SymbolDrawable）用简单占位 SVG，title 标明资源名便于替换。"""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">'
        f'<title>@drawable/{name}</title>'
        f'<rect width="24" height="24" fill="none" stroke="#888" stroke-width="1"/>'
        f'<text x="12" y="16" text-anchor="middle" font-size="12" fill="#888">?</text>'
        "</svg>"
    )


def _write_drawables_readme(assets_dir: Path) -> None:
    """在 assets/drawables 下写入说明，便于做 App 时知道对应关系与替换方式。"""
    readme = assets_dir / "README.md"
    if readme.exists():
        return
    readme.write_text(
        "# 图标资源说明\n\n"
        "本目录来自反编译 APK 的 @drawable/xxx 解析，用于 web_mock 展示。\n\n"
        "## 做真实 App 时如何对应图标？\n\n"
        "- **elements_tree.json** 里搜 `src` / `drawable_start` 等，值为 `@drawable/资源名`。\n"
        "- **web_mock.html** 里鼠标悬停图标，会显示对应的 `@drawable/xxx`。\n"
        "- 反编译工程的 `res/layout/*.xml` 里搜该资源名或节点 id，可确认语义（如加号、更多）。\n\n"
        "## 能否直接替换？\n\n"
        "可以。用**同名**的 SVG（或 PNG/WebP）覆盖本目录下对应文件，刷新 mock 即可。\n"
        "做真实 App 时在工程的 res/drawable/ 下提供同名或同语义的 drawable 即可。\n",
        encoding="utf-8",
    )


try:
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    HAS_FONTTOOLS = True
except ImportError:
    HAS_FONTTOOLS = False


def _extract_symbol_to_svg(font_path: Path, char_code: int) -> str | None:
    """从字体文件中提取指定字符生成 SVG"""
    if not HAS_FONTTOOLS:
        print("Warning: fontTools not installed, cannot extract symbol.")
        return None
    try:
        font = TTFont(font_path)
        cmap = font.getBestCmap()
        glyph_name = cmap.get(char_code)
        if not glyph_name:
            return None
        glyph_set = font.getGlyphSet()
        glyph = glyph_set[glyph_name]
        pen = SVGPathPen(glyph_set)
        glyph.draw(pen)
        path_data = pen.getCommands()
        # Metrics
        ascender = font['hhea'].ascender
        descender = font['hhea'].descender
        width = glyph.width
        # Flip Y axis (font coords are bottom-up)
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {ascender - descender}" width="24" height="24">'
            f'<g transform="scale(1,-1) translate(0,{-ascender})">'
            f'<path d="{path_data}" fill="#000000"/>'
            f'</g></svg>'
        )
    except Exception:
        return None


def _resolve_and_copy_drawables_in_tree(node: dict, apk_res_dir: Path, assets_dir: Path) -> None:
    """
    递归遍历树：将节点上的 src / drawable_* 解析为位图并复制到 assets_dir，
    写入 src_resolved / drawable_*_resolved（相对路径，如 assets/drawables/xxx.webp）。
    """
    refs: list[tuple[str, str]] = []  # (key, ref)
    if node.get("src"):
        refs.append(("src_resolved", node["src"]))
    for pos in ("start", "end", "left", "right", "top", "bottom"):
        key = f"drawable_{pos}"
        if node.get(key):
            refs.append((f"{key}_resolved", node[key]))
    rel_prefix = "assets/drawables/"
    
    # 尝试定位字体文件 (MIUI specific)
    # apk_res_dir is .../res. Font is usually at .../assets/fonts/misymbol_vf.ttf
    font_path = apk_res_dir.parent / "assets/fonts/misymbol_vf.ttf"
    
    for key_resolved, ref in refs:
        path = resolve_drawable(apk_res_dir, ref)
        if path is None:
            continue
        name = ref[10:].strip()  # @drawable/xxx -> xxx
        try:
            if path.suffix.lower() in (".png", ".webp", ".jpg", ".jpeg"):
                dest_name = name + path.suffix
                dest = assets_dir / dest_name
                shutil.copy2(path, dest)
                node[key_resolved] = rel_prefix + dest_name
            elif path.suffix.lower() == ".xml":
                svg_content = None
                
                # 1. Try Vector
                svg_content = _android_vector_to_svg(path)
                
                # 2. Try SymbolDrawable (if Vector failed)
                if svg_content is None and HAS_FONTTOOLS and font_path.exists():
                    try:
                        tree = ET.parse(path)
                        root = tree.getroot()
                        # Look for SymbolDrawable class or app:symbolText
                        # namespace usually xmlns:app="http://schemas.android.com/apk/res-auto"
                        # We just scan attributes for symbolText
                        symbol_text = None
                        for k, v in root.attrib.items():
                            if "symbolText" in k and v:
                                symbol_text = v
                                break
                        if symbol_text:
                            char_code = ord(symbol_text[0])
                            svg_content = _extract_symbol_to_svg(font_path, char_code)
                    except Exception:
                        pass

                # 3. Fallback to placeholder
                if svg_content is None:
                    svg_content = _placeholder_svg(name)
                    
                dest_name = name + ".svg"
                dest = assets_dir / dest_name
                dest.write_text(svg_content, encoding="utf-8")
                node[key_resolved] = rel_prefix + dest_name
            else:
                continue
        except Exception:
            pass

    for child in node.get("children", []):
        _resolve_and_copy_drawables_in_tree(child, apk_res_dir, assets_dir)


def parse_drawable_shapes(res_dir: Path, dimens: dict, colors: dict) -> dict[str, dict]:
    """
    解析 res/drawable/*.xml 中的 shape 定义。
    返回 drawable_name -> {corners, solid, stroke, gradient, size, padding} 的字典。
    仅解析 <shape> 根元素的 XML 文件。
    """
    drawable_dir = res_dir / "drawable"
    if not drawable_dir.exists():
        return {}

    shapes = {}
    for xml_file in drawable_dir.glob("*.xml"):
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()
        except Exception:
            continue

        # 只处理 shape 根元素
        tag = root.tag
        if "}" in tag:
            tag = tag.split("}")[-1]
        if tag != "shape":
            continue

        name = xml_file.stem
        info: dict = {}

        # shape 类型 (rectangle 是默认)
        shape_type = root.get(f"{{{ANDROID_NS}}}shape", "rectangle")
        info["shape_type"] = shape_type

        for child in root:
            child_tag = child.tag
            if "}" in child_tag:
                child_tag = child_tag.split("}")[-1]

            if child_tag == "corners":
                radius_raw = child.get(f"{{{ANDROID_NS}}}radius", "")
                if radius_raw:
                    resolved = resolve_dimen_value(radius_raw, dimens)
                    num, unit = parse_dimen_to_number(resolved)
                    if num is not None:
                        info["corner_radius"] = num
                        info["corner_radius_unit"] = unit
                # 各角单独设置
                for corner, key in [
                    ("topLeftRadius", "corner_tl"),
                    ("topRightRadius", "corner_tr"),
                    ("bottomLeftRadius", "corner_bl"),
                    ("bottomRightRadius", "corner_br"),
                ]:
                    val = child.get(f"{{{ANDROID_NS}}}{corner}", "")
                    if val:
                        resolved = resolve_dimen_value(val, dimens)
                        num, unit = parse_dimen_to_number(resolved)
                        if num is not None:
                            info[key] = num
                            info[f"{key}_unit"] = unit

            elif child_tag == "solid":
                color = child.get(f"{{{ANDROID_NS}}}color", "")
                if color:
                    info["solid_color"] = resolve_color_value(color, colors)

            elif child_tag == "stroke":
                sw = child.get(f"{{{ANDROID_NS}}}width", "")
                if sw:
                    resolved = resolve_dimen_value(sw, dimens)
                    num, unit = parse_dimen_to_number(resolved)
                    if num is not None:
                        info["stroke_width"] = num
                        info["stroke_width_unit"] = unit
                sc = child.get(f"{{{ANDROID_NS}}}color", "")
                if sc:
                    info["stroke_color"] = resolve_color_value(sc, colors)

            elif child_tag == "gradient":
                grad: dict = {}
                for attr in ("startColor", "endColor", "centerColor", "angle", "type"):
                    v = child.get(f"{{{ANDROID_NS}}}{attr}", "")
                    if v:
                        if attr in ("startColor", "endColor", "centerColor"):
                            grad[attr] = resolve_color_value(v, colors)
                        else:
                            grad[attr] = v
                if grad:
                    info["gradient"] = grad

            elif child_tag == "size":
                for dim_attr, dim_key in [("width", "shape_width"), ("height", "shape_height")]:
                    v = child.get(f"{{{ANDROID_NS}}}{dim_attr}", "")
                    if v:
                        resolved = resolve_dimen_value(v, dimens)
                        num, unit = parse_dimen_to_number(resolved)
                        if num is not None:
                            info[dim_key] = num
                            info[f"{dim_key}_unit"] = unit

        if info and len(info) > 1:  # 多于 shape_type 才有意义
            shapes[name] = info

    return shapes


def resolve_dimen_value(val: str, dimens: dict[str, str]) -> str:
    """
    解析 dimen 值：
    - @dimen/xxx → 从 dimens 字典查找
    - 18.0dip, 14.0sp, 10px → 直接返回
    """
    if val.startswith("@dimen/"):
        ref = val[7:]  # 去掉 @dimen/
        return dimens.get(ref, val)
    return val


def resolve_color_value(val: str, colors: dict[str, str]) -> str:
    """解析 color 值：@color/xxx → 从 colors 字典查找"""
    if val.startswith("@color/"):
        ref = val[7:]
        return colors.get(ref, val)
    return val


def css_color(val: str) -> str:
    """
    将 Android 风格的颜色字符串转换为适合 CSS 的颜色字符串。
    - #RRGGBB     → 保持不变
    - #AARRGGBB   → 转为 rgba(r,g,b,a)
    其他值原样返回。
    """
    if not isinstance(val, str):
        return val
    if not val.startswith("#"):
        return val
    if len(val) == 7:  # #RRGGBB
        return val
    if len(val) == 9:  # #AARRGGBB
        try:
            a = int(val[1:3], 16) / 255.0
            r = int(val[3:5], 16)
            g = int(val[5:7], 16)
            b = int(val[7:9], 16)
        except ValueError:
            return val
        if a >= 0.999:
            return f"#{val[3:]}"
        return f"rgba({r},{g},{b},{a:.3f})"
    return val


def parse_dimen_to_number(val: str) -> tuple[float | None, str]:
    """
    将 dimen 字符串解析为 (数值, 单位)。
    如 "18.0dip" → (18.0, "dp"), "14.0sp" → (14.0, "sp")
    """
    m = re.match(r'^([\d.]+)\s*(dip|dp|sp|px)?$', val)
    if m:
        num = float(m.group(1))
        unit = m.group(2) or "px"
        if unit == "dip":
            unit = "dp"
        return num, unit
    return None, ""


# Android 命名空间
ANDROID_NS = "http://schemas.android.com/apk/res/android"
APP_NS = "http://schemas.android.com/apk/res-auto"


def _get_android_attr(node, attr_name: str) -> str:
    """获取 android:xxx 属性值"""
    return node.get(f"{{{ANDROID_NS}}}{attr_name}", "")


def _get_app_attr(node, attr_name: str) -> str:
    """获取 app:xxx 属性值"""
    return node.get(f"{{{APP_NS}}}{attr_name}", "")


def _resolve_dimen_attr(node, attr_name: str, dimens: dict) -> tuple[float | None, str, str]:
    """
    提取并解析 android:xxx 的 dimen 属性。
    返回 (数值, 单位, 原始解析后字符串)。
    """
    val = _get_android_attr(node, attr_name)
    if not val:
        return None, "", ""
    resolved = resolve_dimen_value(val, dimens)
    num, unit = parse_dimen_to_number(resolved)
    return num, unit, resolved


def parse_apk_layouts(res_dir: Path, dimens: dict, colors: dict,
                      strings: dict | None = None,
                      styles: dict | None = None) -> dict[str, dict]:
    """
    解析反编译 APK 的 res/layout/*.xml，提取每个有 android:id 的元素的全部样式属性。
    返回 resource_id_short -> {属性字典} 的字典。

    属性字典包含：
    - 文本: text_size, text_size_unit, text_color, font_family, text_font_weight,
            line_spacing_multiplier, line_spacing_extra, letter_spacing,
            max_lines, ellipsize, include_font_padding, font_feature_settings,
            text_alignment, text_direction, text_default
    - Padding: padding_left/right/top/bottom (及 _unit)
    - Margin: margin_left/right/top/bottom (及 _unit)
    - 布局尺寸: layout_width, layout_height, min_width, max_width, min_height, max_height
    - 视觉: alpha, elevation, translation_z, visibility, rotation, scale_type
    - 背景: background (原始引用)
    - 图像: src
    - Drawable 组件: drawable_padding, drawable_start/end/left/right/top/bottom
    - ConstraintLayout: constraints (字典)
    - 元素类名: view_class
    """
    layout_dir = res_dir / "layout"
    if not layout_dir.exists():
        return {}

    if strings is None:
        strings = {}
    if styles is None:
        styles = {}

    views = {}

    def resolve_string_value(val: str) -> str:
        """解析 @string/xxx 引用"""
        if val.startswith("@string/"):
            ref = val[8:]
            return strings.get(ref, val)
        return val

    def apply_style_props(props: dict, style_ref: str):
        """从 @style/xxx 中获取属性并合并（不覆盖已有属性）"""
        if not style_ref.startswith("@style/"):
            return
        style_name = style_ref[7:]
        style_data = styles.get(style_name)
        if not style_data:
            return
        # 只填充 props 中尚未设置的属性
        for key, val in style_data.items():
            if key not in props:
                props[key] = val

    def extract_from_node(node):
        # android:id 格式: @+id/name 或 @id/name
        raw_id = _get_android_attr(node, "id")
        res_id = ""
        if raw_id.startswith("@+id/"):
            res_id = raw_id[5:]
        elif raw_id.startswith("@id/"):
            res_id = raw_id[4:]
        elif "id/" in raw_id:
            res_id = raw_id.split("id/")[-1]

        if not res_id:
            for child in node:
                extract_from_node(child)
            return

        props = {}

        # 元素类名（tag name，去掉命名空间）
        tag = node.tag
        if "}" in tag:
            tag = tag.split("}")[-1]
        props["view_class"] = tag

        # === 文本属性 ===
        # textSize
        ts_num, ts_unit, ts_raw = _resolve_dimen_attr(node, "textSize", dimens)
        if ts_num is not None:
            props["text_size"] = ts_num
            props["text_size_unit"] = ts_unit
            props["text_size_raw"] = ts_raw

        # textColor
        tc = _get_android_attr(node, "textColor")
        if tc:
            props["text_color"] = resolve_color_value(tc, colors)

        # fontFamily
        ff = _get_android_attr(node, "fontFamily")
        if ff:
            props["font_family"] = ff

        # textFontWeight
        tfw = _get_android_attr(node, "textFontWeight")
        if tfw:
            props["text_font_weight"] = tfw

        # lineSpacingMultiplier
        lsm = _get_android_attr(node, "lineSpacingMultiplier")
        if lsm:
            try:
                props["line_spacing_multiplier"] = float(lsm)
            except ValueError:
                props["line_spacing_multiplier"] = lsm

        # lineSpacingExtra
        lse_num, lse_unit, _ = _resolve_dimen_attr(node, "lineSpacingExtra", dimens)
        if lse_num is not None:
            props["line_spacing_extra"] = lse_num
            props["line_spacing_extra_unit"] = lse_unit

        # letterSpacing
        ls = _get_android_attr(node, "letterSpacing")
        if ls:
            try:
                props["letter_spacing"] = float(ls)
            except ValueError:
                props["letter_spacing"] = ls

        # maxLines
        ml = _get_android_attr(node, "maxLines")
        if ml:
            try:
                props["max_lines"] = int(ml)
            except ValueError:
                props["max_lines"] = ml

        # ellipsize
        ell = _get_android_attr(node, "ellipsize")
        if ell:
            props["ellipsize"] = ell

        # includeFontPadding
        ifp = _get_android_attr(node, "includeFontPadding")
        if ifp:
            props["include_font_padding"] = ifp == "true"

        # fontFeatureSettings
        ffs = _get_android_attr(node, "fontFeatureSettings")
        if ffs:
            props["font_feature_settings"] = ffs

        # textAlignment
        ta = _get_android_attr(node, "textAlignment")
        if ta:
            props["text_alignment"] = ta

        # textDirection
        td = _get_android_attr(node, "textDirection")
        if td:
            props["text_direction"] = td

        # gravity
        gv = _get_android_attr(node, "gravity")
        if gv:
            props["gravity"] = gv

        # android:text (默认文本，解析 @string/ 引用)
        txt = _get_android_attr(node, "text")
        if txt:
            props["text_default"] = resolve_string_value(txt)

        # === Padding ===
        for attr_name, prop_key in [
            ("padding", "padding_all"),
            ("paddingLeft", "padding_left"), ("paddingStart", "padding_left"),
            ("paddingRight", "padding_right"), ("paddingEnd", "padding_right"),
            ("paddingTop", "padding_top"),
            ("paddingBottom", "padding_bottom"),
        ]:
            num, unit, _ = _resolve_dimen_attr(node, attr_name, dimens)
            if num is not None:
                props[prop_key] = num
                props[f"{prop_key}_unit"] = unit

        # 展开 padding_all 到四个方向
        if "padding_all" in props:
            p_all = props["padding_all"]
            p_unit = props.get("padding_all_unit", "dp")
            for side in ("left", "right", "top", "bottom"):
                key = f"padding_{side}"
                if key not in props:
                    props[key] = p_all
                    props[f"{key}_unit"] = p_unit

        # === Margin ===
        for attr_name, prop_key in [
            ("layout_margin", "margin_all"),
            ("layout_marginLeft", "margin_left"), ("layout_marginStart", "margin_left"),
            ("layout_marginRight", "margin_right"), ("layout_marginEnd", "margin_right"),
            ("layout_marginTop", "margin_top"),
            ("layout_marginBottom", "margin_bottom"),
        ]:
            num, unit, _ = _resolve_dimen_attr(node, attr_name, dimens)
            if num is not None:
                props[prop_key] = num
                props[f"{prop_key}_unit"] = unit

        # 展开 margin_all 到四个方向
        if "margin_all" in props:
            m_all = props["margin_all"]
            m_unit = props.get("margin_all_unit", "dp")
            for side in ("left", "right", "top", "bottom"):
                key = f"margin_{side}"
                if key not in props:
                    props[key] = m_all
                    props[f"{key}_unit"] = m_unit

        # === 布局尺寸 ===
        lw = _get_android_attr(node, "layout_width")
        if lw:
            if lw in ("fill_parent", "match_parent", "wrap_content"):
                props["layout_width"] = lw
            else:
                num, unit, _ = _resolve_dimen_attr(node, "layout_width", dimens)
                if num is not None:
                    props["layout_width"] = num
                    props["layout_width_unit"] = unit
                else:
                    props["layout_width"] = lw

        lh = _get_android_attr(node, "layout_height")
        if lh:
            if lh in ("fill_parent", "match_parent", "wrap_content"):
                props["layout_height"] = lh
            else:
                num, unit, _ = _resolve_dimen_attr(node, "layout_height", dimens)
                if num is not None:
                    props["layout_height"] = num
                    props["layout_height_unit"] = unit
                else:
                    props["layout_height"] = lh

        for attr_name, prop_key in [
            ("minWidth", "min_width"), ("maxWidth", "max_width"),
            ("minHeight", "min_height"), ("maxHeight", "max_height"),
        ]:
            num, unit, _ = _resolve_dimen_attr(node, attr_name, dimens)
            if num is not None:
                props[prop_key] = num
                props[f"{prop_key}_unit"] = unit

        # === 视觉属性 ===
        alpha = _get_android_attr(node, "alpha")
        if alpha:
            try:
                props["alpha"] = float(alpha)
            except ValueError:
                props["alpha"] = alpha

        elev = _get_android_attr(node, "elevation")
        if elev:
            num, unit, _ = _resolve_dimen_attr(node, "elevation", dimens)
            if num is not None:
                props["elevation"] = num
                props["elevation_unit"] = unit

        tz = _get_android_attr(node, "translationZ")
        if tz:
            num, unit, _ = _resolve_dimen_attr(node, "translationZ", dimens)
            if num is not None:
                props["translation_z"] = num
                props["translation_z_unit"] = unit

        vis = _get_android_attr(node, "visibility")
        if vis:
            props["visibility"] = vis

        rot = _get_android_attr(node, "rotation")
        if rot:
            try:
                props["rotation"] = float(rot)
            except ValueError:
                props["rotation"] = rot

        st = _get_android_attr(node, "scaleType")
        if st:
            props["scale_type"] = st

        # === 背景和图像 ===
        bg = _get_android_attr(node, "background")
        if bg:
            props["background"] = bg

        src = _get_android_attr(node, "src")
        if src:
            props["src"] = src

        # === Compound drawables ===
        dp = _get_android_attr(node, "drawablePadding")
        if dp:
            num, unit, _ = _resolve_dimen_attr(node, "drawablePadding", dimens)
            if num is not None:
                props["drawable_padding"] = num
                props["drawable_padding_unit"] = unit

        for pos in ("Start", "End", "Left", "Right", "Top", "Bottom"):
            dattr = f"drawable{pos}"
            dval = _get_android_attr(node, dattr)
            if dval:
                props[f"drawable_{pos.lower()}"] = dval

        # === ConstraintLayout 属性 ===
        constraints = {}
        for attr_key, attr_val in node.attrib.items():
            if attr_key.startswith(f"{{{APP_NS}}}layout_constraint"):
                short_key = attr_key.split("}")[-1]
                constraints[short_key] = attr_val
        if constraints:
            props["constraints"] = constraints

        # === Style 引用 ===
        style_ref = node.get("style", "")
        if style_ref:
            props["style"] = style_ref
            apply_style_props(props, style_ref)

        if props:
            # 同一个 id 可能出现在多个布局文件中，收集全部候选（用于后续按兄弟字号或最小字号选取）
            views.setdefault(res_id, []).append(props)

        for child in node:
            extract_from_node(child)

    layout_files = list(layout_dir.glob("*.xml"))
    for xml_file in layout_files:
        try:
            tree = ET.parse(xml_file)
            extract_from_node(tree.getroot())
        except Exception:
            continue

    return views


def _dimen_to_px(val, unit: str, density: float) -> float | None:
    """将 dp/sp/px 数值转为 px"""
    if val is None:
        return None
    try:
        val = float(val)
    except (ValueError, TypeError):
        return None
    if unit in ("dp", "sp"):
        return val * density
    return val


def _pick_best_props(candidates: list, sibling_text_sizes: set | None = None) -> dict:
    """
    同一 resource_id 在多个 layout 中有不同 text_size 时，选取最合适的一条。
    优先：与同层兄弟已确定的 text_size_dp 一致；否则取最小 text_size（如副标题 14 而非 20.36）。
    """
    if not candidates:
        return {}
    if len(candidates) == 1:
        return candidates[0]
    if sibling_text_sizes:
        for c in candidates:
            ts = c.get("text_size")
            if ts is not None:
                unit = c.get("text_size_unit", "dp")
                if unit in ("dp", "sp"):
                    try:
                        t = float(ts)
                        if any(abs(t - s) < 0.02 for s in sibling_text_sizes if s is not None):
                            return c
                    except (TypeError, ValueError):
                        pass
    def _text_size_val(p):
        v = p.get("text_size")
        if v is None:
            return float("inf")
        try:
            return float(v)
        except (TypeError, ValueError):
            return float("inf")
    return min(candidates, key=_text_size_val)


def enrich_from_apk(elements: list[dict], apk_res_dir: Path, density: float):
    """
    用反编译 APK 资源丰富元素数据（全量属性）。
    density: 设备屏幕密度 (如 3.0 = 480dpi / 160)
    """
    print(f"正在解析 APK 资源: {apk_res_dir}")

    dimens = parse_apk_dimens(apk_res_dir)
    print(f"  dimens.xml: {len(dimens)} 条")

    colors = parse_apk_colors(apk_res_dir)
    print(f"  colors.xml: {len(colors)} 条")

    strings = parse_apk_strings(apk_res_dir)
    print(f"  strings.xml: {len(strings)} 条")

    apk_styles = parse_apk_styles(apk_res_dir, dimens, colors)
    print(f"  styles.xml: {len(apk_styles)} 个有效 style")

    drawable_shapes = parse_drawable_shapes(apk_res_dir, dimens, colors)
    print(f"  drawable shapes: {len(drawable_shapes)} 个")

    layout_views = parse_apk_layouts(apk_res_dir, dimens, colors,
                                     strings=strings, styles=apk_styles)
    print(f"  layout 中有 id 的元素: {len(layout_views)} 个")

    # 统计有 textSize 的（同一 id 多 layout 时只计一条）
    def _has_text_size(v):
        if isinstance(v, list):
            return any("text_size" in p for p in v)
        return "text_size" in v
    with_ts = sum(1 for v in layout_views.values() if _has_text_size(v))
    print(f"  其中有 textSize 的: {with_ts} 个")

    # 所有要传播的直接属性
    DIRECT_STR_PROPS = [
        "font_family", "text_font_weight", "ellipsize", "font_feature_settings",
        "text_alignment", "text_direction", "gravity", "visibility", "scale_type",
        "text_default", "background", "src", "style", "view_class",
    ]
    DIRECT_NUM_PROPS = [
        "line_spacing_multiplier", "letter_spacing", "max_lines", "alpha", "rotation",
    ]
    DIRECT_BOOL_PROPS = [
        "include_font_padding",
    ]
    # dimen 属性 (需要 dp→px 转换)
    DIMEN_PROPS = [
        "line_spacing_extra", "elevation", "translation_z",
        "min_width", "max_width", "min_height", "max_height",
        "drawable_padding",
    ]
    # drawable 引用属性 (直接复制)
    DRAWABLE_REF_PROPS = [
        "drawable_start", "drawable_end", "drawable_left", "drawable_right",
        "drawable_top", "drawable_bottom",
    ]

    matched = 0
    for e in elements:
        e_rid = e["resource_id"].split("/")[-1] if e["resource_id"] else ""
        if not e_rid or e_rid not in layout_views:
            # 设置默认值
            e.setdefault("text_size_px", None)
            e.setdefault("text_size_dp", None)
            e.setdefault("text_color", None)
            for side in ("left", "right", "top", "bottom"):
                e.setdefault(f"padding_{side}", 0)
                e.setdefault(f"margin_{side}", 0)
            e.setdefault("content_bounds", None)
            e.setdefault("apk_props", None)
            continue

        matched += 1
        raw = layout_views[e_rid]
        props = _pick_best_props(raw, sibling_text_sizes=None) if isinstance(raw, list) else raw

        # 字号
        ts = props.get("text_size")
        ts_unit = props.get("text_size_unit", "dp")
        if ts is not None:
            if ts_unit in ("dp", "sp"):
                e["text_size_px"] = ts * density
                e["text_size_dp"] = ts
            else:
                e["text_size_px"] = ts
                e["text_size_dp"] = ts / density if density else ts
        else:
            e["text_size_px"] = None
            e["text_size_dp"] = None

        # 文字颜色
        e["text_color"] = props.get("text_color")

        # Padding (dp → px)
        for side in ("left", "right", "top", "bottom"):
            key = f"padding_{side}"
            val = props.get(key, 0)
            unit = props.get(f"{key}_unit", "dp")
            e[key] = int(_dimen_to_px(val, unit, density) or 0)

        # Margin (dp → px)
        for side in ("left", "right", "top", "bottom"):
            key = f"margin_{side}"
            val = props.get(key, 0)
            unit = props.get(f"{key}_unit", "dp")
            e[key] = int(_dimen_to_px(val, unit, density) or 0)

        # 直接字符串属性
        for prop_name in DIRECT_STR_PROPS:
            val = props.get(prop_name)
            if val is not None:
                e[prop_name] = val

        # 直接数值属性
        for prop_name in DIRECT_NUM_PROPS:
            val = props.get(prop_name)
            if val is not None:
                e[prop_name] = val

        # 直接布尔属性
        for prop_name in DIRECT_BOOL_PROPS:
            val = props.get(prop_name)
            if val is not None:
                e[prop_name] = val

        # dimen 属性 (dp → px)
        for prop_name in DIMEN_PROPS:
            val = props.get(prop_name)
            unit = props.get(f"{prop_name}_unit", "dp")
            if val is not None:
                e[f"{prop_name}_px"] = _dimen_to_px(val, unit, density)
                e[f"{prop_name}_dp"] = val
            else:
                e[f"{prop_name}_px"] = None

        # Drawable 引用
        for prop_name in DRAWABLE_REF_PROPS:
            val = props.get(prop_name)
            if val:
                e[prop_name] = val

        # layout_width / layout_height (保留原始值，如果是数字则同时存 px)
        for dim in ("layout_width", "layout_height"):
            val = props.get(dim)
            if val is not None:
                if isinstance(val, (int, float)):
                    unit = props.get(f"{dim}_unit", "dp")
                    e[dim] = val
                    e[f"{dim}_unit"] = unit
                    e[f"{dim}_px"] = _dimen_to_px(val, unit, density)
                else:
                    e[dim] = val  # "match_parent", "wrap_content", etc.

        # ConstraintLayout 约束
        constraints = props.get("constraints")
        if constraints:
            e["constraints"] = constraints

        # Background → 解析 drawable shape
        bg = props.get("background", "")
        if bg.startswith("@drawable/"):
            drawable_name = bg[10:]
            shape_info = drawable_shapes.get(drawable_name)
            if shape_info:
                # 转换 shape 中的 dimen 为 px
                bg_shape = {}
                bg_shape["shape_type"] = shape_info.get("shape_type", "rectangle")
                # 圆角
                cr = shape_info.get("corner_radius")
                if cr is not None:
                    cr_unit = shape_info.get("corner_radius_unit", "dp")
                    bg_shape["corner_radius_dp"] = cr
                    bg_shape["corner_radius_px"] = _dimen_to_px(cr, cr_unit, density)
                for corner_key in ("corner_tl", "corner_tr", "corner_bl", "corner_br"):
                    cv = shape_info.get(corner_key)
                    if cv is not None:
                        cu = shape_info.get(f"{corner_key}_unit", "dp")
                        bg_shape[f"{corner_key}_dp"] = cv
                        bg_shape[f"{corner_key}_px"] = _dimen_to_px(cv, cu, density)
                # 填充颜色
                sc = shape_info.get("solid_color")
                if sc:
                    bg_shape["solid_color"] = sc
                # 描边
                sw = shape_info.get("stroke_width")
                if sw is not None:
                    sw_unit = shape_info.get("stroke_width_unit", "dp")
                    bg_shape["stroke_width_dp"] = sw
                    bg_shape["stroke_width_px"] = _dimen_to_px(sw, sw_unit, density)
                skc = shape_info.get("stroke_color")
                if skc:
                    bg_shape["stroke_color"] = skc
                # 渐变
                grad = shape_info.get("gradient")
                if grad:
                    bg_shape["gradient"] = grad
                e["bg_shape"] = bg_shape
            else:
                e["bg_shape"] = None
        elif bg.startswith("@color/"):
            e["bg_shape"] = {"solid_color": resolve_color_value(bg, colors)}
        elif bg.startswith("#"):
            e["bg_shape"] = {"solid_color": bg}
        else:
            e["bg_shape"] = None

        # 计算内容区域
        if e["bounds"]:
            b = e["bounds"]
            pl, pr = e.get("padding_left", 0), e.get("padding_right", 0)
            pt, pb = e.get("padding_top", 0), e.get("padding_bottom", 0)
            e["content_bounds"] = {
                "left": b["left"] + pl,
                "top": b["top"] + pt,
                "right": b["right"] - pr,
                "bottom": b["bottom"] - pb,
                "width": max(0, b["width"] - pl - pr),
                "height": max(0, b["height"] - pt - pb),
            }
        else:
            e["content_bounds"] = None

        # 存储完整 APK props 供高级用途
        e["apk_props"] = props

    print(f"  匹配到 {matched}/{len(elements)} 个元素的 APK 样式属性")


def get_display_density(serial: str | None = None) -> float:
    """获取设备屏幕密度倍数 (dpi / 160)。优先使用 Override density，否则使用 Physical density。"""
    success, output = run_adb(["shell", "wm", "density"], serial=serial)
    if success:
        override_dpi = None
        physical_dpi = None
        for line in output.split("\n"):
            line_lower = line.lower()
            val = line.split(":")[-1].strip()
            try:
                dpi = int(val)
            except ValueError:
                continue
            if "override" in line_lower:
                override_dpi = dpi
            elif "physical" in line_lower or "density" in line_lower:
                physical_dpi = dpi
        # 优先使用 override，其次 physical
        effective_dpi = override_dpi or physical_dpi
        if effective_dpi:
            return effective_dpi / 160.0
    return 3.0  # 默认 480dpi (xxhdpi)


def get_png_dimensions(png_path: Path) -> tuple[int, int] | None:
    """从 PNG 文件头读取实际像素尺寸"""
    try:
        with open(png_path, "rb") as f:
            header = f.read(24)
            if header[:8] == b'\x89PNG\r\n\x1a\n':
                width, height = struct.unpack('>II', header[16:24])
                return width, height
    except Exception:
        pass
    return None


def generate_html(elements: list[dict], output_path: Path, screenshot_path: Path, screen_size: tuple[int, int]):
    """生成可视化 HTML 文件"""
    
    # 优先从截图实际像素尺寸确定基准，确保框和截图精确对齐
    png_dims = get_png_dimensions(screenshot_path) if screenshot_path.exists() else None
    if png_dims:
        screen_width, screen_height = png_dims
        print(f"  截图实际尺寸: {screen_width}x{screen_height}")
    else:
        screen_width, screen_height = screen_size
    
    # 缩放比例（让 HTML 在浏览器中显示合适的大小）
    scale = 0.4
    
    # 截图使用相对路径引用（不嵌入 base64）
    screenshot_rel = screenshot_path.name if screenshot_path.exists() else ""
    
    # 构建元素 JSON 数据（供 JS 使用）
    elements_json = []
    for i, e in enumerate(elements):
        if not e["bounds"]:
            continue
        b = e["bounds"]

        # 文本颜色 / 背景颜色转为 CSS 友好的格式（处理 #AARRGGBB）
        text_color_css = css_color(e.get("text_color"))
        bg_shape_val = e.get("bg_shape")
        if isinstance(bg_shape_val, dict):
            bg_shape = dict(bg_shape_val)
            if "solid_color" in bg_shape and isinstance(bg_shape["solid_color"], str):
                bg_shape["solid_color"] = css_color(bg_shape["solid_color"])
            if "stroke_color" in bg_shape and isinstance(bg_shape.get("stroke_color"), str):
                bg_shape["stroke_color"] = css_color(bg_shape["stroke_color"])
            grad = bg_shape.get("gradient")
            if isinstance(grad, dict):
                for k in ("startColor", "endColor", "centerColor"):
                    if k in grad and isinstance(grad[k], str):
                        grad[k] = css_color(grad[k])
        else:
            bg_shape = bg_shape_val
        d = {
            "i": i,
            "cls": e["class"],
            "clsShort": e["class"].split(".")[-1] if e["class"] else "?",
            "text": e["text"],
            "desc": e["content_desc"],
            "resId": e["resource_id"],
            "resIdShort": e["resource_id"].split("/")[-1] if e["resource_id"] else "",
            "bounds": e["bounds_raw"],
            "clickable": e["clickable"],
            "scrollable": e["scrollable"],
            "leaf": e["is_leaf"],
            "left": b["left"], "top": b["top"],
            "width": b["width"], "height": b["height"],
            # 文本样式
            "textSizePx": e.get("text_size_px"),
            "textSizeDp": e.get("text_size_dp"),
            "textColor": text_color_css,
            "fontFamily": e.get("font_family"),
            "fontWeight": e.get("text_font_weight"),
            "lineSpacingMul": e.get("line_spacing_multiplier"),
            "lineSpacingExtra": e.get("line_spacing_extra_dp"),
            "letterSpacing": e.get("letter_spacing"),
            "maxLines": e.get("max_lines"),
            "ellipsize": e.get("ellipsize"),
            "includeFontPad": e.get("include_font_padding"),
            "fontFeature": e.get("font_feature_settings"),
            "textAlign": e.get("text_alignment"),
            "textDir": e.get("text_direction"),
            "gravity": e.get("gravity"),
            "textDefault": e.get("text_default"),
            # Padding (px)
            "pl": e.get("padding_left", 0), "pr": e.get("padding_right", 0),
            "pt": e.get("padding_top", 0), "pb": e.get("padding_bottom", 0),
            # Margin (px)
            "ml": e.get("margin_left", 0), "mr": e.get("margin_right", 0),
            "mt": e.get("margin_top", 0), "mb": e.get("margin_bottom", 0),
            # Layout 尺寸
            "layoutW": e.get("layout_width"),
            "layoutH": e.get("layout_height"),
            "minW": e.get("min_width_dp"), "maxW": e.get("max_width_dp"),
            "minH": e.get("min_height_dp"), "maxH": e.get("max_height_dp"),
            # 视觉属性
            "alpha": e.get("alpha"),
            "elevation": e.get("elevation_dp"),
            "visibility": e.get("visibility"),
            "rotation": e.get("rotation"),
            "scaleType": e.get("scale_type"),
            # 背景
            "background": css_color(e.get("background")) if isinstance(e.get("background"), str) else e.get("background"),
            "bgShape": bg_shape,
            # 图像
            "src": e.get("src"),
            # Content bounds
            "cb": e.get("content_bounds"),
            # ConstraintLayout
            "constraints": e.get("constraints"),
        }
        elements_json.append(d)
    elements_data = json.dumps(elements_json, ensure_ascii=False)

    # 侧边栏列表 HTML（所有元素，按 top 排序）
    sorted_for_list = sorted(
        [e for e in elements if e["bounds"]],
        key=lambda e: (e["bounds"]["top"], e["bounds"]["left"])
    )
    list_items_html = ""
    for e in sorted_for_list:
        idx = elements.index(e)
        b = e["bounds"]
        cls = e["class"].split(".")[-1] if e["class"] else "?"
        label = html.escape(e["text"] or e["content_desc"] or "")
        if len(label) > 45:
            label = label[:45] + "..."
        rid = e["resource_id"].split("/")[-1] if e["resource_id"] else ""
        tags = []
        if e["is_leaf"]:
            tags.append("L")
        if e["text"]:
            tags.append("T")
        if e["clickable"]:
            tags.append("C")
        if e["scrollable"]:
            tags.append("S")
        tag_str = html.escape(" ".join(tags))
        is_leaf_attr = "true" if e["is_leaf"] else "false"
        search_text = html.escape(f"{cls} {label} {rid}".lower())
        empty_label = '<em style="color:#666">(无文本)</em>'
        display_label = label if label else empty_label
        rid_part = " | " + rid if rid else ""
        list_items_html += (
            f'<div class="list-item" data-index="{idx}" data-search="{search_text}" data-leaf="{is_leaf_attr}">'
            f'<span class="item-label">{display_label}</span>'
            f' <span class="item-tags">{tag_str}</span>'
            f'<div class="item-meta">{cls}'
            f'{rid_part}'
            f' | {b["width"]}×{b["height"]} @({b["left"]},{b["top"]})</div></div>\n'
        )

    html_content = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI 布局预览</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e; color: #eee;
            padding: 20px; display: flex; gap: 20px; align-items: flex-start;
        }}
        /* --- 左侧截图容器 --- */
        .container {{
            position: relative;
            width: {int(screen_width * scale)}px;
            height: {int(screen_height * scale)}px;
            background: #000; border-radius: 20px; overflow: hidden; flex-shrink: 0;
            cursor: crosshair;
        }}
        .screenshot {{ width: 100%; height: 100%; pointer-events: none; }}
        .overlay {{
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none;
        }}
        .el-box {{
            position: absolute; border: 1px solid rgba(0,255,0,0.4);
            background: rgba(0,255,0,0.05); pointer-events: none;
        }}
        .el-box.has-text {{ border-color: rgba(255,200,0,0.6); background: rgba(255,200,0,0.06); }}
        .el-box.is-clickable {{ border-color: rgba(255,100,100,0.6); background: rgba(255,100,100,0.06); }}
        .el-box.highlighted {{
            border: 2px solid #0ff !important;
            background: rgba(0,255,255,0.25) !important;
            z-index: 9999;
        }}
        .content-box {{
            position: absolute; border: 1.5px dashed #ff0 !important;
            background: rgba(255,255,0,0.12); pointer-events: none;
            z-index: 9998; display: none;
        }}
        /* --- 点击弹出的重叠选择菜单 --- */
        .picker {{
            position: fixed; background: #2a2a4a; border: 1px solid #555;
            border-radius: 8px; padding: 6px 0; min-width: 280px; max-height: 360px;
            overflow-y: auto; z-index: 10000; box-shadow: 0 8px 24px rgba(0,0,0,.5);
            display: none;
        }}
        .picker-title {{
            padding: 6px 12px; font-size: 11px; color: #888; border-bottom: 1px solid #3a3a5a;
        }}
        .picker-item {{
            padding: 7px 12px; cursor: pointer; font-size: 13px;
            border-bottom: 1px solid #2f2f4f;
        }}
        .picker-item:hover {{ background: #3a3a5a; }}
        .picker-item .pi-label {{ color: #ffd700; }}
        .picker-item .pi-meta {{ color: #888; font-size: 11px; }}
        .picker-item .pi-tag {{
            display: inline-block; font-size: 10px; padding: 1px 5px;
            border-radius: 3px; margin-left: 4px;
        }}
        .pi-tag.clickable {{ background: rgba(255,100,100,.25); color: #f88; }}
        .pi-tag.scrollable {{ background: rgba(100,100,255,.25); color: #88f; }}
        /* --- 右侧信息面板 --- */
        .info-panel {{ flex: 1; max-width: 650px; display: flex; flex-direction: column; max-height: calc(100vh - 40px); position: sticky; top: 20px; }}
        .info-panel h2 {{ margin-bottom: 12px; color: #0ff; flex-shrink: 0; }}
        .legend {{
            display: flex; gap: 16px; margin-bottom: 10px; font-size: 12px; flex-shrink: 0;
        }}
        .legend-item {{ display: flex; align-items: center; gap: 5px; }}
        .legend-color {{ width: 14px; height: 14px; border-radius: 3px; }}
        .search-box {{
            width: 100%; padding: 8px 12px; border: 1px solid #3a3a5a; border-radius: 6px;
            background: #1e1e3a; color: #eee; font-size: 13px; margin-bottom: 10px;
            flex-shrink: 0;
        }}
        .search-box::placeholder {{ color: #666; }}
        .element-detail {{
            background: #2a2a4a; padding: 12px; border-radius: 8px; margin-bottom: 10px;
            display: none; flex-shrink: 0;
        }}
        .element-detail.active {{ display: block; }}
        .element-detail table {{ width: 100%; border-collapse: collapse; }}
        .element-detail td {{ padding: 4px 8px; border-bottom: 1px solid #3a3a5a; font-size: 13px; }}
        .element-detail td:first-child {{ color: #888; width: 90px; }}
        .element-list {{
            background: #2a2a4a; padding: 8px; border-radius: 8px;
            overflow-y: auto; flex: 1; min-height: 0;
        }}
        .list-item {{
            padding: 6px 8px; border-bottom: 1px solid #2f2f4f;
            cursor: pointer; font-size: 13px;
        }}
        .list-item:hover {{ background: #3a3a5a; }}
        .list-item.active {{ background: #2a4a5a; border-left: 3px solid #0ff; }}
        .list-item .item-label {{ color: #ffd700; }}
        .list-item .item-tags {{
            font-size: 10px; color: #aaa; margin-left: 6px;
        }}
        .list-item .item-meta {{ color: #777; font-size: 11px; margin-top: 2px; }}
        .controls {{ margin-bottom: 10px; font-size: 13px; flex-shrink: 0; }}
        .controls label {{ margin-right: 12px; cursor: pointer; }}
        .controls input {{ margin-right: 4px; }}
    </style>
</head>
<body>
    <div class="container" id="container">
        {"<img class='screenshot' src='" + screenshot_rel + "' />" if screenshot_rel else ""}
        <div class="overlay" id="overlay"></div>
    </div>
    <div class="picker" id="picker"></div>

    <div class="info-panel">
        <h2>UI 布局分析</h2>
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background:rgba(255,200,0,.3);border:1px solid rgba(255,200,0,.7)"></div>
                <span>有文本</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:rgba(255,100,100,.3);border:1px solid rgba(255,100,100,.7)"></div>
                <span>可点击</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background:rgba(0,255,0,.1);border:1px solid rgba(0,255,0,.5)"></div>
                <span>其他</span>
            </div>
        </div>
        <div class="controls">
            <label><input type="checkbox" id="showAll" checked> 全部</label>
            <label><input type="checkbox" id="showText" checked> 有文本</label>
            <label><input type="checkbox" id="showClickable" checked> 可点击</label>
            <label title="隐藏所有边框"><input type="checkbox" id="showBoxes" checked> 边框</label>
            <label title="仅显示叶子节点（无子元素的最具体元素）"><input type="checkbox" id="leafOnly"> 仅叶子</label>
        </div>
        <input class="search-box" id="searchBox" type="text" placeholder="搜索元素（类名、文本、ID）..." />
        <div class="element-detail" id="detail">
            <div style="max-height:45vh;overflow-y:auto;">
            <table>
                <tr><td>类名</td><td id="dClass">-</td></tr>
                <tr><td>文本</td><td id="dText">-</td></tr>
                <tr><td>描述</td><td id="dDesc">-</td></tr>
                <tr><td>Resource ID</td><td id="dResId">-</td></tr>
                <tr><td>Bounds</td><td id="dBounds">-</td></tr>
                <tr><td>尺寸</td><td id="dSize">-</td></tr>
                <tr><td>Layout尺寸</td><td id="dLayout">-</td></tr>
                <tr><td>可点击</td><td id="dClick">-</td></tr>
                <tr><td>可滚动</td><td id="dScroll">-</td></tr>
                <tr><td>叶子节点</td><td id="dLeaf">-</td></tr>
                <tr><td>字号</td><td id="dTextSize">-</td></tr>
                <tr><td>文字颜色</td><td id="dColor">-</td></tr>
                <tr><td>字体</td><td id="dFont">-</td></tr>
                <tr><td>字重</td><td id="dWeight">-</td></tr>
                <tr><td>行距</td><td id="dLineSpacing">-</td></tr>
                <tr><td>字距</td><td id="dLetterSpacing">-</td></tr>
                <tr><td>行数/省略</td><td id="dLines">-</td></tr>
                <tr><td>对齐/方向</td><td id="dAlign">-</td></tr>
                <tr><td>Padding</td><td id="dPadding">-</td></tr>
                <tr><td>Margin</td><td id="dMargin">-</td></tr>
                <tr><td>背景</td><td id="dBackground">-</td></tr>
                <tr><td>透明度</td><td id="dAlpha">-</td></tr>
                <tr><td>Elevation</td><td id="dElevation">-</td></tr>
                <tr><td>可见性</td><td id="dVisibility">-</td></tr>
                <tr><td>图像</td><td id="dImage">-</td></tr>
                <tr><td>约束</td><td id="dConstraints">-</td></tr>
            </table>
            </div>
        </div>
        <div class="element-list" id="elementList">
{list_items_html}
        </div>
    </div>

    <script>
    (function() {{
        const SCALE = {scale};
        const DATA = {elements_data};
        const overlay = document.getElementById('overlay');
        const picker = document.getElementById('picker');
        const container = document.getElementById('container');
        const detail = document.getElementById('detail');
        const searchBox = document.getElementById('searchBox');
        const listItems = document.querySelectorAll('.list-item');

        // --- 渲染元素框 ---
        DATA.forEach(d => {{
            const box = document.createElement('div');
            box.className = 'el-box' + (d.text ? ' has-text' : '') + (d.clickable ? ' is-clickable' : '') + (d.leaf ? ' is-leaf' : '');
            box.style.left = (d.left * SCALE) + 'px';
            box.style.top = (d.top * SCALE) + 'px';
            box.style.width = (d.width * SCALE) + 'px';
            box.style.height = (d.height * SCALE) + 'px';
            box.dataset.index = d.i;
            overlay.appendChild(box);
        }});
        const boxes = overlay.querySelectorAll('.el-box');

        // --- 筛选控件 ---
        const showAll = document.getElementById('showAll');
        const showText = document.getElementById('showText');
        const showClickable = document.getElementById('showClickable');
        const showBoxes = document.getElementById('showBoxes');
        const leafOnly = document.getElementById('leafOnly');

        function updateVisibility() {{
            const hideBoxes = !showBoxes.checked;
            const onlyLeaf = leafOnly.checked;
            // 更新截图上的边框
            boxes.forEach(b => {{
                if (hideBoxes) {{ b.style.display = 'none'; return; }}
                const d = DATA.find(x => x.i == b.dataset.index);
                if (!d) return;
                if (onlyLeaf && !d.leaf) {{ b.style.display = 'none'; return; }}
                let vis = showAll.checked;
                if (!showAll.checked) {{
                    vis = (showText.checked && d.text) || (showClickable.checked && d.clickable);
                }}
                b.style.display = vis ? 'block' : 'none';
            }});
            // 同步更新侧边栏列表
            const q = searchBox.value.toLowerCase().trim();
            listItems.forEach(li => {{
                if (onlyLeaf && li.dataset.leaf !== 'true') {{ li.style.display = 'none'; return; }}
                li.style.display = (!q || li.dataset.search.includes(q)) ? '' : 'none';
            }});
        }}
        [showAll, showText, showClickable, showBoxes, leafOnly].forEach(c => c.addEventListener('change', updateVisibility));

        // --- 详情面板 ---
        function showDetail(d) {{
            const $ = id => document.getElementById(id);
            $('dClass').textContent = d.cls || '-';
            $('dText').textContent = d.text || '-';
            $('dDesc').textContent = d.desc || '-';
            $('dResId').textContent = d.resId || '-';
            $('dBounds').textContent = d.bounds || '-';
            $('dSize').textContent = d.width + ' × ' + d.height;
            $('dClick').textContent = d.clickable ? '是' : '否';
            $('dScroll').textContent = d.scrollable ? '是' : '否';
            $('dLeaf').textContent = d.leaf ? '是（最具体元素）' : '否（容器）';
            // Layout 尺寸
            let lwStr = '-';
            if (d.layoutW != null) {{
                if (typeof d.layoutW === 'string') lwStr = d.layoutW;
                else lwStr = d.layoutW + 'dp';
            }}
            let lhStr = '-';
            if (d.layoutH != null) {{
                if (typeof d.layoutH === 'string') lhStr = d.layoutH;
                else lhStr = d.layoutH + 'dp';
            }}
            let constraintsArr = [];
            if (d.minW) constraintsArr.push('minW:' + d.minW + 'dp');
            if (d.maxW) constraintsArr.push('maxW:' + d.maxW + 'dp');
            if (d.minH) constraintsArr.push('minH:' + d.minH + 'dp');
            if (d.maxH) constraintsArr.push('maxH:' + d.maxH + 'dp');
            let layoutStr = lwStr + ' × ' + lhStr;
            if (constraintsArr.length) layoutStr += ' (' + constraintsArr.join(', ') + ')';
            $('dLayout').textContent = layoutStr;
            // 字号
            if (d.textSizeDp) {{
                $('dTextSize').textContent = d.textSizeDp + 'dp (' + Math.round(d.textSizePx) + 'px)';
            }} else if (d.textSizePx) {{
                $('dTextSize').textContent = Math.round(d.textSizePx) + 'px';
            }} else {{
                $('dTextSize').textContent = '-';
            }}
            // 文字颜色
            const colorEl = $('dColor');
            if (d.textColor) {{
                colorEl.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:' 
                    + d.textColor + ';vertical-align:middle;margin-right:6px;border:1px solid #555;"></span>' + d.textColor;
            }} else {{
                colorEl.textContent = '-';
            }}
            // 字体
            $('dFont').textContent = d.fontFamily || '-';
            // 字重
            $('dWeight').textContent = d.fontWeight || '-';
            // 行距
            let lsArr = [];
            if (d.lineSpacingMul != null) lsArr.push('×' + d.lineSpacingMul);
            if (d.lineSpacingExtra != null) lsArr.push('+' + d.lineSpacingExtra + 'dp');
            $('dLineSpacing').textContent = lsArr.length ? lsArr.join(' ') : '-';
            // 字距
            $('dLetterSpacing').textContent = d.letterSpacing != null ? d.letterSpacing + 'em' : '-';
            // 行数/省略
            let linesParts = [];
            if (d.maxLines != null) linesParts.push('最多' + d.maxLines + '行');
            if (d.ellipsize) linesParts.push(d.ellipsize);
            $('dLines').textContent = linesParts.length ? linesParts.join(' / ') : '-';
            // 对齐/方向
            let alignParts = [];
            if (d.gravity) alignParts.push('gravity:' + d.gravity);
            if (d.textAlign) alignParts.push('align:' + d.textAlign);
            if (d.textDir) alignParts.push('dir:' + d.textDir);
            $('dAlign').textContent = alignParts.length ? alignParts.join(' | ') : '-';
            // Padding
            if (d.pl || d.pr || d.pt || d.pb) {{
                $('dPadding').textContent = '上' + d.pt + ' 右' + d.pr + ' 下' + d.pb + ' 左' + d.pl + ' (px)';
            }} else {{
                $('dPadding').textContent = '-';
            }}
            // Margin
            if (d.ml || d.mr || d.mt || d.mb) {{
                $('dMargin').textContent = '上' + d.mt + ' 右' + d.mr + ' 下' + d.mb + ' 左' + d.ml + ' (px)';
            }} else {{
                $('dMargin').textContent = '-';
            }}
            // 背景
            const bgEl = $('dBackground');
            if (d.bgShape) {{
                let bgParts = [];
                if (d.bgShape.solid_color) {{
                    bgParts.push('<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:' 
                        + d.bgShape.solid_color + ';vertical-align:middle;margin-right:4px;border:1px solid #555;"></span>' 
                        + d.bgShape.solid_color);
                }}
                if (d.bgShape.corner_radius_dp != null) bgParts.push('圆角:' + d.bgShape.corner_radius_dp + 'dp');
                if (d.bgShape.stroke_color) bgParts.push('描边:' + d.bgShape.stroke_color);
                if (d.bgShape.stroke_width_dp != null) bgParts.push('(' + d.bgShape.stroke_width_dp + 'dp)');
                if (d.bgShape.gradient) {{
                    const g = d.bgShape.gradient;
                    bgParts.push('渐变:' + (g.startColor || '?') + '→' + (g.endColor || '?'));
                }}
                bgEl.innerHTML = bgParts.join(' ') || (d.background || '-');
            }} else if (d.background) {{
                bgEl.textContent = d.background;
            }} else {{
                bgEl.textContent = '-';
            }}
            // 透明度
            $('dAlpha').textContent = d.alpha != null ? d.alpha : '-';
            // Elevation
            $('dElevation').textContent = d.elevation != null ? d.elevation + 'dp' : '-';
            // 可见性
            $('dVisibility').textContent = d.visibility || '-';
            // 图像
            let imgParts = [];
            if (d.src) imgParts.push(d.src);
            if (d.scaleType) imgParts.push('scaleType:' + d.scaleType);
            $('dImage').textContent = imgParts.length ? imgParts.join(' | ') : '-';
            // ConstraintLayout 约束
            const constraintEl = $('dConstraints');
            if (d.constraints && Object.keys(d.constraints).length) {{
                let cHtml = '<div style="font-size:11px;max-height:80px;overflow-y:auto;">';
                for (const [k, v] of Object.entries(d.constraints)) {{
                    cHtml += '<div style="color:#aaa;">' + k.replace('layout_constraint','') + ': <span style="color:#ffd700">' + v + '</span></div>';
                }}
                cHtml += '</div>';
                constraintEl.innerHTML = cHtml;
            }} else {{
                constraintEl.textContent = '-';
            }}
            detail.classList.add('active');
        }}

        // --- 内容区域框（去掉 padding 的真实内容区域）---
        const contentBox = document.createElement('div');
        contentBox.className = 'content-box';
        overlay.appendChild(contentBox);

        // --- 高亮 ---
        let highlighted = null;
        function highlight(index) {{
            if (highlighted) highlighted.classList.remove('highlighted');
            const box = overlay.querySelector(`.el-box[data-index="${{index}}"]`);
            if (box) {{ box.classList.add('highlighted'); highlighted = box; }}
            // 显示内容区域框
            const d = DATA.find(x => x.i == index);
            if (d && d.cb && (d.pl || d.pr || d.pt || d.pb)) {{
                contentBox.style.left = (d.cb.left * SCALE) + 'px';
                contentBox.style.top = (d.cb.top * SCALE) + 'px';
                contentBox.style.width = (d.cb.width * SCALE) + 'px';
                contentBox.style.height = (d.cb.height * SCALE) + 'px';
                contentBox.style.display = 'block';
            }} else {{
                contentBox.style.display = 'none';
            }}
            // 同步侧边栏
            listItems.forEach(li => li.classList.toggle('active', li.dataset.index == index));
        }}

        function selectElement(index) {{
            const d = DATA.find(x => x.i == index);
            if (!d) return;
            showDetail(d);
            highlight(index);
        }}

        // --- 点击截图区：找所有重叠元素，弹出选择菜单 ---
        container.addEventListener('click', function(ev) {{
            const rect = container.getBoundingClientRect();
            const cx = (ev.clientX - rect.left) / SCALE;
            const cy = (ev.clientY - rect.top) / SCALE;

            // 找出包含该点的所有元素（从小到大排序，面积小的优先）
            const hits = DATA.filter(d =>
                cx >= d.left && cx <= d.left + d.width &&
                cy >= d.top && cy <= d.top + d.height
            ).sort((a, b) => (a.width * a.height) - (b.width * b.height));

            if (hits.length === 0) {{ picker.style.display = 'none'; return; }}
            if (hits.length === 1) {{
                picker.style.display = 'none';
                selectElement(hits[0].i);
                return;
            }}

            // 多个重叠 → 弹出选择菜单
            let ph = `<div class="picker-title">${{hits.length}} 个重叠元素（点击选择）</div>`;
            hits.forEach(d => {{
                const label = d.text || d.desc || d.resIdShort || d.clsShort;
                let tags = '';
                if (d.clickable) tags += '<span class="pi-tag clickable">可点击</span>';
                if (d.scrollable) tags += '<span class="pi-tag scrollable">可滚动</span>';
                ph += `<div class="picker-item" data-index="${{d.i}}">
                    <span class="pi-label">${{label}}</span>${{tags}}
                    <div class="pi-meta">${{d.clsShort}} | ${{d.width}}×${{d.height}}</div></div>`;
            }});
            picker.innerHTML = ph;
            picker.style.display = 'block';
            picker.style.left = Math.min(ev.clientX + 4, window.innerWidth - 300) + 'px';
            picker.style.top = Math.min(ev.clientY + 4, window.innerHeight - 380) + 'px';

            picker.querySelectorAll('.picker-item').forEach(pi => {{
                pi.addEventListener('click', function(e) {{
                    e.stopPropagation();
                    selectElement(parseInt(this.dataset.index));
                    picker.style.display = 'none';
                }});
            }});
        }});

        // 点击别处关闭菜单
        document.addEventListener('click', function(ev) {{
            if (!picker.contains(ev.target) && !container.contains(ev.target)) {{
                picker.style.display = 'none';
            }}
        }});

        // --- 侧边栏列表点击 ---
        listItems.forEach(li => {{
            li.addEventListener('click', function() {{
                selectElement(parseInt(this.dataset.index));
                // 滚动截图中的高亮框到可见
                const box = overlay.querySelector(`.el-box[data-index="${{this.dataset.index}}"]`);
                if (box) box.scrollIntoView({{ behavior: 'smooth', block: 'nearest' }});
            }});
        }});

        // --- 搜索过滤（配合叶子节点过滤） ---
        searchBox.addEventListener('input', function() {{
            updateVisibility();
        }});
    }})();
    </script>
</body>
</html>
'''
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"✓ HTML 预览已保存到: {output_path}")


def generate_report(elements: list[dict], output_path: Path, screenshot_path: Path):
    """生成布局报告 Markdown（含全量 APK 属性）"""
    
    # 筛选有 bounds 的元素，按从上到下、从左到右排序
    with_bounds = [e for e in elements if e["bounds"]]
    sorted_elements = sorted(with_bounds, key=lambda e: (e["bounds"]["top"], e["bounds"]["left"]))
    
    report = []
    report.append("# UI 布局分析报告")
    report.append(f"\n生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    if screenshot_path.exists():
        report.append(f"![截图]({screenshot_path.name})\n")
    
    # --- 统计概览 ---
    report.append("## 元素概览\n")
    report.append(f"- 总元素数: {len(elements)}")
    report.append(f"- 有 bounds 的元素: {len(with_bounds)}")
    report.append(f"- 有文本的元素: {len([e for e in with_bounds if e['text']])}")
    report.append(f"- 可点击元素: {len([e for e in with_bounds if e['clickable']])}")
    report.append(f"- 可滚动元素: {len([e for e in with_bounds if e['scrollable']])}")
    has_apk = sum(1 for e in with_bounds if e.get("apk_props"))
    if has_apk:
        report.append(f"- APK 样式匹配: {has_apk}")
    
    # --- 元素总览表（精简列）---
    report.append("\n## 元素总览\n")
    report.append("| # | 类型 | 文本 | Resource ID | 位置 | 尺寸 | 字号 | 字体 | 颜色 | 属性 |")
    report.append("|---|------|------|-------------|------|------|------|------|------|------|")
    
    for idx, e in enumerate(sorted_elements, 1):
        b = e["bounds"]
        class_name = e["class"].split(".")[-1] if e["class"] else "?"
        
        label = e["text"] or e["content_desc"] or "-"
        if len(label) > 30:
            label = label[:30] + "..."
        label = label.replace("|", "\\|")
        
        res_id = e["resource_id"].split("/")[-1] if e["resource_id"] else "-"
        
        # 字号
        ts_px = e.get("text_size_px")
        ts_dp = e.get("text_size_dp")
        if ts_dp and ts_px:
            ts_str = f"{ts_dp:.0f}dp"
        elif ts_px:
            ts_str = f"{ts_px:.0f}px"
        else:
            ts_str = "-"
        
        # 字体
        ff = e.get("font_family", "")
        fw = e.get("text_font_weight", "")
        font_str = ff if ff else "-"
        if fw:
            font_str = f"{ff or '-'} w{fw}"
        
        # 颜色
        tc = e.get("text_color")
        tc_str = tc if tc else "-"
        
        # 属性标签
        flags = []
        if e["clickable"]:
            flags.append("C")
        if e["scrollable"]:
            flags.append("S")
        if e.get("is_leaf"):
            flags.append("L")
        if e.get("alpha") is not None and e.get("alpha") != 1.0:
            flags.append(f"α{e['alpha']}")
        if e.get("visibility") and e["visibility"] != "visible":
            flags.append(e["visibility"])
        flags_str = " ".join(flags) if flags else "-"
        
        report.append(
            f"| {idx} | {class_name} | {label} | {res_id} "
            f"| ({b['left']},{b['top']}) | {b['width']}×{b['height']} "
            f"| {ts_str} | {font_str} | {tc_str} | {flags_str} |"
        )
    
    # --- 详细属性（仅有 APK 数据的元素）---
    enriched = [e for e in sorted_elements if e.get("apk_props")]
    if enriched:
        report.append("\n## 元素详细属性\n")
        report.append("以下列出从 APK 资源中提取到样式信息的元素：\n")
        
        for e in enriched:
            b = e["bounds"]
            class_name = e["class"].split(".")[-1] if e["class"] else "?"
            res_id = e["resource_id"].split("/")[-1] if e["resource_id"] else ""
            label = e["text"] or e["content_desc"] or "(无文本)"
            if len(label) > 50:
                label = label[:50] + "..."
            
            report.append(f"### {class_name} `{res_id}`")
            report.append(f"- **文本**: {label}")
            report.append(f"- **位置**: ({b['left']}, {b['top']}) {b['width']}×{b['height']}")
            
            # 文本样式
            text_attrs = []
            ts_dp = e.get("text_size_dp")
            ts_px = e.get("text_size_px")
            if ts_dp:
                text_attrs.append(f"字号: {ts_dp:.1f}dp ({ts_px:.0f}px)" if ts_px else f"字号: {ts_dp:.1f}dp")
            tc = e.get("text_color")
            if tc:
                text_attrs.append(f"颜色: {tc}")
            ff = e.get("font_family")
            if ff:
                text_attrs.append(f"字体: {ff}")
            fw = e.get("text_font_weight")
            if fw:
                text_attrs.append(f"字重: {fw}")
            lsm = e.get("line_spacing_multiplier")
            if lsm is not None:
                text_attrs.append(f"行距倍数: {lsm}")
            ls = e.get("letter_spacing")
            if ls is not None:
                text_attrs.append(f"字距: {ls}em")
            ml = e.get("max_lines")
            if ml is not None:
                text_attrs.append(f"最大行数: {ml}")
            ell = e.get("ellipsize")
            if ell:
                text_attrs.append(f"省略: {ell}")
            gv = e.get("gravity")
            if gv:
                text_attrs.append(f"gravity: {gv}")
            ffs = e.get("font_feature_settings")
            if ffs:
                text_attrs.append(f"fontFeature: {ffs}")
            ifp = e.get("include_font_padding")
            if ifp is not None:
                text_attrs.append(f"includeFontPadding: {ifp}")
            if text_attrs:
                report.append(f"- **文本样式**: {' | '.join(text_attrs)}")
            
            # 间距
            pl, pr = e.get("padding_left", 0), e.get("padding_right", 0)
            pt, pb = e.get("padding_top", 0), e.get("padding_bottom", 0)
            if pl or pr or pt or pb:
                report.append(f"- **Padding** (px): 上{pt} 右{pr} 下{pb} 左{pl}")
            mgl, mgr = e.get("margin_left", 0), e.get("margin_right", 0)
            mgt, mgb = e.get("margin_top", 0), e.get("margin_bottom", 0)
            if mgl or mgr or mgt or mgb:
                report.append(f"- **Margin** (px): 上{mgt} 右{mgr} 下{mgb} 左{mgl}")
            
            # Layout 尺寸
            lw = e.get("layout_width")
            lh = e.get("layout_height")
            if lw is not None or lh is not None:
                lw_str = f"{lw}dp" if isinstance(lw, (int, float)) else str(lw or "-")
                lh_str = f"{lh}dp" if isinstance(lh, (int, float)) else str(lh or "-")
                dim_parts = [f"宽: {lw_str}", f"高: {lh_str}"]
                for k, label_str in [("min_width_dp", "最小宽"), ("max_width_dp", "最大宽"),
                                     ("min_height_dp", "最小高"), ("max_height_dp", "最大高")]:
                    val = e.get(k)
                    if val is not None:
                        dim_parts.append(f"{label_str}: {val}dp")
                report.append(f"- **布局尺寸**: {' | '.join(dim_parts)}")
            
            # 视觉属性
            vis_parts = []
            alpha_val = e.get("alpha")
            if alpha_val is not None:
                vis_parts.append(f"alpha: {alpha_val}")
            elev = e.get("elevation_dp")
            if elev is not None:
                vis_parts.append(f"elevation: {elev}dp")
            vis = e.get("visibility")
            if vis:
                vis_parts.append(f"visibility: {vis}")
            rot = e.get("rotation")
            if rot is not None:
                vis_parts.append(f"rotation: {rot}°")
            if vis_parts:
                report.append(f"- **视觉**: {' | '.join(vis_parts)}")
            
            # 背景
            bg_shape = e.get("bg_shape")
            if bg_shape:
                bg_parts = []
                if bg_shape.get("solid_color"):
                    bg_parts.append(f"填充: {bg_shape['solid_color']}")
                cr = bg_shape.get("corner_radius_dp")
                if cr is not None:
                    bg_parts.append(f"圆角: {cr}dp")
                if bg_shape.get("stroke_color"):
                    sw = bg_shape.get("stroke_width_dp", "?")
                    bg_parts.append(f"描边: {bg_shape['stroke_color']} {sw}dp")
                grad = bg_shape.get("gradient")
                if grad:
                    bg_parts.append(f"渐变: {grad.get('startColor', '?')} → {grad.get('endColor', '?')}")
                if bg_parts:
                    report.append(f"- **背景**: {' | '.join(bg_parts)}")
            elif e.get("background"):
                report.append(f"- **背景**: {e['background']}")
            
            # 图像
            src = e.get("src")
            st = e.get("scale_type")
            if src or st:
                img_parts = []
                if src:
                    img_parts.append(f"src: {src}")
                if st:
                    img_parts.append(f"scaleType: {st}")
                report.append(f"- **图像**: {' | '.join(img_parts)}")
            
            # ConstraintLayout
            constraints = e.get("constraints")
            if constraints:
                c_parts = [f"{k.replace('layout_constraint', '')}: {v}" for k, v in constraints.items()]
                report.append(f"- **约束**: {' | '.join(c_parts[:6])}")
                if len(c_parts) > 6:
                    report.append(f"  {' | '.join(c_parts[6:])}")
            
            report.append("")
    
    # --- 布局层级树 ---
    report.append("\n## 布局层级\n")
    report.append("```")
    
    for e in elements:
        indent = "  " * e["depth"]
        class_name = e["class"].split(".")[-1] if e["class"] else "?"
        info_parts = []
        if e["text"]:
            text_preview = e["text"][:25]
            if len(e["text"]) > 25:
                text_preview += "..."
            info_parts.append(f'text="{text_preview}"')
        elif e["content_desc"]:
            desc_preview = e["content_desc"][:25]
            if len(e["content_desc"]) > 25:
                desc_preview += "..."
            info_parts.append(f'desc="{desc_preview}"')
        if e["resource_id"]:
            info_parts.append(f'id="{e["resource_id"].split("/")[-1]}"')
        if e["bounds"]:
            b = e["bounds"]
            info_parts.append(f'{b["width"]}×{b["height"]} @({b["left"]},{b["top"]})')
        if e["clickable"]:
            info_parts.append("[clickable]")
        if e["scrollable"]:
            info_parts.append("[scrollable]")
        # 追加 APK 样式摘要
        if e.get("font_family"):
            info_parts.append(f'font={e["font_family"]}')
        ts_dp = e.get("text_size_dp")
        if ts_dp:
            info_parts.append(f'{ts_dp:.0f}dp')
        fw = e.get("text_font_weight")
        if fw:
            info_parts.append(f'w{fw}')
        info = " ".join(info_parts)
        report.append(f"{indent}{class_name} {info}")
    
    report.append("```")
    
    report.append("\n## 注意事项\n")
    report.append("- **滚动内容**: uiautomator 只能导出当前可见的元素，滚动区域内不可见的内容不会被导出")
    report.append("- **APK 属性**: 从反编译资源提取的属性基于静态 XML，运行时可能被代码动态修改")
    report.append("- **颜色获取**: 要获取精确的颜色值，可以使用截图在图像编辑软件中取色")
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report))
    
    print(f"✓ 布局报告已保存到: {output_path}")


def generate_scroll_index(output_path: Path, items: list[dict]):
    """[Legacy] 生成滚动模式索引页（旧滚动模式使用）"""
    rows = []
    for item in items:
        index = item["index"]
        html_name = item["html"].name
        png_name = item["screenshot"].name
        rows.append(f"""
        <div class="item">
            <a href="{html_name}">第 {index + 1} 次</a>
            <div class="thumb">
                <img src="{png_name}" />
            </div>
        </div>
        """)

    html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI 布局预览（滚动索引）</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
            padding: 20px;
        }}
        h1 {{
            margin-bottom: 15px;
            color: #0ff;
        }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 16px;
        }}
        .item {{
            background: #2a2a4a;
            padding: 12px;
            border-radius: 10px;
        }}
        .item a {{
            color: #0ff;
            text-decoration: none;
        }}
        .thumb {{
            margin-top: 10px;
            background: #111;
            border-radius: 8px;
            overflow: hidden;
        }}
        .thumb img {{
            width: 100%;
            height: auto;
            display: block;
        }}
    </style>
</head>
<body>
    <h1>UI 布局预览（滚动索引）</h1>
    <div class="grid">
        {''.join(rows)}
    </div>
</body>
</html>
"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"✓ HTML 索引已保存到: {output_path}")


def has_scrollable(tree: dict) -> bool:
    """检查 UI 树中是否存在 scrollable=true 的节点"""
    if tree.get("scrollable"):
        return True
    for child in tree.get("children", []):
        if has_scrollable(child):
            return True
    return False


def capture_screen(output_dir: Path, name: str, serial: str | None = None) -> dict:
    """
    采集单个屏幕：截图 + UI dump + 树形解析。
    返回 {"screenshot": Path, "xml": Path, "tree": dict, "elements": list}
    """
    screenshot_path = output_dir / f"{name}.png"
    xml_path = output_dir / f"{name}_ui.xml"

    dump_ui_xml(xml_path, serial=serial)
    take_screenshot(screenshot_path, serial=serial)

    tree = parse_ui_xml_tree(xml_path)
    elements = parse_ui_xml(xml_path)

    return {
        "screenshot": screenshot_path,
        "xml": xml_path,
        "tree": tree,
        "elements": elements,
    }


def capture_scroll_segments(output_dir: Path, screen_size: tuple[int, int],
                            serial: str | None = None,
                            max_segments: int = 5) -> list[dict]:
    """
    对当前屏幕进行滚动分段采集。
    每次短距离滚动后截图 + dump，分段保存。
    返回 segment 列表，每项为 {"screenshot": Path, "xml": Path, "tree": dict, "elements": list}。

    注意: segment_0 是初始位置（调用前应已采集为 screenshot），
    所以这里从 segment_0 开始（初始位置），然后滚动采集后续段。
    """
    segments_dir = output_dir / "scroll_segments"
    segments_dir.mkdir(exist_ok=True)

    segments: list[dict] = []

    # segment_0: 当前位置（初始）
    seg0 = capture_screen(segments_dir, "segment_0", serial=serial)
    segments.append(seg0)

    prev_elements_key: set = set()
    for e in seg0["elements"]:
        if e["text"] or e["resource_id"]:
            prev_elements_key.add((e["class"], e["resource_id"], e["text"][:60]))

    for i in range(1, max_segments):
        print(f"  滚动 → 分段 {i}...")
        scroll_down(screen_size, serial=serial)
        time.sleep(1.0)

        seg = capture_screen(segments_dir, f"segment_{i}", serial=serial)

        # 检查是否到底：与上一段内容几乎相同
        cur_keys: set = set()
        for e in seg["elements"]:
            if e["text"] or e["resource_id"]:
                cur_keys.add((e["class"], e["resource_id"], e["text"][:60]))

        # 如果有意义的元素 90% 以上相同 → 判定为到底
        if prev_elements_key and cur_keys:
            overlap = len(prev_elements_key & cur_keys)
            total = max(len(prev_elements_key), len(cur_keys))
            if total > 0 and overlap / total > 0.9:
                print(f"  检测到滚动停止（元素重复率 {overlap/total:.0%}），停止采集")
                # 删除这个重复段的文件
                seg["screenshot"].unlink(missing_ok=True)
                seg["xml"].unlink(missing_ok=True)
                break

        segments.append(seg)
        prev_elements_key = cur_keys

    # 滚动回顶部
    print("  滚动回顶部...")
    for _ in range(max_segments + 1):
        scroll_up(screen_size, serial=serial)
        time.sleep(0.3)

    return segments


def merge_scroll_elements(segments: list[dict]) -> list[dict]:
    """
    合并多个滚动分段的元素列表，去重并按 top 排序。
    对于重叠区域中重复出现的元素（相同 class+id+text），只保留第一次出现的。
    返回去重后的完整元素列表，每个元素带有 segment_index 标注。
    """
    seen: set = set()
    merged: list[dict] = []

    for seg_idx, seg in enumerate(segments):
        for e in seg["elements"]:
            if not e.get("bounds"):
                continue
            # 生成去重 key
            content_key = (e["class"], e["resource_id"], (e["text"] or "")[:60])
            b = e["bounds"]
            # 用 resource_id+text+class+height 作为内容特征，
            # 不用 top 因为不同 segment 中 top 不同
            dedup_key = (content_key, b.get("width", 0) // 8, b.get("height", 0) // 8)

            if dedup_key not in seen:
                seen.add(dedup_key)
                e_copy = dict(e)
                e_copy["segment_index"] = seg_idx
                merged.append(e_copy)

    # 按 segment_index 和 top 排序
    merged.sort(key=lambda e: (e.get("segment_index", 0),
                                e["bounds"]["top"] if e.get("bounds") else 0))
    return merged


def merge_scroll_trees(segments: list[dict]) -> dict | None:
    """
    合并多个滚动分段的树形结构中 scrollable 节点的子元素。
    找到树中 scrollable=true 的节点，将各 segment 中对应容器的子元素合并。
    返回合并后的树（基于 segment_0 的树结构）。
    """
    if not segments or not segments[0].get("tree"):
        return None

    base_tree = json.loads(json.dumps(segments[0]["tree"]))  # deep copy

    def find_scroll_nodes(node: dict) -> list[dict]:
        """找到所有 scrollable=true 的节点"""
        results = []
        if node.get("scrollable"):
            results.append(node)
        for child in node.get("children", []):
            results.extend(find_scroll_nodes(child))
        return results

    def collect_leaf_texts(node: dict) -> set[str]:
        """收集节点下所有叶子的文本特征"""
        texts: set[str] = set()
        if not node.get("children"):
            key = f"{node.get('tag', '')}:{node.get('id', '')}:{(node.get('text', '') or '')[:40]}"
            if key.strip(":"):
                texts.add(key)
        for child in node.get("children", []):
            texts.update(collect_leaf_texts(child))
        return texts

    # 找到 base_tree 中的 scrollable 节点
    scroll_nodes = find_scroll_nodes(base_tree)
    if not scroll_nodes:
        return base_tree

    # 对于每个 scrollable 节点，从后续 segment 中收集新的子元素
    for scroll_node in scroll_nodes:
        existing_texts = collect_leaf_texts(scroll_node)

        for seg in segments[1:]:
            seg_tree = seg.get("tree")
            if not seg_tree:
                continue
            seg_scroll_nodes = find_scroll_nodes(seg_tree)
            for seg_sn in seg_scroll_nodes:
                # 匹配：同 id 或同 tag
                if (seg_sn.get("id") == scroll_node.get("id") and seg_sn.get("id")) \
                        or seg_sn.get("tag_full") == scroll_node.get("tag_full"):
                    # 将该 segment 的 scroll 容器的子元素中，
                    # 不在 existing_texts 中的追加到 base
                    for child in seg_sn.get("children", []):
                        child_texts = collect_leaf_texts(child)
                        if not child_texts.issubset(existing_texts):
                            scroll_node.setdefault("children", []).append(child)
                            existing_texts.update(child_texts)
                    break

    return base_tree


# ===========================================================================
# Legacy: 截图拼接相关函数（保留向后兼容，新流程不再使用）
# ===========================================================================

def find_scroll_offset(img1_path: Path, img2_path: Path) -> int:
    """
    检测两张连续截图之间的滚动偏移量（像素）。
    使用降采样灰度图 + SAD (Sum of Absolute Differences) 进行模糊匹配，
    可应对渐变背景、动画等导致的像素微差。

    策略：
    1. 将两张图转灰度、降采样到 1/4 分辨率（加速比较）
    2. 从 img1 取多个参考条带，在 img2 中找最小 SAD 位置
    3. 多参考位置交叉验证，取共识偏移
    """
    img1 = Image.open(img1_path).convert("L")  # 灰度
    img2 = Image.open(img2_path).convert("L")
    w, h = img1.size

    # 降采样到 1/4 分辨率
    DS = 4
    sw, sh = w // DS, h // DS
    s1 = img1.resize((sw, sh), Image.BILINEAR)
    s2 = img2.resize((sw, sh), Image.BILINEAR)

    d1 = s1.tobytes()  # sh * sw bytes (灰度 1 byte/pixel)
    d2 = s2.tobytes()

    # 快速检查：两张图是否几乎相同（已滚到底部）
    # 采样中间 20% 区域，避免状态栏时间/网速干扰
    sample_y = int(sh * 0.4)
    sample_h = int(sh * 0.25)
    sample1 = d1[sample_y * sw:(sample_y + sample_h) * sw]
    sample2 = d2[sample_y * sw:(sample_y + sample_h) * sw]
    sample_sad = sum(abs(a - b) for a, b in zip(sample1, sample2))
    sample_avg = sample_sad / len(sample1)
    if sample_avg < 2.0:
        print(f"  截图几乎相同 (diff={sample_avg:.2f})，已到底部")
        return 0

    STRIP_H = 12  # 条带高度（降采样后像素行数）

    def strip_sad(ref_y_ds: int, y2_ds: int) -> int:
        """计算 img1[ref_y] 与 img2[y2] 位置两个条带的 SAD"""
        a = d1[ref_y_ds * sw:(ref_y_ds + STRIP_H) * sw]
        b = d2[y2_ds * sw:(y2_ds + STRIP_H) * sw]
        return sum(abs(x - y) for x, y in zip(a, b))

    # 跳过状态栏区域（顶部 ~5%）
    margin_top = max(int(sh * 0.05), 3)
    strip_pixels = STRIP_H * sw

    # 在多个参考位置进行搜索
    candidates: list[tuple[float, int, float]] = []  # (avg_diff, scroll_ds, ref_pct)

    for ref_pct in (0.45, 0.55, 0.65, 0.75):
        ref_y = int(sh * ref_pct)
        if ref_y + STRIP_H >= sh:
            continue

        # 搜索范围：img2 中从 margin_top 到 ref_y 附近
        # （搜索的 y2 应小于 ref_y，因为向下滚动后内容上移）
        search_end = min(ref_y + int(sh * 0.15), sh - STRIP_H)

        best_y2, best_sad_val = -1, float('inf')
        for y2 in range(margin_top, search_end):
            val = strip_sad(ref_y, y2)
            if val < best_sad_val:
                best_sad_val = val
                best_y2 = y2

        if best_y2 >= 0:
            avg_diff = best_sad_val / strip_pixels
            scroll_ds = ref_y - best_y2
            if scroll_ds > 0:
                candidates.append((avg_diff, scroll_ds, ref_pct))

    # 按匹配质量排序（avg_diff 越小越好）
    candidates.sort(key=lambda x: x[0])

    if candidates:
        # 筛选质量合格的候选 (avg_diff < 15)
        good = [c for c in candidates if c[0] < 15]

        if len(good) >= 2:
            # 多个参考点共识：取中位数偏移
            offsets_ds = [c[1] for c in good]
            median_ds = sorted(offsets_ds)[len(offsets_ds) // 2]
            # 统计与中位数一致的候选（±3 行容差）
            agreeing = [o for o in offsets_ds if abs(o - median_ds) <= 3]
            if len(agreeing) >= 2:
                avg_offset_ds = int(round(sum(agreeing) / len(agreeing)))
                scroll_px = avg_offset_ds * DS
                print(f"  匹配: {len(agreeing)}/{len(good)} 参考点共识, "
                      f"avg_diff={good[0][0]:.1f}")
                return scroll_px

        if good:
            # 单点匹配
            best = good[0]
            scroll_px = best[1] * DS
            print(f"  匹配: avg_diff={best[0]:.1f}")
            return scroll_px

        # 质量不太好但有结果
        if candidates[0][0] < 25:
            best = candidates[0]
            scroll_px = best[1] * DS
            print(f"  ⚠ 模糊匹配: avg_diff={best[0]:.1f}")
            return scroll_px

    # 最终回退
    print(f"  ⚠ 无法检测滚动偏移，使用估算值")
    return int(h * 0.25)


def stitch_screenshots(screenshot_paths: list[Path], output_path: Path) -> tuple[list[int], int]:
    """
    将连续滚动截图拼接成一张完整长图。
    返回 (cumulative_offsets, total_height)。
    cumulative_offsets[i] = 第 i 张截图顶部在拼接图中的 Y 坐标。
    """
    if not screenshot_paths:
        return [], 0

    if len(screenshot_paths) == 1:
        shutil.copy2(screenshot_paths[0], output_path)
        img = Image.open(screenshot_paths[0])
        return [0], img.size[1]

    print("正在计算滚动偏移并拼接截图...")

    # 计算相邻截图间的滚动偏移
    scroll_offsets = []
    valid_count = len(screenshot_paths)
    for i in range(1, len(screenshot_paths)):
        offset = find_scroll_offset(screenshot_paths[i - 1], screenshot_paths[i])
        scroll_offsets.append(offset)
        print(f"  截图 {i - 1} → {i}: 滚动 {offset}px")
        # 偏移过小说明已滚到底部
        if offset < 50:
            print(f"  检测到滚动停止（偏移仅 {offset}px），截断后续截图")
            valid_count = i + 1
            break

    # 截断到有效范围
    screenshot_paths = screenshot_paths[:valid_count]
    scroll_offsets = scroll_offsets[:valid_count - 1]

    # 累计偏移
    cumulative = [0]
    for off in scroll_offsets:
        cumulative.append(cumulative[-1] + off)

    # 加载第一张图获取尺寸
    first = Image.open(screenshot_paths[0]).convert("RGB")
    w, h = first.size
    total_h = cumulative[-1] + h

    # 创建拼接画布（从后往前粘贴，先到的截图在重叠区优先显示）
    stitched = Image.new("RGB", (w, total_h))
    for i in range(len(screenshot_paths) - 1, -1, -1):
        img = Image.open(screenshot_paths[i]).convert("RGB")
        stitched.paste(img, (0, cumulative[i]))

    stitched.save(output_path, "PNG", optimize=True)
    print(f"✓ 拼接截图已保存: {output_path} ({w}×{total_h})")

    return cumulative, total_h


def adjust_elements_global(dump_items: list[dict], cumulative_offsets: list[int],
                           screen_height: int) -> list[dict]:
    """
    将各次 dump 的元素坐标从视口坐标转换为全局坐标，并去重。
    """
    all_global = []

    for item in dump_items:
        idx = item["index"]
        if idx >= len(cumulative_offsets):
            break
        offset_y = cumulative_offsets[idx]

        for e in item["elements"]:
            ge = dict(e)  # 浅拷贝
            ge["scroll_index"] = idx

            if e["bounds"]:
                b = e["bounds"]
                ge["bounds"] = {
                    "left": b["left"],
                    "top": b["top"] + offset_y,
                    "right": b["right"],
                    "bottom": b["bottom"] + offset_y,
                    "width": b["width"],
                    "height": b["height"],
                    "center_x": b["center_x"],
                    "center_y": b["center_y"] + offset_y,
                }
                ge["bounds_raw"] = (
                    f'[{b["left"]},{b["top"] + offset_y}]'
                    f'[{b["right"]},{b["bottom"] + offset_y}]'
                )

            all_global.append(ge)

    # 去重：相同类名 + 相同 resource_id + 相同文本 + 相近全局位置 → 视为同一元素
    seen: set = set()
    unique: list[dict] = []
    for e in all_global:
        if not e.get("bounds"):
            unique.append(e)
            continue
        b = e["bounds"]
        # 位置取整到 8px 粒度，容忍渲染微差
        pos_key = (b["left"] // 8, b["top"] // 8, b["width"] // 8, b["height"] // 8)
        content_key = (e["class"], e["resource_id"], (e["text"] or "")[:60])
        key = (content_key, pos_key)
        if key not in seen:
            seen.add(key)
            unique.append(e)

    print(f"✓ 全局元素: {len(all_global)} → 去重后 {len(unique)}")
    return unique


def _add_dp_bounds_to_tree(node: dict, density: float) -> None:
    """在树节点中增加 bounds_dp（以 dp 为单位的坐标），递归修改原树。"""
    if not density:
        return
    b = node.get("bounds")
    if b:
        node["bounds_dp"] = {
            "left": round(b["left"] / density, 1),
            "top": round(b["top"] / density, 1),
            "right": round(b["right"] / density, 1),
            "bottom": round(b["bottom"] / density, 1),
            "width": round(b["width"] / density, 1),
            "height": round(b["height"] / density, 1),
        }
    for child in node.get("children", []):
        _add_dp_bounds_to_tree(child, density)


def _android_color_to_css(color: str) -> str:
    """将 Android 色值转为 CSS 色值。

    支持格式:
        #AARRGGBB (Android ARGB) → #rrggbb 或 rgba(r,g,b,a)
        #RRGGBB → 原样返回
        @android:color/white → #ffffff
        @color/xxx → 原样返回（无法解析）
    """
    if not color:
        return ""
    # 常见 Android 系统颜色引用
    _ANDROID_COLORS = {
        "@android:color/white": "#ffffff",
        "@android:color/black": "#000000",
        "@android:color/transparent": "transparent",
    }
    if color in _ANDROID_COLORS:
        return _ANDROID_COLORS[color]
    if color.startswith("@"):
        return color  # 无法解析的引用，原样返回
    if not color.startswith("#"):
        return color
    hex_val = color[1:]
    # #AARRGGBB → 拆出 alpha
    if len(hex_val) == 8:
        alpha = int(hex_val[0:2], 16) / 255.0
        r, g, b = int(hex_val[2:4], 16), int(hex_val[4:6], 16), int(hex_val[6:8], 16)
        if alpha >= 0.99:
            return f"#{hex_val[2:]}"
        return f"rgba({r},{g},{b},{round(alpha, 2)})"
    return color  # #RGB / #RRGGBB，原样


def _estimate_font_size(node: dict) -> float | None:
    """当没有 APK text_size 信息时，根据文本内容和 bounds 推算字体大小 (dp)。

    策略:
    - CJK 字符近似正方形，宽度 ≈ fontSize
    - 拉丁/数字: fontSize ≈ height / 1.2 (默认行高比)
    """
    text = node.get("text", "")
    if not text:
        return None
    bdp = node.get("bounds_dp")
    if not bdp:
        return None
    h = bdp.get("height", 0)
    w = bdp.get("width", 0)
    if h <= 0:
        return None
    # 统计 CJK 字符数
    cjk_count = sum(1 for c in text if '\u4e00' <= c <= '\u9fff' or '\u3400' <= c <= '\u4dbf')
    if cjk_count > 0 and len(text) <= 6:
        return round(w / max(len(text), 1), 1)
    # 通用推算
    return round(h / 1.2, 1)


def _gravity_to_text_align(gravity: str) -> str:
    """Android gravity → CSS textAlign。"""
    if not gravity:
        return ""
    g = gravity.lower()
    if "center" in g:
        return "center"
    if "right" in g or "end" in g:
        return "right"
    if "left" in g or "start" in g:
        return "left"
    return ""


def _add_react_styles_to_tree(node: dict) -> None:
    """
    为树中每个节点增加 react_style 字段，包含可直接用于 React/CSS 的样式属性:

    文本节点:
        fontSize      — 来自 APK text_size_dp，或推算
        fontSize_estimated — 若为推算值则标记 true
        color         — CSS 格式色值
        fontWeight    — 字重
        textAlign     — 文本对齐
        letterSpacing — 字间距

    布局/容器节点:
        _childrenDirection — 子元素排列方向 ("row" | "column")
        _childrenGap       — 子元素平均间距 (dp)

    视觉属性:
        backgroundColor — CSS 格式色值
        opacity         — 透明度

    所有有 bounds_dp 的节点:
        top, left, width, height — 绝对定位参考 (dp = CSS px @1x)
    """
    bdp = node.get("bounds_dp")
    style: dict = {}

    # ── 定位 / 尺寸 ──
    if bdp:
        style["top"] = bdp["top"]
        style["left"] = bdp["left"]
        style["width"] = bdp["width"]
        style["height"] = bdp["height"]

    # ── 文本样式 ──
    if node.get("text_size_dp"):
        style["fontSize"] = node["text_size_dp"]
    elif node.get("text"):
        est = _estimate_font_size(node)
        if est:
            style["fontSize"] = est
            style["fontSize_estimated"] = True

    text_color = node.get("text_color", "")
    if text_color:
        style["color"] = _android_color_to_css(text_color)

    if node.get("font_weight"):
        style["fontWeight"] = node["font_weight"]

    if node.get("letter_spacing") is not None:
        style["letterSpacing"] = node["letter_spacing"]

    if node.get("gravity"):
        ta = _gravity_to_text_align(node["gravity"])
        if ta:
            style["textAlign"] = ta

    # ── 视觉属性 ──
    if node.get("bg_color"):
        style["backgroundColor"] = _android_color_to_css(node["bg_color"])

    bg_shape = node.get("bg_shape")
    if bg_shape:
        if bg_shape.get("corner_radius"):
            style["borderRadius"] = bg_shape["corner_radius"]
        if bg_shape.get("solid_color"):
            style["backgroundColor"] = _android_color_to_css(bg_shape["solid_color"])
        if bg_shape.get("stroke_color"):
            sw = bg_shape.get("stroke_width", 1)
            style["border"] = f"{sw}px solid {_android_color_to_css(bg_shape['stroke_color'])}"

    if node.get("alpha") is not None:
        style["opacity"] = node["alpha"]

    # ── Padding ──
    pad = node.get("padding")
    if pad:
        for side in ("top", "right", "bottom", "left"):
            val = pad.get(side)
            if val is not None and val != 0:
                style[f"padding{side.capitalize()}"] = val

    # ── Margin ──
    mar = node.get("margin")
    if mar:
        for side in ("top", "right", "bottom", "left"):
            val = mar.get(side)
            if val is not None and val != 0:
                style[f"margin{side.capitalize()}"] = val

    # ── 写入节点 ──
    if style:
        node["react_style"] = style

    # ── 子元素布局分析: 方向 & 间距 ──
    children = node.get("children", [])
    if len(children) >= 2:
        # 取前几个有 bounds 的子元素判断排列方向
        child_bounds = [c.get("bounds_dp") for c in children if c.get("bounds_dp")]
        if len(child_bounds) >= 2:
            cb0, cb1 = child_bounds[0], child_bounds[1]
            is_row = cb1.get("left", 0) >= cb0.get("right", 0) - 2
            is_col = cb1.get("top", 0) >= cb0.get("bottom", 0) - 2

            if is_row:
                # 水平排列 → 计算水平间距
                h_gaps = []
                for i in range(1, len(child_bounds)):
                    gap = round(child_bounds[i]["left"] - child_bounds[i - 1]["right"], 1)
                    if gap > 0:
                        h_gaps.append(gap)
                if h_gaps:
                    avg = round(sum(h_gaps) / len(h_gaps), 1)
                    node.setdefault("react_style", {})["_childrenDirection"] = "row"
                    node["react_style"]["_childrenGap"] = avg
            elif is_col:
                # 垂直排列 → 计算垂直间距
                v_gaps = []
                for i in range(1, len(child_bounds)):
                    gap = round(child_bounds[i]["top"] - child_bounds[i - 1]["bottom"], 1)
                    if gap > 0:
                        v_gaps.append(gap)
                if v_gaps:
                    avg = round(sum(v_gaps) / len(v_gaps), 1)
                    node.setdefault("react_style", {})["_childrenDirection"] = "column"
                    node["react_style"]["_childrenGap"] = avg

    # ── 递归子树 ──
    for child in children:
        _add_react_styles_to_tree(child)


def generate_element_tree_json(tree: dict, output_path: Path,
                               screen_size: tuple[int, int],
                               density: float = 3.0,
                               screenshot_name: str = "screenshot.png",
                               activity: str = "",
                               scroll_segments: list[dict] | None = None,
                               apk_res_dir: Path | None = None):
    """
    输出树形 JSON（AI 复刻友好格式）。

    tree: parse_ui_xml_tree() 输出的嵌套 dict
    scroll_segments: 如果有滚动分段，每个 segment 为
        {"screenshot": "segment_X.png", "tree": <dict>}
    apk_res_dir: 若提供，从反编译 res 解析 src/drawable_* 为位图并复制到 assets/drawables，写入 *_resolved
    """
    # 默认总是增加 dp 坐标，方便复刻（px 坐标仍然保留在 bounds 中）
    _add_dp_bounds_to_tree(tree, density)

    # 增加 react_style：可直接用于 React/CSS 的样式属性
    _add_react_styles_to_tree(tree)

    if apk_res_dir is not None and apk_res_dir.exists():
        assets_dir = output_path.parent / "assets" / "drawables"
        assets_dir.mkdir(parents=True, exist_ok=True)
        _write_drawables_readme(assets_dir)
        _resolve_and_copy_drawables_in_tree(tree, apk_res_dir, assets_dir)

    result: dict = {
        "screen": {
            "width": screen_size[0],
            "height": screen_size[1],
            "density": round(density, 3),
            "screenshot": screenshot_name,
        },
        "element_tree": tree,
    }
    if activity:
        result["screen"]["activity"] = activity
    if scroll_segments:
        result["scroll_segments"] = [
            {"screenshot": seg["screenshot"], "element_tree": seg.get("tree")}
            for seg in scroll_segments
        ]

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # 统计节点数
    def count_nodes(n: dict) -> int:
        c = 1
        for child in n.get("children", []):
            c += count_nodes(child)
        return c

    total = count_nodes(tree)
    print(f"✓ 树形 JSON 已保存: {output_path} ({total} 个节点)")


def generate_ai_json(elements: list[dict], output_path: Path, screen_size: tuple[int, int],
                     total_height: int, cumulative_offsets: list[int],
                     dump_items: list[dict], density: float = 3.0):
    """
    [Legacy] 生成 AI 复刻友好的 JSON 数据（平坦列表格式，旧滚动模式使用）。
    新流程请使用 generate_element_tree_json()。
    """
    result: dict = {
        "screen": {
            "width": screen_size[0],
            "height": screen_size[1],
            "density": round(density, 3),
            "total_scroll_height": total_height,
        },
        "scroll_sections": [],
        "elements": [],
    }

    # 分段信息
    for i, item in enumerate(dump_items):
        if i >= len(cumulative_offsets):
            break
        result["scroll_sections"].append({
            "index": i,
            "y_offset": cumulative_offsets[i],
            "screenshot": item["screenshot"].name,
            "element_count": len(item["elements"]),
        })

    # 元素列表（按 top 排序）
    sorted_elems = sorted(
        [e for e in elements if e.get("bounds")],
        key=lambda e: (e["bounds"]["top"], e["bounds"]["left"])
    )
    for e in sorted_elems:
        b = e["bounds"]
        elem: dict = {
            "class": e["class"].split(".")[-1] if e["class"] else "",
            "class_full": e["class"],
            "resource_id": e["resource_id"],
            "text": e["text"],
            "content_desc": e["content_desc"],
            "bounds": {
                "left": b["left"], "top": b["top"],
                "right": b["right"], "bottom": b["bottom"],
                "width": b["width"], "height": b["height"],
            },
            "clickable": e["clickable"],
            "scrollable": e["scrollable"],
            "is_leaf": e["is_leaf"],
        }

        # 文本样式
        if e.get("text_size_dp") is not None:
            elem["text_size_dp"] = e["text_size_dp"]
        if e.get("text_size_px") is not None:
            elem["text_size_px"] = round(e["text_size_px"])
        if e.get("text_color"):
            elem["text_color"] = e["text_color"]
        if e.get("font_family"):
            elem["font_family"] = e["font_family"]
        if e.get("text_font_weight"):
            elem["font_weight"] = e["text_font_weight"]
        if e.get("gravity"):
            elem["gravity"] = e["gravity"]
        if e.get("letter_spacing") is not None:
            elem["letter_spacing"] = e["letter_spacing"]
        if e.get("line_spacing_multiplier") is not None:
            elem["line_spacing_multiplier"] = e["line_spacing_multiplier"]
        if e.get("max_lines") is not None:
            elem["max_lines"] = e["max_lines"]
        if e.get("ellipsize"):
            elem["ellipsize"] = e["ellipsize"]

        # 间距
        padding = {}
        for side in ("left", "right", "top", "bottom"):
            val = e.get(f"padding_{side}", 0)
            if val:
                padding[side] = val
        if padding:
            elem["padding_px"] = padding

        margin = {}
        for side in ("left", "right", "top", "bottom"):
            val = e.get(f"margin_{side}", 0)
            if val:
                margin[side] = val
        if margin:
            elem["margin_px"] = margin

        # 背景
        if e.get("bg_shape"):
            elem["background"] = e["bg_shape"]
        elif e.get("background"):
            elem["background_ref"] = e["background"]

        # 视觉属性
        if e.get("alpha") is not None and e.get("alpha") != 1.0:
            elem["alpha"] = e["alpha"]
        if e.get("visibility") and e["visibility"] != "visible":
            elem["visibility"] = e["visibility"]
        if e.get("elevation_dp") is not None:
            elem["elevation_dp"] = e["elevation_dp"]

        # 布局尺寸
        if e.get("layout_width") is not None:
            elem["layout_width"] = e["layout_width"]
        if e.get("layout_height") is not None:
            elem["layout_height"] = e["layout_height"]

        # ConstraintLayout 约束
        if e.get("constraints"):
            elem["constraints"] = e["constraints"]

        result["elements"].append(elem)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"✓ AI JSON 已保存: {output_path} ({len(result['elements'])} 个元素)")


def run_session(session_name: str, serial: str | None, apk_res: str | None,
                scroll_segments: int, no_simplify: bool):
    """
    交互式多屏采集会话。
    用户在手机上导航 → 按 Enter 采集当前屏幕 → 按 q 结束。
    """
    ok, serial = check_device(serial)
    if not ok:
        sys.exit(1)

    screen_size = get_screen_size(serial=serial)
    density = get_display_density(serial=serial)
    print(f"✓ 屏幕尺寸: {screen_size[0]}x{screen_size[1]}")
    print(f"✓ 屏幕密度: {density:.2f}x ({int(density * 160)}dpi)")

    # 解析 APK 资源（如果提供）
    apk_data: dict | None = None
    if apk_res:
        apk_res_path = Path(apk_res)
        if apk_res_path.exists():
            print(f"正在解析 APK 资源: {apk_res_path}")
            apk_dimens = parse_apk_dimens(apk_res_path)
            apk_colors = parse_apk_colors(apk_res_path)
            apk_strings = parse_apk_strings(apk_res_path)
            apk_styles = parse_apk_styles(apk_res_path, apk_dimens, apk_colors)
            apk_drawables = parse_drawable_shapes(apk_res_path, apk_dimens, apk_colors)
            apk_layouts = parse_apk_layouts(apk_res_path, apk_dimens, apk_colors,
                                            strings=apk_strings, styles=apk_styles)
            apk_data = {
                "layouts": apk_layouts,
                "drawables": apk_drawables,
                "dimens": apk_dimens,
                "colors": apk_colors,
            }
            print(f"  layout 元素: {len(apk_layouts)}, drawable shapes: {len(apk_drawables)}")
        else:
            print(f"警告: APK 资源目录不存在: {apk_res_path}")

    # 创建 session 目录
    session_dir = OUTPUT_DIR / f"session_{session_name}"
    session_dir.mkdir(parents=True, exist_ok=True)

    screens: list[dict] = []
    screen_counter = 0

    print()
    print("=" * 50)
    print(f"交互式采集会话: {session_name}")
    print("=" * 50)
    print()
    print("操作说明:")
    print("  Enter     → 采集当前屏幕")
    print("  s + Enter → 采集当前屏幕（含滚动分段）")
    print("  q + Enter → 结束会话")
    print()

    while True:
        # 获取当前前台 Activity
        activity = get_focused_activity(serial=serial) or ""
        short_activity = activity.split("/")[-1] if activity else "(未知)"
        print(f"当前页面: {short_activity}")
        print(f"  输入操作 [Enter=采集 / s=采集+滚动 / q=结束]: ", end="", flush=True)

        try:
            user_input = input().strip().lower()
        except (EOFError, KeyboardInterrupt):
            user_input = "q"

        if user_input == "q":
            break

        do_scroll = user_input == "s"
        screen_counter += 1
        screen_id = f"screen_{screen_counter:02d}"

        # 让用户命名屏幕（可选）
        print(f"  屏幕名称 (直接 Enter 使用 '{screen_id}'): ", end="", flush=True)
        try:
            name_input = input().strip()
        except (EOFError, KeyboardInterrupt):
            name_input = ""
        if name_input:
            screen_id = f"screen_{screen_counter:02d}_{name_input}"

        screen_dir = session_dir / screen_id
        screen_dir.mkdir(exist_ok=True)

        print(f"\n--- 采集 {screen_id} ---")

        # 1. 主截图 + UI dump
        main_capture = capture_screen(screen_dir, "screenshot", serial=serial)
        tree = main_capture["tree"]
        elements = main_capture["elements"]

        if not tree:
            print("  ⚠ UI dump 失败，跳过此屏幕")
            continue

        # 2. APK 样式丰富
        if apk_data:
            enrich_tree_with_apk(tree, apk_data["layouts"], apk_data["drawables"],
                                 apk_data["dimens"], apk_data["colors"], density)
            # 也丰富 flat elements（供 HTML 预览）
            enrich_from_apk(elements, Path(apk_res), density)

        # 3. 滚动分段（仅在用户显式请求时才滚动）
        scroll_segs: list[dict] | None = None
        merged_content: list[dict] | None = None
        has_scroll = has_scrollable(tree)

        # 只有在用户输入 s（do_scroll=True）且确实存在可滚动区域时才执行滚动分段采集
        if do_scroll and has_scroll:
            print(f"  开始滚动分段采集 (最多 {scroll_segments} 段)...")
            scroll_segs = capture_scroll_segments(
                screen_dir, screen_size, serial=serial,
                max_segments=scroll_segments
            )
            # 合并滚动内容
            merged_content = merge_scroll_elements(scroll_segs)
            # 合并滚动树
            merged_tree = merge_scroll_trees(scroll_segs)
            if merged_tree:
                if apk_data:
                    enrich_tree_with_apk(merged_tree, apk_data["layouts"],
                                         apk_data["drawables"], apk_data["dimens"],
                                         apk_data["colors"], density)
                # 用合并树替换主树
                tree = merged_tree

        # 4. 简化树
        if not no_simplify:
            tree = simplify_tree(tree)

        # 5. 输出树形 JSON
        seg_info = None
        if scroll_segs:
            seg_info = [
                {"screenshot": seg["screenshot"].name, "tree": seg.get("tree")}
                for seg in scroll_segs
            ]

        generate_element_tree_json(
            tree,
            screen_dir / "elements_tree.json",
            screen_size,
            density=density,
            screenshot_name="screenshot.png",
            activity=activity,
            scroll_segments=seg_info,
            apk_res_dir=Path(apk_res) if apk_res else None,
        )

        # 5b. Output Actionable Elements (Action Space)
        actionable = extract_actionable_elements(tree)
        with open(screen_dir / "actionable_elements.json", "w", encoding="utf-8") as f:
            json.dump(actionable, f, indent=2, ensure_ascii=False)

        # 6. 保存合并滚动内容（如果有）
        if merged_content:
            # 为合并内容增加 dp 坐标
            if density:
                for e in merged_content:
                    b = e.get("bounds")
                    if b:
                        e["bounds_dp"] = {
                            "left": round(b["left"] / density, 1),
                            "top": round(b["top"] / density, 1),
                            "right": round(b["right"] / density, 1),
                            "bottom": round(b["bottom"] / density, 1),
                            "width": round(b["width"] / density, 1),
                            "height": round(b["height"] / density, 1),
                        }

            merged_path = screen_dir / "merged_scroll_content.json"
            with open(merged_path, "w", encoding="utf-8") as f:
                json.dump(merged_content, f, ensure_ascii=False, indent=2)
            print(f"✓ 合并滚动内容: {merged_path} ({len(merged_content)} 个元素)")

        # 7. 生成 HTML 预览
        html_path = screen_dir / "layout_preview.html"
        generate_html(elements, html_path, main_capture["screenshot"], screen_size)

        # 记录屏幕信息
        screens.append({
            "id": screen_id,
            "activity": activity,
            "has_scroll": has_scroll,
            "scroll_segments": len(scroll_segs) if scroll_segs else 0,
            "screenshot": f"{screen_id}/screenshot.png",
        })

        print(f"✓ 屏幕 {screen_id} 采集完成")
        print()

    # 生成 manifest.json
    manifest = {
        "app": screens[0]["activity"].split("/")[0] if screens else "",
        "session_name": session_name,
        "timestamp": datetime.now().isoformat(),
        "device": {
            "width": screen_size[0],
            "height": screen_size[1],
            "density": round(density, 3),
        },
        "screens": screens,
    }
    manifest_path = session_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print()
    print("=" * 50)
    print(f"会话完成! 共采集 {len(screens)} 个屏幕")
    print(f"输出目录: {session_dir}")
    print()
    print("文件说明:")
    print(f"  manifest.json          → 会话元数据")
    for s in screens:
        print(f"  {s['id']}/")
        print(f"    elements_tree.json   → 树形 UI 层级（AI 复刻用）")
        print(f"    screenshot.png       → 截图")
        if s["scroll_segments"] > 0:
            print(f"    scroll_segments/     → {s['scroll_segments']} 个滚动分段")
    print("=" * 50)


def main():
    parser = argparse.ArgumentParser(description="Android UI Layout Dumper")
    parser.add_argument("--session", type=str, default=None, metavar="NAME",
                        help="交互式多屏采集模式，指定会话名称 (如: weather_app)")
    parser.add_argument("--scroll", action="store_true", help="[旧模式] 滚动并多次 dump")
    parser.add_argument("--scroll-count", type=int, default=5, help="滚动次数 (默认: 5)")
    parser.add_argument("--scroll-segments", type=int, default=5,
                        help="每屏最大滚动分段数 (默认: 5，用于 --session)")
    parser.add_argument("--no-simplify", action="store_true",
                        help="不简化 UI 树（保留所有中间包装层）")
    parser.add_argument("--serial", type=str, default=None, help="指定设备序列号 (adb -s)")
    parser.add_argument("--apk-res", type=str, default=None,
                        help="反编译 APK 的 res 目录路径（如 Weather_decompiled/res），用于提取字号/padding/颜色")
    parser.add_argument("--html", dest="html", action="store_true", help="生成可视化 HTML 文件")
    parser.add_argument("--no-html", dest="html", action="store_false", help="不生成 HTML 文件")
    parser.add_argument("--report", dest="report", action="store_true", help="生成 Markdown 报告")
    parser.add_argument("--no-report", dest="report", action="store_false", help="不生成 Markdown 报告")
    parser.set_defaults(html=True, report=True)
    args = parser.parse_args()

    # --- Session 模式 ---
    if args.session:
        print("=" * 50)
        print("Android UI Layout Dumper - 交互式会话模式")
        print("=" * 50)
        print()
        run_session(
            session_name=args.session,
            serial=args.serial,
            apk_res=args.apk_res,
            scroll_segments=args.scroll_segments,
            no_simplify=args.no_simplify,
        )
        return
    
    # --- 传统模式（单次 / 滚动）---
    print("=" * 50)
    print("Android UI Layout Dumper")
    print("=" * 50)
    print()
    
    # 检查设备
    ok, serial = check_device(args.serial)
    if not ok:
        sys.exit(1)
    
    # 获取屏幕尺寸
    screen_size = get_screen_size(serial=serial)
    print(f"✓ 屏幕尺寸: {screen_size[0]}x{screen_size[1]}")
    print()
    
    # 创建输出目录
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = OUTPUT_DIR / timestamp
    output_dir.mkdir(parents=True, exist_ok=True)
    
    all_elements = []
    stitched_path: Path | None = None
    cumulative_offsets: list[int] = []
    total_scroll_height: int = 0
    
    dump_items = []
    if args.scroll:
        # 滚动模式：多次 dump
        print(f"滚动模式: 将进行 {args.scroll_count + 1} 次 dump")
        print()
        
        for i in range(args.scroll_count + 1):
            xml_path = output_dir / f"ui_dump_{i}.xml"
            screenshot_path = output_dir / f"screenshot_{i}.png"
            
            print(f"--- 第 {i + 1} 次 dump ---")
            dump_ui_xml(xml_path, serial=serial)
            take_screenshot(screenshot_path, serial=serial)
            
            elements = parse_ui_xml(xml_path)
            dump_items.append({
                "index": i,
                "xml": xml_path,
                "screenshot": screenshot_path,
                "elements": elements
            })
            
            if i < args.scroll_count:
                print("滚动中...")
                scroll_down(screen_size, serial=serial)
                time.sleep(1.0)  # 等待滚动动画完全停止
        
        # 滚动回顶部
        print("滚动回顶部...")
        for _ in range(args.scroll_count + 1):
            scroll_up(screen_size, serial=serial)
            time.sleep(0.3)
        
        print()
        
        # 拼接截图并计算全局坐标
        if HAS_PIL:
            screenshot_paths_list = [item["screenshot"] for item in dump_items]
            stitched_path = output_dir / "stitched_full.png"
            cumulative_offsets, total_scroll_height = stitch_screenshots(
                screenshot_paths_list, stitched_path
            )
            all_elements = adjust_elements_global(
                dump_items, cumulative_offsets, screen_size[1]
            )
        else:
            print("⚠ 未安装 Pillow，跳过截图拼接（pip install Pillow）")
            # 回退：简单合并去重
            for item in dump_items:
                all_elements.extend(item["elements"])
            seen: set = set()
            unique: list[dict] = []
            for e in all_elements:
                key = (e["resource_id"], e["class"], e["text"], e["content_desc"])
                if key not in seen:
                    seen.add(key)
                    unique.append(e)
            all_elements = unique
        
    else:
        # 单次 dump
        xml_path = output_dir / "ui_dump.xml"
        if not dump_ui_xml(xml_path, serial=serial):
            sys.exit(1)
        
        screenshot_path = output_dir / "screenshot.png"
        take_screenshot(screenshot_path, serial=serial)
        
        all_elements = parse_ui_xml(xml_path)
    
    print()
    
    if all_elements:
        # 获取屏幕密度（统一获取，后续报告和 JSON 都需要）
        density = get_display_density(serial=serial)
        print(f"✓ 屏幕密度: {density:.2f}x ({int(density * 160)}dpi)")
        
        # 获取详细属性（字号、padding、颜色）
        if args.apk_res:
            apk_res_path = Path(args.apk_res)
            if apk_res_path.exists():
                enrich_from_apk(all_elements, apk_res_path, density)
            else:
                print(f"警告: APK 资源目录不存在: {apk_res_path}")
        else:
            # fallback: 尝试 dumpsys（可能超时）
            dumpsys_views = dump_view_properties(serial=serial, output_dir=output_dir)
            if dumpsys_views:
                enrich_elements(all_elements, dumpsys_views)
        
        # 生成报告
        print("正在生成报告...")
        
        # 报告截图：优先使用拼接长图
        if args.scroll and stitched_path and stitched_path.exists():
            report_screenshot = stitched_path
        else:
            report_screenshot = output_dir / ("screenshot_0.png" if args.scroll else "screenshot.png")
        
        if args.report:
            report_path = output_dir / "layout_report.md"
            generate_report(all_elements, report_path, report_screenshot)
        
        if args.html:
            if args.scroll:
                # 各帧分段预览（使用原始视口坐标）
                scroll_items = []
                for item in dump_items:
                    html_path = output_dir / f"layout_preview_{item['index']}.html"
                    generate_html(item["elements"], html_path, item["screenshot"], screen_size)
                    scroll_items.append({
                        "index": item["index"],
                        "html": html_path,
                        "screenshot": item["screenshot"]
                    })
                index_path = output_dir / "layout_preview.html"
                generate_scroll_index(index_path, scroll_items)
                # 拼接全局视图 HTML（使用全局坐标 + 拼接长图）
                if stitched_path and stitched_path.exists():
                    stitched_html_path = output_dir / "layout_stitched.html"
                    generate_html(all_elements, stitched_html_path, stitched_path, screen_size)
                    print(f"✓ 拼接全局视图: {stitched_html_path}")
            else:
                html_path = output_dir / "layout_preview.html"
                generate_html(all_elements, html_path, report_screenshot, screen_size)
        
        # 生成 AI 复刻 JSON（仅滚动模式且有拼接图时，旧格式）
        if args.scroll and stitched_path and stitched_path.exists():
            json_path = output_dir / "layout_global.json"
            generate_ai_json(
                all_elements, json_path, screen_size,
                total_scroll_height, cumulative_offsets,
                dump_items, density=density
            )
        
        # 生成树形 JSON（新格式，所有模式）
        xml_for_tree = output_dir / ("ui_dump_0.xml" if args.scroll else "ui_dump.xml")
        if xml_for_tree.exists():
            ui_tree = parse_ui_xml_tree(xml_for_tree)
            if ui_tree:
                if args.apk_res:
                    apk_res_path = Path(args.apk_res)
                    if apk_res_path.exists():
                        apk_dimens_t = parse_apk_dimens(apk_res_path)
                        apk_colors_t = parse_apk_colors(apk_res_path)
                        apk_drawables_t = parse_drawable_shapes(apk_res_path, apk_dimens_t, apk_colors_t)
                        apk_strings_t = parse_apk_strings(apk_res_path)
                        apk_styles_t = parse_apk_styles(apk_res_path, apk_dimens_t, apk_colors_t)
                        apk_layouts_t = parse_apk_layouts(apk_res_path, apk_dimens_t, apk_colors_t,
                                                          strings=apk_strings_t, styles=apk_styles_t)
                        enrich_tree_with_apk(ui_tree, apk_layouts_t, apk_drawables_t,
                                             apk_dimens_t, apk_colors_t, density)
                if not args.no_simplify:
                    ui_tree = simplify_tree(ui_tree)
                screenshot_name = "screenshot_0.png" if args.scroll else "screenshot.png"
                apk_res_path = Path(args.apk_res) if args.apk_res else None
                generate_element_tree_json(
                    ui_tree, output_dir / "elements_tree.json",
                    screen_size=screen_size, density=density,
                    screenshot_name=screenshot_name,
                    apk_res_dir=apk_res_path if (apk_res_path and apk_res_path.exists()) else None,
                )
                
                # Actionable Elements
                actionable = extract_actionable_elements(ui_tree)
                with open(output_dir / "actionable_elements.json", "w", encoding="utf-8") as f:
                    json.dump(actionable, f, indent=2, ensure_ascii=False)

    
    print()
    print("=" * 50)
    print(f"完成! 输出目录: {output_dir}")
    print()
    print("提示:")
    if args.html:
        print(f"  - 打开 {output_dir / 'layout_preview.html'} 查看可视化布局")
    if args.report:
        print(f"  - 查看 {output_dir / 'layout_report.md'} 获取详细信息")
    tree_json = output_dir / "elements_tree.json"
    if tree_json.exists():
        print(f"  - 查看 elements_tree.json 树形 UI 层级（AI 复刻推荐）")
    if stitched_path and stitched_path.exists():
        print(f"  - 查看 {stitched_path.name} 完整拼接长截图")
        stitched_html = output_dir / "layout_stitched.html"
        if stitched_html.exists():
            print(f"  - 打开 {stitched_html.name} 查看拼接全局视图（全局坐标）")
    print("=" * 50)


if __name__ == "__main__":
    main()
