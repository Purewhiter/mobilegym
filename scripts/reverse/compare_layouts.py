#!/usr/bin/env python3
"""
compare_layouts.py - 真机 vs 模拟器 UI 一键对比

一条命令，实时从真机(ADB)和模拟器(MCP)同时采集数据，生成可交互的对比页面。

用法:
  python scripts/reverse/compare_layouts.py              # 全自动
  python scripts/reverse/compare_layouts.py -o out_dir   # 指定输出目录
  python scripts/reverse/compare_layouts.py --viewport 360x800

依赖:
  - adb (连接真机)
  - MCP 服务器运行中 (localhost:8766)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

# 复用 dump_ui_layout.py 的 ADB shell 命令
sys.path.insert(0, str(Path(__file__).parent))
from dump_ui_layout import (
    get_display_density,
    get_screen_size,
    take_screenshot,
    dump_ui_xml,
)

# 复用 layout_utils.py 的解析逻辑（与 MCP 工具完全一致）
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "bench_env"))
from layout_utils import parse_adb_elements


# ==================== ADB: 真机数据采集 ====================

def adb_screenshot(output: Path) -> bool:
    """截取真机屏幕。"""
    return take_screenshot(output)


def adb_get_density() -> float:
    return get_display_density()


def adb_dump_tree(output_dir: Path, density: float, target_w: int, target_h: int,
                  screen_size: tuple[int, int] | None = None) -> list[dict]:
    """
    通过 uiautomator dump 获取 UI 树，使用 layout_utils.parse_adb_elements 解析。
    与 adb_get_layout_elements MCP 工具使用完全相同的解析逻辑。
    """
    xml_path = output_dir / "ui_dump.xml"
    if not dump_ui_xml(xml_path):
        print("  ✗ UI dump 失败")
        return []

    xml_content = xml_path.read_text(encoding="utf-8")
    if screen_size is None:
        screen_size = get_screen_size()

    return parse_adb_elements(
        xml_content, density,
        screen_size[0], screen_size[1],
        target_w, target_h,
    )


# ==================== MCP: 模拟器数据采集 ====================

def _http_get(path: str, port: int = 8766, timeout: float = 60.0) -> dict | None:
    """向 MCP HTTP API 发送 GET 请求。"""
    import socket
    try:
        s = socket.create_connection(("localhost", port), timeout=timeout)
        s.sendall(f"GET {path} HTTP/1.0\r\nHost: localhost\r\n\r\n".encode())
        chunks = []
        while True:
            chunk = s.recv(65536)
            if not chunk:
                break
            chunks.append(chunk)
        s.close()
        body = b"".join(chunks).decode("utf-8", errors="replace").split("\r\n\r\n", 1)[-1]
        return json.loads(body)
    except Exception as e:
        print(f"  ⚠ MCP 请求失败 ({path}): {e}")
        return None


def mcp_ping() -> bool:
    data = _http_get("/ping")
    return bool(data and data.get("ok") and data.get("connected"))


def mcp_get_html(visible_only: bool = True) -> str:
    visible = "true" if visible_only else "false"
    data = _http_get(f"/get_layout_html?visible_only={visible}")
    if not data:
        return ""
    if not data.get("success"):
        print(f"  ⚠ get_layout_html 失败: {data.get('error', 'unknown')}")
        return ""
    return data.get("data", {}).get("html", "")


def mcp_get_elements() -> list[dict]:
    """获取模拟器归一化后的可见元素（使用 get_layout_elements 接口）。"""
    data = _http_get("/get_layout_elements?selector=*")
    if not data or not data.get("success"):
        return []
    return data.get("data", {}).get("elements", [])


# ==================== 工具函数 ====================

def strip_scripts(html: str) -> str:
    return re.sub(r"<script[\s\S]*?</script>", "", html, flags=re.IGNORECASE)


def bundle_sim_snapshot_assets(html: str, output_dir: Path) -> str:
    """
    将 sim_snapshot.html 中引用的本地资源（localhost:3000）下载到输出目录，
    并把 URL 改写为相对路径，达到类似「浏览器 Cmd+S 保存完整网页」的效果。

    仅处理同机 dev server 资源（http/https://localhost:3000），外部 URL 不动。
    """
    import urllib.request
    from urllib.parse import unquote, urlparse

    assets_dir = output_dir / "sim_snapshot_files"
    assets_dir.mkdir(parents=True, exist_ok=True)

    # 粗暴但有效：直接从 HTML 文本里抓 localhost:3000 的 URL（覆盖 img/src 与 CSS url(...)）
    urls = set(re.findall(r'https?://localhost:3000/[^\s"\'\)\>]+', html))
    if not urls:
        return html

    ok = 0
    for url in sorted(urls):
        try:
            parsed = urlparse(url)
            path = unquote(parsed.path or "")
            if not path or path == "/":
                continue

            local_path = assets_dir / path.lstrip("/")
            local_path.parent.mkdir(parents=True, exist_ok=True)

            # 下载并写入
            with urllib.request.urlopen(url, timeout=15) as resp:
                data = resp.read()
            local_path.write_bytes(data)

            # 改写引用为相对路径（保持用 /，避免 Windows 反斜杠）
            rel = f"sim_snapshot_files/{path.lstrip('/')}"
            html = html.replace(url, rel)
            ok += 1
        except Exception as e:
            print(f"  ⚠ 资源下载失败: {url} ({e})")

    if ok:
        print(f"  ✓ 已打包 {ok} 个本地资源 → {assets_dir}")
    return html


# ==================== 视口过滤 ====================

# 真机 Android 组件类名，不是用户可见文本
_ANDROID_TAG_NOISE = frozenset({
    "View", "TextView", "ImageView", "ImageButton", "Button",
    "LinearLayout", "RelativeLayout", "FrameLayout",
    "ConstraintLayout", "RecyclerView", "ScrollView",
    "ListView", "GridView", "ViewGroup", "WebView",
    "TabWidget", "TabHost", "CheckBox", "EditText",
})


def _in_viewport(el: dict, vw: int, vh: int, margin: float = 5.0) -> bool:
    """判断元素是否在视口内（允许 margin 像素的容差）。"""
    b = el.get("bounds") or el.get("rect") or {}
    x = b.get("x", 0)
    y = b.get("y", 0)
    w = b.get("width", 0)
    h = b.get("height", 0)
    # 元素右边界在视口左侧之外 或 左边界在视口右侧之外
    if x + w < -margin or x > vw + margin:
        return False
    # 元素下边界在视口上方之外 或 上边界在视口下方之外
    if y + h < -margin or y > vh + margin:
        return False
    return True


def filter_viewport(elements: list[dict], vw: int, vh: int) -> list[dict]:
    """过滤掉视口外的元素。"""
    return [e for e in elements if _in_viewport(e, vw, vh)]


def _meaningful_text(el: dict) -> str:
    """提取有意义的文本，过滤掉 Android tag 噪声名。"""
    text = (el.get("text") or "").strip()
    if text and text not in _ANDROID_TAG_NOISE:
        return text
    desc = (el.get("content_desc") or "").strip()
    if desc and desc not in _ANDROID_TAG_NOISE:
        return desc
    return ""


# ==================== 元素匹配与 Diff 报告 ====================

def _el_center(el: dict) -> tuple[float, float]:
    """取元素中心点坐标。"""
    b = el.get("bounds") or el.get("rect") or {}
    x = b.get("x", 0)
    y = b.get("y", 0)
    w = b.get("width", 0)
    h = b.get("height", 0)
    return (x + w / 2, y + h / 2)


def _el_bounds(el: dict) -> dict:
    """统一返回 {x, y, w, h}。"""
    b = el.get("bounds") or el.get("rect") or {}
    return {
        "x": round(b.get("x", 0), 1),
        "y": round(b.get("y", 0), 1),
        "w": round(b.get("width", 0), 1),
        "h": round(b.get("height", 0), 1),
    }


def _center_dist(a: dict, b: dict) -> float:
    ax, ay = _el_center(a)
    bx, by = _el_center(b)
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


def _severity(dx: float, dy: float, dw: float, dh: float,
              el_w: float = 0, el_h: float = 0) -> str:
    """
    判定偏差严重度。结合绝对值和相对值（相对于元素尺寸）。
    大元素允许更大的绝对偏移，小元素则更严格。
    """
    abs_pos = max(abs(dx), abs(dy))
    abs_size = max(abs(dw), abs(dh))
    # 相对偏移率（相对于元素的平均尺寸）
    ref = max((el_w + el_h) / 2, 10)  # 最少 10dp 防止除零
    rel_pos = abs_pos / ref
    rel_size = abs_size / ref
    # ok: 绝对<2 且 相对<5%
    if abs_pos < 2 and abs_size < 2:
        return "ok"
    # minor: 绝对<10 或 相对<15%
    if abs_pos < 10 and abs_size < 10 and rel_pos < 0.15 and rel_size < 0.15:
        return "minor"
    # warning: 绝对<25 且 相对<30%
    if abs_pos < 25 and abs_size < 25 and rel_pos < 0.30 and rel_size < 0.30:
        return "warning"
    return "error"


def _make_match_entry(pe: dict, se: dict, text: str) -> dict:
    """构建一个 matched 条目。"""
    pb = _el_bounds(pe)
    sb = _el_bounds(se)
    dx = round(sb["x"] - pb["x"], 1)
    dy = round(sb["y"] - pb["y"], 1)
    dw = round(sb["w"] - pb["w"], 1)
    dh = round(sb["h"] - pb["h"], 1)
    avg_w = (pb["w"] + sb["w"]) / 2
    avg_h = (pb["h"] + sb["h"]) / 2
    return {
        "text": text,
        "phone_tag": pe.get("tag", ""),
        "sim_tag": se.get("tag", ""),
        "phone": pb, "sim": sb,
        "offset": {"dx": dx, "dy": dy, "dw": dw, "dh": dh},
        "severity": _severity(dx, dy, dw, dh, avg_w, avg_h),
    }


def match_elements(
    phone_els: list[dict],
    sim_els: list[dict],
    vw: int = 360,
    vh: int = 800,
    dist_threshold: float = 30.0,
) -> tuple[list[dict], list[dict], list[dict]]:
    """
    自动匹配真机 / 模拟器元素。
    返回 (matched, phone_only, sim_only)。

    Pass 1: 按文本分组，每组内用全局最短距离贪心匹配（避免链式误差）。
    Pass 2: 无文本元素按位置 + 面积近似匹配。
    """
    used_phone: set[int] = set()
    used_sim: set[int] = set()
    matched: list[dict] = []

    # --- Pass 1: 按文本分组匹配 ---
    # 建立文本→索引的映射（只用有意义的文本）
    from collections import defaultdict
    phone_by_text: dict[str, list[int]] = defaultdict(list)
    sim_by_text: dict[str, list[int]] = defaultdict(list)

    for pi, pe in enumerate(phone_els):
        pt = _meaningful_text(pe)
        if pt:
            phone_by_text[pt].append(pi)

    for si, se in enumerate(sim_els):
        st = (se.get("text") or "").strip()
        if st and st not in _ANDROID_TAG_NOISE:
            sim_by_text[st].append(si)

    # 对每个共同出现的文本，收集所有候选对并按距离排序
    all_text_pairs: list[tuple[float, str, int, int]] = []  # (dist, text, pi, si)
    common_texts = set(phone_by_text.keys()) & set(sim_by_text.keys())
    for text in common_texts:
        for pi in phone_by_text[text]:
            for si in sim_by_text[text]:
                d = _center_dist(phone_els[pi], sim_els[si])
                all_text_pairs.append((d, text, pi, si))

    # 按距离从小到大贪心匹配
    all_text_pairs.sort(key=lambda x: x[0])
    for dist, text, pi, si in all_text_pairs:
        if pi in used_phone or si in used_sim:
            continue
        used_phone.add(pi)
        used_sim.add(si)
        matched.append(_make_match_entry(phone_els[pi], sim_els[si], text))

    # --- Pass 2: 位置近似匹配（无文本或文本未匹配的元素）---
    # 收集所有候选对
    pos_pairs: list[tuple[float, int, int]] = []
    for pi, pe in enumerate(phone_els):
        if pi in used_phone:
            continue
        for si, se in enumerate(sim_els):
            if si in used_sim:
                continue
            d = _center_dist(pe, se)
            if d < dist_threshold:
                pb2 = _el_bounds(pe)
                sb2 = _el_bounds(se)
                area_p = pb2["w"] * pb2["h"]
                area_s = sb2["w"] * sb2["h"]
                if area_p > 0 and area_s > 0:
                    ratio = area_s / area_p
                    if 0.3 <= ratio <= 3.0:
                        pos_pairs.append((d, pi, si))

    pos_pairs.sort(key=lambda x: x[0])
    for dist, pi, si in pos_pairs:
        if pi in used_phone or si in used_sim:
            continue
        used_phone.add(pi)
        used_sim.add(si)
        pe = phone_els[pi]
        se = sim_els[si]
        # 展示文本：优先用有意义的文本，其次用 id（标注来源便于区分）
        text = _meaningful_text(pe) or _meaningful_text(se)
        if not text:
            eid = pe.get("id") or se.get("id") or ""
            text = f"[id:{eid}]" if eid else f"[{pe.get('tag', '?')}]"
        matched.append(_make_match_entry(pe, se, text))

    # --- 未匹配元素 ---
    phone_only = []
    for pi, pe in enumerate(phone_els):
        if pi not in used_phone:
            phone_only.append({
                "text": pe.get("text") or "",
                "tag": pe.get("tag", ""),
                "id": pe.get("id", ""),
                "bounds": _el_bounds(pe),
            })

    sim_only = []
    for si, se in enumerate(sim_els):
        if si not in used_sim:
            sb = _el_bounds(se)
            tag = se.get("tag", "")
            text = (se.get("text") or "").strip()
            # 过滤噪声：全屏容器、SVG 内部元素、极小元素
            if sb["w"] >= vw - 5 and sb["h"] >= vh * 0.5:
                continue
            if tag in ("html", "body", "head", "path", "line", "rect",
                       "circle", "g", "defs", "clippath"):
                continue
            if sb["w"] < 3 or sb["h"] < 3:
                continue
            # 无文本的纯布局/装饰元素对对比没有价值
            if not text and tag in ("div", "span", "img", "svg", "button",
                                    "section", "nav", "header", "footer",
                                    "main", "aside", "article", "ul", "li",
                                    "ol", "a", "label", "i", "p"):
                continue
            sim_only.append({
                "text": text[:50],
                "tag": tag,
                "id": se.get("id", ""),
                "className": (se.get("className") or "")[:60],
                "bounds": sb,
            })

    return matched, phone_only, sim_only


def generate_diff_report(
    matched: list[dict],
    phone_only: list[dict],
    sim_only: list[dict],
    output_dir: Path,
    total_phone: int = 0,
    total_sim: int = 0,
) -> dict:
    """生成 diff_report.json 和 diff_report.md，返回 summary dict。"""

    # --- 计算摘要 ---
    offsets = []
    size_diffs = []
    max_offset_el = {"element": "", "offset": 0.0}
    severity_counts = {"ok": 0, "minor": 0, "warning": 0, "error": 0}
    for m in matched:
        o = m["offset"]
        pos_off = (o["dx"] ** 2 + o["dy"] ** 2) ** 0.5
        sz_off = (o["dw"] ** 2 + o["dh"] ** 2) ** 0.5
        offsets.append(pos_off)
        size_diffs.append(sz_off)
        severity_counts[m["severity"]] = severity_counts.get(m["severity"], 0) + 1
        if pos_off > max_offset_el["offset"]:
            max_offset_el = {"element": m["text"] or m["phone_tag"], "offset": round(pos_off, 1)}

    # --- 综合质量评分 (0-100) ---
    # 三个维度加权：匹配率(40%)、位置精度(35%)、缺失惩罚(25%)
    total_ref = max(total_phone, total_sim, 1)
    match_ratio = len(matched) / total_ref if total_ref else 0
    match_score = min(match_ratio, 1.0) * 40

    avg_off = sum(offsets) / len(offsets) if offsets else 0
    # 偏移越小越好，20dp 以内满分，超过 50dp 归零
    precision_score = max(0, 1 - avg_off / 50) * 35

    missing_count = len(phone_only) + len(sim_only)
    missing_ratio = missing_count / (total_ref + missing_count) if (total_ref + missing_count) else 0
    missing_score = max(0, 1 - missing_ratio * 2) * 25

    quality_score = round(match_score + precision_score + missing_score)

    summary = {
        "quality_score": quality_score,
        "matched": len(matched),
        "phone_only": len(phone_only),
        "sim_only": len(sim_only),
        "severity_counts": severity_counts,
        "avg_position_offset": round(sum(offsets) / len(offsets), 1) if offsets else 0,
        "avg_size_diff": round(sum(size_diffs) / len(size_diffs), 1) if size_diffs else 0,
        "max_position_offset": max_offset_el,
    }

    report = {
        "summary": summary,
        "matched": matched,
        "phone_only": phone_only,
        "sim_only": sim_only,
    }

    # --- JSON ---
    json_path = output_dir / "diff_report.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # --- Markdown ---
    sc = severity_counts
    lines = [
        "# 真机 vs 模拟器 Diff 报告\n",
        "## 摘要\n",
        f"- **综合质量评分: {quality_score}/100**",
        f"- 匹配: {summary['matched']} 对  "
        f"平均偏移: {summary['avg_position_offset']}dp  "
        f"平均尺寸差: {summary['avg_size_diff']}dp",
        f"- 严重度分布: ok={sc['ok']} minor={sc['minor']} "
        f"warning={sc['warning']} error={sc['error']}",
        f"- 真机独有: {summary['phone_only']} 个  "
        f"模拟器独有: {summary['sim_only']} 个",
        f"- 最大偏移: \"{max_offset_el['element']}\" {max_offset_el['offset']}dp\n",
    ]

    # 偏差表格（含各自 bbox）
    warn_items = [m for m in matched if m["severity"] in ("warning", "error")]
    minor_items = [m for m in matched if m["severity"] == "minor"]
    if warn_items or minor_items:
        lines.append("## 偏差元素\n")
        lines.append("| 元素 | 真机 bbox | 模拟器 bbox | 偏移(dx,dy) | 尺寸差(dw,dh) | 严重度 |")
        lines.append("|------|----------|-----------|------------|--------------|--------|")
        for m in warn_items + minor_items:
            o = m["offset"]
            p = m["phone"]
            s = m["sim"]
            lines.append(
                f"| \"{m['text'][:20]}\" "
                f"| ({p['x']},{p['y']}) {p['w']}×{p['h']} "
                f"| ({s['x']},{s['y']}) {s['w']}×{s['h']} "
                f"| {o['dx']:+.0f}, {o['dy']:+.0f} "
                f"| {o['dw']:+.0f}, {o['dh']:+.0f} "
                f"| {m['severity']} |"
            )
        lines.append("")

    # 缺失元素
    if phone_only:
        lines.append("## 真机有但模拟器缺失\n")
        for p in phone_only:
            b = p["bounds"]
            lines.append(f"- {p['tag']} id={p['id']} \"{p['text'][:30]}\" "
                         f"({b['x']},{b['y']}) {b['w']}x{b['h']}")
        lines.append("")

    if sim_only:
        lines.append("## 模拟器有但真机没有\n")
        for s in sim_only[:20]:  # 只列前 20 个
            b = s["bounds"]
            lines.append(f"- {s['tag']} \"{s['text'][:30]}\" "
                         f"({b['x']},{b['y']}) {b['w']}x{b['h']}")
        if len(sim_only) > 20:
            lines.append(f"- ... 还有 {len(sim_only) - 20} 个")
        lines.append("")

    md_text = "\n".join(lines)
    md_path = output_dir / "diff_report.md"
    md_path.write_text(md_text, encoding="utf-8")

    return summary


def print_diff_summary(summary: dict):
    """打印 diff 摘要到 stdout。"""
    qs = summary.get("quality_score", "?")
    print(f"\n📋 Diff 报告 (质量评分: {qs}/100):")
    print(f"  匹配: {summary['matched']} 对  "
          f"平均偏移: {summary['avg_position_offset']}dp  "
          f"平均尺寸差: {summary['avg_size_diff']}dp")
    sc = summary.get("severity_counts", {})
    if sc:
        print(f"  严重度: ok={sc.get('ok',0)} minor={sc.get('minor',0)} "
              f"warning={sc.get('warning',0)} error={sc.get('error',0)}")
    print(f"  真机独有: {summary['phone_only']} 个  "
          f"模拟器独有: {summary['sim_only']} 个")
    mo = summary["max_position_offset"]
    if mo["offset"] > 0:
        print(f"  最大偏移: \"{mo['element']}\" {mo['offset']}dp")


# ==================== HTML 生成 ====================

def generate_comparison_html(
    phone_img_path: str,
    sim_html: str,
    phone_elements: list[dict],
    sim_elements: list[dict],
    vw: int, vh: int,
    output_dir: Path,
) -> Path:
    sim_clean = strip_scripts(sim_html)
    # 将本地资源（localhost:3000）打包到输出目录，保证 sim_snapshot.html 离线也能正常显示
    sim_clean = bundle_sim_snapshot_assets(sim_clean, output_dir)
    (output_dir / "sim_snapshot.html").write_text(sim_clean, encoding="utf-8")

    phone_js = json.dumps(phone_elements, ensure_ascii=False)
    sim_js = json.dumps(sim_elements, ensure_ascii=False)
    output_path = output_dir / "comparison.html"

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>真机 vs 模拟器 布局对比</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#111;color:#e0e0e0;font-family:-apple-system,"PingFang SC",sans-serif}}
.toolbar{{
  position:fixed;top:0;left:0;right:0;z-index:200;
  background:rgba(20,20,20,.95);backdrop-filter:blur(12px);
  padding:8px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  border-bottom:1px solid #333;font-size:13px
}}
.toolbar button{{
  padding:5px 14px;border:1px solid #444;border-radius:6px;
  background:#2a2a2a;color:#ccc;cursor:pointer;font-size:12px;transition:all .15s
}}
.toolbar button:hover{{background:#3a3a3a;color:#fff}}
.toolbar button.on{{background:#0066ff;border-color:#0055dd;color:#fff}}
.toolbar button.on-r{{background:rgba(255,60,60,.8);border-color:rgba(255,60,60,.9);color:#fff}}
.toolbar button.on-b{{background:rgba(60,180,255,.8);border-color:rgba(60,180,255,.9);color:#fff}}
.sep{{width:1px;height:24px;background:#444;flex-shrink:0}}
.toolbar label{{color:#888;font-size:12px;white-space:nowrap}}
.toolbar input[type=range]{{width:100px;accent-color:#0066ff}}
.main{{padding-top:52px}}
.sbs{{display:flex;justify-content:center;gap:20px;padding:20px;flex-wrap:wrap}}
.pnl{{
  position:relative;width:{vw}px;height:{vh}px;
  border:1px solid #333;border-radius:8px;overflow:hidden;background:#000;flex-shrink:0
}}
.pnl img{{width:{vw}px;height:{vh}px;object-fit:cover;display:block}}
.pnl iframe{{width:{vw}px;height:{vh}px;border:none;display:block;background:#000}}
.lbl{{
  position:absolute;top:8px;left:8px;z-index:50;
  padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;pointer-events:none
}}
.lbl.r{{background:rgba(255,60,60,.85);color:#fff}}
.lbl.b{{background:rgba(60,180,255,.85);color:#fff}}
.ov-wrap{{display:flex;justify-content:center;padding:20px}}
.ov-ctr{{
  position:relative;width:{vw}px;height:{vh}px;
  border:1px solid #333;border-radius:8px;overflow:hidden;background:#000
}}
.ov-ctr img,.diff-ctr img{{
  position:absolute;top:0;left:0;width:{vw}px;height:{vh}px;object-fit:cover;z-index:2
}}
.ov-ctr iframe,.diff-ctr iframe{{
  position:absolute;top:0;left:0;width:{vw}px;height:{vh}px;border:none;z-index:1;background:#000
}}
.diff-ctr{{
  position:relative;width:{vw}px;height:{vh}px;
  border:1px solid #333;border-radius:8px;overflow:hidden;background:#000
}}
.diff-ctr img{{mix-blend-mode:difference}}
.bx-layer{{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:60}}
.bx{{position:absolute;pointer-events:auto;cursor:crosshair}}
.bx.r{{border:1.5px solid rgba(255,60,60,.7)}}
.bx.b{{border:1.5px dashed rgba(60,180,255,.7)}}
.bx:hover{{background:rgba(255,255,255,.1)}}
.bl{{
  position:absolute;top:-14px;left:0;font-size:8px;padding:1px 4px;border-radius:2px;
  white-space:nowrap;line-height:1;pointer-events:none
}}
.bx.r .bl{{background:rgba(255,60,60,.85);color:#fff}}
.bx.b .bl{{background:rgba(60,180,255,.85);color:#fff}}
.bar{{
  position:fixed;bottom:0;left:0;right:0;z-index:200;
  background:rgba(20,20,20,.95);border-top:1px solid #333;
  padding:6px 16px;font-size:11px;color:#888;display:flex;align-items:center;gap:16px
}}
.dot{{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px}}
.dot.r{{background:rgba(255,60,60,.7)}}
.dot.b{{background:rgba(60,180,255,.7);border:1px dashed rgba(60,180,255,.9)}}
</style>
</head>
<body>
<div class="toolbar">
  <button class="on" data-m="side">并排</button>
  <button data-m="overlay">叠加</button>
  <button data-m="blink">闪烁</button>
  <button data-m="diff">差异</button>
  <div class="sep"></div>
  <button id="tR" class="on-r">真机框</button>
  <button id="tB" class="on-b">模拟器框</button>
  <button id="tL">标签</button>
  <div class="sep"></div>
  <label>透明度</label>
  <input type="range" id="oSlider" min="0" max="100" value="50">
  <span id="oVal" style="color:#aaa;font-size:12px;min-width:32px">50%</span>
</div>
<div class="main" id="M"></div>
<div class="bar">
  <span><span class="dot r"></span>真机 ({len(phone_elements)})</span>
  <span><span class="dot b"></span>模拟器 ({len(sim_elements)})</span>
  <span>{vw}×{vh}</span>
  <span id="hov" style="flex:1">hover 元素框查看详情</span>
  <span id="mI">并排</span>
</div>
<script>
const PI="{phone_img_path}",SS="sim_snapshot.html",W={vw},H={vh};
const pE={phone_js};
const sE={sim_js};
let mode='side',opa=50,bT=null,sR=true,sB=true,sL=false;

function mkBox(layer,els,c){{
  layer.innerHTML='';
  const show=c==='r'?sR:sB;
  if(!show)return;
  els.forEach(el=>{{
    const b=el.bounds||el.rect||el.bounds_dp;if(!b)return;
    const d=document.createElement('div');
    d.className='bx '+c;
    d.style.cssText=`left:${{b.x??b.left}}px;top:${{b.y??b.top}}px;width:${{b.width}}px;height:${{b.height}}px`;
    if(sL&&(el.text||el.id)){{
      const l=document.createElement('span');l.className='bl';
      l.textContent=(el.text||el.id).slice(0,25);
      d.appendChild(l);
    }}
    d.onmouseenter=()=>{{
      const x=b.x??b.left,y=b.y??b.top;
      document.getElementById('hov').textContent=
        `[${{c==='r'?'真机':'模拟器'}}] "${{(el.text||'').slice(0,30)}}" ${{el.tag}} (${{x}},${{y}}) ${{b.width}}×${{b.height}}`;
    }};
    layer.appendChild(d);
  }});
}}
function addLayers(p,pe,se){{
  const lr=document.createElement('div');lr.className='bx-layer';lr.dataset.c='r';
  const lb=document.createElement('div');lb.className='bx-layer';lb.dataset.c='b';
  mkBox(lr,pe,'r');mkBox(lb,se,'b');
  p.appendChild(lr);p.appendChild(lb);
}}
function refreshBoxes(){{
  document.querySelectorAll('.bx-layer').forEach(l=>{{
    mkBox(l,l.dataset.c==='r'?pE:sE,l.dataset.c);
  }});
}}
function mkPhone(){{
  const d=document.createElement('div');d.className='pnl';
  d.innerHTML=`<span class="lbl r">真机</span><img src="${{PI}}">`;
  return d;
}}
function mkSim(){{
  const d=document.createElement('div');d.className='pnl';
  d.innerHTML=`<span class="lbl b">模拟器</span><iframe src="${{SS}}" sandbox="allow-same-origin"></iframe>`;
  return d;
}}

function render(){{
  if(bT){{clearInterval(bT);bT=null}}
  const m=document.getElementById('M');m.innerHTML='';
  if(mode==='side'){{
    const w=document.createElement('div');w.className='sbs';
    const pp=mkPhone();addLayers(pp,pE,[]);w.appendChild(pp);
    const sp=mkSim();addLayers(sp,[],sE);w.appendChild(sp);
    m.appendChild(w);
  }} else {{
    const w=document.createElement('div');w.className='ov-wrap';
    const c=document.createElement('div');
    c.className=mode==='diff'?'diff-ctr':'ov-ctr';
    const img=document.createElement('img');img.src=PI;img.id='oImg';
    if(mode==='overlay')img.style.opacity=opa/100;
    if(mode==='blink')img.style.zIndex='3';
    const ifr=document.createElement('iframe');ifr.src=SS;
    ifr.sandbox='allow-same-origin';ifr.id='oIfr';
    c.appendChild(ifr);c.appendChild(img);
    addLayers(c,pE,sE);
    w.appendChild(c);m.appendChild(w);
    if(mode==='blink'){{
      let on=true;
      bT=setInterval(()=>{{
        const i=document.getElementById('oImg'),f=document.getElementById('oIfr');
        if(i)i.style.display=on?'':'none';
        if(f)f.style.display=on?'none':'';
        on=!on;
      }},600);
    }}
  }}
  document.getElementById('mI').textContent=
    {{side:'并排',overlay:'叠加',blink:'闪烁',diff:'差异'}}[mode];
}}

document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{{
  mode=b.dataset.m;
  document.querySelectorAll('[data-m]').forEach(x=>x.classList.toggle('on',x.dataset.m===mode));
  render();
}});
document.getElementById('tR').onclick=function(){{sR=!sR;this.classList.toggle('on-r',sR);refreshBoxes()}};
document.getElementById('tB').onclick=function(){{sB=!sB;this.classList.toggle('on-b',sB);refreshBoxes()}};
document.getElementById('tL').onclick=function(){{sL=!sL;this.classList.toggle('on',sL);refreshBoxes()}};
document.getElementById('oSlider').oninput=function(){{
  opa=+this.value;document.getElementById('oVal').textContent=opa+'%';
  const i=document.getElementById('oImg');if(i&&mode==='overlay')i.style.opacity=opa/100;
}};
render();
</script>
</body>
</html>"""

    output_path.write_text(html, encoding="utf-8")
    return output_path


# ==================== 主函数 ====================

def main():
    parser = argparse.ArgumentParser(description="真机 vs 模拟器 UI 一键对比")
    parser.add_argument("--viewport", default="360x800", help="视口 WxH (默认 360x800)")
    parser.add_argument("-o", "--output", type=Path, help="输出目录")
    args = parser.parse_args()

    vw, vh = [int(x) for x in args.viewport.split("x")]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = args.output or Path("ui_dumps") / f"compare_{ts}"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"输出目录: {out_dir}\n")

    # ===== 1. 真机: 截图 + 元素 =====
    print("📱 真机数据采集...")
    density = adb_get_density()
    screen_size = get_screen_size()
    dpw = round(screen_size[0] / density, 1)
    dph = round(screen_size[1] / density, 1)
    print(f"  屏幕: {screen_size[0]}×{screen_size[1]} px, density={density:.2f} → {dpw}×{dph} dp")

    if not adb_screenshot(out_dir / "screenshot.png"):
        sys.exit(1)
    print(f"  ✓ 截图完成")

    phone_elements = adb_dump_tree(out_dir, density, vw, vh, screen_size=screen_size)
    phone_elements = filter_viewport(phone_elements, vw, vh)
    print(f"  ✓ {len(phone_elements)} 个元素（视口内）")

    # ===== 2. 模拟器: HTML + 元素 =====
    print("\n🖥️  模拟器数据采集...")
    if not mcp_ping():
        print("  ✗ MCP 服务器不可用，请确认 localhost:8766 和浏览器已连接")
        sys.exit(1)
    print("  ✓ MCP 服务器已连接")

    sim_html = mcp_get_html(visible_only=True)
    if not sim_html:
        print("  ✗ 获取模拟器 HTML 失败")
        sys.exit(1)
    print(f"  ✓ HTML {len(sim_html)} 字符")

    sim_elements = mcp_get_elements()
    # get_layout_elements 已做归一化过滤，只需额外过滤视口外和全屏宽容器
    sim_elements = [e for e in sim_elements
                    if e.get("bounds", {}).get("width", 999) < vw - 5
                    or (e.get("text") or "").strip()]
    sim_elements = filter_viewport(sim_elements, vw, vh)
    print(f"  ✓ {len(sim_elements)} 个元素（视口内）")

    # ===== 3. 元素匹配 + Diff 报告 =====
    print("\n🔍 元素匹配...")
    matched, phone_only, sim_only = match_elements(phone_elements, sim_elements, vw, vh)
    summary = generate_diff_report(
        matched, phone_only, sim_only, out_dir,
        total_phone=len(phone_elements), total_sim=len(sim_elements),
    )
    print_diff_summary(summary)

    # ===== 4. 生成对比页面 =====
    print("\n📊 生成对比页面...")
    result = generate_comparison_html(
        "screenshot.png", sim_html, phone_elements, sim_elements,
        vw, vh, out_dir,
    )
    print(f"  ✓ {result}")
    print(f"  ✓ {out_dir / 'diff_report.json'}")
    print(f"  ✓ {out_dir / 'diff_report.md'}")
    print(f"\n🎉 完成！打开查看:\n  {result}")


if __name__ == "__main__":
    main()
