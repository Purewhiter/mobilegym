# Evaluate subscription Coding Agents through MCP

This optional transport uses the existing `GenericAgentV2`, `SerialRunner`,
`Controller`, `MobileGymEnv`, `Evaluator`, and recorders. It does not implement
a second action executor or judge.

## Architecture

`MCPBridgeClient.chat()` replaces only the API client's `chat()` method:

```text
SerialRunner -> GenericAgentV2.act(observation)
             -> MCPBridgeClient.chat(messages) waits for an MCP action
             -> JSON serialization + THINK/ANSWER envelope
             -> ChatResult(content=adapter-generated response)
             -> GenericAgentV2.parse_response()
             -> original Controller -> env.step(action)
```

The next `chat()` call supplies the screenshot returned by the previous MCP
`act` call. The bridge uses `SerialRunner` directly, without a subclass. The original
runner still selects per-task budgets, samples parameters, resets the phone,
records actions, captures final state, scores and aggregates results.

An MCP connection owns one serial batch. `COMPLETE`, `ABORT`, or the step limit
ends the current episode; the tool response supplies the next episode's
instruction and screenshot. A single plain-text `[评测结束]` notification ends the batch. Scores and
judge feedback are not returned to the client. The first implementation supports
one client and one action in flight, not parallel clients or resumable transport.

## Install and run

Use the existing benchmark Python environment and install the optional SDK:

```bash
python -m pip install -r bench_env/mcp/requirements.txt
```

Start MobileGym using the normal project instructions, then authenticate Codex
with your ChatGPT subscription using `codex login`. No model API key is required.

From the repository root:

```bash
python -m bench_env.mcp.run_codex \
  --env-url http://127.0.0.1:3000 \
  --run-dir runs/mcp-sol-medium-pilot \
  --model gpt-5.6-sol --reasoning-effort medium
```

The default `bench_env/mcp/pilot_tasks.txt` contains ten deliberately small
integration tasks: settings/navigation, data modification, grounded answers,
and a cross-app workflow. It is not a representative sample for estimating the
full 256-task benchmark score. Use `--task-file`, `--limit`, and `--seed` to change
the batch. Each line in a task file is an existing test-split task ID. The run
directory must be new or empty.

The launcher runs Codex in a temporary empty workspace with user config and
host skill discovery disabled, disables unrelated tool features, and explicitly
preapproves only this run's two simulator tools. It retains the client's Code
Mode host, which this Codex version needs to invoke MCP. Saved authentication
is reused; ambient `OPENAI_API_KEY` and `CODEX_API_KEY` are omitted. No global
Codex configuration is modified.

### Pi Agent

Pi 0.85.1 can run the same benchmark through its existing `openai-codex` OAuth
login. It has no native MCP client, so `pi_extension.ts` registers only the two
MobileGym tools and delegates to `pi_gateway.py`, which uses the official Python
MCP client SDK to connect to the unchanged benchmark server. The extension
loads schemas from `tools/list` and forwards arguments and image/text results;
it does not execute simulator actions or implement judging.

```bash
pi auth check --provider openai-codex --model gpt-5.6-sol --json

python -m bench_env.mcp.run_pi \
  --env-url http://127.0.0.1:3000 \
  --run-dir runs/pi-mcp-pilot \
  --task-file /path/to/task_ids.txt --limit 2 \
  --model gpt-5.6-sol --reasoning-effort medium
```

The Pi launcher uses a new session in an empty temporary workspace, disables
built-in tools and discovery of unrelated extensions, skills and context files,
and loads only the explicit MobileGym extension. It does not migrate credentials
or change global settings. Pi retains its native prompt, image handling and
context management; the extension adds MCP instructions and passes the original
Generic V2 prompt unchanged. No history pruning or provider-request rewriting
is performed. `pi_runtime.json` and `pi_request_audit.jsonl` record the resolved
model/effort and non-sensitive request checks. The audit never logs auth headers.

Pi artifacts include `pi_events.jsonl`, `pi_sessions/`, `pi_system_prompt.txt`,
`pi_mcp_catalog.json` and `pi_mcp_gateway.log`. Original benchmark artifacts are
the same as Codex runs. Refresh normalized token accounting with:

```bash
python -m bench_env.mcp.pi_usage runs/pi-mcp-pilot
```

Pi reports uncached input separately from cache reads/writes. The normalizer
adds these fields to obtain total input, counts only authoritative assistant
`message_end` events, and ignores streaming deltas and repeated final history.
Reported dollar estimates are not subscription charges. Comparisons with older
Codex v1 runs must also account for the transport change to structured v2.

For parallel evaluation, freeze a selection manifest containing `selection_seed`,
`parameter_seed`, and a `tasks` array (each task has `id`, `difficulty`, `budget`,
and optionally `apps`/`template`), then run:

```bash
python -m bench_env.mcp.run_pi_parallel \
  --env-url http://127.0.0.1:3000 \
  --run-dir runs/pi-parallel-pilot \
  --selection /path/to/selection.json --parallel 5
```

Each selected task gets a fresh Pi session, its own MCP server and independent
browser/context. Results remain under `episodes/`; the parent run aggregates
them with the original `RunRecorder` and exposes trajectories via relative
symlinks for Run Explorer. `jobs.json` records dispatch/completion times. A failed
worker is recorded as an infrastructure error without discarding other results
or silently retrying an episode. Selection manifests preserve the sampled task
IDs and random seed so the batch can be reproduced without drawing again.

This is a controlled local pilot, not a hardened adversarial isolation system.
For a publishable pure-vision track, also isolate the client from benchmark
source, results and browser debugging endpoints using an OS/container boundary.
An empty workspace and disabled tools alone are not a filesystem security boundary.

## MCP tools and exact action semantics

- `observe({})`: returns the current cached observation. It does not take a new
  screenshot or advance the environment.
- `act({"thought": "...", "action": {...}})`: takes non-empty thought text and
  one Generic V2 action **object**, not a JSON-encoded string. Both fields are
  required, including for terminal actions. The original parser still handles
  the action's aliases, defaults and errors. There is no separate `finish` or
  `answer` tool.

For example:

```json
{
  "thought": "The meeting details are ready. Fill in the SMS body.",
  "action": {
    "action": "TYPE",
    "value": "Release meeting\nTime: 09:00\nPassword: 123456"
  }
}
```

The original `GenericAgentV2.SYSTEM_PROMPT` is transmitted verbatim: it is
included in the Codex launch prompt, MCP instructions and action tool description.
The transport instructions explicitly map the original THINK section to the
`thought` text field and the ANSWER section to the `action` object field. They
do not rewrite the original prompt or impose a sentence-count limit. Models
must not add XML envelope tags or stringify the action themselves.

The server uses `json.dumps()` to encode the action, then builds a THINK/ANSWER
string for the unchanged Generic V2 parser. This removes the extra escaping
layer previously required when a JSON action was nested inside a `response`
string. Newlines, quotes, tabs, backslashes and Unicode in the action value are
preserved. Literal envelope tags in action text are safely JSON-escaped and
restored during parsing. The server does not generate or rewrite thought text.
Invalid transport fields are rejected before action delivery; they do not
consume an environment action step. Action interpretation and judging are
unchanged.

The recorded THINK text is the client's explicit response, not an extraction
of hidden client reasoning. The exact original prompt, launch prompt, actual
MCP instructions and schemas are saved separately from the Generic V2 reference
prompts so these inputs can be inspected without ambiguity. Byte equality and
SHA-256 tests guard against prompt rewriting. Client instructions and message
roles still differ from a direct API call; unchanged prompt text does not make
the full client context equivalent.

Coordinates remain normalized to 0–1000. Each observation translates only the
latest Generic V2 user-message content, preserving its order and text: the image
becomes a native MCP image block, followed by the unchanged task description or
`[Step N]` text. No JSON envelope, ready status, episode index, step budget or
image-size metadata is sent to the model. These are not needed to operate the
phone and step budgets remain the runner's responsibility. No route, DOM, state,
sampled parameters, expected answers or judge internals are serialized.
Responses may cross an episode boundary; the original `[任务]` prefix announces
the next task without another identifier.

The `ANSWER` action is preserved even in grounded mode. Its scoring semantics
remain the existing evaluator's responsibility: tasks requiring AnswerSheet
must be answered through that app. `COMPLETE` is never synthesized for a client
exit, infrastructure error, or step limit.

Do not retry an uncertain `act` call automatically. A lost response may follow
an action that already executed. This pilot does not provide durable request
deduplication or reconnect/resume. Concurrent actions are rejected.

## Context and caching

Generic V2's API prompts retain textual action history but attach only the
current screenshot. The Coding Agent manages its own conversation history;
MCP cannot erase a previous image from that history. The initial pilot keeps
all ten episodes in one client session, with independent simulator resets.

Preserving an unchanged prefix can improve cache reuse; deleting images or
compacting history changes that prefix. Cached tokens still belong to model
context. A high cache fraction does not establish equal context, equal task
performance, or equal subscription quota consumption. Client image pruning and
compaction remain client-controlled.

## Results and observability

The original `meta.json`, `results.jsonl`, `summary.json`, and `trajectory/`
remain compatible with Run Explorer. Additional artifacts are:

- `client_config.json`: CLI version, requested model/effort, selected tasks and
  the explicit invocation configuration.
- `generic_v2_system_prompt.txt`, `client_prompt.txt`: the unmodified original
  Generic V2 prompt and the actual launch prompt containing it. Metadata records
  `generic_v2_prompt_policy=verbatim` and its SHA-256.
- `mcp_instructions.txt`, `mcp_tools.json`: the actual server instructions and
  tool definitions used by this run.
- `client_events.jsonl`, `client_stderr.log`, `client_final.txt`: client output.
- `mcp_actions.jsonl`: each accepted model submission's original `thought` and
  `action` arguments, its decision index, and the adapter-generated response.
  This is written before delivery to the runner. It records submission, not a
  guarantee that the environment action succeeded. Rejected transport arguments
  remain available in the client event log.
- `client_exit.json`: CLI exit status and whether all expected episodes finished.
  A successful CLI exit alone does not mean the benchmark completed.
- `client_usage.json`: reported usage, actual session model/effort, token-count
  snapshots and observable compaction events. The extractor reads only the
  matching local Codex rollout and copies no messages, images or credentials.

To refresh usage while a run is active or after it completes:

```bash
python -m bench_env.mcp.usage runs/mcp-sol-medium-pilot
```

`step_*_prompt.json` records Generic V2's reference prompt, **not** the actual
full Coding Agent context. This distinction is also recorded in run metadata.
`step_*_response.txt` now contains the **adapter-generated** THINK/ANSWER text,
not a verbatim model response. The original structured model arguments are
stored separately in `mcp_actions.jsonl` and the client event log. Metadata marks
this distinction with `model_response_log_kind=adapter_serialized_generic_v2`.
The original parser extracts the thought text into the trajectory's `thought`
field, and its reference history uses the serialized envelope.
Hidden client reasoning is not extracted or fabricated. Token totals aggregate all requests, whereas the last
request's input count is a better indicator of current input size. Subscription
billing/quota and exact submitted multimodal history are not observable here.

New runs identify this contract with `response_format=mcp_structured_thought_action_v2`
and `thought_kind=mcp_thought_field` in metadata. Observations use
`observation_format=generic_v2_current_message_v1`. Earlier runs returned an
additional JSON metadata envelope; their artifacts remain unchanged. The earlier ten-task
pilot used direct JSON actions and has empty `thought` fields. Those results
and all original artifacts are retained unchanged; no summaries are backfilled
and the pilot is not rerun merely to upgrade its response format. Later v1 runs
used the `response` string and can contain nested-JSON escaping failures. Their
responses and scores are also retained unchanged; the v2 fix does not repair or
rescore old episodes.
