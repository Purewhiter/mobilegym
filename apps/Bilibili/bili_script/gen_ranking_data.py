
import asyncio
import json
from datetime import datetime
from bilibili_api import rank

# Mapping from UI names (screenshot matching) to API RankTypes
# Mapping from UI names (screenshot matching) to API RankTypes
TRANSFORM_MAP = {
    "全站": rank.RankType.All,
    "番剧": rank.RankType.Bangumi,
    "国创": rank.RankType.GuochuangAnime, # Corrected map to PGC Chinese Anime
    "纪录片": rank.RankType.Documentary,
    "电影": rank.RankType.Movie,
    "电视剧": rank.RankType.TV,
    "动画": rank.RankType.Douga,
    "游戏": rank.RankType.Game,
    "鬼畜": rank.RankType.Kichiku,
    "音乐": rank.RankType.Music,
    "舞蹈": rank.RankType.Dance,
    "影视": rank.RankType.Cinephile,
    "娱乐": rank.RankType.Ent,
    "知识": rank.RankType.Knowledge,
    "科技数码": rank.RankType.Technology,
    "美食": rank.RankType.Food,
    "汽车": rank.RankType.Car,
    "时尚美妆": rank.RankType.Fashion,
    "体育运动": rank.RankType.Sports,
    "动物": rank.RankType.Animal,
}

# PGC types have different data structure (no `bvid`, use `season_id`)
PGC_TYPES = {
    rank.RankType.Bangumi,
    rank.RankType.GuochuangAnime, # Updated
    rank.RankType.Documentary,
    rank.RankType.Movie,
    rank.RankType.TV,
    rank.RankType.Variety
}

def parse_score(val):
    if not val: return 0
    if isinstance(val, (int, float)): return val
    try:
        val = str(val).replace('分', '')
        return float(val)
    except:
        return 0

async def main():
    ranking_data = {}

    print("Fetching Ranking Data...")
    
    for label, rank_type in TRANSFORM_MAP.items():
        print(f"Fetching {label}...")
        try:
            res = await rank.get_rank(rank_type)
            items = res.get('list', [])
            
            processed_items = []
            for idx, item in enumerate(items[:100]): # Top 100
                try:
                    # Handle PGC content (seasons/movies) which lack bvid
                    if rank_type in PGC_TYPES:
                        # PGC Structure
                        stat = item.get('stat', {})
                        season_id = str(item.get('season_id', ''))
                        if not season_id:
                            # Fallback if season_id is missing
                            season_id = f"pgc_{idx}_{int(datetime.now().timestamp())}"
                            
                        new_item = {
                            "id": season_id,
                            "title": item.get('title', ''),
                            "cover": item.get('cover', ''), # PGC often has 'cover' as vertical, 'ss_horizontal_cover' horizontal
                            "author": "哔哩哔哩" + label, # Fallback author
                            "face": "https://i0.hdslb.com/bfs/face/member/noface.jpg",
                            "plays": int(stat.get('view', 0)),
                            "danmaku": int(stat.get('danmaku', 0)),
                            "duration": item.get('duration', ''), # Often missing for PGC
                            "desc": item.get('desc', ''),
                            "score": parse_score(item.get('rating', 0)),
                            "rank": idx + 1,
                            "partition": label,
                            "raw": item # Save raw data
                        }
                        # Use horizontal cover if available for better UI fit, otherwise cover
                        if 'ss_horizontal_cover' in item and item['ss_horizontal_cover']:
                            new_item['cover'] = item['ss_horizontal_cover']
                            
                    else:
                        # UGC Structure (Standard Videos)
                        if 'bvid' not in item:
                            continue
                            
                        new_item = {
                            "id": item['bvid'],
                            "title": item.get('title', ''),
                            "cover": item.get('pic', ''),
                            "author": item.get('owner', {}).get('name', ''),
                            "face": item.get('owner', {}).get('face', ''),
                            "plays": int(item.get('stat', {}).get('view', 0)),
                            "danmaku": int(item.get('stat', {}).get('danmaku', 0)),
                            "duration": item.get('duration', 0),
                            "desc": item.get('desc', ''),
                            "score": parse_score(item.get('score', 0)),
                            "rank": idx + 1,
                            "partition": label,
                            "raw": item # Save raw data
                        }
                    
                    processed_items.append(new_item)
                except Exception as e:
                    print(f"Error processing item in {label}: {e}")
                    continue

            ranking_data[label] = processed_items
            print(f"  -> Fetched {len(processed_items)} items")

        except Exception as e:
            print(f"Failed to fetch {label}: {e}")
            ranking_data[label] = []

    # Generate TypeScript file
    ts_content = f"""
// Auto-generated ranking data
// Timestamp: {datetime.now().isoformat()}

export interface RankingVideo {{
    id: string;
    title: string;
    cover: string;
    author: string;
    face: string;
    plays: number;
    danmaku: number;
    duration?: number | string;
    desc: string;
    score?: number;
    rank: number;
    partition: string;
    raw?: any;
}}

export const RANKING_DATA: Record<string, RankingVideo[]> = {json.dumps(ranking_data, ensure_ascii=False, indent=4)};
"""

    with open("apps/Bilibili/data/rankingData.ts", "w", encoding="utf-8") as f:
        f.write(ts_content)
    
    print("Successfully generated apps/Bilibili/data/rankingData.ts")

if __name__ == "__main__":
    asyncio.run(main())
