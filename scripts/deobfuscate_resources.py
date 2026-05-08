import os
import re
import argparse
import xml.etree.ElementTree as ET

def parse_public_xml(public_xml_path):
    """Builds a map of ID -> Name from public.xml"""
    id_map = {}
    if not os.path.exists(public_xml_path):
        return id_map
    
    try:
        tree = ET.parse(public_xml_path)
        root = tree.getroot()
        for public in root.findall('public'):
            res_id = public.get('id')
            res_name = public.get('name')
            if res_id and res_name:
                id_map[res_id.lower()] = res_name
    except Exception as e:
        print(f"Error parsing public.xml: {e}")
    
    return id_map

def scan_smali_for_ids(smali_root):
    """Scans all smali files to find which class uses which ID"""
    id_to_classes = {}
    # Pattern to match hex IDs like 0x7f140001
    id_pattern = re.compile(r'0x7f[0-9a-f]{6}')
    
    print(f"Scanning Smali files in {smali_root} (this may take a while)...")
    for root, _, files in os.walk(smali_root):
        for file in files:
            if file.endswith('.smali'):
                file_path = os.path.join(root, file)
                # Infer class name from path or file content
                # For simplicity, we'll use the relative path as a hint
                class_hint = file[:-6] # Remove .smali
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        matches = id_pattern.findall(content)
                        for match in matches:
                            res_id = match.lower()
                            if res_id not in id_to_classes:
                                id_to_classes[res_id] = set()
                            id_to_classes[res_id].add(class_hint)
                except Exception:
                    continue
    return id_to_classes

def get_semantic_name(res_id, classes):
    """Derives a better name based on the classes using the ID"""
    if not classes:
        return f"unused_{res_id}"
    
    # Filter for interesting class names
    hints = []
    for cls in classes:
        parts = cls.split('/')
        last_part = parts[-1]
        # Common suffixes/keywords
        for kw in ['Activity', 'Fragment', 'Dialog', 'Adapter', 'View']:
            if kw in last_part:
                hints.append(last_part)
                break
    
    if hints:
        # Use the first good hint
        return f"{hints[0]}_{res_id}"
    
    # Fallback to the first class name if no specific hint found
    return f"{list(classes)[0].split('/')[-1]}_{res_id}"

def deobfuscate(decompiled_dir):
    res_path = os.path.join(decompiled_dir, 'res')
    public_xml = os.path.join(res_path, 'values', 'public.xml')
    smali_dirs = [d for d in os.listdir(decompiled_dir) if d.startswith('smali')]
    
    # 1. Map ID -> Name from public.xml
    id_map = parse_public_xml(public_xml)
    
    # 2. Build ID -> Classes from Smali
    id_to_classes = {}
    for smali_dir in smali_dirs:
        id_to_classes.update(scan_smali_for_ids(os.path.join(decompiled_dir, smali_dir)))
    
    # 3. Rename files in res/ (focusing on xml and layout)
    target_dirs = ['xml', 'layout', 'menu']
    rename_count = 0
    
    for t_dir in target_dirs:
        dir_path = os.path.join(res_path, t_dir)
        if not os.path.exists(dir_path):
            continue
        
        for filename in os.listdir(dir_path):
            # Match APKTOOL_DUMMYVAL_0x7f...
            match = re.search(r'0x7f[0-9a-f]{6}', filename)
            if match:
                res_id = match.group(0).lower()
                real_name = id_map.get(res_id)
                
                # If the name in public.xml is also dummy or missing, use semantics
                if not real_name or "APKTOOL_DUMMYVAL" in real_name:
                    real_name = get_semantic_name(res_id, id_to_classes.get(res_id, []))
                
                new_filename = filename.replace(f"APKTOOL_DUMMYVAL_{res_id}", real_name)
                # Remove extra hex codes to keep it clean if we used semantics
                if res_id in new_filename and not new_filename.startswith("unused"):
                     new_filename = new_filename.replace(f"_{res_id}", "")
                
                old_path = os.path.join(dir_path, filename)
                new_path = os.path.join(dir_path, new_filename)
                
                if old_path != new_path:
                    try:
                        os.rename(old_path, new_path)
                        print(f"Renamed: {filename} -> {new_filename}")
                        rename_count += 1
                    except Exception as e:
                        print(f"Error renaming {filename}: {e}")

    print(f"\nDeobfuscation complete. Renamed {rename_count} files.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Universal Android Resource Deobfuscator")
    parser.add_argument("--dir", required=True, help="Decompiled APK directory")
    args = parser.parse_args()
    
    deobfuscate(args.dir)
