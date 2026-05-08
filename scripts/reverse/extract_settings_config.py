#!/usr/bin/env python3
"""
从反编译的设置 App 资源中提取配置数据，生成 JSON 配置文件。

用法:
  python scripts/reverse/extract_settings_config.py

输出:
  apps/Settings/data/pages.json
"""

from __future__ import annotations
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterable, Optional

# --- Paths ---
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DECOMPILED_DIR = PROJECT_ROOT / "decompiled" / "Settings_decompiled"
RES_DIR = DECOMPILED_DIR / "res"
OUTPUT_DIR = PROJECT_ROOT / "apps" / "Settings" / "data"

ANDROID_NS = "http://schemas.android.com/apk/res/android"
SETTINGS_NS = "http://schemas.android.com/apk/res-auto"
# Some Settings XML files use this instead of res-auto (AOSP style).
SETTINGS_NS_COM_ANDROID_SETTINGS = "http://schemas.android.com/apk/res/com.android.settings"
SETTINGS_NS_CANDIDATES = [
    SETTINGS_NS,
    SETTINGS_NS_COM_ANDROID_SETTINGS,
]


def ns(attr: str) -> str:
    return f"{{{ANDROID_NS}}}{attr}"


def sns(attr: str) -> str:
    return f"{{{SETTINGS_NS}}}{attr}"


def any_sns(attr: str) -> list[str]:
    """Return possible namespaced attribute keys for a Settings custom namespace."""
    return [f"{{{ns_uri}}}{attr}" for ns_uri in SETTINGS_NS_CANDIDATES]


def get_attr_any_ns(elem: ET.Element, attr: str) -> str:
    """
    Get an attribute value across likely namespaces:
    - android:attr
    - settings:attr (res-auto / com.android.settings)
    - un-namespaced attr (rare)
    """
    v = elem.get(ns(attr))
    if v:
        return v
    for k in any_sns(attr):
        vv = elem.get(k)
        if vv:
            return vv
    v2 = elem.get(attr)
    return v2 or ""


# ── String extraction ──────────────────────────────────────────────

def parse_strings(xml_path: Path) -> dict[str, str]:
    """Parse strings.xml into a name -> value dict."""
    strings = {}
    if not xml_path.exists():
        return strings
    try:
        tree = ET.parse(xml_path)
        for elem in tree.getroot().iter("string"):
            name = elem.get("name", "")
            val = (elem.text or "").strip()
            if name and val:
                strings[name] = val
    except Exception as e:
        print(f"  Warning: failed to parse {xml_path}: {e}")
    return strings


def resolve_string(val: str, zh_strings: dict, en_strings: dict) -> str:
    """Resolve @string/xxx to actual text. Prefer zh-CN."""
    if not val:
        return ""
    seen: set[str] = set()
    cur = val
    # Resolve @string aliases (may be chained)
    while cur.startswith("@string/"):
        key = cur[8:]
        if not key or key in seen:
            break
        seen.add(key)
        cur = zh_strings.get(key, en_strings.get(key, key))
        if cur == key:
            break
    return cur


# ── Array extraction (string-array / integer-array) ────────────────

def parse_arrays_in_dir(values_dir: Path) -> dict[str, list[str]]:
    """
    Parse all *.xml under a values* directory and extract:
    - <string-array name="..."><item>...</item></string-array>
    - <integer-array name="..."><item>...</item></integer-array>
    Returns name -> list of item texts.
    """
    arrays: dict[str, list[str]] = {}
    if not values_dir.exists():
        return arrays

    for xml_path in sorted(values_dir.glob("*.xml")):
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
        except Exception:
            continue

        for tag_name in ("string-array", "integer-array"):
            for arr in root.iter(tag_name):
                name = arr.get("name", "")
                if not name:
                    continue
                items: list[str] = []
                for it in arr.findall("item"):
                    txt = (it.text or "").strip()
                    items.append(txt)
                if items:
                    arrays[name] = items

    return arrays


def resolve_array(
    ref: str,
    zh_arrays: dict[str, list[str]],
    en_arrays: dict[str, list[str]],
    zh_strings: dict[str, str],
    en_strings: dict[str, str],
) -> list[str]:
    if not ref:
        return []
    if ref.startswith("@array/"):
        key = ref[7:]
        raw_items = zh_arrays.get(key, en_arrays.get(key, []))
        # Array items may themselves be @string/... refs.
        return [resolve_string(it, zh_strings, en_strings) for it in raw_items]
    return []


# ── Color helpers ──────────────────────────────────────────────────

_HEX_COLOR_RE = re.compile(r"^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")


def android_color_to_css(color: str) -> str:
    """
    Convert Android hex color (#RRGGBB or #AARRGGBB) into CSS-compatible hex.

    - Android 8-digit hex is #AARRGGBB
    - CSS 8-digit hex is #RRGGBBAA
    - If alpha is FF, we shorten to #RRGGBB
    """
    if not color:
        return color
    m = _HEX_COLOR_RE.match(color)
    if not m:
        return color
    raw = m.group(1)
    if len(raw) == 6:
        return "#" + raw.lower()
    # Android: AARRGGBB -> CSS: RRGGBBAA
    aa, rr, gg, bb = raw[0:2], raw[2:4], raw[4:6], raw[6:8]
    if aa.lower() == "ff":
        return f"#{rr.lower()}{gg.lower()}{bb.lower()}"
    return f"#{rr.lower()}{gg.lower()}{bb.lower()}{aa.lower()}"


# ── Icon extraction ────────────────────────────────────────────────

def parse_vector_drawable(xml_path: Path) -> dict | None:
    """Parse an Android vector drawable XML into {bg, paths}."""
    if not xml_path.exists():
        return None
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception:
        return None

    tag = root.tag
    if "}" in tag:
        tag = tag.split("}")[-1]
    if tag != "vector":
        return None

    paths = []
    for path_elem in root.iter():
        ptag = path_elem.tag
        if "}" in ptag:
            ptag = ptag.split("}")[-1]
        if ptag != "path":
            continue
        fill_color = path_elem.get(ns("fillColor"), "")
        path_data = path_elem.get(ns("pathData"), "")
        fill_type = path_elem.get(ns("fillType"), "")
        if path_data:
            paths.append({
                "fill": fill_color,
                "d": path_data,
                "fillRule": "evenodd" if fill_type == "evenOdd" else "",
            })

    if len(paths) < 2:
        return None

    # First path is background, rest are foreground
    bg_color = paths[0]["fill"]
    bg_color = android_color_to_css(bg_color)

    fg_paths = []
    for p in paths[1:]:
        entry: dict = {"d": p["d"]}
        if p["fillRule"]:
            entry["fillRule"] = p["fillRule"]
        fg_paths.append(entry)

    return {"bg": bg_color, "paths": fg_paths}


# ── Smali / fragment -> XML mapping ────────────────────────────────

SMALI_SUPER_RE = re.compile(r"^\.super\s+L([^;]+);")
SMALI_METHOD_RE = re.compile(r"^\.method\b")
SMALI_END_METHOD_RE = re.compile(r"^\.end method\b")
SMALI_GET_PREF_RES_METHOD_RE = re.compile(r"\bgetPreferenceScreenResId\(\)I\b")
SMALI_SGET_XML_RE = re.compile(r"\s*sget(?:-object)?\s+(\w+),\s+Lcom/android/settings/R\$xml;->(\w+):I")
SMALI_CONST_HEX_RE = re.compile(r"\s*const(?:/[0-9a-z]+)?\s+(\w+),\s+(0x[0-9a-fA-F]+)")
SMALI_INVOKE_ADD_PREF_RE = re.compile(r"\s*invoke-(?:virtual|super|direct)\s+\{([^}]*)\},\s+L[^;]+;->addPreferencesFromResource\(I\)V")
SMALI_INVOKE_SET_PREF_RE = re.compile(
    r"\s*invoke-(?:virtual|super|direct)\s+\{([^}]*)\},\s+L[^;]+;->setPreferencesFromResource\(ILjava/lang/String;\)V"
)


def _descriptor_to_dotted(desc: str) -> str:
    # e.g. com/android/settings/Foo$Bar -> com.android.settings.Foo$Bar
    return desc.replace("/", ".")


def _dotted_to_rel_smali_path(dotted: str) -> Path:
    # e.g. com.android.settings.Foo$Bar -> com/android/settings/Foo$Bar.smali
    return Path(*dotted.split(".")) .with_suffix(".smali")


def list_smali_roots(base: Path) -> list[Path]:
    roots: list[Path] = []
    try:
        for p in base.iterdir():
            if p.is_dir() and p.name.startswith("smali"):
                roots.append(p)
    except Exception:
        return []
    # Prefer primary classes first for determinism
    roots.sort(key=lambda x: (x.name != "smali", x.name))
    return roots


def parse_public_xml_xml_ids(public_xml_path: Path) -> dict[int, str]:
    """
    Parse res/values/public.xml and return a mapping: resource_id_int -> xml_name
    Only includes resources of type="xml".
    """
    if not public_xml_path.exists():
        return {}
    id_map: dict[int, str] = {}
    # Avoid full XML parse: public.xml can be huge.
    public_re = re.compile(r'<public\s+type="xml"\s+name="([^"]+)"\s+id="(0x[0-9a-fA-F]+)"')
    try:
        with open(public_xml_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                m = public_re.search(line)
                if not m:
                    continue
                name = m.group(1)
                rid_hex = m.group(2)
                try:
                    rid = int(rid_hex, 16)
                except Exception:
                    continue
                id_map[rid] = name
    except Exception:
        return {}
    return id_map


def find_smali_file(dotted_class: str, smali_roots: Iterable[Path]) -> Optional[Path]:
    rel = _dotted_to_rel_smali_path(dotted_class)
    for root in smali_roots:
        cand = root / rel
        if cand.exists():
            return cand
    return None


def extract_xml_name_and_super_from_smali(
    smali_path: Path,
    public_xml_id_map: dict[int, str],
) -> tuple[Optional[str], Optional[str]]:
    """
    Return (xml_name, super_class_dotted) for the given smali class file.

    xml_name is the *res/xml* resource name (file stem), e.g. "display_settings".
    """
    xml_name: Optional[str] = None
    super_class: Optional[str] = None

    in_method = False
    in_get_pref_res_method = False
    reg_to_xml: dict[str, str] = {}

    try:
        with open(smali_path, "r", encoding="utf-8", errors="ignore") as f:
            for raw_line in f:
                line = raw_line.rstrip("\n")

                if super_class is None:
                    m_super = SMALI_SUPER_RE.match(line)
                    if m_super:
                        super_class = _descriptor_to_dotted(m_super.group(1))

                if SMALI_METHOD_RE.match(line):
                    in_method = True
                    in_get_pref_res_method = SMALI_GET_PREF_RES_METHOD_RE.search(line) is not None
                    reg_to_xml = {}
                    continue

                if in_method and SMALI_END_METHOD_RE.match(line):
                    in_method = False
                    in_get_pref_res_method = False
                    reg_to_xml = {}
                    continue

                if not in_method:
                    continue

                # Track sget of R$xml
                m_sget = SMALI_SGET_XML_RE.search(line)
                if m_sget:
                    reg = m_sget.group(1)
                    name = m_sget.group(2)
                    reg_to_xml[reg] = name
                    if in_get_pref_res_method and xml_name is None:
                        xml_name = name
                        # getPreferenceScreenResId is the most reliable
                        break
                    continue

                # Track const hex ids that might correspond to xml in public.xml
                m_const = SMALI_CONST_HEX_RE.search(line)
                if m_const:
                    reg = m_const.group(1)
                    hex_id = m_const.group(2)
                    try:
                        rid = int(hex_id, 16)
                    except Exception:
                        rid = None
                    if rid is not None and rid in public_xml_id_map:
                        reg_to_xml[reg] = public_xml_id_map[rid]
                    continue

                # Detect addPreferencesFromResource / setPreferencesFromResource
                m_invoke_add = SMALI_INVOKE_ADD_PREF_RE.search(line)
                m_invoke_set = SMALI_INVOKE_SET_PREF_RE.search(line)
                if m_invoke_add or m_invoke_set:
                    regs_raw = (m_invoke_add or m_invoke_set).group(1)
                    regs = [r.strip() for r in regs_raw.split(",") if r.strip()]
                    # First register is "this" (p0). Second is xml id.
                    if len(regs) >= 2:
                        xml_reg = regs[1]
                        if xml_reg in reg_to_xml:
                            xml_name = reg_to_xml[xml_reg]
                            break
    except Exception:
        return None, None

    return xml_name, super_class


def resolve_fragment_to_xml_name(
    fragment_class: str,
    smali_roots: list[Path],
    public_xml_id_map: dict[int, str],
    memo: dict[str, Optional[str]],
    stack: Optional[list[str]] = None,
) -> Optional[str]:
    if fragment_class in memo:
        return memo[fragment_class]

    if stack is None:
        stack = []
    if fragment_class in stack:
        memo[fragment_class] = None
        return None
    stack.append(fragment_class)

    smali_file = find_smali_file(fragment_class, smali_roots)
    if not smali_file:
        memo[fragment_class] = None
        stack.pop()
        return None

    xml_name, super_class = extract_xml_name_and_super_from_smali(smali_file, public_xml_id_map)
    if xml_name:
        memo[fragment_class] = xml_name
        stack.pop()
        return xml_name

    if super_class:
        resolved = resolve_fragment_to_xml_name(super_class, smali_roots, public_xml_id_map, memo, stack)
        memo[fragment_class] = resolved
        stack.pop()
        return resolved

    memo[fragment_class] = None
    stack.pop()
    return None


# ── Preference XML parsing ─────────────────────────────────────────

# Map preference class names to simplified types
PREF_TYPE_MAP = {
    "SwitchPreferenceCompat": "switch",
    "SwitchPreference": "switch",
    "PrimarySwitchPreference": "switch",
    "CheckBoxPreference": "checkbox",
    "CustomCheckBoxPreference": "checkbox",
    "SeekBarPreference": "seekbar",
    "BrightnessSeekBarPreference": "seekbar",
    "VolumeSeekBarPreference": "seekbar",
    "ListPreference": "list",
    "DropDownPreference": "list",
    "MultiSelectListPreference": "list",
    "ValuePreference": "value",
    "MiuiValuePreference": "value",
    "LTRValuePreference": "value",
    "DefaultAppValuePreference": "value",
    "EditTextPreference": "value",
    "ValidatedEditTextPreference": "value",
    "ApnEditTextPreference": "value",
    "WifiTetherSsidPreference": "value",
    "Preference": "preference",
    "RestrictedPreference": "preference",
    "RestrictedSwitchPreference": "switch",
    "MainSwitchPreference": "switch",
    "DefaultRingtonePreference": "preference",
    "FooterPreference": "footer",
    # Info-only preferences (often title-less)
    "NoTitlePreference": "footer",
    "SpannablePreference": "footer",
    # MIUI font controls (title-less custom widgets)
    "LiteFontSizePreference": "seekbar",
    "LiteFontWeightPreference": "seekbar",
    "LabeledSeekBarPreference": "seekbar",
}


def get_pref_type(tag: str) -> str:
    """Map XML tag to a simplified preference type."""
    short = tag.split(".")[-1] if "." in tag else tag
    return PREF_TYPE_MAP.get(short, "preference")


TITLELESS_KEY_TITLES: dict[str, str] = {
    "font_size": "字体大小",
    "font_weight": "字体粗细",
}


def parse_preference_screen(
    xml_path: Path,
    zh: dict,
    en: dict,
    zh_arrays: dict[str, list[str]],
    en_arrays: dict[str, list[str]],
) -> dict | None:
    """Parse a PreferenceScreen XML file."""
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception:
        return None

    root_tag = root.tag
    if "}" in root_tag:
        root_tag = root_tag.split("}")[-1]
    if root_tag != "PreferenceScreen":
        return None

    title_raw = root.get(ns("title"), "")
    title = resolve_string(title_raw, zh, en)
    key = root.get(ns("key"), xml_path.stem)
    # Some screens use a generic key like "root" — prefer filename for stability/uniqueness.
    if key in ("root",):
        key = xml_path.stem
    if not title:
        # Some screens omit a title (or resolve to empty). Use a stable fallback.
        title = key.replace("_", " ").title()

    categories: list[dict] = []
    current_cat: dict | None = None

    def process_children(parent):
        nonlocal current_cat
        for child in parent:
            child_tag = child.tag
            if "}" in child_tag:
                child_tag = child_tag.split("}")[-1]
            short_tag = child_tag.split(".")[-1] if "." in child_tag else child_tag

            # Many ROMs use custom category containers (e.g. miuix.preference.RadioSetPreferenceCategory)
            if short_tag.endswith("PreferenceCategory"):
                cat_title = resolve_string(child.get(ns("title"), ""), zh, en)
                # Flatten anonymous nested categories into the current one to avoid excessive card splitting.
                if current_cat is None or cat_title:
                    current_cat = {"title": cat_title, "items": []}
                    categories.append(current_cat)
                # Process children of category
                process_children(child)
            elif short_tag in ("PreferenceScreen",):
                # Nested preference screen = sub-page
                sub_title = resolve_string(child.get(ns("title"), ""), zh, en)
                sub_key = child.get(ns("key"), "")
                sub_fragment = child.get(ns("fragment"), "")
                if current_cat is None:
                    current_cat = {"title": "", "items": []}
                    categories.append(current_cat)
                item = {
                    "type": "preference",
                    "key": sub_key,
                    "title": sub_title,
                }
                if sub_fragment:
                    item["__fragment"] = sub_fragment
                    item["targetPage"] = sub_fragment.split(".")[-1]
                current_cat["items"].append(item)
            else:
                # Regular preference item
                pref_type = get_pref_type(child.tag)
                item_title_raw = child.get(ns("title"), "")
                item_title = resolve_string(item_title_raw, zh, en)
                item_key = child.get(ns("key"), "")
                item_summary_raw = child.get(ns("summary"), "")
                item_summary = resolve_string(item_summary_raw, zh, en)

                # Clean up summary placeholders
                if item_summary in ("%s", "@string/summary_placeholder", "summary_placeholder"):
                    item_summary = ""

                item_default = child.get(ns("defaultValue"), "")

                # Check for fragment (navigation target)
                fragment = child.get(ns("fragment"), "")
                # List options (entries/entryValues)
                entries_ref = get_attr_any_ns(child, "entries")
                entry_values_ref = get_attr_any_ns(child, "entryValues")
                entries = resolve_array(entries_ref, zh_arrays, en_arrays, zh, en)
                entry_values = resolve_array(entry_values_ref, zh_arrays, en_arrays, zh, en)
                # Check for intent
                intent_el = child.find("intent") if child.find("intent") is not None else None

                if not item_title and pref_type not in ("footer",):
                    # Some custom preferences are title-less but meaningful. Use key-based titles.
                    if item_key and item_key in TITLELESS_KEY_TITLES:
                        item_title = TITLELESS_KEY_TITLES[item_key]
                    else:
                        continue

                item: dict = {
                    "type": pref_type,
                    "key": item_key,
                    "title": item_title,
                }
                if item_summary:
                    item["summary"] = item_summary
                if item_default and item_default not in ("", "false"):
                    item["defaultValue"] = item_default
                if fragment:
                    # Map fragment to a page id
                    frag_short = fragment.split(".")[-1]
                    item["targetPage"] = frag_short
                    item["__fragment"] = fragment
                if pref_type == "list" and entries:
                    # Emit options to support in-app selection UI
                    opts: list[dict[str, str]] = []
                    if entry_values and len(entry_values) == len(entries):
                        for label, val in zip(entries, entry_values):
                            opts.append({"label": label, "value": val})
                    else:
                        for label in entries:
                            opts.append({"label": label, "value": label})
                    item["options"] = opts

                # Preserve Android inputType for editable preferences (best-effort)
                if pref_type == "value":
                    input_type = child.get(ns("inputType"), "") or child.get("inputType", "")
                    if input_type:
                        item["inputType"] = input_type

                if current_cat is None:
                    current_cat = {"title": "", "items": []}
                    categories.append(current_cat)
                current_cat["items"].append(item)

    process_children(root)

    # Filter out empty categories
    categories = [c for c in categories if c["items"]]

    if not categories:
        # Many Settings pages are populated dynamically by controllers at runtime.
        # Keep an explicit placeholder page so navigation doesn't 404 in the simulator.
        categories = [
            {
                "title": "",
                "items": [
                    {
                        "type": "footer",
                        "key": "",
                        "title": "",
                        "summary": "此页面内容由系统动态生成，模拟尚未完全实现",
                    }
                ],
            }
        ]

    return {
        "id": key,
        "title": title,
        "categories": categories,
        "__xml_stem": xml_path.stem,
    }


# ── Settings headers parsing ───────────────────────────────────────

def parse_settings_headers(
    xml_path: Path,
    zh: dict,
    en: dict,
    icon_cache: dict[str, dict | None],
) -> list[dict]:
    """Parse settings_headers.xml into a list of main menu items."""
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception as e:
        print(f"Error parsing settings_headers.xml: {e}")
        return []

    items = []
    for header in root:
        header_tag = header.tag
        if "}" in header_tag:
            header_tag = header_tag.split("}")[-1]
        if header_tag != "header":
            continue

        # Empty separator header
        raw_id = header.get(ns("id"), "")
        raw_title = header.get(ns("title"), "")
        raw_icon = header.get(ns("icon"), "")
        fragment = header.get(ns("fragment"), "")

        if not raw_id and not raw_title:
            # Separator
            items.append({"type": "separator"})
            continue

        # Parse ID
        item_id = raw_id.replace("@id/", "").replace("@+id/", "") if raw_id else ""

        if not raw_title and not item_id:
            continue

        # Resolve title
        title = resolve_string(raw_title, zh, en)
        if not title and item_id:
            title = item_id.replace("_", " ").title()

        # Resolve icon
        icon_data = None
        if raw_icon:
            icon_name = raw_icon.replace("@drawable/", "")
            if icon_name not in icon_cache:
                icon_path = RES_DIR / "drawable" / f"{icon_name}.xml"
                icon_cache[icon_name] = parse_vector_drawable(icon_path)
            icon_data = icon_cache[icon_name]

        # Target page
        target_page = ""
        if fragment:
            target_page = fragment.split(".")[-1]

        entry: dict = {
            "id": item_id,
            "title": title,
        }
        if icon_data:
            entry["icon"] = icon_data
        if target_page:
            entry["targetPage"] = target_page
        if fragment:
            entry["__fragment"] = fragment

        items.append(entry)

    return items


# ── Main generation ────────────────────────────────────────────────

def main():
    print("=" * 55)
    print(" Settings Config Extractor")
    print("=" * 55)

    if not DECOMPILED_DIR.exists():
        print(f"Error: decompiled dir not found: {DECOMPILED_DIR}")
        sys.exit(1)

    # 1. Parse strings
    print("\n[1/5] Parsing strings...")
    zh_strings = parse_strings(RES_DIR / "values-zh-rCN" / "strings.xml")
    en_strings = parse_strings(RES_DIR / "values" / "strings.xml")
    print(f"  zh-CN: {len(zh_strings)} strings")
    print(f"  en:    {len(en_strings)} strings")

    print("\n[1.5/5] Parsing arrays...")
    zh_arrays = parse_arrays_in_dir(RES_DIR / "values-zh-rCN")
    en_arrays = parse_arrays_in_dir(RES_DIR / "values")
    print(f"  zh-CN arrays: {len(zh_arrays)}")
    print(f"  en arrays:    {len(en_arrays)}")

    # 2. Parse settings headers (main page)
    print("\n[2/5] Parsing settings_headers.xml...")
    icon_cache: dict[str, dict | None] = {}
    headers_path = RES_DIR / "xml" / "settings_headers.xml"
    main_items = parse_settings_headers(headers_path, zh_strings, en_strings, icon_cache)
    print(f"  Main menu items: {len(main_items)}")
    print(f"  Icons extracted: {sum(1 for v in icon_cache.values() if v)}")

    # 3. Parse all preference screen XMLs
    print("\n[3/5] Parsing preference screen XMLs...")
    xml_dir = RES_DIR / "xml"
    sub_pages: dict[str, dict] = {}
    xml_files = sorted(xml_dir.glob("*.xml")) if xml_dir.exists() else []
    parsed_count = 0
    id_collisions = 0

    def _unique_page_id(base: str) -> str:
        if not base:
            base = "page"
        if base not in sub_pages:
            return base
        i = 2
        while f"{base}__{i}" in sub_pages:
            i += 1
        return f"{base}__{i}"

    for xml_file in xml_files:
        if xml_file.name == "settings_headers.xml":
            continue
        page = parse_preference_screen(xml_file, zh_strings, en_strings, zh_arrays, en_arrays)
        if page:
            page_id = str(page.get("id", xml_file.stem))
            page_stem = str(page.get("__xml_stem", xml_file.stem))

            if page_id in sub_pages:
                # Collision: two XML files share the same android:key.
                id_collisions += 1
                existing = sub_pages[page_id]
                existing_stem = str(existing.get("__xml_stem", ""))

                # Prefer giving the colliding id to the page whose stem matches it.
                if page_stem == page_id and existing_stem != page_id and existing_stem:
                    # Move existing page to its stem-based id, keep new at the key id.
                    existing_new_id = _unique_page_id(existing_stem)
                    del sub_pages[page_id]
                    existing["id"] = existing_new_id
                    sub_pages[existing_new_id] = existing

                    page["id"] = page_id
                    sub_pages[page_id] = page
                else:
                    # Keep existing at page_id; move new page to a stem-based id.
                    new_id = _unique_page_id(page_stem)
                    page["id"] = new_id
                    sub_pages[new_id] = page
            else:
                page["id"] = page_id
                sub_pages[page_id] = page
            parsed_count += 1
    print(f"  Parsed {parsed_count} preference screens from {len(xml_files)} XML files")
    if id_collisions:
        print(f"  Resolved {id_collisions} page id collisions via renaming")

    # 4. Resolve fragment -> preference screen via smali/public.xml
    print("\n[4/5] Resolving fragment navigation (smali)...")
    smali_roots = list_smali_roots(DECOMPILED_DIR)
    public_xml_id_map = parse_public_xml_xml_ids(RES_DIR / "values" / "public.xml")
    frag_to_xml_memo: dict[str, Optional[str]] = {}

    # Map xml file stem -> extracted SettingsPage id (android:key or stem)
    xml_stem_to_page_id: dict[str, str] = {}
    for page_id, page in sub_pages.items():
        stem = page.get("__xml_stem")
        if stem:
            xml_stem_to_page_id[str(stem)] = page_id

    def resolve_fragment_to_page_id(fragment_full: str) -> Optional[str]:
        xml_name = resolve_fragment_to_xml_name(
            fragment_full,
            smali_roots,
            public_xml_id_map,
            frag_to_xml_memo,
        )
        if not xml_name:
            return None
        return xml_stem_to_page_id.get(xml_name, xml_name)

    resolved_main = 0
    for item in main_items:
        if not isinstance(item, dict):
            continue
        frag_full = item.get("__fragment", "")
        if not frag_full:
            continue
        page_id = resolve_fragment_to_page_id(frag_full)
        if page_id:
            item["targetPage"] = page_id
            resolved_main += 1

    resolved_sub = 0
    for page in sub_pages.values():
        for cat in page.get("categories", []):
            for pitem in cat.get("items", []):
                frag_full = pitem.get("__fragment", "")
                if not frag_full:
                    continue
                page_id = resolve_fragment_to_page_id(frag_full)
                if page_id:
                    pitem["targetPage"] = page_id
                    resolved_sub += 1

    # Clean internal fields so they never leak to the output
    for item in main_items:
        if isinstance(item, dict):
            item.pop("__fragment", None)
    for page in sub_pages.values():
        page.pop("__xml_stem", None)
        for cat in page.get("categories", []):
            for pitem in cat.get("items", []):
                pitem.pop("__fragment", None)

    print(f"  Smali roots: {len(smali_roots)}")
    print(f"  public.xml xml ids: {len(public_xml_id_map)}")
    print(f"  Resolved main headers: {resolved_main}")
    print(f"  Resolved preference item fragments: {resolved_sub}")

    # 5. Generate JSON
    print("\n[5/5] Generating JSON config...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Group main items into sections (split by separator)
    sections: list[list[dict]] = []
    current_section: list[dict] = []
    for item in main_items:
        if item.get("type") == "separator":
            if current_section:
                sections.append(current_section)
                current_section = []
        else:
            current_section.append(item)
    if current_section:
        sections.append(current_section)

    icons_out: dict[str, dict] = {}
    for icon_name, icon_data in sorted(icon_cache.items()):
        if icon_data is None:
            continue
        icons_out[icon_name] = {
            "bg": icon_data["bg"],
            "paths": icon_data["paths"],
        }

    main_sections_out: list[dict] = []
    for section in sections:
        items_out: list[dict] = []
        for item in section:
            icon_ref = ""
            # Find icon name for this item
            for orig in main_items:
                if isinstance(orig, dict) and orig.get("id") == item.get("id") and "icon" in orig:
                    for ic_name, ic_data in icon_cache.items():
                        if ic_data == orig["icon"]:
                            icon_ref = ic_name
                            break
                    break

            resolved_target = item.get("targetPage", "") or ""
            entry: dict = {
                "id": item["id"],
                "title": item["title"],
            }
            if icon_ref:
                entry["icon"] = icon_ref
            if resolved_target:
                entry["targetPage"] = resolved_target
            items_out.append(entry)
        main_sections_out.append({"items": items_out})

    pages_out: dict[str, dict] = {}
    for page_id, page in sorted(sub_pages.items()):
        categories_out: list[dict] = []
        for cat in page.get("categories", []):
            cat_out: dict = {}
            if cat.get("title"):
                cat_out["title"] = cat["title"]
            cat_out["items"] = []
            for pitem in cat.get("items", []):
                it: dict = {
                    "type": pitem.get("type", ""),
                    "key": pitem.get("key", "") or "",
                    "title": pitem.get("title", "") or "",
                }
                if pitem.get("summary"):
                    it["summary"] = pitem["summary"]
                if pitem.get("defaultValue"):
                    it["defaultValue"] = pitem["defaultValue"]
                if pitem.get("targetPage"):
                    it["targetPage"] = pitem["targetPage"]
                if pitem.get("options"):
                    it["options"] = pitem["options"]
                if pitem.get("inputType"):
                    it["inputType"] = str(pitem["inputType"])
                cat_out["items"].append(it)
            categories_out.append(cat_out)
        pages_out[page_id] = {
            "id": page_id,
            "title": page.get("title", page_id),
            "categories": categories_out,
        }

    out = {
        "icons": icons_out,
        "mainSections": main_sections_out,
        "pages": pages_out,
    }

    # Write output
    output_path = OUTPUT_DIR / "pages.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"\n  Output: {output_path}")
    print(f"  Sections: {len(sections)}")
    print(f"  Sub-pages: {len(sub_pages)}")
    total_items = sum(
        len(cat["items"])
        for page in sub_pages.values()
        for cat in page["categories"]
    )
    print(f"  Total preference items: {total_items}")

    print("\n" + "=" * 55)
    print(" Done!")
    print("=" * 55)


if __name__ == "__main__":
    main()
