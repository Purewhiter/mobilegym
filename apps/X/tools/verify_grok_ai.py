import asyncio
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
            # Adjust selector based on your app structure. 
            # Assuming 'X' text in a span or div
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
        
        # Go to Grok tab
        print("Navigating to Grok tab...")
        # Dump HTML for debugging
        # with open("debug_page.html", "w") as f:
        #     f.write(await page.content())
        
        grok_tab = page.locator('[data-trigger="tab.grok"]')
        try:
            await grok_tab.wait_for(state="visible", timeout=5000)
            await grok_tab.click()
        except Exception as e:
            print(f"ERROR: Grok tab not found: {e}")
            print("Page content length:", len(await page.content()))
            # print(await page.content()) # Uncomment to see full content
            await browser.close()
            return
            
        await asyncio.sleep(1)
        
        # Send message
        print("Sending message 'Hello Grok AI'...")
        await page.fill('textarea[placeholder]', 'Hello Grok AI')
        await asyncio.sleep(0.5)
        
        send_btn = page.locator('[data-action="grok.message.send"]')
        await send_btn.click(force=True)
        
        print("Waiting for response...")
        await asyncio.sleep(3)
        
        # Check messages
        messages = await page.locator('.whitespace-pre-wrap').all_inner_texts()
        print(f"Messages found: {messages}")
        
        if len(messages) >= 2:
            print("SUCCESS: AI interaction verified")
        else:
            print("FAILURE: AI response not received")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
