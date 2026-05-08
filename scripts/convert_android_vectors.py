#!/usr/bin/env python3
"""
Convert Android vector drawable XMLs to SVG files.
Extracts path data from Android vector XML and creates standard SVG files.
"""
import re
import xml.etree.ElementTree as ET
from pathlib import Path

# Source and destination directories
MMS_RES_DIR = Path(__file__).parent.parent / "decompiled" / "Mms_decompiled" / "res" / "drawable"
SMS_ASSETS_DIR = Path(__file__).parent.parent / "apps" / "Sms" / "assets" / "icons"

# Icons to convert (attachment panel icons)
ATTACH_ICONS = [
    "ic_attach_smiley_n",      # 表情
    "ic_attach_contact_n",     # 名片
    "ic_attach_photo_n",       # 图片
    "ic_attach_take_photo_n",  # 拍照
    "ic_attach_phrase_n",      # 我的收藏
    "ic_attach_timing_n",      # 定时
    "ic_attach_subject_n",     # 主题
    "ic_attach_sound_n",       # 音频
    "ic_attach_video_n",       # 视频
    "ic_attach_slide_show_n",  # 幻灯片
]

# Other useful icons
OTHER_ICONS = [
    "ic_action_bar_back",      # 返回箭头
    "ic_add_contact",          # 添加联系人
    "ic_bottom_menu_mode_n",   # 底部菜单
]


def android_vector_to_svg(xml_path: Path, output_path: Path) -> bool:
    """Convert an Android vector drawable XML to SVG format."""
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        
        # Extract dimensions
        ns = {"android": "http://schemas.android.com/apk/res/android"}
        
        # Get viewBox dimensions
        vp_width = root.get("{http://schemas.android.com/apk/res/android}viewportWidth", "32")
        vp_height = root.get("{http://schemas.android.com/apk/res/android}viewportHeight", "32")
        
        # Get display dimensions
        width = root.get("{http://schemas.android.com/apk/res/android}width", "32.0dip")
        height = root.get("{http://schemas.android.com/apk/res/android}height", "32.0dip")
        
        # Extract numeric values
        width_val = re.sub(r"[^\d.]", "", width)
        height_val = re.sub(r"[^\d.]", "", height)
        
        # Build SVG
        svg_lines = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vp_width} {vp_height}" width="{width_val}" height="{height_val}">',
        ]
        
        # Convert paths
        for path_elem in root.iter():
            if not path_elem.tag.endswith("path"):
                continue
            path_d = path_elem.get("{http://schemas.android.com/apk/res/android}pathData", "")
            fill_color = path_elem.get("{http://schemas.android.com/apk/res/android}fillColor", "none")
            fill_alpha = path_elem.get("{http://schemas.android.com/apk/res/android}fillAlpha", "1")
            stroke_color = path_elem.get("{http://schemas.android.com/apk/res/android}strokeColor")
            stroke_width = path_elem.get("{http://schemas.android.com/apk/res/android}strokeWidth")
            stroke_alpha = path_elem.get("{http://schemas.android.com/apk/res/android}strokeAlpha", "1")
            fill_type = path_elem.get("{http://schemas.android.com/apk/res/android}fillType")
            
            # Convert Android color format to CSS
            if fill_color and fill_color.startswith("#ff"):
                fill_color = "#" + fill_color[3:]  # Remove alpha prefix
            elif fill_color == "#00000000":
                fill_color = "none"
            
            if stroke_color and stroke_color.startswith("#ff"):
                stroke_color = "#" + stroke_color[3:]
            
            attrs = [f'd="{path_d}"']
            
            if fill_color and fill_color != "none":
                attrs.append(f'fill="{fill_color}"')
                if fill_alpha != "1":
                    attrs.append(f'fill-opacity="{fill_alpha}"')
            else:
                attrs.append('fill="none"')
            
            if stroke_color:
                attrs.append(f'stroke="{stroke_color}"')
                if stroke_width:
                    attrs.append(f'stroke-width="{stroke_width}"')
                if stroke_alpha != "1":
                    attrs.append(f'stroke-opacity="{stroke_alpha}"')
            
            if fill_type == "evenOdd":
                attrs.append('fill-rule="evenodd"')
            
            svg_lines.append(f'  <path {" ".join(attrs)}/>')
        
        svg_lines.append('</svg>')
        
        # Write SVG
        svg_content = "\n".join(svg_lines)
        output_path.write_text(svg_content, encoding="utf-8")
        print(f"✓ Converted: {xml_path.name} -> {output_path.name}")
        return True
        
    except Exception as e:
        print(f"✗ Failed: {xml_path.name} - {e}")
        return False


def main():
    # Ensure output directory exists
    SMS_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    
    icons_to_convert = ATTACH_ICONS + OTHER_ICONS
    success_count = 0
    
    for icon_name in icons_to_convert:
        xml_path = MMS_RES_DIR / f"{icon_name}.xml"
        if not xml_path.exists():
            print(f"⚠ Not found: {icon_name}.xml")
            continue
        
        # Output as simplified name (remove _n suffix for normal state)
        output_name = icon_name.replace("_n", "") + ".svg"
        output_path = SMS_ASSETS_DIR / output_name
        
        if android_vector_to_svg(xml_path, output_path):
            success_count += 1
    
    print(f"\nConverted {success_count}/{len(icons_to_convert)} icons")


if __name__ == "__main__":
    main()
