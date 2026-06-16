"""Scripted validation plans for Spotify tasks.

These are test assets, not agent logic. ``PLANS`` maps a full ``task.id`` to the
ordered steps that solve it through the GUI. ``ScriptedAgent`` discovers this
module by the task's suite, renders ``{param}`` placeholders from ``task.params``,
and replays each step via the standard environment action space — ``tap_trigger``
/ ``tap_action`` resolve to coordinates through the element's ``data-trigger`` /
``data-action`` attribute at ``env.step()`` time.
"""

from __future__ import annotations

from bench_env.agent.scripted import Step, answer, back, complete, swipe, tap_action, tap_trigger, type_text, wait


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


def search(query: str) -> list[Step]:
    return [
        tap_trigger("tab.search", summary="open Search tab"),
        tap_trigger("search.input.open", summary="open search input"),
        type_text(query, selector="input", clear=True, summary=f"search for {query}"),
        wait(1.0, summary="wait for local search results"),
        back(summary="dismiss search keyboard"),
    ]


def create_playlist_with_pending_track(name: str) -> list[Step]:
    return [
        new_playlist_row(),
        type_text(name, selector="input", clear=True, summary=f"enter playlist name {name}"),
        tap_action("create.playlist.submit", summary="submit new playlist with pending track"),
        wait(0.3, summary="wait for playlist creation"),
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


def add_search_track_to_existing_playlist_visible(track_id: str, playlist: str) -> list[Step]:
    return [
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


def add_liked_track_to_existing_playlist_visible(track_id: str, playlist: str) -> list[Step]:
    return [
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


def open_liked_songs() -> list[Step]:
    return [
        tap_trigger("tab.library", summary="open Library tab"),
        tap_trigger("likedSongs.open", summary="open Liked Songs"),
    ]


def play_created_playlist(playlist: str) -> list[Step]:
    return [
        tap_trigger("tab.library", summary="open Library tab"),
        library_playlist(playlist),
        wait(0.5, summary="wait for playlist page"),
        play_playlist_button(),
    ]

PLANS: dict[str, list[Step]] = {
    "spotify.TogglePrivacy": [
        tap_trigger("home.sidebar.open", summary="open sidebar"),
        tap_trigger("settings.open", summary="open settings"),
        tap_trigger("settings.privacy.open", summary="open privacy settings"),
        tap_action("settings.privacy.listeningActivity.toggle", summary="toggle listening activity privacy"),
        complete(),
    ],
    "spotify.CreateNewPlaylist": [
        tap_trigger("create.open", summary="open Create sheet"),
        tap_trigger("create.naming.open", summary="choose playlist creation"),
        type_text("{name}", selector="input", clear=True, summary="enter playlist name"),
        tap_action("create.playlist.submit", summary="submit playlist creation"),
        complete(),
    ],
    "spotify.LikeSongFromSearch": [
        *search("{song}"),
        tap_action("search.track.play", summary="play first matching search result"),
        tap_action("track.like.toggle", summary="like the currently playing search result"),
        complete(),
    ],
    "spotify.AddToQueueAndPlay": [
        *search("{song}"),
        tap_action("search.track.play", summary="play first matching search result; playTrack queues it"),
        complete(),
    ],
    "spotify.ListLibraryArtists": [
        answer("许嵩 林俊杰 周杰伦", summary="answer library artists from default library"),
        complete(),
    ],
    "spotify.FindRecentArtistSongs": [
        answer("Welcome to New York Love Story", summary="answer recent Taylor Swift songs"),
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
        tap_action("search.track.play", summary="play first matching search result; playTrack queues it"),
        tap_action("track.like.toggle", summary="like the currently playing search result"),
        complete(),
    ],
    "spotify.QueueTopArtistSongs": [
        *search("Ed Sheeran"),
        artist_result("Ed Sheeran"),
        wait(1.0, summary="wait for Ed Sheeran artist page"),
        trigger_param("artist.trackMenu.open", "1193701392", summary="open top artist track 1 menu"),
        action_visible("track.queue.add", summary="add visible top artist track 1 to queue"),
        trigger_param("artist.trackMenu.open", "1193701400", summary="open top artist track 2 menu"),
        action_visible("track.queue.add", summary="add visible top artist track 2 to queue"),
        complete(),
    ],
    "spotify.AddArtistSongsToPlaylist": [
        *search("{artist}"),
        *add_search_track_to_new_playlist("it_1887246591", "{playlist}"),
        *search("{artist}"),
        *add_search_track_to_existing_playlist_visible("it_1887246590", "{playlist}"),
        complete(),
    ],
    "spotify.SearchAlbumInfo": [
        *search("{album}"),
        answer("9 1982", summary="answer Thriller track count and release year"),
        complete(),
    ],
    "spotify.SearchPlayAndReport": [
        *search("{song}"),
        tap_action("search.track.play", summary="play first matching search result"),
        answer("周杰倫 3:59", summary="answer artist and duration for 青花瓷"),
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
        action_param("track.like.toggle", "t1", summary="like current track"),
        trigger_param("player.trackMenu.open", "t1", summary="open current track menu"),
        trigger_param("player.addPlaylist.open", "t1", summary="open add-to-playlist sheet"),
        playlist_row("{playlist}", summary="select prepared target playlist"),
        complete(),
    ],
    "spotify.SwapSongInPlaylist": [
        tap_trigger("tab.library", summary="open Library tab"),
        library_playlist("{playlist}"),
        trigger_param("playlist.trackMenu.open", "swap_old_track", summary="open menu for old playlist song"),
        action_param("playlist.track.remove", "swap_old_track", summary="remove old song from playlist"),
        *search("{new_song}"),
        *add_search_track_to_existing_playlist("it_535824738", "{playlist}"),
        complete(),
    ],
    "spotify.FilterLikedSongsToPlaylist": [
        *open_liked_songs(),
        *add_liked_track_to_new_playlist("ls_1", "{playlist}"),
        *open_liked_songs(),
        *remove_liked_track("ls_1"),
        *open_liked_songs(),
        *add_liked_track_to_existing_playlist("ls_2", "{playlist}"),
        *remove_liked_track("ls_2"),
        *add_liked_track_to_existing_playlist("ls_3", "{playlist}"),
        *remove_liked_track("ls_3"),
        complete(),
    ],
    "spotify.SearchBuildPlaylistAndPlay": [
        *search("{keyword}"),
        *add_search_track_to_new_playlist("it_1887246591", "{playlist}"),
        *search("{keyword}"),
        *add_search_track_to_existing_playlist_visible("it_1887246590", "{playlist}"),
        *search("{keyword}"),
        *add_search_track_to_existing_playlist_visible("it_1887247018", "{playlist}"),
        *play_created_playlist("{playlist}"),
        trigger_visible("player.open", summary="open player"),
        action_visible("player.repeat.toggle", summary="enable repeat context"),
        complete(),
    ],
    "spotify.MoveArtistToNewPlaylist": [
        tap_trigger("tab.library", summary="open Library tab"),
        library_playlist("{playlist}"),
        trigger_param("playlist.trackMenu.open", "move_artist_1", summary="open first source artist track menu"),
        trigger_param("playlist.addPlaylist.open", "move_artist_1", summary="open add-to-playlist sheet"),
        *create_playlist_with_pending_track("{new_playlist}"),
        tap_trigger("tab.library", summary="open Library tab"),
        library_playlist("{playlist}"),
        trigger_param("playlist.trackMenu.open", "move_artist_1", summary="open first source artist track menu for removal"),
        action_param("playlist.track.remove", "move_artist_1", summary="remove first artist track from source playlist"),
        tap_trigger("tab.library", summary="open Library tab"),
        library_playlist("{playlist}"),
        trigger_param("playlist.trackMenu.open", "move_artist_2", summary="open second source artist track menu"),
        trigger_param("playlist.addPlaylist.open", "move_artist_2", summary="open add-to-playlist sheet"),
        playlist_row("{new_playlist}", summary="select new playlist for second artist track"),
        back(summary="close add-to-playlist sheet"),
        trigger_param("playlist.trackMenu.open", "move_artist_2", summary="open second source artist track menu for removal"),
        action_param("playlist.track.remove", "move_artist_2", summary="remove second artist track from source playlist"),
        complete(),
    ],
    "spotify.DiscoverSaveAndReport": [
        *search("{artist}"),
        action_param("search.track.play", "it_1887246591", summary="play first discovered artist track"),
        action_visible("track.like.toggle", summary="like first discovered track"),
        action_param("search.track.play", "it_1887246590", summary="play second discovered artist track"),
        action_visible("track.like.toggle", summary="like second discovered track"),
        answer("那天下雨了 西西里", summary="answer liked discovered track titles"),
        complete(),
    ],
    "spotify.CollectLikedRecentAndPlay": [
        *open_liked_songs(),
        *add_liked_track_to_new_playlist("ls_1", "{playlist}"),
        *open_liked_songs(),
        *add_liked_track_to_existing_playlist_visible("ls_3", "{playlist}"),
        *add_liked_track_to_existing_playlist_visible("ls_6", "{playlist}"),
        scroll_down(summary="scroll liked songs to lower recent-liked tracks"),
        *add_liked_track_to_existing_playlist_visible("ls_8", "{playlist}"),
        *add_liked_track_to_existing_playlist_visible("ls_9", "{playlist}"),
        *play_created_playlist("{playlist}"),
        complete(),
    ],
    "spotify.BuildPlaylistFromTwoArtists": [
        *search("{artist1}"),
        *add_search_track_to_new_playlist("it_1887246591", "{playlist}"),
        *search("{artist2}"),
        *add_search_track_to_existing_playlist("it_1871400637", "{playlist}"),
        *play_created_playlist("{playlist}"),
        complete(),
    ],
}
