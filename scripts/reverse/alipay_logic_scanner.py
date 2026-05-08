import os
import re
import json

def scan_alipay_smali(smali_root):
    role_map = {
        "SETTINGS": [],
        "PAY": [],
        "LOGIN": [],
        "SOCIAL": [],
        "MINI_APP": [],
        "CASHIER": [],
        "VIEWER": [],
        "EDITOR": []
    }
    
    keywords = {
        "SETTINGS": ["Setting", "Config", "Privacy"],
        "PAY": ["PayActivity", "Payment", "Transfer"],
        "LOGIN": ["Login", "Auth", "Register"],
        "SOCIAL": ["Contact", "Chat", "Conversation", "Feed", "Social"],
        "MINI_APP": ["TinyApp", "H5Activity", "MiniApp", "Nebula"],
        "CASHIER": ["Cashier", "Wallet", "Trade"],
        "VIEWER": ["Info", "Detail", "Show", "Display"],
        "EDITOR": ["Edit", "Input", "Create"]
    }
    
    all_activities = set()
    activity_count = 0
    
    print(f"Brute-forcing Smali logic in {smali_root}...")
    
    for root, _, files in os.walk(smali_root):
        for file in files:
            if file.endswith('.smali'):
                class_path = os.path.join(root, file)
                # Infer class name: com/alipay/foo.smali -> com.alipay.foo
                rel_path = os.path.relpath(class_path, smali_root)
                class_name = rel_path.replace('/', '.').replace('\\', '.')[:-6]
                
                # We only care about Activity classes for the map
                if "Activity" in class_name:
                    all_activities.add(class_name)
                    activity_count += 1
                    
                    found = False
                    for role, kws in keywords.items():
                        for kw in kws:
                            if kw in class_name:
                                role_map[role].append(class_name)
                                found = True
                                break
                        if found: break
    
    return role_map, activity_count

if __name__ == "__main__":
    smali_dirs = ["decompiled/Alipaygphone_decompiled_fallback/smali", 
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes2",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes3",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes4",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes5",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes6",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes7",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes8",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes9",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes10",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes11",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes12",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes13",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes14",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes15",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes16",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes17",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes18",
                  "decompiled/Alipaygphone_decompiled_fallback/smali_classes19"]
    
    total_map = {}
    total_count = 0
    
    for d in smali_dirs:
        if os.path.exists(d):
            rmap, count = scan_alipay_smali(d)
            total_count += count
            for role, classes in rmap.items():
                if role not in total_map: total_map[role] = []
                total_map[role].extend(classes)
    
    print(f"\nFinal Alipay Logic Map:")
    print(f"Total Activities Detected: {total_count}")
    for role, classes in total_map.items():
        print(f"  - {role}: {len(classes)} activities")
        
    with open("alipay_logic_map.json", "w") as f:
        json.dump(total_map, f, indent=2)
    print("\nMap saved to alipay_logic_map.json")
