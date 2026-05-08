"""
bench_env/layout_utils.py
共享布局解析和归一化工具库，供两个 MCP 服务器使用。

提供:
  - parse_adb_elements():  ADB uiautomator XML → 统一元素列表
  - normalize_sim_elements(): 模拟器 DOM 元素 → 统一元素列表

统一元素格式:
  {
    "tag": str,           # Android 类短名 / HTML tag
    "id": str,            # resource-id 短名 / DOM id
    "text": str,          # 可见文本
    "content_desc": str,  # 无障碍描述（ADB 端有，模拟器端为空）
    "clickable": bool,
    "scrollable": bool,
    "bounds": { "x": float, "y": float, "width": float, "height": float }
  }

所有坐标归一化到 360×800 CSS 像素视口。
"""

import xml.etree.ElementTree as ET


# ── ADB XML 解析（适配自 scripts/dump_ui_layout.py） ──

def _parse_bounds(bounds_str: str) -> dict | None:
    """解析 bounds 字符串 '[left,top][right,bottom]'"""
    try:
        parts = bounds_str.replace("][", ",").replace("[", "").replace("]", "").split(",")
        left, top, right, bottom = map(int, parts)
        return {
            "left": left, "top": top,
            "right": right, "bottom": bottom,
            "width": right - left,
            "height": bottom - top,
        }
    except Exception:
        return None


def _build_node(xml_node: ET.Element) -> dict:
    """将 XML Element 转换为 dict 节点（含 children）。"""
    attrib = xml_node.attrib
    cls = attrib.get("class", "")
    rid = attrib.get("resource-id", "")
    bounds_raw = attrib.get("bounds", "")
    bounds = _parse_bounds(bounds_raw) if bounds_raw else None

    node: dict = {
        "tag": cls.split(".")[-1] if cls else "",
        "id": rid.split("/")[-1] if rid else "",
        "text": attrib.get("text", ""),
        "content_desc": attrib.get("content-desc", ""),
        "clickable": attrib.get("clickable", "false") == "true",
        "scrollable": attrib.get("scrollable", "false") == "true",
        "bounds": bounds,
    }

    children = [_build_node(child) for child in xml_node]
    if children:
        node["children"] = children

    return node


def _simplify_tree(node: dict) -> dict:
    """
    折叠无意义的中间包装层。
    规则：节点无 id/text/content_desc、不可交互、仅一个子节点 → 用子节点替换。
    """
    if "children" in node:
        node["children"] = [_simplify_tree(c) for c in node["children"]]

    children = node.get("children", [])
    if (len(children) == 1
            and not node.get("id")
            and not node.get("text")
            and not node.get("content_desc")
            and not node.get("clickable")
            and not node.get("scrollable")):
        return children[0]

    return node


def _add_dp_bounds(node: dict, density: float) -> None:
    """在节点中增加 bounds_dp（以 dp 为单位），递归修改原树。"""
    if not density:
        return
    b = node.get("bounds")
    if b:
        node["bounds_dp"] = {
            "left": round(b["left"] / density, 1),
            "top": round(b["top"] / density, 1),
            "width": round(b["width"] / density, 1),
            "height": round(b["height"] / density, 1),
        }
    for child in node.get("children", []):
        _add_dp_bounds(child, density)


def _extract_flat_adb(
    node: dict,
    target_w: int, target_h: int,
    sx: float, sy: float,
) -> list[dict]:
    """递归提取扁平元素列表（统一格式）。"""
    elements: list[dict] = []

    def _walk(n: dict):
        bdp = n.get("bounds_dp")
        if not bdp:
            for child in n.get("children", []):
                _walk(child)
            return

        x = bdp["left"] * sx
        y = bdp["top"] * sy
        w = bdp["width"] * sx
        h = bdp["height"] * sy

        # 跳过全屏容器（宽度占满 + 高度超过 80%）且无文本
        if w >= target_w - 5 and h >= target_h * 0.8 and not n.get("text"):
            for child in n.get("children", []):
                _walk(child)
            return

        # 跳过极小元素
        if w < 2 or h < 2:
            for child in n.get("children", []):
                _walk(child)
            return

        text = n.get("text") or n.get("content_desc") or ""
        elements.append({
            "tag": n.get("tag", ""),
            "id": n.get("id", ""),
            "text": text,
            "content_desc": n.get("content_desc", ""),
            "clickable": n.get("clickable", False),
            "scrollable": n.get("scrollable", False),
            "bounds": {
                "x": round(x, 1), "y": round(y, 1),
                "width": round(w, 1), "height": round(h, 1),
            },
        })

        for child in n.get("children", []):
            _walk(child)

    _walk(node)
    return elements


def parse_adb_elements(
    xml_content: str,
    density: float,
    screen_w_px: int,
    screen_h_px: int,
    target_w: int = 360,
    target_h: int = 800,
) -> list[dict]:
    """
    从 uiautomator dump 的 XML 字符串解析出归一化元素列表。

    参数:
      xml_content:  XML 字符串（adb shell cat /sdcard/ui_dump.xml 的输出）
      density:      屏幕密度系数（DPI / 160）
      screen_w_px:  屏幕宽度（物理像素）
      screen_h_px:  屏幕高度（物理像素）
      target_w:     目标视口宽度（默认 360）
      target_h:     目标视口高度（默认 800）

    返回:
      统一格式的元素列表
    """
    root = ET.fromstring(xml_content)
    tree = _build_node(root)
    tree = _simplify_tree(tree)
    _add_dp_bounds(tree, density)

    # 计算缩放因子：真机 dp → 目标视口
    src_w_dp = round(screen_w_px / density, 1) if density else float(target_w)
    src_h_dp = round(screen_h_px / density, 1) if density else float(target_h)
    sx = target_w / src_w_dp if src_w_dp else 1.0
    sy = target_h / src_h_dp if src_h_dp else 1.0

    return _extract_flat_adb(tree, target_w, target_h, sx, sy)


# ── 模拟器元素归一化 ──

# SVG 内部图形元素（噪声），但保留 <svg> 本身（它代表一个图标）
_SVG_INTERNALS = frozenset({
    "path", "line", "rect", "circle", "ellipse", "polygon",
    "polyline", "g", "defs", "clippath", "use",
    "lineargradient", "radialgradient", "stop", "mask",
})

# HTML 结构标签（永远跳过）
_STRUCTURAL_TAGS = frozenset({
    "html", "body", "head", "script", "style", "link", "meta",
})


def normalize_sim_elements(
    raw_elements: list[dict],
    viewport_w: int = 360,
    viewport_h: int = 800,
) -> list[dict]:
    """
    将模拟器 get_elements 返回的原始元素列表归一化为统一格式。

    过滤规则:
      1. 跳过 HTML 结构标签（html/body/head/script 等）
      2. 跳过 SVG 内部图形元素（path/circle/g 等），但保留 <svg>（代表图标）
      3. 跳过极小元素（<2px）
      4. 跳过完全不在视口内的屏幕外元素
      5. 跳过超高滚动容器（高度 > 视口高度）
      6. 跳过大面积结构容器（宽度占满且高度 ≥ 40% 视口）
      7. 跳过文本超长的中型容器（累积子元素 textContent 的特征）
    """
    elements: list[dict] = []

    for el in raw_elements:
        tag = (el.get("tag") or "").lower()

        # 规则 1: HTML 结构标签
        if tag in _STRUCTURAL_TAGS:
            continue

        # 规则 2: SVG 内部图形元素
        if tag in _SVG_INTERNALS:
            continue

        rect = el.get("rect") or {}
        x = rect.get("x", 0)
        y = rect.get("y", 0)
        w = rect.get("width", 0)
        h = rect.get("height", 0)

        # 规则 3: 极小元素
        if w < 2 or h < 2:
            continue

        # 规则 4: 完全不在视口内的屏幕外元素
        if y + h <= 0 or y >= viewport_h or x + w <= 0 or x >= viewport_w:
            continue

        # 规则 4b: 主体在视口上方（可见部分不足 20%，如通知面板）
        if y < 0 and (y + h) < h * 0.2:
            continue

        # 规则 5: 超高滚动容器（高度超过视口）
        if h > viewport_h:
            continue

        # 规则 6: 大面积结构容器（宽度占满 + 高度 ≥ 40% 视口）
        if w >= viewport_w - 5 and h >= viewport_h * 0.4:
            continue

        text = (el.get("text") or "").strip()

        # 规则 7: 中型容器累积了子元素文本
        #   textContent 会拼接所有后代文本，当文本长度远超元素合理容量时，
        #   说明这是一个父容器而非叶子内容元素。
        if len(text) > 80 and w * h > 5000:
            continue

        elements.append({
            "tag": tag,
            "id": el.get("id", ""),
            "text": text,
            "content_desc": "",
            "clickable": False,
            "scrollable": False,
            "bounds": {
                "x": round(x, 1), "y": round(y, 1),
                "width": round(w, 1), "height": round(h, 1),
            },
        })

    return elements
