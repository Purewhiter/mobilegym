from bilibili_api import comment, sync, Credential
from pprint import pprint

SESSDATA = ''
BILI_JCT = ''
BUVID3 = ""

async def main():
    credential = Credential(sessdata=SESSDATA, bili_jct=BILI_JCT, buvid3=BUVID3)
    
    # Get first page of comments
    c = await comment.get_comments_lazy(115774702228762, comment.CommentResourceType.VIDEO, offset="", credential=credential)
    
    print("=== Top-level keys ===")
    print(list(c.keys()))
    
    print("\n=== Full response structure ===")
    pprint(c)

sync(main())
