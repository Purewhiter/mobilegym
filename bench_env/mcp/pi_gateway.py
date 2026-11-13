"""Local Pi extension gateway using the official Python MCP client SDK.

The extension's LF-delimited JSON pipe is only a local IPC channel. This process
negotiates and calls the real MobileGym MCP stdio server through ClientSession.
It does not interpret or execute simulator actions.
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import timedelta
import json
from pathlib import Path
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def emit(message: dict) -> None:
    print(json.dumps(message, ensure_ascii=False), flush=True)


async def run(config: dict) -> None:
    server = StdioServerParameters(command=config["python"], args=config["server_args"])
    async with stdio_client(server, errlog=sys.stderr) as (read, write):
        async with ClientSession(read, write, read_timeout_seconds=timedelta(seconds=180)) as session:
            initialized = await session.initialize()
            listed = await session.list_tools()
            emit({"id": 0, "result": {
                "instructions": initialized.instructions,
                "tools": [t.model_dump(by_alias=True, exclude_none=True) for t in listed.tools],
            }})
            while line := await asyncio.to_thread(sys.stdin.readline):
                request = json.loads(line)
                try:
                    if request["name"] not in {"observe", "act"}:
                        raise ValueError("Unknown MobileGym tool")
                    result = await session.call_tool(request["name"], request["arguments"])
                    emit({"id": request["id"], "result": result.model_dump(by_alias=True, exclude_none=True)})
                except Exception as error:
                    emit({"id": request["id"], "error": str(error)})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    args = parser.parse_args()
    asyncio.run(run(json.loads(args.config.read_text())))


if __name__ == "__main__":
    main()
