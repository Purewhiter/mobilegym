from bilibili_api import homepage, sync

hm=sync(homepage.get_videos())
print(len(hm['item']))

from bilibili_api import hot, sync

hot=sync(hot.get_hot_videos())
print(len(hot['list']))