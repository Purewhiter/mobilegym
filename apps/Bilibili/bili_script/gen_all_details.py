import asyncio
import re
import json
import random
import os
from datetime import datetime
from bilibili_api import video, comment, Credential

# File Paths
VIDEO_DATA_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/videoData.ts"
RANKING_DATA_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/rankingData.ts"
RECOMMEND_DATA_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/recommendData.ts"
HOT_DATA_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/hotData.ts"

OUTPUT_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/videoDetails.ts"
TEMP_JSONL = "/Users/purew/Desktop/android-os/apps/Bilibili/data/videoDetails.jsonl"

# Credential for comments
SESSDATA = ''
BILI_JCT = ''
CREDENTIAL = Credential(sessdata=SESSDATA, bili_jct=BILI_JCT)

COMMENT_LIMIT = 20

def extract_bvid_aid_map(file_content):
    bvids = set(re.findall(r'[\'"](?:id|bvid)[\'"]:\s*[\'"](BV[a-zA-Z0-9]+)[\'"]', file_content))
    return list(bvids)

def clean_reply(reply):
    """Extract only essential fields from a reply"""
    member = reply.get('member', {})
    content = reply.get('content', {})
    reply_control = reply.get('reply_control', {})
    
    sub_replies = reply.get('replies')
    cleaned_sub_replies = None
    if sub_replies:
        cleaned_sub_replies = [clean_reply(r) for r in sub_replies]
    
    return {
        'rpid': reply.get('rpid_str', ''),
        'mid': str(member.get('mid', '')),
        'uname': member.get('uname', ''),
        'avatar': member.get('avatar', ''),
        'message': content.get('message', ''),
        'like': reply.get('like', 0),
        'ctime': reply.get('ctime', 0),
        'location': reply_control.get('location', ''),
        # Added time_desc support if available, though API often lacks it in structured response,
        # frontend computes it now. But we keep structure just in case.
        'replies': cleaned_sub_replies
    }

def append_jsonl(item):
    with open(TEMP_JSONL, 'a', encoding='utf-8') as f:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")

def convert_jsonl_to_ts():
    print("Converting JSONL to TS...")
    video_tags = {}
    video_online = {}
    video_comments = {}
    
    if not os.path.exists(TEMP_JSONL):
        print("No temp file found.")
        return

    count = 0
    with open(TEMP_JSONL, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            try:
                item = json.loads(line)
                bvid = item['bvid']
                video_tags[bvid] = item['tags']
                video_online[bvid] = item['online']
                video_comments[bvid] = {
                    'comments': item['comments'],
                    'count': len(item['comments'])
                }
                count += 1
            except Exception as e:
                print(f"Skipping corrupt line: {e}")
                
    ts_content = f"""
// Auto-generated video details (Tags, Online, Comments)
// Timestamp: {datetime.now().isoformat()}
import {{ CommentReply }} from '../types';

export const VIDEO_TAGS: Record<string, string[]> = {json.dumps(video_tags, ensure_ascii=False, indent=4)};

export const VIDEO_ONLINE: Record<string, string> = {json.dumps(video_online, ensure_ascii=False, indent=4)};

export interface VideoComments {{
    comments: CommentReply[];
    count: number;
}}

export const VIDEO_COMMENTS: Record<string, VideoComments> = {json.dumps(video_comments, ensure_ascii=False, indent=4)};
"""
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(ts_content)
    print(f"Generated {OUTPUT_FILE} with {count} videos.")

async def fetch_video_details(sem, bvid):
    async with sem:
        try:
            await asyncio.sleep(random.uniform(0.1, 0.5))
            v = video.Video(bvid=bvid, credential=CREDENTIAL)

            try:
                info = await v.get_info()
            except:
                return None
            
            aid = info['aid']
            
            task_tags = v.get_tags()
            task_online = v.get_online()
            task_comments = comment.get_comments_lazy(
                aid, 
                comment.CommentResourceType.VIDEO, 
                credential=CREDENTIAL
            )
            
            results = await asyncio.gather(task_tags, task_online, task_comments, return_exceptions=True)
            
            # Process Tags
            tags_res = results[0]
            tags = []
            if not isinstance(tags_res, Exception):
                tags = [t['tag_name'] for t in tags_res]
                
            # Process Online
            online_res = results[1]
            online = "0"
            if not isinstance(online_res, Exception):
                online = str(online_res.get('total', '0'))
                
            # Process Comments
            comments_res = results[2]
            comments = []
            if not isinstance(comments_res, Exception):
                replies = comments_res.get('replies', [])
                if replies:
                    comments = [clean_reply(r) for r in replies[:COMMENT_LIMIT]]
            
            res_item = {
                'bvid': bvid,
                'aid': aid,
                'tags': tags,
                'online': online,
                'comments': comments
            }
            
            print(f"[{bvid}] Tags:{len(tags)} Online:{online} Comments:{len(comments)}")
            # Append immediately
            append_jsonl(res_item)
            
            return res_item
            
        except Exception as e:
            return None

async def main():
    # 1. Gather all potential BVIDs from sources
    print("Scanning source files for BVIDs...")
    files_to_read = [VIDEO_DATA_FILE, RANKING_DATA_FILE, RECOMMEND_DATA_FILE, HOT_DATA_FILE]
    all_source_bvids = set()
    
    for fw in files_to_read:
        if os.path.exists(fw):
            with open(fw, 'r', encoding='utf-8') as f:
                content = f.read()
                all_source_bvids.update(extract_bvid_aid_map(content))
    
    print(f"Found {len(all_source_bvids)} unique BVIDs in source files.")

    # 2. Check what's already fetched in temp file
    existing_bvids = set()
    if os.path.exists(TEMP_JSONL):
        print(f"Reading existing data from {TEMP_JSONL}...")
        with open(TEMP_JSONL, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        obj = json.loads(line)
                        existing_bvids.add(obj['bvid'])
                    except: pass
    
    print(f"Already fetched: {len(existing_bvids)}")
    
    # 3. Determine missing
    missing_bvids = list(all_source_bvids - existing_bvids)
    print(f"New videos to fetch: {len(missing_bvids)}")
    
    if not missing_bvids:
        print("No new videos to fetch.")
        # Always regenerate TS just in case file was deleted or out of sync
        convert_jsonl_to_ts()
        return

    # 4. Fetch missing
    sem = asyncio.Semaphore(5)
    tasks = [fetch_video_details(sem, bvid) for bvid in missing_bvids]
    
    batch_size = 20
    for i in range(0, len(tasks), batch_size):
        batch = tasks[i:i+batch_size]
        print(f"Processing batch {i} - {min(i+batch_size, len(tasks))}...")
        await asyncio.gather(*batch)
        
    print("Fetching complete. Generating TS file...")
    convert_jsonl_to_ts()

if __name__ == "__main__":
    asyncio.run(main())
