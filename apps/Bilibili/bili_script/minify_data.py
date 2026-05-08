import re
import json
import os

BASE_DIR = "/Users/purew/Desktop/android-os/apps/Bilibili/data"

def minify_ranking():
    filepath = os.path.join(BASE_DIR, "rankingData.ts")
    print(f"Minifying {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update Interface
    # Check if interface exists (it might not if I already tried to replace part of it, but previous step failed, so it should be pristine)
    
    # Match interface block
    interface_pattern = r'export interface RankingVideo \{[^}]+\}'
    new_interface = """export interface RankingVideo {
    id: string;
    title?: string;
    cover?: string;
    author?: string;
    face?: string;
    plays?: number;
    danmaku?: number;
    duration?: number | string;
    desc?: string;
    score?: number;
    rank: number;
    partition: string;
    raw?: any;
}"""
    content = re.sub(interface_pattern, new_interface, content)

    # 2. Update Data
    # Pattern: export const RANKING_DATA: Record<string, RankingVideo[]> = {...};
    match = re.search(r'export const RANKING_DATA: Record<string, RankingVideo\[\]> = (\{.*\});', content, re.DOTALL)
    if match:
        json_str = match.group(1)
        try:
            data = json.loads(json_str)
            minified_data = {}
            for partition, videos in data.items():
                minified_list = []
                for v in videos:
                    # Keep minimal
                    minified_item = {
                        "id": v["id"],
                        "rank": v["rank"],
                        "partition": v["partition"],
                        "title": v.get("title", "") # Keep title for human readability
                    }
                    minified_list.append(minified_item)
                minified_data[partition] = minified_list
            
            # Write back
            new_json_str = json.dumps(minified_data, ensure_ascii=False, indent=4)
            # Replace in content
            start, end = match.span(1) # Group 1 is the JSON part
            content = content[:start] + new_json_str + content[end:]
            
        except Exception as e:
            print(f"Error parsing JSON in rankingData: {e}")
            return
    else:
        print("Could not find RANKING_DATA object")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done rankingData.")

def minify_list_file(filename, var_name, type_name="BilibiliVideo[]"):
    filepath = os.path.join(BASE_DIR, filename)
    print(f"Minifying {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to capture the array content
    # Look for [ ... ]; 
    match = re.search(fr'export const {var_name}(?::\s*[^=]+)?\s*=\s*(\[.*\]);', content, re.DOTALL)
    
    if match:
        json_str = match.group(1)
        try:
            data = json.loads(json_str)
            minified_list = []
            for v in data:
                minified_item = {
                    "id": v["id"],
                    "title": v.get("title", "")
                }
                minified_list.append(minified_item)
            
            new_json_str = json.dumps(minified_list, ensure_ascii=False, indent=4)
            start, end = match.span(1)
            content = content[:start] + new_json_str + content[end:]
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Done {filename}.")
        except Exception as e:
            print(f"Error parsing JSON in {filename}: {e}")
    else:
        print(f"Could not find {var_name} in {filename}")

def minify_author_data():
    filepath = os.path.join(BASE_DIR, "authorData.ts")
    print(f"Minifying {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = re.search(r'export const AUTHOR_DATA: Record<number, UserInfo> = (\{.*\});', content, re.DOTALL)
    if match:
        json_str = match.group(1)
        try:
            data = json.loads(json_str)
            for mid, user in data.items():
                if 'videos' in user:
                    min_videos = []
                    for v in user['videos']:
                         min_videos.append({
                             "id": v.get("id") or v.get("bvid"),
                             "title": v.get("title", ""),
                             "date": v.get("date")
                         })
                    user['videos'] = min_videos
            
            new_json_str = json.dumps(data, ensure_ascii=False, indent=4)
            start, end = match.span(1)
            content = content[:start] + new_json_str + content[end:]

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print("Done authorData.")

        except Exception as e:
            print(f"Error parsing JSON in authorData: {e}")
    else:
        print("Could not find AUTHOR_DATA")

if __name__ == "__main__":
    minify_ranking()
    minify_list_file("hotData.ts", "HOT_DATA", "BilibiliVideo[]")
    minify_list_file("recommendData.ts", "RECOMMEND_DATA", "BilibiliVideo[]")
    minify_author_data()
