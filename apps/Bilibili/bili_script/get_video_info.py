import asyncio
from bilibili_api import video


async def main() -> None:
    # 实例化 Video 类
    v = video.Video(bvid="BV1q7BeBpEst")
    # 获取信息
    info = await v.get_online()
    # 打印信息
    print(info)


if __name__ == "__main__":
    asyncio.run(main())
