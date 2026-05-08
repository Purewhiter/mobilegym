from bilibili_api import video_zone , sync
import asyncio

# info = video_zone.get_zone_info_by_name("VLOG")[0] # 此为主分区，信息位于返回的元组的第 0 项
# print(info)
# res = sync(video_zone.get_zone_new_videos(1029, page_size=20))
# print(res)
# print(sync(video_zone.get_zone_top10(info["tid"])))
async def main():
    res = await video_zone.get_zone_new_videos(21, page_size=20)
    v_list = res.get('archives', []) if isinstance(res, dict) else res
    print(v_list[0])

if __name__ == "__main__":
    asyncio.run(main())
