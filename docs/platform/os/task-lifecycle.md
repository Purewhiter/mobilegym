# Task Lifecycle

This page focuses on Tasks, Activities, Back fallback, and lifetime rules. For cross-app launch traces, see [cross-app-launch.md](cross-app-launch.md). For the broader OS layer, see [overview.md](overview.md).

> **Which "task"?** "Task" throughout this document means the Android-aligned OS construct — an Activity stack belonging to one running app, mirroring Android's Task / back-stack model. This is **unrelated** to the benchmark evaluation tasks under `bench_env/task/<suite>/` (parameterised Python classes with `setup` + judge), which happen to share the name.

## Model

```ts
type Task = {
  taskId: string;
  rootAppId: AppId;
  stack: ActivityInstance[];
  launchedByTaskId?: string;
  wasExternallyRouted?: boolean;
};
```

Each Task has a stack of Activity instances. Backgrounded apps stay mounted but hidden with `display:none`, so React state survives task switches.

## Core Operations

| Operation | Behavior |
|---|---|
| `LAUNCH_APP` (new Task) | Create a Task. Record `launchedByTaskId` if there's an active caller Task. |
| `LAUNCH_APP` (reactivate existing Task) | Reactivate without modifying `launchedByTaskId`, **except** when there's no caller (user tapped from the Launcher) **and** `wasExternallyRouted=false` — then clear `launchedByTaskId` to `undefined`. This is the one-shot rule: Launcher reactivation of an in-app-created Task severs the original caller link; Launcher reactivation of an externally-routed Task preserves it. |
| `PUSH_ACTIVITY` | Push a new Activity onto the current or target Task. |
| `POP_ACTIVITY` | Pop the top Activity when `stack.length > 1`. |
| `finishActivity` | Pop top Activity if `stack > 1` (and activate `launchedByTaskId` if the popped Activity had one); if `stack == 1` activate `launchedByTaskId` when present, else call `goHome()`. **Never destroys the Task** — that requires explicit `closeApp` / Recents swipe. |
| `MARK_EXTERNAL_ROUTE` | Mark a newly created Task as externally routed by `openApp(appId, route)`. Current role is narrow: see the `LAUNCH_APP` reactivation rule above. |
| `consumeLaunchedBy` | Clear the one-shot caller pointer after returning to the caller Task. |
| `setActivityIntent(activityId, payload)` | Store a new intent payload on an existing Activity. Apps **poll** this via `os.getIntentPayload(activityId)`; there is no `onNewIntent`-style callback. |

## Back Fallback

Back is first offered to app and Activity navigators. If they return false:

1. `os.finishTopActivity` pops the top Activity when the Task has more than one Activity.
2. `os.returnToLauncherTask` reactivates `launchedByTaskId` and consumes that pointer.
3. `os.goHomeFallback` returns to the launcher while keeping the Task in Recents.

Ordinary Back fallback does not destroy Tasks. Closing is explicit via Recents swipe-away or `__OS__.closeApp(appId)`.

## Route Reset on Caller Return

Before returning to a caller Task, the OS resets the current app route to `/`. This keeps transient routes such as payment confirmation or SMS compose from being the screen shown when the Task is later reopened from Recents.

## Related Docs

- OS overview → [overview.md](overview.md)
- Cross-app launch traces → [cross-app-launch.md](cross-app-launch.md)
- Intent system → [intent-system.md](intent-system.md)
