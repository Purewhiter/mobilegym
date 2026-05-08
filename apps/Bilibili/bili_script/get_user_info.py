from bilibili_api import user, sync
from bilibili_api import comment, Credential
from datetime import datetime

SESSDATA = ''
BILI_JCT = ''
BUVID3 = ""

credential = Credential(sessdata=SESSDATA, bili_jct=BILI_JCT, buvid3=BUVID3)

u = user.User(452412746)

print(sync(u.get_user_info()))
print(sync(u.get_relation_info()))
# print(sync(u.get_up_stat()))