"""Explore an app's navigation on a running simulator and write its graph.

The graph is per page, not per URL: every URL the explorer lands on is matched
to the app's route table (`routes.ts`, through `__SIM__.matchRoute`, which
matches as react-router does), and a node is a route plus the UI state its query
declares (`/meeting?dialog=chat`). A photo page is one node however many photos
there are, so the graph stays the size of the app, not of its data.

What is explored is bounded and set by options or by
`scripts/explore_config/<appId>.json`:

- `instancesPerRoute` (default 2): how many instances of one node are visited
  (two photos, two chats). An instance is a URL plus the controls it shows
  and their text, so a meeting page reached as host and as guest counts twice.
- `tapsPerGroup` (default 2): how many controls with the same tag (the photos
  of a grid) are tapped on one page.
- `skip`: trigger / action ids never tapped.
- `prefer`: per trigger id, params to tap first, for controls that only some
  instances show (`{"nav.historyDetail": [{"meetingId": "222 333 444"}]}` opens
  a meeting the user hosted, whose page has the attendee list).
- `inputs`: per node, text to type before tapping, for pages that need it
  (`{"/join": [{"selector": "input[inputmode=numeric]", "text": "276760582"}]}`).

Every tagged control (data-trigger / data-action) is tapped, long-pressed or
double-tapped as its tag says, each time from a reset simulator with frozen
time, at its centre as an agent would (controls under an overlay are COVERED),
waiting for `__SIM__.waitForIdle` after each input. The explorer records where
the control lands, whether the app history grew (push) or not (replace), and
where system back then lands. Edges merge the controls of one tag. The output
also lists routes and declared states never reached, URLs no route matches,
controls that could not be tested, the actions on each node, and for each
action the shortest path from the start page (the old declarations' action
tasks).

    python scripts/explore_nav_graph.py http://localhost:3000/ tencent_meeting new.json
    python scripts/explore_nav_graph.py --diff old.json new.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
from collections import deque
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

from playwright.async_api import async_playwright

CONFIG_DIR = Path(__file__).parent / "explore_config"

# Visible tagged controls, in DOM order: what an agent could tap on this screen.
LIST_JS = """() => {
  const els = [...document.querySelectorAll('[data-trigger],[data-action]')]
    .filter(e => e.offsetParent && e.getBoundingClientRect().width > 0);
  const clean = s => (s || '').trim().replace(/\\s+/g, ' ');
  // A switch or icon has no text of its own: name it by the row around it.
  const label = e => {
    for (let n = e, up = 0; n && up < 4; n = n.parentElement, up++) {
      const text = clean(n === e ? (e.innerText || e.getAttribute('aria-label')) : n.innerText);
      if (text && (n === e || text.length <= 60)) return text.slice(0, 40);
      if (text) break;
    }
    return '';
  };
  return els.map((e, i) => {
    const action = e.getAttribute('data-action');
    const trigger = e.getAttribute('data-trigger');
    return {
      i,
      kind: action ? 'action' : (trigger === 'system.back' ? 'back' : 'nav'),
      id: action || trigger,
      gesture: (action ? e.getAttribute('data-action-type') : e.getAttribute('data-trigger-type')) || 'tap',
      params: (action ? e.getAttribute('data-action-params') : e.getAttribute('data-trigger-params')) || '',
      text: label(e),
    };
  });
}"""

# Bring the control to the middle of the screen and return its centre if a tap
# there would hit it (not an overlay, dialog backdrop or drawer above it).
LOCATE_JS = """(i) => {
  const els = [...document.querySelectorAll('[data-trigger],[data-action]')]
    .filter(e => e.offsetParent && e.getBoundingClientRect().width > 0);
  const e = els[i];
  e.scrollIntoView({ block: 'center', inline: 'center' });
  const r = e.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null;
  const top = document.elementFromPoint(x, y);
  return top && (top === e || e.contains(top)) ? [x, y] : null;
}"""


def query_of(url: str) -> dict[str, str]:
    # The first value of a repeated key, as URLSearchParams.get() reads it.
    query: dict[str, str] = {}
    for k, v in parse_qsl(urlsplit(url).query, keep_blank_values=True):
        query.setdefault(k, v)
    return query


class Routes:
    """Names nodes after the app's route table, like the old declarations did."""

    def __init__(self, table: list[dict]):
        self.table = table
        self.by_name = {r["name"]: r for r in table}
        self.name_of_path: dict[str, str | None] = {}  # pathname -> route name, filled by learn()

    @staticmethod
    def state_query(route: dict, query: dict[str, str]) -> str:
        # Only declared keys with declared values make a UI state; ids and keywords do not.
        return "&".join(f"{k}={query[k]}" for k, values in route["search"].items() if query.get(k) in values)

    def node_of(self, url: str) -> str:
        if url == "HOME":
            return "HOME"
        path = urlsplit(url).path
        name = self.name_of_path[path]
        if name is None:
            return "UNMATCHED:" + path
        route = self.by_name[name]
        state = self.state_query(route, query_of(url))
        return route["path"] + ("?" + state if state else "")

    def unreached(self, reached: set[str]) -> list[str]:
        """Routes with no node reached, and declared UI states not reached.

        A page that always carries a state (messages open on a tab) has no bare
        node, so a route counts as reached through any of its nodes. States listed
        in `states` must be reached exactly; without them each declared value must
        appear in some reached node (`modal=delete` is reached by
        `mode=select&modal=delete`).
        """
        missing = []
        for r in self.table:
            nodes = [n for n in reached if n.partition("?")[0] == r["path"]]
            if not nodes:
                missing.append(r["path"])
                continue
            if r.get("states"):
                missing += [f"{r['path']}?{s}" for s in r["states"] if f"{r['path']}?{s}" not in nodes]
                continue
            pairs = {p for n in nodes for p in n.partition("?")[2].split("&") if p}
            missing += [f"{r['path']}?{k}={v}" for k, values in r["search"].items() for v in values
                        if f"{k}={v}" not in pairs]
        return missing

    def describe(self, node: str) -> str | None:
        path, _, state = node.partition("?")
        route = next((r for r in self.table if r["path"] == path), None)
        if route is None:
            return None
        if state:
            return (route.get("states") or {}).get(state)
        return route.get("description")

    def discrete(self, item: dict) -> str:
        """The part of a control's tag that names a UI state (tab=all), not an instance (an id)."""
        if item["kind"] != "nav" or not item["params"]:
            return ""
        route = self.by_name.get(item["id"].removeprefix("nav."))
        if route is None:
            return ""
        params = json.loads(item["params"])
        return self.state_query(route, {k: str(v) for k, v in params.items()})


def load_config(app: str, args: argparse.Namespace) -> dict:
    path = CONFIG_DIR / f"{app}.json"
    config = json.loads(path.read_text()) if path.exists() else {}
    for key, value in (("instancesPerRoute", args.instances), ("tapsPerGroup", args.taps_per_group)):
        if value is not None:
            config[key] = value
    config.setdefault("instancesPerRoute", 2)
    config.setdefault("tapsPerGroup", 2)
    config.setdefault("skip", [])
    config.setdefault("prefer", {})
    config.setdefault("inputs", {})
    return config


async def explore(url: str, app: str, config: dict, max_pages: int, wait_ms: int, sim_time: str) -> dict:
    # Frozen simulated time: labels such as "in 5 min" stay the same across the reloads.
    url = url + ("&" if "?" in url else "?") + f"simTime={sim_time}&simTimeFlowing=0"
    # The app's URL, or HOME once system back has left the app; with the task's activity
    # count, and the app history depth only while the app's own single activity is on top
    # (an activity started on top, or the app inside another task, has a history of its own).
    where_js = f"""() => {{
      const s = window.__OS__.state;
      if (s?.activeAppId !== '{app}') return null;
      const route = window.__OS__.getAppRoute('{app}');
      const task = s.tasks.find(t => t.taskId === s.activeTaskId);
      const own = task?.rootAppId === '{app}' && task.stack.length === 1;
      return {{ path: route?.path, depth: own ? route?.depth : undefined, activities: task?.stack.length }};
    }}"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 360, "height": 800})

        async def settle() -> None:
            # Like the benchmark: wait until the screen has caught up with the last input.
            await page.wait_for_timeout(wait_ms)
            await page.evaluate("() => window.__SIM__.waitForIdle({ timeoutMs: 5000 })")

        async def fresh() -> None:
            # Start from the initial data every time: taps change it (cancel a
            # meeting, leave a call), which would break the recorded paths.
            await page.evaluate("() => window.__SIM__?.resetState?.()")
            await page.goto(url)
            await page.wait_for_function("() => window.__OS__?.openApp", timeout=60000)
            await page.wait_for_timeout(800)
            await page.evaluate(f"() => window.__OS__.openApp('{app}')")
            await page.wait_for_function(f"() => window.__OS__.state?.activeAppId === '{app}'", timeout=10000)
            await settle()

        async def where() -> tuple[str, int | None, int | None]:
            info = await page.evaluate(where_js)
            if not info:
                return "HOME", None, None
            if urlsplit(info["path"]).path not in routes.name_of_path:
                routes.name_of_path[urlsplit(info["path"]).path] = await page.evaluate(
                    "([app, path]) => window.__SIM__.matchRoute(app, path)", [app, urlsplit(info["path"]).path])
            return info["path"], info.get("depth"), info.get("activities")

        async def current() -> str:
            return (await where())[0]

        async def find(step: dict) -> dict | None:
            # The nth control with this exact tag: stable across reloads, unlike its text.
            same = [it for it in await page.evaluate(LIST_JS)
                    if (it["kind"], it["id"], it["gesture"], it["params"]) == (step["kind"], step["id"], step["gesture"], step["params"])]
            return same[step["nth"]] if step["nth"] < len(same) else None

        async def perform(step: dict, patience_ms: int = 3000) -> bool:
            # Wait for the control to render and settle (a page still animating in
            # has it under the old page), then tap it where an agent would.
            point = None
            for _ in range(max(1, patience_ms // 200)):
                item = await find(step)
                point = item and await page.evaluate(LOCATE_JS, item["i"])
                if point:
                    break
                await page.wait_for_timeout(200)
            if not point:
                return False
            x, y = point
            if step["gesture"] == "longPress":
                await page.mouse.move(x, y)
                await page.mouse.down()
                await page.wait_for_timeout(800)
                await page.mouse.up()
            elif step["gesture"] == "doubleTap":
                await page.mouse.dblclick(x, y)
            else:
                await page.mouse.click(x, y)
            await settle()
            return True

        async def fill_inputs() -> None:
            # Type what the page needs (a meeting number) as a user would, then close the keyboard.
            for field in config["inputs"].get(routes.node_of(await current()), []):
                await page.click(field["selector"])
                await page.evaluate("(text) => window.__SIM_INPUT__.type(text, { clear: true })", field["text"])
                await settle()
                if await page.evaluate("() => window.__OS__.keyboard?.isVisible?.()"):
                    await page.evaluate("() => window.__OS__.handleBack()")
                    await settle()

        async def reach(path: list[dict], target: str) -> bool:
            for _ in range(3):
                await fresh()
                await fill_inputs()
                for step in path:
                    if not await perform(step):
                        break
                    await fill_inputs()
                if await current() == target:
                    return True
            return False

        async def signature() -> str:
            # What the page offers, tags with their text: tells a host's meeting page (with
            # "结束会议") from a guest's at one URL. instancesPerRoute bounds how many count.
            return "\n".join(sorted(f"{it['kind']}|{it['id']}|{it['gesture']}|{routes.discrete(it)}|{it['text']}"
                                     for it in await page.evaluate(LIST_JS)))

        await page.goto(url)
        await page.wait_for_function("() => window.__SIM__?.matchRoute", timeout=60000)
        table = await page.evaluate(f"() => window.__SIM__.getRouteTable('{app}')")
        if not table:
            raise SystemExit(f"{app} has no route table")
        routes = Routes(table)

        await fresh()
        start = await current()
        start_key = f"{start}\n{await signature()}"
        # An instance is a URL plus what it shows; each is reached again by its taps.
        pages: dict[str, tuple[str, list[dict]]] = {start_key: (start, [])}
        instances: dict[str, list[str]] = {routes.node_of(start): [start]}
        queue = deque([start_key])
        edges: dict[str, dict] = {}
        actions: dict[str, set[str]] = {}
        unreachable: list[str] = []

        while queue:
            page_url, path = pages[queue.popleft()]
            src = routes.node_of(page_url)
            if not await reach(path, page_url):
                unreachable.append(page_url)
                continue
            # Pick at most tapsPerGroup controls of each tag (the photos of a grid are one
            # group), preferred params first.
            groups: dict[str, list[dict]] = {}
            seen_tags: dict[tuple, int] = {}
            for it in await page.evaluate(LIST_JS):
                tag = (it["kind"], it["id"], it["gesture"], it["params"])
                nth = seen_tags.get(tag, 0)
                seen_tags[tag] = nth + 1
                if it["kind"] == "action":
                    actions.setdefault(src, set()).add(it["id"])
                if it["id"] in config["skip"]:
                    continue
                group = f"{it['kind']}|{it['id']}|{it['gesture']}|{routes.discrete(it)}"
                groups.setdefault(group, []).append({"kind": it["kind"], "id": it["id"], "gesture": it["gesture"],
                                                     "params": it["params"], "nth": nth, "text": it["text"]})
            chosen: list[tuple[str, dict]] = []
            for group, items in groups.items():
                wanted = config["prefer"].get(items[0]["id"], [])
                params = [json.loads(s["params"] or "{}") for s in items]
                rank = [next((n for n, w in enumerate(wanted) if all(str(p.get(k)) == str(v) for k, v in w.items())), len(wanted))
                        for p in params]
                order = sorted(range(len(items)), key=lambda n: rank[n])
                chosen += [(group, items[n]) for n in order[:config["tapsPerGroup"]]]

            first = True
            for group, step in chosen:
                key = f"{src} :: {group}"
                edge = edges.setdefault(key, {"source": src, "kind": step["kind"], "id": step["id"],
                                              "gesture": step["gesture"], "state": group.rsplit("|", 1)[1],
                                              "labels": [], "results": []})
                if step["text"] and step["text"] not in edge["labels"]:
                    edge["labels"].append(step["text"])
                # Every tap starts from fresh data: an earlier tap may have changed it and come back.
                if not first and not await reach(path, page_url):
                    edge["results"].append({"from": page_url, "result": "SOURCE_LOST"})
                    continue
                first = False
                _, depth_before, activities_before = await where()
                if not await perform(step):
                    edge["results"].append({"from": page_url, "result": "COVERED"})
                    continue
                after, depth_after, activities_after = await where()
                landed_sig = await signature() if after != "HOME" else ""
                if step["kind"] == "back":
                    mode = "back"
                elif after == "HOME":
                    mode = "exit"
                elif (activities_after or 0) > (activities_before or 0):
                    mode = "activity"
                elif depth_before is None or depth_after is None:
                    mode = "unknown"
                else:
                    mode = ("push" if depth_after > depth_before else "pop" if depth_after < depth_before
                            else "replace" if after != page_url else "none")
                # A page that opens the keyboard: the first back only closes it, as on a phone.
                presses = 2 if await page.evaluate("() => window.__OS__.keyboard?.isVisible?.()") else 1
                for _ in range(presses):
                    await page.evaluate("() => window.__OS__.handleBack()")
                    await settle()
                back = await current()
                edge["results"].append({"from": page_url, "to": after, "back": back, "mode": mode})
                landed = f"{after}\n{landed_sig}"
                node = routes.node_of(after)
                if after != "HOME" and landed not in pages and len(pages) < max_pages:
                    if len(instances.setdefault(node, [])) < config["instancesPerRoute"]:
                        instances[node].append(after)
                        pages[landed] = (after, path + [{k: v for k, v in step.items() if k != "text"}])
                        queue.append(landed)
        await browser.close()

    # Merge each edge's taps: where they land, as nodes.
    def one(values: set):
        values = sorted(values)
        return values[0] if len(values) == 1 else values

    out_edges = []
    for e in edges.values():
        done = [r for r in e["results"] if "to" in r]
        out_edges.append({
            "source": e["source"], "target": one({routes.node_of(r["to"]) for r in done}),
            "kind": e["kind"], "id": e["id"], "gesture": e["gesture"], "state": e["state"],
            "mode": one({r["mode"] for r in done}), "back": one({routes.node_of(r["back"]) for r in done}),
            "labels": e["labels"], "taps": len(e["results"]),
            "covered": sum(1 for r in e["results"] if r.get("result") == "COVERED"),
            "lost": sum(1 for r in e["results"] if r.get("result") == "SOURCE_LOST"),
        })

    reached = set(instances)
    nodes = [{"id": n, "description": routes.describe(n), "instances": instances[n],
              "actions": sorted(actions.get(n, []))} for n in instances]
    start_node = routes.node_of(start)
    return {
        "app": app,
        "config": config,
        "start": start_node,
        "nodes": nodes,
        "edges": out_edges,
        "unreached": routes.unreached(reached),
        "unmatched": sorted(n for n in reached if n.startswith("UNMATCHED:")),
        "unreachable": unreachable,
        "tasks": action_tasks(app, start_node, nodes, out_edges),
    }


def action_tasks(app: str, start: str, nodes: list[dict], edges: list[dict]) -> list[dict]:
    """For every action, the shortest tap path from the start page to the page that has it."""
    graph: dict[str, list[tuple[str, str]]] = {}
    for e in edges:
        if e["kind"] == "back":
            continue
        for target in e["target"] if isinstance(e["target"], list) else [e["target"]]:
            if target not in (e["source"], "HOME"):
                graph.setdefault(e["source"], []).append((target, e["id"]))
    prev: dict[str, tuple[str, str] | None] = {start: None}
    queue = deque([start])
    while queue:
        n = queue.popleft()
        for target, via in graph.get(n, []):
            if target not in prev:
                prev[target] = (n, via)
                queue.append(target)
    # An action visible on several pages (a toggle behind a dialog) belongs to the nearest one.
    tasks: dict[str, dict] = {}
    for node in nodes:
        if node["id"] not in prev:
            continue
        trail, transitions, n = [node["id"]], [], node["id"]
        while prev[n]:
            n, via = prev[n]
            trail.insert(0, n)
            transitions.insert(0, via)
        for action in node["actions"]:
            if action not in tasks or len(transitions) < tasks[action]["shortestLength"]:
                tasks[action] = {"taskId": f"{app}:{action}", "target": node["id"], "shortestLength": len(transitions),
                                 "trajectory": {"nodes": trail, "transitions": transitions}}
    return sorted(tasks.values(), key=lambda t: t["taskId"])


def diff(old_path: str, new_path: str) -> int:
    old, new = json.load(open(old_path)), json.load(open(new_path))
    changed = False
    old_nodes, new_nodes = {n["id"] for n in old["nodes"]}, {n["id"] for n in new["nodes"]}
    print("nodes:", len(old_nodes), "vs", len(new_nodes),
          "| only old:", sorted(old_nodes - new_nodes), "| only new:", sorted(new_nodes - old_nodes))
    changed |= old_nodes != new_nodes
    for field in ("unreached", "unmatched", "unreachable"):
        if sorted(old.get(field, [])) != sorted(new.get(field, [])):
            print(f"{field}: old {old.get(field)} | new {new.get(field)}")
            changed = True

    def keyed(g: dict) -> dict:
        return {f"{e['source']} :: {e['kind']}|{e['id']}|{e['gesture']}|{e['state']}":
                (e["target"], e["back"], e["mode"], e.get("covered", 0), e.get("lost", 0)) for e in g["edges"]}

    a, b = keyed(old), keyed(new)
    keys = sorted(set(a) | set(b))
    diffs = [k for k in keys if a.get(k) != b.get(k)]
    print("edges:", len(a), "vs", len(b), "| same:", len(keys) - len(diffs), "| (target, back, mode, covered, lost)")
    for k in diffs:
        print("DIFF", k, "| old:", a.get(k), "| new:", b.get(k))
    return 1 if changed or diffs else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("args", nargs="+", help="URL APP OUT.json, or --diff OLD.json NEW.json")
    ap.add_argument("--diff", action="store_true")
    ap.add_argument("--instances", type=int, help="instances visited per node (config: instancesPerRoute)")
    ap.add_argument("--taps-per-group", type=int, help="controls tapped per tag on a page (config: tapsPerGroup)")
    ap.add_argument("--max-pages", type=int, default=400, help="safety cap on page instances visited")
    ap.add_argument("--wait-ms", type=int, default=300)
    ap.add_argument("--sim-time", default="2026-10-30T21:31:00", help="frozen simulated time for every reload")
    a = ap.parse_args()
    if a.diff:
        return diff(*a.args)
    url, app, out = a.args
    graph = asyncio.run(explore(url, app, load_config(app, a), a.max_pages, a.wait_ms, a.sim_time))
    json.dump(graph, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"{len(graph['nodes'])} nodes {len(graph['edges'])} edges {len(graph['tasks'])} action tasks -> {out}")
    for field in ("unreached", "unmatched", "unreachable"):
        if graph[field]:
            print(f"{field}: {graph[field]}")
    lost = [f"{e['source']} {e['id']}" for e in graph["edges"] if e["lost"]]
    if lost:
        print(f"not tested (page could not be reached again): {lost}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
