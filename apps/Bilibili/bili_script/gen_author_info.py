import asyncio
import re
import json
import random
import os
from datetime import datetime
from bilibili_api import user, sync
from bilibili_api import comment, Credential

# File Paths
DATA_DIR = "/Users/purew/Desktop/android-os/apps/Bilibili/data"
VIDEO_DATA_FILE = os.path.join(DATA_DIR, "videoData.ts")
RANKING_DATA_FILE = os.path.join(DATA_DIR, "rankingData.ts")
RECOMMEND_DATA_FILE = os.path.join(DATA_DIR, "recommendData.ts")
HOT_DATA_FILE = os.path.join(DATA_DIR, "hotData.ts")

OUTPUT_FILE = os.path.join(DATA_DIR, "authorData.ts")
TEMP_JSONL = os.path.join(DATA_DIR, "authorData.jsonl")

SESSDATA = ''
BILI_JCT = ''
BUVID3 = ""

credential = Credential(sessdata=SESSDATA, bili_jct=BILI_JCT, buvid3=BUVID3)


def extract_mids(content):
    # Extract "owner": { "mid": 12345 } or similar patterns
    # Since we are reading TS files with JSON-like objects, we can look for numeric values associated with 'mid'
    # But ONLY from video files, which are dominated by authors.
    
    # Matches "mid": 12345
    matches = re.findall(r'[\'"]?mid[\'"]?:\s*(\d+)', content)
    return {int(m) for m in matches if int(m) > 0}

async def fetch_author_info(sem, mid, existing_data):
    if mid in existing_data:
        return existing_data[mid]

    async with sem:
        try:
            # Delay
            await asyncio.sleep(random.uniform(0.2, 0.7))
            
            u = user.User(mid,
            # credential=credential
            )
            
            # Fetch Info
            info = await u.get_user_info()
            
            await asyncio.sleep(random.uniform(0.3, 0.8))
            # Fetch Stat (Likes, Views) - relation info is usually in info or separate get_relation_info?
            # get_user_info returns standard profile info.
            # Relation (followers) needs separate call usually?
            # get_user_info result typically has media info but maybe not follower count in some versions.
            # Let's double check probing result from user: 
            # User Probe: 'friend': 119, 'follower': 2308536... is in `get_relation_info` output (Step 1338).
            # `get_user_info` output in Step 1338 did NOT have follower count. It had `moral`, `coins`.
            
            relation = await u.get_relation_info()
            
            await asyncio.sleep(random.uniform(0.3, 0.6))
            # Fetch Up Stat (for total likes)
            # up_stat = await u.get_up_stat() # This endpoint often fails or needs cookie.
            # Alternative: iterate videos? No.
            # The 'relation' or 'card' might have it?
            # Let's try get_up_stat, if fail, ignore.
            likes = 0
            try:
                up_stat = await u.get_up_stat()
                likes = up_stat.get('likes', 0)
            except:
                # Fallback or just 0
                pass
                
            # Fetch Videos (Top 10)
            await asyncio.sleep(random.uniform(0.3, 0.7))
            video_res = await u.get_videos(ps=12) # Fetch 12 for grid
            video_list = []
            if video_res and 'list' in video_res and 'vlist' in video_res['list']:
                for v in video_res['list']['vlist']:
                    video_list.append({
                        'bvid': v.get('bvid'),
                        'title': v.get('title'),
                        'pic': v.get('pic'), # Cover
                        'play': v.get('play'),
                        'length': v.get('length'),
                        'created': v.get('created')
                    })

            # Consolidated Data
            author_data = {
                'mid': mid,
                'name': info.get('name', ''),
                'face': info.get('face', ''),
                'sign': info.get('sign', ''),
                'level': info.get('level', 0),
                'vip': {
                    'status': info.get('vip', {}).get('status'),
                    'label': info.get('vip', {}).get('label', {}).get('text')
                },
                'official': {
                    'role': info.get('official', {}).get('role'),
                    'title': info.get('official', {}).get('title'),
                    'type': info.get('official', {}).get('type')
                },
                'top_photo': info.get('top_photo', ''),
                'live_room': info.get('live_room', {}), # Contains live URL, title, cover
                
                # Stats
                'follower': relation.get('follower', 0),
                'following': relation.get('following', 0),
                'likes': likes,
                
                # Videos
                'videos': video_list
            }

            # Append
            with open(TEMP_JSONL, 'a', encoding='utf-8') as f:
                f.write(json.dumps(author_data, ensure_ascii=False) + "\n")
            
            print(f"Fetched [{mid}] {author_data['name']} (Fans: {author_data['follower']})")
            return author_data

        except Exception as e:
            print(f"Error fetching [{mid}]: {e}")
            return None

def convert_to_ts():
    print("Converting JSONL to TS...")
    authors = {}
    if os.path.exists(TEMP_JSONL):
        with open(TEMP_JSONL, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        u = json.loads(line)
                        authors[u['mid']] = u
                    except: pass
    
    ts_content = f"""
// Auto-generated Author Data
// Timestamp: {datetime.now().isoformat()}

import {{ UserInfo, AuthorVideo }} from '../types';

export const AUTHOR_DATA: Record<number, UserInfo> = {json.dumps(authors, ensure_ascii=False, indent=4)};
"""
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(ts_content)
    print(f"Generated {OUTPUT_FILE} with {len(authors)} authors.")

async def main():
    print("Scanning for Author MIDs...")
    # Only scan video lists to focus on Authors
    files = [VIDEO_DATA_FILE, RANKING_DATA_FILE, RECOMMEND_DATA_FILE, HOT_DATA_FILE]
    all_mids = set()
    
    for fw in files:
        if os.path.exists(fw):
            with open(fw, 'r', encoding='utf-8') as f:
                content = f.read()
                found = extract_mids(content)
                print(f"{os.path.basename(fw)}: {len(found)} MIDs")
                all_mids.update(found)
    
    print(f"Total Unique Authors: {len(all_mids)}")
    
    # Load Existing
    existing_mids = set()
    existing_data = {}
    if os.path.exists(TEMP_JSONL):
        with open(TEMP_JSONL, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        u = json.loads(line)
                        existing_mids.add(u['mid'])
                        existing_data[u['mid']] = u
                    except: pass
                    
    print(f"Already fetched: {len(existing_mids)}")
    
    to_fetch = list(all_mids - existing_mids)
    print(f"To fetch: {len(to_fetch)}")
    
    if not to_fetch:
        convert_to_ts()
        return

    random.shuffle(to_fetch)
    
    sem = asyncio.Semaphore(1) 
    
    # Batch processing
    batch_size = 10
    total = len(to_fetch)
    
    for i in range(0, total, batch_size):
        batch = to_fetch[i : i + batch_size]
        tasks = [fetch_author_info(sem, mid, existing_data) for mid in batch]
        await asyncio.gather(*tasks)
        print(f"Progress: {min(i + batch_size, total)}/{total}")
        convert_to_ts()
    
    convert_to_ts()

if __name__ == "__main__":
    asyncio.run(main())
