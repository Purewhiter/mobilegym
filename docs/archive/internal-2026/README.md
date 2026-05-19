# Internal 2026 — Archived maintainer notes

This directory holds documents that were useful during 2026 development but are **not** intended for public consumption:

| File | Why archived |
|---|---|
| `agent_replication_workflow.md` | Refers to a private `scripts/reverse/*` toolchain that isn't part of the public repo. |
| `APK_DESIGN_EXTRACTION.md` | Same — depends on local APK decompilation products. |
| `THEME_RESOURCE_PULLING.md` | Personal operational notes for pulling theme resources off a connected Xiaomi / HyperOS phone. |
| `bench-256-envs-slow.md` | Tuning notes for 256-way parallel runs under a specific multi-GPU vLLM deployment — not relevant to typical public usage. |
| `vllm-dp-imbalance.md` | vLLM `--data-parallel-size` load-balancing notes specific to a private cluster. |
| `bench-multiprocess-contexts-state-race.md` | A known-but-unfixed multi-process state-race bug, plus internal benchmark deltas. |

If any of these are revived for public docs, copy the *information* — don't promote the file as-is, since the surrounding text presumes maintainer context.
