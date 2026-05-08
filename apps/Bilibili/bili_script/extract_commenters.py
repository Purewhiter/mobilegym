import json
import os
from datetime import datetime

# Paths
DATA_DIR = "/Users/purew/Desktop/android-os/apps/Bilibili/data"
VIDEO_DETAILS_JSONL = os.path.join(DATA_DIR, "videoDetails.jsonl")
OUTPUT_FILE = os.path.join(DATA_DIR, "commenterData.ts")

def extract_commenters():
    if not os.path.exists(VIDEO_DETAILS_JSONL):
        print(f"Error: {VIDEO_DETAILS_JSONL} not found.")
        return

    commenters = {}
    total_comments = 0
    total_extracted = 0

    print("Reading video details...")
    with open(VIDEO_DETAILS_JSONL, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            try:
                video = json.loads(line)
                comments = video.get('comments', [])
                
                # Helper to process a list of comments
                def process_comments(comment_list):
                    nonlocal total_comments, total_extracted
                    for c in comment_list:
                        total_comments += 1
                        mid_str = c.get('mid')
                        if not mid_str: continue
                        
                        try:
                            mid = int(mid_str)
                        except:
                            continue
                            
                        # If already extracted, skip (or maybe update if this one has more info? comments usually minimal)
                        if mid in commenters:
                            # Prefer non-empty location
                            if not commenters[mid].get('location') and c.get('location'):
                                commenters[mid]['location'] = c.get('location').replace('IP属地：', '')
                                # Also update VIP if true
                                if c.get('vip'):
                                    commenters[mid]['vip'] = { 'status': 1, 'label': '大会员' }
                            
                            # Check replies
                            if c.get('replies'):
                                process_comments(c['replies'])
                            continue

                        # Create AuthorInfo structure
                        # Use data from comment
                        vip_status = 1 if c.get('vip') else 0
                        vip_label = '大会员' if c.get('vip') else ''
                        
                        location = c.get('location', '')
                        if location:
                            location = location.replace('IP属地：', '')

                        author_info = {
                            "mid": mid,
                            "location": location,
                            "name": c.get('uname', ''),
                            "face": c.get('avatar', ''),
                            "sign": "", # Not available in comments
                            "level": c.get('level', 0),
                            "vip": {
                                "status": vip_status,
                                "label": vip_label
                            },
                            "official": {
                                "role": 0,
                                "title": "",
                                "type": -1
                            },
                            "top_photo": "",
                            "live_room": None,
                            "follower": 0,
                            "following": 0,
                            "likes": 0,
                            "videos": []
                        }
                        
                        commenters[mid] = author_info
                        total_extracted += 1

                        # Recursively process replies
                        if c.get('replies'):
                            process_comments(c['replies'])

                process_comments(comments)

            except Exception as e:
                # print(f"Error parsing line: {e}")
                pass

    print(f"Processed {total_comments} comments.")
    print(f"Extracted {len(commenters)} unique commenters.")

    # Generate TS content
    # We reuse AuthorInfo interface from authorData (or redefine it to be safe/standalone)
    # The user said "data format matches AuthorInfo", so we can import AuthorInfo or just output matching structure.
    # To be safe and standalone to avoid circular deps or build issues, let's redefine the interface in the file or just export the data with 'as any' or similar if needed.
    # But better: define the interface locally to match.

    ts_content = f"""// Auto-generated Commenter Data
// Timestamp: {datetime.now().isoformat()}

import {{ UserInfo }} from '../types';

export const COMMENTER_DATA: Record<number, UserInfo> = {json.dumps(commenters, ensure_ascii=False, indent=4)};
"""

    print(f"Writing to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(ts_content)
    print("Done.")

if __name__ == "__main__":
    extract_commenters()
