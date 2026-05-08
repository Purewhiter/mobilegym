from bilibili_api import comment, sync
import json
from pprint import pprint
from bilibili_api import login_v2, sync, Credential
import time

SESSDATA = ''
BILI_JCT = ''
BUVID3 = ""
COMMENT_COUNT = 50

async def main():
    credential = Credential(sessdata=SESSDATA, bili_jct=BILI_JCT, buvid3=BUVID3)
    comments = []
    pag = ""

    while len(comments) < COMMENT_COUNT:
        c = await comment.get_comments_lazy(115774702228762, comment.CommentResourceType.VIDEO, offset=pag,credential=credential)

        replies = c.get('replies')
        if replies is None:
            break
        
        # 提取需要的评论信息
        for reply in replies:
            comments.append({
                'id': reply['rpid_str'],
                'username': reply['member']['uname'],
                'avatar': reply['member']['avatar'],
                'content': reply['content']['message'],
                'likes': reply['like'],
                'time': reply['ctime'],
                'reply_count': reply['rcount']
            })
            if len(comments) >= COMMENT_COUNT:
                break
        
        # 获取下一页偏移量
        cursor = c.get('cursor', {})
        pagination = cursor.get('pagination_reply', {})
        pag = pagination.get('next_offset', '')
        
        if not pag:
            break

    # 保存到JSON文件
    with open('comments.json', 'w', encoding='utf-8') as f:
        json.dump(comments, f, ensure_ascii=False, indent=2)
    
    print(f"已保存 {len(comments)} 条评论到 comments.json")

sync(main())