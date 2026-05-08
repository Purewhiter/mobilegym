#!/usr/bin/env python3
"""
Generate Web Mock from UI Dump
根据 elements_tree.json 自动生成一个绝对定位的网页，把 dump 的布局「机械地」搬到 HTML 里。

使用方法:

  # 针对某个 screen 目录（例如 session_weather/screen_01）
  python scripts/generate_web_mock.py ui_dumps/session_weather/screen_01

会在该目录下生成:
  - web_mock.html  : 直接从 dump 映射出的网页（绝对定位，带辅助边框）

依赖:
  - Python 3.x
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def css_color(val: str) -> str:
    """
    将 Android 风格颜色 (#RRGGBB / #AARRGGBB) 转为 CSS 友好的颜色。
    非 # 开头的（如 @android:color/transparent）返回 None，调用方用默认色。
    """
    if not isinstance(val, str):
        return val
    if not val.startswith("#"):
        return ""  # 未解析的 ref，让调用方用默认
    if len(val) == 7:
        return val
    if len(val) == 9:
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


# Mock 默认文字色（未解析或透明时用），深色背景上的浅色字
DEFAULT_TEXT_COLOR = "#e5e7eb"
# Mock 最小字号（dp），避免 APK 多 layout 选到 1dp 等异常值导致文字看不见
MIN_TEXT_SIZE_DP = 10


def load_tree(screen_dir: Path, full_data: bool = False) -> tuple[dict, dict] | dict:
    """
    读取 elements_tree.json。
    full_data=False: 返回 (screen_meta, tree_root)
    full_data=True: 返回完整 data 字典（用于写回时保留 scroll_segments 等）
    """
    tree_path = screen_dir / "elements_tree.json"
    if not tree_path.exists():
        raise FileNotFoundError(f"未找到 elements_tree.json: {tree_path}")

    data = json.loads(tree_path.read_text(encoding="utf-8"))
    if full_data:
        return data
    screen = data.get("screen", {})
    tree = data.get("element_tree")
    if not tree:
        raise ValueError("elements_tree.json 中缺少 element_tree 字段")
    return screen, tree


def ensure_bounds_dp(node: dict, density: float) -> None:
    """确保每个节点都有 bounds_dp 字段，没有则按 density 从 px 计算。"""
    if "bounds_dp" not in node:
        b = node.get("bounds")
        if b and density:
            node["bounds_dp"] = {
                "left": round(b["left"] / density, 1),
                "top": round(b["top"] / density, 1),
                "right": round(b["right"] / density, 1),
                "bottom": round(b["bottom"] / density, 1),
                "width": round(b["width"] / density, 1),
                "height": round(b["height"] / density, 1),
            }
    for ch in node.get("children", []):
        ensure_bounds_dp(ch, density)


def flatten_nodes(node: dict) -> list[dict]:
    """
    把树拍平成一个列表，方便生成 HTML。
    我们主要关心：
      - 有文本的节点
      - 有背景颜色/shape 的节点
      - clickable 的节点
    """
    items: list[dict] = []

    def walk(n: dict):
        items.append(n)
        for c in n.get("children", []):
            walk(c)

    walk(node)
    return items


def _has_resolved_icon(n: dict) -> bool:
    """节点是否已解析出图标（来自反编译 res 的位图）。"""
    if n.get("src_resolved"):
        return True
    for pos in ("start", "end", "left", "right", "top", "bottom"):
        if n.get(f"drawable_{pos}_resolved"):
            return True
    return False


def node_priority(n: dict) -> int:
    """
    控制绘制顺序：背景在下，图标/文本在上。
    返回的数字越大越靠上。
    """
    has_text = bool(n.get("text"))
    has_icon = _has_resolved_icon(n)
    clickable = n.get("clickable", False)
    bg = n.get("bg_shape") or n.get("bg_color")
    # 背景 (0) < 普通容器 (1) < 图标/文本 (2) < 可点击 (3)
    if (has_text or has_icon) and clickable:
        return 3
    if has_text or has_icon:
        return 2
    if bg:
        return 0
    return 1


def generate_html(screen: dict, tree: dict, out_path: Path) -> None:
    """从树结构生成 HTML 文件。"""
    density = float(screen.get("density") or 3.0)
    width_px = int(screen.get("width") or 1080)
    height_px = int(screen.get("height") or 2400)
    # 映射到 dp 作为网页的视觉宽度
    width_dp = round(width_px / density)
    height_dp = round(height_px / density)

    ensure_bounds_dp(tree, density)
    nodes = flatten_nodes(tree)

    # 过滤掉太小/没意义的节点
    meaningful: list[dict] = []
    for n in nodes:
        b = n.get("bounds_dp") or {}
        w = b.get("width", 0)
        h = b.get("height", 0)
        if w < 4 or h < 4:
            continue
        # 根容器太大就只画一次
        meaningful.append(n)

    # 按优先级排序，保证文本在上层
    meaningful.sort(key=node_priority)

    # 生成每个元素对应的 div
    el_divs: list[str] = []
    for idx, n in enumerate(meaningful):
        b = n.get("bounds_dp") or {}
        left = b.get("left", 0)
        top = b.get("top", 0)
        w = b.get("width", 0)
        h = b.get("height", 0)

        styles = [
            f"left:{left}px",
            f"top:{top}px",
            f"width:{w}px",
            f"height:{h}px",
        ]

        # 基础半透明边框，方便肉眼看块
        styles.append("border:0.5px solid rgba(0,0,0,0.25)")
        styles.append("border-radius:4px")

        # 背景颜色
        bg_shape = n.get("bg_shape")
        bg_color = n.get("bg_color")
        if isinstance(bg_shape, dict) and bg_shape.get("solid_color"):
            styles.append(f"background:{css_color(bg_shape['solid_color'])}")
        elif isinstance(bg_shape, dict) and bg_shape.get("gradient"):
            # 简单用 startColor 当背景
            grad = bg_shape["gradient"]
            col = grad.get("startColor") or grad.get("endColor")
            if col:
                styles.append(f"background:{css_color(col)}")
        elif bg_color:
            styles.append(f"background:{css_color(bg_color)}")
        else:
            # 轻微白底，避免全透明看不出块
            styles.append("background:rgba(255,255,255,0.02)")

        # 文本样式（未解析颜色/过小字号用默认，避免 Settings 等用 @android:color/transparent 或 1dp 导致看不见）
        text = (n.get("text") or "").strip()
        raw_color = n.get("text_color")
        text_color = css_color(raw_color) if raw_color and raw_color.startswith("#") else (raw_color or "")
        if not text_color or (raw_color and not raw_color.startswith("#")) or "transparent" in (raw_color or "").lower():
            text_color = DEFAULT_TEXT_COLOR
        raw_size = n.get("text_size_dp") or n.get("text_size_px")
        try:
            text_size = float(raw_size) if raw_size is not None else None
        except (TypeError, ValueError):
            text_size = None
        if text_size is not None and text_size < MIN_TEXT_SIZE_DP:
            text_size = MIN_TEXT_SIZE_DP
        font_weight = n.get("font_weight")

        # 对齐：根据 gravity / text_alignment 来判断左右对齐，更接近原生布局
        gravity = (n.get("gravity") or "").lower()
        text_align_attr = (n.get("text_alignment") or "").lower()
        justify = "flex-start"
        text_align_css = "left"

        # 如果显式包含 center_horizontal 或 textAlignment=center，则居中
        if ("center_horizontal" in gravity or
                (("center" in gravity) and "left" not in gravity and "right" not in gravity) or
                text_align_attr == "center"):
            justify = "center"
            text_align_css = "center"
        # 如果包含 right / end，则右对齐
        elif ("right" in gravity or "end" in gravity or
              text_align_attr in ("viewend", "textend", "right")):
            justify = "flex-end"
            text_align_css = "right"

        text_styles: list[str] = [
            "display:flex",
            "align-items:center",
            f"justify-content:{justify}",
            f"text-align:{text_align_css}",
            "padding:2px",
            "overflow:hidden",
        ]
        if text_color:
            text_styles.append(f"color:{text_color}")
        if text_size is not None:
            # 直接用 dp 作为 px，整体由容器缩放
            text_styles.append(f"font-size:{text_size}px")
        if font_weight:
            text_styles.append(f"font-weight:{font_weight}")

        # 组合 style
        style_str = ";".join(styles)
        text_style_str = ";".join(text_styles)

        # 标签名 / id 仅作注释
        tag = n.get("tag") or ""
        rid = n.get("id") or ""
        meta = f"{tag}#{rid}" if rid else tag

        # 只显示前 30 字
        content = text.replace("<", "&lt;").replace(">", "&gt;")
        if len(content) > 30:
            content = content[:30] + "…"

        # 对应位置若已解析出图标（反编译 res 位图/矢量），直接渲染 <img>，title 标 drawable 名便于做 App 时替换
        icon_src = n.get("src_resolved")
        icon_ref = n.get("src")  # 原始 @drawable/xxx
        if not icon_src:
            for pos in ("start", "end", "left", "right", "top", "bottom"):
                icon_src = n.get(f"drawable_{pos}_resolved")
                icon_ref = n.get(f"drawable_{pos}")
                if icon_src:
                    break
        img_tag = ""
        if icon_src:
            title_attr = f' title="{icon_ref}"' if icon_ref else ""
            img_tag = (
                f'<img src="{icon_src}" alt=""{title_attr} '
                f'style="width:100%;height:100%;object-fit:contain;position:absolute;left:0;top:0;pointer-events:none" />'
            )

        el_html = (
            f'    <div class="el" style="{style_str}">'
            f'{img_tag}'
            f'<div class="el-inner" style="{text_style_str}">'
            f'{content or "&nbsp;"}'
            f'</div>'
            f'<!-- {meta} -->'
            f'</div>'
        )
        el_divs.append(el_html)

    # 生成完整 HTML
    title = screen.get("activity") or "UI Mock"
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>Web Mock - {title}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: #111827;
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 24px;
      color: #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC",
        "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    }}
    .phone {{
      position: relative;
      width: {width_dp}px;
      height: {height_dp}px;
      border-radius: 24px;
      background: #020617;
      box-shadow: 0 30px 80px rgba(0,0,0,0.8);
      overflow: hidden;
    }}
    .el {{
      position: absolute;
    }}
    .el-inner {{
      width: 100%;
      height: 100%;
      font-size: 11px;
      white-space: nowrap;        /* 避免中文被拆成竖排 */
      overflow: hidden;           /* 超出边界直接裁剪 */
      text-overflow: clip;
      line-height: 1.2;
    }}
    .debug-tip {{
      position: fixed;
      right: 16px;
      bottom: 12px;
      font-size: 11px;
      color: #9ca3af;
      background: rgba(15,23,42,0.9);
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(55,65,81,0.8);
    }}
  </style>
</head>
<body>
  <div class="phone">
{chr(10).join(el_divs)}
  </div>
  <div class="debug-tip">纯 dump 映射的绝对定位 mock，仅供结构检查</div>
</body>
</html>
"""

    out_path.write_text(html, encoding="utf-8")
    print(f"✓ 已生成网页: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate web mock from elements_tree.json")
    parser.add_argument(
        "screen_dir",
        type=str,
        help="屏幕目录路径，例如 ui_dumps/session_weather/screen_01",
    )
    parser.add_argument(
        "--apk-res",
        type=str,
        default=None,
        metavar="PATH",
        help="反编译 APK 的 res 目录；传入时会解析 src/drawable_* 为图标并写回 elements_tree.json，无需重新 dump",
    )
    args = parser.parse_args()

    screen_dir = Path(args.screen_dir).resolve()
    if not screen_dir.exists():
        raise SystemExit(f"screen_dir 不存在: {screen_dir}")

    if args.apk_res:
        apk_res_path = Path(args.apk_res).resolve()
        if not apk_res_path.exists():
            raise SystemExit(f"apk-res 目录不存在: {apk_res_path}")
        data = load_tree(screen_dir, full_data=True)
        tree = data.get("element_tree")
        if not tree:
            raise SystemExit("elements_tree.json 中缺少 element_tree 字段")
        from dump_ui_layout import _resolve_and_copy_drawables_in_tree, _write_drawables_readme
        assets_dir = screen_dir / "assets" / "drawables"
        assets_dir.mkdir(parents=True, exist_ok=True)
        _write_drawables_readme(assets_dir)
        _resolve_and_copy_drawables_in_tree(tree, apk_res_path, assets_dir)
        tree_path = screen_dir / "elements_tree.json"
        tree_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✓ 已解析图标并写回 {tree_path}")
        screen = data.get("screen", {})
    else:
        screen, tree = load_tree(screen_dir)

    out_html = screen_dir / "web_mock.html"
    generate_html(screen, tree, out_html)


if __name__ == "__main__":
    main()

