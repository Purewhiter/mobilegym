#!/usr/bin/env python3
"""
12306 种子数据爬虫（原始数据 + 归一化两层）

产出目录默认 apps/Railway12306/data/catalog/（可通过 --root 覆盖）：
    raw/
      leftTicket/{from}_{to}_{date}.json     —— leftTicket 完整响应
      queryTrainInfo/{trainNo}_{date}.json    —— queryTrainInfo 完整响应
      queryTicketPrice/{trainNo}_{fromNo}_{toNo}_{date}.json  —— 票价（可选）
    trainCatalog.json                         —— 归一化派生数据（前端/bench 消费）

抓取流程（与 apps/Railway12306/services/railwayApi.ts 一致）：
  1. GET /otn/leftTicket/init                                 —— Set-Cookie + CLeftTicketUrl
  2. GET /otn/{queryPath}?...                                 —— 余票/车次列表（原始字符串 raw.result 含所有字段）
  3. GET /otn/queryTrainInfo/query?...                        —— 经停站 + 时刻
  4. GET /otn/leftTicket/queryTicketPrice?...                 —— 票价（可选；默认跳过，走公式）

Resume：存在原始文件直接读盘，不重发请求。

用法：
  # 小规模 dry-run（不写盘）
  python apps/Railway12306/data/crawl_seed.py --cities 北京 上海 --max-trains-per-od 3 --dry-run

  # 全量
  python apps/Railway12306/data/crawl_seed.py --cities 北京 上海 广州 ... --date 2026-04-23

  # 断点续跑：命令相同，已落盘的 raw 会被直接复用
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests

# ─── 常量 ──────────────────────────────────────────────────────────────

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
BASE_HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

CITY_CODES = {
    "北京": "BJP", "上海": "SHH", "广州": "GZQ", "深圳": "SZQ",
    "杭州": "HZH", "南京": "NJH", "武汉": "WHN", "成都": "CDW",
    "重庆": "CQW", "西安": "XAY", "长沙": "CSQ", "郑州": "ZZF",
    "天津": "TJP", "济南": "JNK", "合肥": "HFH", "福州": "FZS",
    "厦门": "XMS", "青岛": "QDK", "沈阳": "SYT", "大连": "DLT",
    "哈尔滨": "HBB", "昆明": "KMM",
}

INIT_URL = "https://kyfw.12306.cn/otn/leftTicket/init"
DEFAULT_QUERY_PATH = "leftTicket/queryG"

# leftTicket row 字段索引（完整版）
L_TRAIN_NO = 2
L_STATION_TRAIN_CODE = 3
L_FROM_CODE = 6
L_TO_CODE = 7
L_FROM_NO = 16
L_TO_NO = 17

# 席别代码 → 可读 key（12306 内部编码）
SEAT_CODE_MAP = {
    "9": "businessSeat",     # 商务座
    "P": "premiumSeat",      # 特等座
    "M": "firstClass",       # 一等座
    "O": "secondClass",      # 二等座
    "6": "highSoftSleeper",  # 高级软卧
    "4": "softSleeper",      # 软卧
    "3": "softSeat",         # 软座
    "2": "hardSleeper",      # 硬卧
    "1": "hardSeat",         # 硬座
    "W": "noSeat",           # 无座
    "F": "motionSleeper",    # 动卧
    "S": "motionSleeper2",   # 动感卧铺（部分车型）
}

# leftTicket 各席别余票列索引（按 12306 实测排布）
SEAT_AVAILABILITY_COLS: dict[str, int] = {
    "highSoftSleeper": 21,   # gr_num
    "other": 22,             # qt_num
    "softSleeper": 23,       # rw_num
    "softSeat": 24,          # rz_num
    "premiumSeat": 25,       # tz_num
    "noSeat": 26,            # wz_num
    "motionSleeper": 27,     # yb_num
    "hardSleeper": 28,       # yw_num
    "hardSeat": 29,          # yz_num
    "secondClass": 30,       # ze_num
    "firstClass": 31,        # zy_num
    "businessSeat": 32,      # swz_num
    "srrb": 33,              # 动感卧铺
}


# ─── 会话 ──────────────────────────────────────────────────────────────

@dataclass
class Session:
    sess: requests.Session = field(default_factory=requests.Session)
    query_path: str = DEFAULT_QUERY_PATH
    last_init: float = 0.0
    init_ttl: float = 15 * 60
    request_count: int = 0

    def ensure_init(self, force: bool = False) -> None:
        now = time.time()
        if not force and self.query_path and (now - self.last_init) < self.init_ttl:
            return
        self.sess.cookies.clear()
        headers = {**BASE_HEADERS, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"}
        resp = self.sess.get(INIT_URL, headers=headers, timeout=20)
        resp.raise_for_status()
        m = re.search(r"CLeftTicketUrl\s*=\s*'([^']+)'", resp.text)
        self.query_path = m.group(1) if m else DEFAULT_QUERY_PATH
        self.last_init = now
        print(f"[init] queryPath={self.query_path}  cookies={len(self.sess.cookies)}", file=sys.stderr)


def polite_sleep(min_ms: int = 1500, max_ms: int = 2500) -> None:
    time.sleep(random.uniform(min_ms, max_ms) / 1000.0)


# ─── HTTP: leftTicket ──────────────────────────────────────────────────

def fetch_left_ticket(s: Session, date: str, from_code: str, to_code: str) -> dict[str, Any]:
    """返回完整 leftTicket JSON 响应（不做裁剪）"""
    s.ensure_init()
    params = {
        "leftTicketDTO.train_date": date,
        "leftTicketDTO.from_station": from_code,
        "leftTicketDTO.to_station": to_code,
        "purpose_codes": "ADULT",
    }
    url = f"https://kyfw.12306.cn/otn/{s.query_path}"

    for attempt in range(3):
        resp = s.sess.get(url, params=params, headers=BASE_HEADERS, timeout=20)
        s.request_count += 1
        ct = resp.headers.get("content-type", "")
        body_head = resp.text[:400]
        if "text/html" in ct or "err.css" in body_head:
            print(f"[warn] HTML/风控页 attempt={attempt} {from_code}→{to_code}", file=sys.stderr)
            time.sleep(3 + attempt * 2)
            s.ensure_init(force=True)
            continue
        try:
            return resp.json()
        except Exception as e:
            print(f"[warn] JSON parse 失败: {e}; body={body_head[:200]}", file=sys.stderr)
            time.sleep(3)
    raise RuntimeError(f"leftTicket 失败 {from_code}→{to_code} @{date}")


# ─── HTTP: queryTransfer（中转换乘） ───────────────────────────────────

def _fetch_lc_query_path(s: Session) -> str:
    """获取中转查询动态路径（/otn/lcquery/queryU 之类，会随部署变化）。"""
    resp = s.sess.get(
        "https://kyfw.12306.cn/otn/lcQuery/init",
        headers={**BASE_HEADERS, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"},
        timeout=20,
    )
    resp.raise_for_status()
    m = re.search(r"var\s+lc_search_url\s*=\s*'([^']+)'", resp.text)
    if not m:
        raise RuntimeError("无法提取 lc_search_url")
    return m.group(1)


def fetch_transfer(s: Session, date: str, from_code: str, to_code: str,
                   lc_path: str, middle: str = "") -> dict[str, Any]:
    """中转查询：返回完整 JSON 响应。purpose_codes=00 成人非学生。"""
    params = {
        "train_date": date,
        "from_station_telecode": from_code,
        "to_station_telecode": to_code,
        "middle_station": middle,
        "result_index": "0",
        "can_query": "Y",
        "isShowWZ": "Y",
        "purpose_codes": "00",
        "channel": "E",
    }
    url = f"https://kyfw.12306.cn{lc_path}"
    resp = s.sess.get(url, params=params, headers=BASE_HEADERS, timeout=30)
    s.request_count += 1
    try:
        return resp.json()
    except Exception:
        return {"__raw_text__": resp.text[:2000], "__status__": resp.status_code}


# ─── HTTP: queryTrainInfo ──────────────────────────────────────────────

def fetch_train_info(s: Session, train_no: str, date: str) -> dict[str, Any]:
    """返回完整 queryTrainInfo JSON 响应。
    注意接口只接受 train_no + train_date + rand_code；多塞参数会触发异常结构。
    """
    params = {
        "leftTicketDTO.train_no": train_no,
        "leftTicketDTO.train_date": date,
        "rand_code": "",
    }
    url = "https://kyfw.12306.cn/otn/queryTrainInfo/query"
    resp = s.sess.get(url, params=params, headers=BASE_HEADERS, timeout=20)
    s.request_count += 1
    try:
        return resp.json()
    except Exception:
        return {"__raw_text__": resp.text[:2000], "__status__": resp.status_code}


# ─── 磁盘 I/O: raw 层 ──────────────────────────────────────────────────

def raw_paths(root: Path, date: str) -> dict[str, Path]:
    return {
        "left": root / "raw" / "leftTicket",
        "stops": root / "raw" / "queryTrainInfo",
        "price": root / "raw" / "queryTicketPrice",
    }


def load_or_fetch_left(s: Session, root: Path, date: str, a: str, b: str,
                        fc: str, tc: str) -> dict[str, Any]:
    dir_ = root / "raw" / "leftTicket"
    dir_.mkdir(parents=True, exist_ok=True)
    fp = dir_ / f"{fc}_{tc}_{date}.json"
    if fp.exists():
        return json.loads(fp.read_text(encoding="utf-8"))
    js = fetch_left_ticket(s, date, fc, tc)
    fp.write_text(json.dumps(js, ensure_ascii=False), encoding="utf-8")
    return js


def load_or_fetch_stops(s: Session, root: Path, date: str, train_no: str) -> dict[str, Any]:
    dir_ = root / "raw" / "queryTrainInfo"
    dir_.mkdir(parents=True, exist_ok=True)
    fp = dir_ / f"{train_no}_{date}.json"
    if fp.exists():
        return json.loads(fp.read_text(encoding="utf-8"))
    js = fetch_train_info(s, train_no, date)
    fp.write_text(json.dumps(js, ensure_ascii=False), encoding="utf-8")
    return js


def load_or_fetch_transfer(s: Session, root: Path, date: str,
                           fc: str, tc: str, lc_path: str) -> dict[str, Any]:
    dir_ = root / "raw" / "queryTransfer"
    dir_.mkdir(parents=True, exist_ok=True)
    fp = dir_ / f"{fc}_{tc}_{date}.json"
    if fp.exists():
        return json.loads(fp.read_text(encoding="utf-8"))
    js = fetch_transfer(s, date, fc, tc, lc_path)
    fp.write_text(json.dumps(js, ensure_ascii=False), encoding="utf-8")
    return js


# ─── 归一化层 ──────────────────────────────────────────────────────────

_WS_RE = re.compile(r"[\s\u3000]+")


def clean_station_name(name: str | None) -> str:
    """12306 的 queryTrainInfo 对部分站名返回了对齐填充版（如 '福  州'），统一去掉所有空白。"""
    if not name:
        return ""
    return _WS_RE.sub("", name)


def parse_yp_info(parts: list[str]) -> dict[str, dict[str, float | int]]:
    """
    从 yp_info_new 字段（通常 [39]）解码 **每席别的价格 + 精确余票数**。
    格式：每 10 字符一块 = 席别代码(1) + 价格×10 分(5) + 余票数(4)
    例：'9231800005M106000000O066200021O066203000'
      9 23180 0005 → 商务座 ¥2318.0 / 5张
      M 10600 0000 → 一等座 ¥1060.0 / 0张
      O 06620 0021 → 二等座 ¥662.0  / 21张
      O 06620 3000 → 无座   ¥662.0  / 3000（"充足"占位）
    约定：
      - 同一字母第二次出现视为"伴生席别"：第二次 O → 无座（同二等价）；
        其他 seat code 出现第二次罕见，保留主席别，忽略后续重复。
      - count >= 3000 通常意味"充足/有票"。调用方可以自行阈值化为 "有"。
    返回：{seat_key: {"price": <float 元>, "count": <int>}}
    """
    if len(parts) <= 39:
        return {}
    s = parts[39]
    out: dict[str, dict[str, float | int]] = {}
    seen_codes: set[str] = set()
    for i in range(0, len(s) - 9, 10):
        blk = s[i:i+10]
        c = blk[0]
        # 第二次出现 'O' → 无座（12306 约定：无座与二等同价，用 O 复用）
        if c == "O" and "O" in seen_codes:
            key = "noSeat"
        else:
            key = SEAT_CODE_MAP.get(c)
        seen_codes.add(c)
        if not key:
            continue
        # 同一 key 首次写入为准；重复直接跳过
        if key in out:
            continue
        try:
            price_yuan = int(blk[1:6]) / 10.0  # 价格×10 分 → 元
            count = int(blk[6:10])
        except ValueError:
            continue
        out[key] = {"price": price_yuan, "count": count}
    return out


def parse_availability(parts: list[str], yp: dict[str, dict[str, float | int]]) -> dict[str, Any]:
    """
    产出每席别的精确余票数。
    优先级：yp_info_new 精确 count（含 >=3000 占位）> [20-33] 列文本。
    返回：{seat_key: int}  （count=-1 表示 "有/充足"；0=无；>0=精确张数）
    """
    out: dict[str, int] = {}
    # 先用 yp_info 的精确数字（覆盖所有有数据的席别）
    for key, info in yp.items():
        cnt = int(info["count"])
        out[key] = -1 if cnt >= 3000 else cnt
    # 再用 [20-33] 文本补全 yp_info 里没出现的席别（冷门席别偶尔只出现在列里）
    for seat_key, col in SEAT_AVAILABILITY_COLS.items():
        if seat_key in out:
            continue
        if col >= len(parts):
            continue
        v = parts[col]
        if v == "":
            continue
        if v == "无":
            out[seat_key] = 0
        elif v == "有":
            out[seat_key] = -1
        else:
            try:
                out[seat_key] = int(v)
            except ValueError:
                pass
    return out


def parse_seat_types(parts: list[str]) -> list[str]:
    """从 seat_types 编码字段（通常 [35]）解码席别列表，去重保序。
    第二次出现的 O 视为无座（与 yp_info 解析一致）。"""
    if len(parts) <= 35:
        return []
    code = parts[35]
    seen_codes: set[str] = set()
    keys_seen: set[str] = set()
    out: list[str] = []
    for c in code:
        if c == "O" and "O" in seen_codes:
            key = "noSeat"
        else:
            key = SEAT_CODE_MAP.get(c)
        seen_codes.add(c)
        if key and key not in keys_seen:
            keys_seen.add(key)
            out.append(key)
    return out


_BERTH_NAMES: dict[str, str] = {"1": "下铺", "2": "中铺", "3": "上铺"}


def parse_berth_prices(parts: list[str]) -> dict[str, list[dict[str, float | str]]]:
    """解析 [53] berth_price_info。每 7 字符一组：<席别码:1><铺位码:1><价格:5>。
    席别码如 '3'(硬卧)/'4'(软卧)/'I'(一等卧)/'J'(二等卧)。价格 / 10 = 元。
    返回：{seat_key: [{position, price}, ...]}，按价格升序（上铺最便宜排前）。
    """
    out: dict[str, list[dict[str, float | str]]] = {}
    if len(parts) <= 53:
        return out
    raw = parts[53]
    if not raw or len(raw) < 7:
        return out
    tmp: dict[str, list[dict[str, float | str]]] = {}
    for i in range(0, len(raw) - 6, 7):
        seat_code = raw[i]
        berth_code = raw[i + 1]
        try:
            price_raw = int(raw[i + 2:i + 7])
        except ValueError:
            continue
        pos = _BERTH_NAMES.get(berth_code)
        if not pos:
            continue
        key = SEAT_CODE_MAP.get(seat_code)
        if not key:
            continue
        tmp.setdefault(key, []).append({"position": pos, "price": price_raw / 10.0})
    for k, lst in tmp.items():
        lst.sort(key=lambda x: x["price"])  # type: ignore[arg-type]
        out[k] = lst
    return out


def parse_discount(parts: list[str]) -> dict[str, int]:
    """解析 [54] discount_info。每 5 字符一组：<席别码:1><铺位码:1><pad:1><折扣率:2>。
    折扣率 80 表示 8 折，65 表示 6.5 折。返回 {seat_key: 折扣}（首个命中为准）。"""
    out: dict[str, int] = {}
    if len(parts) <= 54:
        return out
    raw = parts[54]
    if not raw or len(raw) < 5:
        return out
    for i in range(0, len(raw) - 4, 5):
        seat_code = raw[i]
        try:
            disc = int(raw[i + 3:i + 5])
        except ValueError:
            continue
        if disc <= 0 or disc >= 100:
            continue
        key = SEAT_CODE_MAP.get(seat_code)
        if key and key not in out:
            out[key] = disc
    return out


def parse_sale_time(parts: list[str]) -> str | None:
    """仅在 [11]=IS_TIME_NOT_BUY（尚未起售）时返回起售时间 HH:mm；否则 None。"""
    if len(parts) <= 55:
        return None
    if parts[11] != "IS_TIME_NOT_BUY":
        return None
    s = parts[55]
    if not s or len(s) < 12:
        return None
    return f"{s[8:10]}:{s[10:12]}"


def build_catalog(cities: list[str], date: str, root: Path) -> dict[str, Any]:
    """基于 raw/ 目录下已缓存的数据重建归一化 catalog。"""
    trains: dict[str, dict[str, Any]] = {}
    city_stations: dict[str, set[str]] = {c: set() for c in cities}
    # 每个 (train, OD) 组合的余票/席别/价格快照
    availability: dict[str, dict[str, Any]] = {}
    # 全局站码映射：VNP → 北京南
    station_code_map: dict[str, str] = {}
    # 中转方案：fc|tc → [plan, ...]
    transfer_plans: dict[str, list[dict[str, Any]]] = {}

    for a in cities:
        for b in cities:
            if a == b:
                continue
            fc, tc = CITY_CODES[a], CITY_CODES[b]
            fp = root / "raw" / "leftTicket" / f"{fc}_{tc}_{date}.json"
            if not fp.exists():
                continue
            js = json.loads(fp.read_text(encoding="utf-8"))
            data = js.get("data") or {}
            rows = data.get("result") or []
            code_map = data.get("map") or {}
            # 全局合并站码映射（去掉填充空格）
            for code, name in code_map.items():
                clean = clean_station_name(name)
                if clean and code not in station_code_map:
                    station_code_map[code] = clean
            for row in rows:
                parts = row.split("|")
                if len(parts) < 35:
                    continue
                code = parts[L_STATION_TRAIN_CODE]
                if not code:
                    continue
                train_no = parts[L_TRAIN_NO]
                if not train_no:
                    continue
                from_name = clean_station_name(code_map.get(parts[L_FROM_CODE], ""))
                to_name = clean_station_name(code_map.get(parts[L_TO_CODE], ""))
                if from_name:
                    city_stations[a].add(from_name)
                if to_name:
                    city_stations[b].add(to_name)

                # 装 trains（首次见时附经停）
                if code not in trains:
                    stops_fp = root / "raw" / "queryTrainInfo" / f"{train_no}_{date}.json"
                    stops_raw: list[dict[str, Any]] = []
                    if stops_fp.exists():
                        stops_js = json.loads(stops_fp.read_text(encoding="utf-8"))
                        d = stops_js.get("data")
                        if isinstance(d, dict):
                            rows_ = d.get("data")
                            if isinstance(rows_, list):
                                stops_raw = rows_

                    def _norm(t: Any) -> str | None:
                        return None if (not t or t in ("----", "--:--")) else t

                    # 带 day offset：时间回跳 → day+=1
                    stops = []
                    prev_time = None
                    day = 0
                    for r in stops_raw:
                        arr = _norm(r.get("arrive_time"))
                        dep = _norm(r.get("start_time"))
                        # 判断 day：以 dep 优先（始发站无 arr），否则 arr
                        ref = arr or dep
                        if ref and prev_time and ref < prev_time:
                            day += 1
                        stops.append({
                            "station": clean_station_name(r.get("station_name")),
                            "arr": arr,
                            "dep": dep,
                            "day": day,
                        })
                        if ref:
                            prev_time = ref
                    trains[code] = {
                        "trainNo": train_no,
                        "fromStation": parts[4],   # start_station_telecode
                        "toStation": parts[5],     # end_station_telecode
                        "stops": stops,
                        "seatTypes": parse_seat_types(parts),
                        "lishi": parts[10],
                    }

                # 每个 (train, OD) 的快照（余票 + 价格 + 候补/折扣/铺位分价/起售时间等）
                yp = parse_yp_info(parts)
                seat_types = parse_seat_types(parts)
                avail = parse_availability(parts, yp)
                prices = {k: float(v["price"]) for k, v in yp.items()}
                berth_prices = parse_berth_prices(parts)
                discount = parse_discount(parts)
                sale_time = parse_sale_time(parts)
                key = f"{code}|{parts[L_FROM_CODE]}|{parts[L_TO_CODE]}"
                entry: dict[str, Any] = {
                    "trainCode": code,
                    "fromCode": parts[L_FROM_CODE],
                    "toCode": parts[L_TO_CODE],
                    "fromStationNo": parts[L_FROM_NO] if L_FROM_NO < len(parts) else "",
                    "toStationNo": parts[L_TO_NO] if L_TO_NO < len(parts) else "",
                    "startTime": parts[8],
                    "arriveTime": parts[9],
                    "lishi": parts[10],
                    "seatTypes": seat_types,
                    "availability": avail,
                    "prices": prices,
                    # 整车级标志
                    "canWaitlist": parts[37] == "1" if len(parts) > 37 else False,
                    "exchangeable": parts[36] == "1" if len(parts) > 36 else False,
                }
                if berth_prices:
                    entry["berthPrices"] = berth_prices
                if discount:
                    entry["discount"] = discount
                if sale_time:
                    entry["saleTime"] = sale_time
                availability[key] = entry

    # 合并中转方案（只对已爬取的 raw/queryTransfer 生效）
    transfer_dir = root / "raw" / "queryTransfer"
    if transfer_dir.exists():
        for fp in sorted(transfer_dir.glob(f"*_{date}.json")):
            stem = fp.stem.rsplit(f"_{date}", 1)[0]
            if "_" not in stem:
                continue
            fc, tc = stem.split("_", 1)
            js = json.loads(fp.read_text(encoding="utf-8"))
            mid = ((js.get("data") or {}).get("middleList") or [])
            plans: list[dict[str, Any]] = []
            for p in mid:
                full = p.get("fullList") or []
                legs = [
                    {
                        "trainCode": leg.get("station_train_code"),
                        "trainNo": leg.get("train_no"),
                        "fromStation": clean_station_name(leg.get("from_station_name")),
                        "toStation": clean_station_name(leg.get("to_station_name")),
                        "fromCode": leg.get("from_station_telecode"),
                        "toCode": leg.get("to_station_telecode"),
                        "startTime": leg.get("start_time"),
                        "arriveTime": leg.get("arrive_time"),
                        "lishi": leg.get("lishi"),
                        "dayDifference": leg.get("day_difference"),
                    }
                    for leg in full
                ]
                plans.append({
                    "fromStation": clean_station_name(p.get("from_station_name")),
                    "toStation": clean_station_name(p.get("end_station_name")),
                    "middleStation": clean_station_name(p.get("middle_station_name")),
                    "startTime": p.get("start_time"),
                    "arriveTime": p.get("arrive_time"),
                    "totalLishi": p.get("all_lishi"),
                    "totalMinutes": p.get("all_lishi_minutes"),
                    "waitMinutes": p.get("wait_time_minutes"),
                    "sameStation": p.get("same_station") == 1,
                    "legs": legs,
                })
            transfer_plans[f"{fc}|{tc}"] = plans

    return {
        "meta": {
            "crawledAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "date": date,
            "cities": cities,
            "source": "12306 leftTicket + queryTrainInfo + queryTransfer",
        },
        "stationCodeMap": dict(sorted(station_code_map.items())),
        "cityStations": {c: sorted(v) for c, v in city_stations.items()},
        "trains": trains,
        "availability": availability,
        "transferPlans": transfer_plans,
    }


# ─── 主流程 ────────────────────────────────────────────────────────────

def crawl_transfer(date: str, ods: list[tuple[str, str]], root: Path) -> None:
    """只爬 queryTransfer。ods: [(from_city, to_city), ...]，任意 CITY_CODES 中的城市。"""
    bad = [c for pair in ods for c in pair if c not in CITY_CODES]
    if bad:
        print(f"未知城市: {bad}", file=sys.stderr)
        sys.exit(2)
    s = Session()
    s.ensure_init()  # 先建立 cookie
    try:
        lc_path = _fetch_lc_query_path(s)
    except Exception as e:
        print(f"[err] 获取 lc_search_url 失败: {e}", file=sys.stderr)
        return
    print(f"[transfer] lc_path={lc_path}", file=sys.stderr)
    polite_sleep()
    for idx, (a, b) in enumerate(ods):
        fc, tc = CITY_CODES[a], CITY_CODES[b]
        fp = root / "raw" / "queryTransfer" / f"{fc}_{tc}_{date}.json"
        cached = fp.exists()
        print(f"[transfer {idx+1}/{len(ods)}] {a}→{b}{' [cached]' if cached else ''}", file=sys.stderr)
        try:
            js = load_or_fetch_transfer(s, root, date, fc, tc, lc_path)
            data = js.get("data") or {}
            mid = data.get("middleList") or []
            print(f"  方案数: {len(mid)}", file=sys.stderr)
        except Exception as e:
            print(f"  [err] {e}", file=sys.stderr)
        if not cached:
            polite_sleep()
    print(f"[transfer done] 请求数={s.request_count}", file=sys.stderr)


def crawl(cities: list[str], date: str, max_trains: int, root: Path,
          build_only: bool) -> None:
    if not build_only:
        s = Session()
        pairs = [(a, b) for a in cities for b in cities if a != b]
        print(f"[plan] cities={len(cities)} pairs={len(pairs)} date={date}", file=sys.stderr)

        for idx, (a, b) in enumerate(pairs):
            fc, tc = CITY_CODES[a], CITY_CODES[b]
            lt_fp = root / "raw" / "leftTicket" / f"{fc}_{tc}_{date}.json"
            cached = lt_fp.exists()
            print(f"\n[{idx+1}/{len(pairs)}] {a}({fc}) → {b}({tc}){' [cached]' if cached else ''}", file=sys.stderr)

            try:
                js = load_or_fetch_left(s, root, date, a, b, fc, tc)
            except Exception as e:
                print(f"[err] {a}→{b}: {e}", file=sys.stderr)
                polite_sleep()
                continue
            if not cached:
                polite_sleep()

            rows = (js.get("data") or {}).get("result") or []
            parsed_all: list[tuple[str, str]] = []
            for row in rows:
                parts = row.split("|")
                if len(parts) < 15:
                    continue
                code = parts[L_STATION_TRAIN_CODE]
                train_no = parts[L_TRAIN_NO]
                if not code or not train_no:
                    continue
                parsed_all.append((code, train_no))
            print(f"  列车数(全部): {len(parsed_all)}", file=sys.stderr)

            # 抓每个新车次的经停（已缓存自动跳过）
            attempts = 0
            for code, train_no in parsed_all:
                info_fp = root / "raw" / "queryTrainInfo" / f"{train_no}_{date}.json"
                if info_fp.exists():
                    continue
                if max_trains and attempts >= max_trains:
                    break
                attempts += 1
                try:
                    load_or_fetch_stops(s, root, date, train_no)
                    print(f"  + {code} {train_no}", file=sys.stderr)
                except Exception as e:
                    print(f"  [err stops] {code}: {e}", file=sys.stderr)
                polite_sleep()

                if s.request_count % 100 == 0:
                    s.ensure_init(force=True)

        print(f"\n[fetch done] 请求数={s.request_count}", file=sys.stderr)

    # 重建归一化 catalog
    catalog = build_catalog(cities, date, root)
    print(f"[build] 车次={len(catalog['trains'])} availability 条目={len(catalog['availability'])}", file=sys.stderr)

    out_fp = root / "trainCatalog.json"
    out_fp.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[write] {out_fp} ({out_fp.stat().st_size/1024/1024:.2f} MB)", file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--cities", nargs="+", default=["北京", "上海"],
                   help=f"可选：{'/'.join(CITY_CODES.keys())}")
    p.add_argument("--date", default="2026-04-23")
    p.add_argument("--max-trains-per-od", type=int, default=0,
                   help="每对 OD 最多抓几个新车次（0=不限）")
    p.add_argument("--root", default=str(Path(__file__).parent / "catalog"),
                   help="数据根目录（raw/ 和 trainCatalog.json 都在此下）")
    p.add_argument("--build-only", action="store_true",
                   help="跳过爬取，仅基于已有 raw/ 重建 trainCatalog.json")
    p.add_argument("--transfer-ods", nargs="+", default=None,
                   help="只爬中转接口，格式: 北京-上海 上海-南京（用 - 分隔方向）")
    p.add_argument("--dry-run", action="store_true", help="不写 catalog")
    args = p.parse_args()

    root = Path(args.root)

    # 中转模式：不走常规 leftTicket 流程
    if args.transfer_ods:
        ods: list[tuple[str, str]] = []
        for token in args.transfer_ods:
            if "-" not in token:
                print(f"格式错误: {token!r} 应为 城市A-城市B", file=sys.stderr)
                sys.exit(2)
            a, b = token.split("-", 1)
            ods.append((a, b))
        crawl_transfer(args.date, ods, root)
        return

    bad = [c for c in args.cities if c not in CITY_CODES]
    if bad:
        print(f"未知城市: {bad}\n可选: {list(CITY_CODES.keys())}", file=sys.stderr)
        sys.exit(2)
    if len(args.cities) < 2:
        print("至少 2 个城市", file=sys.stderr)
        sys.exit(2)

    crawl(args.cities, args.date, args.max_trains_per_od, root, args.build_only)


if __name__ == "__main__":
    main()
