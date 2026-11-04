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
- `instancesPerNode`: the same cap for single nodes (`{"/note/:id": 4}`: the
  trashed note's editor, reached only after two ordinary notes, has other menus).
- `tapsPerGroup` (default 2): how many controls with the same tag (the photos
  of a grid) are tapped on one page.
- `skip`: trigger / action ids never tapped.
- `slow`: per trigger / action id, ms to wait after the tap for a control
  that answers after a delay of its own (an order "processing" for a second).
- `prefer`: per trigger id, params to tap first, for controls that only some
  instances show (`{"nav.historyDetail": [{"meetingId": "222 333 444"}]}` opens
  a meeting the user hosted, whose page has the attendee list).
- `setup`: per node, steps run on arriving there, as a user would: `{"type":
  text, "into": selector}`, `{"tap": selector}` (Playwright selectors), `{"wait":
  ms}` (a list that appears after a fake search), `{"hideKeyboard": true}` (a
  page that focuses its text box on open), `{"enter": true}` (submit a search),
  `{"typeEval": js, "into": selector}`
  (text computed in the page: the code in the latest SMS) and `{"setState":
  patch}` (data one variant needs: password-free payment switched on). A list of such lists gives
  variants, each explored as its own instance (search for a contact, search
  for a feature).
- `seed`: a `__SIM__.setState` patch applied after every reset, for data the
  default state lacks (a subscription to open, a blacklisted friend).
- `entries`: pages other apps open directly, explored as extra starting pages:
  a path (`__OS__.openApp(app, path)`, a notification) or `{"from": appId,
  "intent": {...}}` (`__OS__.startActivityForResult` from that app's task:
  12306 paying through the Alipay cashier) or `{"setState": patch}` (the app
  in another starting state: signed out, it opens on its login page).

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

Every tap starts from a full page reload. Against `vite dev` that reload asks
for hundreds of unbundled modules, so more than a couple of explorers at once
overload it (late data, lost pages). For many apps in parallel, explore a build
behind the nginx gateway: `scripts/explore_apps.sh OUT_DIR app...` (the explorer
accepts the gateway's self-signed certificate).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import shutil
import sys
import time
import weakref
from collections import deque
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

from playwright.async_api import async_playwright

CONFIG_DIR = Path(__file__).parent / "explore_config"


def stamp() -> str:
    return time.strftime("%H:%M:%S")


def shm_launch_args() -> dict:
    """Let Chromium keep shared memory in /dev/shm when it is big enough.

    Playwright passes --disable-dev-shm-usage (for Docker's 64 MB /dev/shm), which
    moves Chromium's shared memory files to /tmp. Many browsers starting at once can
    fill a small /tmp disk; every renderer on the machine then fails to map shared
    memory and dies in the same second (SIGTRAP).
    """
    try:
        if shutil.disk_usage("/dev/shm").total >= 4 << 30:
            return {"ignore_default_args": ["--disable-dev-shm-usage"]}
    except OSError:
        pass
    return {}


CRASHED: "weakref.WeakSet" = weakref.WeakSet()


def visible_selector(target: str) -> str:
    m = re.fullmatch(r"(.*?)\s*>>\s*nth=(-?\d+)", target)
    return f"{m.group(1)} >> visible=true >> nth={m.group(2)}" if m else f"{target} >> visible=true"


def watch(page):
    """Log a renderer crash and close the page, so calls waiting on it fail instead of hanging."""
    async def close() -> None:
        try:
            await page.close()
        except Exception:
            pass

    def crashed(_):
        CRASHED.add(page)
        print(f"[{stamp()}] page crashed", file=sys.stderr, flush=True)
        asyncio.ensure_future(close())
    page.on("crash", crashed)
    return page

# Visible tagged controls, in DOM order: what an agent could tap on this screen.
# checkVisibility, not offsetParent: an <svg> icon or a fixed bar has no offsetParent.
LIST_JS = """() => {
  const els = [...document.querySelectorAll('[data-trigger],[data-action]')]
    .filter(e => e.checkVisibility({ visibilityProperty: true }) && e.getBoundingClientRect().width > 0);
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
  // One entry per tag: an avatar can open a profile on tap and pat on double-tap.
  return els.flatMap((e, i) => {
    const out = [];
    const trigger = e.getAttribute('data-trigger');
    const action = e.getAttribute('data-action');
    if (trigger) out.push({
      i, kind: trigger === 'system.back' ? 'back' : 'nav', id: trigger,
      gesture: e.getAttribute('data-trigger-type') || 'tap',
      params: e.getAttribute('data-trigger-params') || '', text: label(e),
    });
    if (action) out.push({
      i, kind: 'action', id: action,
      gesture: e.getAttribute('data-action-type') || 'tap',
      params: e.getAttribute('data-action-params') || '', text: label(e),
    });
    return out;
  });
}"""

# Bring the control to the middle of the screen and return its centre if a tap
# there would hit it (not an overlay, dialog backdrop or drawer above it).
LOCATE_JS = """(i) => {
  const els = [...document.querySelectorAll('[data-trigger],[data-action]')]
    .filter(e => e.checkVisibility({ visibilityProperty: true }) && e.getBoundingClientRect().width > 0);
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


def same_state(a: str, b: str) -> bool:
    """Two query states with the same key=value pairs, in any order."""
    return sorted(p for p in a.split("&") if p) == sorted(p for p in b.split("&") if p)


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
                reached_states = [n.partition("?")[2] for n in nodes]
                missing += [f"{r['path']}?{s}" for s in r["states"] if not any(same_state(s, x) for x in reached_states)]
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
            return next((d for s, d in (route.get("states") or {}).items() if same_state(s, state)), None)
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
    config.setdefault("slow", {})
    config.setdefault("prefer", {})
    config.setdefault("instancesPerNode", {})
    config.setdefault("setup", {})
    config.setdefault("seed", None)
    config.setdefault("entries", [])
    return config


def variants(spec) -> list[list[dict]]:
    """A node's setup as a list of variants (a single list of steps is one variant)."""
    if not spec:
        return []
    return [spec] if isinstance(spec[0], dict) else spec


class Device:
    """One simulator page (its own browser context, so its own device session)."""

    def __init__(self, page, url: str, app: str, config: dict, routes: "Routes | None", wait_ms: int):
        self.page, self.url, self.app, self.config, self.routes, self.wait_ms = page, url, app, config, routes, wait_ms
        self.setup_errors: set[str] = set()
        # The URL of the page on top (the top activity of the active task, so a cashier
        # started over the app counts), or HOME once system back has left the app; with
        # that activity's history depth and the task's activity count.
        self.where_js = f"""() => {{
          const s = window.__OS__.state;
          if (s?.activeAppId !== '{app}') return null;
          const task = s.tasks.find(t => t.taskId === s.activeTaskId);
          const top = task?.stack[task.stack.length - 1];
          const route = (top && window.__OS__.getActivityRoute(top.activityId)) || window.__OS__.getAppRoute('{app}');
          return {{ path: route?.path, depth: route?.depth, activities: task?.stack.length, top: top?.activityId }};
        }}"""

    async def settle(self) -> None:
        # Like the benchmark: wait until the screen has caught up with the last input.
        await self.page.wait_for_timeout(self.wait_ms)
        await self.page.evaluate("() => window.__SIM__.waitForIdle({ timeoutMs: 5000 })")

    async def fresh(self) -> None:
        # Start from the initial data every time: taps change it (cancel a
        # meeting, leave a call), which would break the recorded paths.
        page = self.page
        await page.evaluate("() => window.__SIM__?.resetState?.()")
        await page.goto(self.url)
        await page.wait_for_function("() => window.__OS__?.openApp", timeout=60000)
        await page.wait_for_timeout(800)
        if self.config["seed"]:
            # Data the default state lacks (a subscription, a blacklisted friend), as the benchmark injects it.
            await page.evaluate("(patch) => window.__SIM__.setState(patch, { deep: true, reload: false })", self.config["seed"])
        await page.evaluate(f"() => window.__OS__.openApp('{self.app}')")
        await page.wait_for_function(f"() => window.__OS__.state?.activeAppId === '{self.app}'", timeout=10000)
        await self.settle()

    async def where(self) -> tuple[str, int | None, tuple[int, str] | None]:
        """URL on top, its history depth, and (activity count, top activity id)."""
        info = await self.page.evaluate(self.where_js)
        if not info:
            return "HOME", None, None
        path = urlsplit(info["path"]).path
        if path not in self.routes.name_of_path:
            self.routes.name_of_path[path] = await self.page.evaluate(
                "([app, path]) => window.__SIM__.matchRoute(app, path)", [self.app, path])
        return info["path"], info.get("depth"), (info.get("activities") or 0, info.get("top") or "")

    async def current(self) -> str:
        return (await self.where())[0]

    async def controls(self) -> list[dict]:
        return await self.page.evaluate(LIST_JS)

    async def find(self, step: dict) -> dict | None:
        # The nth control with this exact tag: stable across reloads, unlike its text.
        same = [it for it in await self.controls()
                if (it["kind"], it["id"], it["gesture"], it["params"]) == (step["kind"], step["id"], step["gesture"], step["params"])]
        return same[step["nth"]] if step["nth"] < len(same) else None

    async def perform(self, step: dict, patience_ms: int = 3000) -> bool:
        # Wait for the control to render and settle (a page still animating in
        # has it under the old page), then tap it where an agent would.
        page, point = self.page, None
        if "entry" in step:
            # Opened from outside the app: a path (a notification, a deep link) or an
            # intent with its payload (another app paying through the cashier).
            entry = step["entry"]
            if isinstance(entry, str):
                await page.evaluate("([app, path]) => window.__OS__.openApp(app, path)", [self.app, entry])
            elif "setState" in entry:
                # The app in another starting state (signed out): its guard routes to where it starts then.
                await page.evaluate("(patch) => window.__SIM__.setState(patch, { deep: true, reload: false })", entry["setState"])
            else:
                # Sent from the caller app's task, as on a phone (12306 paying through Alipay).
                await page.evaluate("(app) => window.__OS__.openApp(app)", entry["from"])
                await self.settle()
                await page.evaluate("([app, intent]) => window.__OS__.startActivityForResult(app, intent, () => {})",
                                    [self.app, entry["intent"]])
            await self.settle()
            return True
        for _ in range(max(1, patience_ms // 200)):
            item = await self.find(step)
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
            # Well past every long-press threshold in the apps (up to 1 s), so it never races.
            await page.wait_for_timeout(1500)
            await page.mouse.up()
        elif step["gesture"] == "doubleTap":
            await page.mouse.dblclick(x, y)
        else:
            await page.mouse.click(x, y)
        # A control that answers after a delay of its own (a "processing" spinner), not caught by waitForIdle.
        await page.wait_for_timeout(self.config["slow"].get(step["id"], 0))
        await self.settle()
        return True

    async def setup(self, variant: int) -> bool:
        """Run the page's setup steps (type a meeting number, tick a box, wait for a list) as a user would.

        False when a step's element is missing: the config no longer fits the page.
        """
        node = self.routes.node_of(await self.current())
        steps = variants(self.config["setup"].get(node))
        for step in steps[variant] if variant < len(steps) else []:
            try:
                await self.setup_step(step)
            except Exception:
                self.setup_errors.add(f"{node}: {json.dumps(step, ensure_ascii=False)}")
                return False
        return True

    async def setup_step(self, step: dict) -> None:
        target = step.get("into") or step.get("tap")
        # Visible matches only: pages kept on the back stack underneath have the same inputs,
        # hidden. A trailing `>> nth=K` counts among the visible ones.
        element = self.page.locator(visible_selector(target)).first if target else None
        if element:
            await element.wait_for(state="visible", timeout=5000)
        if "wait" in step:
            await self.page.wait_for_timeout(step["wait"])
        elif "setState" in step:
            # Data this variant of the page needs (password-free payment switched on).
            await self.page.evaluate("(patch) => window.__SIM__.setState(patch, { deep: true, reload: false })", step["setState"])
        elif "enter" in step:
            await self.page.evaluate("() => window.__SIM_INPUT__.enter()")
        elif "hideKeyboard" in step:
            if await self.page.evaluate("() => window.__OS__.keyboard?.isVisible?.()"):
                await self.page.evaluate("() => window.__OS__.handleBack()")
        elif "type" in step or "typeEval" in step:
            # typeEval: text computed in the page, such as the code in the latest SMS.
            text = step["type"] if "type" in step else await self.page.evaluate(step["typeEval"])
            await element.click(timeout=5000)
            await self.page.evaluate("(text) => window.__SIM_INPUT__.type(text, { clear: true })", text)
            await self.settle()
            if await self.page.evaluate("() => window.__OS__.keyboard?.isVisible?.()"):
                await self.page.evaluate("() => window.__OS__.handleBack()")
        else:
            await element.click(timeout=5000)
        await self.settle()

    async def reach(self, path: list[dict], target: str, variant: int) -> str | None:
        """Open the page again by its taps and run its setup; the URL it then shows, or None.

        Setup may change the URL (a typed keyword lands in `?q=`), so arrival is
        checked before it.
        """
        for _ in range(3):
            await self.fresh()
            # A setup step that does not fit this instance (no search box on a results
            # page) is reported in setupErrors; the page is explored as it is.
            for step in path:
                await self.setup(step.get("variant", 0))
                if not await self.perform(step):
                    break
            else:
                if await self.current() == target:
                    await self.setup(variant)
                    return await self.current()
        return None

    async def signature(self) -> str:
        # What the page offers, tags with their text: tells a host's meeting page (with
        # "结束会议") from a guest's at one URL. instancesPerRoute bounds how many count.
        return "\n".join(sorted(f"{it['kind']}|{it['id']}|{it['gesture']}|{self.routes.discrete(it)}|{it['text']}"
                                 for it in await self.controls()))

    async def tap(self, page_url: str, path: list[dict], variant: int, step: dict) -> dict:
        """Tap one control from a fresh copy of its page; where it lands and where back goes."""
        start = await self.reach(path, page_url, variant)
        if start is None:
            return {"from": page_url, "result": "SOURCE_LOST"}
        _, depth_before, activities_before = await self.where()
        if not await self.perform(step):
            return {"from": page_url, "result": "COVERED"}
        after, depth_after, activities_after = await self.where()
        landed_sig = await self.signature() if after != "HOME" else ""
        if step["kind"] == "back":
            mode = "back"
        elif after == "HOME":
            mode = "exit"
        elif activities_after != activities_before:
            # Another activity is on top: depths of two routers do not compare.
            mode = "finish" if activities_after and activities_before and activities_after[0] < activities_before[0] \
                else "activity"
        elif depth_before is None or depth_after is None:
            mode = "unknown"
        else:
            mode = ("push" if depth_after > depth_before else "pop" if depth_after < depth_before
                    else "replace" if after != start else "none")
        # A page that opens the keyboard: the first back only closes it, as on a phone.
        presses = 2 if await self.page.evaluate("() => window.__OS__.keyboard?.isVisible?.()") else 1
        for _ in range(presses):
            await self.page.evaluate("() => window.__OS__.handleBack()")
            await self.settle()
        return {"from": start, "to": after, "back": await self.current(), "mode": mode, "sig": landed_sig}


async def explore(url: str, app: str, config: dict, max_pages: int, wait_ms: int, sim_time: str, workers: int) -> dict:
    # Frozen simulated time: labels such as "in 5 min" stay the same across the reloads.
    url = url + ("&" if "?" in url else "?") + f"simTime={sim_time}&simTimeFlowing=0"
    async with async_playwright() as p:
        # The nginx gateway serves HTTPS with a self-signed certificate.
        browser = await p.chromium.launch(headless=True, args=["--ignore-certificate-errors"], **shm_launch_args())
        # A crash names its time, so crashes across explorers can be lined up with system logs.
        closing = False
        browser.on("disconnected", lambda _: closing or print(f"[{stamp()}] browser disconnected", file=sys.stderr, flush=True))
        # How a renderer died: termination status and exit code / signal number.
        cdp = await browser.new_browser_cdp_session()
        cdp.on("Target.targetCrashed", lambda e: print(
            f"[{stamp()}] renderer died: status={e.get('status')} code={e.get('errorCode')}", file=sys.stderr, flush=True))
        await cdp.send("Target.setDiscoverTargets", {"discover": True})
        devices = []
        for _ in range(workers):
            context = await browser.new_context(viewport={"width": 360, "height": 800}, ignore_https_errors=True)
            devices.append(Device(watch(await context.new_page()), url, app, config, None, wait_ms))

        first = devices[0]
        await first.page.goto(url)
        await first.page.wait_for_function("() => window.__SIM__?.matchRoute", timeout=60000)
        table = await first.page.evaluate(f"() => window.__SIM__.getRouteTable('{app}')")
        if not table:
            raise SystemExit(f"{app} has no route table")
        routes = Routes(table)
        for d in devices:
            d.routes = routes

        async def run_all(jobs: list, work) -> list:
            # Spread jobs over the devices; results come back in job order, so the
            # graph does not depend on which device finished first.
            results: list = [None] * len(jobs)
            queue: asyncio.Queue[int] = asyncio.Queue()
            for n in range(len(jobs)):
                queue.put_nowait(n)

            async def worker(device: Device) -> None:
                while not queue.empty():
                    n = queue.get_nowait()
                    for attempt in range(3):
                        setup_errors = set(device.setup_errors)
                        try:
                            results[n] = await work(device, jobs[n])
                            break
                        except Exception as error:
                            # A crashed renderer: the job starts from a reset anyway, so redo it on a new page.
                            lost = device.page
                            if not (lost in CRASHED or lost.is_closed()) or attempt == 2:
                                raise
                            print(f"[{stamp()}] page lost ({type(error).__name__}), job redone on a new page",
                                  file=sys.stderr, flush=True)
                            try:
                                await lost.close()
                            except Exception:
                                pass
                            # The failed attempt's setup errors and data must not leak into the retry:
                            # the new page shares the context's storage, so reset the simulator on it first.
                            device.setup_errors = setup_errors
                            device.page = watch(await lost.context.new_page())
                            await device.page.goto(device.url)
                            await device.page.wait_for_function("() => window.__SIM__?.resetState", timeout=60000)
                            await device.page.evaluate("() => window.__SIM__.resetState()")

            await asyncio.gather(*(worker(d) for d in devices))
            return results

        async def look(device: Device, key: str):
            page_url, path, variant = pages[key]
            shown = await device.reach(path, page_url, variant)
            if shown is None:
                return None
            # The page its setup leaves (a typed keyword opens the results): its controls are that page's.
            return shown, await device.controls()

        await first.fresh()
        start = await first.current()
        start_landed = f"{start}\n{await first.signature()}"
        # An instance is a URL plus what it shows, and a setup variant; each is reached
        # again by its taps.
        pages: dict[str, tuple[str, list[dict], int]] = {}
        instances: dict[str, list[str]] = {}

        def admit(landed: str, url: str, path: list[dict]) -> list[str]:
            """Take a newly landed page, one entry per setup variant, within the caps."""
            node, keys = routes.node_of(url), []
            for v in range(max(1, len(variants(config["setup"].get(node))))):
                key = f"{landed}\n#{v}"
                if key in pages or len(pages) >= max_pages \
                        or len(instances.setdefault(node, [])) >= config["instancesPerNode"].get(node, config["instancesPerRoute"]):
                    continue
                instances[node].append(url)
                pages[key] = (url, path, v)
                keys.append(key)
            return keys

        start_keys = admit(start_landed, start, [])
        # Pages other apps open directly (a cashier for a payment), explored as extra starts.
        entry_nodes: list[tuple[str, str]] = []
        for entry in config["entries"]:
            step = {"entry": entry}
            await first.fresh()
            await first.perform(step)
            url = await first.current()
            if url != "HOME":
                entry_nodes.append((routes.node_of(url), json.dumps(entry, ensure_ascii=False)))
                start_keys += admit(f"{url}\n{await first.signature()}", url, [step])
        edges: dict[str, dict] = {}
        actions: dict[str, set[str]] = {}
        unreachable: list[str] = []
        # Setup that leaves its page (a typed keyword opens the results): node -> node it shows.
        setup_links: set[tuple[str, str, int]] = set()
        # Pages only setup shows: listed as reached, but not counted against the instance caps.
        setup_shown: dict[str, list[str]] = {}

        # Breadth first, one level at a time: the pages of a level are looked at and their
        # controls tapped in parallel, then the new pages are taken in a fixed order.
        level = start_keys
        while level:
            jobs = []
            for key, looked in zip(level, await run_all(level, look)):
                page_url, path, variant = pages[key]
                if looked is None:
                    unreachable.append(page_url)
                    continue
                shown, listing = looked
                src = routes.node_of(shown)
                if src != routes.node_of(page_url):
                    setup_links.add((routes.node_of(page_url), src, variant))
                    if shown not in setup_shown.setdefault(src, []):
                        setup_shown[src].append(shown)
                # Pick at most tapsPerGroup controls of each tag (the photos of a grid are one
                # group), preferred params first.
                groups: dict[str, list[dict]] = {}
                seen_tags: dict[tuple, int] = {}
                for it in listing:
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
                for group, items in groups.items():
                    wanted = config["prefer"].get(items[0]["id"], [])
                    params = [json.loads(s["params"] or "{}") for s in items]
                    rank = [next((n for n, w in enumerate(wanted) if all(str(p.get(k)) == str(v) for k, v in w.items())), len(wanted))
                            for p in params]
                    for n in sorted(range(len(items)), key=lambda n: rank[n])[:config["tapsPerGroup"]]:
                        jobs.append((key, src, group, items[n]))

            results = await run_all(jobs, lambda device, job: device.tap(*pages[job[0]], job[3]))
            level = []
            for (key, src, group, step), result in zip(jobs, results):
                page_url, path, variant = pages[key]
                edge = edges.setdefault(f"{src} :: {group}", {
                    "source": src, "kind": step["kind"], "id": step["id"], "gesture": step["gesture"],
                    "state": group.rsplit("|", 1)[1], "labels": [], "results": []})
                if step["text"] and step["text"] not in edge["labels"]:
                    edge["labels"].append(step["text"])
                landed_sig = result.pop("sig", "")
                edge["results"].append(result)
                after = result.get("to")
                if not after or after == "HOME":
                    continue
                taken = {k: v for k, v in step.items() if k != "text"} | {"variant": variant}
                level += admit(f"{after}\n{landed_sig}", after, path + [taken])
        closing = True
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

    for origin, shown, variant in sorted(setup_links):
        out_edges.append({
            "source": origin, "target": shown, "kind": "setup", "id": f"setup#{variant}", "gesture": "setup",
            "state": "", "mode": "setup", "back": None, "labels": [], "taps": 0, "covered": 0, "lost": 0,
        })

    for n, urls in setup_shown.items():
        instances.setdefault(n, []).extend(u for u in urls if u not in instances[n])
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
        "setupErrors": sorted({e for d in devices for e in d.setup_errors}),
        "entries": [{"node": n, "entry": e} for n, e in entry_nodes],
        "tasks": action_tasks(app, start_node, nodes, out_edges, entry_nodes),
    }


def action_tasks(app: str, start: str, nodes: list[dict], edges: list[dict],
                 entries: list[tuple[str, str]] = ()) -> list[dict]:
    """For every action, the shortest tap path from the start page to the page that has it.

    A page another app opens (an entry) counts as one step away, through `entry:<how>`.
    """
    graph: dict[str, list[tuple[str, str]]] = {start: [(node, f"entry:{how}") for node, how in entries]}
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
    ap.add_argument("--workers", type=int, default=4, help="simulator pages explored in parallel")
    ap.add_argument("--sim-time", default="2026-10-30T21:31:00", help="frozen simulated time for every reload")
    a = ap.parse_args()
    if a.diff:
        return diff(*a.args)
    url, app, out = a.args
    graph = asyncio.run(explore(url, app, load_config(app, a), a.max_pages, a.wait_ms, a.sim_time, a.workers))
    json.dump(graph, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"{len(graph['nodes'])} nodes {len(graph['edges'])} edges {len(graph['tasks'])} action tasks -> {out}")
    for field in ("unreached", "unmatched", "unreachable", "setupErrors"):
        if graph[field]:
            print(f"{field}: {graph[field]}")
    lost = [f"{e['source']} {e['id']}" for e in graph["edges"] if e["lost"]]
    if lost:
        print(f"not tested (page could not be reached again): {lost}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
