#!/usr/bin/env python3
"""
Extract all glyphs from HyperOS Symbol font to SVG files.
Uses fonttools to convert glyph paths to SVG format.
"""

import os
import argparse
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

def extract_glyphs_to_svg(font_path: str, output_dir: str) -> dict:
    """Extract all glyphs from a TTF font to SVG files."""
    font = TTFont(font_path)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    
    # Get font metrics for proper SVG viewBox
    units_per_em = font['head'].unitsPerEm
    ascender = font['hhea'].ascender
    descender = font['hhea'].descender
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    results = {
        'total': 0,
        'exported': 0,
        'failed': 0,
        'glyphs': []
    }
    
    # Create index mapping
    glyph_index = {}
    
    for code, glyph_name in sorted(cmap.items()):
        if code < 0xF0000:  # Skip non-symbol characters
            continue
            
        results['total'] += 1
        
        try:
            # Get glyph and draw to SVG path
            glyph = glyph_set[glyph_name]
            pen = SVGPathPen(glyph_set)
            glyph.draw(pen)
            path_data = pen.getCommands()
            
            if not path_data or path_data == '':
                # Empty glyph, skip
                results['failed'] += 1
                continue
            
            # Get glyph width
            width = glyph.width
            
            # Create SVG with proper viewBox
            # Flip Y-axis since font coordinates are bottom-up
            svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {ascender - descender}" width="24" height="24">
  <g transform="scale(1,-1) translate(0,{-ascender})">
    <path d="{path_data}" fill="currentColor"/>
  </g>
</svg>
'''
            
            # Save SVG file
            svg_filename = f"{glyph_name}.svg"
            svg_path = output_path / svg_filename
            svg_path.write_text(svg_content)
            
            results['exported'] += 1
            results['glyphs'].append({
                'name': glyph_name,
                'unicode': f"U+{code:05X}",
                'char': chr(code),
                'file': svg_filename
            })
            
            glyph_index[glyph_name] = {
                'unicode': f"U+{code:05X}",
                'file': svg_filename
            }
            
        except Exception as e:
            print(f"Failed to export {glyph_name}: {e}")
            results['failed'] += 1
    
    # Write index JSON
    import json
    index_path = output_path / 'index.json'
    index_path.write_text(json.dumps({
        'font': 'HyperOS Symbols VF',
        'source': os.path.basename(font_path),
        'total_glyphs': results['exported'],
        'glyphs': glyph_index
    }, indent=2, ensure_ascii=False))
    
    # Generate preview HTML
    generate_preview_html(output_path, results['glyphs'])
    
    return results


def generate_preview_html(output_dir: Path, glyphs: list):
    """Generate an HTML preview page for all exported glyphs."""
    html = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HyperOS Symbol Icons Preview</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 20px;
            background: #f5f5f5;
        }
        h1 { text-align: center; margin-bottom: 10px; }
        .search-box {
            display: block;
            width: 100%;
            max-width: 400px;
            margin: 0 auto 20px;
            padding: 12px 16px;
            font-size: 16px;
            border: 1px solid #ddd;
            border-radius: 8px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 12px;
        }
        .icon-card {
            background: white;
            border-radius: 12px;
            padding: 16px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            border: 2px solid transparent;
        }
        .icon-card:hover {
            border-color: #07C160;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .icon-card img {
            width: 32px;
            height: 32px;
            display: block;
            margin: 0 auto 8px;
        }
        .icon-name {
            font-size: 11px;
            color: #666;
            word-break: break-all;
        }
        .icon-unicode {
            font-size: 10px;
            color: #999;
            margin-top: 4px;
        }
        .hidden { display: none; }
        .stats { text-align: center; color: #666; margin-bottom: 20px; }
        .toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .toast.show { opacity: 1; }
    </style>
</head>
<body>
    <h1>🎨 HyperOS Symbol Icons</h1>
    <p class="stats">共 ''' + str(len(glyphs)) + ''' 个图标 - 点击复制 SVG 路径</p>
    <input type="text" class="search-box" placeholder="搜索图标名称..." oninput="filterIcons(this.value)">
    <div class="grid">
'''
    
    for glyph in glyphs:
        html += f'''        <div class="icon-card" data-name="{glyph['name']}" onclick="copyPath('{glyph['file']}')">
            <img src="{glyph['file']}" alt="{glyph['name']}">
            <div class="icon-name">{glyph['name']}</div>
            <div class="icon-unicode">{glyph['unicode']}</div>
        </div>
'''
    
    html += '''    </div>
    <div class="toast" id="toast">已复制!</div>
    <script>
        function filterIcons(query) {
            const cards = document.querySelectorAll('.icon-card');
            query = query.toLowerCase();
            cards.forEach(card => {
                const name = card.dataset.name.toLowerCase();
                card.classList.toggle('hidden', !name.includes(query));
            });
        }
        function copyPath(filename) {
            navigator.clipboard.writeText(filename);
            const toast = document.getElementById('toast');
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 1500);
        }
    </script>
</body>
</html>
'''
    
    (output_dir / 'preview.html').write_text(html)


def main():
    parser = argparse.ArgumentParser(description='Extract HyperOS Symbol glyphs to SVG')
    parser.add_argument('--font', default='decompiled/Mms_decompiled/assets/fonts/misymbol_vf.ttf',
                        help='Path to TTF font file')
    parser.add_argument('--output', default='public/icons/hyperos-symbols',
                        help='Output directory for SVG files')
    
    args = parser.parse_args()
    
    print(f"Extracting glyphs from: {args.font}")
    print(f"Output directory: {args.output}")
    
    results = extract_glyphs_to_svg(args.font, args.output)
    
    print(f"\n✅ Done!")
    print(f"   Total glyphs: {results['total']}")
    print(f"   Exported: {results['exported']}")
    print(f"   Failed/Empty: {results['failed']}")
    print(f"\n📁 Files saved to: {args.output}")
    print(f"🌐 Open {args.output}/preview.html to browse icons")


if __name__ == '__main__':
    main()
