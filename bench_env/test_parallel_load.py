"""Reproduce exact env.reset() flow: goto → resetState → reload → waitForData.

Usage:
    python bench_env/test_parallel_load.py --n 64 --url https://localhost:4180
"""
import asyncio
import argparse
import time
from playwright.async_api import async_playwright


async def worker(wid: int, url: str, results: list):
    t0 = time.monotonic()
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True)
    context = await browser.new_context(viewport={"width": 412, "height": 915}, ignore_https_errors=True)
    page = await context.new_page()
    js_errors = []
    page.on("pageerror", lambda e: js_errors.append(str(e)[:300]))

    status = {"wid": wid}
    try:
        # Step 1: goto (same as pool start)
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        status["goto_ms"] = int((time.monotonic() - t0) * 1000)

        # Step 2: resetState (same as _reset_sim)
        t1 = time.monotonic()
        await page.wait_for_function(
            "() => Boolean(window.__SIM__?.resetState)",
            timeout=60000,
        )
        await page.evaluate("""async () => {
            if (window.__SIM__?.resetState) {
                await window.__SIM__.resetState();
            }
        }""")
        status["reset_ms"] = int((time.monotonic() - t1) * 1000)

        # Step 3: page.reload (same as _reset_sim)
        t2 = time.monotonic()
        await page.reload(wait_until="load", timeout=60000)
        status["reload_ms"] = int((time.monotonic() - t2) * 1000)

        # Step 4: wait for __SIM__ (same as _wait_ready)
        t3 = time.monotonic()
        await page.wait_for_function(
            "() => Boolean(window.__SIM__ && window.__SIM__.getState)",
            timeout=60000,
        )
        status["sim_ms"] = int((time.monotonic() - t3) * 1000)

        # Step 5: waitForData (this is where the error happens)
        t4 = time.monotonic()
        wd = await page.evaluate("""async () => {
            try {
                if (window.__SIM__?.waitForData)
                    await window.__SIM__.waitForData();
                return {ok: true};
            } catch (e) { return {ok: false, error: String(e)}; }
        }""")
        status["waitdata_ms"] = int((time.monotonic() - t4) * 1000)
        status["waitdata_ok"] = wd.get("ok", False)
        if not wd.get("ok"):
            status["waitdata_error"] = wd.get("error", "?")

        status["ok"] = wd.get("ok", False)

    except Exception as e:
        status["error"] = f"{type(e).__name__}: {str(e)[:200]}"
        status["ok"] = False

    status["total_ms"] = int((time.monotonic() - t0) * 1000)
    status["js_errors"] = js_errors[:3] if js_errors else []

    await browser.close()
    await pw.stop()
    results.append(status)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=64)
    parser.add_argument("--url", default="https://localhost:4180")
    args = parser.parse_args()

    print(f"Launching {args.n} browsers: goto → resetState → reload → waitForData")
    results = []
    t0 = time.monotonic()
    await asyncio.gather(*[worker(i, args.url, results) for i in range(args.n)])
    elapsed = time.monotonic() - t0
    results.sort(key=lambda r: r["wid"])

    ok = sum(1 for r in results if r.get("ok"))
    fail = len(results) - ok
    print(f"\n{'='*60}")
    print(f"Done in {elapsed:.1f}s | OK: {ok} | FAIL: {fail}")

    if fail:
        print(f"\n--- FAILURES ---")
        for r in results:
            if not r.get("ok"):
                err = r.get("error", r.get("waitdata_error", "?"))
                print(f"  W{r['wid']}: {err}")
                if r.get("js_errors"):
                    for e in r["js_errors"]:
                        print(f"    JS: {e}")

    goto_t = [r["goto_ms"] for r in results if "goto_ms" in r]
    reload_t = [r["reload_ms"] for r in results if "reload_ms" in r]
    wd_t = [r["waitdata_ms"] for r in results if "waitdata_ms" in r]
    print(f"\n--- TIMING (ms) ---")
    if goto_t:
        print(f"  goto:     avg={sum(goto_t)//len(goto_t)} max={max(goto_t)}")
    if reload_t:
        print(f"  reload:   avg={sum(reload_t)//len(reload_t)} max={max(reload_t)}")
    if wd_t:
        print(f"  waitData: avg={sum(wd_t)//len(wd_t)} max={max(wd_t)}")


if __name__ == "__main__":
    asyncio.run(main())
