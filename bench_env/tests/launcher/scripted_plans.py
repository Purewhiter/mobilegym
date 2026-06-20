"""Scripted validation plans for Launcher tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    click_selector,
    complete,
    home,
    long_press_at,
    swipe,
    type_text,
    wait,
)


def drag(point1: list[int], point2: list[int], *, summary: str) -> Step:
    return {"op": "drag", "point1": point1, "point2": point2, "summary": summary}


def swipe_to_second_page() -> Step:
    return swipe([860, 500], [140, 500], summary="swipe to launcher page 2")


def long_press_blank() -> Step:
    return long_press_at(
        '[data-launcher="true"]:visible',
        summary="long press launcher background",
        duration_ms=700,
    )


def drag_to_folder(point: list[int], *, summary: str) -> Step:
    # Target is the Bilibili/folder cell on the second launcher page.
    return drag(point, [382, 128], summary=summary)


def create_entertainment_folder() -> list[Step]:
    return [
        home(summary="start from launcher"),
        wait(0.5, summary="wait for launcher"),
        swipe_to_second_page(),
        wait(0.8, summary="wait for page 2"),
        drag_to_folder([382, 245], summary="drag RedNote onto Bilibili to create folder"),
        wait(0.8, summary="wait for folder creation"),
        drag_to_folder([618, 245], summary="drag Reddit into folder"),
        wait(0.6, summary="wait after adding Reddit"),
        drag_to_folder([854, 245], summary="drag Spotify into folder"),
        wait(0.6, summary="wait after adding Spotify"),
        drag_to_folder([618, 362], summary="drag WeRead into folder"),
        wait(0.6, summary="wait after adding WeRead"),
        drag_to_folder([854, 362], summary="drag X into folder"),
        wait(0.8, summary="wait after adding X"),
        click_selector(
            'button[aria-label*="打开文件夹"]:visible, button[aria-label*="Open folder"]:visible',
            summary="open entertainment folder",
        ),
        wait(0.4, summary="wait for folder overlay"),
        click_selector(
            'div.z-\\[95\\] button:has-text("文件夹"):visible, div.z-\\[95\\] button:has-text("Folder"):visible',
            summary="start editing folder name",
        ),
        type_text(
            "摸鱼专区",
            selector='div.z-\\[95\\] input:visible',
            clear=True,
            summary="rename folder",
        ),
        wait(0.4, summary="wait for folder name commit"),
    ]


def change_wallpaper_and_add_widget() -> list[Step]:
    return [
        home(summary="start from launcher"),
        wait(0.5, summary="wait for launcher"),
        swipe_to_second_page(),
        wait(0.8, summary="wait for page 2 with empty widget space"),
        long_press_blank(),
        wait(0.5, summary="wait for home settings menu"),
        click_selector(
            'button:has-text("晴空"):visible, button:has-text("Clear Sky"):visible',
            summary="choose a different wallpaper",
        ),
        wait(0.5, summary="wait for wallpaper update"),
        long_press_blank(),
        wait(0.5, summary="wait for home settings menu"),
        click_selector(
            'button:has-text("小部件"):visible, button:has-text("Widgets"):visible',
            summary="open widget picker",
        ),
        wait(0.8, summary="wait for widget picker"),
        click_selector(
            'button:has-text("大桔观"):visible',
            summary="add Dajuguan widget",
        ),
        wait(1.0, summary="wait for widget placement"),
    ]


PLANS: dict[str, list[Step]] = {
    "launcher.DesktopAppsToFolder": [
        *create_entertainment_folder(),
        complete(),
    ],
    "launcher.ChangeWallpaperAndAddWidget": [
        *change_wallpaper_and_add_widget(),
        complete(),
    ],
}
