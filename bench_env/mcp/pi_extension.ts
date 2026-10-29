/** Connect only MobileGym tools to Pi; preserve the real MCP schemas/content. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { spawn } from "node:child_process";
import { appendFileSync, createWriteStream, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export default async function (pi: ExtensionAPI) {
  const configPath = process.env.MOBILEGYM_PI_CONFIG;
  if (!configPath) throw new Error("MOBILEGYM_PI_CONFIG is required");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const child = spawn(config.python, ["-m", "bench_env.mcp.pi_gateway", "--config", configPath], {
    cwd: config.repo_root,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stderr = createWriteStream(join(config.run_dir, "pi_mcp_gateway.log"), { flags: "a" });
  child.stderr.pipe(stderr);
  let nextId = 1;
  let buffer = "";
  let stopped = false;
  const pending = new Map<number, { resolve: (result: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const fail = (error: Error) => {
    for (const value of pending.values()) { clearTimeout(value.timer); value.reject(error); }
    pending.clear();
  };
  const waitFor = (id: number) => new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("MobileGym MCP timeout; do not automatically retry an uncertain action"));
    }, 190_000);
    pending.set(id, { resolve, reject, timer });
  });
  const initialized = waitFor(0);
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let end: number;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      if (!line) continue;
      try {
        const message = JSON.parse(line);
        const callback = pending.get(message.id);
        if (!callback) continue;
        pending.delete(message.id);
        clearTimeout(callback.timer);
        if (message.error) callback.reject(new Error(message.error));
        else callback.resolve(message.result);
      } catch (error) { fail(error as Error); }
    }
  });
  child.on("error", fail);
  child.on("exit", (code) => {
    if (!stopped) fail(new Error(`MobileGym MCP gateway exited: ${code}`));
    stderr.end();
  });
  const hello = await initialized;
  if (hello.tools.length !== 2 || !hello.tools.every((t: any) => ["observe", "act"].includes(t.name))) {
    child.kill();
    throw new Error("Unexpected MobileGym tool inventory");
  }
  writeFileSync(join(config.run_dir, "pi_mcp_catalog.json"), JSON.stringify(hello, null, 2));
  for (const tool of hello.tools) {
    pi.registerTool({
      name: `mobilegym_${tool.name}`,
      label: `MobileGym ${tool.name}`,
      description: tool.description,
      parameters: Type.Unsafe(tool.inputSchema),
      async execute(_callId, params, signal) {
        if (signal?.aborted) throw new Error("Tool call cancelled before submission");
        const id = nextId++;
        const resultPromise = waitFor(id);
        child.stdin.write(JSON.stringify({ id, name: tool.name, arguments: params }) + "\n");
        const result = await resultPromise;
        if (result.isError) throw new Error(result.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n"));
        if (!result.content.every((c: any) => c.type === "text" || c.type === "image")) throw new Error("Unexpected MCP content type");
        return { content: result.content, details: {} };
      },
    });
  }

  pi.on("before_agent_start", (event) => {
    const systemPrompt = event.systemPrompt + "\n\n" + hello.instructions;
    writeFileSync(join(config.run_dir, "pi_system_prompt.txt"), systemPrompt);
    return { systemPrompt };
  });
  pi.on("session_start", (_event, ctx) => {
    writeFileSync(join(config.run_dir, "pi_runtime.json"), JSON.stringify({
      provider: ctx.model?.provider, model: ctx.model?.id, thinking: ctx.thinkingLevel,
      contextWindow: ctx.model?.contextWindow,
    }, null, 2));
  });
  const originalPrompt = readFileSync(join(config.run_dir, "generic_v2_system_prompt.txt"), "utf8");
  pi.on("before_provider_request", (event) => {
    const payload = event.payload as any;
    let imageCount = 0;
    let originalPromptPresent = false;
    const inspect = (value: any) => {
      if (typeof value === "string") { originalPromptPresent ||= value.includes(originalPrompt); return; }
      if (!value || typeof value !== "object") return;
      if (value.type === "input_image" || value.type === "image") imageCount++;
      for (const child of Object.values(value)) inspect(child);
    };
    inspect(payload);
    appendFileSync(join(config.run_dir, "pi_request_audit.jsonl"), JSON.stringify({
      model: payload.model, reasoning_effort: payload.reasoning?.effort,
      image_count: imageCount, original_prompt_present: originalPromptPresent,
    }) + "\n");
    // Inspection only. No context pruning, request rewriting or credential logging.
  });
  pi.on("session_shutdown", async () => {
    stopped = true;
    fail(new Error("Pi session ended"));
    child.stdin.end();
    if (child.exitCode === null) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => { child.kill(); resolve(); }, 5000);
        child.once("exit", () => { clearTimeout(timeout); resolve(); });
      });
    }
  });
}
