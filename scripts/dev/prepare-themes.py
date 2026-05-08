#!/usr/bin/env python3
"""
Prepare Xiaomi/HyperOS theme resources for mobile-gym (V2 - static assets).

Source (ignored by git): ./themes/
Destination (gitignored, served via /cdn/themes by vite/nginx, mirrored
to R2 at r2:mobilegym-data/themes for production CDN):
    ./mobilegym-data/themes/

Outputs:
- mobilegym-data/themes/manifest.json
- mobilegym-data/themes/{themeId}/preview/*                (copied)
- mobilegym-data/themes/{themeId}/icons/{package}.png      (extracted from icons.mrc)
- mobilegym-data/themes/{themeId}/statusbar/{name}.png     (extracted & normalized)
- mobilegym-data/themes/{themeId}/shade/{active|inactive}.png (extracted & normalized)
- mobilegym-data/themes/{themeId}/wallpaper/default.*      (best-effort)
- mobilegym-data/themes/{themeId}/components/{code}/...    (selected app assets)

Note: manifest.json's `widgets[].variants[].preview` field is emitted as
`/themes/{themeId}/{clockCode}/preview.png` (legacy absolute prefix).
At runtime, os/maml/MamlWidgetService.ts#getWidgetPreviewUrl detects
this prefix and rewrites it to the CDN URL via os/utils/cdn.ts. Kept
this way to avoid touching every existing manifest entry.

Run:
  python3 scripts/dev/prepare-themes.py
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import shutil
import zipfile
import io
import math
from pathlib import Path
from typing import Iterable, Optional

try:
    from PIL import Image  # type: ignore
except Exception:
    Image = None  # Pillow is optional; battery sprite extraction will be skipped.

DEFAULT_THEME_IDS = [
    # 纷紫
    "0132f200-3467-4d4b-b8bd-1bd882145875",
    # 夜半
    "af0f7f90-04fb-417b-941e-ae7b549fe5e5",
    # 小青山
    "e80e4cfc-f4ba-4eef-a487-9a7008744873",
]

DEFAULT_DEFAULT_THEME_ID = "af0f7f90-04fb-417b-941e-ae7b549fe5e5"


def _now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def copy_tree(src_dir: Path, dst_dir: Path) -> None:
    if not src_dir.exists():
        return
    ensure_dir(dst_dir.parent)
    if dst_dir.exists():
        shutil.rmtree(dst_dir)
    shutil.copytree(src_dir, dst_dir)


def iter_subresources(theme_meta: dict) -> Iterable[tuple[str, str]]:
    """
    Returns (resourceCode, localId) pairs from a theme meta (.mrm JSON).
    """
    for sr in theme_meta.get("subResources", []) or []:
        code = sr.get("resourceCode")
        local_id = sr.get("localId")
        if not code or not local_id:
            continue
        yield str(code), str(local_id)

_DENSITY_RANK = {
    "xxxhdpi": 6,
    "xxhdpi": 5,
    "nxhdpi": 5,  # HyperOS sometimes uses nxhdpi
    "xhdpi": 4,
    "hdpi": 3,
    "mdpi": 2,
    "nodpi": 1,
    "raw": 0,
}


def _density_score(path: str) -> int:
    lower = path.lower()
    for k, v in _DENSITY_RANK.items():
        if k in lower:
            return v
    return 0


def _is_png(path: str) -> bool:
    return path.lower().endswith(".png") or path.lower().endswith(".9.png")


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_app_package_names(root: Path) -> list[str]:
    """
    Parse packageName list from both `apps/*/manifest.ts` and `system/*/manifest.ts`.
    Each app manifest declares `packageName: 'com.example.app'`.
    """
    pkgs: set[str] = set()
    for base_dir_name in ("apps", "system"):
        base_dir = root / base_dir_name
        if not base_dir.exists():
            continue
        for manifest_path in base_dir.glob("*/manifest.ts"):
            try:
                text = _read_text(manifest_path)
            except Exception:
                continue
            hits = re.findall(r"packageName\s*:\s*['\"]([^'\"]+)['\"]", text)
            for h in hits:
                v = h.strip()
                if v:
                    pkgs.add(v)
    return sorted(pkgs)


def parse_settings_main_icon_names(root: Path) -> list[str]:
    """
    Parse icon keys referenced by the Settings main page.
    Settings 页面大配置已迁移到 JSON（见 system/Settings/data/pages.json）。
    """
    settings_data_dir = root / "system/Settings/data"
    if not settings_data_dir.exists():
        return []
    pages_path = settings_data_dir / "pages.json"
    if not pages_path.exists():
        return []

    def collect_icons(obj: object, out: set[str]):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k == "icon" and isinstance(v, str) and v.strip():
                    out.add(v.strip())
                collect_icons(v, out)
            return
        if isinstance(obj, list):
            for it in obj:
                collect_icons(it, out)

    names: set[str] = set()
    try:
        pages = json.loads(_read_text(pages_path))
        collect_icons(pages.get("mainSections", []), names)
        collect_icons(pages.get("pages", {}), names)
    except Exception:
        return []

    overrides_path = settings_data_dir / "overrides.json"
    if overrides_path.exists():
        try:
            overrides = json.loads(_read_text(overrides_path))
            collect_icons(overrides, names)
        except Exception:
            pass

    return sorted(names)


def extract_zip_entry(zf: zipfile.ZipFile, entry_name: str, dst: Path) -> bool:
    try:
        info = zf.getinfo(entry_name)
    except KeyError:
        return False
    if info.is_dir():
        return False
    ensure_dir(dst.parent)
    with zf.open(entry_name, "r") as src, dst.open("wb") as out:
        shutil.copyfileobj(src, out)
    return True


def _is_png_bytes(b: bytes) -> bool:
    return b[:8] == b"\x89PNG\r\n\x1a\n"

def _is_fully_transparent_png_bytes(png_bytes: bytes) -> bool:
    """
    MIUI/HyperOS themes sometimes include 1px-wide fully-transparent placeholder PNGs.
    On real devices these often behave like "no override" (fallback to default) or are invisible.
    In our simulator, keeping them creates huge empty gaps in the status bar.
    """
    if Image is None:
        return False
    if not _is_png_bytes(png_bytes):
        return False
    try:
        im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    except Exception:
        return False
    return im.getchannel("A").getbbox() is None

STATUSBAR_TARGET_FILL = 0.82
STATUSBAR_BASE_SIDE = 56   # UI uses 14px, so 56px -> exact 1/4 scale
BATTERY_BASE_SIDE = 40     # UI uses 20px, so 40px -> exact 1/2 scale


def normalize_png_icon_to_square(
    png_bytes: bytes,
    *,
    base_side: int = STATUSBAR_BASE_SIDE,
    target_fill: float = STATUSBAR_TARGET_FILL,
) -> bytes | None:
    """
    Normalize a PNG icon so that:
    - transparent padding is trimmed (alpha bbox)
    - the trimmed icon is centered on a square canvas with consistent fill ratio

    This keeps visual icon sizes more consistent across different theme packs.
    """
    if Image is None:
        return None
    if not _is_png_bytes(png_bytes):
        return None
    try:
        im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    except Exception:
        return None

    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)

    w, h = im.size
    if w <= 0 or h <= 0:
        return None

    side = int(base_side) if isinstance(base_side, int) else STATUSBAR_BASE_SIDE
    if side < 16 or side > 256:
        side = STATUSBAR_BASE_SIDE

    tf = float(target_fill)
    if not (0.2 <= tf <= 0.98):
        tf = STATUSBAR_TARGET_FILL

    desired = max(1, int(round(side * tf)))
    scale = desired / max(w, h)

    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))

    if (new_w, new_h) != (w, h):
        if hasattr(Image, "Resampling"):
            resample_up = Image.Resampling.BICUBIC
            resample_down = Image.Resampling.LANCZOS
        else:
            resample_up = Image.BICUBIC
            resample_down = Image.LANCZOS
        im = im.resize((new_w, new_h), resample=(resample_up if scale > 1 else resample_down))

    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - im.size[0]) // 2
    oy = (side - im.size[1]) // 2
    canvas.paste(im, (ox, oy), im)

    out = io.BytesIO()
    canvas.save(out, format="PNG")
    return out.getvalue()


def extract_battery_from_sprite_png(png_bytes: bytes) -> bytes | None:
    """
    HyperOS/MIUI often stores battery meter as a vertical sprite strip (very tall PNG).
    We extract one representative frame (the most 'filled' one) into a normal-sized PNG.

    Returns: cropped PNG bytes, or None if extraction is not possible.
    """
    if Image is None:
        return None
    if not _is_png_bytes(png_bytes):
        return None
    try:
        im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    except Exception:
        return None

    w, h = im.size
    # Already icon-like -> keep as-is.
    if h <= 256 and w <= 256 and h <= w * 4:
        return png_bytes

    alpha = im.getchannel("A")
    pix = alpha.load()

    # For each row: any non-transparent pixel?
    has = [False] * h
    for y in range(h):
        any_nz = False
        for x in range(w):
            if pix[x, y] != 0:
                any_nz = True
                break
        has[y] = any_nz

    # Find contiguous content runs (candidate frames)
    runs: list[tuple[int, int]] = []
    y = 0
    while y < h:
        if not has[y]:
            y += 1
            continue
        start = y
        while y < h and has[y]:
            y += 1
        end = y  # exclusive
        if end - start >= 2:
            runs.append((start, end))

    if len(runs) <= 1:
        return None

    # Choose run with max non-transparent pixels (most filled)
    best = None
    best_score = -1
    for start, end in runs:
        crop_alpha = alpha.crop((0, start, w, end))
        hist = crop_alpha.histogram()
        # histogram[0] is count of zero-alpha pixels
        nonzero = (end - start) * w - (hist[0] if hist else 0)
        if nonzero > best_score:
            best_score = nonzero
            best = (start, end)

    if not best:
        return None

    start, end = best
    region = im.crop((0, start, w, end))
    bbox = region.getchannel("A").getbbox()
    if bbox:
        region = region.crop(bbox)

    # Sanity check: avoid still-sprite outputs
    rw, rh = region.size
    if rw <= 0 or rh <= 0:
        return None
    if rh > 256 or rw > 256:
        return None
    if rh > rw * 4:
        return None

    out = io.BytesIO()
    region.save(out, format="PNG")
    return out.getvalue()


def extract_battery_frames_from_sprite_png(png_bytes: bytes) -> list[bytes]:
    """
    Extract ALL battery frames from a vertical sprite strip.
    Returns normalized (BATTERY_BASE_SIDE x BATTERY_BASE_SIDE) PNG bytes in low->high order.
    """
    if Image is None:
        return []
    if not _is_png_bytes(png_bytes):
        return []
    try:
        im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    except Exception:
        return []

    w, h = im.size
    # Single icon
    if h <= 256 and w <= 256 and h <= w * 4:
        normalized = normalize_png_icon_to_square(png_bytes, base_side=BATTERY_BASE_SIDE)
        return [normalized or png_bytes]

    alpha = im.getchannel("A")
    pix = alpha.load()

    has = [False] * h
    for y in range(h):
        any_nz = False
        for x in range(w):
            if pix[x, y] != 0:
                any_nz = True
                break
        has[y] = any_nz

    runs: list[tuple[int, int]] = []
    y = 0
    while y < h:
        if not has[y]:
            y += 1
            continue
        start = y
        while y < h and has[y]:
            y += 1
        end = y
        if end - start >= 2:
            runs.append((start, end))

    if not runs:
        return []

    frames: list[bytes] = []
    scores: list[int] = []
    for start, end in runs:
        region = im.crop((0, start, w, end))
        bbox = region.getchannel("A").getbbox()
        if bbox:
            region = region.crop(bbox)

        raw = io.BytesIO()
        region.save(raw, format="PNG")
        raw_bytes = raw.getvalue()

        normalized = normalize_png_icon_to_square(raw_bytes, base_side=BATTERY_BASE_SIDE)
        out_bytes = normalized or raw_bytes
        frames.append(out_bytes)

        # Score for orientation: non-transparent alpha pixels
        try:
            rim = Image.open(io.BytesIO(out_bytes)).convert("RGBA")
            a = rim.getchannel("A")
            hist = a.histogram()
            nonzero = rim.size[0] * rim.size[1] - (hist[0] if hist else 0)
            scores.append(int(nonzero))
        except Exception:
            scores.append(0)

    if not frames:
        return []

    # Most themes store low->high from top to bottom; ensure "full" is at the end.
    max_i = max(range(len(scores)), key=lambda i: scores[i]) if scores else (len(frames) - 1)
    if max_i < len(frames) // 2:
        frames = list(reversed(frames))

    return frames


def extract_statusbar_battery_icon(zf: zipfile.ZipFile, entry_name: str, dst: Path) -> bool:
    """
    Extract a battery icon for our simulator. For tall sprite sheets, crop one frame.
    """
    try:
        data = zf.read(entry_name)
    except KeyError:
        return False
    if not _is_png_bytes(data):
        return False

    cropped = extract_battery_from_sprite_png(data)
    if not cropped:
        # If we can't crop, skip battery to avoid rendering a thin line.
        return False

    ensure_dir(dst.parent)
    normalized = normalize_png_icon_to_square(cropped, base_side=BATTERY_BASE_SIDE)
    dst.write_bytes(normalized or cropped)
    return True


def extract_statusbar_battery_assets(zf: zipfile.ZipFile, entry_name: str, out_dir: Path) -> dict | None:
    """
    Export battery assets in a "real-device-like" way:
    - statusbar/battery.png              (full / representative frame)
    - statusbar/battery_sprite.png       (vertical strip of normalized frames)
    Returns metadata for manifest: frames/sprite name/frame side.
    """
    if Image is None:
        return None
    try:
        data = zf.read(entry_name)
    except KeyError:
        return None
    if not _is_png_bytes(data):
        return None

    frames = extract_battery_frames_from_sprite_png(data)
    if not frames:
        # Fallback: single-frame battery PNG (sprite extraction failed). We still
        # advertise it as a 1-frame "sprite" so the front-end mask-image path
        # tints it with state colors instead of routing to a separate <img>
        # branch that ignores charging/saver state.
        ok = extract_statusbar_battery_icon(zf, entry_name, out_dir / "battery.png")
        return (
            {"batteryFrames": 1, "batterySprite": "battery.png", "batteryFrameSide": BATTERY_BASE_SIDE}
            if ok else None
        )

    ensure_dir(out_dir)

    # battery.png = full (last frame)
    (out_dir / "battery.png").write_bytes(frames[-1])

    # battery_sprite.png = stacked frames
    side = BATTERY_BASE_SIDE
    sprite = Image.new("RGBA", (side, side * len(frames)), (0, 0, 0, 0))
    for i, fb in enumerate(frames):
        try:
            fr = Image.open(io.BytesIO(fb)).convert("RGBA")
        except Exception:
            continue
        if fr.size != (side, side):
            fr = fr.resize((side, side))
        sprite.paste(fr, (0, i * side), fr)

    out = io.BytesIO()
    sprite.save(out, format="PNG")
    (out_dir / "battery_sprite.png").write_bytes(out.getvalue())

    return {"batteryFrames": len(frames), "batterySprite": "battery_sprite.png", "batteryFrameSide": side}


def extract_statusbar_battery_variant_assets(
    zf: zipfile.ZipFile,
    entry_name: str,
    out_dir: Path,
    *,
    prefix: str,
    manifest_prefix: str,
) -> dict | None:
    """
    Export a battery sprite variant (e.g. power-save style) using the same format as normal battery.
    Writes:
      - {prefix}.png
      - {prefix}_sprite.png
    Returns manifest fields:
      - {manifest_prefix}Frames / {manifest_prefix}Sprite / {manifest_prefix}FrameSide
    """
    if Image is None:
        return None
    try:
        data = zf.read(entry_name)
    except KeyError:
        return None
    if not _is_png_bytes(data):
        return None

    frames = extract_battery_frames_from_sprite_png(data)
    if not frames:
        return None

    ensure_dir(out_dir)

    # {prefix}.png = full (last frame)
    (out_dir / f"{prefix}.png").write_bytes(frames[-1])

    # {prefix}_sprite.png = stacked frames
    side = BATTERY_BASE_SIDE
    sprite = Image.new("RGBA", (side, side * len(frames)), (0, 0, 0, 0))
    for i, fb in enumerate(frames):
        try:
            fr = Image.open(io.BytesIO(fb)).convert("RGBA")
        except Exception:
            continue
        if fr.size != (side, side):
            fr = fr.resize((side, side))
        sprite.paste(fr, (0, i * side), fr)

    out = io.BytesIO()
    sprite.save(out, format="PNG")
    sprite_name = f"{prefix}_sprite.png"
    (out_dir / sprite_name).write_bytes(out.getvalue())

    return {
        f"{manifest_prefix}Frames": len(frames),
        f"{manifest_prefix}Sprite": sprite_name,
        f"{manifest_prefix}FrameSide": side,
    }


def _png_pixel_identical(a_path: Path, b_path: Path) -> bool:
    """Return True iff two PNG files have the same RGBA pixel data."""
    if Image is None or not a_path.exists() or not b_path.exists():
        return False
    try:
        a = Image.open(a_path).convert("RGBA")
        b = Image.open(b_path).convert("RGBA")
    except Exception:
        return False
    if a.size != b.size:
        return False
    return a.tobytes() == b.tobytes()


def _png_has_visible_alpha(png_bytes: bytes, *, min_pixels: int = 50) -> bool:
    """Reject empty 1×N placeholder PNGs (some HyperOS themes ship these for
    `stat_sys_battery_charging.png` / `stat_sys_quick_charging.png`)."""
    if Image is None or not _is_png_bytes(png_bytes):
        return False
    try:
        im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    except Exception:
        return False
    w, h = im.size
    if w < 4 or h < 4:
        return False
    visible = sum(1 for px in im.getdata() if px[3] > 50)
    return visible >= min_pixels


def extract_battery_bolt_from_charge_png(png_bytes: bytes) -> bytes | None:
    """
    Isolate the charging bolt from a HyperOS/MIUI `stat_sys_battery_charge.png`
    sprite sheet.

    The source PNG encodes battery body + bolt in DIFFERENT RGB colors:
      - Body fill is rendered in a saturated color (e.g. green ~ (0,192,64))
      - Bolt + outline is rendered in light gray (~ (224,224,224))

    The bolt position is fixed across all frames (it doesn't move with the
    fill level), so we collapse all frames into a single static overlay by
    taking the alpha-max of the gray-only mask across every frame.

    Returns a normalized BATTERY_BASE_SIDE × BATTERY_BASE_SIDE PNG, or None
    if extraction failed.
    """
    if Image is None or not _is_png_bytes(png_bytes):
        return None
    try:
        im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    except Exception:
        return None

    W, H = im.size
    if H <= W:
        # Probably a single-frame placeholder, not a sprite sheet.
        return None

    alpha = im.getchannel("A")
    runs: list[tuple[int, int]] = []
    y = 0
    while y < H:
        # Quick row-has-pixel test
        row_alpha = [alpha.getpixel((x, y)) for x in range(W)]
        if all(a == 0 for a in row_alpha):
            y += 1
            continue
        s = y
        while y < H:
            row_alpha = [alpha.getpixel((x, y)) for x in range(W)]
            if all(a == 0 for a in row_alpha):
                break
            y += 1
        runs.append((s, y))

    if not runs:
        return None

    # Find the body color (most common saturated RGB) and bolt color (most
    # common low-saturation/light RGB) by sampling a mid-fill frame.
    sample_idx = min(len(runs) // 2, len(runs) - 1)
    s, e = runs[sample_idx]
    sample = im.crop((0, s, W, e))
    from collections import Counter
    body_votes: Counter = Counter()
    bolt_votes: Counter = Counter()
    for r, g, b, a in sample.getdata():
        if a < 80:
            continue
        # Bolt = roughly neutral light (R≈G≈B and bright)
        if min(r, g, b) > 192 and max(r, g, b) - min(r, g, b) < 32:
            bolt_votes[(r // 16 * 16, g // 16 * 16, b // 16 * 16)] += 1
        else:
            body_votes[(r // 16 * 16, g // 16 * 16, b // 16 * 16)] += 1

    if not bolt_votes:
        return None

    # Build per-frame bolt mask, take alpha-max across all frames.
    union_mask = Image.new("L", (W, runs[0][1] - runs[0][0]), 0)
    pixels = im.load()
    for s, e in runs:
        fh = e - s
        if union_mask.size != (W, fh):
            # Pad/crop to common frame size
            new_union = Image.new("L", (W, fh), 0)
            new_union.paste(union_mask)
            union_mask = new_union
        for y in range(fh):
            for x in range(W):
                r, g, b, a = pixels[x, s + y]
                if a < 80:
                    continue
                # Bolt criterion: near-neutral light pixel.
                if min(r, g, b) > 192 and max(r, g, b) - min(r, g, b) < 32:
                    if a > union_mask.getpixel((x, y)):
                        union_mask.putpixel((x, y), a)

    # Crop to bolt bbox and normalize to a square frame
    bbox = union_mask.getbbox()
    if not bbox:
        return None
    cropped_alpha = union_mask.crop(bbox)
    bw, bh = cropped_alpha.size

    # Composite into a transparent RGBA where the bolt is white (mask-image
    # rendering ignores RGB anyway, only alpha matters).
    bolt_rgba = Image.new("RGBA", (bw, bh), (255, 255, 255, 0))
    bolt_alpha = cropped_alpha
    bolt_rgba.putalpha(bolt_alpha)

    # Center on a transparent BATTERY_BASE_SIDE square. We want the bolt to
    # land where it sits on the source frame, but our normal battery sprite is
    # also center-cropped/normalized — so center-align the bolt within the
    # frame at the same scale ratio as the source frame side.
    src_frame_side = max(runs[0][1] - runs[0][0], W)
    scale = BATTERY_BASE_SIDE / src_frame_side
    new_size = (max(int(round(bw * scale)), 1), max(int(round(bh * scale)), 1))
    bolt_rgba = bolt_rgba.resize(new_size, Image.LANCZOS)

    canvas = Image.new("RGBA", (BATTERY_BASE_SIDE, BATTERY_BASE_SIDE), (0, 0, 0, 0))
    # Position: original bbox center mapped to canvas center
    src_cx = (bbox[0] + bbox[2]) / 2
    src_cy = (bbox[1] + bbox[3]) / 2
    src_w = W
    src_h = runs[0][1] - runs[0][0]
    cx = src_cx / src_w * BATTERY_BASE_SIDE
    cy = src_cy / src_h * BATTERY_BASE_SIDE
    paste_x = int(round(cx - new_size[0] / 2))
    paste_y = int(round(cy - new_size[1] / 2))
    canvas.alpha_composite(bolt_rgba, (paste_x, paste_y))

    out = io.BytesIO()
    canvas.save(out, format="PNG")
    return out.getvalue()


def extract_statusbar_icon_normalized(zf: zipfile.ZipFile, entry_name: str, dst: Path) -> bool:
    """
    Extract and normalize a regular statusbar icon (wifi/signal/bluetooth).
    """
    try:
        data = zf.read(entry_name)
    except KeyError:
        return False
    if not _is_png_bytes(data):
        return False
    if _is_fully_transparent_png_bytes(data):
        return False
    normalized = normalize_png_icon_to_square(data)
    ensure_dir(dst.parent)
    dst.write_bytes(normalized or data)
    return True


def extract_statusbar_icon_normalized_to_square(
    zf: zipfile.ZipFile,
    entry_name: str,
    dst: Path,
    *,
    base_side: int,
) -> bool:
    """
    Like `extract_statusbar_icon_normalized`, but allows custom square side.
    Useful for overlays that must align with battery sprite.
    """
    try:
        data = zf.read(entry_name)
    except KeyError:
        return False
    if not _is_png_bytes(data):
        return False
    if _is_fully_transparent_png_bytes(data):
        return False
    normalized = normalize_png_icon_to_square(data, base_side=base_side)
    ensure_dir(dst.parent)
    dst.write_bytes(normalized or data)
    return True


def best_path_for_basename(
    all_paths: list[str],
    basenames: list[str],
    *,
    prefer_nightmode: Optional[bool] = None,
    prefer_res_root: bool = True,
    avoid_ninepatch: bool = False,
) -> Optional[str]:
    """
    Choose best matching zip entry path for the first matching basename list.
    """
    want = set(basenames)
    candidates = [p for p in all_paths if Path(p).name in want and _is_png(p)]
    if avoid_ninepatch:
        candidates = [p for p in candidates if not p.lower().endswith(".9.png")]
    if not candidates:
        return None

    def score(p: str) -> tuple[int, int, int, int]:
        lower = p.lower()
        s = 0
        # Prefer `res/...` (non-nightmode) or `nightmode/res/...` depending on context
        if prefer_nightmode is True and lower.startswith("nightmode/"):
            s += 50
        if prefer_nightmode is False and not lower.startswith("nightmode/"):
            s += 50
        if prefer_res_root and lower.startswith("res/"):
            s += 10
        # Density
        s += _density_score(p) * 5
        # Avoid _darkmode variants when we are going to tint anyway
        if "_darkmode" in lower:
            s -= 2
        # Prefer drawable over raw unless explicitly targeting raw
        if "/drawable" in lower:
            s += 1
        return (s, _density_score(p), -len(p), 0)

    candidates.sort(key=score, reverse=True)
    return candidates[0]


def find_statusbar_misc_icons(pngs: list[str]) -> dict[str, str]:
    """
    Find common statusbar "extra" icons with stable canonical names.
    Returned keys are our output basenames (without .png).
    """
    mapping: dict[str, list[str]] = {
        # Flight / SIM / connectivity
        "airplane": [
            "stat_sys_signal_flightmode.png",
            "stat_sys_signal_flightmode_darkmode.png",
            "stat_sys_airplane_mode.png",
            "stat_sys_airplane_mode_darkmode.png",
        ],
        "no_sim": ["stat_sys_no_sim.png", "stat_sys_no_sim_darkmode.png"],
        "vpn": ["stat_sys_vpn.png", "stat_sys_vpn_darkmode.png"],
        # Alerts
        "alarm": ["stat_sys_alarm.png", "stat_sys_alarm_darkmode.png"],
        "silent": ["stat_sys_ringer_silent.png", "stat_sys_ringer_silent_darkmode.png"],
        # Accessories
        "headset": [
            "stat_sys_headset.png",
            "stat_sys_headset_darkmode.png",
            "stat_sys_headset_without_mic.png",
            "stat_sys_headset_without_mic_darkmode.png",
        ],
        # Misc toggles
        "nfc": [
            "stat_sys_nfc.png",
            "stat_sys_nfc_darkmode.png",
            "stat_sys_data_nfc.png",
            "stat_sys_data_nfc_darkmode.png",
        ],
        # NOTE: quick_charging intentionally omitted — in HyperOS theme bundles
        # the file is typically a 1×60 empty placeholder (the charging bolt is
        # baked into the `stat_sys_battery_charge` sprite, with color applied at
        # runtime). We render fast-charging via a tint in SystemShell.
        # Null / no-service variants
        "signal_null": [
            "stat_sys_signal_null.png",
            "stat_sys_signal_null_darkmode.png",
            "stat_sys_signal_null_half.png",
            "stat_sys_signal_null_half_darkmode.png",
        ],
        "wifi_null": [
            "stat_sys_wifi_signal_null.png",
            "stat_sys_wifi_signal_null_darkmode.png",
        ],
    }

    out: dict[str, str] = {}
    for key, basenames in mapping.items():
        p = best_path_for_basename(pngs, basenames, prefer_nightmode=False)
        if p:
            out[key] = p
    return out


def find_statusbar_data_type_icons(pngs: list[str]) -> dict[str, str]:
    """
    Find mobile data type icons (4G/5G/LTE/3G/E...), returned as {type: entry_path}.
    We export them as `data_{type}.png`.
    """
    mapping: dict[str, list[str]] = {
        "5g": ["stat_sys_signal_5g.png", "stat_sys_data_5g.png", "stat_sys_5g.png"],
        "4g": ["stat_sys_signal_4g.png", "stat_sys_data_4g.png", "stat_sys_4g.png"],
        "4g_lte": ["stat_sys_signal_4g_lte.png", "stat_sys_data_4g_lte.png"],
        "lte": ["stat_sys_signal_lte.png", "stat_sys_data_lte.png", "stat_sys_lte.png"],
        "3g": ["stat_sys_signal_3g.png", "stat_sys_data_3g.png", "stat_sys_3g.png"],
        "e": ["stat_sys_signal_e.png", "stat_sys_data_e.png", "stat_sys_e.png"],
    }

    out: dict[str, str] = {}
    for t, basenames in mapping.items():
        p = best_path_for_basename(pngs, basenames, prefer_nightmode=False)
        if p:
            out[t] = p
    return out


def find_statusbar_icons(zf: zipfile.ZipFile) -> dict[str, str]:
    names = zf.namelist()
    pngs = [n for n in names if _is_png(n)]

    # Prefer non-nightmode for status bar; we tint icons in runtime anyway.
    out: dict[str, str] = {}

    wifi = best_path_for_basename(
        pngs,
        ["stat_sys_wifi_signal_4.png", "stat_sys_wifi_signal_3.png", "stat_sys_wifi_signal_2.png"],
        prefer_nightmode=False,
    )
    if wifi:
        out["wifi"] = wifi

    signal = best_path_for_basename(
        pngs,
        ["stat_sys_signal_4.png", "stat_sys_signal_5.png", "stat_sys_signal_3.png"],
        prefer_nightmode=False,
    )
    if signal:
        out["signal"] = signal

    bt = best_path_for_basename(
        pngs,
        ["stat_sys_data_bluetooth.png", "stat_sys_data_bluetooth_connected.png"],
        prefer_nightmode=False,
    )
    if bt:
        out["bluetooth"] = bt

    # Battery: many HyperOS themes use `res/raw-*/stat_sys_battery.png`
    battery = best_path_for_basename(
        pngs,
        [
            "stat_sys_battery_100.png",
            "stat_sys_battery_full.png",
            "stat_sys_battery.png",
        ],
        prefer_nightmode=False,
    )
    if battery:
        out["battery"] = battery

    return out


def extract_statusbar_wifi_levels(zf: zipfile.ZipFile, out_dir: Path) -> int:
    """
    Export Wi-Fi signal icons by level: wifi_0..4.png (+ wifi.png alias).
    Returns number of levels exported (0 if not possible).
    """
    names = zf.namelist()
    pngs = [n for n in names if _is_png(n)]
    levels = [0, 1, 2, 3, 4]

    found: dict[int, str] = {}
    for lvl in levels:
        entry = best_path_for_basename(
            pngs,
            [f"stat_sys_wifi_signal_{lvl}.png", f"stat_sys_wifi_signal_{lvl}_darkmode.png"],
            prefer_nightmode=False,
        )
        if entry:
            found[lvl] = entry

    # Fallback: use the highest available level
    fallback = None
    for lvl in reversed(levels):
        p = found.get(lvl)
        if not p:
            continue
        try:
            if not _is_fully_transparent_png_bytes(zf.read(p)):
                fallback = p
                break
        except Exception:
            continue
    if not fallback:
        # any non-transparent
        for p in found.values():
            try:
                if not _is_fully_transparent_png_bytes(zf.read(p)):
                    fallback = p
                    break
            except Exception:
                continue
    if not fallback:
        return 0

    ensure_dir(out_dir)
    for lvl in levels:
        entry = found.get(lvl)
        if entry:
            ok = extract_statusbar_icon_normalized(zf, entry, out_dir / f"wifi_{lvl}.png")
            if not ok:
                ok = extract_statusbar_icon_normalized(zf, fallback, out_dir / f"wifi_{lvl}.png")
        else:
            ok = extract_statusbar_icon_normalized(zf, fallback, out_dir / f"wifi_{lvl}.png")
        if not ok:
            return 0

    # wifi.png = full level
    try:
        shutil.copy2(out_dir / "wifi_4.png", out_dir / "wifi.png")
    except Exception:
        pass
    return len(levels)


def extract_statusbar_signal_levels(zf: zipfile.ZipFile, out_dir: Path) -> int:
    """
    Export cellular signal icons by level: signal_0..5.png (+ signal.png alias).
    Returns number of levels exported (0 if not possible).
    """
    names = zf.namelist()
    pngs = [n for n in names if _is_png(n)]
    levels = [0, 1, 2, 3, 4, 5]

    found: dict[int, str] = {}
    for lvl in levels:
        entry = best_path_for_basename(
            pngs,
            [f"stat_sys_signal_{lvl}.png", f"stat_sys_signal_{lvl}_darkmode.png"],
            prefer_nightmode=False,
        )
        if entry:
            found[lvl] = entry

    fallback = None
    for lvl in reversed(levels):
        p = found.get(lvl)
        if not p:
            continue
        try:
            if not _is_fully_transparent_png_bytes(zf.read(p)):
                fallback = p
                break
        except Exception:
            continue
    if not fallback:
        for p in found.values():
            try:
                if not _is_fully_transparent_png_bytes(zf.read(p)):
                    fallback = p
                    break
            except Exception:
                continue
    if not fallback:
        return 0

    ensure_dir(out_dir)
    for lvl in levels:
        entry = found.get(lvl)
        if entry:
            ok = extract_statusbar_icon_normalized(zf, entry, out_dir / f"signal_{lvl}.png")
            if not ok:
                ok = extract_statusbar_icon_normalized(zf, fallback, out_dir / f"signal_{lvl}.png")
        else:
            ok = extract_statusbar_icon_normalized(zf, fallback, out_dir / f"signal_{lvl}.png")
        if not ok:
            return 0

    # signal.png = full level (prefer 5)
    try:
        src = out_dir / ("signal_5.png" if (out_dir / "signal_5.png").exists() else "signal_4.png")
        shutil.copy2(src, out_dir / "signal.png")
    except Exception:
        pass
    return len(levels)


def find_shade_backgrounds(zf: zipfile.ZipFile) -> dict[str, str]:
    names = zf.namelist()
    pngs = [n for n in names if _is_png(n)]

    # Control center in this project is dark-blur; prefer nightmode assets.
    active = best_path_for_basename(
        pngs,
        [
            "ic_cc_qs_bg_active_normal.png",
            "qs_tile_bg_on.png",
            "qs_background_enabled.png",
            "ic_qs_bg_enabled.png",
        ],
        prefer_nightmode=True,
        avoid_ninepatch=True,
    )
    inactive = best_path_for_basename(
        pngs,
        [
            "ic_cc_qs_bg_inactive.png",
            "qs_tile_bg_off.png",
            "qs_background_disabled.png",
            "ic_qs_bg_disabled.png",
        ],
        prefer_nightmode=True,
        avoid_ninepatch=True,
    )
    out: dict[str, str] = {}
    if active:
        out["active"] = active
    if inactive:
        out["inactive"] = inactive
    return out


def extract_app_icons_from_icons_mrc(
    mrc_path: Path,
    out_dir: Path,
    package_names: list[str],
) -> list[str]:
    if not mrc_path.exists():
        return []
    extracted: list[str] = []
    with zipfile.ZipFile(mrc_path, "r") as zf:
        names = [n for n in zf.namelist() if _is_png(n)]
        # Build basename->best path mapping once
        best_by_key: dict[str, str] = {}
        for n in names:
            if not n.startswith("res/") and not n.startswith("nightmode/"):
                continue
            base = Path(n).name
            if not base.lower().endswith(".png"):
                continue
            key = base[:-4]
            prev = best_by_key.get(key)
            if prev is None:
                best_by_key[key] = n
            else:
                if _density_score(n) > _density_score(prev):
                    best_by_key[key] = n

        ensure_dir(out_dir)
        for pkg in package_names:
            entry = best_by_key.get(pkg)
            if not entry:
                # Fallback: common path
                fallback = f"res/drawable-xxhdpi/{pkg}.png"
                entry = fallback if fallback in names else None
            if not entry:
                continue
            dst = out_dir / f"{pkg}.png"
            if extract_zip_entry(zf, entry, dst):
                extracted.append(pkg)
    return extracted


def extract_selected_component_assets(
    mrc_path: Path,
    out_component_dir: Path,
    asset_names: list[str],
    *,
    prefer_nightmode: bool,
) -> list[str]:
    if not mrc_path.exists() or not asset_names:
        return []
    extracted: list[str] = []
    with zipfile.ZipFile(mrc_path, "r") as zf:
        names = zf.namelist()
        pngs = [n for n in names if _is_png(n)]

        for a in asset_names:
            # Prefer exact drawable hit first (xxhdpi)
            preferred_basenames = [f"{a}.png", f"{a}.9.png"]
            chosen = best_path_for_basename(
                pngs,
                preferred_basenames,
                prefer_nightmode=prefer_nightmode,
                prefer_res_root=True,
            )
            if not chosen:
                continue
            dst = out_component_dir / chosen
            if extract_zip_entry(zf, chosen, dst):
                extracted.append(a)
    return extracted


CLOCK_WIDGET_CODES = ["clock_2x4", "clock_3x4"]
CLOCK_SPAN: dict[str, tuple[int, int]] = {
    "clock_2x4": (4, 2),
    "clock_3x4": (4, 3),
}
VARIANT_SPEC: dict[str, tuple[int, int]] = {
    "widget_2x2": (2, 2),
    "widget_4x2": (4, 2),
    "widget_3x4": (3, 4),
    "widget_4x4": (4, 4),
}


def extract_clock_widget_mrc(mrc_path: Path, out_dir: Path) -> bool:
    """
    Extract a clock widget .mrc (zip) into out_dir, preserving internal paths.
    Returns True if at least one file was extracted.
    """
    if not mrc_path.exists():
        return False
    try:
        with zipfile.ZipFile(mrc_path, "r") as zf:
            ensure_dir(out_dir)
            count = 0
            for info in zf.infolist():
                if info.is_dir():
                    continue
                dst = out_dir / info.filename
                ensure_dir(dst.parent)
                with zf.open(info, "r") as src, dst.open("wb") as out:
                    shutil.copyfileobj(src, out)
                count += 1
            return count > 0
    except zipfile.BadZipFile:
        return False


def extract_standalone_maml_widget(
    widget_dir: Path,
    dest_root: Path,
) -> Optional[dict]:
    """
    Extract a standalone MAML widget from themes/maml_widget/<id>/.
    Returns a manifest entry dict, or None on failure.
    """
    meta_path = widget_dir / "meta.json"
    if not meta_path.exists():
        return None
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return None

    widget_id = meta.get("id") or widget_dir.name
    title = pick_locale_field(meta, "titleMap") or meta.get("title") or widget_id
    author = (
        pick_locale_field(meta, "authorMap")
        or pick_locale_field(meta, "designerMap")
        or ""
    )
    description = pick_locale_field(meta, "descMap") or meta.get("desc") or ""

    out_dir = dest_root / widget_id
    if out_dir.exists():
        shutil.rmtree(out_dir)
    ensure_dir(out_dir)

    # Copy previews
    preview_src = widget_dir / "preview"
    if preview_src.is_dir():
        copy_tree(preview_src, out_dir / "preview")

    # Extract each variant zip
    variants: list[dict] = []
    for variant_name, (sx, sy) in VARIANT_SPEC.items():
        variant_file = widget_dir / variant_name
        if not variant_file.exists():
            continue
        variant_out = out_dir / variant_name
        try:
            with zipfile.ZipFile(variant_file, "r") as zf:
                ensure_dir(variant_out)
                count = 0
                for info in zf.infolist():
                    if info.is_dir():
                        continue
                    dst = variant_out / info.filename
                    ensure_dir(dst.parent)
                    with zf.open(info, "r") as src, dst.open("wb") as out_f:
                        shutil.copyfileobj(src, out_f)
                    count += 1
                if count == 0:
                    continue
        except zipfile.BadZipFile:
            continue

        # Preview image path (relative to widget root)
        preview_file = f"preview/{variant_name}.png"
        if not (out_dir / preview_file).exists():
            preview_file = ""

        variants.append({
            "entry": variant_name,
            "spanX": sx,
            "spanY": sy,
            "preview": preview_file,
        })

    if not variants:
        # No usable variants; clean up
        if out_dir.exists():
            shutil.rmtree(out_dir)
        return None

    # Collect all preview filenames for the manifest entry
    previews: list[str] = []
    preview_out = out_dir / "preview"
    if preview_out.is_dir():
        previews = sorted(p.name for p in preview_out.iterdir() if p.is_file())

    return {
        "id": widget_id,
        "title": title,
        "author": author,
        "description": description,
        "type": "widget",
        "previews": previews,
        "variants": variants,
    }


def extract_wallpaper(mrc_path: Path, out_dir: Path) -> Optional[str]:
    if not mrc_path.exists():
        return None
    ensure_dir(out_dir)
    # Wallpaper packages vary; best-effort:
    try:
        with zipfile.ZipFile(mrc_path, "r") as zf:
            infos = [i for i in zf.infolist() if not i.is_dir()]
            # prefer larger image files
            candidates = [
                i
                for i in infos
                if Path(i.filename).suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
            ]
            # Filter obvious thumbnails
            filtered = []
            for i in candidates:
                n = i.filename.lower()
                if "thumb" in n or "thumbnail" in n or "small" in n:
                    continue
                filtered.append(i)
            candidates = filtered or candidates
            if not candidates:
                return None
            candidates.sort(key=lambda i: i.file_size, reverse=True)
            pick = candidates[0]
            ext = Path(pick.filename).suffix.lower().lstrip(".") or "jpg"
            out_name = f"default.{ext}"
            if extract_zip_entry(zf, pick.filename, out_dir / out_name):
                return out_name
            return None
    except zipfile.BadZipFile:
        # Some wallpaper .mrc are raw image bytes; detect common formats by signature.
        data = mrc_path.read_bytes()
        head = data[:16]
        ext = "bin"
        if head.startswith(b"\xff\xd8\xff"):
            ext = "jpg"
        elif head.startswith(b"\x89PNG\r\n\x1a\n"):
            ext = "png"
        elif len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            ext = "webp"
        elif head.startswith(b"GIF87a") or head.startswith(b"GIF89a"):
            ext = "gif"
        out_name = f"default.{ext}"
        (out_dir / out_name).write_bytes(data)
        return out_name


def pick_locale_field(d: dict, key: str) -> str:
    m = d.get(key)
    if not isinstance(m, dict):
        return ""
    return str(m.get("zh_CN") or m.get("fallback") or (next(iter(m.values()), "")) or "")


def build_theme_entry(theme_meta: dict) -> dict:
    theme_id = str(theme_meta.get("localId") or "")
    title = pick_locale_field(theme_meta, "titles") or theme_id
    author = pick_locale_field(theme_meta, "authors") or pick_locale_field(theme_meta, "designers") or ""
    description = pick_locale_field(theme_meta, "descriptions") or ""
    built_in_previews = []
    bip = theme_meta.get("builtInPreviews") or {}
    if isinstance(bip, dict):
        v = bip.get("fallback")
        if isinstance(v, list):
            built_in_previews = [str(x) for x in v if x]
    sub_resources = [
        {"resourceCode": code, "localId": local_id}
        for code, local_id in iter_subresources(theme_meta)
    ]
    return {
        "id": theme_id,
        "title": title,
        "author": author,
        "description": description,
        "price": theme_meta.get("price") if isinstance(theme_meta.get("price"), (int, float)) else None,
        "version": str(theme_meta.get("version")) if theme_meta.get("version") is not None else None,
        "assemblyId": str(theme_meta.get("assemblyId")) if theme_meta.get("assemblyId") else None,
        "previews": built_in_previews,
        "subResources": sub_resources,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--src",
        default="themes",
        help="Source themes directory (default: ./themes)",
    )
    parser.add_argument(
        "--dest",
        default="mobilegym-data/themes",
        help="Destination directory (default: ./mobilegym-data/themes)",
    )
    parser.add_argument(
        "--themes",
        nargs="*",
        default=DEFAULT_THEME_IDS,
        help="Theme localIds to include (default: a curated set)",
    )
    parser.add_argument(
        "--all-themes",
        action="store_true",
        help="Include ALL themes under themes/meta/theme (ignores --themes)",
    )
    parser.add_argument(
        "--default-theme-id",
        default=DEFAULT_DEFAULT_THEME_ID,
        help="Default theme id written into manifest.json",
    )
    parser.add_argument(
        "--no-fonts",
        action="store_true",
        help="Do NOT include fonts under themes/meta/fonts (preview only)",
    )
    parser.add_argument(
        "--no-aod",
        action="store_true",
        help="Do NOT include AOD under themes/meta/aod (preview only)",
    )
    parser.add_argument(
        "--no-widgets",
        action="store_true",
        help="Do NOT include standalone MAML widgets under themes/maml_widget",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Delete existing destination directory (e.g. mobilegym-data/themes) before writing",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    src_root = (root / args.src).resolve()
    dest_root = (root / args.dest).resolve()

    if not src_root.exists():
        raise SystemExit(f"Source not found: {src_root}")
    if args.clean and dest_root.exists():
        shutil.rmtree(dest_root)
    ensure_dir(dest_root)

    package_names = parse_app_package_names(root)
    settings_icon_names = parse_settings_main_icon_names(root)

    # Small sets used by other apps:
    contact_asset_names = [f"dialpad_{d}" for d in list("0123456789")] + ["dialpad_*", "dialpad_#"] + [
        f"key_{d}" for d in list("0123456789")
    ] + ["key_*", "key_#", "call_button"]
    mms_asset_names = [
        "bubble_out",
        "bubble_send",
        "msg_out",
        "message_out",
        "chat_to",
        "sms_out",
        "bubble_in",
        "bubble_recv",
        "msg_in",
        "message_in",
        "chat_from",
        "sms_in",
    ]

    # Source dirs
    src_meta_theme = src_root / "meta/theme"
    src_meta_fonts = src_root / "meta/fonts"
    src_meta_aod = src_root / "meta/aod"
    src_preview_theme = src_root / "preview/theme"
    src_content_base = src_root / "content"

    # Theme ids to process
    if args.all_themes:
        theme_ids = sorted([p.stem for p in src_meta_theme.glob("*.mrm")])
    else:
        theme_ids = list(args.themes)

    missing: list[str] = []
    themes_out: list[dict] = []
    fonts_out: list[dict] = []
    aod_out: list[dict] = []
    clock_widgets_collected: list[dict] = []
    skipped_wrappers: dict[str, list[str]] = {"fonts_only": [], "aod_only": []}

    for theme_id in theme_ids:
        theme_meta_path = src_meta_theme / f"{theme_id}.mrm"
        if not theme_meta_path.exists():
            missing.append(f"meta/theme/{theme_id}.mrm")
            continue

        meta = read_json(theme_meta_path)

        # Some entries under meta/theme are actually "wrapper resources" for fonts/AOD only.
        # When exporting all themes, we keep categories clean by excluding these from `themes`.
        codes = sorted({code for code, _ in iter_subresources(meta)})
        if codes == ["fonts"]:
            skipped_wrappers["fonts_only"].append(theme_id)
            continue
        if codes == ["aod"]:
            skipped_wrappers["aod_only"].append(theme_id)
            continue

        entry = build_theme_entry(meta)
        entry["type"] = "full"

        # Prepare destination dirs
        theme_dir = dest_root / theme_id
        preview_dir = theme_dir / "preview"
        icons_dir = theme_dir / "icons"
        statusbar_dir = theme_dir / "statusbar"
        shade_dir = theme_dir / "shade"
        wallpaper_dir = theme_dir / "wallpaper"
        components_dir = theme_dir / "components"

        # Fresh theme dir (avoid stale files when re-running without --clean)
        if theme_dir.exists():
            shutil.rmtree(theme_dir)
        ensure_dir(theme_dir)

        # Copy previews
        copy_tree(src_preview_theme / theme_id, preview_dir)

        # Subresources lookup
        sub_map: dict[str, str] = {code: local_id for code, local_id in iter_subresources(meta)}

        capabilities: list[str] = []
        extracted: dict = {}

        # ---- App icons ----
        icons_local_id = sub_map.get("icons")
        if icons_local_id:
            capabilities.append("icons")
            icons_mrc = src_content_base / "icons" / f"{icons_local_id}.mrc"
            try:
                extracted_pkgs = extract_app_icons_from_icons_mrc(icons_mrc, icons_dir, package_names)
            except zipfile.BadZipFile:
                extracted_pkgs = []
            entry["iconPackageNames"] = extracted_pkgs
            extracted["icons"] = bool(extracted_pkgs)
        else:
            entry["iconPackageNames"] = []

        # ---- Status bar icons + shade backgrounds ----
        status_local_id = sub_map.get("statusbar")
        statusbar_icons: list[str] = []
        statusbar_dynamic: dict[str, object] = {}
        shade: dict[str, bool] = {"active": False, "inactive": False}
        if status_local_id:
            capabilities.append("statusbar")
            status_mrc = src_content_base / "statusbar" / f"{status_local_id}.mrc"
            try:
                with zipfile.ZipFile(status_mrc, "r") as zf:
                    names = zf.namelist()
                    pngs = [n for n in names if _is_png(n)]

                    sb = find_statusbar_icons(zf)
                    # bluetooth (static)
                    if "bluetooth" in sb:
                        if extract_statusbar_icon_normalized(zf, sb["bluetooth"], statusbar_dir / "bluetooth.png"):
                            statusbar_icons.append("bluetooth")

                    # wifi levels (+ wifi.png alias)
                    wifi_levels = extract_statusbar_wifi_levels(zf, statusbar_dir)
                    if wifi_levels:
                        statusbar_icons.append("wifi")
                        statusbar_dynamic["wifiLevels"] = wifi_levels
                    elif "wifi" in sb:
                        if extract_statusbar_icon_normalized(zf, sb["wifi"], statusbar_dir / "wifi.png"):
                            statusbar_icons.append("wifi")

                    # signal levels (+ signal.png alias)
                    signal_levels = extract_statusbar_signal_levels(zf, statusbar_dir)
                    if signal_levels:
                        statusbar_icons.append("signal")
                        statusbar_dynamic["signalLevels"] = signal_levels
                    elif "signal" in sb:
                        if extract_statusbar_icon_normalized(zf, sb["signal"], statusbar_dir / "signal.png"):
                            statusbar_icons.append("signal")

                    # battery: export sprite + full frame
                    if "battery" in sb:
                        info = extract_statusbar_battery_assets(zf, sb["battery"], statusbar_dir)
                        if info:
                            statusbar_icons.append("battery")
                            # Only include non-null values in manifest
                            if isinstance(info.get("batteryFrames"), int):
                                statusbar_dynamic["batteryFrames"] = info["batteryFrames"]
                            if isinstance(info.get("batteryFrameSide"), int):
                                statusbar_dynamic["batteryFrameSide"] = info["batteryFrameSide"]
                            if isinstance(info.get("batterySprite"), str) and info["batterySprite"]:
                                statusbar_dynamic["batterySprite"] = info["batterySprite"]

                    # State variant sprites — preserve theme RGBA so the front-end
                    # can render the theme designer's chosen colors directly
                    # (charging green, saver yellow, etc.). Front-end falls back
                    # to runtime tint on the base sprite when a variant is missing.
                    charge_entry = best_path_for_basename(
                        pngs,
                        ["stat_sys_battery_charge.png", "stat_sys_battery_charge_darkmode.png"],
                        prefer_nightmode=False,
                    )
                    if charge_entry:
                        ch_info = extract_statusbar_battery_variant_assets(
                            zf, charge_entry, statusbar_dir,
                            prefix="battery_charge", manifest_prefix="batteryCharge",
                        )
                        if ch_info:
                            statusbar_dynamic.update(ch_info)

                    power_save_entry = best_path_for_basename(
                        pngs,
                        ["stat_sys_battery_power_save.png", "stat_sys_battery_power_save_darkmode.png"],
                        prefer_nightmode=False,
                    )
                    if power_save_entry:
                        ps_info = extract_statusbar_battery_variant_assets(
                            zf, power_save_entry, statusbar_dir,
                            prefix="battery_power_save", manifest_prefix="batteryPowerSave",
                        )
                        # Drop the variant if it's pixel-identical to the normal
                        # sprite (some themes ship the same PNG for both, with the
                        # color difference applied at runtime in MIUI). The
                        # front-end's system-tint path will produce yellow itself.
                        if ps_info and _png_pixel_identical(
                            statusbar_dir / "battery_sprite.png",
                            statusbar_dir / "battery_power_save_sprite.png",
                        ):
                            (statusbar_dir / "battery_power_save.png").unlink(missing_ok=True)
                            (statusbar_dir / "battery_power_save_sprite.png").unlink(missing_ok=True)
                        elif ps_info:
                            statusbar_dynamic.update(ps_info)

                    power_save_charge_entry = best_path_for_basename(
                        pngs,
                        ["stat_sys_battery_power_save_charge.png",
                         "stat_sys_battery_power_save_charge_darkmode.png"],
                        prefer_nightmode=False,
                    )
                    if power_save_charge_entry:
                        psc_info = extract_statusbar_battery_variant_assets(
                            zf, power_save_charge_entry, statusbar_dir,
                            prefix="battery_power_save_charge",
                            manifest_prefix="batteryPowerSaveCharge",
                        )
                        if psc_info and _png_pixel_identical(
                            statusbar_dir / "battery_charge_sprite.png",
                            statusbar_dir / "battery_power_save_charge_sprite.png",
                        ):
                            (statusbar_dir / "battery_power_save_charge.png").unlink(missing_ok=True)
                            (statusbar_dir / "battery_power_save_charge_sprite.png").unlink(missing_ok=True)
                        elif psc_info:
                            statusbar_dynamic.update(psc_info)

                    # Charging bolt overlay (used by the system-tint fallback path
                    # when a theme doesn't ship a `_charge` variant). Two sources:
                    #   1. Real `stat_sys_battery_charging.png` overlay (some
                    #      themes provide a single-frame bolt drawable).
                    #   2. Color-encoded bolt extracted from the charge sprite —
                    #      MIUI bakes body fill in saturated color and the bolt in
                    #      neutral gray within the same alpha shape; we isolate
                    #      the gray-only pixels and collapse to a single overlay.
                    bolt_overlay_entry = best_path_for_basename(
                        pngs,
                        [
                            "stat_sys_battery_charging.png",
                            "stat_sys_battery_charging_darkmode.png",
                            "battery_meter_charging.png",
                            "battery_meter_charging_dark.png",
                        ],
                        prefer_nightmode=False,
                    )
                    bolt_written = False
                    if bolt_overlay_entry:
                        try:
                            raw = zf.read(bolt_overlay_entry)
                            if _png_has_visible_alpha(raw):
                                normalized = normalize_png_icon_to_square(raw, base_side=BATTERY_BASE_SIDE)
                                ensure_dir(statusbar_dir)
                                (statusbar_dir / "battery_bolt.png").write_bytes(normalized or raw)
                                statusbar_dynamic["batteryBoltOverlay"] = "battery_bolt.png"
                                bolt_written = True
                        except KeyError:
                            pass
                    if not bolt_written and charge_entry:
                        try:
                            raw = zf.read(charge_entry)
                            bolt_bytes = extract_battery_bolt_from_charge_png(raw)
                            if bolt_bytes:
                                ensure_dir(statusbar_dir)
                                (statusbar_dir / "battery_bolt.png").write_bytes(bolt_bytes)
                                statusbar_dynamic["batteryBoltOverlay"] = "battery_bolt.png"
                        except KeyError:
                            pass

                    # mobile data type icons (4G/5G/LTE...)
                    data_types = find_statusbar_data_type_icons(pngs)
                    exported_types: list[str] = []
                    for t, entry_path in data_types.items():
                        name = f"data_{t}"
                        if extract_statusbar_icon_normalized(zf, entry_path, statusbar_dir / f"{name}.png"):
                            statusbar_icons.append(name)
                            exported_types.append(t)
                    if exported_types:
                        statusbar_dynamic["dataTypes"] = sorted(set(exported_types))

                    # misc extras (airplane/no_sim/vpn/alarm/...)
                    misc = find_statusbar_misc_icons(pngs)
                    for name, entry_path in misc.items():
                        if extract_statusbar_icon_normalized(zf, entry_path, statusbar_dir / f"{name}.png"):
                            statusbar_icons.append(name)

                    sh = find_shade_backgrounds(zf)
                    if "active" in sh and extract_zip_entry(zf, sh["active"], shade_dir / "active.png"):
                        shade["active"] = True
                    if "inactive" in sh and extract_zip_entry(zf, sh["inactive"], shade_dir / "inactive.png"):
                        shade["inactive"] = True
            except zipfile.BadZipFile:
                pass

        entry["statusbarIcons"] = sorted(set(statusbar_icons))
        if statusbar_dynamic:
            entry["statusbarDynamic"] = statusbar_dynamic
        if statusbar_icons:
            extracted["statusbar"] = True
        if shade["active"] or shade["inactive"]:
            capabilities.append("shade")
            extracted["shade"] = shade

        # ---- Wallpaper ----
        wallpaper_local_id = sub_map.get("wallpaper")
        if wallpaper_local_id:
            capabilities.append("wallpaper")
            wp_mrc = src_content_base / "wallpaper" / f"{wallpaper_local_id}.mrc"
            wp_name = extract_wallpaper(wp_mrc, wallpaper_dir)
            if wp_name:
                extracted["wallpaper"] = {"default": wp_name}

        # ---- Selected component assets (for getAppAsset) ----
        # Settings icons (prefer non-nightmode for light Settings UI)
        settings_local_id = sub_map.get("com.android.settings")
        if settings_local_id and settings_icon_names:
            capabilities.append("settings")
            mrc = src_content_base / "com.android.settings" / f"{settings_local_id}.mrc"
            extracted_names = extract_selected_component_assets(
                mrc,
                components_dir / "com.android.settings",
                settings_icon_names,
                prefer_nightmode=False,
            )
            if extracted_names:
                extracted["com.android.settings"] = {"count": len(extracted_names)}

        # Contact dialpad assets (light UI)
        contact_local_id = sub_map.get("contact")
        if contact_local_id:
            capabilities.append("contact")
            mrc = src_content_base / "contact" / f"{contact_local_id}.mrc"
            extracted_names = extract_selected_component_assets(
                mrc,
                components_dir / "contact",
                contact_asset_names,
                prefer_nightmode=False,
            )
            if extracted_names:
                extracted["contact"] = {"count": len(extracted_names)}

        # MMS bubble assets (light UI)
        mms_local_id = sub_map.get("mms")
        if mms_local_id:
            capabilities.append("mms")
            mrc = src_content_base / "mms" / f"{mms_local_id}.mrc"
            extracted_names = extract_selected_component_assets(
                mrc,
                components_dir / "mms",
                mms_asset_names,
                prefer_nightmode=False,
            )
            if extracted_names:
                extracted["mms"] = {"count": len(extracted_names)}

        # ---- Clock widgets (MAML, from theme subResources) ----
        for clock_code in CLOCK_WIDGET_CODES:
            clock_local_id = sub_map.get(clock_code)
            if not clock_local_id:
                continue
            mrc = src_content_base / clock_code / f"{clock_local_id}.mrc"
            clock_out = theme_dir / clock_code
            if extract_clock_widget_mrc(mrc, clock_out):
                extracted[clock_code] = True
                # Copy built-in preview if available
                preview_name = f"preview_{clock_code}_0.png"
                preview_src = src_preview_theme / theme_id / preview_name
                if preview_src.exists():
                    shutil.copy2(preview_src, clock_out / "preview.png")
                # Collect for widgets array
                spanX, spanY = CLOCK_SPAN.get(clock_code, (4, 2))
                clock_widgets_collected.append({
                    "themeId": theme_id,
                    "themeTitle": entry.get("title", theme_id),
                    "clockCode": clock_code,
                    "spanX": spanX,
                    "spanY": spanY,
                    "hasPreview": preview_src.exists(),
                })

        entry["capabilities"] = sorted(set(capabilities))
        entry["extracted"] = extracted

        # ---- componentAssets: index of available PNGs per component dir ----
        component_assets: dict[str, dict[str, str]] = {}
        if components_dir.is_dir():
            for comp_path in sorted(components_dir.iterdir()):
                if not comp_path.is_dir():
                    continue
                assets: dict[str, str] = {}
                for png in sorted(comp_path.rglob("*.png")):
                    rel = str(png.relative_to(comp_path))
                    base = png.stem
                    if png.name.endswith(".9.png"):
                        base = png.name[:-6]
                    if base not in assets:
                        assets[base] = rel
                if assets:
                    component_assets[comp_path.name] = assets
        if component_assets:
            entry["componentAssets"] = component_assets

        themes_out.append(entry)

    # ---- Optional: fonts / AOD (preview-only) ----
    if not args.no_fonts and src_meta_fonts.exists():
        for p in sorted(src_meta_fonts.glob("*.mrm")):
            meta = read_json(p)
            entry = build_theme_entry(meta)
            entry["type"] = "font"
            font_id = entry.get("id") or p.stem
            font_dir = dest_root / font_id
            if font_dir.exists():
                shutil.rmtree(font_dir)
            ensure_dir(font_dir)
            copy_tree(src_preview_theme / font_id, font_dir / "preview")
            fonts_out.append(entry)

    if not args.no_aod and src_meta_aod.exists():
        for p in sorted(src_meta_aod.glob("*.mrm")):
            meta = read_json(p)
            entry = build_theme_entry(meta)
            entry["type"] = "aod"
            aod_id = entry.get("id") or p.stem
            aod_dir = dest_root / aod_id
            if aod_dir.exists():
                shutil.rmtree(aod_dir)
            ensure_dir(aod_dir)
            copy_tree(src_preview_theme / aod_id, aod_dir / "preview")
            aod_out.append(entry)

    # ---- Clock widgets (from themes) → widget entries ----
    widgets_out: list[dict] = []
    for cw in clock_widgets_collected:
        widget_id = f"{cw['themeId']}_{cw['clockCode']}"
        preview_rel = (
            f"/themes/{cw['themeId']}/{cw['clockCode']}/preview.png"
            if cw["hasPreview"] else ""
        )
        widgets_out.append({
            "id": widget_id,
            "title": f"{cw['themeTitle']}时钟",
            "author": "",
            "description": "",
            "source": "theme",
            "themeId": cw["themeId"],
            "variants": [
                {
                    "entry": cw["clockCode"],
                    "spanX": cw["spanX"],
                    "spanY": cw["spanY"],
                    "preview": preview_rel,
                }
            ],
        })

    # ---- Standalone MAML widgets ----
    src_maml_widget = src_root / "maml_widget"
    if not args.no_widgets and src_maml_widget.exists():
        for widget_dir in sorted(src_maml_widget.iterdir()):
            if not widget_dir.is_dir():
                continue
            entry = extract_standalone_maml_widget(widget_dir, dest_root)
            if entry:
                widgets_out.append(entry)

    manifest = {
        "version": 1,
        "generatedAt": _now_iso(),
        "defaultThemeId": args.default_theme_id,
        "themes": themes_out,
        "fonts": fonts_out,
        "aod": aod_out,
        "widgets": widgets_out,
    }

    ensure_dir(dest_root)
    (dest_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("=== Theme preparation (V2 static) complete ===")
    print(f"Output dir: {dest_root}")
    print(f"Themes:      {len(themes_out)}")
    print(f"Widgets:     {len(widgets_out)}")
    if skipped_wrappers["fonts_only"] or skipped_wrappers["aod_only"]:
        print(f"Skipped wrappers (fonts_only): {len(skipped_wrappers['fonts_only'])}")
        print(f"Skipped wrappers (aod_only):   {len(skipped_wrappers['aod_only'])}")
    if missing:
        print("")
        print("Missing files (skipped):")
        for m in missing[:200]:
            print(f" - {m}")
        if len(missing) > 200:
            print(f" ... and {len(missing) - 200} more")


if __name__ == "__main__":
    main()
