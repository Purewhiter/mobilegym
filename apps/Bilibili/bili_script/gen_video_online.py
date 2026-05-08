import asyncio
import re
import json
import random
from bilibili_api import video

INPUT_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/videoData.ts"
OUTPUT_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/videoOnline.ts"

# Extract BVIDs using regex to avoid parsing full TS file
def extract_bvids(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Match "id": "BV..." patterns
    return list(set(re.findall(r'"id":\s*"(BV[a-zA-Z0-9]+)"', content)))

async def fetch_online_safe(sem, bvid):
    async with sem:
        try:
            # Sleep a bit to be polite (0.2 to 0.8s)
            await asyncio.sleep(random.uniform(0.2, 0.8))
            
            v = video.Video(bvid=bvid)
            # get_online returns: {'total': '110', 'count': '5', ...}
            online_data = await v.get_online()
            
            total_online = online_data.get('total', '0')
            print(f"[{bvid}] Online: {total_online}")
            return bvid, total_online
            
        except Exception as e:
            # print(f"[{bvid}] Error: {e}") # Reduce noise for normal failures/timeouts
            return bvid, "0"

async def main():
    bvids = extract_bvids(INPUT_FILE)
    print(f"Found {len(bvids)} videos to process.")
    
    # Use Semaphore to limit concurrency
    sem = asyncio.Semaphore(5)
    
    tasks = []
    for bvid in bvids:
        tasks.append(fetch_online_safe(sem, bvid))
    
    results = await asyncio.gather(*tasks)
    
    # Construct dictionary
    online_map = {bvid: online for bvid, online in results}
    
    print(f"Successfully fetched online stats for {len(online_map)} videos.")
    
    # Write to Typescript file
    json_str = json.dumps(online_map, ensure_ascii=False, indent=4)
    content = f"""
export const VIDEO_ONLINE: Record<string, string> = {json_str};
"""
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Written online data to {OUTPUT_FILE}")

if __name__ == "__main__":
    asyncio.run(main())
