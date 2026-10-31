"""Explore an app's navigation on a running simulator and write the graph it finds.

From every reachable URL, tap each tagged element (data-trigger / data-action),
record the URL it lands on, then press system back and record where that lands.
Elements are keyed by kind + visible text (+ occurrence index), not by trigger
id, so graphs from two builds can be compared even when ids change:

    python scripts/explore_nav_graph.py http://localhost:3000/ tencent_meeting new.json
    python scripts/explore_nav_graph.py http://localhost:3401/ tencent_meeting old.json
    python scripts/explore_nav_graph.py --diff old.json new.json

Every state is reached again from a reset simulator, so taps that change app
data (cancel a meeting, leave a call) do not break later paths. Controls that
need typed input first (a meeting number) are not followed.
"""

from __future__ import annotations

import argparse
import asyncio
import json

from playwright.async_api import async_playwright

LIST_JS = """() => {
  const els = [...document.querySelectorAll('[data-trigger],[data-action]')]
    .filter(e => e.offsetParent && e.getBoundingClientRect().width > 0);
  const seen = {};
  return els.map((e, i) => {
    const text = (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    const kind = e.getAttribute('data-trigger') === 'system.back' ? 'back'
      : (e.hasAttribute('data-action') ? 'action' : 'nav');
    const k = kind + '|' + text;
    seen[k] = (seen[k] || 0) + 1;
    return { key: k + '#' + seen[k], idx: i };
  });
}"""

CLICK_JS = """(i) => {
  const els = [...document.querySelectorAll('[data-trigger],[data-action]')]
    .filter(e => e.offsetParent && e.getBoundingClientRect().width > 0);
  els[i].click();
}"""


async def explore(url: str, app: str, max_states: int, max_taps: int, wait_ms: int, sim_time: str) -> dict:
    # Frozen simulated time: labels such as "in 5 min" stay the same across the reloads.
    url = url + ("&" if "?" in url else "?") + f"simTime={sim_time}&simTimeFlowing=0"
    # The app's URL, or HOME once system back has left the app.
    route_js = (f"() => window.__OS__.state?.activeAppId === '{app}' "
                f"? window.__OS__.getAppRoute('{app}')?.path : 'HOME'")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 360, "height": 800})
        await page.goto(url)
        await page.wait_for_function("() => window.__OS__?.openApp", timeout=60000)
        await page.wait_for_timeout(1500)

        async def fresh() -> None:
            # Start from the initial data every time: taps change it (cancel a
            # meeting, leave a call), which would break the recorded paths.
            await page.evaluate("() => window.__SIM__.resetState()")
            await page.goto(url)
            await page.wait_for_function("() => window.__OS__?.openApp", timeout=60000)
            await page.wait_for_timeout(800)
            await page.evaluate(f"() => window.__OS__.openApp('{app}')")
            await page.wait_for_timeout(1200)

        async def tap(key: str) -> bool:
            items = await page.evaluate(LIST_JS)
            hit = next((it for it in items if it["key"] == key), None)
            if hit is None:
                return False
            await page.evaluate(CLICK_JS, hit["idx"])
            await page.wait_for_timeout(wait_ms)
            return True

        async def reach(path: list[str]) -> bool:
            await fresh()
            await page.wait_for_function(f"() => window.__OS__.state?.activeAppId === '{app}'", timeout=10000)
            for key in path:
                if not await tap(key):
                    return False
            return True

        await fresh()
        states: dict[str, list[str]] = {await page.evaluate(route_js): []}
        queue = list(states)
        edges: dict[str, object] = {}
        while queue:
            state = queue.pop(0)
            path = states[state]
            if not await reach(path) or await page.evaluate(route_js) != state:
                edges[state] = "UNREACHABLE"
                continue
            for item in (await page.evaluate(LIST_JS))[:max_taps]:
                if await page.evaluate(route_js) != state and not await reach(path):
                    break
                edge = f"{state} :: {item['key']}"
                if not await tap(item["key"]):
                    edges[edge] = "MISSING"
                    continue
                after = await page.evaluate(route_js)
                await page.evaluate("() => window.__OS__.handleBack()")
                await page.wait_for_timeout(wait_ms)
                edges[edge] = [after, await page.evaluate(route_js)]
                if after and after != "HOME" and after not in states and len(states) < max_states:
                    states[after] = path + [item["key"]]
                    queue.append(after)
        await browser.close()
    return {"app": app, "states": states, "edges": edges}


def diff(old_path: str, new_path: str) -> int:
    old, new = json.load(open(old_path)), json.load(open(new_path))
    print("states:", len(old["states"]), "vs", len(new["states"]),
          "| only old:", sorted(set(old["states"]) - set(new["states"])),
          "| only new:", sorted(set(new["states"]) - set(old["states"])))
    keys = sorted(set(old["edges"]) | set(new["edges"]))
    changed = [k for k in keys if old["edges"].get(k) != new["edges"].get(k)]
    print("edges:", len(old["edges"]), "vs", len(new["edges"]), "| same:", len(keys) - len(changed))
    for k in changed:
        print("DIFF", k, "| old:", old["edges"].get(k), "| new:", new["edges"].get(k))
    return 1 if changed else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("args", nargs="+", help="URL APP OUT.json, or --diff OLD.json NEW.json")
    ap.add_argument("--diff", action="store_true")
    ap.add_argument("--max-states", type=int, default=60)
    ap.add_argument("--max-taps", type=int, default=40, help="taps per state")
    ap.add_argument("--wait-ms", type=int, default=450)
    ap.add_argument("--sim-time", default="2026-10-30T21:31:00", help="frozen simulated time for every reload")
    a = ap.parse_args()
    if a.diff:
        return diff(*a.args)
    url, app, out = a.args
    graph = asyncio.run(explore(url, app, a.max_states, a.max_taps, a.wait_ms, a.sim_time))
    json.dump(graph, open(out, "w"), ensure_ascii=False, indent=1)
    print(len(graph["states"]), "states", len(graph["edges"]), "edges ->", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
