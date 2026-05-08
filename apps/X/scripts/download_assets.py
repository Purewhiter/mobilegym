import json
import os
import hashlib
import requests
import time
from urllib.parse import urlparse
import concurrent.futures

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
DATA_DIR = os.path.join(BASE_DIR, "apps", "X", "data")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
ASSETS_DIR = os.path.join(PUBLIC_DIR, "X", "assets")

IMPORTED_DATA_FILE = os.path.join(DATA_DIR, "importedData.json")
CRAWLED_DATA_FILE = os.path.join(DATA_DIR, "crawled_replies.json")

# Ensure assets directory exists
os.makedirs(ASSETS_DIR, exist_ok=True)

def get_extension(url):
    path = urlparse(url).path
    ext = os.path.splitext(path)[1]
    if not ext:
        if "format=jpg" in url or "jpg" in url:
            return ".jpg"
        if "format=png" in url or "png" in url:
            return ".png"
        return ".jpg" # Default
    return ext

def download_image(url):
    if not url or not url.startswith("http"):
        return url
    
    # Check if already local
    if url.startswith("/X/assets/"):
        return url

    try:
        # Create hash of URL for filename
        hash_object = hashlib.md5(url.encode())
        filename = hash_object.hexdigest() + get_extension(url)
        filepath = os.path.join(ASSETS_DIR, filename)
        
        # Public path for the app
        public_path = f"/X/assets/{filename}"

        if os.path.exists(filepath):
            return public_path

        # print(f"Downloading {url}...")
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            with open(filepath, "wb") as f:
                f.write(response.content)
            return public_path
        else:
            print(f"Failed to download {url}: Status {response.status_code}")
            return url
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return url

def process_user(user_id, user):
    if "avatar" in user:
        user["avatar"] = download_image(user["avatar"])
    if "banner" in user:
        user["banner"] = download_image(user["banner"])
    return user_id

def process_post(idx, post):
    if "image" in post:
        post["image"] = download_image(post["image"])
    return idx

def process_imported_data():
    if not os.path.exists(IMPORTED_DATA_FILE):
        print(f"File not found: {IMPORTED_DATA_FILE}")
        return

    with open(IMPORTED_DATA_FILE, "r") as f:
        data = json.load(f)

    users = data.get("importedUsers", {})
    posts = data.get("importedPosts", [])

    print(f"Processing {len(users)} users and {len(posts)} posts...")

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        # Process users
        futures_users = {executor.submit(process_user, uid, u): uid for uid, u in users.items()}
        # Process posts
        futures_posts = {executor.submit(process_post, i, p): i for i, p in enumerate(posts)}
        
        completed = 0
        total = len(futures_users) + len(futures_posts)
        
        for future in concurrent.futures.as_completed({**futures_users, **futures_posts}):
            completed += 1
            if completed % 100 == 0:
                print(f"Progress: {completed}/{total}")

    # Save back
    with open(IMPORTED_DATA_FILE, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Updated importedData.json")

def process_reply(reply):
    if "author" in reply and "avatar" in reply["author"]:
        reply["author"]["avatar"] = download_image(reply["author"]["avatar"])

def process_crawled_data():
    if not os.path.exists(CRAWLED_DATA_FILE):
        print(f"File not found: {CRAWLED_DATA_FILE}")
        return

    with open(CRAWLED_DATA_FILE, "r") as f:
        data = json.load(f)

    # Data structure: { "post_id": [ { "author": { "avatar": "..." } } ] }
    all_replies = []
    for post_id, replies in data.items():
        all_replies.extend(replies)
    
    print(f"Processing {len(all_replies)} replies from crawled data...")

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(process_reply, r) for r in all_replies]
        concurrent.futures.wait(futures)
    
    # Save back
    with open(CRAWLED_DATA_FILE, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Updated crawled_replies.json")

if __name__ == "__main__":
    print(f"Downloading images to {ASSETS_DIR}")
    process_imported_data()
    process_crawled_data()
    print("Done.")
