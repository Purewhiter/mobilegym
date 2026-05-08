import os
import re
import requests
import hashlib
import concurrent.futures
import shutil
from urllib.parse import urlparse
import time

# ================= CONFIGURATION =================
# Source file containing the original data
SOURCE_FILE = r"C:\1\mobile-gym\apps\RedBook\data\crawledData.ts"

# Output file for the new local data
OUTPUT_FILE = r"C:\1\mobile-gym\apps\RedBook\data\localcrawledData.ts"

# Directory where images will be downloaded (Physical path)
DOWNLOAD_DIR = r"C:\1\imagedata"

# The web path prefix to access these images in the app
WEB_PREFIX = "/imagedata"

# The public directory of the web app
APP_PUBLIC_DIR = r"C:\1\mobile-gym\public"

# =================================================

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def get_extension(url):
    path = urlparse(url).path
    ext = os.path.splitext(path)[1]
    if not ext:
        if 'png' in url: return '.png'
        if 'jpg' in url or 'jpeg' in url: return '.jpg'
        if 'webp' in url: return '.webp'
        return '.jpg'
    return ext

def download_file(url, save_path):
    if os.path.exists(save_path):
        return True
    
    try:
        # Default request configuration
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.xiaohongshu.com/'
        }
        
        # Retry mechanism
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.get(url, headers=headers, timeout=20)
                if response.status_code == 200:
                    with open(save_path, 'wb') as f:
                        f.write(response.content)
                    return True
                elif response.status_code == 404:
                    print(f"File not found (404): {url}")
                    return False
                else:
                    # Wait before retry for other errors
                    time.sleep(1 * (attempt + 1))
            except requests.RequestException:
                if attempt == max_retries - 1:
                    raise
                time.sleep(1 * (attempt + 1))
                
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        # Optionally log errors to a file
        # with open('download_errors.log', 'a') as log:
        #     log.write(f"{url}: {e}\n")
        pass
    return False

def main():
    print(f"--- RedBook Data Downloader (Optimized) ---")
    
    ensure_dir(DOWNLOAD_DIR)

    # Read Source
    with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all URLs
    url_pattern = re.compile(r'["\'](https?://[^"\']+)["\']')
    urls = set(url_pattern.findall(content))
    print(f"Found {len(urls)} unique URLs.")

    # Prepare Map
    url_map = {}
    tasks = []
    
    for url in urls:
        ext = get_extension(url)
        hash_name = hashlib.md5(url.encode('utf-8')).hexdigest()
        filename = f"{hash_name}{ext}"
        
        save_path = os.path.join(DOWNLOAD_DIR, filename)
        web_path = f"{WEB_PREFIX}/{filename}"
        
        url_map[url] = web_path
        tasks.append((url, save_path))

    # --- STEP 1: Generate Output File IMMEDIATELY ---
    print("Generating localcrawledData.ts...")
    
    def replace_match(match):
        url = match.group(1)
        if url in url_map:
            return f"'{url_map[url]}'"
        return match.group(0)

    new_content = url_pattern.sub(replace_match, content)
    new_content = "// Auto-generated local data\n" + new_content

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Saved local data to: {OUTPUT_FILE}")

    # --- STEP 2: Link Folder ---
    target_link_name = WEB_PREFIX.strip('/').split('/')[0]
    public_link_path = os.path.join(APP_PUBLIC_DIR, target_link_name)

    if not os.path.exists(public_link_path):
        try:
            import subprocess
            cmd = ['cmd', '/c', 'mklink', '/J', public_link_path, DOWNLOAD_DIR]
            subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"Created Junction: {public_link_path} <==> {DOWNLOAD_DIR}")
        except Exception as e:
            print(f"Could not create automatic link: {e}")
    else:
        print(f"Link/Folder already exists: {public_link_path}")

    # --- STEP 3: Download in Background ---
    print(f"Starting download of {len(tasks)} files...")
    print("You can close this script, downloads will stop. Rerun to continue.")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(download_file, url, path) for url, path in tasks]
        
        done_count = 0
        last_time = time.time()
        
        for f in concurrent.futures.as_completed(futures):
            done_count += 1
            if done_count % 100 == 0:
                cur_time = time.time()
                rate = 100 / (cur_time - last_time)
                last_time = cur_time
                print(f"Progress: {done_count}/{len(tasks)} ({rate:.1f} files/s)")

    print("All downloads completed!")

if __name__ == "__main__":
    main()
