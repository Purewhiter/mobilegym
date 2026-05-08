#!/usr/bin/env python3
"""Test whether IDB-stored Blobs share memory with JS-held references.

Question: if we snapshot Blobs from IDB into a JS Map<string, Blob>, does
holding both copies double our memory footprint, or does the browser
reference-count the underlying binary data?

Method: measure /proc/<pid>/smaps_rollup PSS at four checkpoints, where
the blob exists in different combinations of {IDB, JS-Map}:
  S0: nothing      (baseline)
  S1: IDB only     (one copy in IDB)
  S2: IDB + Map    (snapshot loaded into JS Map, IDB still has it)
  S3: Map only     (deleted from IDB; only JS Map ref alive)
  S4: nothing      (Map cleared too)

If Blob is reference-counted/shared:  S1 ≈ S2 (Map ref doesn't duplicate)
If each get() materializes a copy:    S2 ≈ S1 + blob_size

We use a single browser context launched by Playwright so we can read
its PSS from outside; in-page allocations show up in chromium PSS.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path

import psutil

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


def read_pss_kb(pid: int) -> int | None:
    try:
        with open(f"/proc/{pid}/smaps_rollup") as f:
            for line in f:
                if line.startswith("Pss:"):
                    return int(line.split()[1])
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        return None
    return None


def chromium_descendants_pss(parent_pid: int) -> tuple[int, int]:
    """Return (n_procs, total_pss_mb) of chromium descendants of parent_pid."""
    total_kb = 0
    n = 0
    try:
        root = psutil.Process(parent_pid)
    except psutil.NoSuchProcess:
        return 0, 0
    for p in [root, *root.children(recursive=True)]:
        try:
            name = p.name().lower()
        except psutil.Error:
            continue
        if "chrom" in name or "headless" in name:
            pss = read_pss_kb(p.pid)
            if pss is not None:
                total_kb += pss
                n += 1
    return n, total_kb // 1024


async def measure(label: str, browser_pid: int, settle_s: float = 2.0) -> int:
    """Force GC, wait briefly, read PSS."""
    await asyncio.sleep(settle_s)
    n, mb = chromium_descendants_pss(browser_pid)
    print(f"  {label:24s}  chromium PSS = {mb:>5d} MB  ({n} procs)")
    return mb


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blob-mb", type=int, default=200, help="Total blob payload size (MB)")
    ap.add_argument("--n-blobs", type=int, default=20, help="Split into N blobs")
    ap.add_argument("--settle", type=float, default=3.0, help="Wait between checkpoints (s)")
    args = ap.parse_args()

    blob_size_bytes = args.blob_mb * 1024 * 1024 // args.n_blobs
    total_mb = args.blob_mb

    print(f"\n=== IDB Blob sharing test ===")
    print(f"  config: {args.n_blobs} blobs × {blob_size_bytes // (1024*1024)} MB = {total_mb} MB total\n")

    from playwright.async_api import async_playwright

    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True)

    # Find chromium parent PID by walking psutil: descend from this Python
    # process and pick the topmost chromium-named descendant.
    def find_browser_pid() -> int | None:
        me_pid = psutil.Process().pid
        candidates: list[psutil.Process] = []
        for p in psutil.process_iter(["pid", "ppid", "name"]):
            try:
                name = (p.info["name"] or "").lower()
                if "chrom" not in name and "headless" not in name:
                    continue
                # Walk up to confirm ancestry through this Python process
                cur = p
                for _ in range(8):
                    if cur.ppid() == me_pid:
                        candidates.append(p)
                        break
                    cur = psutil.Process(cur.ppid())
            except psutil.Error:
                continue
        if not candidates:
            return None
        # Pick the candidate with the FEWEST chromium ancestors (i.e., the root)
        def chromium_ancestor_count(p: psutil.Process) -> int:
            n = 0
            cur = p
            try:
                for _ in range(8):
                    cur = psutil.Process(cur.ppid())
                    if "chrom" in cur.name().lower() or "headless" in cur.name().lower():
                        n += 1
                    else:
                        break
            except psutil.Error:
                pass
            return n
        candidates.sort(key=chromium_ancestor_count)
        return candidates[0].pid

    browser_pid = find_browser_pid()
    if browser_pid is None:
        print("FAILED: could not find browser PID")
        await browser.close()
        await pw.stop()
        return
    print(f"  found browser root PID: {browser_pid}")

    context = await browser.new_context()
    page = await context.new_page()
    # IndexedDB is forbidden on opaque origins (about:blank, data:). Intercept
    # all requests to serve a minimal page from a real origin so IDB is allowed.
    async def _route(route):
        await route.fulfill(body="<!doctype html><html><body></body></html>",
                            content_type="text/html")
    await page.route("**/*", _route)
    await page.goto("http://idb-blob-test.local/")

    # Inject a small helper API in-page
    await page.evaluate(
        """
        () => {
            window._test = {
                blobs: null,                     // JS-held Map<id, Blob>
                db: null,
                _open: () => new Promise((resolve, reject) => {
                    const r = indexedDB.open('blob_test', 1);
                    r.onupgradeneeded = () => r.result.createObjectStore('files');
                    r.onsuccess = () => resolve(r.result);
                    r.onerror = () => reject(r.error);
                }),
                _putAll: (db, items) => new Promise((resolve, reject) => {
                    const tx = db.transaction('files', 'readwrite');
                    const s = tx.objectStore('files');
                    for (const [id, blob] of items) s.put(blob, id);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                }),
                _getAll: (db, ids) => new Promise((resolve, reject) => {
                    const tx = db.transaction('files', 'readonly');
                    const s = tx.objectStore('files');
                    const out = [];
                    let pending = ids.length;
                    if (!pending) return resolve(out);
                    ids.forEach((id) => {
                        const r = s.get(id);
                        r.onsuccess = () => { out.push([id, r.result]); if (--pending === 0) resolve(out); };
                        r.onerror = () => reject(r.error);
                    });
                }),
                _clearStore: (db) => new Promise((resolve, reject) => {
                    const tx = db.transaction('files', 'readwrite');
                    const s = tx.objectStore('files');
                    const r = s.clear();
                    r.onsuccess = () => resolve();
                    r.onerror = () => reject(r.error);
                }),
            };
        }
        """
    )

    # Helper to suggest GC (Chromium honors this in headless if --js-flags=--expose-gc;
    # otherwise we just wait, which lets the GC reclaim eventually).
    async def gc_hint():
        try:
            await page.evaluate("() => { if (window.gc) window.gc(); }")
        except Exception:
            pass

    # ── S0: baseline (nothing allocated) ──
    s0 = await measure("S0 baseline", browser_pid, args.settle)

    # ── S1: write N blobs into IDB; do NOT keep JS refs ──
    print(f"\n[step] writing {args.n_blobs} blobs × {blob_size_bytes // (1024*1024)} MB into IDB ...")
    await page.evaluate(
        """async ({n, size}) => {
            window._test.db = await window._test._open();
            const items = [];
            for (let i = 0; i < n; i++) {
                const buf = new Uint8Array(size);
                // touch memory so it's resident, not lazily reserved
                for (let k = 0; k < size; k += 4096) buf[k] = (i + k) & 0xff;
                items.push(['id_' + i, new Blob([buf])]);
            }
            await window._test._putAll(window._test.db, items);
            // drop JS refs
            items.length = 0;
        }""",
        {"n": args.n_blobs, "size": blob_size_bytes},
    )
    await gc_hint()
    s1 = await measure("S1 IDB only", browser_pid, args.settle)

    # ── S2: read all blobs from IDB into JS Map (now: IDB + Map) ──
    print(f"\n[step] reading IDB → JS Map (IDB still has the data) ...")
    await page.evaluate(
        """async ({n}) => {
            const ids = [];
            for (let i = 0; i < n; i++) ids.push('id_' + i);
            const items = await window._test._getAll(window._test.db, ids);
            window._test.blobs = new Map(items);
        }""",
        {"n": args.n_blobs},
    )
    await gc_hint()
    s2 = await measure("S2 IDB + JS Map", browser_pid, args.settle)

    # ── S3: clear IDB but keep JS Map references ──
    print(f"\n[step] clearing IDB; JS Map still holds refs ...")
    await page.evaluate(
        """async () => {
            await window._test._clearStore(window._test.db);
        }"""
    )
    await gc_hint()
    s3 = await measure("S3 Map only", browser_pid, args.settle)

    # ── S4: drop JS Map refs too ──
    print(f"\n[step] dropping JS Map refs ...")
    await page.evaluate("() => { window._test.blobs = null; }")
    await gc_hint()
    s4 = await measure("S4 nothing (cleanup)", browser_pid, args.settle)

    print()
    print(f"=== summary ({total_mb} MB payload) ===")
    print(f"  S0 baseline:       {s0:>5d} MB")
    print(f"  S1 IDB only:       {s1:>5d} MB    (Δ {s1 - s0:+d} MB)")
    print(f"  S2 IDB + Map:      {s2:>5d} MB    (Δ {s2 - s1:+d} MB vs S1)")
    print(f"  S3 Map only:       {s3:>5d} MB    (Δ {s3 - s2:+d} MB vs S2)")
    print(f"  S4 nothing:        {s4:>5d} MB    (Δ {s4 - s0:+d} MB vs S0)")
    print()

    delta_s2_vs_s1 = s2 - s1
    print(f"  → Map snapshot of IDB blobs cost {delta_s2_vs_s1:+d} MB on top of IDB")
    if delta_s2_vs_s1 < total_mb * 0.3:
        print(f"  ✓ SHARED: Map costs <30% of payload, blobs are reference-counted")
    elif delta_s2_vs_s1 < total_mb * 0.7:
        print(f"  ~ PARTIAL: some sharing, some duplication")
    else:
        print(f"  ✗ COPIED: Map adds ~{total_mb} MB, browser materializes a separate copy")

    await context.close()
    await browser.close()
    await pw.stop()


if __name__ == "__main__":
    asyncio.run(main())
