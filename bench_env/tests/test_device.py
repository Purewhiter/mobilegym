"""Device suite task tests."""

from __future__ import annotations

import copy
from typing import Any

from bench_env.task.device import tasks as _tasks_module
from bench_env.tests.conftest import make_judge_input
from bench_env.tests.test_notes import BASE_STATE as NOTES_BASE_STATE

DEFAULT_ROUTE: dict[str, Any] = {"app": "settings", "path": "/"}

BASE_OS_STATE: dict[str, Any] = {
    "hardware": {
        "battery": {"percent": 78},
        "wifi": {"connectedSsid": "Xiaomi_AX3"},
        "hotspot": {"enabled": False, "ssid": "Xiaomi 15 Ultra", "password": "12345678"},
        "nearbyWifi": [],
        "nearbyBluetooth": [],
    },
    "settings": {
        "global": {"wifiEnabled": True, "bluetoothEnabled": True, "batterySaverEnabled": False},
        "system": {"brightness": 50, "fontSizePct": 50},
    },
    "preferences": {
        "wifi_password__Xiaomi_AX3": "12345678",
        "power_mode": "性能模式",
        "background_blur_enable": False,
        "mimotion_pwm_enable": False,
        "wifi_tether_network_name": "XiaomiHotspot",
        "wifi_tether_network_password": "12345678",
        "wifi_tether_auto_turn_off": False,
        "tether_use_wifi6": False,
    },
    "runningApps": [],
    "locale": "zh-Hans",
    "time": {"timestamp": 1742025600000},
}

BASE_NEARBY_BLUETOOTH = [
    {"name": "JBL Flip 6", "paired": False, "connected": False, "pairable": True},
    {"name": "蓝牙键盘", "paired": False, "connected": False, "pairable": False},
    {"name": "Car Audio", "paired": False, "connected": False, "pairable": False},
]


def _clone_os_state() -> dict[str, Any]:
    return copy.deepcopy(BASE_OS_STATE)





def _add_note(title: str, lines: list[str]) -> dict[str, Any]:
    notes_state = copy.deepcopy(NOTES_BASE_STATE)
    notes_state["notes"].append(
        {
            "id": f"note_{title}",
            "title": title,
            "content": "\n".join(lines),
            "updatedAt": 9999999999999,
        }
    )
    return notes_state


def _settings_state(saved_networks: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "preferences": {},
        "wifi": {
            "savedNetworks": copy.deepcopy(saved_networks),
        },
    }


def _make_input(
    init_os: dict[str, Any],
    curr_os: dict[str, Any],
    *,
    apps_init: dict[str, Any] | None = None,
    apps_curr: dict[str, Any] | None = None,
    route: dict[str, Any] | None = None,
) -> Any:
    return make_judge_input(
        {"apps": apps_init or {}, "os": init_os},
        {"apps": apps_curr or {}, "os": curr_os},
        route=route or DEFAULT_ROUTE,
    )


def _all_pass(checks: list[dict[str, Any]]) -> bool:
    return all(check.get("passed") for check in checks)


def _os_with_bluetooth(devices: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    init_os = _clone_os_state()
    curr_os = _clone_os_state()
    init_os["hardware"]["nearbyBluetooth"] = copy.deepcopy(devices)
    curr_os["hardware"]["nearbyBluetooth"] = copy.deepcopy(devices)
    return init_os, curr_os




def _assert_failed(task, inp):
    checks = task.check_goals(inp)
    assert not _all_pass(checks)


def _assert_passed(task, inp):
    checks = task.check_goals(inp)
    assert _all_pass(checks)




def test_wifi_try_passwords_find_correct_one_pass():
    task = _tasks_module.WifiTryPasswordsFindCorrectOne()
    init_os = _clone_os_state()
    curr_os = _clone_os_state()
    curr_os["hardware"]["wifi"]["connectedSsid"] = "Xiaomi_AX3"
    init_settings = _settings_state([])
    curr_settings = _settings_state(
        [{"ssid": "Xiaomi_AX3", "security": "WPA3", "password": "12345678", "autoJoin": True}]
    )
    inp = _make_input(
        init_os,
        curr_os,
        apps_init={"settings": init_settings},
        apps_curr={"settings": curr_settings},
    )
    _assert_passed(task, inp)


def test_wifi_try_passwords_find_correct_one_fails_when_saved_password_is_wrong():
    task = _tasks_module.WifiTryPasswordsFindCorrectOne()
    init_os = _clone_os_state()
    curr_os = _clone_os_state()
    curr_os["hardware"]["wifi"]["connectedSsid"] = "OtherWifi"
    init_settings = _settings_state([])
    curr_settings = _settings_state(
        [{"ssid": "Xiaomi_AX3", "security": "WPA3", "password": "00000000", "autoJoin": True}]
    )
    inp = _make_input(
        init_os,
        curr_os,
        apps_init={"settings": init_settings},
        apps_curr={"settings": curr_settings},
    )
    _assert_failed(task, inp)


def test_wifi_try_passwords_find_correct_one_fails_when_password_not_in_candidates():
    task = _tasks_module.WifiTryPasswordsFindCorrectOne(passwordCandidates="00000000,11111111")
    init_os = _clone_os_state()
    curr_os = _clone_os_state()
    curr_os["hardware"]["wifi"]["connectedSsid"] = "OtherWifi"
    init_settings = _settings_state([])
    curr_settings = _settings_state(
        [{"ssid": "Xiaomi_AX3", "security": "WPA3", "password": "12345678", "autoJoin": True}]
    )
    inp = _make_input(
        init_os,
        curr_os,
        apps_init={"settings": init_settings},
        apps_curr={"settings": curr_settings},
    )
    _assert_failed(task, inp)


def test_device_parse_device_names_preserves_internal_spaces():
    assert _tasks_module.Device.parse_device_names("JBL Flip 6, 蓝牙 键盘 ; Car Audio") == [
        "JBL Flip 6",
        "蓝牙 键盘",
        "Car Audio",
    ]




def test_battery_saver_enable_with_brightness_under_25_pass():
    task = _tasks_module.BatterySaverEnableWithBrightnessUnder25()
    init_os = _clone_os_state()
    curr_os = _clone_os_state()
    curr_os["settings"]["global"]["batterySaverEnabled"] = True
    curr_os["settings"]["system"]["brightness"] = 20
    inp = _make_input(init_os, curr_os)
    _assert_passed(task, inp)


def test_battery_saver_enable_with_brightness_under_25_fails_when_saver_not_enabled():
    task = _tasks_module.BatterySaverEnableWithBrightnessUnder25()
    init_os = _clone_os_state()
    curr_os = _clone_os_state()
    curr_os["settings"]["global"]["batterySaverEnabled"] = False
    curr_os["settings"]["system"]["brightness"] = 20
    inp = _make_input(init_os, curr_os)
    _assert_failed(task, inp)


def test_battery_saver_enable_with_brightness_under_25_fails_when_brightness_too_high():
    task = _tasks_module.BatterySaverEnableWithBrightnessUnder25()
    init_os = _clone_os_state()
    curr_os = _clone_os_state()
    curr_os["settings"]["global"]["batterySaverEnabled"] = True
    curr_os["settings"]["system"]["brightness"] = 30
    inp = _make_input(init_os, curr_os)
    _assert_failed(task, inp)


def test_wifi_enable_hotspot_and_configure_pass():
    task = _tasks_module.WifiEnableHotspotAndConfigure(ssid="MyHotspot", password="abcdef12", useWifi6=True)
    init_os = _clone_os_state()
    curr_os = _clone_os_state()
    curr_os["preferences"].update(
        {
            "wifi_tether_network_name": "MyHotspot",
            "wifi_tether_network_password": "abcdef12",
            "wifi_tether_auto_turn_off": True,
            "tether_use_wifi6": True,
            "hotspot_enabled": True,
        }
    )
    curr_os["hardware"]["hotspot"] = {"enabled": True, "ssid": "MyHotspot", "password": "abcdef12"}
    inp = _make_input(init_os, curr_os)
    _assert_passed(task, inp)


def test_wifi_enable_hotspot_and_configure_hardware_sync_fail():
    task = _tasks_module.WifiEnableHotspotAndConfigure(ssid="MyHotspot", password="abcdef12", useWifi6=True)
    init_os = _clone_os_state()
    curr_os = _clone_os_state()
    curr_os["preferences"].update(
        {
            "wifi_tether_network_name": "MyHotspot",
            "wifi_tether_network_password": "abcdef12",
            "wifi_tether_auto_turn_off": True,
            "tether_use_wifi6": True,
        }
    )
    curr_os["hardware"]["hotspot"] = {"enabled": False, "ssid": "Other", "password": "wrong"}
    inp = _make_input(init_os, curr_os)
    _assert_failed(task, inp)


def test_bluetooth_pair_multiple_devices_record_pairable_to_notes_pass():
    task = _tasks_module.BluetoothPairMultipleDevicesRecordPairableToNotes(
        deviceNames="JBL Flip 6,蓝牙键盘,Car Audio", noteTitle="可配对蓝牙设备"
    )
    init_os, curr_os = _os_with_bluetooth(BASE_NEARBY_BLUETOOTH)
    for device in curr_os["hardware"]["nearbyBluetooth"]:
        if device["name"] == "JBL Flip 6":
            device["paired"] = True
            device["connected"] = False
    note_state = _add_note("可配对蓝牙设备", ["JBL Flip 6"])
    inp = _make_input(init_os, curr_os, apps_init={"notes": NOTES_BASE_STATE}, apps_curr={"notes": note_state})
    _assert_passed(task, inp)


def test_bluetooth_pair_multiple_devices_record_pairable_to_notes_disconnect_fail():
    task = _tasks_module.BluetoothPairMultipleDevicesRecordPairableToNotes(
        deviceNames="JBL Flip 6,蓝牙键盘,Car Audio", noteTitle="可配对蓝牙设备"
    )
    init_os, curr_os = _os_with_bluetooth(BASE_NEARBY_BLUETOOTH)
    for device in curr_os["hardware"]["nearbyBluetooth"]:
        if device["name"] == "JBL Flip 6":
            device["paired"] = True
            device["connected"] = True
    note_state = _add_note("可配对蓝牙设备", ["JBL Flip 6"])
    inp = _make_input(init_os, curr_os, apps_init={"notes": NOTES_BASE_STATE}, apps_curr={"notes": note_state})
    _assert_failed(task, inp)


def test_bluetooth_pair_multiple_devices_record_pairable_to_notes_note_missing_fail():
    task = _tasks_module.BluetoothPairMultipleDevicesRecordPairableToNotes(
        deviceNames="JBL Flip 6,蓝牙键盘,Car Audio", noteTitle="可配对蓝牙设备"
    )
    init_os, curr_os = _os_with_bluetooth(BASE_NEARBY_BLUETOOTH)
    for device in curr_os["hardware"]["nearbyBluetooth"]:
        if device["name"] == "JBL Flip 6":
            device["paired"] = True
            device["connected"] = False
    note_state = _add_note("可配对蓝牙设备", ["其他设备"])
    inp = _make_input(init_os, curr_os, apps_init={"notes": NOTES_BASE_STATE}, apps_curr={"notes": note_state})
    _assert_failed(task, inp)
