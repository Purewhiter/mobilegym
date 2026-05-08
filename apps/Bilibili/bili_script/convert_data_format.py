import re
import os

def migrate_file(filepath):
    print(f"Migrating {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements to match BilibiliVideo interface
    # bvid -> id
    content = re.sub(r'"bvid":', r'"id":', content)
    # pic -> cover
    content = re.sub(r'"pic":', r'"cover":', content)
    # play -> plays
    content = re.sub(r'"play":', r'"plays":', content)
    # length -> duration
    content = re.sub(r'"length":', r'"duration":', content)
    # created -> date
    content = re.sub(r'"created":', r'"date":', content)

    # Ensure plays is a number, not string (if it was)
    # Regex to find "plays": "123" and convert to "plays": 123
    # Note: authorData has play as number mostly, but types said string|number.
    # The regex below looks for "plays": "some_digits" and replaces with "plays": some_digits
    content = re.sub(r'"plays":\s*"(\d+)"', r'"plays": \1', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Finished {filepath}")

base_dir = "/Users/purew/Desktop/android-os/apps/Bilibili/data"
migrate_file(os.path.join(base_dir, "authorData.ts"))
migrate_file(os.path.join(base_dir, "commenterData.ts"))
