import asyncio
from playwright.async_api import async_playwright

PROXIES = [
    "http://127.0.0.1:7890",
    "http://127.0.0.1:1087",
    "http://127.0.0.1:8888",
    None # Direct connection
]

async def check_proxy(proxy):
    print(f"Testing proxy: {proxy}")
    async with async_playwright() as p:
        try:
            browser_args = {}
            if proxy:
                browser_args["proxy"] = {"server": proxy}
                
            browser = await p.chromium.launch(headless=True, **browser_args)
            page = await browser.new_page()
            
            # Try accessing a reliable site first, then X or Nitter
            try:
                # Use google or something stable to check connectivity
                resp = await page.goto("https://www.google.com", timeout=5000)
                print(f"  Google check status: {resp.status}")
                
                # If google works, try X guest token endpoint or nitter
                resp = await page.goto("https://nitter.poast.org", timeout=10000)
                print(f"  Nitter check status: {resp.status}")
                
                if resp.status == 200:
                    print(f"  SUCCESS with proxy {proxy}")
                    await browser.close()
                    return True
            except Exception as e:
                print(f"  Failed: {str(e)[:100]}")
                
            await browser.close()
        except Exception as e:
            print(f"  Browser launch failed: {e}")
            
    return False

async def main():
    for proxy in PROXIES:
        if await check_proxy(proxy):
            print(f"Found working proxy: {proxy}")
            break
    else:
        print("No working proxy found.")

if __name__ == "__main__":
    asyncio.run(main())