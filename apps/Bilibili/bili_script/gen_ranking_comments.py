import asyncio
import json
import re
from bilibili_api import comment, Credential
from datetime import datetime

SESSDATA = ''
BILI_JCT = ''
BUVID3 = ""

COMMENT_COUNT = 30
OUTPUT_FILE = "/Users/purew/Desktop/android-os/public/data/commentsData.json"
RANKING_DATA_FILE = "/Users/purew/Desktop/android-os/apps/Bilibili/data/rankingData.ts"
EXISTING_COMMENTS_FILE = "/Users/purew/Desktop/android-os/public/data/commentsData.json"

def extract_ranking_video_ids():
    """Extract all video BVIDs and AIDs from rankingData.ts"""
    with open(RANKING_DATA_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find all "id": "BVxxxx" and corresponding "aid" in raw
    video_info = []
    
    # Use regex to find id and raw.aid pairs
    pattern = r'"id":\s*"(BV[^"]+)"[\s\S]*?"raw":\s*\{[\s\S]*?"aid":\s*(\d+)'
    matches = re.findall(pattern, content)
    
    seen = set()
    for bvid, aid in matches:
        if bvid not in seen:
            seen.add(bvid)
            video_info.append({'bvid': bvid, 'aid': int(aid), 'title': ''})
    
    return video_info

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
    """Fetch comments for a video"""
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
    
    # Load existing comments
    print("Loading existing comments...")
    try:
        with open(EXISTING_COMMENTS_FILE, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
            all_comments = existing_data.get('data', {})
            print(f"Loaded {len(all_comments)} existing videos")
    except:
        all_comments = {}
        print("No existing comments file, starting fresh")
    
    print("Extracting ranking video IDs...")
    videos = extract_ranking_video_ids()
    print(f"Found {len(videos)} ranking videos")
    
    # Filter out already fetched
    new_videos = [v for v in videos if v['bvid'] not in all_comments]
    print(f"Need to fetch comments for {len(new_videos)} new videos")
    
    for i, video in enumerate(new_videos):
        bvid = video['bvid']
        aid = video['aid']
        
        print(f"[{i+1}/{len(new_videos)}] Fetching comments for {bvid}...")
        
        try:
            comments = await fetch_comments_for_video(aid, credential, COMMENT_COUNT)
            all_comments[bvid] = {
                'bvid': bvid,
                'aid': aid,
                'title': video.get('title', ''),
                'comments': comments,
                'count': len(comments)
            }
            print(f"  -> Got {len(comments)} comments")
        except Exception as e:
            print(f"  -> Error: {e}")
            all_comments[bvid] = {
                'bvid': bvid,
                'aid': aid,
                'title': '',
                'comments': [],
                'count': 0,
                'error': str(e)
            }
        
        await asyncio.sleep(0.5)
    
    print(f"\nSaving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'total_videos': len(all_comments),
            'data': all_comments
        }, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully saved comments for {len(all_comments)} videos!")

if __name__ == "__main__":
    asyncio.run(main())
