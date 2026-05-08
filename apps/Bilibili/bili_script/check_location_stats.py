import os
import re
import json

# Paths
DATA_DIR = "/Users/purew/Desktop/android-os/apps/Bilibili/data"
VIDEO_FILES = [
    os.path.join(DATA_DIR, "videoData.ts"),
    os.path.join(DATA_DIR, "rankingData.ts"),
    os.path.join(DATA_DIR, "hotData.ts"),
    os.path.join(DATA_DIR, "recommendData.ts"),
]

def check_video_pub_location():
    total_videos = 0
    videos_with_location = 0
    videos_without_location = 0
    
    for fw in VIDEO_FILES:
        if not os.path.exists(fw):
            print(f"File not found: {fw}")
            continue
            
        print(f"Checking {os.path.basename(fw)}...")
        with open(fw, 'r', encoding='utf-8') as f:
            content = f.read()
            
        match = re.search(r'export const \w+\s*:\s*BilibiliVideo\[\]\s*=\s*(\[.*\]);', content, re.DOTALL)
        if match:
            json_str = match.group(1)
            try:
                data = json.loads(json_str)
                file_count = len(data)
                file_with = 0
                file_without = 0
                
                for item in data:
                    raw = item.get('raw', {})
                    if raw.get('pub_location'):
                        file_with += 1
                    else:
                        file_without += 1
                
                print(f"  Total: {file_count}, With Location: {file_with}, Without: {file_without}")
                
                total_videos += file_count
                videos_with_location += file_with
                videos_without_location += file_without
                
            except Exception as e:
                print(f"  Failed to parse JSON: {e}")
        else:
            print("  No JSON array found.")

    print("-" * 30)
    print(f"Total Videos Scanned: {total_videos}")
    print(f"Videos with pub_location: {videos_with_location}")
    print(f"Videos without pub_location: {videos_without_location}")
    if total_videos > 0:
        print(f"Missing Rate: {videos_without_location / total_videos * 100:.2f}%")

if __name__ == "__main__":
    check_video_pub_location()
