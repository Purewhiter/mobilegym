import asyncio
import json
import os
from datetime import datetime
from bilibili_api import homepage, hot

OUTPUT_DIR = "/Users/purew/Desktop/android-os/apps/Bilibili/data"
RECOMMEND_FILE = os.path.join(OUTPUT_DIR, "recommendData.ts")
HOT_FILE = os.path.join(OUTPUT_DIR, "hotData.ts")

def normalize_video(item):
    """Normalize API response to BilibiliVideo interface"""
    # Helper to safely get nested dicts
    stat = item.get('stat', {})
    if not stat:
        # Some endpoints might put stat at top level or different structure
        pass
        
    owner = item.get('owner', {})
    
    # Handle potentially different structures between homepage and hot
    # Homepage structure usually: item['item'] -> list of items
    # Hot structure usually: list of items
    
    return {
        "id": item.get('bvid', ''),
        "title": item.get('title', ''),
        "cover": item.get('pic', ''),
        "author": owner.get('name', ''),
        "face": owner.get('face', ''),
        "plays": int(stat.get('view', 0)),
        "danmaku": int(stat.get('danmaku', 0)),
        "duration": item.get('duration', 0), # Sometimes seconds (int) or string
        "desc": item.get('desc', ''),
        "score": item.get('score', 0), # Often missing in standard feed
        "pubdate": item.get('pubdate', 0),
        "raw": item
    }

async def main():
    print("Fetching Homepage Videos...")
    try:
        data_home = await homepage.get_videos()
        items_home = data_home.get('item', [])
        print(f"Got {len(items_home)} homepage videos.")
        
        normalized_home = [normalize_video(v) for v in items_home]
        
        # Save Recommend Data
        ts_home = f"""
import {{ BilibiliVideo }} from '../types';

export const RECOMMEND_DATA: BilibiliVideo[] = {json.dumps(normalized_home, ensure_ascii=False, indent=4)};
"""
        with open(RECOMMEND_FILE, 'w', encoding='utf-8') as f:
            f.write(ts_home)
        print(f"Saved {RECOMMEND_FILE}")
        
    except Exception as e:
        print(f"Error fetching homepage: {e}")

    print("\nFetching Hot Videos...")
    try:
        data_hot = await hot.get_hot_videos()
        items_hot = data_hot.get('list', [])
        print(f"Got {len(items_hot)} hot videos.")
        
        normalized_hot = [normalize_video(v) for v in items_hot]
        
        # Save Hot Data
        ts_hot = f"""
import {{ BilibiliVideo }} from '../types';

export const HOT_DATA: BilibiliVideo[] = {json.dumps(normalized_hot, ensure_ascii=False, indent=4)};
"""
        with open(HOT_FILE, 'w', encoding='utf-8') as f:
            f.write(ts_hot)
        print(f"Saved {HOT_FILE}")
        
    except Exception as e:
        print(f"Error fetching hot videos: {e}")

if __name__ == "__main__":
    asyncio.run(main())
