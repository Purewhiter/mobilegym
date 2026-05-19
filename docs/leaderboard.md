# Submitting to the Leaderboard

We maintain a public leaderboard in the top-level [`README.md`](../README.md#-leaderboard--mobilegym-bench-256-test-tasks). To get your model added, open a PR that follows this process.

## Eligibility

We accept submissions for any model — closed-source, open-source, generalist, GUI-specialist, trained-from-scratch, or fine-tuned. The model must be **evaluable on the released test split**.

- **Released agents** (those whose weights are public, or whose API is generally available) get a dedicated row.
- **Anonymous submissions** are allowed during paper review periods. State the embargo date in the PR.
- **Training set leakage** disqualifies a submission. If you fine-tuned on any subset of the 416 templates, say so explicitly in the PR. We will list it under "Trained on MobileGym-Bench" rather than the headline table.

## Run requirements

To be reproducible, your submission must follow these constraints. Some can be flexed for specific reasons — explain them in the PR.

| Setting | Required value | Why |
| :--- | :--- | :--- |
| Split | `--split test` (the 256-task test split) | The leaderboard is over this split. |
| Trials | `--repeat-n 4` for non-API models | We report mean ± stdev across 4 trials. API models can submit 1 trial if cost is prohibitive (mark with †). |
| Max steps | Default `15 / 30 / 45 / 60` for L1–L4 | The paper-default budget. Some agents may need more steps for AnswerSheet tasks (+15 budget) — this is enabled by default. |
| Judge | `--judge-mode state` (programmatic only) | The point of MobileGym is deterministic judging. VLM-judge runs are accepted as supplementary, not headline. |
| Coordinate space | `--coord-space norm_0_1000` (default) | Agents trained on different conventions can use `--coord-space norm_0_1` or `--coord-space physical`, but state it. |
| Temperature / sampling | Whatever the model is meant to use | Document the values in the PR. |

A reference command:

```bash
python -m bench_env.run \
  --split test \
  --repeat-n 4 \
  --parallel 8 \
  --env-url http://localhost:5173 \
  --agent <your_adapter_name> \
  --model-base-url <your_endpoint> \
  --model-name <your_model> \
  --judge-mode state \
  --runs-dir runs/leaderboard-<your_model>
```

## What to include in the PR

1. **The leaderboard row.** Edit the `## 📊 Leaderboard` section of `README.md` (and `README.zh-CN.md`) with your numbers. Use the existing format: SR ± stdev, PR, per-level SR, FC, USE. Place your row in the right category (Proprietary / Open-source GUI / Open-source Generalist).

2. **A run-summary commit.** Add a Markdown file under `docs/leaderboard/<model-id>.md` with:
   - Model name, version, and where to download / access it
   - Full command(s) you ran (verbatim, with all flags)
   - The MobileGym commit SHA you ran against
   - The aggregate `summary.json` from your run (paste the JSON)
   - Any deviations from the standard protocol, with a one-sentence justification
   - Contact info (email, GitHub handle, or org)

3. **Run artifacts** (optional but encouraged). Upload your `runs/leaderboard-<model>/` directory to a public host (Hugging Face datasets, S3, Google Drive) and link it from the run-summary file. This lets others audit individual trajectories. The directory may be large (hundreds of MB).

## What we do with the submission

1. We sanity-check the run: were all 256 tasks attempted? Were any tasks accidentally re-judged with the wrong judge? Are the per-level breakdowns internally consistent?
2. If your `runs/` is shared, we sample 5 trajectories at random and inspect them for protocol violations (e.g., hard-coded answers, prompts that leak the judge logic).
3. If checks pass, we merge the PR. Your row goes live with the next push to the main README.
4. We do **not** re-run submissions ourselves by default. If you'd like an independent re-run (for visibility or anti-cherry-picking purposes), open an issue tagged `independent-rerun`.

## When the panel re-calibrates

The L1–L4 difficulty strata are model-calibrated against an 8-model reference panel. As frontier models advance, the strata can drift — a task that is L3 today may slip into L2 once a 2027-class model handles it. We re-calibrate at most once a year, and we lock the panel for each calibration round.

Submissions are always reported under the **current** panel. Past results stay under the panel they were submitted against, with a footnote naming that panel ("2026-04 panel").

## Removing or correcting a submission

If you discover an error in your reported numbers, open a PR with the correction and a short note in the run-summary file. We will rerun any disputed row at our discretion; the leaderboard is meant to be useful and honest, not adversarial.

## Questions

Open an issue tagged `leaderboard`. PRs that materially change the submission protocol should be discussed in an issue first.
