# Generated Artifacts

Generated artifacts are files produced by scripts from source declarations or live simulator state. Do not hand-edit generated output unless the generator explicitly says it is a seed file.

## Common Artifacts

| Artifact | Generator | Output |
|---|---|---|
| Explored navigation graph | `python scripts/explore_nav_graph.py <url> <appId> out.json` | the JSON file you name (states, tap and back targets) |
| App state schema | `python scripts/dev/dump_app_state_schema.py` | `docs/api/app-state-schema.md` |
| IME pinyin dictionary | `node scripts/ime/build_pinyin_dict.mjs` | `os/keyboard/pinyinData.ts` |

## Rules

- Change the source declaration or generator, then regenerate.
- Include exact warnings/errors when generation reports them.
- For navigation changes, explore the app before and after and diff the graphs.

### Do not hand-edit generated files

The output side of every row above is generated. Specifically:

- **`os/keyboard/pinyinData.ts`** — the IME pinyin dictionary is a several-thousand-line generated object literal. Update the source dictionaries in `all_dicts/` (or change the generator's logic), then re-run `node scripts/ime/build_pinyin_dict.mjs`. Hand-editing `pinyinData.ts` causes duplicate keys, bundle bloat, and unreviewable diffs.
- **`docs/api/app-state-schema.md`** — dumped from a running simulator; the snapshot it describes is the bench's source of truth for state shapes.

## Related Docs

- Build tooling overview → [build.md](build.md)
- Exploring an app's navigation graph → [../navigation/routes.md](../navigation/routes.md)
- Live app state schema → [../../api/app-state-schema.md](../../api/app-state-schema.md)
