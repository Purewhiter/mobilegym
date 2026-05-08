import os
import xml.etree.ElementTree as ET
import json
import argparse
from pathlib import Path

def parse_manifest(manifest_path):
    tree = ET.parse(manifest_path)
    root = tree.getroot()
    ns = '{http://schemas.android.com/apk/res/android}'
    
    package = root.get('package')
    activities = []
    
    for activity in root.findall('application/activity') + root.findall('application/activity-alias'):
        name = activity.get(f'{ns}name')
        label = activity.get(f'{ns}label')
        exported = activity.get(f'{ns}exported') == 'true'
        
        intents = []
        for intent_filter in activity.findall('intent-filter'):
            for action in intent_filter.findall('action'):
                action_name = action.get(f'{ns}name')
                intents.append(action_name)
            # Also capture categories so we can detect LAUNCHER entry points.
            # (Previously we only captured actions, which caused entry_points to be empty.)
            for category in intent_filter.findall('category'):
                category_name = category.get(f'{ns}name')
                intents.append(category_name)
                
        activities.append({
            "name": name,
            "label": label,
            "exported": exported,
            "intents": intents
        })
        
    return package, activities

def parse_strings(strings_path):
    if not strings_path or not os.path.exists(strings_path):
        return {}
        
    tree = ET.parse(strings_path)
    root = tree.getroot()
    
    strings = {}
    keywords = ["delete", "remove", "edit", "add", "new", "create", "search", "setting", "login", "register"]
    found_keywords = {}

    for string in root.findall('string'):
        name = string.get('name')
        value = string.text
        if value:
            strings[name] = value
            # Simple keyword matching
            for kw in keywords:
                if kw in name.lower() or kw in value.lower():
                    if kw not in found_keywords: found_keywords[kw] = []
                    found_keywords[kw].append({"name": name, "value": value})
                    
    return strings, found_keywords

def infer_semantic_role(name, label, intents):
    """
    Infers the semantic role of an activity based on its name, label, and intents.
    Returns a list of tags: ['HOME', 'SETTINGS', 'EDITOR', 'VIEWER', 'AUTH', 'UNKNOWN']
    """
    tags = []
    name_lower = name.lower()
    label_lower = label.lower() if label else ""
    
    # 1. Intent-based inference
    if "android.intent.action.MAIN" in intents and "android.intent.category.LAUNCHER" in intents:
        tags.append("HOME")
    if "android.intent.action.EDIT" in intents or "android.intent.action.INSERT" in intents:
        tags.append("EDITOR")
        
    # 2. Name-based inference
    if "settings" in name_lower or "preference" in name_lower:
        tags.append("SETTINGS")
    if "edit" in name_lower or "insert" in name_lower or "add" in name_lower:
        if "EDITOR" not in tags: tags.append("EDITOR")
    if "detail" in name_lower or "info" in name_lower:
        tags.append("VIEWER")
    if "login" in name_lower or "auth" in name_lower or "signin" in name_lower:
        tags.append("AUTH")
    if "web" in name_lower:
        tags.append("WEBVIEW")
    if "permission" in name_lower:
        tags.append("PERMISSION")
        
    # 3. Label-based refinement
    if not tags:
        if "设置" in label_lower or "settings" in label_lower:
            tags.append("SETTINGS")
        elif "详情" in label_lower or "detail" in label_lower:
            tags.append("VIEWER")
            
    if not tags:
        tags.append("OTHER")
        
    return list(set(tags))

def scan_smali_directory(smali_dir):
    """
    Scans a smali directory to build a static transition graph.
    Returns: { "SourceClass": ["TargetClass1", "TargetClass2"] }
    """
    transitions = {}
    
    # 1. Walk through all .smali files
    for root, dirs, files in os.walk(smali_dir):
        for file in files:
            if not file.endswith(".smali"):
                continue
                
            file_path = os.path.join(root, file)
            current_class = None
            potential_targets = set()
            has_start_activity = False
            
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
                
            for line in lines:
                line = line.strip()
                
                # Identify current class
                if line.startswith(".class"):
                    # .class public Lcom/android/calendar/settings/u;
                    parts = line.split(" ")
                    for p in parts:
                        if p.startswith("L") and p.endswith(";"):
                            current_class = p[1:-1].replace("/", ".")
                            break
                            
                # Identify potential target classes (heuristic: const-class usage)
                # const-class v0, Lcom/android/calendar/event/EditEventActivity;
                if "const-class" in line:
                    parts = line.split(" ")
                    for p in parts:
                        if p.startswith("L") and p.endswith(";"):
                            target = p[1:-1].replace("/", ".")
                            # Filter out system classes to reduce noise
                            if not target.startswith("android.") and not target.startswith("java."):
                                potential_targets.add(target)
                                
                # Identify transition triggers
                # invoke-virtual {p0, v0}, Landroid/content/Context;->startActivity(Landroid/content/Intent;)V
                if "startActivity" in line:
                    has_start_activity = True
                    
            # If this class starts components, link it to potential targets found in the file
            # This is a heuristic (over-approximation) but useful for exploration
            if current_class and has_start_activity and potential_targets:
                transitions[current_class] = list(potential_targets)

    return transitions

def main():
    parser = argparse.ArgumentParser(description="Static Analysis of Decompiled APK")
    parser.add_argument("--decompiled-dir", required=True, help="Path to decompiled APK folder")
    parser.add_argument("--output", default="capability_map.json", help="Output JSON path")
    
    args = parser.parse_args()
    base_dir = Path(args.decompiled_dir)
    
    manifest_path = base_dir / "AndroidManifest.xml"
    # Try generic strings first, then specific
    strings_path = base_dir / "res/values/strings.xml"
    if not strings_path.exists():
         # Fallback to finding any strings.xml
         potential = list(base_dir.rglob("values/strings.xml"))
         if potential: strings_path = potential[0]

    if not manifest_path.exists():
        print(f"Error: Manifest not found at {manifest_path}")
        return

    print(f"🔍 Analyzing Manifest: {manifest_path}")
    package, activities = parse_manifest(manifest_path)
    
    print(f"🔍 Analyzing Strings: {strings_path}")
    string_map, keywords = parse_strings(strings_path)
    
    print(f"🔍 Analyzing Smali Code for Transitions...")
    # Find all smali folders (smali, smali_classes2, etc.)
    all_transitions = {}
    smali_dirs = [d for d in base_dir.iterdir() if d.is_dir() and d.name.startswith("smali")]
    
    for d in smali_dirs:
        print(f"   Scanning {d.name}...")
        t = scan_smali_directory(d)
        all_transitions.update(t)

    # Filter transitions to only show those pointing to known Activities
    # This reduces noise significantly
    known_activity_names = set([a["name"] for a in activities])
    filtered_transitions = {}
    
    # Enrich Activity Data with Semantics
    enriched_activities = []
    for activity in activities:
        # Resolve Label
        raw_label = activity["label"]
        resolved_label = raw_label
        if raw_label and raw_label.startswith("@string/"):
            res_id = raw_label.replace("@string/", "")
            resolved_label = string_map.get(res_id, raw_label)
            
        # Infer Roles
        roles = infer_semantic_role(activity["name"], resolved_label, activity["intents"])
        
        enriched_activities.append({
            "name": activity["name"],
            "raw_label": raw_label,
            "label": resolved_label,
            "roles": roles,
            "exported": activity["exported"],
            "intents": activity["intents"]
        })

    for source, targets in all_transitions.items():
        valid_targets = [t for t in targets if t in known_activity_names and t != source]
        if valid_targets:
            filtered_transitions[source] = valid_targets
    
    # Identify Entry Points
    launchers = [a for a in enriched_activities if "HOME" in a["roles"]]
    
    # Identify Capabilities
    capabilities = {
        "package": package,
        "entry_points": [l["name"] for l in launchers],
        "activities": len(activities),
        "role_summary": {
            "HOME": len([a for a in enriched_activities if "HOME" in a["roles"]]),
            "SETTINGS": len([a for a in enriched_activities if "SETTINGS" in a["roles"]]),
            "EDITOR": len([a for a in enriched_activities if "EDITOR" in a["roles"]]),
            "VIEWER": len([a for a in enriched_activities if "VIEWER" in a["roles"]]),
        },
        "features": {
            "has_search": any("SEARCH" in i for a in activities for i in a["intents"]),
            "has_insert_event": any("INSERT" in i for a in activities for i in a["intents"]),
            "has_settings_link": any("APP_SETTINGS" in i for a in activities for i in a["intents"])
        },
        "keywords_found": {k: len(v) for k, v in keywords.items()}
    }
    
    report = {
        "summary": capabilities,
        "static_graph": filtered_transitions,
        "activities": enriched_activities, # Replaced 'details' with enriched list
        "string_keywords": keywords
    }
    
    with open(args.output, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        
    print(f"✅ Analysis complete. Map saved to {args.output}")
    print(f"   Package: {package}")
    print(f"   Launchers: {len(launchers)}")
    print(f"   Detected Features: {capabilities['features']}")
    print(f"   Static Transitions Found: {len(filtered_transitions)} classes with outgoing links")

if __name__ == "__main__":
    main()
