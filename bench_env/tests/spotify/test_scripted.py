"""Live scripted-plan verification for the Spotify suite.

Each plan is replayed through ``ScriptedAgent`` via the same
``BaseRunner.run_episode`` path as ``bench_env.run --agent scripted`` (grounded
AnswerSheet, ``COMPLETE``, ``EpisodeResult.success`` = goal + clean diff).
``{param}`` placeholders in plans render from the matching ``SCRIPTED_CASES`` params.

Run against the gateway:
    pytest bench_env/tests/spotify/test_scripted.py --sim-url https://localhost:4180
"""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.spotify import tasks as spotify_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "spotify"

# (ClassName, factory). One entry per task in the suite; the factory's params
# must match the placeholders used by that task's plan in scripted_plans.py.
SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("TogglePrivacy", lambda: spotify_tasks.TogglePrivacy(toggle=False)),
    ("CreateNewPlaylist", lambda: spotify_tasks.CreateNewPlaylist(name="脚本新歌单")),
    ("LikeSongFromSearch", lambda: spotify_tasks.LikeSongFromSearch(song="青花瓷")),
    ("AddToQueueAndPlay", lambda: spotify_tasks.AddToQueueAndPlay(song="青花瓷")),
    ("ListLibraryArtists", lambda: spotify_tasks.ListLibraryArtists()),
    ("FindRecentArtistSongs", lambda: spotify_tasks.FindRecentArtistSongs(artist="Taylor Swift")),
    ("PlaySongFromSearch", lambda: spotify_tasks.PlaySongFromSearch(song="青花瓷")),
    ("SetSleepTimer", lambda: spotify_tasks.SetSleepTimer(minutes=15)),
    ("QueueAndLikeSong", lambda: spotify_tasks.QueueAndLikeSong(song="青花瓷")),
    ("QueueTopArtistSongs", lambda: spotify_tasks.QueueTopArtistSongs(song="Bad Habits", count=2)),
    (
        "AddArtistSongsToPlaylist",
        lambda: spotify_tasks.AddArtistSongsToPlaylist(playlist="脚本艺人精选", artist="周杰伦", min_count=2),
    ),
    ("SearchAlbumInfo", lambda: spotify_tasks.SearchAlbumInfo(album="Thriller")),
    ("SearchPlayAndReport", lambda: spotify_tasks.SearchPlayAndReport(song="青花瓷")),
    ("FollowAndPlayArtist", lambda: spotify_tasks.FollowAndPlayArtist(artist="Adele")),
    ("LikeAndAddToPlaylist", lambda: spotify_tasks.LikeAndAddToPlaylist(playlist="脚本当前收藏")),
    (
        "SwapSongInPlaylist",
        lambda: spotify_tasks.SwapSongInPlaylist(playlist="脚本替换歌单", old_song="搁浅", new_song="晴天"),
    ),
    (
        "FilterLikedSongsToPlaylist",
        lambda: spotify_tasks.FilterLikedSongsToPlaylist(artist="Taylor Swift", playlist="脚本收藏精选"),
    ),
    (
        "SearchBuildPlaylistAndPlay",
        lambda: spotify_tasks.SearchBuildPlaylistAndPlay(keyword="周杰伦", count=3, playlist="脚本搜索精选"),
    ),
    (
        "MoveArtistToNewPlaylist",
        lambda: spotify_tasks.MoveArtistToNewPlaylist(
            playlist="脚本源歌单",
            artist="周杰伦",
            new_playlist="脚本杰伦转移",
        ),
    ),
    ("DiscoverSaveAndReport", lambda: spotify_tasks.DiscoverSaveAndReport(artist="周杰伦", count=2)),
    (
        "CollectLikedRecentAndPlay",
        lambda: spotify_tasks.CollectLikedRecentAndPlay(playlist="脚本收藏最近"),
    ),
    (
        "BuildPlaylistFromTwoArtists",
        lambda: spotify_tasks.BuildPlaylistFromTwoArtists(
            playlist="脚本双艺人",
            artist1="周杰伦",
            artist2="林俊杰",
            count=1,
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(spotify_tasks)
    missing = declared - covered
    assert not missing, f"Spotify tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_spotify_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
