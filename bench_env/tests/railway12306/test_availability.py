"""
Railway12306 availability sampling tests.
"""

from __future__ import annotations

import datetime
import json
import os
from pathlib import Path
import subprocess
import tempfile
from typing import Any

from bench_env.task.railway12306.app import (
    Railway12306,
    _catalog_route_candidates,
    _generate_seat_count,
    _is_generated_count_sellable,
    _load_train_catalog,
)


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "apps" / "Railway12306" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


DEFAULTS = _load_defaults()
REPO_ROOT = Path(__file__).resolve().parents[3]
AVAILABILITY_TS_PATH = REPO_ROOT / "apps" / "Railway12306" / "services" / "availabilityGenerator.ts"


def _timestamp_ms(date_str: str) -> int:
    dt = datetime.datetime.fromisoformat(f"{date_str}T00:00:00+00:00")
    return int(dt.timestamp() * 1000)


def _env_state(sim_today: str) -> dict[str, Any]:
    return {
        "apps": {"railway12306": DEFAULTS},
        "os": {"time": {"timestamp": _timestamp_ms(sim_today)}},
    }


def _build_alignment_cases() -> list[dict[str, Any]]:
    catalog = _load_train_catalog()
    records = sorted(
        catalog["availability"].values(),
        key=lambda item: (str(item["trainCode"]), str(item["fromCode"]), str(item["toCode"])),
    )
    dates = [
        "2026-04-10",
        "2026-04-11",
        "2026-04-13",
        "2026-04-15",
        "2026-04-18",
        "2026-04-20",
        "2026-04-22",
        "2026-04-24",
    ]
    buckets = [
        lambda count: count == 0,
        lambda count: count == -1 or count >= 3000,
        lambda count: 1 <= count <= 4,
        lambda count: 5 <= count < 3000,
    ]

    cases: list[dict[str, Any]] = []
    used: set[tuple[str, str, str, str]] = set()
    date_idx = 0
    for predicate in buckets:
        picked = 0
        for item in records:
            for seat_key, base_count in sorted((item.get("availability") or {}).items()):
                count = int(base_count)
                case_key = (
                    str(item["trainCode"]),
                    str(item["fromCode"]),
                    str(item["toCode"]),
                    str(seat_key),
                )
                if case_key in used or not predicate(count):
                    continue
                used.add(case_key)
                cases.append({
                    "baseCount": count,
                    "trainCode": str(item["trainCode"]),
                    "fromCode": str(item["fromCode"]),
                    "toCode": str(item["toCode"]),
                    "date": dates[date_idx],
                    "seatKey": str(seat_key),
                })
                date_idx += 1
                picked += 1
                if picked == 2:
                    break
            if picked == 2:
                break
        assert picked == 2, "failed to build enough availability parity cases"
    return cases


def _ts_generate_counts(*, sim_today: str, cases: list[dict[str, Any]]) -> list[int]:
    source = AVAILABILITY_TS_PATH.read_text(encoding="utf-8")
    for snippet in (
        "const PRESALE_DAYS = 15;",
        "const SEAT_TIGHTNESS",
        "function fnv1a",
        "function makeMulberry32",
        "function computeTightness",
        "export function generateSeatCount",
    ):
        assert snippet in source, f"availabilityGenerator.ts drifted: missing {snippet!r}"

    js_source = """
const SIM_TODAY = process.env.SIM_TODAY || '2026-04-09';
const PRESALE_DAYS = 15;
const SEAT_TIGHTNESS = {
  businessSeat: 0.55,
  premiumSeat: 0.50,
  specialSeat: 0.50,
  firstClass: 0.35,
  secondClass: 0.15,
  softSleeper: 0.45,
  hardSleeper: 0.35,
  softSeat: 0.20,
  hardSeat: 0.18,
  noSeat: 0.05,
  motionSleeper: 0.35,
  highMotionSleeper: 0.40,
  firstSleeper: 0.40,
  secondSleeper: 0.30,
  preferredFirstClass: 0.35,
  highSoftSleeper: 0.45,
};

function fnv1a(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function makeMulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = (Math.imul(t ^ (t >>> 15), t | 1)) >>> 0;
    t ^= (t + (Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function parseToTimestamp(value) {
  if (value === undefined || value === null) return undefined;
  const text = String(value);
  const iso = /^\\d{4}-\\d{2}-\\d{2}$/.test(text)
    ? `${text}T00:00:00Z`
    : text.includes('T') ? text : text.replace(' ', 'T');
  const ts = Date.parse(iso);
  return Number.isNaN(ts) ? undefined : ts;
}

function fromTimestamp(ts) {
  return new Date(ts || 0);
}

function getToday() {
  return SIM_TODAY;
}

function daysFromToday(dateStr) {
  const todayTs = parseToTimestamp(getToday());
  const queryTs = parseToTimestamp(dateStr);
  if (!queryTs) return -999;
  return Math.round((queryTs - todayTs) / 86400000);
}

function getWeekday(dateStr) {
  const d = fromTimestamp(parseToTimestamp(dateStr));
  return (d.getUTCDay() + 6) % 7;
}

function computeTightness(seatKey, trainCode, daysUntil, weekday) {
  const seatT = Object.prototype.hasOwnProperty.call(SEAT_TIGHTNESS, seatKey)
    ? SEAT_TIGHTNESS[seatKey]
    : 0.4;
  const dayF = daysUntil === 0 ? 0.30 : daysUntil <= 3 ? 0.15 : daysUntil <= 7 ? 0.05 : 0;
  const wf = { 4: 0.15, 5: 0.05, 6: 0.20 };
  const trainLuck = (fnv1a(trainCode) % 40) / 100 - 0.20;
  return clamp(
    seatT + dayF + (Object.prototype.hasOwnProperty.call(wf, weekday) ? wf[weekday] : 0) + trainLuck,
    0,
    1,
  );
}

function generateSeatCount(baseCount, trainCode, fromCode, toCode, dateStr, seatKey) {
  const daysUntil = daysFromToday(dateStr);
  if (daysUntil < 0 || daysUntil > PRESALE_DAYS) return 0;

  const weekday = getWeekday(dateStr);
  const tightness = computeTightness(seatKey, trainCode, daysUntil, weekday);
  const seedKey = `${trainCode}|${fromCode}|${toCode}|${dateStr}|${seatKey}`;
  const rng = makeMulberry32(fnv1a(seedKey));

  if (baseCount === 0) {
    const soldOutP = clamp(0.92 + (tightness - 0.5) * 0.2, 0.85, 0.99);
    if (rng() < soldOutP) return 0;
    return Math.floor(1 + rng() * 7);
  }

  if (baseCount === -1 || baseCount >= 3000) {
    const soldOutP = tightness * 0.3;
    if (rng() < soldOutP) return Math.floor(1 + rng() * 14);
    return -1;
  }

  const soldOutP = clamp(tightness - 0.5 + (baseCount < 5 ? 0.1 : 0), 0, 0.6);
  if (rng() < soldOutP) return 0;

  if (baseCount <= 4) {
    const delta = Math.round((rng() - 0.5) * 8);
    return Math.max(1, baseCount + delta);
  }

  const k = 0.4 + rng() * 1.0;
  return Math.max(1, Math.round(baseCount * k));
}

const CASES = JSON.parse(process.env.CASES_JSON || '[]');
const results = CASES.map((item) => generateSeatCount(
  item.baseCount,
  item.trainCode,
  item.fromCode,
  item.toCode,
  item.date,
  item.seatKey,
));
console.log(JSON.stringify(results));
"""

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        script_path = tmp_path / "availability_parity.js"
        script_path.write_text(js_source, encoding="utf-8")
        result = subprocess.run(
            ["node", str(script_path)],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
            env={
                **os.environ,
                "SIM_TODAY": sim_today,
                "CASES_JSON": json.dumps(cases, ensure_ascii=False),
            },
        )
    return json.loads(result.stdout)


def _has_any_ticket(env_state: dict[str, Any], *, from_station: str, to_station: str, date: str) -> bool:
    for item in _catalog_route_candidates(from_station, to_station, False):
        generated = Railway12306._catalog_generated_seats(
            item,
            date=date,
            env_state=env_state,
        )
        if any(_is_generated_count_sellable(count) for count in generated.values()):
            return True
    return False


class TestAvailabilityParity:
    def test_generate_seat_count_matches_ts(self):
        sim_today = "2026-04-09"
        env_state = _env_state(sim_today)
        cases = _build_alignment_cases()

        ts_counts = _ts_generate_counts(sim_today=sim_today, cases=cases)
        py_counts = [
            _generate_seat_count(
                item["baseCount"],
                item["trainCode"],
                item["fromCode"],
                item["toCode"],
                item["date"],
                item["seatKey"],
                env_state,
            )
            for item in cases
        ]

        assert py_counts == ts_counts


class TestBookableSampling:
    def test_list_bookable_trips_returns_only_bookable_candidates(self):
        env_state = _env_state("2026-04-09")
        candidates = Railway12306.list_bookable_trips(
            env_state,
            routes=[("上海", "南京"), ("广州", "深圳")],
            date_range_days=(1, 14),
            seat_types=["商务", "一等", "二等"],
            schedule_prefs=["earliest", "latest"],
            only_high_speed=True,
        )

        assert candidates
        for item in candidates[:20]:
            assert Railway12306.is_trip_bookable(
                env_state,
                item["from_station"],
                item["to_station"],
                item["date"],
                item["schedule_pref"],
                item["seat_type"],
                only_high_speed=True,
            )

    def test_sample_bookable_trip_returns_bookable_combo(self):
        import random

        env_state = _env_state("2026-04-09")
        sampled = Railway12306.sample_bookable_trip(env_state, random.Random(0))

        assert Railway12306.is_trip_bookable(
            env_state,
            sampled["from_station"],
            sampled["to_station"],
            sampled["date"],
            sampled["schedule_pref"],
            sampled["seat_type"],
            only_high_speed=True,
        )

    def test_latest_order_return_route_has_ticket_for_multiple_tomorrows(self):
        latest_ticket = Railway12306(DEFAULTS).my_latest_ticket
        from_city = Railway12306._station_to_city(latest_ticket["toStation"])
        to_city = Railway12306._station_to_city(latest_ticket["fromStation"])

        for sim_today in ("2025-03-15", "2025-07-04", "2026-04-09", "2026-04-16"):
            env_state = _env_state(sim_today)
            tomorrow = (
                datetime.date.fromisoformat(sim_today) + datetime.timedelta(days=1)
            ).isoformat()
            assert _has_any_ticket(
                env_state,
                from_station=from_city,
                to_station=to_city,
                date=tomorrow,
            ), f"expected return route {from_city}->{to_city} to stay bookable on {tomorrow}"
