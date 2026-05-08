#!/usr/bin/env python3
"""
从反编译的 com.android.contacts / com.android.phone 资源中提取 Preference XML，
生成 Contacts App（电话/联系人）可渲染的设置页面配置。

用法:
  python scripts/extract_phone_settings_config.py

输出:
  apps/Contacts/data/phoneSettingsPages.generated.ts
"""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
CONTACTS_DECOMPILED_DIR = PROJECT_ROOT / "decompiled" / "Contacts_decompiled"
PHONE_DECOMPILED_DIR = PROJECT_ROOT / "decompiled" / "Phone_decompiled"
CONTACTS_RES_DIR = CONTACTS_DECOMPILED_DIR / "res"
PHONE_RES_DIR = PHONE_DECOMPILED_DIR / "res"
OUTPUT_PATH = PROJECT_ROOT / "apps" / "Contacts" / "data" / "phoneSettingsPages.generated.ts"

ANDROID_NS = "http://schemas.android.com/apk/res/android"
APP_NS = "http://schemas.android.com/apk/res-auto"

# Phone 侧只接入主设置页可达的核心页面，避免把运营商/机型分支页全量灌入模拟器。
PHONE_SETTINGS_XML_ALLOWLIST = {
    "miui_call_feature_setting.xml",
    "miui_network_setting.xml",
    "call_record_setting.xml",
    "location_setting.xml",
    "auto_answer_setting.xml",
    "call_advanced_setting.xml",
    "privacy_setting.xml",
    "permission_setting.xml",
    "answer_state_setting.xml",
    "call_fold_setting.xml",
    "miui_phone_account_settings.xml",
    "miui_callforward_options.xml",
    "miui_voicemail_callforward_options.xml",
    "call_waiting.xml",
    "miui_fdn_setting.xml",
    "voicemail_setting.xml",
    "miui_respond_via_sms_settings.xml",
    "auto_ip_setting.xml",
}


def ns(attr: str) -> str:
    return f"{{{ANDROID_NS}}}{attr}"


def app_ns(attr: str) -> str:
    return f"{{{APP_NS}}}{attr}"


def parse_strings(xml_path: Path) -> dict[str, str]:
    strings: dict[str, str] = {}
    if not xml_path.exists():
        return strings
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception:
        return strings

    for elem in root.iter("string"):
        name = elem.get("name", "").strip()
        val = (elem.text or "").strip()
        if name and val:
            strings[name] = val
    return strings


def parse_arrays_in_dir(values_dir: Path) -> dict[str, list[str]]:
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
                name = (arr.get("name", "") or "").strip()
                if not name:
                    continue
                items: list[str] = []
                for it in arr.findall("item"):
                    items.append(((it.text or "").strip()))
                if items:
                    arrays[name] = items
    return arrays


def resolve_string(val: str, zh_strings: dict[str, str], en_strings: dict[str, str]) -> str:
    if not val:
        return ""
    seen: set[str] = set()
    cur = val
    while cur.startswith("@string/"):
        key = cur[8:]
        if not key or key in seen:
            break
        seen.add(key)
        cur = zh_strings.get(key, en_strings.get(key, key))
        if cur == key:
            break
    return cur


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
        raw = zh_arrays.get(key, en_arrays.get(key, []))
        return [resolve_string(it, zh_strings, en_strings) for it in raw]
    return []


def local_tag(elem: ET.Element) -> str:
    tag = elem.tag
    if "}" in tag:
        tag = tag.split("}")[-1]
    # Tags in decompiled preference XML sometimes look like:
    # - miuix.preference.DropDownPreference
    # - miuix.preference.SingleChoicePreferenceCategory
    # Strip common separators to normalize.
    if ":" in tag:
        tag = tag.split(":")[-1]
    if "." in tag:
        tag = tag.split(".")[-1]
    return tag


def guess_page_title(page_id: str) -> str:
    # Best-effort mapping; keeps UI friendly when PreferenceScreen has no android:title.
    map = {
        # Contacts settings
        "preference_settings": "联系人设置",
        "preference_import_and_export": "导入/导出",
        "preference_display_options": "显示选项",
        "preference_more": "更多设置",
        "preference_privacy_settings": "隐私设置",
        "preference_privacy_contacts": "隐私-联系人",
        "preference_privacy_permission": "隐私-权限",
        "preference_account_list_filter": "联系人显示范围",
        "preference_dial_pad_touch_tone": "拨号按键音",
        "preference_dial_pad_touch_tone_v11": "拨号按键音",
        "preference_device_other_fragment": "其他设置",

        # Phone settings
        "miui_call_feature_setting": "电话",
        "miui_network_setting": "移动网络",
        "call_record_setting": "通话录音",
        "location_setting": "归属地及国家码",
        "auto_answer_setting": "自动接听",
        "call_advanced_setting": "高级设置",
        "privacy_setting": "隐私设置",
        "permission_setting": "权限说明",
        "answer_state_setting": "来电时状态",
        "call_fold_setting": "折叠屏通话设置",
        "miui_phone_account_settings": "通话账户",
        "miui_callforward_options": "来电转接",
        "miui_voicemail_callforward_options": "语音信箱与转移",
        "call_waiting": "来电等待",
        "miui_fdn_setting": "固定拨号",
        "voicemail_setting": "语音信箱",
        "miui_respond_via_sms_settings": "拒接短信回复",
        "auto_ip_setting": "自动IP拨号",
    }
    return map.get(page_id, page_id)


def extract_items(
    elems: list[ET.Element],
    zh_strings: dict[str, str],
    en_strings: dict[str, str],
    zh_arrays: dict[str, list[str]],
    en_arrays: dict[str, list[str]],
) -> list[dict]:
    items: list[dict] = []
    for elem in elems:
        tag = local_tag(elem)
        key = (elem.get(ns("key")) or "").strip()
        title_raw = (elem.get(ns("title")) or "").strip()
        summary_raw = (elem.get(ns("summary")) or "").strip()
        default_raw = (elem.get(ns("defaultValue")) or "").strip()

        title = resolve_string(title_raw, zh_strings, en_strings) or title_raw
        summary = resolve_string(summary_raw, zh_strings, en_strings) or summary_raw

        # Containers
        if tag == "PreferenceCategory":
            continue

        # miuix.preference.SingleChoicePreferenceCategory
        # - If it has children, treat it as a ListPreference with options.
        # - If it has no children (dynamic), still emit a list item without options as a placeholder.
        if tag == "SingleChoicePreferenceCategory":
            group_key = key or f"__{tag}__{len(items)}"
            options: list[dict] = []
            default_value: str | None = None

            for child in list(elem):
                child_tag = local_tag(child)
                if child_tag != "SingleChoicePreference":
                    continue
                opt_value = (child.get(ns("value")) or child.get(ns("key")) or "").strip()
                opt_title_raw = (child.get(ns("title")) or "").strip()
                opt_default_raw = (child.get(ns("defaultValue")) or "").strip()
                opt_title = resolve_string(opt_title_raw, zh_strings, en_strings) or opt_title_raw or opt_value
                if opt_value:
                    options.append({"label": opt_title, "value": opt_value})
                if opt_default_raw == "true" and opt_value:
                    default_value = opt_value

            title_fallback_map = {
                "device_group": "设备",
                "account_group": "账户",
            }
            display_title = title or title_fallback_map.get(group_key, group_key)

            if options:
                item: dict = {
                    "type": "list",
                    "key": group_key,
                    "title": display_title,
                }
                if summary:
                    item["summary"] = summary
                if default_value:
                    item["defaultValue"] = default_value
                item["options"] = options
                items.append(item)
            else:
                # Dynamic single-choice categories are usually populated by runtime code.
                # Emit a footer placeholder instead of a broken list row.
                items.append(
                    {
                        "type": "footer",
                        "key": group_key,
                        "title": f"{display_title}：该页面由系统动态生成，模拟暂不支持",
                    }
                )
            continue

        item_type = "preference"
        if "Switch" in tag:
            item_type = "switch"
        elif "CheckBox" in tag:
            item_type = "checkbox"
        elif "SeekBar" in tag:
            item_type = "seekbar"
        elif tag in ("ListPreference", "DropDownPreference"):
            item_type = "list"

        item: dict = {
            "type": item_type,
            "key": key or f"__{tag}__{len(items)}",
            "title": title or key or tag,
        }
        if summary:
            item["summary"] = summary
        if default_raw:
            item["defaultValue"] = resolve_string(default_raw, zh_strings, en_strings) or default_raw

        # ListPreference options (best-effort)
        if item_type == "list":
            entries_ref = (elem.get(ns("entries")) or elem.get(app_ns("entries")) or "").strip()
            values_ref = (elem.get(ns("entryValues")) or elem.get(app_ns("entryValues")) or "").strip()
            labels = resolve_array(entries_ref, zh_arrays, en_arrays, zh_strings, en_strings)
            values = resolve_array(values_ref, zh_arrays, en_arrays, zh_strings, en_strings)
            if labels and values and len(labels) == len(values):
                item["options"] = [{"label": labels[i], "value": values[i]} for i in range(len(labels))]

        items.append(item)
    return items


def parse_preference_xml(
    xml_path: Path,
    zh_strings: dict[str, str],
    en_strings: dict[str, str],
    zh_arrays: dict[str, list[str]],
    en_arrays: dict[str, list[str]],
) -> dict:
    page_id = xml_path.stem
    tree = ET.parse(xml_path)
    root = tree.getroot()

    page_title_raw = (root.get(ns("title")) or "").strip()
    page_title = resolve_string(page_title_raw, zh_strings, en_strings) or guess_page_title(page_id)

    categories: list[dict] = []
    uncategorized: list[ET.Element] = []

    for child in list(root):
        tag = local_tag(child)
        if tag == "PreferenceCategory":
            cat_title_raw = (child.get(ns("title")) or "").strip()
            cat_title = resolve_string(cat_title_raw, zh_strings, en_strings) or ""
            cat_items = extract_items(list(child), zh_strings, en_strings, zh_arrays, en_arrays)
            if cat_items:
                categories.append(
                    {
                        "title": cat_title or None,
                        "items": cat_items,
                    }
                )
        else:
            uncategorized.append(child)

    if uncategorized:
        items = extract_items(uncategorized, zh_strings, en_strings, zh_arrays, en_arrays)
        if items:
            categories.insert(
                0,
                {
                    "title": None,
                    "items": items,
                },
            )

    # Clean None titles for TS output
    for c in categories:
        if c.get("title") is None:
            c.pop("title", None)

    return {
        "id": page_id,
        "title": page_title,
        "categories": categories,
    }


def parse_pages_in_res(
    *,
    res_dir: Path,
    xml_paths: list[Path],
) -> dict[str, dict]:
    zh_strings = parse_strings(res_dir / "values-zh-rCN" / "strings.xml")
    en_strings = parse_strings(res_dir / "values" / "strings.xml")
    zh_arrays = parse_arrays_in_dir(res_dir / "values-zh-rCN")
    en_arrays = parse_arrays_in_dir(res_dir / "values")

    pages: dict[str, dict] = {}
    for xml_path in xml_paths:
        try:
            page = parse_preference_xml(xml_path, zh_strings, en_strings, zh_arrays, en_arrays)
            pages[page["id"]] = page
        except Exception as e:
            print(f"Warning: failed to parse {xml_path.name}: {e}")
    return pages


def main() -> int:
    if not CONTACTS_RES_DIR.exists():
        raise SystemExit(f"Missing decompiled res dir: {CONTACTS_RES_DIR}")
    if not PHONE_RES_DIR.exists():
        raise SystemExit(f"Missing decompiled res dir: {PHONE_RES_DIR}")

    contacts_xml_dir = CONTACTS_RES_DIR / "xml"
    contacts_xml_paths = sorted(contacts_xml_dir.glob("preference_*.xml"))
    contacts_pages = parse_pages_in_res(res_dir=CONTACTS_RES_DIR, xml_paths=contacts_xml_paths)

    phone_xml_dir = PHONE_RES_DIR / "xml"
    phone_xml_paths = sorted(
        p for p in phone_xml_dir.glob("*.xml") if p.name in PHONE_SETTINGS_XML_ALLOWLIST
    )
    phone_pages = parse_pages_in_res(res_dir=PHONE_RES_DIR, xml_paths=phone_xml_paths)

    pages: dict[str, dict] = {}
    pages.update(contacts_pages)
    pages.update(phone_pages)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Emit stable TS.
    content = []
    content.append("import type { PhoneSettingsPage } from '../settings/types';")
    content.append("")
    content.append("/**")
    content.append(" * Auto-generated from decompiled Contacts + Phone preferences.")
    content.append(" *")
    content.append(" * Source:")
    content.append(" * - decompiled/Contacts_decompiled/res/xml/preference_*.xml")
    content.append(" * - decompiled/Phone_decompiled/res/xml/{miui_call_feature_setting,...}.xml")
    content.append(" *")
    content.append(" * Regenerate:")
    content.append(" * - python scripts/extract_phone_settings_config.py")
    content.append(" */")
    content.append("export const PHONE_SETTINGS_PAGES: Record<string, PhoneSettingsPage> = " + json.dumps(pages, ensure_ascii=False, indent=2) + ";")
    content.append("")

    OUTPUT_PATH.write_text("\n".join(content) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH.relative_to(PROJECT_ROOT)} ({len(pages)} pages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
