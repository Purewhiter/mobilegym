"""Scripted validation plans for Spotify tasks.

These are test assets, not agent logic. ``PLANS`` maps a full ``task.id`` to the
ordered steps that solve it through the GUI. ``ScriptedAgent`` discovers this
module by the task's suite, renders ``{param}`` placeholders from ``task.params``,
and replays each step via the standard environment action space — ``tap_trigger``
/ ``tap_action`` resolve to coordinates through the element's ``data-trigger`` /
``data-action`` attribute at ``env.step()`` time.
"""

from __future__ import annotations

from bench_env.agent.scripted import Step, back, complete, grounded_answer, grounded_answer_repeatable, swipe, tap_action, tap_trigger, type_text, wait


def click_selector(selector: str, *, summary: str) -> Step:
    """Click a tagged dynamic control or an untagged sheet row by selector."""
    return {"op": "click", "selector": selector, "summary": summary}


def trigger_param(trigger_id: str, value: str, *, param: str = "trackId", summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{param}":"{value}"\']:visible',
        summary=summary,
    )


def action_param(action_id: str, value: str, *, param: str = "trackId", summary: str) -> Step:
    return click_selector(
        f'[data-action="{action_id}"][data-action-params*=\'"{param}":"{value}"\']:visible',
        summary=summary,
    )


def search_result_like_button(track_id: str, *, summary: str) -> Step:
    return click_selector(
        f'[data-action="search.track.play"][data-action-params*=\'"trackId":"{track_id}"\']:visible '
        f'[data-action="track.like.toggle"][data-action-params*=\'"trackId":"{track_id}"\']:visible',
        summary=summary,
    )


def playlist_row(name: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'button:has-text("{name}"):visible',
        summary=summary or f"select playlist {name}",
    )


def library_playlist(name: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'[data-trigger="playlist.open"]:has-text("{name}"):visible',
        summary=summary or f"open library playlist {name}",
    )


def new_playlist_row() -> Step:
    return click_selector(
        'button:has-text("新建歌单"):visible, button:has-text("New playlist"):visible',
        summary="tap untagged New playlist row in add-to-playlist sheet",
    )


def play_playlist_button() -> Step:
    # Untagged play button (PlaylistPage); scope by its 56px round shape and skip
    # hidden bg-app-accent tab pills on backgrounded pages.
    return click_selector("button.bg-app-accent.w-14:visible", summary="tap untagged playlist play button")


def play_artist_button() -> Step:
    return click_selector("button.bg-app-primary.w-14:visible", summary="tap untagged artist play button")


def artist_result(name: str) -> Step:
    return trigger_param("artist.open", name, param="name", summary=f"open artist result {name}")


def action_visible(action_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-action="{action_id}"]:visible', summary=summary)


def trigger_visible(trigger_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-trigger="{trigger_id}"]:visible', summary=summary)


def scroll_down(*, summary: str) -> Step:
    return swipe([500, 850], [500, 350], summary=summary)


def scroll_main_down(*, summary: str) -> Step:
    return {
        "op": "swipe",
        "selector": '[data-scroll-container="main"]:visible',
        "start_fraction": 0.5,
        "end_fraction": 0.5,
        "start_y_fraction": 0.72,
        "end_y_fraction": 0.32,
        "duration_ms": 360,
        "summary": summary,
    }


def search(query: str) -> list[Step]:
    return [
        trigger_visible("tab.search", summary="open Search tab"),
        trigger_visible("search.input.open", summary="open search input"),
        type_text(query, selector="input:visible", clear=True, summary=f"search for {query}"),
        wait(1.0, summary="wait for local search results"),
        back(summary="dismiss search keyboard"),
    ]


def create_playlist_with_pending_track(name: str) -> list[Step]:
    return [
        new_playlist_row(),
        wait(0.5, summary="wait for playlist naming view"),
        type_text(name, selector="input:visible", clear=True, summary=f"enter playlist name {name}"),
        action_visible("create.playlist.submit", summary="submit new playlist with pending track"),
        wait(0.5, summary="wait for playlist page"),
    ]


def add_search_track_to_new_playlist(track_id: str, playlist: str) -> list[Step]:
    return [
        trigger_param("search.input.trackMenu.open", track_id, summary=f"open menu for search track {track_id}"),
        trigger_param("search.input.addPlaylist.open", track_id, summary="open add-to-playlist sheet"),
        *create_playlist_with_pending_track(playlist),
    ]


def add_search_track_to_existing_playlist(track_id: str, playlist: str) -> list[Step]:
    return [
        trigger_param("search.input.trackMenu.open", track_id, summary=f"open menu for search track {track_id}"),
        trigger_param("search.input.addPlaylist.open", track_id, summary="open add-to-playlist sheet"),
        playlist_row(playlist),
        back(summary="close add-to-playlist sheet"),
    ]


def add_search_track_to_existing_playlist_visible(track_id: str, playlist: str, *, pre_scrolls: int = 0) -> list[Step]:
    return [
        *[
            scroll_main_down(summary=f"scroll search results to {track_id} {i + 1}/{pre_scrolls}")
            for i in range(pre_scrolls)
        ],
        trigger_param("search.input.trackMenu.open", track_id, summary=f"open menu for search track {track_id}"),
        trigger_visible("search.input.addPlaylist.open", summary="open visible add-to-playlist sheet"),
        playlist_row(playlist),
        back(summary="close add-to-playlist sheet"),
    ]


def add_liked_track_to_new_playlist(track_id: str, playlist: str) -> list[Step]:
    return [
        trigger_param("likedSongs.trackMenu.open", track_id, summary=f"open liked-song menu for {track_id}"),
        trigger_param("likedSongs.addPlaylist.open", track_id, summary="open add-to-playlist sheet"),
        *create_playlist_with_pending_track(playlist),
    ]


def add_liked_track_to_existing_playlist(track_id: str, playlist: str) -> list[Step]:
    return [
        trigger_param("likedSongs.trackMenu.open", track_id, summary=f"open liked-song menu for {track_id}"),
        trigger_param("likedSongs.addPlaylist.open", track_id, summary="open add-to-playlist sheet"),
        playlist_row(playlist),
        back(summary="close add-to-playlist sheet"),
    ]


def add_liked_track_to_existing_playlist_visible(track_id: str, playlist: str, *, pre_scrolls: int = 0) -> list[Step]:
    return [
        *[
            scroll_main_down(summary=f"scroll liked songs to {track_id} {i + 1}/{pre_scrolls}")
            for i in range(pre_scrolls)
        ],
        trigger_param("likedSongs.trackMenu.open", track_id, summary=f"open liked-song menu for {track_id}"),
        trigger_visible("likedSongs.addPlaylist.open", summary="open visible add-to-playlist sheet"),
        playlist_row(playlist),
        back(summary="close add-to-playlist sheet"),
    ]


def remove_liked_track(track_id: str) -> list[Step]:
    return [
        trigger_param("likedSongs.trackMenu.open", track_id, summary=f"open liked-song menu for removal {track_id}"),
        action_param("track.like.toggle", track_id, summary="remove song from liked songs"),
    ]


def return_to_liked_songs() -> list[Step]:
    """Leave the created-playlist page and return to a clean Liked Songs list.

    The create-playlist flow collapses the menu/sheet history, so the three
    backs land on Library home (one level above Liked Songs), not on the list
    itself. Re-anchor by explicitly re-opening Liked Songs from Library home.
    """
    return [
        back(summary="leave new playlist page"),
        wait(0.3),
        back(summary="close add-to-playlist sheet"),
        wait(0.3),
        back(summary="close track menu"),
        wait(0.3),
        *open_liked_songs(),
        wait(0.3, summary="wait for liked songs list"),
    ]


def resume_search(query: str) -> list[Step]:
    """Search again after create-playlist flows that land on the playlist page."""
    return [
        back(summary="leave playlist page"),
        wait(0.3),
        back(summary="close add-to-playlist sheet"),
        wait(0.3),
        back(summary="close track menu"),
        wait(0.3),
        trigger_visible("tab.search", summary="open Search tab"),
        trigger_visible("search.input.open", summary="open search input"),
        type_text(query, selector="input:visible", clear=True, summary=f"search again for {query}"),
        wait(1.0, summary="wait for local search results"),
        back(summary="dismiss search keyboard"),
    ]


def refresh_search(query: str) -> list[Step]:
    """Re-run the current search query while already on the Search tab."""
    return [
        back(summary="close track menu"),
        wait(0.3),
        trigger_visible("search.input.open", summary="refocus search input"),
        type_text(query, selector="input:visible", clear=True, summary=f"refresh search for {query}"),
        wait(1.0, summary="wait for local search results"),
        back(summary="dismiss search keyboard"),
    ]


def open_liked_songs() -> list[Step]:
    return [
        trigger_visible("tab.library", summary="open Library tab"),
        trigger_visible("likedSongs.open", summary="open Liked Songs"),
    ]


def open_source_playlist(name: str) -> list[Step]:
    return [
        trigger_visible("tab.library", summary="open Library tab"),
        library_playlist(name, summary=f"open source playlist {name}"),
        wait(1.0, summary="wait for source playlist tracks"),
    ]


def reanchor_source_playlist(name: str) -> list[Step]:
    """Clear any create/add overlays then re-open the source playlist page.

    The add-to-playlist and create flows leave a non-deterministic dialog/page
    stack; rather than guess the back depth, dismiss overlays and re-anchor on
    the source playlist via Library (same robust pattern as return_to_liked_songs).
    """
    return [
        back(summary="dismiss overlay 1"),
        wait(0.3),
        back(summary="dismiss overlay 2"),
        wait(0.3),
        back(summary="dismiss overlay 3"),
        wait(0.3),
        *open_source_playlist(name),
    ]


def play_created_playlist_from_liked(playlist: str) -> list[Step]:
    return [
        back(summary="return to library home from liked songs"),
        wait(0.3),
        library_playlist(playlist),
        wait(1.0, summary="wait for playlist page"),
        play_playlist_button(),
    ]


def play_created_playlist(playlist: str) -> list[Step]:
    return [
        back(summary="close search overlays"),
        wait(0.3),
        trigger_visible("tab.library", summary="open Library tab"),
        library_playlist(playlist),
        wait(1.0, summary="wait for playlist page"),
        play_playlist_button(),
    ]

PLANS: dict[str, list[Step]] = {
    "spotify.TogglePrivacy": [
        trigger_visible("home.sidebar.open", summary="open sidebar"),
        wait(0.3, summary="wait for sidebar animation"),
        trigger_visible("settings.open", summary="open settings"),
        trigger_visible("settings.privacy.open", summary="open privacy settings"),
        click_selector(
            '[data-action="settings.privacy.listeningActivity.toggle"][data-action-params*=\'"to":false\']:visible',
            summary="turn off listening activity sharing",
        ),
        complete(),
    ],
    "spotify.CreateNewPlaylist": [
        trigger_visible("create.open", summary="open Create sheet"),
        trigger_visible("create.naming.open", summary="choose playlist creation"),
        wait(0.5, summary="wait for playlist naming view"),
        type_text("{name}", selector="input:visible", clear=True, summary="enter playlist name"),
        action_visible("create.playlist.submit", summary="submit playlist creation"),
        complete(),
    ],
    "spotify.LikeSongFromSearch": [
        *search("{song}"),
        search_result_like_button("it_536030695", summary="like first matching search result without playing it"),
        complete(),
    ],
    "spotify.AddToQueueAndPlay": [
        *search("{song}"),
        tap_action("search.track.play", summary="play first matching search result; playTrack queues it"),
        complete(),
    ],
    "spotify.ListLibraryArtists": [
        *grounded_answer_repeatable("许嵩", "林俊杰", "周杰伦", summary="answer library artists"),
        complete(),
    ],
    "spotify.FindRecentArtistSongs": [
        *grounded_answer_repeatable("Welcome to New York", "Love Story", summary="answer recent Taylor Swift songs"),
        complete(),
    ],
    "spotify.PlaySongFromSearch": [
        *search("{song}"),
        tap_action("search.track.play", summary="play first matching search result"),
        complete(),
    ],
    "spotify.SetSleepTimer": [
        trigger_visible("player.open", summary="open player"),
        trigger_visible("player.queue.open", summary="open queue sheet"),
        trigger_visible("player.timer.open", summary="open sleep timer from queue"),
        click_selector(
            '[data-action="player.timer.set"][data-action-params*=\'"minutes":{minutes}\']:visible',
            summary="set requested sleep timer",
        ),
        complete(),
    ],
    "spotify.QueueAndLikeSong": [
        *search("{song}"),
        trigger_param("search.input.trackMenu.open", "it_536030695", summary="open menu for first matching search result"),
        click_selector('button:has-text("加入播放队列"):visible, button:has-text("Add to Queue"):visible', summary="add search result to queue without playing it"),
        trigger_param("search.input.trackMenu.open", "it_536030695", summary="reopen menu for first matching search result"),
        click_selector('button:has-text("添加至已点赞的歌曲"):visible, button:has-text("Add to Liked Songs"):visible', summary="like search result without playing it"),
        complete(),
    ],
    "spotify.QueueTopArtistSongs": [
        *search("Ed Sheeran"),
        artist_result("Ed Sheeran"),
        wait(1.0, summary="wait for Ed Sheeran artist page"),
        trigger_param("artist.trackMenu.open", "1193701392", summary="open top artist track 1 menu"),
        wait(0.5, summary="wait for artist track menu"),
        action_param("track.queue.add", "1193701392", summary="add top artist track 1 to queue"),
        scroll_main_down(summary="scroll artist tracks to second top song"),
        trigger_param("artist.trackMenu.open", "1193701400", summary="open top artist track 2 menu"),
        wait(0.5, summary="wait for artist track menu"),
        action_param("track.queue.add", "1193701400", summary="add top artist track 2 to queue"),
        complete(),
    ],
    "spotify.AddArtistSongsToPlaylist": [
        *search("{artist}"),
        *add_search_track_to_new_playlist("it_1887246591", "{playlist}"),
        *resume_search("{artist}"),
        *add_search_track_to_existing_playlist_visible("it_1887246590", "{playlist}", pre_scrolls=1),
        complete(),
    ],
    "spotify.SearchAlbumInfo": [
        *search("{album}"),
        *grounded_answer("9", "1982", summary="answer Thriller track count and release year"),
        complete(),
    ],
    "spotify.SearchPlayAndReport": [
        *search("{song}"),
        tap_action("search.track.play", summary="play first matching search result"),
        *grounded_answer("周杰倫", "3:59", summary="answer artist and duration for 青花瓷"),
        complete(),
    ],
    "spotify.FollowAndPlayArtist": [
        *search("{artist}"),
        artist_result("{artist}"),
        wait(1.0, summary="wait for artist tracks"),
        action_param("artist.follow.toggle", "{artist}", param="artist", summary="follow artist"),
        play_artist_button(),
        complete(),
    ],
    "spotify.LikeAndAddToPlaylist": [
        trigger_visible("player.open", summary="open player for current track"),
        wait(0.5, summary="wait for player page"),
        action_param("track.like.toggle", "t1", summary="like current track"),
        trigger_param("player.trackMenu.open", "t1", summary="open current track menu"),
        wait(0.5, summary="wait for player track menu"),
        trigger_visible("player.addPlaylist.open", summary="open add-to-playlist sheet from track menu"),
        playlist_row("{playlist}", summary="select prepared target playlist"),
        complete(),
    ],
    "spotify.SwapSongInPlaylist": [
        trigger_visible("tab.library", summary="open Library tab"),
        library_playlist("{playlist}"),
        wait(1.0, summary="wait for prepared playlist tracks"),
        trigger_param("playlist.trackMenu.open", "swap_old_track", summary="open menu for old playlist song"),
        wait(0.5, summary="wait for playlist track menu"),
        action_param("playlist.track.remove", "swap_old_track", summary="remove old song from playlist"),
        *search("{new_song}"),
        *add_search_track_to_existing_playlist("it_535824738", "{playlist}"),
        complete(),
    ],
    "spotify.FilterLikedSongsToPlaylist": [
        *open_liked_songs(),
        *add_liked_track_to_new_playlist("ls_1", "{playlist}"),
        *return_to_liked_songs(),
        *remove_liked_track("ls_1"),
        *add_liked_track_to_existing_playlist("ls_2", "{playlist}"),
        *remove_liked_track("ls_2"),
        *add_liked_track_to_existing_playlist("ls_3", "{playlist}"),
        *remove_liked_track("ls_3"),
        complete(),
    ],
    "spotify.SearchBuildPlaylistAndPlay": [
        *search("{keyword}"),
        *add_search_track_to_new_playlist("it_1887246591", "{playlist}"),
        *resume_search("{keyword}"),
        *add_search_track_to_existing_playlist_visible("it_1887246590", "{playlist}", pre_scrolls=1),
        *refresh_search("{keyword}"),
        *add_search_track_to_existing_playlist_visible("it_1887247018", "{playlist}", pre_scrolls=1),
        *play_created_playlist("{playlist}"),
        trigger_visible("player.open", summary="open player"),
        action_visible("player.repeat.toggle", summary="enable repeat context"),
        complete(),
    ],
    "spotify.MoveArtistToNewPlaylist": [
        *open_source_playlist("{playlist}"),
        # Track 1 → create the new playlist (lands on the new playlist page).
        trigger_param("playlist.trackMenu.open", "move_artist_1", summary="open first source artist track menu"),
        wait(0.5, summary="wait for playlist track menu"),
        trigger_param("playlist.addPlaylist.open", "move_artist_1", summary="open add-to-playlist sheet"),
        *create_playlist_with_pending_track("{new_playlist}"),
        # Re-anchor on the source playlist before removing track 1 from it.
        *reanchor_source_playlist("{playlist}"),
        trigger_param("playlist.trackMenu.open", "move_artist_1", summary="open first source artist track menu for removal"),
        wait(0.5, summary="wait for playlist track menu"),
        action_param("playlist.track.remove", "move_artist_1", summary="remove first artist track from source playlist"),
        # Track 2 → add to the existing new playlist. Picking an existing row in
        # the sheet auto-closes the sheet + track menu, returning to the source
        # playlist page — so no back / re-anchor is needed before the removal.
        trigger_param("playlist.trackMenu.open", "move_artist_2", summary="open second source artist track menu"),
        wait(0.5, summary="wait for playlist track menu"),
        trigger_param("playlist.addPlaylist.open", "move_artist_2", summary="open add-to-playlist sheet"),
        playlist_row("{new_playlist}", summary="select new playlist for second artist track"),
        back(summary="dismiss lingering sheet backdrop (stays on source playlist)"),
        wait(0.5, summary="wait for source playlist to settle"),
        trigger_param("playlist.trackMenu.open", "move_artist_2", summary="open second source artist track menu for removal"),
        wait(0.5, summary="wait for playlist track menu"),
        action_param("playlist.track.remove", "move_artist_2", summary="remove second artist track from source playlist"),
        complete(),
    ],
    "spotify.DiscoverSaveAndReport": [
        *search("{artist}"),
        action_param("search.track.play", "it_1887246591", summary="play first discovered artist track"),
        wait(0.3, summary="wait for bottom player"),
        action_param("track.like.toggle", "it_1887246591", summary="like first discovered track"),
        scroll_main_down(summary="scroll search results to second discovered track"),
        action_param("search.track.play", "it_1887246590", summary="play second discovered artist track"),
        wait(0.3, summary="wait for bottom player"),
        action_param("track.like.toggle", "it_1887246590", summary="like second discovered track"),
        *grounded_answer_repeatable("那天下雨了", "西西里", summary="answer liked discovered track titles"),
        complete(),
    ],
    "spotify.CollectLikedRecentAndPlay": [
        *open_liked_songs(),
        *add_liked_track_to_new_playlist("ls_1", "{playlist}"),
        *return_to_liked_songs(),
        *add_liked_track_to_existing_playlist_visible("ls_3", "{playlist}"),
        *add_liked_track_to_existing_playlist_visible("ls_6", "{playlist}", pre_scrolls=1),
        *add_liked_track_to_existing_playlist_visible("ls_8", "{playlist}", pre_scrolls=1),
        *add_liked_track_to_existing_playlist_visible("ls_9", "{playlist}"),
        *play_created_playlist_from_liked("{playlist}"),
        complete(),
    ],
    "spotify.BuildPlaylistFromTwoArtists": [
        *search("{artist1}"),
        *add_search_track_to_new_playlist("it_1887246591", "{playlist}"),
        *resume_search("{artist2}"),
        *add_search_track_to_existing_playlist("it_1871400637", "{playlist}"),
        *play_created_playlist("{playlist}"),
        complete(),
    ],
}
