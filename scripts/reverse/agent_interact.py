#!/usr/bin/env python3
"""
Agent Interaction Driver
Drivers Android automation, captures state, and extracts assets.
Designed to be called by the AI Agent.

Usage:
  python3 scripts/reverse/agent_interact.py \
    --app Sms \
    --session trace_01_home_to_settings \
    --step-name 01_tap_settings \
    --action tap \
    --target-id "com.android.mms:id/action_settings" \
    --desc "Click settings icon in toolbar"
"""

import argparse
import json
import time
import sys
import shutil
from pathlib import Path

# Import existing capture logic
import dump_ui_layout

# Configuration
PROJECT_ROOT = Path(__file__).resolve().parents[2]
AUTO_EXPLORE_DIR = PROJECT_ROOT / "auto_explore"

# App-specific configs (could be externalized)
APP_CONFIG = {
    "Sms": {
        "apk_res": PROJECT_ROOT / "decompiled/Mms_decompiled/res",
        "assets_dir": PROJECT_ROOT / "apps/Sms/assets",
        "package": "com.android.mms"
    },
    "Calendar": {
        "apk_res": PROJECT_ROOT / "decompiled/Calendar_decompiled/res",
        "assets_dir": PROJECT_ROOT / "apps/Calendar/assets",
        "package": "com.android.calendar"
    },
    # Add others here
}

def resolve_coords_from_id(resource_id, previous_dump_path=None):
    """
    Attempts to find the center (x, y) of a resource-id.
    If previous_dump_path is provided, looks there.
    Otherwise, might need to dump current screen (slow).
    For now, we rely on the Agent passing coordinates OR us dumping current screen.
    """
    # If we are asked to click an ID, we MUST know where it is currently.
    # So we have to dump the current layout to find it.
    print(f"🔍 Finding target element: {resource_id}...")
    temp_xml = Path("/tmp/temp_ui_dump.xml")
    if not dump_ui_layout.dump_ui_xml(temp_xml):
        print("❌ Failed to dump UI for coordinate resolution")
        return None
    
    elements = dump_ui_layout.parse_ui_xml(temp_xml)
    # Simple search
    candidates = [e for e in elements if e["resource_id"] == resource_id] # exact match first
    if not candidates:
        # Try partial match
        candidates = [e for e in elements if e["resource_id"] and resource_id in e["resource_id"]]
    
    if not candidates:
        print(f"❌ Element not found on screen: {resource_id}")
        return None
    
    # Pick first visible/clickable
    target = candidates[0]
    bounds = target["bounds"]
    if not bounds:
        return None
        
    return bounds["center_x"], bounds["center_y"]

def do_action(args):
    """Executes the requested ADB action"""
    action = args.action
    
    if action == "tap":
        x, y = None, None
        
        # Priority 1: Semantic ID (Robustness)
        if args.target_id:
            coords = resolve_coords_from_id(args.target_id)
            if coords:
                x, y = coords
                print(f"📍 Resolved {args.target_id} to ({x}, {y})")
        
        # Priority 2: Explicit Coords (Fallback or Speed)
        if x is None and args.coords:
            try:
                x, y = map(int, args.coords.split(","))
            except:
                pass
        
        if x is not None and y is not None:
            print(f"👆 Tapping ({x}, {y})...")
            dump_ui_layout.run_adb(["shell", "input", "tap", str(x), str(y)])
        else:
            print("❌ No valid coordinates for tap action")
            sys.exit(1)

    elif action == "type":
        text = args.text
        if not text:
            print("❌ Text argument required for type action")
            sys.exit(1)
        # Escape spaces
        escaped_text = text.replace(" ", "%s")
        print(f"⌨️ Typing: {text}")
        dump_ui_layout.run_adb(["shell", "input", "text", escaped_text])

    elif action == "swipe":
        # Expects coords="x1,y1,x2,y2"
        if not args.coords:
            print("❌ Coords x1,y1,x2,y2 required for swipe")
            sys.exit(1)
        x1, y1, x2, y2 = map(str, args.coords.split(","))
        print(f"👉 Swiping {x1},{y1} -> {x2},{y2}")
        dump_ui_layout.run_adb(["shell", "input", "swipe", x1, y1, x2, y2, "300"])
    
    elif action == "back":
        print("🔙 Pressing Back")
        dump_ui_layout.run_adb(["shell", "input", "keyevent", "4"])
        
    elif action == "home":
        print("🏠 Pressing Home")
        dump_ui_layout.run_adb(["shell", "input", "keyevent", "3"])
        
    # Wait for UI to settle
    wait_time = args.wait if args.wait else 2.0
    print(f"⏳ Waiting {wait_time}s for UI stability...")
    time.sleep(wait_time)

def capture_state(app_name, session_dir, step_name):
    """Captures screenshot + XML dump and writes derived artifacts."""
    step_dir = session_dir / step_name
    step_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"📸 Capturing state to {step_dir}...")
    
    # 1. Screenshot
    screenshot_path = step_dir / "screenshot.png"
    if not dump_ui_layout.take_screenshot(screenshot_path):
        print("❌ Screenshot failed")
        return
    
    # 2. XML Dump
    xml_path = step_dir / "elements.xml"
    if not dump_ui_layout.dump_ui_xml(xml_path):
        print("❌ XML dump failed")
        return
        
    # 3. Parse / Enrich / Derive artifacts
    config = APP_CONFIG.get(app_name)
    if not config:
        print(f"⚠️ App {app_name} not configured; will skip APK enrichment/icons but still export JSON/HTML artifacts")

    print("🧠 Analyzing UI structure and extracting assets...")
    elements = dump_ui_layout.parse_ui_xml(xml_path)
    tree_root = dump_ui_layout.parse_ui_xml_tree(xml_path)
    if not tree_root:
        print("⚠️ Failed to parse UI tree; skipping tree-based artifacts")
        return

    screen_size = dump_ui_layout.get_screen_size()
    # Prefer the actual screenshot pixel size if available (more accurate than wm size on some devices)
    if hasattr(dump_ui_layout, "get_png_dimensions"):
        try:
            png_dims = dump_ui_layout.get_png_dimensions(screenshot_path) if screenshot_path.exists() else None
            if png_dims:
                screen_size = png_dims
        except Exception:
            pass
    activity = ""
    if hasattr(dump_ui_layout, "get_focused_activity"):
        try:
            activity = dump_ui_layout.get_focused_activity() or ""
        except Exception:
            activity = ""
    
    # Parse APK resources (Expensive? Maybe cache later)
    # We rely on dump_ui_layout's caching helper or just run it raw for now.
    # To avoid parsing APK every single step (which takes 2-3s), we might want to cache the parsed data.
    # dump_ui_layout functions parse every time. For exploration, 2-3s overhead is acceptable.
    
    # Need screen density for accurate px calculation
    # physical size is mostly used for scroll, but density needed for enrichment
    # We can get density from 'adb shell wm density'
    success, output = dump_ui_layout.run_adb(["shell", "wm", "density"])
    density = 3.0 # default
    if success and "Override density" in output:
        d = int(output.split(":")[-1].strip())
        density = d / 160.0
    elif success and "Physical density" in output:
        d = int(output.split(":")[-1].strip())
        density = d / 160.0
        
    if config:
        dump_ui_layout.enrich_from_apk(elements, config["apk_res"], density)
    
    # Auto-extract drawables to app assets dir
    # This modifies 'elements' to add 'src_resolved' paths
    # dump_ui_layout expect a Tree structure for this function
    # But 'elements' is a flat list from 'parse_ui_xml'.
    # We need 'parse_ui_xml_tree' for tree operations.
    
    if config:
        # Re-parse static resources and enrich the tree with resolved styles
        dimens = dump_ui_layout.parse_apk_dimens(config["apk_res"])
        colors = dump_ui_layout.parse_apk_colors(config["apk_res"])
        strings = dump_ui_layout.parse_apk_strings(config["apk_res"])
        styles = dump_ui_layout.parse_apk_styles(config["apk_res"], dimens, colors)
        drawable_shapes = dump_ui_layout.parse_drawable_shapes(config["apk_res"], dimens, colors)
        layout_views = dump_ui_layout.parse_apk_layouts(config["apk_res"], dimens, colors, strings, styles)

        dump_ui_layout.enrich_tree_with_apk(tree_root, layout_views, drawable_shapes, dimens, colors, density)

    # Save tree in the standard dump_ui_layout schema: { screen, element_tree, ... }
    dump_ui_layout.generate_element_tree_json(
        tree_root,
        step_dir / "elements_tree.json",
        screen_size,
        density=density,
        screenshot_name="screenshot.png",
        activity=activity,
        apk_res_dir=(config["apk_res"] if config else None),
    )

    # 4. Actionable Elements
    actionable = dump_ui_layout.extract_actionable_elements(tree_root)
    (step_dir / "actionable_elements.json").write_text(
        json.dumps(actionable, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # 5. HTML previews (debug-friendly, derived artifacts)
    try:
        dump_ui_layout.generate_html(elements, step_dir / "layout_preview.html", screenshot_path, screen_size)
    except Exception as e:
        print(f"⚠️ Failed to generate layout_preview.html: {e}")

    try:
        import generate_web_mock
        screen_meta = {
            "width": screen_size[0],
            "height": screen_size[1],
            "density": round(density, 3),
            "screenshot": "screenshot.png",
        }
        if activity:
            screen_meta["activity"] = activity
        generate_web_mock.generate_html(screen_meta, tree_root, step_dir / "web_mock.html")
    except Exception as e:
        print(f"⚠️ Failed to generate web_mock.html: {e}")

    print(f"✅ State captured to {step_dir}")

def main():
    parser = argparse.ArgumentParser(description="Agent Interaction Driver")
    parser.add_argument("--app", required=True, help="App Name (e.g., Sms)")
    parser.add_argument("--session", required=True, help="Session Name (e.g., trace_01)")
    parser.add_argument("--step-name", required=True, help="Step Name (e.g., 01_tap_btn)")
    parser.add_argument("--action", choices=["tap", "type", "swipe", "back", "home", "capture_only"], required=True)
    parser.add_argument("--target-id", help="Resource ID to interact with")
    parser.add_argument("--coords", help="x,y or x1,y1,x2,y2")
    parser.add_argument("--text", help="Text to type")
    parser.add_argument("--desc", help="Description of action")
    parser.add_argument("--wait", type=float, default=2.0, help="Wait time after action")
    
    args = parser.parse_args()
    
    app_dir = AUTO_EXPLORE_DIR / args.app
    session_dir = app_dir / "traces" / args.session
    session_dir.mkdir(parents=True, exist_ok=True)
    
    # 0. Log Action Intent (Linking N-1 to N)
    # We write this to the *step* directory (Step N) 
    # indicating "This step was reached by doing X".
    
    if args.action != "capture_only":
        do_action(args)
    
    capture_state(args.app, session_dir, args.step_name)
    
    # Log metadata
    meta = {
        "action": args.action,
        "target_id": args.target_id,
        "coords": args.coords,
        "text": args.text,
        "desc": args.desc,
        "timestamp": time.time()
    }
    (session_dir / args.step_name / "action.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
