import re
import json
import os
import ast

BASE_DIR = "/Users/purew/Desktop/android-os/apps/Bilibili/data"

def load_data_from_ts(filename):
    filepath = os.path.join(BASE_DIR, filename)
    print(f"Loading {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex to extract the object part.
    # Matches "export const NAME [: Type] = " until end.
    # We look for the first occurrence of "="
    # But TypeScript has types like ": Record<string, ...> =" or ": BilibiliVideo[] ="
    
    # Match everything after `export const \w+(?:[:\s\w<>,\[\]]+)?\s*=\s*`
    match = re.search(r'export const \w+(?:.+?)?=\s*([\{\[].*);?\s*', content, re.DOTALL)
    if not match:
        print(f"Could not find data in {filename}")
        return None
    
    json_str = match.group(1)
    # Remove trailing semicolon if present (captured in group, but regex above has ;?\s*)
    json_str = json_str.strip()
    if json_str.endswith(';'):
        json_str = json_str[:-1]
    
    # Cleanup TS specific syntax if any.
    # Assuming the content is pure JSON-like structure.
    # However, `authorData` keys are quoted? "516902465": ... YES.
    # `rankingData` keys? "全站": ... YES.
    # `videoData` keys? "id": ... YES.
    
    # We use ast.literal_eval for safety and relaxation (e.g. single quotes allowed in python)
    # But we need to handle true/false/null
    # Since these are huge files, regex replace might be better.
    
    # Replace true/false/null with Python equivalents
    # Use word boundaries to avoid replacing parts of strings
    # But strings might contain "true" etc. Risk: low providing data is regular.
    # Better: use regex to replace only unquoted keywords.
    # Or just use `json.loads`? Standard JSON usually uses double quotes. `videoData.ts` uses double quotes.
    # Let's try json.loads first. If it fails, fallback to ast.
    
    try:
        data = json.loads(json_str)
        return data
    except json.JSONDecodeError as e:
        print(f"JSON decode error in {filename}: {e}. Trying AST eval...")
        # Prepare for AST eval
        # Replace unquoted true/false/null
        # This regex looks for word boundaries and makes sure it's not inside quotes? Hard.
        # Simple replace might work if we assume strings don't overlap.
        # Actually, let's just do simple replace.
        py_str = json_str.replace("true", "True").replace("false", "False").replace("null", "None")
        return ast.literal_eval(py_str)

all_videos = {}

# Order: Author (Base) -> VideoData (to keep old rich data) -> Recommend -> Hot -> Ranking
# Wait, user said "authorData中的视频信息是最少的，小心不要让它覆盖掉别的视频数据".
# This means we should process AuthorData FIRST.
# Then Overlay richer data.
# The user also said: "establish a complete data file... including rankingData, videoData, hotData, recommendData, authorData"

# 1. Author Data
author_data = load_data_from_ts("authorData.ts")
if author_data:
    print(f"Loaded {len(author_data)} authors.")
    for mid, user in author_data.items():
        if 'videos' in user:
            for v in user['videos']:
                # Ensure base fields
                video_entry = {
                    "id": v.get("id") or v.get("bvid"), # handle legacy just in case
                    "title": v.get("title", ""),
                    "cover": v.get("cover") or v.get("pic", ""),
                    "author": user.get("name", "Unknown"),
                    "face": user.get("face", ""),
                    "plays": v.get("plays", 0),
                    "duration": v.get("duration", "0:00"),
                    "date": v.get("date", 0),
                    # Missing: desc, partitioning, raw
                }
                # If plays is string '123' convert to number
                if isinstance(video_entry['plays'], str):
                    try:
                        video_entry['plays'] = int(video_entry['plays'])
                    except:
                        pass # keep as is or 0
                
                vid = video_entry['id']
                if vid:
                    all_videos[vid] = video_entry

print(f"Videos after AuthorData: {len(all_videos)}")

# 2. Video Data (Existing DB) - Should be merged NEXT?
# If we merge it next, it will overwrite author data (which is good, because videoData is richer).
# If we merge it last, it also overwrites.
# Let's just merge everything else now.

def merge_video_list(source_name, video_list):
    print(f"Merging {source_name} with {len(video_list)} videos...")
    count = 0
    new_count = 0
    for v in video_list:
        vid = v.get("id") or v.get("bvid")
        if not vid:
            continue
            
        # Standardize
        # v might have 'pic' instead of 'cover' if raw
        # But our files seem consistent with BilibiliVideo interface now (id, cover, etc)
        # Check raw
        if 'raw' in v:
            # Maybe extract better info from raw?
            pass
            
        if vid in all_videos:
            # Merge
            # prefer new data if not empty
            existing = all_videos[vid]
            for key, val in v.items():
                if val is not None and val != "":
                     existing[key] = val
            all_videos[vid] = existing
        else:
            all_videos[vid] = v
            new_count += 1
        count += 1
    print(f"Merged {count} videos (New: {new_count})")

video_data = load_data_from_ts("videoData.ts")
if video_data:
    merge_video_list("VideoData", video_data)

recommend_data = load_data_from_ts("recommendData.ts")
if recommend_data:
    merge_video_list("RecommendData", recommend_data)

hot_data = load_data_from_ts("hotData.ts")
if hot_data:
    merge_video_list("HotData", hot_data)

ranking_data = load_data_from_ts("rankingData.ts")
if ranking_data:
    print(f"Merging RankingData...")
    for partition, v_list in ranking_data.items():
        merge_video_list(f"RankingData-{partition}", v_list)


print(f"Total Videos: {len(all_videos)}")

# Write back to videoData.ts
output_path = os.path.join(BASE_DIR, "videoData.ts")
video_list_sorted = sorted(list(all_videos.values()), key=lambda x: x.get('date') or 0, reverse=True)

# Generate TS content
ts_content = "import { BilibiliVideo } from '../types';\n\n"
ts_content += "export const VIDEO_DATA: BilibiliVideo[] = "
ts_content += json.dumps(video_list_sorted, indent=4, ensure_ascii=False)
ts_content += ";\n"

with open(output_path, 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f"Successfully wrote {len(video_list_sorted)} videos to {output_path}")
