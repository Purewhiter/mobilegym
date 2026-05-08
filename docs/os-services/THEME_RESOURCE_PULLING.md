# 主题资源拉取指南

本文档记录如何从**当前已连接的 Xiaomi/HyperOS 手机**拉取主题资源到本仓库，并生成项目运行时可用的 `public/themes` 静态产物。

## 目录约定

项目里的主题资源分两层：

- 原始主题源数据放在 `themes/`
- 运行时静态产物放在 `public/themes/`

对应规范可参考：

- `docs/PROJECT_SPEC_V2.md`
- `scripts/prepare-themes.py`

其中：

- `themes/` 是脚本输入目录，主要保存从手机拉回来的 `.mrm` / `.mrc` / 预览图 / `maml.widget`
- `public/themes/` 是脚本输出目录，供 ThemeStore 和运行时读取

## 手机侧目录

已验证当前设备的主题资源主要位于：

```text
/sdcard/Android/data/com.android.thememanager/files/MIUI/theme/.data/
├── meta/
├── content/
├── preview/
└── rights/

/sdcard/Android/data/com.android.thememanager/files/maml.widget/
```

常见子目录映射：

| 手机目录 | 本地目录 |
|------|------|
| `.../.data/meta/theme` | `themes/meta/theme` |
| `.../.data/meta/fonts` | `themes/meta/fonts` |
| `.../.data/meta/aod` | `themes/meta/aod` |
| `.../.data/content` | `themes/content` |
| `.../.data/preview` | `themes/preview` |
| `.../.data/rights` | `themes/rights` |
| `.../maml.widget` | `themes/maml_widget` |

## 前置条件

1. 手机已通过 `adb` 连接
2. 设备上主题资源已经下载到本地
3. 当前仓库根目录为 `mobile-gym`

先确认连接：

```bash
adb devices -l
```

## 先看手机里有什么

例如查看主题目录：

```bash
adb shell ls -a "/sdcard/Android/data/com.android.thememanager/files/MIUI/theme"
adb shell ls -a "/sdcard/Android/data/com.android.thememanager/files/MIUI/theme/.data"
```

查看某类资源：

```bash
adb shell ls "/sdcard/Android/data/com.android.thememanager/files/MIUI/theme/.data/meta/theme"
adb shell ls "/sdcard/Android/data/com.android.thememanager/files/MIUI/theme/.data/meta/aod"
adb shell ls -A "/sdcard/Android/data/com.android.thememanager/files/maml.widget"
```

## 推荐流程：先比对，再拉取

下面这个 Python 一次性对比手机和本地的差异，适合先看“手机里多了什么”：

```bash
python3 - <<'PY'
import subprocess, os

checks = [
    ('/sdcard/Android/data/com.android.thememanager/files/MIUI/theme/.data/meta/theme', 'themes/meta/theme', 'theme-meta'),
    ('/sdcard/Android/data/com.android.thememanager/files/MIUI/theme/.data/meta/fonts', 'themes/meta/fonts', 'font-meta'),
    ('/sdcard/Android/data/com.android.thememanager/files/MIUI/theme/.data/meta/aod', 'themes/meta/aod', 'aod-meta'),
]

for remote, local, name in checks:
    remote_set = {
        line.strip()
        for line in subprocess.check_output(['adb', 'shell', 'ls', remote], text=True).splitlines()
        if line.strip()
    }
    local_set = set(os.listdir(local))
    missing = sorted(remote_set - local_set)
    print(f'## {name}: {len(missing)}')
    for item in missing:
        print(item)
PY
```

如果要单独比对 `maml.widget`：

```bash
python3 - <<'PY'
import subprocess, os

remote = '/sdcard/Android/data/com.android.thememanager/files/maml.widget'
local = 'themes/maml_widget'

remote_set = {
    line.strip()
    for line in subprocess.check_output(['adb', 'shell', 'ls', '-A', remote], text=True).splitlines()
    if line.strip()
}
local_set = set(os.listdir(local))
missing = sorted(remote_set - local_set)
print(f'missing: {len(missing)}')
for item in missing:
    print(item)
PY
```

## 手动拉取单个资源

### 拉取单个 AOD

假设缺的是 `1ee964f0-19fe-4c6c-9f40-c76ca671113e`：

```bash
adb pull "/sdcard/Android/data/com.android.thememanager/files/MIUI/theme/.data/meta/aod/1ee964f0-19fe-4c6c-9f40-c76ca671113e.mrm" "themes/meta/aod/"
adb pull "/sdcard/Android/data/com.android.thememanager/files/MIUI/theme/.data/content/aod/1ee964f0-19fe-4c6c-9f40-c76ca671113e.mrc" "themes/content/aod/"
```

如果手机里存在该资源的预览图目录，也可以一并拉取：

```bash
adb pull "/sdcard/Android/data/com.android.thememanager/files/MIUI/theme/.data/preview/theme/1ee964f0-19fe-4c6c-9f40-c76ca671113e" "themes/preview/theme/"
```

### 拉取单个 `maml.widget`

假设缺的是 `05ac30fa-a0fd-4025-a6b5-893315c8662d`：

```bash
adb pull "/sdcard/Android/data/com.android.thememanager/files/maml.widget/05ac30fa-a0fd-4025-a6b5-893315c8662d" "themes/maml_widget/"
adb pull "/sdcard/Android/data/com.android.thememanager/files/maml.widget/05ac30fa-a0fd-4025-a6b5-893315c8662d.right" "themes/maml_widget/"
adb pull "/sdcard/Android/data/com.android.thememanager/files/maml.widget/05ac30fa-a0fd-4025-a6b5-893315c8662d.zip" "themes/maml_widget/"
```

## 批量拉取缺失的 AOD 和 `maml.widget`

如果想像这次一样把“手机里有、本地没有”的 AOD 和 `maml.widget` 一次性补齐，可以用下面脚本：

```bash
python3 - <<'PY'
import os, subprocess
from pathlib import Path

root = Path('.').resolve()
remote_base = '/sdcard/Android/data/com.android.thememanager/files'

local_aod_meta = root / 'themes/meta/aod'
local_aod_content = root / 'themes/content/aod'
local_widgets = root / 'themes/maml_widget'

remote_aod_meta = remote_base + '/MIUI/theme/.data/meta/aod'
remote_aod_content = remote_base + '/MIUI/theme/.data/content/aod'
remote_widgets = remote_base + '/maml.widget'

remote_aod = {
    line.strip()
    for line in subprocess.check_output(['adb', 'shell', 'ls', remote_aod_meta], text=True).splitlines()
    if line.strip()
}
local_aod = set(os.listdir(local_aod_meta))
missing_aod = sorted(remote_aod - local_aod)

remote_widget_items = {
    line.strip()
    for line in subprocess.check_output(['adb', 'shell', 'ls', '-A', remote_widgets], text=True).splitlines()
    if line.strip()
}
local_widget_items = set(os.listdir(local_widgets))
missing_widget_items = sorted(remote_widget_items - local_widget_items)
widget_ids = sorted({
    item[:-6] if item.endswith('.right')
    else item[:-4] if item.endswith('.zip')
    else item
    for item in missing_widget_items
})

for name in missing_aod:
    subprocess.run(['adb', 'pull', f'{remote_aod_meta}/{name}', str(local_aod_meta / name)], check=True)
    mrc = name[:-4] + '.mrc'
    subprocess.run(['adb', 'pull', f'{remote_aod_content}/{mrc}', str(local_aod_content / mrc)], check=True)

for wid in widget_ids:
    for suffix in ['', '.right', '.zip']:
        remote_path = f'{remote_widgets}/{wid}{suffix}'
        exists = subprocess.run(['adb', 'shell', 'ls', '-A', remote_path], capture_output=True, text=True)
        if exists.returncode == 0:
            subprocess.run(['adb', 'pull', remote_path, str(local_widgets / f'{wid}{suffix}')], check=True)

print('done')
PY
```

## 生成运行时静态资源

把原始资源拉到 `themes/` 后，需要重新生成 `public/themes`：

```bash
python3 scripts/prepare-themes.py --all-themes
```

脚本输入输出关系：

- 输入：`themes/`
- 输出：`public/themes/manifest.json`
- 输出：`public/themes/<themeId>/...`

如果只想用脚本默认白名单主题，也可以直接运行：

```bash
python3 scripts/prepare-themes.py
```

## 验证方式

### 看生成结果

```bash
python3 - <<'PY'
import json
from pathlib import Path

manifest = json.loads(Path('public/themes/manifest.json').read_text(encoding='utf-8'))
print('themes', len(manifest.get('themes', [])))
print('fonts', len(manifest.get('fonts', [])))
print('aod', len(manifest.get('aod', [])))
print('widgets', len(manifest.get('widgets', [])))
PY
```

### 看 ThemeStore 页面

ThemeStore 运行时读取 `public/themes`。如果页面提示：

```text
未发现资源。请先运行 python3 scripts/prepare-themes.py 生成 public/themes。
```

说明原始资源已经有了，但静态产物还没生成，或者生成目录为空。

## Git 注意事项

当前 `.gitignore` 对主题资源的策略是：

- `themes/` 整体忽略
- `public/themes/*` 默认忽略
- `public/themes/manifest.json` 不忽略
- `public/themes/acf4966f-3fd8-460a-93d7-a315ab35003d/` 不忽略

这意味着：

1. 从手机拉回来的原始资源通常不会直接出现在 Git 变更里
2. 重新运行 `python3 scripts/prepare-themes.py --all-themes` 后，`public/themes/manifest.json` 会更新
3. 如果脚本重建了 `public/themes/acf4966f-3fd8-460a-93d7-a315ab35003d/`，这个已跟踪目录也可能出现变更

如果你只想同步原始资源，不想动仓库里已跟踪的 `public/themes` 文件，需要在运行生成脚本前先确认是否接受这些改动。

## 本次已验证的新增资源类型

这次实际对比已验证：

- `meta/theme` 无新增
- `meta/fonts` 无新增
- `meta/aod` 有新增时，需要同时拉 `themes/meta/aod` 和 `themes/content/aod`
- `maml.widget` 有新增时，需要同时拉目录本体、`.right`、`.zip`

因此，后续遇到“手机里主题资源变多了”，推荐优先检查：

1. `meta/aod`
2. `maml.widget`
3. `meta/theme`
4. `meta/fonts`
