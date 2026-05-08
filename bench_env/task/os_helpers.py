from __future__ import annotations

import re
from typing import Any


def os_device(os_state: dict[str, Any] | None) -> dict[str, Any]:
    os_state = os_state or {}
    hardware = (os_state.get("hardware", {}) or {}) if isinstance(os_state, dict) else {}
    settings = (os_state.get("settings", {}) or {}) if isinstance(os_state, dict) else {}
    telephony = (os_state.get("telephony", {}) or {}) if isinstance(os_state, dict) else {}
    global_settings = (settings.get("global", {}) or {}) if isinstance(settings, dict) else {}
    system_settings = (settings.get("system", {}) or {}) if isinstance(settings, dict) else {}
    wifi = (hardware.get("wifi", {}) or {}) if isinstance(hardware, dict) else {}
    cellular = (hardware.get("cellular", {}) or {}) if isinstance(hardware, dict) else {}
    bluetooth = (hardware.get("bluetooth", {}) or {}) if isinstance(hardware, dict) else {}
    hotspot = (hardware.get("hotspot", {}) or {}) if isinstance(hardware, dict) else {}
    return {
        "deviceInfo": (os_state.get("build", {}) or {}) if isinstance(os_state, dict) else {},
        "environment": {
            "nearbyWifi": (hardware.get("nearbyWifi", []) or []) if isinstance(hardware, dict) else [],
            "nearbyBluetooth": (hardware.get("nearbyBluetooth", []) or []) if isinstance(hardware, dict) else [],
        },
        "battery": (hardware.get("battery", {}) or {}) if isinstance(hardware, dict) else {},
        "network": {
            "sims": (telephony.get("sims", []) or []) if isinstance(telephony, dict) else [],
            "defaultDataSim": telephony.get("defaultDataSim") if isinstance(telephony, dict) else None,
            "wifiConnectedSsid": wifi.get("connectedSsid") if isinstance(wifi, dict) else None,
            "wifiIpAddress": wifi.get("ipAddress") if isinstance(wifi, dict) else None,
            "wifiMacAddress": wifi.get("macAddress") if isinstance(wifi, dict) else None,
            "wifiLinkSpeed": wifi.get("linkSpeed") if isinstance(wifi, dict) else None,
            "wifiFrequency": wifi.get("frequency") if isinstance(wifi, dict) else None,
            "bluetoothName": bluetooth.get("name") if isinstance(bluetooth, dict) else None,
            "hotspotEnabled": hotspot.get("enabled") if isinstance(hotspot, dict) else None,
            "hotspotSsid": hotspot.get("ssid") if isinstance(hotspot, dict) else None,
            "hotspotPassword": hotspot.get("password") if isinstance(hotspot, dict) else None,
            "vpnEnabled": hardware.get("vpnEnabled") if isinstance(hardware, dict) else None,
            "wifiEnabled": global_settings.get("wifiEnabled") if isinstance(global_settings, dict) else None,
            "mobileDataEnabled": global_settings.get("mobileDataEnabled") if isinstance(global_settings, dict) else None,
            "bluetoothEnabled": global_settings.get("bluetoothEnabled") if isinstance(global_settings, dict) else None,
            "airplaneModeEnabled": global_settings.get("airplaneModeEnabled") if isinstance(global_settings, dict) else None,
            "doNotDisturbEnabled": global_settings.get("doNotDisturbEnabled") if isinstance(global_settings, dict) else None,
            "autoBrightnessEnabled": global_settings.get("autoBrightnessEnabled") if isinstance(global_settings, dict) else None,
            "eyeComfortEnabled": global_settings.get("eyeComfortEnabled") if isinstance(global_settings, dict) else None,
            "darkModeEnabled": global_settings.get("darkModeEnabled") if isinstance(global_settings, dict) else None,
            "locationEnabled": global_settings.get("locationEnabled") if isinstance(global_settings, dict) else None,
            "nfcEnabled": global_settings.get("nfcEnabled") if isinstance(global_settings, dict) else None,
            "screenCastEnabled": global_settings.get("screenCastEnabled") if isinstance(global_settings, dict) else None,
            "flashlightEnabled": global_settings.get("flashlightEnabled") if isinstance(global_settings, dict) else None,
            "batterySaverEnabled": global_settings.get("batterySaverEnabled") if isinstance(global_settings, dict) else None,
            "rotationLocked": global_settings.get("rotationLocked") if isinstance(global_settings, dict) else None,
            "wifiSignalLevel": wifi.get("level") if isinstance(wifi, dict) else None,
            "signalLevel": cellular.get("signalLevel") if isinstance(cellular, dict) else None,
            "mobileDataType": cellular.get("mobileDataType") if isinstance(cellular, dict) else None,
            "noSim": cellular.get("noSim") if isinstance(cellular, dict) else None,
        },
        "settings": {
            **(system_settings if isinstance(system_settings, dict) else {}),
            "preferences": (os_state.get("preferences", {}) or {}) if isinstance(os_state, dict) else {},
        },
    }


def os_prefs(os_state: dict[str, Any] | None) -> dict[str, Any]:
    return (os_state or {}).get("preferences", {}) or {}


def os_qs(os_state: dict[str, Any] | None) -> dict[str, Any]:
    settings = (os_state or {}).get("settings", {}) or {}
    return (settings.get("global", {}) or {}) if isinstance(settings, dict) else {}


def parse_csv_items(value: Any) -> list[str]:
    if isinstance(value, (list, tuple)):
        return [str(item).strip() for item in value if str(item).strip()]
    parts = re.split(r"[,\s，;；]+", str(value or "").strip())
    return [part.strip() for part in parts if part.strip()]


def normalize_locale(value: Any) -> str:
    text = str(value or "").strip().lower()
    if text in {"en", "english", "英文"} or text.startswith("en-") or text.startswith("en_"):
        return "en"
    return "zh-Hans"


def theme_to_dark(value: Any) -> bool:
    text = str(value or "").strip().lower()
    if text in {"dark", "darkmode", "dark_mode", "深色", "暗色", "夜间", "night"}:
        return True
    if text in {"light", "浅色", "日间"}:
        return False
    return bool(value) if isinstance(value, bool) else False


def os_device_id(os_state: dict[str, Any] | None) -> str:
    build = ((os_state or {}).get("build", {}) or {}) if isinstance(os_state, dict) else {}
    model = str((build or {}).get("model") or "").strip()
    market = str((build or {}).get("marketName") or "").strip()
    return model or market or "device"
