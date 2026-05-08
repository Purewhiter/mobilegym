import asyncio
import json
import re
from bilibili_api import video_zone, comment, rank

OUTPUT_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/videoData.ts"

# V1 Primary Zone IDs (TIDs)
# Based on the output of get_zones.py and standard Bilibili TIDs
# V1 Primary Zone IDs (TIDs)
# Based on the user provided get_zones.py output
FETCH_TIDS = [
    217,    # 动物圈
    13,     # 番剧
    223,    # 汽车
    181,    # 影视
    129,    # 舞蹈
    177,    # 纪录片
    1,      # 动画
    5,      # 娱乐
    155,    # 时尚
    211,    # 美食
    138,    # 搞笑
    4,      # 游戏
    167,    # 国创
    202,    # 资讯
    119,    # 鬼畜
    36,     # 知识
    160,    # 生活
    23,     # 电影
    3,      # 音乐
    234,    # 运动
    17,     # 单机游戏
    188,    # 科技
    11,     # 电视剧
    # Supplement for zones that appear as top-level but map to sub-TIDs in V1
    21,     # 日常 (VLOG)
    71,     # 综艺
]

def format_number(num):
    if not isinstance(num, (int, float)):
        return str(num)
    if num >= 100000000:
        return f"{num/100000000:.1f}亿"
    if num >= 10000:
        return f"{num/10000:.1f}万"
    return str(num)

def format_duration(seconds):
    if not isinstance(seconds, (int, float)):
        return str(seconds)
    m, s = divmod(int(seconds), 60)
    if m >= 60:
        h, m = divmod(m, 60)
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"

async def process_tid(tid):
    print(f"Fetching videos for TID {tid}...")
    try:
        # Increase page size to 30 as requested
        res = await video_zone.get_zone_new_videos(tid, page_size=30)
        v_list = res.get('archives', []) if isinstance(res, dict) else res
        
        # Filter valid videos
        valid_videos = [v for v in v_list if 'bvid' in v]
        
        processed_videos = []
        for v in valid_videos:
            # Strictly use V2 partition name from raw data
            # If unavailable (old API response?), fallback to sub-partition name but DO NOT map manually.
            partition_name = v.get('pid_name_v2', '')
            
            # Fallback only if V2 name is completely missing (e.g. for PGC sometimes)
            if not partition_name:
                partition_name = v.get('tname_v2', '') 
            if not partition_name:
                partition_name = v.get('tname', '')

            # Minimal fix for PGC items if they lack V2 names in this API response
            if not partition_name:
                 if tid == 13: partition_name = "番剧"
                 elif tid == 167: partition_name = "国创"
                 elif tid == 23: partition_name = "电影"
                 elif tid == 177: partition_name = "纪录片"
                 elif tid == 11: partition_name = "电视剧"

            is_pgc = v.get('is_ogv', False)
            
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
                "partition": partition_name, # Raw V2 name
                "isAd": False,
                "raw": v,
                "isPGC": is_pgc
            }
            
            processed_videos.append(item)
            
        print(f"  -> Got {len(processed_videos)} videos for TID {tid}")
        return processed_videos
        
    except Exception as e:
        print(f"  -> Error processing TID {tid}: {e}")
        return []

async def main():
    all_videos = []
    
    for tid in FETCH_TIDS:
        videos = await process_tid(tid)
        all_videos.extend(videos)
        await asyncio.sleep(0.5)
            
    # Deduplicate
    seen_ids = set()
    unique_videos = []
    for v in all_videos:
        if v['id'] not in seen_ids:
            seen_ids.add(v['id'])
            unique_videos.append(v)

    print(f"Total unique videos fetched: {len(unique_videos)}")
    
    # Write video data
    json_str = json.dumps(unique_videos, ensure_ascii=False, indent=4)
    file_content = f"""import {{ BilibiliVideo }} from '../types';

export const VIDEO_DATA: BilibiliVideo[] = {json_str};
"""
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(file_content)
    print(f"Successfully generated {OUTPUT_FILE}")

if __name__ == "__main__":
    asyncio.run(main())
