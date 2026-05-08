import os
import shutil
import json
import re
import argparse

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

class AlipayHarvester:
    def __init__(self, decompiled_dir, output_dir):
        self.root = decompiled_dir
        self.output = output_dir
        self.assets_dir = os.path.join(self.root, 'assets')
        self.res_dir = os.path.join(self.root, 'res')
        
        # Output structure
        self.out_dsl = os.path.join(self.output, 'dsl')
        self.out_img = os.path.join(self.output, 'images')
        self.out_str = os.path.join(self.output, 'strings')
        
        ensure_dir(self.out_dsl)
        ensure_dir(self.out_img)
        ensure_dir(self.out_str)
        
        self.catalog = {
            "dsl_templates": [],
            "image_assets": [],
            "string_tables": {}
        }

    def harvest_dsl(self):
        """Finds and parses @ files which are Flybird/AMC DSL templates."""
        print("Harvesting DSL templates from assets...")
        for filename in os.listdir(self.assets_dir):
            if '@' in filename:
                file_path = os.path.join(self.assets_dir, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        # Try to parse as JSON
                        try:
                            data = json.loads(content)
                            clean_name = filename.replace('@', '_').replace('-', '_')
                            out_path = os.path.join(self.out_dsl, f"{clean_name}.json")
                            
                            with open(out_path, 'w', encoding='utf-8') as out_f:
                                json.dump(data, out_f, indent=2, ensure_ascii=False)
                            
                            self.catalog["dsl_templates"].append({
                                "original": filename,
                                "parsed": out_path,
                                "type": "flex_dsl"
                            })
                            # Extract strings from i18n sections if they exist
                            self._extract_strings_from_dsl(data, filename)
                        except json.JSONDecodeError:
                            # Not a simple JSON, maybe partial or binary?
                            pass
                except Exception as e:
                    print(f"Error processing DSL {filename}: {e}")

    def _extract_strings_from_dsl(self, data, source_name):
        """Recursively finds i18n blocks in DSL data."""
        def walk(node):
            if isinstance(node, dict):
                if node.get('type') == 'i18n' and 'locale' in node:
                    for lang, table in node['locale'].items():
                        if lang not in self.catalog["string_tables"]:
                            self.catalog["string_tables"][lang] = {}
                        self.catalog["string_tables"][lang].update(table)
                for val in node.values():
                    walk(val)
            elif isinstance(node, list):
                for item in node:
                    walk(item)
        walk(data)

    def harvest_images(self):
        """Collects all PNG, WEBP, JPG from assets and res."""
        print("Harvesting image assets...")
        extensions = ('.png', '.webp', '.jpg', '.jpeg', '.svg')
        
        # Scan assets
        for root, _, files in os.walk(self.assets_dir):
            for file in files:
                if file.lower().endswith(extensions):
                    src = os.path.join(root, file)
                    rel = os.path.relpath(src, self.assets_dir).replace('/', '_')
                    dest = os.path.join(self.out_img, rel)
                    shutil.copy2(src, dest)
                    self.catalog["image_assets"].append({"name": file, "path": dest, "source": "assets"})

        # Scan res
        for root, _, files in os.walk(self.res_dir):
            for file in files:
                if file.lower().endswith(extensions):
                    src = os.path.join(root, file)
                    # res/drawable-xhdpi/foo.png -> drawable_xhdpi_foo.png
                    parts = os.path.relpath(src, self.res_dir).split(os.sep)
                    rel = "_".join(parts)
                    dest = os.path.join(self.out_img, rel)
                    shutil.copy2(src, dest)
                    self.catalog["image_assets"].append({"name": file, "path": dest, "source": "res"})

    def save_catalog(self):
        # Save aggregated strings
        for lang, table in self.catalog["string_tables"].items():
            str_path = os.path.join(self.out_str, f"{lang}.json")
            with open(str_path, 'w', encoding='utf-8') as f:
                json.dump(table, f, indent=2, ensure_ascii=False)
        
        catalog_path = os.path.join(self.output, 'catalog.json')
        with open(catalog_path, 'w', encoding='utf-8') as f:
            json.dump(self.catalog, f, indent=2, ensure_ascii=False)
        print(f"\nHarvesting finished. Catalog saved to {catalog_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Alipay Resource Harvester")
    parser.add_argument("--dir", required=True, help="Decompiled directory (fallback version recommended)")
    parser.add_argument("--out", required=True, help="Output directory for harvested assets")
    args = parser.parse_args()
    
    harvester = AlipayHarvester(args.dir, args.out)
    harvester.harvest_dsl()
    harvester.harvest_images()
    harvester.save_catalog()
