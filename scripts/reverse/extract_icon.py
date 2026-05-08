#!/usr/bin/env python3
"""
Standardized JIT Icon Extraction Tool
Extracts icons from Android decompiled resources by name, handling:
- Selectors (resolving references)
- Vector Drawables (converting to SVG)
- Symbol Drawables (extracting from font)
- Bitmap Drawables (finding highest resolution)
"""

import os
import argparse
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

# Configuration
DECOMPILED_DIR = Path("decompiled/Mms_decompiled")
RES_DIR = DECOMPILED_DIR / "res"
FONT_PATH = DECOMPILED_DIR / "assets/fonts/misymbol_vf.ttf"
DEFAULT_OUTPUT_DIR = Path("apps/Sms/assets/icons")

# XML Namespaces
NS = {'android': 'http://schemas.android.com/apk/res/android',
      'app': 'http://schemas.android.com/apk/res-auto'}
for key, url in NS.items():
    ET.register_namespace(key, url)

def find_resource_file(res_name: str, res_type: str = "drawable") -> Path:
    """Find a resource file in the res directory."""
    # Check default drawable directory first
    search_dirs = [
        RES_DIR / res_type,
        RES_DIR / f"{res_type}-xxxhdpi",
        RES_DIR / f"{res_type}-xxhdpi",
        RES_DIR / f"{res_type}-xhdpi",
        RES_DIR / f"{res_type}-hdpi",
        RES_DIR / f"{res_type}-mdpi",
        RES_DIR / f"{res_type}-night", # Prioritize day mode usually, but check night if needed
    ]
    
    extensions = [".xml", ".png", ".webp", ".jpg"]
    
    for dir_path in search_dirs:
        if not dir_path.exists():
            continue
        for ext in extensions:
            file_path = dir_path / f"{res_name}{ext}"
            if file_path.exists():
                return file_path
    
    return None

def resolve_selector(xml_path: Path) -> Path:
    """Parse a selector XML and find the default or first drawable reference."""
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        if root.tag != "selector":
            return xml_path # Not a selector, return itself
            
        print(f"  Resolving selector: {xml_path.name}")
        
        # Try to find default item (no state specifiers)
        items = root.findall('item')
        print(f"    Found {len(items)} items")
        for item in items:
            drawable_ref = item.get(f"{{{NS['android']}}}drawable")
            print(f"    Checking item: drawable={drawable_ref}")
            if drawable_ref and drawable_ref.startswith("@drawable/"):
                ref_name = drawable_ref.replace("@drawable/", "")
                # Recurse
                resolved = find_resource_file(ref_name)
                if resolved:
                    # Check if it's another selector or final resource
                    if resolved.suffix == '.xml':
                        return resolve_selector(resolved)
                    return resolved
                    
        return xml_path
    except Exception as e:
        print(f"Error parsing selector {xml_path}: {e}")
        return xml_path

def convert_vector_to_svg(xml_path: Path, output_path: Path):
    """Convert Android Vector Drawable XML to SVG."""
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        
        viewport_w = float(root.get(f"{{{NS['android']}}}viewportWidth", "24"))
        viewport_h = float(root.get(f"{{{NS['android']}}}viewportHeight", "24"))
        width = root.get(f"{{{NS['android']}}}width", "24dp").replace("dp", "").replace("dip", "")
        height = root.get(f"{{{NS['android']}}}height", "24dp").replace("dp", "").replace("dip", "")
        
        svg_content = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {viewport_w} {viewport_h}" width="{width}" height="{height}">\n'
        
        # Recursive finding of paths and groups
        def process_element(element, indent="  "):
            content = ""
            tag = element.tag
            if tag == "path":
                path_data = element.get(f"{{{NS['android']}}}pathData")
                fill_color = element.get(f"{{{NS['android']}}}fillColor")
                stroke_color = element.get(f"{{{NS['android']}}}strokeColor")
                
                if path_data:
                    attrs = f'd="{path_data}"'
                    if fill_color:
                        if fill_color.startswith("#"):
                            attrs += f' fill="{fill_color}"'
                        elif fill_color == "@null" or fill_color == "transparent":
                             attrs += ' fill="none"'
                    
                    if stroke_color and stroke_color.startswith("#"):
                        attrs += f' stroke="{stroke_color}"'

                    # Handle fillType (evenOdd -> fill-rule="evenodd")
                    fill_type = element.get(f"{{{NS['android']}}}fillType")
                    if fill_type == "evenOdd":
                         attrs += ' fill-rule="evenodd"'
                    
                    content += f'{indent}<path {attrs} />\n'
            
            elif tag == "group":
                content += f'{indent}<g>\n'
                for child in element:
                    content += process_element(child, indent + "  ")
                content += f'{indent}</g>\n'
            
            return content

        # Use iter() to traverse all elements including nested groups
        # But we need structure, so let's just loop direct children if we want groups?
        # For simplicity, flattening paths often works for icons
        for child in root:
             svg_content += process_element(child)

        svg_content += '</svg>'
        output_path.write_text(svg_content)
        print(f"  Converted vector: {output_path}")
        
    except Exception as e:
        print(f"Error converting vector {xml_path}: {e}")

def extract_symbol_to_svg(font_path: Path, char_code: int, output_path: Path):
    """Extract a specific glyph from font by unicode char code."""
    try:
        font = TTFont(font_path)
        cmap = font.getBestCmap()
        glyph_name = cmap.get(char_code)
        
        if not glyph_name:
            print(f"  Error: Character U+{char_code:04X} not found in font.")
            return

        glyph_set = font.getGlyphSet()
        glyph = glyph_set[glyph_name]
        
        pen = SVGPathPen(glyph_set)
        glyph.draw(pen)
        path_data = pen.getCommands()
        
        # Metrics
        units_per_em = font['head'].unitsPerEm
        ascender = font['hhea'].ascender
        descender = font['hhea'].descender
        width = glyph.width
        
        svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {ascender - descender}" width="24" height="24">
  <g transform="scale(1,-1) translate(0,{-ascender})">
    <path d="{path_data}" fill="currentColor"/>
  </g>
</svg>'''
        
        output_path.write_text(svg_content)
        print(f"  Extracted symbol: U+{char_code:04X} ({glyph_name}) -> {output_path}")

    except Exception as e:
         print(f"Error extracting symbol: {e}")

def process_symbol_drawable(xml_path: Path, output_path: Path):
    """Extract symbol char from xml and convert to SVG using font."""
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        
        # Look for app:symbolText="󰀝"
        symbol_text = root.get(f"{{{NS['app']}}}symbolText")
        if not symbol_text:
            print(f"  Warning: No symbolText found in {xml_path}")
            return
            
        char_code = ord(symbol_text[0])
        extract_symbol_to_svg(FONT_PATH, char_code, output_path)
        
    except Exception as e:
        print(f"Error processing symbol drawable {xml_path}: {e}")

def main():
    parser = argparse.ArgumentParser(description='Extract Android icon by name to SVG/Bitmap')
    parser.add_argument('name', help='Resource name (e.g., action_bar_setting)')
    parser.add_argument('--app', default='Sms', help='Target app name (default: Sms)')
    parser.add_argument('--out', help='Custom output directory')
    
    args = parser.parse_args()
    
    # 1. Configuration Validation
    app_decompiled_dir = Path(f"decompiled/{args.app}_decompiled")
    if not app_decompiled_dir.exists():
        # Fallback for SMS legacy naming if needed, or error
        if args.app == "Sms":
             app_decompiled_dir = Path("decompiled/Mms_decompiled")
    
    if not app_decompiled_dir.exists():
        print(f"❌ Decompiled directory not found for {args.app}: {app_decompiled_dir}")
        return

    global RES_DIR, FONT_PATH
    RES_DIR = app_decompiled_dir / "res"
    FONT_PATH = app_decompiled_dir / "assets/fonts/misymbol_vf.ttf"
    
    # 2. Setup Output Directory
    if args.out:
        output_dir = Path(args.out)
    else:
        output_dir = Path(f"apps/{args.app}/assets/icons")
        
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 2. Find Resource
    print(f"🔍 Searching for resource: {args.name}")
    res_path = find_resource_file(args.name)
    
    if not res_path:
        print(f"❌ Resource '{args.name}' not found in {RES_DIR}")
        return
        
    print(f"  Found: {res_path}")

    # 3. Resolve Selectors
    if res_path.suffix == '.xml':
        root_tag = ET.parse(res_path).getroot().tag
        if root_tag == 'selector':
            res_path = resolve_selector(res_path)
            print(f"  Resolved to: {res_path}")

    # 4. Process based on type
    final_output = output_dir / f"{args.name}.svg"
    
    if res_path.suffix == '.xml':
        # Check root tag for type
        try:
            root = ET.parse(res_path).getroot()
            if root.tag == 'vector':
                convert_vector_to_svg(res_path, final_output)
            elif 'SymbolDrawable' in root.get('class', ''):
                process_symbol_drawable(res_path, final_output)
            elif root.tag == 'bitmap':
                # Handle XML bitmaps if needed (usually point to raw files)
                src = root.get(f"{{{NS['android']}}}src")
                if src:
                    print(f"  XML Bitmap pointing to: {src}")
                    # Recursively find that resource
            else:
                 # Try as vector if it has paths?
                 if root.find("path") is not None:
                     convert_vector_to_svg(res_path, final_output)
                 elif root.get(f"{{{NS['app']}}}symbolText"): # Fallback check
                     process_symbol_drawable(res_path, final_output)
                 else:
                     print(f"  Unknown XML drawable type: {root.tag}")

        except Exception as e:
            print(f"  Error parsing XML: {e}")
            
    elif res_path.suffix in ['.png', '.webp', '.jpg']:
        # Copy bitmap
        final_ext = res_path.suffix
        final_output = output_dir / f"{args.name}{final_ext}"
        shutil.copy2(res_path, final_output)
        print(f"  Copied bitmap: {final_output}")

    # 5. Also copy to public dir for dev server compatibility if needed?
    # The user seems to prefer apps/Sms/assets, but Vite needs configuration or public/
    # Let's assume the user has a setup or will manually copy to public if needed, 
    # OR we can auto-copy to public mirror
    public_mirror = Path(f"public/apps/{args.app}/assets/icons")
    if public_mirror.exists():
         mirror_file = public_mirror / final_output.name
         shutil.copy2(final_output, mirror_file)
         print(f"  Mirrored to public: {mirror_file}")

if __name__ == '__main__':
    main()
