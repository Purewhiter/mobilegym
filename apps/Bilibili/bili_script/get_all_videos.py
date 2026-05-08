import asyncio
import json
from bilibili_api import video_zone

OUTPUT_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/videoData.ts"

# 1. Mapping from PID_V2 (from API raw data) to UI Partition Name
# Based on video_zone_v2.md
PID_V2_MAP = {
    1001: "影视",
    1002: "娱乐",
    1003: "音乐",
    1004: "舞蹈",
    1005: "动画",
    1006: "绘画",
    1007: "鬼畜",
    1008: "游戏",
    1009: "资讯",
    1010: "知识",
    1011: "人工智能",
    1012: "科技数码",
    1013: "汽车",
    1014: "时尚美妆",
    1015: "家装房产",
    1016: "户外潮流",
    1017: "健身",
    1018: "体育运动",
    1019: "手工",
    1020: "美食",
    1021: "小剧场",
    1022: "旅游出行",
    1023: "三农",
    1024: "动物",
    1025: "亲子",
    1026: "健康",
    1027: "情感",
    1028: "神秘学",
    1029: "VLOG", # Flatten to upper case for UI consistency if needed
    1030: "生活兴趣",
    1031: "生活经验",
}

# 2. V1 TIDs to fetch from (Source of Truth for fetching)
# Includes main partitions and key sub-partitions to ensure coverage
V1_FETCH_MAP = {
    "动画": 1,
    "番剧": 13,
    "国创": 167,
    "音乐": 3,
    "舞蹈": 129,
    "游戏": 4,
    "知识": 36,
    "科技": 188,
    "运动": 234,
    "汽车": 223,
    "生活": 160,
    "美食": 211,
    "动物圈": 217,
    "鬼畜": 119,
    "时尚": 155,
    "资讯": 202,
    "娱乐": 5,
    "影视": 181,
    "纪录片": 177,
    "电影": 23,
    "电视剧": 11,
    # Sub-partitions for better density
    "手工": 161,
    "绘画": 162,
    "日常": 21,
    "搞笑": 138,
    "综艺": 71,
    "家居房产": 239,
    "健身": 164,
    "出行": 250,
    "三农": 251,
    "小剧场": 85,
    "亲子": 254,
    "单机游戏": 17,
    "手机游戏": 172,
    "网络游戏": 65,
    "电子竞技": 171
}

def format_number(num):
    try:
        return int(num)
    except:
        return 0

def format_duration(seconds):
    if not isinstance(seconds, (int, float)):
        return str(seconds)
    m, s = divmod(int(seconds), 60)
    if m >= 60:
        h, m = divmod(m, 60)
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"

async def process_tid(name, tid):
    print(f"Fetching V1 Partition: {name} (TID {tid})...")
    try:
        # Increase page size to 50 as requested
        res = await video_zone.get_zone_new_videos(tid, page_size=50)
        v_list = res.get('archives', []) if isinstance(res, dict) else res
        
        valid_videos = [v for v in v_list if 'bvid' in v]
        
        processed = []
        for v in valid_videos:
            # Detect Partition Name using PID_V2
            pid_v2 = v.get('pid_v2', 0)
            
            # Default to using the mapped name from PID_V2
            if pid_v2 in PID_V2_MAP:
                partition_name = PID_V2_MAP[pid_v2]
            else:
                # Fallback: if no PID V2 match (e.g. PGC content often has pid_v2=0 or special ones)
                # We check tname or use the fetch source name
                # Try to infer from tname if possible, otherwise fallback to fetch source
                
                # Special PGC handling
                if v.get('is_ogv'):
                     # Basic PGC mapping
                     if tid == 13: partition_name = "番剧"
                     elif tid == 167: partition_name = "国创"
                     elif tid == 23: partition_name = "电影"
                     elif tid == 11: partition_name = "电视剧"
                     elif tid == 177: partition_name = "纪录片"
                     else: partition_name = v.get('tname', name)
                else:
                    partition_name = v.get('tname', name)

            # Construct Item
            item = {
                "id": v['bvid'],
                "title": v['title'],
                "desc": v.get('desc', ''),
                "cover": v['pic'].replace("http://", "https://"),
                "author": v['owner']['name'],
                "face": v['owner']['face'].replace("http://", "https://"),
                "plays": format_number(v['stat']['view']),
                "danmaku": format_number(v['stat']['danmaku']),
                "duration": format_duration(v['duration']),
                "partition": partition_name,
                "isAd": False,
                "raw": v,
                "isPGC": v.get('is_ogv', False)
            }
            processed.append(item)
            
        print(f"  -> Got {len(processed)} videos")
        return processed

    except Exception as e:
        print(f"  -> Error: {e}")
        return []

async def main():
    all_videos = []
    
    # Iterate over our V1 fetch list
    for name, tid in V1_FETCH_MAP.items():
        videos = await process_tid(name, tid)
        all_videos.extend(videos)
        await asyncio.sleep(0.3)
    
    # Deduplicate by ID
    seen = set()
    unique = []
    for v in all_videos:
        if v['id'] not in seen:
            seen.add(v['id'])
            unique.append(v)
            
    print(f"Total Unique Videos: {len(unique)}")
    
    # Write File
    json_str = json.dumps(unique, ensure_ascii=False, indent=4)
    file_content = f"""import {{ BilibiliVideo }} from '../types';

export const VIDEO_DATA: BilibiliVideo[] = {json_str};
"""
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(file_content)
    print(f"Written to {OUTPUT_FILE}")

if __name__ == "__main__":
    asyncio.run(main())
