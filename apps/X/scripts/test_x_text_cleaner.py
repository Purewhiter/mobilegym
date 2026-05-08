import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from x_text_cleaner import strip_trailing_media_tco


def test_strip_trailing_media_tco_removes_trailing_media_link_for_media_posts() -> None:
    assert (
        strip_trailing_media_tco(
            "这书太有趣了：\n读下去才知道，它写的是历史 https://t.co/2v3vlbwlVq",
            has_media=True,
        )
        == "这书太有趣了：\n读下去才知道，它写的是历史"
    )


def test_strip_trailing_media_tco_keeps_link_when_post_has_no_media() -> None:
    text = "详情见这里 https://t.co/example123"
    assert strip_trailing_media_tco(text, has_media=False) == text


def test_strip_trailing_media_tco_keeps_non_trailing_links() -> None:
    text = "先看这个 https://t.co/example123 再看图"
    assert strip_trailing_media_tco(text, has_media=True) == text


def test_strip_trailing_media_tco_allows_media_only_posts_to_become_empty() -> None:
    assert strip_trailing_media_tco("https://t.co/example123", has_media=True) == ""
