import asyncio
import json
import os
from bilibili_api import comment, Credential
from datetime import datetime

SESSDATA = ''
BILI_JCT = ''
BUVID3 = ""

COMMENT_COUNT = 30
OUTPUT_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/commentsData.json"
VIDEO_DATA_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/videoData.ts"

def extract_video_ids_from_ts():
    """Extract all video BVIDs from videoData.ts"""
    import re
    with open(VIDEO_DATA_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    match = re.search(r'=\s*\[', content)
    if not match:
        raise ValueError("Could not find array start in videoData.ts")
    
    start = match.end() - 1
    end = content.rfind('];')
    if end == -1:
        end = content.rfind(']')
    else:
        end = end + 1
    
    json_str = content[start:end]
    videos = json.loads(json_str)
    
    video_info = []
    for v in videos:
        bvid = v.get('id', '')
        aid = v.get('raw', {}).get('aid')
        if bvid and aid:
            video_info.append({'bvid': bvid, 'aid': aid, 'title': v.get('title', '')})
    
    return video_info

def clean_reply(reply):
    """Extract only essential fields from a reply"""
    member = reply.get('member', {})
    content = reply.get('content', {})
    reply_control = reply.get('reply_control', {})
    
    # Clean sub-replies if present
    sub_replies = reply.get('replies')
    cleaned_sub_replies = None
    if sub_replies:
        cleaned_sub_replies = [clean_reply(r) for r in sub_replies]
    
    return {
        'rpid': reply.get('rpid_str', ''),
        'mid': str(member.get('mid', '')),
        'uname': member.get('uname', ''),
        'avatar': member.get('avatar', ''),
        'sex': member.get('sex', ''),
        'level': member.get('level_info', {}).get('current_level', 0),
        'vip': member.get('vip', {}).get('vipStatus', 0) == 1,
        'message': content.get('message', ''),
        'like': reply.get('like', 0),
        'ctime': reply.get('ctime', 0),
        'rcount': reply.get('rcount', 0),
        'location': reply_control.get('location', ''),
        'time_desc': reply_control.get('time_desc', ''),
        'replies': cleaned_sub_replies
    }

async def fetch_comments_for_video(aid: int, credential: Credential, target_count: int = 30):
    """Fetch comments for a video, keeping only essential fields"""
    all_replies = []
    pag = ""
    
    while len(all_replies) < target_count:
        try:
            raw_response = await comment.get_comments_lazy(
                aid, 
                comment.CommentResourceType.VIDEO, 
                offset=pag, 
                credential=credential
            )
            
            replies = raw_response.get('replies')
            if replies is None:
                break
            
            # Clean each reply
            for reply in replies:
                cleaned = clean_reply(reply)
                all_replies.append(cleaned)
                if len(all_replies) >= target_count:
                    break
            
            if len(all_replies) >= target_count:
                break
            
            cursor = raw_response.get('cursor', {})
            pagination = cursor.get('pagination_reply', {})
            pag = pagination.get('next_offset', '')
            
            if not pag:
                break
                
            await asyncio.sleep(0.3)
            
        except Exception as e:
            print(f"  Error fetching comments: {e}")
            break
    
    return all_replies[:target_count]

async def main():
    credential = Credential(sessdata=SESSDATA, bili_jct=BILI_JCT, buvid3=BUVID3)
    
    print("Extracting video IDs from videoData.ts...")
    videos = extract_video_ids_from_ts()
    print(f"Found {len(videos)} videos")
    
    all_comments = {}
    
    for i, video in enumerate(videos):
        bvid = video['bvid']
        aid = video['aid']
        title = video['title'][:30] + "..." if len(video['title']) > 30 else video['title']
        
        print(f"[{i+1}/{len(videos)}] Fetching comments for {bvid} ({title})...")
        
        try:
            comments = await fetch_comments_for_video(aid, credential, COMMENT_COUNT)
            all_comments[bvid] = {
                'bvid': bvid,
                'aid': aid,
                'title': video['title'],
                'comments': comments,
                'count': len(comments)
            }
            print(f"  -> Got {len(comments)} comments")
        except Exception as e:
            print(f"  -> Error: {e}")
            all_comments[bvid] = {
                'bvid': bvid,
                'aid': aid,
                'title': video['title'],
                'comments': [],
                'count': 0,
                'error': str(e)
            }
        
        await asyncio.sleep(0.5)
    
    print(f"\nSaving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'total_videos': len(videos),
            'data': all_comments
        }, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully saved comments for {len(all_comments)} videos!")

if __name__ == "__main__":
    asyncio.run(main())
