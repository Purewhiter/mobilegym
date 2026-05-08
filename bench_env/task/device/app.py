"""
Device accessor for OS-backed device tasks.
"""

from __future__ import annotations

import re
from typing import Any

from bench_env.task.base import BaseApp


class Device(BaseApp):
    """Typed helpers for OS-backed device tasks."""

    @staticmethod
    def sample_secure_wifi_ssid(env_state: dict[str, Any], rng: Any) -> str:
        nearby = env_state["os"]["hardware"]["nearbyWifi"]
        candidates = [
            str(ap["ssid"]).strip()
            for ap in nearby
            if str(ap["security"]) != "OPEN" and str(ap["ssid"]).strip()
        ]
        if not candidates:
            raise ValueError("No secure nearby WiFi AP found in os.hardware.nearbyWifi")
        return rng.choice(candidates)

    @staticmethod
    def parse_device_names(value: Any) -> list[str]:
        raw = str(value or "")
        parts = re.split(r"[,，;；]+", raw)
        return [part.strip() for part in parts if part.strip()]

    @staticmethod
    def _norm_text(value: str) -> str:
        return re.sub(r"\s+", "", str(value).strip().lower())

    @classmethod
    def _match_name(cls, current: Any, expected: str) -> bool:
        current_token = cls._norm_text(str(current))
        expected_token = cls._norm_text(expected)
        return bool(expected_token) and (
            current_token == expected_token or expected_token in current_token
        )

    @property
    def locale(self) -> str:
        return str(self.raw["locale"])

    @property
    def hardware(self) -> dict[str, Any]:
        return self.raw["hardware"]

    @property
    def preferences(self) -> dict[str, Any]:
        return self.raw["preferences"]

    @property
    def global_settings(self) -> dict[str, Any]:
        return self.raw["settings"]["global"]

    @property
    def system_settings(self) -> dict[str, Any]:
        return self.raw["settings"]["system"]

    @property
    def nearby_wifi(self) -> list[dict[str, Any]]:
        return self.hardware["nearbyWifi"]

    @property
    def nearby_bluetooth(self) -> list[dict[str, Any]]:
        return self.hardware["nearbyBluetooth"]

    @property
    def battery_percent(self) -> int:
        return int(self.hardware["battery"]["percent"])

    @property
    def wifi_connected_ssid(self) -> str:
        wifi = self.hardware.get("wifi") or {}
        connected = wifi.get("connectedSsid")
        return "" if connected is None else str(connected)

    @property
    def wifi_enabled(self) -> bool:
        return bool(self.global_settings["wifiEnabled"])

    @property
    def bluetooth_enabled(self) -> bool:
        return bool(self.global_settings["bluetoothEnabled"])

    @property
    def dark_mode_enabled(self) -> bool:
        return bool(self.global_settings["darkModeEnabled"])

    @property
    def brightness(self) -> int:
        return int(self.system_settings["brightness"])

    @property
    def font_size_pct(self) -> int:
        return int(self.system_settings["fontSizePct"])

    @property
    def running_apps(self) -> list[str]:
        return self.raw["runningApps"]

    def pref(self, key: str) -> Any:
        return self.preferences[key]



    def bluetooth_device(self, name: str) -> dict[str, Any]:
        for device in self.nearby_bluetooth:
            if self._match_name(device["name"], name):
                return device
        raise ValueError(f"Bluetooth device '{name}' not found in nearby list")

    def bluetooth_devices(self, names: list[str]) -> list[dict[str, Any]]:
        return [self.bluetooth_device(name) for name in names]

    def pairable_bluetooth_devices(self, names: list[str]) -> list[dict[str, Any]]:
        devices = [
            device
            for device in self.bluetooth_devices(names)
            if bool(device.get("pairable", True))
        ]
        if not devices:
            raise ValueError("At least one target bluetooth device must be pairable")
        return devices

    @staticmethod
    def saved_wifi_network(
        settings_state: dict[str, Any], ssid: str
    ) -> dict[str, Any] | None:
        saved_networks = (
            ((settings_state or {}).get("wifi", {}) or {}).get("savedNetworks", []) or []
        )
        target_ssid = str(ssid).strip()
        for network in saved_networks:
            if str((network or {}).get("ssid") or "").strip() == target_ssid:
                return network
        return None



    def check_bluetooth_devices_paired(
        self, devices: list[dict[str, Any]], *, field: str
    ) -> dict[str, Any]:
        expected_names = [str(device["name"]) for device in devices]
        actual_names = [
            str(device["name"]) for device in devices if bool(device.get("paired"))
        ]
        return {
            "field": field,
            "expected": expected_names,
            "actual": actual_names,
            "passed": actual_names == expected_names,
        }

    def check_bluetooth_devices_connected(
        self, devices: list[dict[str, Any]], *, expected: bool, field: str
    ) -> dict[str, Any]:
        expected_names = [str(device["name"]) for device in devices]
        actual_names = [
            str(device["name"])
            for device in devices
            if bool(device.get("connected")) is expected
        ]
        return {
            "field": field,
            "expected": {"devices": expected_names, "connected": expected},
            "actual": actual_names,
            "passed": actual_names == expected_names,
        }
