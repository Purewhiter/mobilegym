from bilibili_api import login_v2, sync
import time


async def main() -> None:
    qr = login_v2.QrCodeLogin(platform=login_v2.QrCodeLoginChannel.WEB) # 生成二维码登录实例，平台选择网页端
    await qr.generate_qrcode()                                          # 生成二维码
    print(qr.get_qrcode_terminal())                                     # 生成终端二维码文本，打印
    while not qr.has_done():                                            # 在完成扫描前轮询
        print(await qr.check_state())                                   # 检查状态
        time.sleep(1)                                                   # 轮训间隔建议 >=1s
    print(qr.get_credential().get_cookies())                            # 获取 Credential 类，打印其 Cookies 信息

if __name__ == '__main__':
    sync(main())