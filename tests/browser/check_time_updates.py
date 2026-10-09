"""Verify actual React/canvas output in Chromium, without mocking the components.

Start Vite from the repository root:
    ./node_modules/.bin/vite --config tests/browser/vite.config.mjs --port 4310
Run with the benchmark Python environment (Playwright) and installed Chrome:
    python tests/browser/check_time_updates.py --url http://127.0.0.1:4310 --case wmr
Use --case clock for the useClockDate fixture. Evidence goes to --artifacts.
"""

import argparse
import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright


async def verify(args):
    evidence = args.artifacts
    evidence.mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel=args.browser_channel, headless=True)
        context = await browser.new_context(timezone_id="Asia/Shanghai")

        async def load(fixture):
            page = await context.new_page()
            await page.goto(args.url.rstrip("/") + "/tests/browser/" + fixture)
            return page

        async def delayed_command():
            page = await load("wmrTiming.html?mode=wake")
            await page.wait_for_function("window.__wmrTimingReview?.samples.length > 0")
            # The fixture issues a real delayed command after 20 seconds. A
            # static widget must redraw now, before its next minute refresh.
            await page.wait_for_timeout(20_500)
            data = await page.evaluate("""() => ({
                samples: window.__wmrTimingReview.samples,
                refreshes: window.__wmrTimingReview.refreshes,
            })""")
            observed = data["samples"][-1]["text"]
            await page.screenshot(path=str(evidence / f"wake-{args.label}.png"))
            return {"case": "delayed-command", "expected": "value=2",
                    "observed": observed, "passed": observed == "value=2", **data}

        async def minute_boundary():
            page = await load("wmrTiming.html?mode=boundary")
            await page.wait_for_function("window.__wmrTimingReview?.samples.length > 0")
            await page.evaluate("""() => {
                const review = window.__wmrTimingReview;
                review.samples = [];
                review.refreshes = [];
                // Actual synchronous work, measured on the real browser clock.
                review.work = () => {
                    const until = performance.now() + 50;
                    while (performance.now() < until) {}
                };
                review.TimeService.useSimulatedTime('2026-10-06 09:00:59.500', true);
            }""")
            await page.wait_for_timeout(1200)
            data = await page.evaluate("""() => ({
                samples: window.__wmrTimingReview.samples,
                refreshes: window.__wmrTimingReview.refreshes,
                actual: window.__wmrTimingReview.TimeService.formatTime(),
            })""")
            observed = data["samples"][-1]["text"]
            await page.screenshot(path=str(evidence / f"boundary-{args.label}.png"))
            return {"case": "minute-boundary-50ms-work", "expected": "minute=1",
                    "observed": observed, "passed": observed == "minute=1", **data}

        async def accelerated_clock():
            page = await load("clockTiming.html")
            await page.wait_for_selector("#clock")
            await page.wait_for_timeout(3200)
            data = await page.evaluate("""() => ({
                observed: document.querySelector('#clock').textContent,
                actual: window.__clockTimingReview.TimeService.formatTime().replace(/^0/, ''),
            })""")
            await page.screenshot(path=str(evidence / f"clock-{args.label}.png"))
            return {"case": "speed-10-clock", "expected": data["actual"],
                    "passed": data["observed"] == data["actual"], **data}

        cases = [delayed_command(), minute_boundary()] if args.case == "wmr" else [accelerated_clock()]
        try:
            results = await asyncio.gather(*cases)
        finally:
            await browser.close()

    for result in results:
        print(json.dumps(result, ensure_ascii=False), flush=True)
    (evidence / f"browser-{args.label}.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return all(result["passed"] for result in results)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--case", choices=["wmr", "clock"], required=True)
    parser.add_argument("--label", default="verified")
    parser.add_argument("--browser-channel", default="chrome")
    parser.add_argument("--artifacts", type=Path, default=Path("/tmp/mobilegym-timing-evidence"))
    raise SystemExit(0 if asyncio.run(verify(parser.parse_args())) else 1)
