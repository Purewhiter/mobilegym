"""
Device specialized task definitions.

覆盖 WiFi、蓝牙、系统设置、权限与设备管理等系统级操作。
"""
# -- Task Index (auto-generated, do not edit) --
# 10 tasks | L3×8  L4×2
#
# [L3] BluetoothConnectNamedDevice                        帮我在蓝牙里断开 Xiaomi Buds 4 Pro、连接小米手表，并把“小米快连”打开
# [L4] BluetoothPairMultipleDevicesRecordPairableToNotes  帮我依次尝试配对这3个蓝牙设备：{deviceNames}。能配对成功的配完就断开，并把可配对的设备名逐行记到标题为{noteTitle}的小米笔记里
# [L3] WifiConnectToNamedSSID                             帮我连上名为{ssidName}的 WiFi，密码是{wifiPassword}
# [L4] WifiEnableHotspotAndConfigure                      帮我打开个人热点，把名称改成{ssid}、密码改成{password}，打开自动关闭热点，并把 WiFi 6 支持设为{useWifi6}
# [L3] WifiTryPasswordsFindCorrectOne                     我忘了 WiFi {ssidName} 的正确密码，只记得可能是{passwordCandidates}，帮我试出来哪个能连上
# [L3] WifiForgetNetworkThenReconnect                     帮我把 WiFi {ssidName} 先忘记掉，再重新连回来，密码是{wifiPassword}
# [L3] SystemTimezoneChange                               帮我把系统时区改成{targetTimezone}
# [L3] BatterySaverEnableWithBrightnessUnder25            打开手机省电模式，并把屏幕亮度调到25以下
# [L3] BrightnessAndClockTask                             把屏幕亮度调到 50% 以下后，打开时钟的计时页面。
# [L3] SettingsAboutPhoneToNotes                          查看OS版本号记录到备忘录，标题为 {note_title}
# -- End Task Index --


from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import CriteriaTask
from bench_env.task.device.app import Device
from bench_env.task.judge import JudgeInput
from bench_env.task.notes.app import Notes
from bench_env.task.os_helpers import (
    normalize_locale as _normalize_locale,
    parse_csv_items as _parse_csv_items,
    theme_to_dark as _theme_to_dark,
)


class BluetoothConnectNamedDevice(CriteriaTask):
    templates = [
        "帮我在蓝牙里断开 Xiaomi Buds 4 Pro、连接小米手表，并把“小米快连”打开",
        'In Bluetooth settings, disconnect Xiaomi Buds 4 Pro, connect Xiaomi Watch, and turn on "Mi Fast Connect"',
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings"]
    apps = ["settings"]
    expected_changes = ["os.hardware.nearbyBluetooth", "os.settings.global.bluetoothEnabled", "os.preferences"]
    criteria = {
        "os.settings.global.bluetoothEnabled": True,
        "os.hardware.nearbyBluetooth[name=Xiaomi Buds 4 Pro].connected": False,
        "os.hardware.nearbyBluetooth[name=小米手表].connected": True,
        "os.preferences.bluetooth_mi_fast_connect": True,
    }
    parameters = {}

    async def _prepare(self, env: Any) -> None:
        await env.set_state(
            {
                "os": {
                    "settings": {"global": {"bluetoothEnabled": True}},
                    "hardware": {
                        "nearbyBluetooth[name=Xiaomi Buds 4 Pro]": {"paired": True, "connected": True},
                        "nearbyBluetooth[name=小米手表]": {"paired": True, "connected": False},
                    },
                    "preferences": {"bluetooth_mi_fast_connect": False},
                }
            },
            deep=True,
            reload=False,
        )


class BluetoothPairMultipleDevicesRecordPairableToNotes(BaseTask):
    templates = [
        "帮我依次尝试配对这3个蓝牙设备：{deviceNames}。能配对成功的配完就断开，并把可配对的设备名逐行记到标题为{noteTitle}的小米笔记里",
        "Try pairing these 3 Bluetooth devices one by one: {deviceNames}. Disconnect each one after a successful pairing, and record the names of the pairable devices (one per line) in a note titled {noteTitle}",
    ]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L4"
    capabilities = ["settings", "transfer", "create"]
    apps = ["settings", "notes"]
    expected_changes = ["os.hardware.nearbyBluetooth", "os.settings.global.bluetoothEnabled", "apps.notes.notes", "os.preferences"]
    parameters = {
        "deviceNames": {"type": "string", "default": "JBL Flip 6,蓝牙键盘,Car Audio", "description": "设备名称列表（逗号分隔，必须正好3个）"},
        "noteTitle": {"type": "string", "default": "可配对蓝牙设备", "description": "小米笔记标题"},
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        os_state = Device(input.os)
        notes = Notes(input.apps["notes"])

        names = Device.parse_device_names(self.p.deviceNames)
        if len(names) != 3:
            raise ValueError(f"deviceNames must contain exactly 3 device names, got {len(names)}")

        pairable_targets = os_state.pairable_bluetooth_devices(names)
        expected_record_names = [str(device["name"]) for device in pairable_targets]

        return [
            {
                "field": "os.settings.global.bluetoothEnabled",
                "expected": True,
                "actual": os_state.bluetooth_enabled,
                "passed": os_state.bluetooth_enabled,
            },
            os_state.check_bluetooth_devices_paired(
                pairable_targets,
                field="bluetooth.pairable.paired",
            ),
            os_state.check_bluetooth_devices_connected(
                pairable_targets,
                expected=False,
                field="bluetooth.disconnect.after.pair",
            ),
            notes.check_note_with_title_has_lines(
                str(self.p.noteTitle),
                expected_record_names,
                field="notes.pairable.devices.recorded",
            ),
        ]


class WifiConnectToNamedSSID(CriteriaTask):
    templates = [
        "帮我连上名为{ssidName}的 WiFi，密码是{wifiPassword}",
        "Connect to the WiFi named {ssidName}, the password is {wifiPassword}",
    ]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L3"
    capabilities = ["settings"]
    apps = ["settings"]
    criteria = {
        "os.settings.global.wifiEnabled": True,
        "os.hardware.wifi.connectedSsid": "{ssidName}",
    }
    expected_changes = ["os.hardware.wifi", "os.settings.global.wifiEnabled", "os.preferences", "apps.settings.wifi"]
    parameters = {
        "ssidName": {"type": "string", "sampler": Device.sample_secure_wifi_ssid, "default": "Xiaomi_AX3", "description": "WiFi SSID"},
        "wifiPassword": {"type": "string", "default": "12345678", "description": "WiFi 密码"},
    }

    async def _post_sample(self, env: Any) -> None:
        ssid = str(self.p.ssidName)
        await env.set_state(
            {
                "os": {"hardware": {"wifi": {"connectedSsid": None}}},
                "apps": {"settings": {"wifi": {f"savedNetworks[ssid={ssid}]": None}}},
            },
            deep=True,
            reload=False,
        )


class WifiEnableHotspotAndConfigure(CriteriaTask):
    templates = ["帮我打开个人热点，把名称改成{ssid}、密码改成{password}，打开自动关闭热点，并把 WiFi 6 支持设为{useWifi6}"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["settings", "edit"]
    apps = ["settings"]
    criteria = {
        "os.hardware.hotspot.enabled": True,
        "os.preferences.wifi_tether_network_name": "{ssid}",
        "os.preferences.wifi_tether_network_password": "{password}",
        "os.preferences.wifi_tether_auto_turn_off": True,
        "os.preferences.tether_use_wifi6": "{useWifi6}",
    }
    expected_changes = [
        "os.hardware.hotspot",
        "os.preferences",
    ]
    parameters = {
        "ssid": {"type": "string", "default": "MyHotspot", "description": "热点名称"},
        "password": {"type": "string", "default": "12345678", "description": "热点密码"},
        "useWifi6": {"type": "bool", "default": False, "values": {"开启": True, "关闭": False}, "description": "WiFi 6 开关"},
    }

    async def _post_sample(self, env: Any) -> None:
        target_wifi6 = self.p.useWifi6
        opposite = not target_wifi6
        await env.set_state({
            "os": {
                "preferences": {
                    "tether_use_wifi6": opposite,
                    "wifi_tether_auto_turn_off": False,
                },
                "hardware": {"hotspot": {"enabled": False}},
            }
        }, deep=True, reload=False)


class WifiTryPasswordsFindCorrectOne(BaseTask):
    templates = [
        "我忘了 WiFi {ssidName} 的正确密码，只记得可能是{passwordCandidates}，帮我试出来哪个能连上",
        "I forgot the correct password for WiFi {ssidName}. It might be one of {passwordCandidates}. Please try them and find out which one works",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings", "reasoning"]
    apps = ["settings"]
    expected_changes = ["os.hardware.wifi", "apps.settings.wifi.savedNetworks", "os.settings.global.wifiEnabled", "os.preferences"]
    parameters = {
        "ssidName": {"type": "string", "sampler": Device.sample_secure_wifi_ssid, "default": "Xiaomi_AX3", "description": "WiFi SSID"},
        "passwordCandidates": {"type": "string", "default": "00000000,12345678", "description": "候选密码列表（逗号分隔，含正确密码）"},
    }

    async def _post_sample(self, env: Any) -> None:
        ssid = str(self.p.ssidName)
        await env.set_state(
            {
                "os": {"hardware": {"wifi": {"connectedSsid": None}}},
                "apps": {"settings": {"wifi": {f"savedNetworks[ssid={ssid}]": None}}},
            },
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        os_state = Device(input.os)
        target_ssid = str(self.p.ssidName)
        saved = Device.saved_wifi_network(input.apps["settings"], target_ssid)
        saved_password = "" if saved is None else str(saved.get("password") or "")
        real_password = str(os_state.pref(f"wifi_password__{target_ssid}"))
        candidates = _parse_csv_items(self.p.passwordCandidates)
        password_matches_real = bool(saved_password) and (saved_password == real_password)
        password_in_candidates = bool(saved_password) and (saved_password in candidates)
        return [
            {
                "field": "os.hardware.wifi.connectedSsid",
                "expected": target_ssid,
                "actual": os_state.wifi_connected_ssid,
                "passed": os_state.wifi_connected_ssid == target_ssid,
            },
            {
                "field": "apps.settings.wifi.savedNetworks.password_for_target",
                "expected": real_password,
                "actual": saved_password,
                "passed": password_matches_real,
            },
            {
                "field": "apps.settings.wifi.savedNetworks.password_in_candidates",
                "expected": True,
                "actual": password_in_candidates,
                "passed": password_in_candidates,
            },
        ]


class WifiForgetNetworkThenReconnect(BaseTask):
    templates = [
        "帮我把 WiFi {ssidName} 先忘记掉，再重新连回来，密码是{wifiPassword}",
        "Forget the WiFi {ssidName} first, then reconnect to it. The password is {wifiPassword}",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings"]
    apps = ["settings"]
    expected_changes = ["os.hardware.wifi", "apps.settings.wifi.savedNetworks", "os.settings.global.wifiEnabled", "os.preferences"]
    parameters = {
        "ssidName": {"type": "string", "sampler": Device.sample_secure_wifi_ssid, "default": "Xiaomi_AX3", "description": "WiFi SSID"},
        "wifiPassword": {"type": "string", "default": "12345678", "description": "WiFi 密码"},
    }

    async def _post_sample(self, env: Any) -> None:
        ssid = str(self.p.ssidName)
        await env.set_state(
            {
                "os": {"hardware": {"wifi": {"connectedSsid": ssid}}},
                "apps": {"settings": {"wifi": {
                    f"savedNetworks[ssid={ssid}]": None,
                    "savedNetworks[]": {"ssid": ssid, "security": "WPA3", "password": str(self.p.wifiPassword), "autoJoin": True},
                }}},
            },
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        os_state = Device(input.os)
        target_ssid = str(self.p.ssidName)
        curr_entry = Device.saved_wifi_network(input.apps["settings"], target_ssid)
        curr_saved_with_password = bool(curr_entry) and str(curr_entry.get("password") or "") == str(self.p.wifiPassword)

        return [
            {
                "field": "wifi.reconnected",
                "expected": target_ssid,
                "actual": os_state.wifi_connected_ssid,
                "passed": os_state.wifi_connected_ssid == target_ssid,
            },
            {
                "field": "apps.settings.wifi.savedNetworks.restored",
                "expected": True,
                "actual": curr_saved_with_password,
                "passed": curr_saved_with_password,
            },
        ]


class SystemTimezoneChange(CriteriaTask):
    templates = [
        "帮我把系统时区改成{targetTimezone}",
        "Change the system timezone to {targetTimezone}",
    ]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L3"
    capabilities = ["settings"]
    apps = ["settings"]
    criteria = {"os.preferences.timezone": "{targetTimezone}"}
    parameters = {
        "targetTimezone": {"type": "string", "default": "America/New_York", "description": "目标时区"},
    }



class BatterySaverEnableWithBrightnessUnder25(BaseTask):
    templates = [
        "打开手机省电模式，并把屏幕亮度调到25以下",
        "Turn on battery saver mode and set the screen brightness below 25",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings"]
    apps = ["settings"]
    expected_changes = [
        "os.settings.global.batterySaverEnabled",
        "os.settings.system.brightness",
        "os.preferences.brightness",
        "os.preferences.battery_saver",
        "os.services.shade",
        "os.shade",
    ]

    async def _prepare(self, env: Any) -> None:
        await env.set_state(
            {
                "os": {
                    "settings": {
                        "global": {"batterySaverEnabled": False},
                        "system": {"brightness": 60},
                    },
                    "preferences": {"brightness": 60},
                }
            },
            deep=True,
            reload=False,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        os_now = Device(input.os)
        saver_enabled = bool(os_now.global_settings["batterySaverEnabled"])
        brightness = os_now.brightness
        brightness_ok = brightness < 25
        return [
            {"field": "os.settings.global.batterySaverEnabled", "expected": True, "actual": saver_enabled, "passed": saver_enabled},
            {"field": "os.settings.system.brightness", "expected": "< 25", "actual": brightness, "passed": brightness_ok},
        ]


class BrightnessAndClockTask(BaseTask):
    templates = [
        "把屏幕亮度调到 50% 以下后，打开时钟的计时页面。",
        "Set the screen brightness below 50%, then open the timer page in the Clock app.",
    ]
    scope = "S2"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings", "nav"]
    apps = ["settings", "clock"]
    expected_changes = [
        "os.settings.system.brightness",
        "os.preferences.brightness",
        "os.services.shade",
        "os.shade",
    ]
    parameters = {}

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        os_state = Device(input.os)
        route = input.route or {}
        on_clock_timer = (
            str(route.get("app") or "") == "clock"
            and "/timer" in str(route.get("path") or "")
        )
        brightness = os_state.brightness
        return [
            {
                "field": "settings.brightness_below_50",
                "expected": "< 50",
                "actual": brightness,
                "passed": brightness < 50,
            },
            {
                "field": "clock.timer_page",
                "expected": {"app": "clock", "path_contains": "/timer"},
                "actual": route,
                "passed": on_clock_timer,
            },
        ]


class SettingsAboutPhoneToNotes(BaseTask):
    templates = [
        "查看OS版本号记录到备忘录，标题为 {note_title}",
        "Check the OS version number and record it in a note titled {note_title}",
    ]
    scope = "S2"
    objective = "operate"
    composition = "transfer"
    difficulty = "L3"
    capabilities = ["query", "create", "transfer"]
    apps = ["settings", "notes"]
    expected_changes = ["apps.notes.notes", "os.build"]
    parameters = {
        "note_title": {"type": "string", "default": "系统版本"},
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        notes = Notes(input.apps["notes"], init=input.apps_init["notes"])
        build = input.os.get("build") or {}
        hyperos_version = str(build.get("hyperOSVersion") or "").strip()
        return [
            notes.check_note_with_title_contains(
                self.p.note_title,
                hyperos_version,
                field="note_hyperos_version",
            )
        ]
