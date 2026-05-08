# APK 设计提取自动化工具链

## 1. 概述

将反编译 APK 的设计资源 + 运行时 UI Dump 结合，自动生成可用于 React 项目的设计系统文件和组件骨架。

```
APK 反编译 (apktool)
    ↓
┌─────────────────────────────────────────────┐
│  1. 提取 colors.xml → 颜色 Token            │
│  2. 提取 dimens.xml → 尺寸 Token            │
│  3. 提取 strings.xml → 文本常量             │
│  4. 复制 drawable → 图片资源                │
│  5. 提取 styles.xml → 组件样式              │
└─────────────────────────────────────────────┘
    ↓
UI Dump (运行时，已有脚本 dump_ui_layout.py)
    ↓
┌─────────────────────────────────────────────┐
│  6. 解析布局层级 → React 组件骨架            │
│  7. 提取元素位置/尺寸 → CSS 样式            │
│  8. 匹配 APK 资源 ID → 精确设计参数         │
└─────────────────────────────────────────────┘
    ↓
生成输出
    ↓
┌─────────────────────────────────────────────┐
│  design-tokens.ts  (颜色/尺寸/字号常量)      │
│  strings.ts        (文本常量)               │
│  components/       (React 组件骨架)          │
│  public/assets/    (图片资源)               │
└─────────────────────────────────────────────┘
```

---

## 2. 已有基础

### 2.1 dump_ui_layout.py 已实现的功能

- `parse_apk_dimens()` - 解析 `dimens.xml`
- `parse_apk_colors()` - 解析 `colors.xml`
- `parse_apk_layouts()` - 解析 `layout/*.xml` 中的 `textSize`, `textColor`, `padding`
- `enrich_from_apk()` - 将 APK 数据与运行时 UI 元素匹配
- `generate_html()` / `generate_report()` - 可视化输出

### 2.2 已有的反编译资源 (Weather_decompiled/)

```
Weather_decompiled/
├── res/
│   ├── values/
│   │   ├── colors.xml      (1647 行, ~800 个颜色定义)
│   │   ├── dimens.xml      (2430 行, ~2400 个尺寸定义)
│   │   ├── strings.xml     (972 行)
│   │   ├── styles.xml      (组件样式定义)
│   │   ├── attrs.xml       (自定义属性)
│   │   └── ...
│   ├── values-night/       (夜间模式颜色)
│   ├── values-zh-rCN/      (中文字符串)
│   ├── layout/             (338 个布局 XML)
│   ├── drawable-xxxhdpi/   (3x 密度图片, 141 个)
│   ├── drawable-xxhdpi/    (2x 密度图片)
│   ├── drawable-nodpi/     (无缩放图片)
│   └── color/              (颜色状态列表)
├── assets/
│   ├── fonts/              (自定义字体 .otf)
│   └── shaders/            (OpenGL 动画)
└── AndroidManifest.xml
```

---

## 3. design-tokens.ts 生成方案

### 3.1 目标输出格式

```typescript
// apps/Weather/design-tokens.ts
// 由 scripts/extract_design_tokens.py 自动生成
// 源: Weather_decompiled/res/values/

// ============================================================
// 颜色 Token
// ============================================================

export const colors = {
  // --- 主背景 ---
  mainBg: '#121A33',                    // 手动确认的主背景色

  // --- AQI 相关 ---
  aqiDangerous: '#7e34ab',             // aqi_dangerous
  aqiDangerousStroke: '#64258b',       // aqi_dangerous_stroke
  aqiDetailDateDesc: 'rgba(255,255,255,0.7)',   // #b3ffffff → aqi_detail_date_desc_color
  aqiDetailFirstDesc: 'rgba(255,255,255,0.9)',  // #e6ffffff → aqi_detail_first_desc_color
  aqiDetailLevel1Bg: '#e8fbed',        // aqi_detail_level1_background_color
  aqiDetailLevel1Text: '#13cf80',      // aqi_detail_level1_text_color
  aqiDetailLevel2Bg: '#fff4d6',
  aqiDetailLevel2Text: '#ffb950',
  aqiDetailLevel3Bg: '#ffeedf',
  aqiDetailLevel3Text: '#ff8450',
  aqiDetailLevel4Bg: '#ffe4e2',
  aqiDetailLevel4Text: '#ff6d64',
  aqiDetailLevel5Bg: '#f4e2ff',
  aqiDetailLevel5Text: '#ab6cd2',
  aqiDetailLevel6Bg: '#edd3fd',
  aqiDetailLevel6Text: '#7e34ab',

  // --- 预警 ---
  alertText: '#ffffff',                 // activity_alert_text_color
  alertDetailPubtime: 'rgba(0,0,0,0.4)', // #65000000 → activity_alert_detail_pubtime_text_color

  // --- 广告卡片 ---
  adCardButtonRound: 'rgba(255,255,255,0.5)',  // #80ffffff
  adCardButtonRound2: 'rgba(255,255,255,0.2)', // #33ffffff

  // --- 通用 ---
  white100: '#ffffff',
  white90: 'rgba(255,255,255,0.9)',     // #e6ffffff
  white80: 'rgba(255,255,255,0.8)',     // #ccffffff
  white70: 'rgba(255,255,255,0.7)',     // #b3ffffff
  white60: 'rgba(255,255,255,0.6)',     // #99ffffff
  white50: 'rgba(255,255,255,0.5)',     // #80ffffff
  white40: 'rgba(255,255,255,0.4)',     // #66ffffff
  white30: 'rgba(255,255,255,0.3)',     // #4dffffff
  white20: 'rgba(255,255,255,0.2)',     // #33ffffff
  white10: 'rgba(255,255,255,0.1)',     // #1affffff
  white5: 'rgba(255,255,255,0.05)',     // #0dffffff
} as const;

// ============================================================
// 尺寸 Token (dp → CSS px, 1dp = 1px in our 360px viewport)
// ============================================================

export const dimens = {
  // --- 顶部标题栏 ---
  mainTitleImgSize: 40,                 // activity_weather_main_title_img_size: 40dp
  mainTitleAddImgSize: 40,              // activity_weather_main_title_add_img_size: 40dp
  mainTitleMoreImgSize: 37,             // activity_weather_main_title_more_img_size: 37dp
  mainTitleImgMarginEnd: 16,            // activity_weather_main_title_img_margin_end: 16dp
  mainTitleImgMarginStart: 13,          // activity_weather_main_title_img_margin_start: 13dp
  mainTitleImgPadding: 9,               // activity_weather_main_title_img_padding: 9dp
  mainCityNameSize: 18,                 // activity_weather_main_city_name_size: 18dp

  // --- 温度显示 ---
  mainTemperatureMarginTop: 10,         // layout_main_temperature_margin_top: 10dp
  mainTemperatureMarginLeft: 8,         // main_temperature_margin_left: 8dp
  mainTemperatureAqiViewHeight: 230,    // main_temperature_aqi_view_height: 230dp
  mainTemperatureAqiViewMarginTop: 216, // main_temperature_aqi_view_margin_top: 216dp
  mainTemperatureAqiCityMarginTop: 33,  // main_temperature_aqi_city_margin_top: 33dp

  // --- AQI ---
  aqiValueTextSize: 66,                 // aqi_value_text_size: 66sp (大字 AQI)
  aqiDescTextSize: 20.36,               // aqi_desc_text_size: 20.36sp
  aqiMainViewTextSize: 13.82,           // aqi_main_view_text_size: 13.82sp
  aqiMainViewImageSize: 12.73,          // aqi_main_view_image_size: 12.73dp
  aqiMainViewHeight: 29.09,             // aqi_main_view_height: 29.09dp
  aqiIndicatorHeight: 36,               // aqi_indicator_height: 36dp
  aqiIndicatorWidth: 104,               // aqi_indicator_width: 104dp

  // --- 每日预报 ---
  dailyForecastMarginStart: 23.3,       // daily_forecast_margin_start: 23.3dp
  dailyForecastCardMarginTop: 12,       // daily_forecast_card_margin_top: 12dp
  dailyForecastMinHeight: 184,          // daily_forecast_min_height: 184dp
  dailyForecastMoreTextSize: 17,        // daily_forecast_more_text_size: 17sp
  dailyForecastItemTempTextSize: 14,    // daily_forecast_item_temperature_text_size: 14dp
  dailyForecastItemWeatherTextSize: 16, // daily_forecast_item_weather_text_size: 16dp
  dailyForecastItemIconSize: 24,        // daily_forecast_item_weather_type_icon_size: 24dp
  dailyForecastItemContentHeight: 23,   // daily_forecast_item_content_height: 23dp
  dailyForecastSplitLineHeight: 0.36,   // daily_forecast_split_line_height: 0.36dp

  // --- 首页每日预报卡片 ---
  homeDailyForecastHeight: 224,         // home_daily_forecast_height: 224dp
  homeDailyForecastPaddingTop: 20,      // home_daily_forecast_padding_top: 20dp
  homeDailyForecastMarginStart: 20,     // home_daily_forecast_margin_start: 20dp
  homeDailyForecastMarginEnd: 20,       // home_daily_forecast_margin_end: 20dp
  homeDailyForecastItemHeight: 45.26,   // home_daily_forecast_item_height: 45.26dp
  homeDailyForecastMoreHeight: 48,      // home_daily_forecast_more_height: 48dp
  homeDailyForecastTitleHeight: 27,     // home_daily_forecast_title_height: 27dp

  // --- 预警 ---
  alertTextSize: 16,                    // activity_alert_size: 16sp
  alertMainTextSize: 12,                // activity_main_alert_text_size: 12sp
  alertContainerIconSize: 18,           // alert_container_icon_size: 18dp
  alertDetailTextSize: 14,              // alert_container_detail_text_size: 14sp

  // --- 卡片通用 ---
  cardRadius: 18,                       // daily_forecast_detail_card_exp_bg_radius: 18dp
  cardMarginHorizontal: 20,             // home_daily_forecast_margin_start/end: 20dp
} as const;

// ============================================================
// 字体大小 Token (sp → CSS px)
// ============================================================

export const fontSizes = {
  xs: 10,          // 10sp - 更新时间、次要信息
  sm: 12,          // 12sp - 预警副文本、AQI 标签
  base: 14,        // 14sp - 正文、温度数字
  md: 16,          // 16sp - 天气描述、日期
  lg: 17,          // 17sp - 查看更多
  xl: 18,          // 18sp - 城市名、标题
  '2xl': 20.36,    // 20.36sp - AQI 描述
  '4xl': 66,       // 66sp - AQI 大数值
} as const;

// ============================================================
// 类型定义
// ============================================================

export type ColorToken = keyof typeof colors;
export type DimenToken = keyof typeof dimens;
export type FontSizeToken = keyof typeof fontSizes;
```

### 3.2 ARGB 颜色转换

Android `colors.xml` 使用 `#AARRGGBB` 格式（8位），需要转换为 CSS 格式：

```
#e6ffffff  →  rgba(255, 255, 255, 0.9)    // AA=0xe6=230, 230/255≈0.9
#b3ffffff  →  rgba(255, 255, 255, 0.7)    // AA=0xb3=179, 179/255≈0.7
#80ffffff  →  rgba(255, 255, 255, 0.5)    // AA=0x80=128, 128/255≈0.5
#40ffffff  →  rgba(255, 255, 255, 0.25)   // AA=0x40=64, 64/255≈0.25
#65000000  →  rgba(0, 0, 0, 0.4)          // AA=0x65=101, 101/255≈0.4
#cc000000  →  rgba(0, 0, 0, 0.8)          // AA=0xcc=204, 204/255≈0.8
```

转换公式：

```python
def argb_to_css(hex_color: str) -> str:
    """将 Android #AARRGGBB 转为 CSS rgba() 或 #RRGGBB"""
    hex_color = hex_color.lstrip('#')

    if len(hex_color) == 8:
        # #AARRGGBB
        a = int(hex_color[0:2], 16)
        r = int(hex_color[2:4], 16)
        g = int(hex_color[4:6], 16)
        b = int(hex_color[6:8], 16)
        if a == 255:
            return f'#{hex_color[2:]}'          # 不透明，简写
        alpha = round(a / 255, 2)
        return f'rgba({r},{g},{b},{alpha})'
    elif len(hex_color) == 6:
        return f'#{hex_color}'
    else:
        return hex_color  # 无法解析，原样返回
```

### 3.3 dp/sp → CSS px 转换

在我们的项目中（视口 360px = 360dp），**1dp = 1px**，所以数值可以直接使用。

```
设备物理分辨率: 1080 × 2400 px
设备 DPI: 480 (3x density)
逻辑视口: 1080/3 = 360dp × 800dp

项目 CSS 视口: 360px × 800px
→ 1dp ≈ 1px (CSS)
```

注意事项：
- `dp` 直接取数值作为 CSS px
- `sp` 在默认 fontScale=1.0 时等价于 dp，取数值作为 CSS px
- 如果实现了 `fontScale` 缩放（参见 DISPLAY_SCALING.md），`sp` 类型的值需要乘以 `fontScale`

---

## 4. 实现脚本

### 4.1 脚本入口

新建 `scripts/extract_design_tokens.py`：

```python
#!/usr/bin/env python3
"""
从反编译 APK 提取设计 Token，生成 TypeScript 设计系统文件。

使用方法:
  python scripts/extract_design_tokens.py \
    --apk-res Weather_decompiled/res \
    --output apps/Weather/design-tokens.ts

可选参数:
  --filter <prefix>     只提取匹配前缀的 token (如 aqi_,daily_forecast_,alert_)
  --strings             同时生成 strings.ts
  --strings-locale zh-rCN  字符串使用的 locale (默认: zh-rCN)
  --copy-assets         复制图片资源到 public/
  --density <float>     设备密度 (默认: 3.0, 即 480dpi)
"""

import xml.etree.ElementTree as ET
import re
import json
from pathlib import Path
import argparse
import shutil
```

### 4.2 核心函数

```python
# ==================================================
# 1. 颜色提取
# ==================================================

def parse_colors(res_dir: Path) -> dict[str, dict]:
    """
    解析 colors.xml，返回:
    {
      "aqi_dangerous": {
        "android_value": "#ff7e34ab",
        "css_value": "#7e34ab",
        "alpha": 1.0,
        "r": 126, "g": 52, "b": 171
      },
      ...
    }
    """
    colors = {}
    for variant in ["values", "values-night"]:
        path = res_dir / variant / "colors.xml"
        if not path.exists():
            continue
        tree = ET.parse(path)
        suffix = "_night" if "night" in variant else ""
        for elem in tree.getroot().iter("color"):
            name = elem.get("name", "")
            val = (elem.text or "").strip()
            if not name or not val:
                continue
            # 跳过引用类型 (@color/xxx, @android:color/xxx)
            if val.startswith("@"):
                continue
            parsed = parse_android_color(val)
            if parsed:
                colors[name + suffix] = parsed
    return colors


def parse_android_color(hex_str: str) -> dict | None:
    """解析 Android 颜色 #AARRGGBB 或 #RRGGBB"""
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 8:
        a, r, g, b = [int(hex_str[i:i+2], 16) for i in (0, 2, 4, 6)]
    elif len(hex_str) == 6:
        a, r, g, b = 255, *[int(hex_str[i:i+2], 16) for i in (0, 2, 4)]
    else:
        return None

    alpha = round(a / 255, 2)
    if alpha == 1.0:
        css = f'#{hex_str[-6:]}'
    else:
        css = f'rgba({r},{g},{b},{alpha})'

    return {
        "android_value": f"#{hex_str}",
        "css_value": css,
        "alpha": alpha,
        "r": r, "g": g, "b": b,
    }


# ==================================================
# 2. 尺寸提取
# ==================================================

def parse_dimens(res_dir: Path) -> dict[str, dict]:
    """
    解析 dimens.xml，返回:
    {
      "activity_weather_main_city_name_size": {
        "raw": "18.0dip",
        "value": 18.0,
        "unit": "dp",
        "css_px": 18.0,       # 在 360px 视口下
        "is_text_size": True,  # sp 单位表示文字
      },
      ...
    }
    """
    dimens = {}
    path = res_dir / "values" / "dimens.xml"
    if not path.exists():
        return dimens

    tree = ET.parse(path)
    for elem in tree.getroot():
        name = elem.get("name", "")
        val = (elem.text or "").strip()
        if not name or not val:
            continue
        # 跳过引用和百分比
        if val.startswith("@") or val.endswith("%"):
            continue

        m = re.match(r'^([\-\d.]+)\s*(dip|dp|sp|px)?$', val)
        if not m:
            continue

        num = float(m.group(1))
        unit = m.group(2) or "px"
        if unit == "dip":
            unit = "dp"

        # 在 360px = 360dp 的视口下，1dp = 1px
        css_px = num  # dp/sp → 直接等于 CSS px

        dimens[name] = {
            "raw": val,
            "value": num,
            "unit": unit,
            "css_px": css_px,
            "is_text_size": unit == "sp",
        }

    return dimens


# ==================================================
# 3. 字符串提取
# ==================================================

def parse_strings(res_dir: Path, locale: str = "zh-rCN") -> dict[str, str]:
    """解析 strings.xml (指定 locale)"""
    strings = {}
    # 优先使用指定 locale
    path = res_dir / f"values-{locale}" / "strings.xml"
    if not path.exists():
        path = res_dir / "values" / "strings.xml"
    if not path.exists():
        return strings

    tree = ET.parse(path)
    for elem in tree.getroot().iter("string"):
        name = elem.get("name", "")
        # 处理带子元素的 string (如 <b>粗体</b>)
        val = "".join(elem.itertext()).strip()
        if name and val:
            strings[name] = val
    return strings


# ==================================================
# 4. 样式提取 (styles.xml)
# ==================================================

def parse_styles(res_dir: Path) -> dict[str, dict]:
    """
    解析 styles.xml，提取组件样式定义。
    返回 style_name -> { parent, items: { attr: value } }
    """
    styles = {}
    path = res_dir / "values" / "styles.xml"
    if not path.exists():
        return styles

    tree = ET.parse(path)
    for style in tree.getroot().iter("style"):
        name = style.get("name", "")
        parent = style.get("parent", "")
        items = {}
        for item in style.iter("item"):
            attr_name = item.get("name", "")
            attr_val = (item.text or "").strip()
            if attr_name and attr_val:
                items[attr_name] = attr_val
        if name:
            styles[name] = {"parent": parent, "items": items}
    return styles


# ==================================================
# 5. 图片资源复制
# ==================================================

def copy_drawable_assets(
    res_dir: Path,
    output_dir: Path,
    density_folder: str = "drawable-xxxhdpi"
):
    """
    复制指定密度的图片资源。
    优先 xxxhdpi (3x)，回退 xxhdpi (2x)，再回退 nodpi。
    """
    fallback_order = [density_folder, "drawable-xxhdpi", "drawable-nodpi", "drawable"]
    copied = 0

    output_dir.mkdir(parents=True, exist_ok=True)

    for folder_name in fallback_order:
        folder = res_dir / folder_name
        if not folder.exists():
            continue
        for f in folder.iterdir():
            if f.suffix.lower() in ('.png', '.webp', '.jpg', '.jpeg'):
                dest = output_dir / f.name
                if not dest.exists():
                    shutil.copy2(f, dest)
                    copied += 1

    return copied


# ==================================================
# 6. TypeScript 代码生成
# ==================================================

def generate_design_tokens_ts(
    colors: dict,
    dimens: dict,
    output_path: Path,
    filter_prefixes: list[str] | None = None,
):
    """生成 design-tokens.ts"""

    def should_include(name: str) -> bool:
        if not filter_prefixes:
            return True
        return any(name.startswith(p) for p in filter_prefixes)

    def to_camel(name: str) -> str:
        """snake_case → camelCase"""
        parts = name.split('_')
        return parts[0] + ''.join(p.capitalize() for p in parts[1:])

    lines = [
        '// 由 scripts/extract_design_tokens.py 自动生成',
        '// 请勿手动修改此文件',
        f'// 源: Weather_decompiled/res/values/',
        '',
        '// ============================================================',
        '// 颜色 Token',
        '// ============================================================',
        '',
        'export const colors = {',
    ]

    # 按前缀分组
    color_groups: dict[str, list] = {}
    for name, info in sorted(colors.items()):
        if not should_include(name):
            continue
        prefix = name.split('_')[0] if '_' in name else 'misc'
        color_groups.setdefault(prefix, []).append((name, info))

    for prefix, items in sorted(color_groups.items()):
        lines.append(f'  // --- {prefix} ---')
        for name, info in items:
            camel = to_camel(name)
            lines.append(f"  {camel}: '{info['css_value']}',")
        lines.append('')

    lines.append('} as const;')
    lines.append('')

    # 尺寸
    lines.extend([
        '// ============================================================',
        '// 尺寸 Token (dp → CSS px, 1dp ≈ 1px in 360px viewport)',
        '// ============================================================',
        '',
        'export const dimens = {',
    ])

    dimen_groups: dict[str, list] = {}
    for name, info in sorted(dimens.items()):
        if not should_include(name):
            continue
        prefix = name.split('_')[0] if '_' in name else 'misc'
        dimen_groups.setdefault(prefix, []).append((name, info))

    for prefix, items in sorted(dimen_groups.items()):
        lines.append(f'  // --- {prefix} ---')
        for name, info in items:
            camel = to_camel(name)
            val = info['css_px']
            # 整数不加小数点
            val_str = str(int(val)) if val == int(val) else str(round(val, 2))
            unit_comment = f" // {info['raw']}"
            sp_tag = " [sp/文字]" if info.get('is_text_size') else ""
            lines.append(f"  {camel}: {val_str},{unit_comment}{sp_tag}")
        lines.append('')

    lines.append('} as const;')
    lines.append('')

    # 类型导出
    lines.extend([
        '// ============================================================',
        '// 类型定义',
        '// ============================================================',
        '',
        'export type ColorToken = keyof typeof colors;',
        'export type DimenToken = keyof typeof dimens;',
    ])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text('\n'.join(lines), encoding='utf-8')
    return len(colors), len(dimens)


def generate_strings_ts(
    strings: dict,
    output_path: Path,
    filter_prefixes: list[str] | None = None,
):
    """生成 strings.ts"""

    def should_include(name: str) -> bool:
        if not filter_prefixes:
            return True
        return any(name.startswith(p) for p in filter_prefixes)

    def to_camel(name: str) -> str:
        parts = name.split('_')
        return parts[0] + ''.join(p.capitalize() for p in parts[1:])

    lines = [
        '// 由 scripts/extract_design_tokens.py 自动生成',
        '',
        'export const strings = {',
    ]

    for name, val in sorted(strings.items()):
        if not should_include(name):
            continue
        camel = to_camel(name)
        escaped = val.replace("'", "\\'").replace('\n', '\\n')
        lines.append(f"  {camel}: '{escaped}',")

    lines.append('} as const;')

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text('\n'.join(lines), encoding='utf-8')
    return len(strings)
```

### 4.3 主函数

```python
def main():
    parser = argparse.ArgumentParser(description="APK Design Token Extractor")
    parser.add_argument("--apk-res", required=True, help="反编译 APK 的 res 目录")
    parser.add_argument("--output", default="design-tokens.ts", help="输出文件路径")
    parser.add_argument("--filter", nargs="*", help="只提取匹配前缀的 token")
    parser.add_argument("--strings", action="store_true", help="同时生成 strings.ts")
    parser.add_argument("--strings-locale", default="zh-rCN", help="字符串 locale")
    parser.add_argument("--copy-assets", action="store_true", help="复制图片资源")
    parser.add_argument("--assets-output", default="public/weather-assets", help="图片资源输出目录")
    args = parser.parse_args()

    res_dir = Path(args.apk_res)
    if not res_dir.exists():
        print(f"错误: 目录不存在: {res_dir}")
        return

    print("=" * 50)
    print("APK Design Token Extractor")
    print("=" * 50)

    # 提取颜色
    print("\n[1/4] 解析 colors.xml ...")
    color_data = parse_colors(res_dir)
    print(f"  → {len(color_data)} 个颜色")

    # 提取尺寸
    print("[2/4] 解析 dimens.xml ...")
    dimen_data = parse_dimens(res_dir)
    print(f"  → {len(dimen_data)} 个尺寸")

    # 生成 design-tokens.ts
    print("[3/4] 生成 design-tokens.ts ...")
    output_path = Path(args.output)
    nc, nd = generate_design_tokens_ts(
        color_data, dimen_data, output_path,
        filter_prefixes=args.filter
    )
    print(f"  → {output_path} ({nc} colors, {nd} dimens)")

    # 可选: 生成 strings.ts
    if args.strings:
        print("[3.5] 解析 strings.xml ...")
        string_data = parse_strings(res_dir, locale=args.strings_locale)
        strings_path = output_path.parent / "strings.ts"
        ns = generate_strings_ts(string_data, strings_path, filter_prefixes=args.filter)
        print(f"  → {strings_path} ({ns} strings)")

    # 可选: 复制图片资源
    if args.copy_assets:
        print("[4/4] 复制图片资源 ...")
        assets_dir = Path(args.assets_output)
        copied = copy_drawable_assets(res_dir, assets_dir)
        print(f"  → {assets_dir}/ ({copied} files)")

    print("\n" + "=" * 50)
    print("完成!")
    print("=" * 50)
```

---

## 5. 使用方式

### 5.1 基本用法

```bash
# 提取所有 Token
python scripts/extract_design_tokens.py \
  --apk-res Weather_decompiled/res \
  --output apps/Weather/design-tokens.ts

# 只提取天气相关的 Token
python scripts/extract_design_tokens.py \
  --apk-res Weather_decompiled/res \
  --output apps/Weather/design-tokens.ts \
  --filter aqi_ daily_forecast_ alert_ activity_weather_ main_temperature_ home_daily_

# 同时生成字符串和复制图片
python scripts/extract_design_tokens.py \
  --apk-res Weather_decompiled/res \
  --output apps/Weather/design-tokens.ts \
  --strings --strings-locale zh-rCN \
  --copy-assets --assets-output public/weather-assets
```

### 5.2 结合 UI Dump 使用

```bash
# 1. 先做 UI Dump（获取运行时布局）
python scripts/dump_ui_layout.py \
  --apk-res Weather_decompiled/res

# 2. 再提取设计 Token（获取精确设计参数）
python scripts/extract_design_tokens.py \
  --apk-res Weather_decompiled/res \
  --output apps/Weather/design-tokens.ts

# 3. 在组件中引用 Token
```

### 5.3 在 React 组件中使用

```tsx
import { colors, dimens } from './design-tokens';

function DailyForecast() {
  return (
    <div
      style={{
        marginTop: dimens.dailyForecastCardMarginTop,
        paddingLeft: dimens.homeDailyForecastMarginStart,
        minHeight: dimens.dailyForecastMinHeight,
      }}
    >
      <span
        style={{
          fontSize: dimens.dailyForecastItemWeatherTextSize,
          color: colors.white90,
        }}
      >
        多云
      </span>
    </div>
  );
}
```

或者配合 Tailwind 使用 CSS 变量：

```tsx
// 在 tailwind.config.js 中引用
// theme.extend.colors: { 'aqi-good': 'var(--color-aqi-good)' }

// 在根组件注入 CSS 变量
import { colors } from './design-tokens';

function injectCSSVars() {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, val]) => {
    root.style.setProperty(`--color-${toKebab(key)}`, val);
  });
}
```

---

## 6. 进阶：UI Dump → React 组件骨架

### 6.1 思路

UI Dump 提供运行时的实际布局层级，可以据此生成 React 组件的**骨架代码**：

```
运行时 UI 元素               →  React 组件
─────────────────────────────────────────────
android.widget.LinearLayout  →  <div className="flex flex-col">
android.widget.TextView      →  <span style={{fontSize: ...}}>
android.widget.ImageView     →  <img src={...} />
android.widget.RecyclerView  →  <div className="overflow-auto">
android.widget.FrameLayout   →  <div className="relative">
android.widget.ScrollView    →  <div className="overflow-y-auto">
```

### 6.2 映射规则

```python
WIDGET_MAP = {
    'android.widget.LinearLayout': {
        'tag': 'div',
        'class': lambda props: 'flex flex-col' if props.get('orientation') == 'vertical' else 'flex',
    },
    'android.widget.FrameLayout': {
        'tag': 'div',
        'class': 'relative',
    },
    'android.widget.TextView': {
        'tag': 'span',
        'class': '',
        'text': True,
    },
    'android.widget.ImageView': {
        'tag': 'img',
        'class': '',
        'src': True,
    },
    'android.widget.RecyclerView': {
        'tag': 'div',
        'class': 'overflow-auto',
    },
    'android.widget.ScrollView': {
        'tag': 'div',
        'class': 'overflow-y-auto',
    },
    'android.widget.HorizontalScrollView': {
        'tag': 'div',
        'class': 'overflow-x-auto',
    },
}
```

### 6.3 限制

自动生成的组件骨架只是**起点**，不能直接使用，原因：

1. **交互逻辑缺失** - UI Dump 只有静态结构，没有事件处理
2. **数据绑定缺失** - 不知道哪些文本是动态的
3. **滚动/动画** - 复杂的嵌套滚动和动画无法从静态 dump 推导
4. **样式近似** - 有些样式是代码动态设置的，XML 中不包含
5. **状态管理** - 组件的展开/折叠/切换等状态无法从单次 dump 获取

推荐流程：

```
自动生成骨架 → 手动调整结构 → 引用 design-tokens → 添加交互逻辑
```

---

## 7. 完整工作流

```
┌─────────────────────────────────────────┐
│ Step 1: 反编译 APK                       │
│   apktool d weather.apk -o Weather_dec  │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ Step 2: 提取设计 Token                   │
│   python extract_design_tokens.py       │
│   → design-tokens.ts                    │
│   → strings.ts (可选)                    │
│   → public/weather-assets/ (可选)        │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ Step 3: 运行时 UI Dump                   │
│   python dump_ui_layout.py --apk-res .. │
│   → layout_preview.html (可视化)         │
│   → layout_report.md (尺寸参考)          │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ Step 4: 手动构建 React 组件              │
│   参考 layout_preview.html 的布局        │
│   引用 design-tokens.ts 的精确值         │
│   引用 strings.ts 的文本内容             │
│   使用 public/weather-assets/ 的图片     │
└─────────────────────────────────────────┘
```

---

## 8. Token 过滤建议

`dimens.xml` 和 `colors.xml` 包含大量不相关的值（广告 SDK、Material 库、第三方库等）。建议按前缀过滤：

### 天气应用相关前缀

```bash
--filter \
  activity_weather_ \
  main_temperature_ \
  aqi_ \
  daily_forecast_ \
  home_daily_ \
  hour_ \
  alert_ \
  minute_rain_ \
  life_index_ \
  widget_ \
  home_card_
```

### 应排除的前缀

```
abc_           # AndroidX/Material 库默认值
ad_            # 广告 SDK
design_        # Material Design 库
mtrl_          # Material 组件库
miuix_         # MIUI 系统主题
notification_  # 系统通知
```

---

## 9. 注意事项

1. **颜色引用链**：`colors.xml` 中有些值是引用（`@color/xxx`），需要递归解析
2. **夜间模式**：`values-night/colors.xml` 有独立的颜色定义，可以同时生成
3. **多密度图片**：我们的设备是 3x (480dpi)，优先使用 `drawable-xxxhdpi`
4. **资源 ID 匹配**：UI Dump 的 `resource-id` 格式是 `com.miui.weather2:id/xxx`，需要提取 `xxx` 部分与 APK layout 中的 `@+id/xxx` 匹配
5. **动态值**：有些尺寸/颜色是代码中动态计算的，APK 资源中没有，这些需要从 UI Dump 的运行时数据获取
6. **字体文件**：`assets/` 目录下的 `.otf` 字体可以直接在项目中使用（`@font-face`）
