#!/usr/bin/env python3
"""
Android 前台应用 APK 提取 & 反编译工具

自动检测当前前台应用，从手机提取 APK 文件到 apks/ 目录，
然后使用 apktool 反编译到 decompiled/ 目录。

使用方法:
  python scripts/reverse/extract_and_decompile.py

可选参数:
  --package PKG     直接指定包名（跳过自动检测）
  --serial SERIAL   指定 adb 设备序列号
  --apk-only        仅提取 APK，不反编译
  --decompile-only  仅反编译 apks/ 目录中已有的 APK（需要 --package）
  --force           强制覆盖已有的反编译目录
  --no-res          反编译时不解码资源（更快，仅看 smali）
  --no-src          反编译时不反编译 smali（仅看资源）

依赖:
  - adb (Android Debug Bridge)
  - apktool (https://apktool.org/)
  - Python 3.x
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parents[2]
APKS_DIR = PROJECT_ROOT / "apks"
DECOMPILED_DIR = PROJECT_ROOT / "decompiled"


def run_adb(command: list[str], timeout: int = 30, serial: str | None = None) -> tuple[bool, str]:
    """运行 adb 命令，返回 (成功, 输出)"""
    adb_cmd = ["adb"]
    if serial:
        adb_cmd += ["-s", serial]
    try:
        result = subprocess.run(
            adb_cmd + command,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode == 0, result.stdout + result.stderr
    except FileNotFoundError:
        return False, "错误: 未找到 adb 命令，请确保已安装 Android SDK Platform Tools"
    except subprocess.TimeoutExpired:
        return False, "错误: adb 命令超时"


def check_device(serial: str | None = None) -> tuple[bool, str | None]:
    """检查设备连接，返回 (成功, 设备序列号)"""
    success, output = run_adb(["devices", "-l"])
    if not success:
        print(f"  {output}")
        return False, None

    lines = output.strip().split("\n")
    devices = [line.strip() for line in lines[1:] if line.strip()]

    if serial:
        for line in devices:
            cols = line.split()
            if cols and cols[0] == serial and len(cols) > 1 and cols[1] == "device":
                return True, serial
        print(f"错误: 未找到指定设备: {serial}")
        return False, None

    usable = []
    for line in devices:
        cols = line.split()
        if len(cols) >= 2 and cols[1] == "device":
            usable.append(cols[0])

    if not usable:
        print("错误: 未检测到已连接且可用的设备")
        print("请确保:")
        print("  1. 手机已通过 USB 连接")
        print("  2. 已开启 USB 调试")
        print("  3. 已在手机上授权此电脑")
        return False, None

    return True, usable[0]


def get_foreground_package(serial: str | None = None) -> str | None:
    """获取当前前台应用的包名"""
    # 方法1: dumpsys activity activities 查找 ResumedActivity
    success, output = run_adb(
        ["shell", "dumpsys", "activity", "activities"],
        timeout=10,
        serial=serial,
    )
    if success:
        for line in output.split("\n"):
            if "ResumedActivity" in line or "mFocusedActivity" in line:
                # 格式: "mResumedActivity: ActivityRecord{xxx u0 com.pkg/.Activity t123}"
                m = re.search(r"(\S+)/\S+\s+t\d+", line)
                if m:
                    return m.group(1)

    # 方法2: dumpsys window
    success, output = run_adb(
        ["shell", "dumpsys", "window", "windows"],
        timeout=10,
        serial=serial,
    )
    if success:
        for line in output.split("\n"):
            if "mCurrentFocus" in line or "mFocusedApp" in line:
                m = re.search(r"(\S+)/\S+", line)
                if m:
                    pkg = m.group(1)
                    # 过滤掉 Window 名等非包名
                    if "." in pkg and not pkg.startswith("Window"):
                        return pkg

    return None


def get_app_label(package: str, serial: str | None = None) -> str:
    """尝试获取应用的显示名称（用于命名文件）"""
    success, output = run_adb(
        ["shell", "dumpsys", "package", package],
        timeout=10,
        serial=serial,
    )
    if success:
        # 在 Activity Resolver Table 中查找 label
        for line in output.split("\n"):
            stripped = line.strip()
            # 查找 "非默认 label" 指向
            if "labelRes=" in stripped:
                m = re.search(r"labelRes=\S+ label=(\S+)", stripped)
                if m:
                    label = m.group(1)
                    if label and label != "null":
                        return label
    # 降级: 用包名最后一段
    parts = package.split(".")
    return parts[-1].capitalize() if parts else package


def get_apk_paths(package: str, serial: str | None = None) -> list[str]:
    """获取包名对应的 APK 文件路径（可能有多个 split APK）"""
    success, output = run_adb(
        ["shell", "pm", "path", package],
        timeout=10,
        serial=serial,
    )
    if not success:
        return []

    paths = []
    for line in output.strip().split("\n"):
        line = line.strip()
        if line.startswith("package:"):
            paths.append(line[8:])  # 去掉 "package:" 前缀
    return paths


def pull_apk(
    package: str,
    apk_paths: list[str],
    serial: str | None = None,
    label: str = "",
) -> list[Path]:
    """从手机拉取 APK 文件到 apks/ 目录，返回本地路径列表"""
    APKS_DIR.mkdir(parents=True, exist_ok=True)

    local_paths: list[Path] = []
    name = label or package.split(".")[-1].capitalize()

    if len(apk_paths) == 1:
        # 单 APK
        local_name = f"{name}.apk"
        local_path = APKS_DIR / local_name
        print(f"  正在拉取: {apk_paths[0]}")
        print(f"        → {local_path}")
        success, output = run_adb(
            ["pull", apk_paths[0], str(local_path)],
            timeout=120,
            serial=serial,
        )
        if success:
            size_mb = local_path.stat().st_size / (1024 * 1024)
            print(f"  ✓ 完成 ({size_mb:.1f} MB)")
            local_paths.append(local_path)
        else:
            print(f"  ✗ 拉取失败: {output}")
    else:
        # 多个 split APK
        print(f"  检测到 {len(apk_paths)} 个 split APK:")
        for i, apk_path in enumerate(apk_paths):
            remote_name = Path(apk_path).name
            if i == 0:
                local_name = f"{name}.apk"
            else:
                local_name = f"{name}_split_{remote_name}"
            local_path = APKS_DIR / local_name
            print(f"  [{i+1}/{len(apk_paths)}] {remote_name}")
            print(f"           → {local_path}")
            success, output = run_adb(
                ["pull", apk_path, str(local_path)],
                timeout=120,
                serial=serial,
            )
            if success:
                size_mb = local_path.stat().st_size / (1024 * 1024)
                print(f"           ✓ ({size_mb:.1f} MB)")
                local_paths.append(local_path)
            else:
                print(f"           ✗ 失败: {output}")

    return local_paths


def decompile_apk(
    apk_path: Path,
    output_name: str = "",
    force: bool = False,
    no_res: bool = False,
    no_src: bool = False,
) -> Path | None:
    """使用 apktool 反编译 APK，返回输出目录"""
    # 检查 apktool 是否可用
    try:
        result = subprocess.run(
            ["apktool", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            print("错误: apktool 不可用")
            return None
        version = result.stdout.strip()
        print(f"  apktool 版本: {version}")
    except FileNotFoundError:
        print("错误: 未找到 apktool，请先安装:")
        print("  brew install apktool    (macOS)")
        print("  apt install apktool     (Ubuntu/Debian)")
        return None

    DECOMPILED_DIR.mkdir(parents=True, exist_ok=True)

    name = output_name or apk_path.stem
    output_dir = DECOMPILED_DIR / f"{name}_decompiled"

    if output_dir.exists():
        if force:
            print(f"  清除旧目录: {output_dir}")
            shutil.rmtree(output_dir)
        else:
            print(f"  ⚠ 反编译目录已存在: {output_dir}")
            print(f"    使用 --force 覆盖，或手动删除后重试")
            return output_dir

    cmd = ["apktool", "d", str(apk_path), "-o", str(output_dir)]
    if no_res:
        cmd.append("-r")  # 不解码资源
    if no_src:
        cmd.append("-s")  # 不反编译 smali
    if force:
        cmd.append("-f")  # 强制覆盖

    print(f"  正在反编译: {apk_path.name}")
    print(f"  输出目录:   {output_dir}")
    print(f"  命令: {' '.join(cmd)}")
    print()

    try:
        process = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 分钟超时
        )
        if process.returncode == 0:
            print(process.stdout)
            # 统计输出
            file_count = sum(1 for _ in output_dir.rglob("*") if _.is_file())
            dir_count = sum(1 for _ in output_dir.rglob("*") if _.is_dir())
            print(f"  ✓ 反编译完成!")
            print(f"    文件: {file_count}, 目录: {dir_count}")

            # 展示关键目录
            key_dirs = ["res", "smali", "assets", "lib", "AndroidManifest.xml"]
            existing = [d for d in key_dirs if (output_dir / d).exists()]
            print(f"    关键内容: {', '.join(existing)}")

            return output_dir
        else:
            print(f"  ✗ 反编译失败:")
            print(process.stderr)
            return None
    except subprocess.TimeoutExpired:
        print("  ✗ 反编译超时（超过 5 分钟）")
        return None


def main():
    parser = argparse.ArgumentParser(
        description="提取当前前台应用的 APK 并使用 apktool 反编译",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--package", "-p", type=str, default=None, help="直接指定包名（跳过自动检测）")
    parser.add_argument("--serial", "-s", type=str, default=None, help="指定 adb 设备序列号")
    parser.add_argument("--apk-only", action="store_true", help="仅提取 APK，不反编译")
    parser.add_argument("--decompile-only", action="store_true", help="仅反编译已有 APK（需配合 --package 或 APK 文件名）")
    parser.add_argument("--force", "-f", action="store_true", help="强制覆盖已有的反编译目录")
    parser.add_argument("--no-res", action="store_true", help="不解码资源文件（更快）")
    parser.add_argument("--no-src", action="store_true", help="不反编译 smali（仅看资源）")

    args = parser.parse_args()

    print("=" * 55)
    print(" Android APK 提取 & 反编译工具")
    print("=" * 55)
    print()

    # 1. 确定包名
    package = args.package
    if not package:
        if args.decompile_only:
            print("错误: --decompile-only 模式需要指定 --package")
            sys.exit(1)

        print("[1/4] 检查设备连接...")
        ok, serial = check_device(args.serial)
        if not ok:
            sys.exit(1)
        print(f"  ✓ 设备: {serial}")
        print()

        print("[2/4] 检测前台应用...")
        package = get_foreground_package(serial=serial)
        if not package:
            print("  ✗ 无法检测前台应用")
            print("  请手动指定: --package com.example.app")
            sys.exit(1)
    else:
        serial = args.serial
        if not args.decompile_only:
            print("[1/4] 检查设备连接...")
            ok, serial = check_device(args.serial)
            if not ok:
                sys.exit(1)
            print(f"  ✓ 设备: {serial}")
            print()
            print("[2/4] 使用指定包名...")
        else:
            print("[跳过] 仅反编译模式，跳过设备连接")
            print()
            print("[2/4] 使用指定包名...")

    print(f"  包名: {package}")

    # 获取应用名称
    label = ""
    if not args.decompile_only:
        label = get_app_label(package, serial=serial)
        print(f"  应用: {label}")
    else:
        label = package.split(".")[-1].capitalize()
    print()

    # 2. 提取 APK
    local_apks: list[Path] = []

    if args.decompile_only:
        print("[3/4] 查找已有 APK...")
        # 从 apks/ 目录查找匹配的 APK
        if APKS_DIR.exists():
            for f in APKS_DIR.glob("*.apk"):
                local_apks.append(f)
                print(f"  找到: {f.name}")
        if not local_apks:
            # 尝试用 label 匹配
            candidate = APKS_DIR / f"{label}.apk"
            if candidate.exists():
                local_apks.append(candidate)
                print(f"  找到: {candidate.name}")
        if not local_apks:
            print(f"  ✗ 在 {APKS_DIR} 中未找到 APK 文件")
            sys.exit(1)
    else:
        print("[3/4] 提取 APK...")
        apk_paths = get_apk_paths(package, serial=serial)
        if not apk_paths:
            print(f"  ✗ 未找到包 {package} 的 APK 路径")
            print("  可能原因: 包名不存在或无权限访问")
            sys.exit(1)
        print(f"  设备上 APK 路径: {len(apk_paths)} 个")
        local_apks = pull_apk(package, apk_paths, serial=serial, label=label)
        if not local_apks:
            print("  ✗ APK 提取失败")
            sys.exit(1)

    print()

    # 3. 反编译
    if args.apk_only:
        print("[4/4] 跳过反编译（--apk-only）")
    else:
        print("[4/4] 反编译 APK...")
        # 只反编译主 APK（第一个）
        main_apk = local_apks[0]
        output_dir = decompile_apk(
            main_apk,
            output_name=label or main_apk.stem,
            force=args.force,
            no_res=args.no_res,
            no_src=args.no_src,
        )
        if output_dir:
            print()
            print(f"  反编译结果: {output_dir}")
            # 提示可以配合 dump_ui_layout.py 使用
            res_dir = output_dir / "res"
            if res_dir.exists():
                print()
                print("  💡 提示: 可以配合 UI dump 工具使用 APK 资源:")
                print(f"     python scripts/reverse/dump_ui_layout.py --apk-res {res_dir}")

    # 总结
    print()
    print("=" * 55)
    print(" 完成!")
    print("=" * 55)
    print(f"  包名:      {package}")
    if local_apks:
        print(f"  APK 文件:  {', '.join(str(p) for p in local_apks)}")
    if not args.apk_only:
        decompiled_name = f"{label or local_apks[0].stem}_decompiled"
        decompiled_path = DECOMPILED_DIR / decompiled_name
        if decompiled_path.exists():
            print(f"  反编译目录: {decompiled_path}")
    print()


if __name__ == "__main__":
    main()
