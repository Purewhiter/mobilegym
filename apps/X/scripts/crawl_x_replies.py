import json
import asyncio
from playwright.async_api import async_playwright
import os
import time
import tempfile

DATA_FILE = "apps/X/data/importedData.json"
OUTPUT_FILE = "apps/X/data/crawled_replies.json"
USER_DATA_DIR = "apps/X/chrome_user_data_new"

async def crawl_replies():
    if not os.path.exists(DATA_FILE):
        print(f"Data file {DATA_FILE} not found.")
        return

    with open(DATA_FILE, "r") as f:
        data = json.load(f)

    # Ensure keys exist
    if "importedPosts" not in data:
        data["importedPosts"] = []
    if "importedUsers" not in data:
        data["importedUsers"] = {}

    posts = data["importedPosts"]
    imported_users = data["importedUsers"]
    
    # Load existing crawled replies if available
    crawled_data = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r") as f:
                crawled_data = json.load(f)
        except:
            pass

    used_ids = set(p.get("id") for p in posts)

    async with async_playwright() as p:
        # Launch options
        args = ["--no-sandbox", "--disable-blink-features=AutomationControlled"]
        try:
            context = await p.chromium.launch_persistent_context(
                user_data_dir=USER_DATA_DIR,
                channel="chrome", 
                headless=False,
                viewport={"width": 1280, "height": 800},
                args=args
            )
        except Exception as e:
            print(f"Could not launch Chrome ({e}), using bundled Chromium...")
            context = await p.chromium.launch_persistent_context(
                user_data_dir=USER_DATA_DIR,
                headless=False,
                viewport={"width": 1280, "height": 800},
                args=args
            )
        
        page = context.pages[0] if context.pages else await context.new_page()

        # Login check
        print("Navigating to X.com...")
        await page.goto("https://x.com/home", timeout=60000)
        await asyncio.sleep(5)
        
        if "login" in page.url:
            print(">> Please log in to X in the browser window now. Waiting 60s... <<")
            try:
                await page.wait_for_selector('[data-testid="primaryColumn"]', timeout=60000)
            except:
                print("Login timeout. Proceeding anyway, might fail.")

        updated_posts_list = []
        posts_changed = False

        for index, post in enumerate(posts):
            post_id = post.get("id")
            tweet_url = post.get("tweetUrl")
            
            print(f"Processing [{index+1}/{len(posts)}] {post_id}...")

            replies = []
            
            # Check if we already have replies
            if post_id in crawled_data and len(crawled_data[post_id]) > 0:
                print("  Already has replies, keeping.")
                updated_posts_list.append(post)
                continue

            # Crawl
            crawl_success = False
            if tweet_url:
                try:
                    await page.goto(tweet_url, timeout=30000)
                    try:
                        await page.wait_for_selector('article', timeout=10000)
                        # Scroll
                        for _ in range(3):
                            await page.evaluate("window.scrollBy(0, 1000)")
                            await asyncio.sleep(1)
                        
                        replies = await extract_replies(page)
                        crawl_success = True
                    except Exception as e:
                        print(f"  Timeout waiting for article: {e}")
                except Exception as e:
                    print(f"  Failed to load tweet: {e}")
            
            # If no replies, replace
            if not replies:
                print("  No replies found or crawl failed. Searching for replacement...")
                new_post, new_user, new_replies = await find_replacement(page, used_ids)
                
                if new_post:
                    print(f"  Replacing with {new_post['id']}")
                    updated_posts_list.append(new_post)
                    crawled_data[new_post['id']] = new_replies
                    if new_user:
                        imported_users[new_user['id']] = new_user
                    posts_changed = True
                    used_ids.add(new_post['id'])
                else:
                    print("  Replacement failed. Keeping original.")
                    updated_posts_list.append(post)
            else:
                print(f"  Found {len(replies)} replies.")
                crawled_data[post_id] = replies
                updated_posts_list.append(post)
                
            # Save periodically
            if index % 5 == 0:
                 save_data(updated_posts_list + posts[index+1:], imported_users, crawled_data)

        # Final Save
        save_data(updated_posts_list, imported_users, crawled_data)
        
        await context.close()

def save_data(posts, users, replies):
    try:
        with open(DATA_FILE, "r") as f:
            original = json.load(f)
    except Exception as e:
        print(f"Error reading {DATA_FILE}: {e}")
        return
    
    original["importedPosts"] = posts
    original["importedUsers"] = users
    
    # Atomic write for DATA_FILE
    try:
        with tempfile.NamedTemporaryFile("w", dir=os.path.dirname(DATA_FILE), delete=False, encoding='utf-8') as tmp:
            json.dump(original, tmp, indent=2, ensure_ascii=False)
            temp_name = tmp.name
        os.replace(temp_name, DATA_FILE)
    except Exception as e:
        print(f"Error writing {DATA_FILE}: {e}")
        
    # Atomic write for OUTPUT_FILE
    try:
        with tempfile.NamedTemporaryFile("w", dir=os.path.dirname(OUTPUT_FILE), delete=False, encoding='utf-8') as tmp:
            json.dump(replies, tmp, indent=2, ensure_ascii=False)
            temp_name = tmp.name
        os.replace(temp_name, OUTPUT_FILE)
    except Exception as e:
        print(f"Error writing {OUTPUT_FILE}: {e}")

async def extract_replies(page):
    return await page.evaluate("""() => {
        const articles = Array.from(document.querySelectorAll('article'));
        // Skip first (main tweet) if multiple
        const replyArticles = articles.length > 1 ? articles.slice(1) : [];
        return replyArticles.map((article) => {
            const timeEl = article.querySelector('time');
            const textEl = article.querySelector('[data-testid="tweetText"]');
            const userEl = article.querySelector('[data-testid="User-Name"]');
            const avatarEl = article.querySelector('[data-testid^="UserAvatar-Container"] img');
            
            const time = timeEl ? timeEl.getAttribute('datetime') || '' : '';
            const text = textEl ? textEl.innerText : '';
            const avatar = avatarEl ? avatarEl.src : '';
            
            let name = '', handle = '';
            if (userEl) {
                const lines = userEl.innerText.split('\\n');
                if (lines.length >= 2) {
                    name = lines[0];
                    handle = lines[1]; // Usually includes @
                }
            }
            
            return { 
                text, 
                time, 
                author: { name, handle, avatar } 
            };
        }).filter(r => r.text);
    }""")

async def find_replacement(page, used_ids):
    # Go to search/explore
    try:
        # Search for tweets with replies
        # lang:zh for Chinese content as requested by context
        await page.goto("https://x.com/search?q=lang:zh%20min_replies:10&src=typed_query&f=top", timeout=30000)
        try:
            await page.wait_for_selector('article', timeout=15000)
        except:
            print("  Timeout waiting for search results")
            return None, None, []
            
        await asyncio.sleep(2)
        
        articles = await page.query_selector_all('article')
        
        for article in articles:
            # Check if we can get ID/Link
            try:
                link = await article.query_selector('a[href*="/status/"]')
                if not link: continue
                href = await link.get_attribute('href')
                if not href: continue
                
                # href is like /username/status/123456...
                parts = href.split('/')
                if 'status' not in parts: continue
                tweet_id = parts[parts.index('status') + 1]
                
                if tweet_id in used_ids: continue
                
                # Found a candidate! Click it to get details
                # Need to click the link to go to detail page
                await link.click()
                try:
                    await page.wait_for_selector('article', timeout=15000)
                except:
                    print("  Timeout loading replacement tweet")
                    continue
                    
                await asyncio.sleep(2)
                
                # Extract details
                details = await page.evaluate("""() => {
                    const article = document.querySelector('article');
                    if (!article) return null;
                    
                    const timeEl = article.querySelector('time');
                    const textEl = article.querySelector('[data-testid="tweetText"]');
                    const userEl = article.querySelector('[data-testid="User-Name"]');
                    const avatarEl = article.querySelector('[data-testid^="UserAvatar-Container"] img');
                    
                    const imgEls = article.querySelectorAll('[data-testid="tweetPhoto"] img');
                    const image = imgEls.length > 0 ? imgEls[0].src : '';

                    const time = timeEl ? timeEl.getAttribute('datetime') || '' : '';
                    const text = textEl ? textEl.innerText : '';
                    const avatar = avatarEl ? avatarEl.src : '';
                    
                    let name = '', handle = '';
                    if (userEl) {
                        const lines = userEl.innerText.split('\\n');
                        if (lines.length >= 2) {
                            name = lines[0];
                            handle = lines[1];
                        }
                    }
                    return { text, time, image, name, handle, avatar };
                }""")
                
                if not details or not details['text']: 
                    # Go back to search
                    await page.go_back()
                    await asyncio.sleep(2)
                    continue
                
                tweet_url = f"https://x.com{href}"
                
                # Create Post Object
                # Use handle as authorId (lowercase)
                author_id = details['handle'].lower() if details['handle'] else f"u_{tweet_id}"
                
                new_post = {
                    "id": tweet_id,
                    "authorId": author_id,
                    "content": details['text'],
                    "time": details['time'],
                    "tweetUrl": tweet_url,
                    "image": details['image'],
                    "stats": { "comments": 10, "retweets": 5, "likes": 20, "views": 100 }
                }
                
                # Create User Object
                new_user = {
                    "id": author_id,
                    "name": details['name'],
                    "handle": details['handle'],
                    "avatar": details['avatar'],
                    "verified": False,
                    "followers": 100,
                    "following": 100,
                    "bio": "Crawled User",
                    "joinDate": "Unknown"
                }
                
                # Get replies
                await page.evaluate("window.scrollBy(0, 1000)")
                await asyncio.sleep(1)
                replies = await extract_replies(page)
                
                return new_post, new_user, replies
                
            except Exception as e:
                print(f"Error extracting candidate: {e}")
                continue
                
    except Exception as e:
        print(f"Search failed: {e}")
        
    return None, None, []

if __name__ == "__main__":
    asyncio.run(crawl_replies())