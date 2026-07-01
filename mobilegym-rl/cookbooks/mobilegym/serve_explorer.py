#!/usr/bin/env python3
"""
Standalone server that reuses mobilegym's run_explorer.html
to browse rLLM training trajectory logs.

Usage:
    python serve_explorer.py [--port 8765] [--logs-dir path/to/logs]

The training logs have 3-level nesting:
    logs_dir/run_YYYYMMDD_HHMMSS/train_step_N_epoch_M/
        meta.json, summary.json, results.jsonl, trajectory/...

The explorer expects 1- or 2-level run names under /api/runs.
We flatten the 3 levels into 2: <run_date>/<step_name>.
"""

import argparse
import json
import mimetypes
import os
import shutil
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote

def _find_explorer_html() -> Path:
    """Locate public/run_explorer.html by walking up from this file.

    Supports both the sibling layout (mobilegym/ next to mobilegym-rl/) and
    the nested layout (mobilegym-rl/ inside mobilegym/).
    """
    here = Path(__file__).resolve()
    for ancestor in here.parents:
        # sibling layout: <ancestor>/mobilegym/public/run_explorer.html
        candidate = ancestor / "mobilegym" / "public" / "run_explorer.html"
        if candidate.exists():
            return candidate
        # nested layout: <ancestor>/public/run_explorer.html
        candidate = ancestor / "public" / "run_explorer.html"
        if candidate.exists():
            return candidate
    # Fallback to the original sibling-layout guess (will error clearly if missing)
    return here.parent.parent.parent / "mobilegym" / "public" / "run_explorer.html"


EXPLORER_HTML = _find_explorer_html()

DEFAULT_LOGS_DIR = Path(__file__).resolve().parent.parent.parent / \
    "logs" / "mobilegym" / "mobilegym-qwen3-vl-4b-train"


def is_run_dir(d: Path) -> bool:
    return (d / "meta.json").exists() or \
           (d / "results.jsonl").exists() or \
           (d / "trajectory").exists()


def discover_runs(logs_dir: Path) -> list[str]:
    """Discover all run directories, supporting 1-3 levels of nesting."""
    runs = []
    if not logs_dir.exists():
        return runs

    for top in sorted(logs_dir.iterdir()):
        if not top.is_dir():
            continue
        if is_run_dir(top):
            runs.append(top.name)
        else:
            # 2-level nesting: run_date/train_step_N
            for sub in sorted(top.iterdir()):
                if not sub.is_dir():
                    continue
                if is_run_dir(sub):
                    runs.append(f"{top.name}/{sub.name}")
    runs.sort(reverse=True)
    return runs


class ExplorerHandler(SimpleHTTPRequestHandler):
    logs_dir: Path = DEFAULT_LOGS_DIR

    def log_message(self, format, *args):
        # quieter logging
        pass

    def do_GET(self):
        path = unquote(self.path).split("?")[0]

        # Serve the explorer HTML at root
        if path == "/" or path == "/index.html":
            self._serve_explorer_html()
            return

        # API endpoints
        if path.startswith("/api/runs"):
            self._handle_api(path[len("/api/runs"):])
            return

        self.send_error(404)

    def _serve_explorer_html(self):
        data = EXPLORER_HTML.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_file(self, file_path: Path):
        if not file_path.exists() or not file_path.is_file():
            self.send_error(404)
            return
        mime, _ = mimetypes.guess_type(str(file_path))
        if mime is None:
            mime = "application/octet-stream"
        # Special handling for text files
        if file_path.suffix in (".json", ".jsonl", ".txt", ".csv", ".log", ".md"):
            if ".json" in file_path.suffix:
                mime = "application/json"
            elif file_path.suffix == ".jsonl":
                mime = "application/x-ndjson"
            else:
                mime = f"text/plain; charset=utf-8"

        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def _resolve_run_dir(self, parts: list[str]) -> tuple[Path | None, int]:
        """Resolve run directory from path parts, return (dir, depth)."""
        if not parts:
            return None, 0

        # Try 1-level
        d1 = self.logs_dir / parts[0]
        if d1.is_dir() and is_run_dir(d1):
            return d1, 1

        # Try 2-level
        if len(parts) >= 2:
            d2 = self.logs_dir / parts[0] / parts[1]
            if d2.is_dir() and is_run_dir(d2):
                return d2, 2

        return None, 0

    def _handle_api(self, sub_path: str):
        sub_path = sub_path.strip("/")
        parts = [p for p in sub_path.split("/") if p]

        # GET /api/runs — list all runs
        if not parts:
            runs = discover_runs(self.logs_dir)
            self._send_json({"runs": runs})
            return

        # Resolve which parts form the run name
        run_dir, depth = self._resolve_run_dir(parts)
        if run_dir is None:
            self.send_error(404, "Run not found")
            return

        remaining = parts[depth:]

        # GET /api/runs/:runName — list contents
        if not remaining:
            entries = list(run_dir.iterdir())
            files = sorted(e.name for e in entries if e.is_file())
            dirs = sorted(e.name for e in entries if e.is_dir())
            self._send_json({"files": files, "directories": dirs})
            return

        # GET /api/runs/:runName/trajectory — list task dirs
        if remaining == ["trajectory"]:
            traj_dir = run_dir / "trajectory"
            if not traj_dir.exists():
                self._send_json({"tasks": []})
                return
            tasks = sorted(e.name for e in traj_dir.iterdir() if e.is_dir())
            self._send_json({"tasks": tasks})
            return

        # Serve any file under the run dir
        file_path = run_dir / "/".join(remaining)
        # Security check
        try:
            file_path.resolve().relative_to(run_dir.resolve())
        except ValueError:
            self.send_error(403, "Forbidden")
            return

        if file_path.is_dir():
            entries = sorted(e.name for e in file_path.iterdir())
            self._send_json({"files": entries})
            return

        self._send_file(file_path)


def main():
    parser = argparse.ArgumentParser(description="Serve run_explorer for training logs")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--logs-dir", type=str, default=str(DEFAULT_LOGS_DIR))
    parser.add_argument("--host", type=str, default="0.0.0.0")
    args = parser.parse_args()

    logs_dir = Path(args.logs_dir).resolve()
    ExplorerHandler.logs_dir = logs_dir

    runs = discover_runs(logs_dir)
    print(f"Logs directory: {logs_dir}")
    print(f"Discovered {len(runs)} training runs")
    for r in runs[:5]:
        print(f"  {r}")
    if len(runs) > 5:
        print(f"  ... and {len(runs) - 5} more")

    server = HTTPServer((args.host, args.port), ExplorerHandler)
    print(f"\nRun Explorer: http://localhost:{args.port}")
    print("Press Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()


if __name__ == "__main__":
    main()
