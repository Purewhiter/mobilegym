import asyncio
import re
import json
import random
from bilibili_api import video

INPUT_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/videoData.ts"
OUTPUT_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/videoTags.ts"

# Extract BVIDs using regex to avoid parsing full TS file
def extract_bvids(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Match "id": "BV..." patterns
    return list(set(re.findall(r'"id":\s*"(BV[a-zA-Z0-9]+)"', content)))

async def fetch_tags_safe(sem, bvid):
    async with sem:
        try:
            # Sleep a bit to be polite
            await asyncio.sleep(random.uniform(0.1, 0.5))
            
            v = video.Video(bvid=bvid)
            tags = await v.get_tags()
            
            # Extract just tag names
            tag_names = [t['tag_name'] for t in tags]
            print(f"[{bvid}] Fetched {len(tag_names)} tags")
            return bvid, tag_names
            
        except Exception as e:
            print(f"[{bvid}] Error: {e}")
            return bvid, []

async def main():
    bvids = extract_bvids(INPUT_FILE)
    print(f"Found {len(bvids)} videos to process.")
    
    # Use Semaphore to limit concurrency (stay safe)
    # 5 concurrent requests is usually safe for Bilibili with delays
    sem = asyncio.Semaphore(5)
    
    tasks = []
    for bvid in bvids:
        tasks.append(fetch_tags_safe(sem, bvid))
    
    # Execute batch by batch or all gathered?
    # Gather all is fine with semaphore
    results = await asyncio.gather(*tasks)
    
    # Construct dictionary
    tags_map = {bvid: tags for bvid, tags in results if tags}
    
    print(f"Successfully fetched tags for {len(tags_map)} videos.")
    
    # Write to Typescript file
    json_str = json.dumps(tags_map, ensure_ascii=False, indent=4)
    content = f"""
export const VIDEO_TAGS: Record<string, string[]> = {json_str};
"""
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Written tags data to {OUTPUT_FILE}")

if __name__ == "__main__":
    asyncio.run(main())
