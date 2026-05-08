"""
从 Twitter Syndication API + FixTweet API 爬取大博主推文数据。

用法:
    python apps/X/scripts/crawl_major_accounts.py [--output apps/X/scripts/crawled_data.json]
    python apps/X/scripts/crawl_major_accounts.py --batch2-only
    python apps/X/scripts/crawl_major_accounts.py --no-skip-existing --accounts foo bar
    # 后台跑建议加 -u，否则日志可能很久不刷新：
    python -u apps/X/scripts/crawl_major_accounts.py ...

Syndication API: 每个用户返回 100 条推文（含 likes/retweets/replies 等互动数据，无需认证）
FixTweet API: 获取用户完整资料 + 推文的 views 数据
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional, Tuple, List

from x_text_cleaner import clean_post_content

SYNDICATION_URL = "https://syndication.twitter.com/srv/timeline-profile/screen-name/{screen_name}"
FXTWITTER_STATUS_URL = "https://api.fxtwitter.com/{screen_name}/status/{tweet_id}"
FXTWITTER_USER_URL = "https://api.fxtwitter.com/{screen_name}"

HEADERS = {
    "User-Agent": "mobile-gym-data-collector/1.0 (https://github.com/mobile-gym)"
}

ACCOUNTS_BATCH1 = [
    "elonmusk", "BillGates", "JeffBezos", "tim_cook", "satyanadella",
    "sundarpichai", "sama", "karpathy", "ylecun",
    "Cristiano", "taylorswift13", "KimKardashian", "justinbieber",
    "rihanna", "MrBeast", "NICKIMINAJ",
    "BarackObama", "realDonaldTrump", "POTUS", "narendramodi",
    "OpenAI", "Google", "Apple", "Microsoft", "Tesla", "nvidia",
    "Meta", "SpaceX", "SamsungMobile",
    "CNN", "BBCBreaking", "nytimes", "Reuters", "washingtonpost", "AP",
    "espn", "NBA", "NFL", "FCBarcelona", "realmadrid",
    "ChampionsLeague", "FIFAWorldCup", "F1", "WWE", "ufc",
    "NASA", "YouTube", "Spotify", "netflix", "amazon", "Discord", "Lakers",
]

ACCOUNTS_BATCH2 = [
    # === 科技人物 (13) ===
    "lexfridman",       # Lex Fridman, 4.7M
    "naval",            # Naval Ravikant, 3.1M
    "paulg",            # Paul Graham, 2.4M
    "pmarca",           # Marc Andreessen, 2.3M
    "jimcramer",        # Jim Cramer, 2.4M
    "ID_AA_Carmack",    # John Carmack, 1.3M
    "VitalikButerin",   # Vitalik Buterin, 6M
    "cz_binance",       # CZ Binance, 11M
    "jack",             # Jack Dorsey, 6.8M
    "Snowden",          # Edward Snowden, 5.6M
    "garyvee",          # Gary Vaynerchuk, 3M
    "dhh",              # DHH (Rails), 614K
    "levelsio",         # Pieter Levels, 843K

    # === 娱乐名人 (13) ===
    "katyperry",        # Katy Perry, 86M
    "ladygaga",         # Lady Gaga, 71M
    "TheEllenShow",     # Ellen DeGeneres, 63M
    "selenagomez",      # Selena Gomez, 59M
    "KingJames",        # LeBron James, 48M
    "BTS_twt",          # BTS, 47M
    "shakira",          # Shakira, 45M
    "britneyspears",    # Britney Spears, 43M
    "Oprah",            # Oprah Winfrey, 35M
    "Drake",            # Drake, 34M
    "KevinHart4real",   # Kevin Hart, 32M
    "Adele",            # Adele, 22M
    "TheRock",          # Dwayne Johnson, 16M

    # === 政治/国际 (9) ===
    "WhiteHouse",       # White House, 4.2M
    "VP",               # Vice President, 1.2M
    "UN",               # United Nations, 16M
    "Pontifex",         # Pope, 18M
    "PMOIndia",         # PM India, 58M
    "ZelenskyyUa",      # Zelenskyy, 8.3M
    "EmmanuelMacron",   # Macron, 10.4M
    "JustinTrudeau",    # Trudeau, 6.5M
    "GretaThunberg",    # Greta Thunberg, 5.2M

    # === 新闻媒体 (12) ===
    "BBCWorld",         # BBC World, 42M
    "FoxNews",          # Fox News, 29M
    "TheEconomist",     # The Economist, 26M
    "WSJ",              # Wall Street Journal, 21M
    "Forbes",           # Forbes, 20M
    "TIME",             # TIME, 19M
    "ABC",              # ABC News, 18M
    "guardian",         # The Guardian, 10M
    "business",         # Bloomberg, 10M
    "CNBC",             # CNBC, 5.5M
    "NPR",              # NPR, 7.8M
    "SportsCenter",     # SportsCenter, 42M

    # === 体育 (13) ===
    "premierleague",    # Premier League, 45M
    "ManUtd",           # Man United, 38M
    "ChelseaFC",        # Chelsea FC, 25M
    "LFC",              # Liverpool, 24M
    "Arsenal",          # Arsenal, 21M
    "StephenCurry30",   # Stephen Curry, 17M
    "PSG_inside",       # PSG, 15M
    "BleacherReport",   # Bleacher Report, 20M
    "BLACKPINK",        # BLACKPINK, 11M
    "juventusfc",       # Juventus, 9.4M
    "Olympics",         # Olympics, 5.8M
    "Wimbledon",        # Wimbledon, 3.8M
    "Celtics",          # Celtics, 3.9M

    # === 科技公司 (12) ===
    "GitHub",           # GitHub, 2.6M
    "AnthropicAI",      # Anthropic, 1M
    "xAI",              # xAI, 1.9M
    "Android",          # Android, 10M
    "Intel",            # Intel, 4.5M
    "AMD",              # AMD, 1.3M
    "awscloud",         # AWS, 2.2M
    "Azure",            # Azure, 1M
    "Uber",             # Uber, 1.2M
    "Midjourney",       # Midjourney, 415K
    "vercel",           # Vercel, 408K
    "SlackHQ",          # Slack, 432K

    # === 品牌/娱乐平台 (12) ===
    "PlayStation",      # PlayStation, 43M
    "NatGeo",           # National Geographic, 28M
    "Xbox",             # Xbox, 25M
    "NintendoAmerica",  # Nintendo, 14M
    "MarvelStudios",    # Marvel Studios, 14M
    "Pixar",            # Pixar, 11M
    "Nike",             # Nike, 9.6M
    "Starbucks",        # Starbucks, 9.6M
    "Twitch",           # Twitch, 9.6M
    "DisneyPlus",       # Disney+, 6.5M
    "McDonalds",        # McDonald's, 4.6M
    "HBO",              # HBO, 3.2M
]

ACCOUNTS = ACCOUNTS_BATCH1 + ACCOUNTS_BATCH2


def fetch_url(url: str, retries: int = 3) -> Optional[bytes]:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            wait = 2 * (attempt + 1)
            if e.code == 429:
                wait = min(180, 20 * (2**attempt))
            print("  [WARN] Attempt %d failed for %s: %s (sleep %ds)" % (attempt + 1, url[:80], e, wait), flush=True)
            if attempt < retries - 1:
                time.sleep(wait)
        except (urllib.error.URLError, TimeoutError) as e:
            print("  [WARN] Attempt %d failed for %s: %s" % (attempt + 1, url[:80], e), flush=True)
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
    return None


def fetch_syndication_timeline(screen_name: str) -> List[dict]:
    """Fetch up to 100 tweets from a user's syndication timeline."""
    url = SYNDICATION_URL.format(screen_name=screen_name)
    # Syndication 易 429：更多重试 + 更长退避
    raw = fetch_url(url, retries=8)
    if not raw:
        return []

    html = raw.decode("utf-8", errors="replace")
    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html,
        re.DOTALL,
    )
    if not match:
        print(f"  [ERROR] No __NEXT_DATA__ found for @{screen_name}")
        return []

    data = json.loads(match.group(1))
    entries = (
        data.get("props", {})
        .get("pageProps", {})
        .get("timeline", {})
        .get("entries", [])
    )
    return entries


def fetch_fxtwitter_user(screen_name: str) -> Optional[dict]:
    """Fetch user profile from FixTweet API."""
    url = FXTWITTER_USER_URL.format(screen_name=screen_name)
    raw = fetch_url(url)
    if not raw:
        return None
    data = json.loads(raw)
    if data.get("code") == 200:
        return data.get("user")
    return None


def fetch_fxtwitter_tweet(screen_name: str, tweet_id: str) -> Optional[dict]:
    """Fetch a single tweet with views from FixTweet API."""
    url = FXTWITTER_STATUS_URL.format(screen_name=screen_name, tweet_id=tweet_id)
    raw = fetch_url(url, retries=2)
    if not raw:
        return None
    data = json.loads(raw)
    if data.get("code") == 200:
        return data.get("tweet")
    return None


def extract_media(tweet: dict) -> Tuple[List[str], List[str]]:
    """Extract image URLs and video thumbnail URLs from syndication tweet."""
    images = []
    videos = []
    media_list = tweet.get("extended_entities", tweet.get("entities", {})).get("media", [])
    for m in media_list:
        mtype = m.get("type", "")
        if mtype == "photo":
            images.append(m.get("media_url_https", ""))
        elif mtype in ("video", "animated_gif"):
            videos.append(m.get("media_url_https", ""))
    return images, videos


def progress_bar(current: int, total: int, width: int = 30, extra: str = "") -> str:
    pct = current / total if total else 0
    filled = int(width * pct)
    bar = "█" * filled + "░" * (width - filled)
    return f"[{bar}] {current}/{total} ({pct*100:.0f}%) {extra}"


def process_account(screen_name: str, idx: int = 0, total: int = 1) -> dict:
    """Fetch user profile and tweets for a single account."""
    header = progress_bar(idx + 1, total, extra=f"@{screen_name}")
    print(f"\n{'─'*60}")
    print(header)
    sys.stdout.flush()

    # 1. Get user profile from FixTweet
    print("  ↳ 获取用户资料...", end="", flush=True)
    user_data = fetch_fxtwitter_user(screen_name)
    print(f" {'✅' if user_data else '⚠️ fallback to syndication'}", flush=True)
    time.sleep(0.5)

    # 2. Get tweets from Syndication API
    print("  ↳ 获取推文时间线...", end="", flush=True)
    entries = fetch_syndication_timeline(screen_name)
    time.sleep(1)

    if not entries:
        print(" ❌ 无数据", flush=True)
        return {"user": user_data, "tweets": [], "screen_name": screen_name}

    tweets = []
    for entry in entries:
        if entry.get("type") != "tweet":
            continue
        t = entry.get("content", {}).get("tweet", {})
        if not t.get("id_str"):
            continue

        images, videos = extract_media(t)
        user_in_tweet = t.get("user", {})

        tweet_obj = {
            "id": t["id_str"],
            # X 原文里常把媒体占位短链附在正文末尾；媒体真实地址单独保存在 images/videos。
            "text": clean_post_content(
                t.get("full_text", t.get("text", "")),
                images[0] if images else None,
                videos[0] if videos else None,
            ),
            "created_at": t.get("created_at", ""),
            "likes": t.get("favorite_count", 0),
            "retweets": t.get("retweet_count", 0),
            "replies": t.get("reply_count", 0),
            "quotes": t.get("quote_count", 0),
            "views": None,  # syndication 不提供 views
            "lang": t.get("lang", ""),
            "permalink": t.get("permalink", ""),
            "images": images,
            "videos": videos,
            "is_retweet": t.get("full_text", "").startswith("RT @"),
        }
        tweets.append(tweet_obj)

    print(f" ✅ {len(tweets)} 条推文", flush=True)

    # 3. 用 FixTweet 补充 views（只对前 10 条热门推文补充，节省请求）
    top_tweets = sorted(tweets, key=lambda x: x["likes"], reverse=True)[:10]
    views_fetched = 0
    print(f"  ↳ 补充 views 数据 (top 10)...", end="", flush=True)
    for tw in top_tweets:
        fx = fetch_fxtwitter_tweet(screen_name, tw["id"])
        if fx and fx.get("views") is not None:
            tw["views"] = fx["views"]
            views_fetched += 1
        time.sleep(0.3)

    print(f" ✅ {views_fetched}/10", flush=True)

    # 对没有 views 的推文，基于 likes 估算（粗略比例: views ≈ likes × 30~100）
    for tw in tweets:
        if tw["views"] is None and tw["likes"] > 0:
            ratio = 50
            if top_tweets and any(t["views"] for t in top_tweets):
                known = [(t["likes"], t["views"]) for t in top_tweets if t["views"]]
                if known:
                    ratio = sum(v / max(l, 1) for l, v in known) / len(known)
            tw["views"] = int(tw["likes"] * ratio)

    # Build user profile (prefer FixTweet, fallback to syndication)
    if not user_data and tweets:
        synd_user = entries[0].get("content", {}).get("tweet", {}).get("user", {})
        user_data = {
            "id": synd_user.get("id_str", ""),
            "name": synd_user.get("name", screen_name),
            "screen_name": synd_user.get("screen_name", screen_name),
            "avatar_url": synd_user.get("profile_image_url_https", "").replace("_normal", "_200x200"),
            "banner_url": synd_user.get("profile_banner_url", ""),
            "description": synd_user.get("description", ""),
            "location": synd_user.get("location", ""),
            "followers": synd_user.get("followers_count", 0),
            "following": synd_user.get("friends_count", 0),
            "joined": synd_user.get("created_at", ""),
            "verified": True,
            "tweets_count": synd_user.get("statuses_count", 0),
        }

    return {
        "screen_name": screen_name,
        "user": user_data,
        "tweets": tweets,
    }


def main():
    # 非 TTY（Cursor 后台任务）下默认块缓冲，日志会长时间不刷新像「卡住」
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except (AttributeError, OSError):
        pass

    parser = argparse.ArgumentParser(description="Crawl major Twitter accounts")
    parser.add_argument(
        "--output",
        default="apps/X/scripts/crawled_data.json",
        help="Output JSON file path",
    )
    parser.add_argument(
        "--accounts",
        nargs="*",
        help="Override account list (space-separated screen names)",
    )
    parser.add_argument(
        "--no-skip-existing",
        action="store_true",
        help="Re-crawl all accounts even if already in output file",
    )
    parser.add_argument(
        "--batch2-only",
        action="store_true",
        help="Only crawl batch 2 accounts",
    )
    args = parser.parse_args()

    if args.batch2_only:
        accounts = args.accounts or ACCOUNTS_BATCH2
    else:
        accounts = args.accounts or ACCOUNTS

    # Skip already crawled (default on)
    skip_existing = not args.no_skip_existing
    if skip_existing and os.path.exists(args.output):
        with open(args.output, "r", encoding="utf-8") as f:
            existing = json.load(f)
        existing_names = {d["screen_name"].lower() for d in existing if d.get("tweets")}
        before = len(accounts)
        accounts = [a for a in accounts if a.lower() not in existing_names]
        print("Skipping %d already-crawled accounts" % (before - len(accounts)))

    print("Will crawl %d accounts: %s" % (len(accounts), ", ".join(accounts)))

    start_time = time.time()
    results = []
    for i, sn in enumerate(accounts):
        result = process_account(sn, idx=i, total=len(accounts))
        results.append(result)

        elapsed = time.time() - start_time
        avg_per = elapsed / (i + 1)
        remaining = avg_per * (len(accounts) - i - 1)
        print(f"  ⏱  已用 {elapsed:.0f}s | 预计剩余 {remaining:.0f}s", flush=True)

        if i < len(accounts) - 1:
            time.sleep(5.0)

    # Merge with existing data
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        with open(output_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
        existing_map = {d["screen_name"].lower(): d for d in existing}
        for r in results:
            key = r["screen_name"].lower()
            # 避免用空结果覆盖已成功爬取的数据（429 失败时常见）
            if not r.get("tweets"):
                continue
            existing_map[key] = r
        all_results = list(existing_map.values())
    else:
        all_results = [r for r in results if r.get("tweets")]

    # 持久化文件中不保留 0 推文条目（避免历史失败污染）
    all_results = [d for d in all_results if d.get("tweets")]

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    # Stats
    new_tweets = sum(len(r["tweets"]) for r in results)
    new_ok = len([r for r in results if r["tweets"]])
    failed = [r["screen_name"] for r in results if not r["tweets"]]
    all_tweets = sum(len(r["tweets"]) for r in all_results)

    print("\n\n" + "=" * 60)
    print("DONE!")
    print("  This run: %d accounts, %d successful, %d tweets" % (len(accounts), new_ok, new_tweets))
    print("  Total in file: %d accounts, %d tweets" % (len(all_results), all_tweets))
    print("  Output: %s" % output_path)
    if failed:
        print("  Failed: %s" % ", ".join(failed))


if __name__ == "__main__":
    main()
