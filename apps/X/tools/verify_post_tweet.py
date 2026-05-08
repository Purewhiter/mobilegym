import asyncio
import time
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        # Use webkit as we know it's installed
        browser = await p.webkit.launch(headless=True)
        page = await browser.new_page(viewport={"width": 412, "height": 915})
        
        print("Navigating to app...")
        await page.goto("http://localhost:3001/")
        
        # Find X app
        print("Looking for X app...")
        found = False
        for i in range(5):
            # Check for X icon
            elements = await page.locator("text=X").all()
            for el in elements:
                if await el.is_visible():
                    print("Found X app, clicking...")
                    await el.click()
                    found = True
                    break
            if found:
                break
                
            # Swipe left to find it
            print("Swiping left...")
            await page.mouse.move(350, 350)
            await page.mouse.down()
            await page.mouse.move(50, 350, steps=10)
            await page.mouse.up()
            await asyncio.sleep(0.5)
            
        if not found:
            print("ERROR: X app not found")
            await browser.close()
            return

        # Wait for X to load
        await asyncio.sleep(2)
        
        # Click Compose FAB
        print("Clicking Compose FAB...")
        fab = page.locator('[data-trigger="compose.open"]')
        try:
            await fab.wait_for(state="visible", timeout=5000)
            await fab.click()
        except Exception as e:
            print(f"ERROR: Compose FAB not found: {e}")
            await browser.close()
            return
            
        await asyncio.sleep(1)
        
        # Type content
        content = f"VerifyPostTweet_{int(time.time())}"
        print(f"Typing content: {content}")
        textarea = page.locator('[data-action="compose.content.input"]')
        await textarea.wait_for(state="visible")
        await textarea.fill(content)
        await asyncio.sleep(0.5)
        
        # Click Post
        print("Clicking Post button...")
        submit_btn = page.locator('[data-action="compose.post.submit"]')
        await submit_btn.click()
        
        await asyncio.sleep(2)
        
        # Verify post in feed
        print("Verifying post in feed...")
        # Look for the content text
        post_locator = page.locator(f"text={content}")
        if await post_locator.count() > 0:
            print(f"SUCCESS: Post '{content}' found in feed")
        else:
            print(f"FAILURE: Post '{content}' NOT found in feed")
            # Dump page content for debug
            # print(await page.content())
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
