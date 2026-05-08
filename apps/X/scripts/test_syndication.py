import asyncio
from playwright.async_api import async_playwright
import json

async def test_syndication():
    tweet_id = "2011049338760233095" # From previous log
    url = f"https://cdn.syndication.twimg.com/tweet-result?id={tweet_id}&lang=en"
    
    print(f"Testing Syndication API: {url}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        try:
            response = await page.goto(url)
            if response.status == 200:
                data = await response.json()
                print("Success! Got data:")
                print(json.dumps(data, indent=2)[:500] + "...")
            else:
                print(f"Failed with status: {response.status}")
        except Exception as e:
            print(f"Error: {e}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_syndication())