"""Scripted validation plans for Spotify tasks.

These are test assets, not agent logic. ``PLANS`` maps a full ``task.id`` to the
ordered steps that solve it through the GUI. ``ScriptedAgent`` discovers this
module by the task's suite, renders ``{param}`` placeholders from ``task.params``
(plus ``DERIVED_PARAMS`` below), and replays each step via the standard
environment action space — ``tap_trigger`` / ``tap_action`` resolve to
coordinates through the element's ``data-trigger`` / ``data-action`` attribute
at ``env.step()`` time.

Sampling compatibility (``DERIVED_PARAMS``): every plan value that used to be
hardcoded (search-result track ids like ``it_536030695``, liked-song ids like
``ls_1``, artist-card names, album collection ids, asserted titles/durations)
is now computed at materialization time from the episode's post-setup initial
state and/or the *same static offline data the judges read*:

- dynamic state (liked songs, recent plays, current track, prepared playlists)
  goes through the judge-homologous ``Spotify`` domain class over
  ``init_state["apps"]["spotify"]`` — exactly how judges build
  ``Spotify(input.apps_init["spotify"])``;
- static search data goes through the same ``searchResults.json`` /
  ``albumTracks.json`` / ``artistTracks.json`` tables the judge module loads
  (``Spotify.search_local_tracks`` / ``lookup_album_info`` /
  ``lookup_artist_tracks`` read these exact structures; ``_SEARCH_RESULTS`` /
  ``_ALBUM_TRACKS`` are imported from the judge module so both sides can never
  diverge on file path or key normalization).

Explicitly injected params (tests) always win over calculators;
``test_scripted.py`` deliberately injects declared parameters only, so live
runs exercise this derivation path end to end — the same path official
``--agent scripted`` sampling takes.

Restricted ``Branch`` usage (structure depends on sampled values):

- ``FindRecentArtistSongs`` — {artist} has 1 or 2 recent plays → 1 or 2
  repeatable answer rows;
- ``QueueTopArtistSongs`` / ``DiscoverSaveAndReport`` — {count} is 2 (live
  test pin) or 3 (sampling default) queued/liked tracks;
- ``BuildPlaylistFromTwoArtists`` — {count} is 1 (live test pin) or 2
  (sampling default) tracks per artist;
- ``FilterLikedSongsToPlaylist`` — the sampled {artist} owns 2 or 3 liked
  songs at data-fixed list positions → different scroll cadence per position
  class (see the pick function for the mapping).

Geometry exemptions (scroll counts encode fixed data/layout, kept as comments
at the bind sites rather than made dynamic):

- Search-results song rows: row 1 is visible after a search; a fresh list
  needs one pre-scroll for row 2 (the add-to-playlist flows re-anchor the
  list per track). Row 1 may sit at the very bottom edge for tall
  top-result blocks (adele), so ``DiscoverSaveAndReport`` does its single
  scroll right after playing row 1 — that lifts rows 1-3 into the safe
  mid-screen band before any like/assert. Derived "first/second/third
  result" ids are the top rows for every curated ``searchResults.json``
  key, so the cadence holds.
- Liked-songs rows: ~5 rows visible initially, 1 scroll reaches rows 6-7,
  2 scrolls reach rows 8-10. Default ``likedSongs`` positions are data-fixed
  (no sampler mutates the list), which the Branch pick maps to a cadence.
- Recently-played page: the 6 default ``recentPlays`` land in one collapsed
  "已播放 {n} 首歌曲" group; {n} is derived but the single-group layout is
  data-fixed.
- Library "All" list: exactly 3 followed artists render without scrolling;
  the 3 repeatable answer rows are a structural assumption guarded by the
  ``_library_artist`` calculator (raises loudly on any other count).
"""

from __future__ import annotations

from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
    Step,
    assert_answer,
    assert_visible,
    awake,
    back,
    complete,
    grounded_answer,
    grounded_answer_repeatable,
    swipe,
    tap_action,
    tap_trigger,
    type_text,
    wait,
)

# Judge-source imports: the Spotify domain class plus the exact static tables
# the judge module loads (private by convention, but reading them through the
# judge module guarantees path/normalization homology with the judges).
from bench_env.task.spotify.app import (
    _ALBUM_TRACKS,
    _SEARCH_RESULTS,
    Spotify,
    match_with_aliases,
    track_identity_key,
)


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


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (check_goals / get_answer in
# bench_env/task/spotify/tasks.py) through the same Spotify domain class over
# the same initial state, or through the same offline search tables the judge
# module loads — so derived values are judge-homologous by construction.

def _spotify(state: dict[str, Any]) -> Spotify:
    """Judge-homologous accessor: ``Spotify(init_state["apps"]["spotify"])``."""
    return Spotify(state["apps"]["spotify"])


def _search_songs(query: str) -> list[dict[str, Any]]:
    """Offline song results for ``query`` — the exact body of
    ``Spotify.search_local_tracks`` (lower-cased key into searchResults.json),
    which is also where ``resolve_search_results`` lands when the episode's
    searchHistory is still empty (always true at materialization time)."""
    entry = _SEARCH_RESULTS.get(str(query or "").strip().lower())
    return list(entry.get("songs") or []) if entry else []


def _first_song_matching_title(query: str) -> dict[str, Any]:
    """First search result whose *title* matches the query — the row a user
    identifies as "the song {query}"; the judges then verify the liked/queued/
    playing title with the same ``match_with_aliases``."""
    for track in _search_songs(query):
        if match_with_aliases(query, str(track.get("title") or "")):
            return track
    raise ValueError(f"no offline search result title matches {query!r}")


def _nth_search_song(query: str, nth: int) -> dict[str, Any]:
    """Plain nth search result — the judge's ``resolve_search_results`` slice
    (DiscoverSaveAndReport / SearchBuildPlaylistAndPlay count semantics)."""
    songs = _search_songs(query)
    if nth < len(songs):
        return songs[nth]
    return {}


def _nth_song_by_artist(query: str, artist: str, nth: int) -> str:
    """Id of the nth search result *by {artist}* — judges count playlist/liked
    tracks via ``match_with_aliases(artist, track.artist)``, so only by-artist
    rows can satisfy them. For every curated artist key these are also the top
    rows, keeping the scroll cadence valid (see module docstring)."""
    matches = [
        track for track in _search_songs(query)
        if match_with_aliases(artist, str(track.get("artist") or ""))
    ]
    if nth < len(matches):
        return str(matches[nth].get("id") or "")
    return ""


def _artist_card_name(query: str) -> str:
    """The artist-card name the SearchInputPage binds into ``artist.open``
    (``params: {name: artistName}``) — read from the same searchResults.json
    entry, first card matching the query. Needed because card names may be
    traditional-Chinese (查 周杰伦 → 卡片 周杰倫) while task params/judge
    aliases are simplified."""
    entry = _SEARCH_RESULTS.get(str(query or "").strip().lower()) or {}
    for card in entry.get("artists") or []:
        name = str(card.get("artistName") or "")
        if name and match_with_aliases(query, name):
            return name
    raise ValueError(f"no offline artist card matches {query!r}")


def _album_id_and_info(album: str) -> tuple[str, dict[str, Any]]:
    """First album card of the {album} query that has offline albumTracks data
    — the same searchResults→albumTracks chain ``Spotify.lookup_album_info``
    walks, additionally surfacing the card's collectionId for the
    ``playlist.open`` trigger."""
    query = str(album or "").strip().lower()
    for card in (_SEARCH_RESULTS.get(query) or {}).get("albums") or []:
        cid = str(card.get("collectionId") or "")
        data = _ALBUM_TRACKS.get(cid)
        if isinstance(data, dict) and isinstance(data.get("albumInfo"), dict):
            return cid, data["albumInfo"]
    raise ValueError(f"album {album!r} not found in offline search data")


def _queue_top_artist(task: Any, state: dict[str, Any]) -> str:
    """Mirror QueueTopArtistSongs.check_goals: the artist of the recently
    played {song}, resolved from the initial state."""
    return _spotify(state).artist_of_recent_play(task.p.song)


def _top_artist_track_id(task: Any, state: dict[str, Any], nth: int) -> str:
    """Id of the nth artistTracks.json entry for the {song}'s artist — the
    exact list ``check_queue_has_top_artist_tracks`` builds its expected
    titles from."""
    tracks = Spotify.lookup_artist_tracks(_queue_top_artist(task, state)) or []
    if nth < len(tracks):
        return str(tracks[nth].get("id") or "")
    return ""


def _library_artist(state: dict[str, Any], nth: int) -> str:
    """Nth library artist (judge: ListLibraryArtists.get_answer over
    ``library_artist_names``). The plan renders exactly 3 repeatable answer
    rows, so any other artist count is a structural drift → fail loudly."""
    names = _spotify(state).library_artist_names
    if len(names) != 3:
        raise ValueError(
            f"ListLibraryArtists plan encodes 3 library-artist rows, "
            f"initial state has {len(names)}: {names}"
        )
    return str(names[nth])


def _recent_title_by_artist(task: Any, state: dict[str, Any], nth: int) -> str:
    """Nth recentPlays title by {artist} — the judge's
    ``recent_play_titles_by_artist`` list, same order."""
    titles = _spotify(state).recent_play_titles_by_artist(task.p.artist)
    if nth < len(titles):
        return str(titles[nth])
    return ""


def _current_track_id(task: Any, state: dict[str, Any]) -> str:
    """Id of the initial currentTrack (seeded by LikeAndAddToPlaylist._prepare;
    judge reads the same track via ``sp.init.current_track_title``)."""
    track = _spotify(state).current_track
    if not isinstance(track, dict) or not track.get("id"):
        raise ValueError("LikeAndAddToPlaylist: initial currentTrack is empty")
    return str(track["id"])


def _playlist_track_id_by_title(state: dict[str, Any], playlist: str, title: str) -> str:
    """Id of the {playlist} track whose title matches {title} — the judge
    checks removal/addition by title with the same ``match_with_aliases``."""
    found = _spotify(state).get_playlist_by_name(playlist)
    for track in (found or {}).get("tracks") or []:
        if match_with_aliases(title, str(track.get("title") or "")):
            return str(track.get("id") or "")
    raise ValueError(f"no track titled {title!r} in playlist {playlist!r}")


def _playlist_track_id_by_artist(state: dict[str, Any], playlist: str, artist: str, nth: int) -> str:
    """Id of the nth {playlist} track by {artist} — the judge counts moved
    tracks via ``count_artist_in_playlist`` (same artist matcher)."""
    found = _spotify(state).get_playlist_by_name(playlist)
    matches = [
        track for track in (found or {}).get("tracks") or []
        if match_with_aliases(artist, str(track.get("artist") or ""))
    ]
    if nth < len(matches):
        return str(matches[nth].get("id") or "")
    raise ValueError(f"playlist {playlist!r} has {len(matches)} track(s) by {artist!r}, need index {nth}")


def _liked_track_id_by_artist(task: Any, state: dict[str, Any], nth: int) -> str:
    """Id of the nth liked song by {artist}, in likedSongs order — the judge
    counts moved/remaining tracks with the same artist matcher."""
    matches = [
        track for track in _spotify(state).liked_songs
        if match_with_aliases(task.p.artist, str(track.get("artist") or ""))
    ]
    if nth < len(matches):
        return str(matches[nth].get("id") or "")
    return ""


def _liked_recent_id(state: dict[str, Any], nth: int) -> str:
    """Nth liked∩recent track id in likedSongs order. Judge
    (``liked_recent_intersection``) filters recentPlays by the same identity
    keys — identical set, recentPlays order; the plan walks the *liked list*
    top-down so likedSongs order keeps the scroll cadence monotonic. The
    5-entry count is data-fixed (no sampler mutates either list)."""
    sp = _spotify(state)
    recent_keys = {track_identity_key(track) for track in sp.recent_plays}
    ids = [
        str(track.get("id") or "")
        for track in sp.liked_songs
        if track_identity_key(track) in recent_keys
    ]
    if len(ids) != 5:
        raise ValueError(
            f"CollectLikedRecentAndPlay plan encodes 5 liked∩recent rows "
            f"(data-fixed), initial state has {len(ids)}: {ids}"
        )
    return ids[nth]


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "spotify.TogglePrivacy": {
        # CriteriaTask inverts the initial value, so the visible toggle action
        # carries params {"to": <target>} — render the JSON literal.
        "privacy_to": lambda task, state: "true" if task.p.toggle else "false",
    },
    "spotify.LikeSongFromSearch": {
        "track_id": lambda task, state: str(_first_song_matching_title(task.p.song).get("id") or ""),
    },
    "spotify.QueueAndLikeSong": {
        "track_id": lambda task, state: str(_first_song_matching_title(task.p.song).get("id") or ""),
    },
    "spotify.SearchPlayAndReport": {
        # Play the first title-matching row and answer *its* artist/duration —
        # the judge reads the same fields off the post-play currentTrack.
        "track_id": lambda task, state: str(_first_song_matching_title(task.p.song).get("id") or ""),
        "answer_artist": lambda task, state: str(_first_song_matching_title(task.p.song).get("artist") or ""),
        "answer_duration": lambda task, state: str(_first_song_matching_title(task.p.song).get("duration") or ""),
    },
    "spotify.ListLibraryArtists": {
        "lib_artist_1": lambda task, state: _library_artist(state, 0),
        "lib_artist_2": lambda task, state: _library_artist(state, 1),
        "lib_artist_3": lambda task, state: _library_artist(state, 2),
    },
    "spotify.FindRecentArtistSongs": {
        "recent_count": lambda task, state: len(_spotify(state).recent_plays),
        "recent_title_1": lambda task, state: _recent_title_by_artist(task, state, 0),
        "recent_title_2": lambda task, state: _recent_title_by_artist(task, state, 1),
    },
    "spotify.QueueTopArtistSongs": {
        "artist_query": _queue_top_artist,
        "artist_card": lambda task, state: _artist_card_name(_queue_top_artist(task, state)),
        "top_track_1": lambda task, state: _top_artist_track_id(task, state, 0),
        "top_track_2": lambda task, state: _top_artist_track_id(task, state, 1),
        "top_track_3": lambda task, state: _top_artist_track_id(task, state, 2),
    },
    "spotify.AddArtistSongsToPlaylist": {
        "artist_track_1": lambda task, state: _nth_song_by_artist(task.p.artist, task.p.artist, 0),
        "artist_track_2": lambda task, state: _nth_song_by_artist(task.p.artist, task.p.artist, 1),
    },
    "spotify.SearchAlbumInfo": {
        "album_id": lambda task, state: _album_id_and_info(task.p.album)[0],
        "answer_count": lambda task, state: str(_album_id_and_info(task.p.album)[1]["trackCount"]),
        "answer_year": lambda task, state: str(_album_id_and_info(task.p.album)[1]["year"]),
    },
    "spotify.FollowAndPlayArtist": {
        # The artist card / ArtistPage route name may be traditional Chinese
        # while {artist} is simplified — follow/track params carry the card name.
        "artist_card": lambda task, state: _artist_card_name(task.p.artist),
    },
    "spotify.LikeAndAddToPlaylist": {
        "current_track_id": _current_track_id,
    },
    "spotify.SwapSongInPlaylist": {
        "old_track_id": lambda task, state: _playlist_track_id_by_title(state, task.p.playlist, task.p.old_song),
        "new_track_id": lambda task, state: str(_first_song_matching_title(task.p.new_song).get("id") or ""),
    },
    "spotify.FilterLikedSongsToPlaylist": {
        "liked_track_1": lambda task, state: _liked_track_id_by_artist(task, state, 0),
        "liked_track_2": lambda task, state: _liked_track_id_by_artist(task, state, 1),
        "liked_track_3": lambda task, state: _liked_track_id_by_artist(task, state, 2),
    },
    "spotify.SearchBuildPlaylistAndPlay": {
        "kw_track_1": lambda task, state: str(_nth_search_song(task.p.keyword, 0).get("id") or ""),
        "kw_track_2": lambda task, state: str(_nth_search_song(task.p.keyword, 1).get("id") or ""),
        "kw_track_3": lambda task, state: str(_nth_search_song(task.p.keyword, 2).get("id") or ""),
    },
    "spotify.MoveArtistToNewPlaylist": {
        "src_track_1": lambda task, state: _playlist_track_id_by_artist(state, task.p.playlist, task.p.artist, 0),
        "src_track_2": lambda task, state: _playlist_track_id_by_artist(state, task.p.playlist, task.p.artist, 1),
    },
    "spotify.DiscoverSaveAndReport": {
        "result_id_1": lambda task, state: str(_nth_search_song(task.p.artist, 0).get("id") or ""),
        "result_id_2": lambda task, state: str(_nth_search_song(task.p.artist, 1).get("id") or ""),
        "result_id_3": lambda task, state: str(_nth_search_song(task.p.artist, 2).get("id") or ""),
        "result_title_1": lambda task, state: str(_nth_search_song(task.p.artist, 0).get("title") or ""),
        "result_title_2": lambda task, state: str(_nth_search_song(task.p.artist, 1).get("title") or ""),
        "result_title_3": lambda task, state: str(_nth_search_song(task.p.artist, 2).get("title") or ""),
    },
    "spotify.CollectLikedRecentAndPlay": {
        "liked_recent_1": lambda task, state: _liked_recent_id(state, 0),
        "liked_recent_2": lambda task, state: _liked_recent_id(state, 1),
        "liked_recent_3": lambda task, state: _liked_recent_id(state, 2),
        "liked_recent_4": lambda task, state: _liked_recent_id(state, 3),
        "liked_recent_5": lambda task, state: _liked_recent_id(state, 4),
    },
    "spotify.BuildPlaylistFromTwoArtists": {
        "a1_track_1": lambda task, state: _nth_song_by_artist(task.p.artist1, task.p.artist1, 0),
        "a1_track_2": lambda task, state: _nth_song_by_artist(task.p.artist1, task.p.artist1, 1),
        "a2_track_1": lambda task, state: _nth_song_by_artist(task.p.artist2, task.p.artist2, 0),
        "a2_track_2": lambda task, state: _nth_song_by_artist(task.p.artist2, task.p.artist2, 1),
    },
}


# ---------------------------------------------------------------------------
# Branch pick functions + parametric branch bodies
# ---------------------------------------------------------------------------

def _recent_artist_songs_pick(task: Any, state: dict[str, Any]) -> str:
    """Mirror FindRecentArtistSongs.get_answer: 1 or 2 recentPlays titles by
    {artist} → 1 or 2 repeatable answer rows."""
    count = len(_spotify(state).recent_play_titles_by_artist(task.p.artist))
    return {1: "one", 2: "two"}.get(count, f"unsupported({count} titles)")


def _count_pick(task: Any, state: dict[str, Any]) -> str:
    """Pick the {count}-sized arm (unknown counts fail loudly at materialize)."""
    return str(int(task.p.count))


def _filter_liked_pick(task: Any, state: dict[str, Any]) -> str:
    """Map the sampled {artist}'s liked-song positions to a scroll cadence.

    Default likedSongs geometry (~5 rows visible, 1 scroll → rows 6-7,
    2 scrolls → rows 8-10):

    - ``front3``  — 3 songs ending by row 6 (Taylor Swift rows 1-3,
      Ed Sheeran rows 4-6): first interaction row ≤4, and each removal pulls
      the next song up into view → no scrolling at all;
    - ``mid2``    — 2 songs starting around row 7 (Adele rows 7-8): one
      scroll before each first-touch of the list;
    - ``low2``    — 2 songs at rows 9-10 (Billie Eilish): two scrolls
      (clamped at list bottom) before each first-touch.
    """
    liked = _spotify(state).liked_songs
    positions = [
        idx for idx, track in enumerate(liked)
        if match_with_aliases(task.p.artist, str(track.get("artist") or ""))
    ]
    if len(positions) == 3 and positions[-1] <= 5:
        return "front3"
    if len(positions) == 2 and 5 <= positions[0] <= 6:
        return "mid2"
    if len(positions) == 2 and positions[0] >= 7:
        return "low2"
    return f"unsupported(rows {positions})"


def _recent_artist_songs_branch(rows: int) -> list[Step]:
    """Sidebar → Recently Played → expand today's group → assert + answer the
    {artist}'s 1 or 2 recent titles."""
    steps: list[Step] = [
        awake("Spotify", summary="open Spotify"),
        trigger_visible("home.sidebar.open", summary="open sidebar"),
        wait(0.3, summary="wait for sidebar animation"),
        trigger_visible("history.open", summary="open Recently Played page"),
        wait(0.5, summary="wait for recently played groups"),
        # The {recent_count} default recentPlays land in one collapsed group
        # (data-fixed single-group layout, count derived from init state).
        click_selector(
            'div.cursor-pointer:has-text("已播放 {recent_count} 首歌曲"):visible, '
            'div.cursor-pointer:has-text("Played {recent_count} songs"):visible',
            summary="expand today's played group to view song rows",
        ),
        wait(0.3, summary="wait for expanded track rows"),
        # Self-verify: every answered title must be visible in the expanded
        # played group before the answer sheet opens (one assert per value).
        assert_answer("{recent_title_1}", field_index=0, summary="assert recent song row {recent_title_1} on screen"),
    ]
    answers = ["{recent_title_1}"]
    if rows == 2:
        steps.append(
            assert_answer("{recent_title_2}", field_index=0, summary="assert recent song row {recent_title_2} on screen")
        )
        answers.append("{recent_title_2}")
    steps.extend(grounded_answer_repeatable(*answers, summary="answer recent artist songs"))
    steps.append(complete())
    return steps


def _queue_top_artist_branch(count: int) -> list[Step]:
    """Search the {song}'s artist, open the artist page, queue the top
    {count} tracks. Row cadence: track 1 visible under the hero, one
    scroll_main_down reveals the next rows (tracks 2-3 both fit — fixed
    layout, ~56px rows on a ~10-row list)."""
    steps: list[Step] = [
        *search("{artist_query}"),
        artist_result("{artist_card}"),
        wait(1.0, summary="wait for artist page top tracks"),
        trigger_param("artist.trackMenu.open", "{top_track_1}", summary="open top artist track 1 menu"),
        wait(0.5, summary="wait for artist track menu"),
        action_param("track.queue.add", "{top_track_1}", summary="add top artist track 1 to queue"),
        scroll_main_down(summary="scroll artist tracks past the top song"),
        trigger_param("artist.trackMenu.open", "{top_track_2}", summary="open top artist track 2 menu"),
        wait(0.5, summary="wait for artist track menu"),
        action_param("track.queue.add", "{top_track_2}", summary="add top artist track 2 to queue"),
    ]
    if count == 3:
        steps += [
            trigger_param("artist.trackMenu.open", "{top_track_3}", summary="open top artist track 3 menu"),
            wait(0.5, summary="wait for artist track menu"),
            action_param("track.queue.add", "{top_track_3}", summary="add top artist track 3 to queue"),
        ]
    steps.append(complete())
    return steps


def _discover_branch(count: int) -> list[Step]:
    """Search {artist}, play row 1, then ONE scroll before any like: depending
    on the query's top-result/artist-card block height, row 1 can sit at the
    very bottom edge (adele ≈ y 795/800) where its like button collides with
    the mini-player/tab bar after playback starts — one scroll lifts rows 1-3
    into the safe mid-screen band (row 1 stays on screen), and it happens
    before the first like so no liked-toast overlay can intercept the drag.
    After that, play+like each row in place (taps use multi-point probing and
    are toast-tolerant), asserting each title on screen, then answer."""
    steps: list[Step] = [
        *search("{artist}"),
        action_param("search.track.play", "{result_id_1}", summary="play discovered artist track 1"),
        wait(0.5, summary="wait for bottom player"),
        scroll_main_down(summary="scroll discovered tracks into mid-screen band"),
        action_param("track.like.toggle", "{result_id_1}", summary="like discovered track 1"),
        assert_answer(
            "{result_title_1}",
            field_index=0,
            summary="assert liked track 1 title {result_title_1} on screen",
        ),
    ]
    for n in range(2, count + 1):
        steps += [
            action_param("search.track.play", f"{{result_id_{n}}}", summary=f"play discovered artist track {n}"),
            wait(0.3, summary="wait for bottom player"),
            action_param("track.like.toggle", f"{{result_id_{n}}}", summary=f"like discovered track {n}"),
            assert_answer(
                f"{{result_title_{n}}}",
                field_index=0,
                summary=f"assert liked track {n} title {{result_title_{n}}} on screen",
            ),
        ]
    steps.extend(
        grounded_answer_repeatable(
            *[f"{{result_title_{n}}}" for n in range(1, count + 1)],
            summary="answer liked discovered track titles",
        )
    )
    steps.append(complete())
    return steps


def _filter_liked_branch(songs: int, scrolls: int) -> list[Step]:
    """Move the {artist}'s liked songs (top-down) into a new {playlist}.

    ``scrolls`` pre-scrolls precede the first touch of a freshly-anchored
    liked list (see ``_filter_liked_pick`` for the position classes). After
    the first removal every later song sits at the first song's row, so no
    further scrolling is needed within one anchoring.
    """

    def scrolled(target: str) -> list[Step]:
        return [
            scroll_main_down(summary=f"scroll liked songs to {target} {i + 1}/{scrolls}")
            for i in range(scrolls)
        ]

    steps: list[Step] = [
        *open_liked_songs(),
        *scrolled("{liked_track_1}"),
        *add_liked_track_to_new_playlist("{liked_track_1}", "{playlist}"),
        *return_to_liked_songs(),
        *scrolled("{liked_track_1}"),
        *remove_liked_track("{liked_track_1}"),
        *add_liked_track_to_existing_playlist("{liked_track_2}", "{playlist}"),
        *remove_liked_track("{liked_track_2}"),
    ]
    if songs == 3:
        steps += [
            *add_liked_track_to_existing_playlist("{liked_track_3}", "{playlist}"),
            *remove_liked_track("{liked_track_3}"),
        ]
    steps.append(complete())
    return steps


def _two_artists_branch(count: int) -> list[Step]:
    """Create {playlist} from {artist1}'s first result, add {count}-1 more of
    {artist1} and {count} of {artist2}, then play the playlist. Search-result
    row cadence: row 1 visible, row 2 needs one pre-scroll (fixed layout)."""
    steps: list[Step] = [
        *search("{artist1}"),
        *add_search_track_to_new_playlist("{a1_track_1}", "{playlist}"),
    ]
    if count == 1:
        steps += [
            *resume_search("{artist2}"),
            *add_search_track_to_existing_playlist("{a2_track_1}", "{playlist}"),
        ]
    else:
        steps += [
            *resume_search("{artist1}"),
            *add_search_track_to_existing_playlist_visible("{a1_track_2}", "{playlist}", pre_scrolls=1),
            *refresh_search("{artist2}"),
            *add_search_track_to_existing_playlist("{a2_track_1}", "{playlist}"),
            *refresh_search("{artist2}"),
            *add_search_track_to_existing_playlist_visible("{a2_track_2}", "{playlist}", pre_scrolls=1),
        ]
    steps += [
        *play_created_playlist("{playlist}"),
        complete(),
    ]
    return steps


PLANS: dict[str, list[Step] | Branch] = {
    "spotify.TogglePrivacy": [
        trigger_visible("home.sidebar.open", summary="open sidebar"),
        wait(0.3, summary="wait for sidebar animation"),
        trigger_visible("settings.open", summary="open settings"),
        trigger_visible("settings.privacy.open", summary="open privacy settings"),
        click_selector(
            '[data-action="settings.privacy.listeningActivity.toggle"][data-action-params*=\'"to":{privacy_to}\']:visible',
            summary="set listening activity sharing to {privacy_to}",
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
        search_result_like_button("{track_id}", summary="like first matching search result without playing it"),
        complete(),
    ],
    "spotify.AddToQueueAndPlay": [
        *search("{song}"),
        tap_action("search.track.play", summary="play first matching search result; playTrack queues it"),
        complete(),
    ],
    "spotify.ListLibraryArtists": [
        # Gather the answer on-screen first: followed artists render as rows in
        # the Library "All" list (3 entries — no scrolling needed).
        awake("Spotify", summary="open Spotify"),
        trigger_visible("tab.library", summary="open Library tab to view followed artists"),
        wait(0.5, summary="wait for library artist rows"),
        # Self-verify: each answered artist name must be visible in the library
        # list before the answer sheet opens (one assert per repeatable value).
        assert_answer("{lib_artist_1}", field_index=0, summary="assert library artist row {lib_artist_1} on screen"),
        assert_answer("{lib_artist_2}", field_index=0, summary="assert library artist row {lib_artist_2} on screen"),
        assert_answer("{lib_artist_3}", field_index=0, summary="assert library artist row {lib_artist_3} on screen"),
        *grounded_answer_repeatable("{lib_artist_1}", "{lib_artist_2}", "{lib_artist_3}", summary="answer library artists"),
        complete(),
    ],
    # 1 or 2 recentPlays titles by the sampled {artist} → 1 or 2 answer rows.
    "spotify.FindRecentArtistSongs": Branch(
        pick=_recent_artist_songs_pick,
        branches={
            "one": _recent_artist_songs_branch(1),
            "two": _recent_artist_songs_branch(2),
        },
    ),
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
        trigger_param("search.input.trackMenu.open", "{track_id}", summary="open menu for first matching search result"),
        click_selector('button:has-text("加入播放队列"):visible, button:has-text("Add to Queue"):visible', summary="add search result to queue without playing it"),
        trigger_param("search.input.trackMenu.open", "{track_id}", summary="reopen menu for first matching search result"),
        click_selector('button:has-text("添加至已点赞的歌曲"):visible, button:has-text("Add to Liked Songs"):visible', summary="like search result without playing it"),
        complete(),
    ],
    # count=2 is the live-test pin; sampling always takes the count=3 arm
    # (integer params sample as their default).
    "spotify.QueueTopArtistSongs": Branch(
        pick=_count_pick,
        branches={
            "2": _queue_top_artist_branch(2),
            "3": _queue_top_artist_branch(3),
        },
    ),
    # Adds 2 by-artist tracks — satisfies the judge's ">= init + {min_count}"
    # for min_count <= 2 (sampling default 1, live test pin 2).
    "spotify.AddArtistSongsToPlaylist": [
        *search("{artist}"),
        *add_search_track_to_new_playlist("{artist_track_1}", "{playlist}"),
        *resume_search("{artist}"),
        *add_search_track_to_existing_playlist_visible("{artist_track_2}", "{playlist}", pre_scrolls=1),
        complete(),
    ],
    "spotify.SearchAlbumInfo": [
        *search("{album}"),
        # Album cards render above song rows in unfiltered results; open the
        # first offline-backed album card (the judge's lookup_album_info pick)
        # to see the track count and "℗ {year}" on the album page.
        trigger_param("playlist.open", "{album_id}", param="id", summary="open {album} album from search results"),
        wait(1.0, summary="wait for album page with track count and release year"),
        # Self-verify before answering. Field 0 is a bare short number — a raw
        # assert_answer would match any stray digit, so anchor on the album
        # page's semantic track-count row instead (zh/en locales).
        assert_visible(
            '[data-adjust-resize] :text("{answer_count} 首歌曲"):visible, [data-adjust-resize] :text("{answer_count} songs"):visible',
            summary='assert album track-count row "{answer_count} 首歌曲" on screen',
        ),
        # Field 1 (release year): the album subtitle shows "… ℗ {answer_year} …".
        assert_answer("{answer_year}", field_index=1, summary="assert release year {answer_year} on album page"),
        *grounded_answer("{answer_count}", "{answer_year}", summary="answer album track count and release year"),
        complete(),
    ],
    "spotify.SearchPlayAndReport": [
        *search("{song}"),
        action_param("search.track.play", "{track_id}", summary="play first matching search result"),
        # Artist is visible on the search result row; duration only shows in the
        # full-screen player (progress bar right end) — open it before answering.
        wait(0.5, summary="wait for bottom player bar"),
        trigger_visible("player.open", summary="open full-screen player to view duration"),
        wait(0.5, summary="wait for player page"),
        # Self-verify: artist name and static total duration (progress bar right
        # end renders currentTrack.duration) must be visible before answering.
        assert_answer("{answer_artist}", field_index=0, summary="assert artist {answer_artist} on player page"),
        assert_answer("{answer_duration}", field_index=1, summary="assert duration {answer_duration} on player page"),
        *grounded_answer("{answer_artist}", "{answer_duration}", summary="answer artist and duration for {song}"),
        complete(),
    ],
    "spotify.FollowAndPlayArtist": [
        *search("{artist}"),
        artist_result("{artist_card}"),
        wait(1.0, summary="wait for artist tracks"),
        action_param("artist.follow.toggle", "{artist_card}", param="artist", summary="follow artist"),
        play_artist_button(),
        complete(),
    ],
    "spotify.LikeAndAddToPlaylist": [
        trigger_visible("player.open", summary="open player for current track"),
        wait(0.5, summary="wait for player page"),
        action_param("track.like.toggle", "{current_track_id}", summary="like current track"),
        trigger_param("player.trackMenu.open", "{current_track_id}", summary="open current track menu"),
        wait(0.5, summary="wait for player track menu"),
        trigger_visible("player.addPlaylist.open", summary="open add-to-playlist sheet from track menu"),
        playlist_row("{playlist}", summary="select prepared target playlist"),
        complete(),
    ],
    "spotify.SwapSongInPlaylist": [
        trigger_visible("tab.library", summary="open Library tab"),
        library_playlist("{playlist}"),
        wait(1.0, summary="wait for prepared playlist tracks"),
        trigger_param("playlist.trackMenu.open", "{old_track_id}", summary="open menu for old playlist song"),
        wait(0.5, summary="wait for playlist track menu"),
        action_param("playlist.track.remove", "{old_track_id}", summary="remove old song from playlist"),
        *search("{new_song}"),
        *add_search_track_to_existing_playlist("{new_track_id}", "{playlist}"),
        complete(),
    ],
    # Scroll cadence per liked-row position class of the sampled {artist} —
    # see _filter_liked_pick.
    "spotify.FilterLikedSongsToPlaylist": Branch(
        pick=_filter_liked_pick,
        branches={
            "front3": _filter_liked_branch(3, 0),
            "mid2": _filter_liked_branch(2, 1),
            "low2": _filter_liked_branch(2, 2),
        },
    ),
    # Encodes count=3 (both the sampling default and the live-test pin); the
    # judge's track-count check is ">= count", so smaller injected counts
    # would still pass, larger ones need a new arm.
    "spotify.SearchBuildPlaylistAndPlay": [
        *search("{keyword}"),
        *add_search_track_to_new_playlist("{kw_track_1}", "{playlist}"),
        *resume_search("{keyword}"),
        *add_search_track_to_existing_playlist_visible("{kw_track_2}", "{playlist}", pre_scrolls=1),
        *refresh_search("{keyword}"),
        *add_search_track_to_existing_playlist_visible("{kw_track_3}", "{playlist}", pre_scrolls=1),
        *play_created_playlist("{playlist}"),
        trigger_visible("player.open", summary="open player"),
        action_visible("player.repeat.toggle", summary="enable repeat context"),
        complete(),
    ],
    "spotify.MoveArtistToNewPlaylist": [
        *open_source_playlist("{playlist}"),
        # Track 1 → create the new playlist (lands on the new playlist page).
        trigger_param("playlist.trackMenu.open", "{src_track_1}", summary="open first source artist track menu"),
        wait(0.5, summary="wait for playlist track menu"),
        trigger_param("playlist.addPlaylist.open", "{src_track_1}", summary="open add-to-playlist sheet"),
        *create_playlist_with_pending_track("{new_playlist}"),
        # Re-anchor on the source playlist before removing track 1 from it.
        *reanchor_source_playlist("{playlist}"),
        trigger_param("playlist.trackMenu.open", "{src_track_1}", summary="open first source artist track menu for removal"),
        wait(0.5, summary="wait for playlist track menu"),
        action_param("playlist.track.remove", "{src_track_1}", summary="remove first artist track from source playlist"),
        # Track 2 → add to the existing new playlist. Picking an existing row in
        # the sheet auto-closes the sheet + track menu, returning to the source
        # playlist page — so no back / re-anchor is needed before the removal.
        trigger_param("playlist.trackMenu.open", "{src_track_2}", summary="open second source artist track menu"),
        wait(0.5, summary="wait for playlist track menu"),
        trigger_param("playlist.addPlaylist.open", "{src_track_2}", summary="open add-to-playlist sheet"),
        playlist_row("{new_playlist}", summary="select new playlist for second artist track"),
        back(summary="dismiss lingering sheet backdrop (stays on source playlist)"),
        wait(0.5, summary="wait for source playlist to settle"),
        trigger_param("playlist.trackMenu.open", "{src_track_2}", summary="open second source artist track menu for removal"),
        wait(0.5, summary="wait for playlist track menu"),
        action_param("playlist.track.remove", "{src_track_2}", summary="remove second artist track from source playlist"),
        complete(),
    ],
    # count=2 is the live-test pin; sampling always takes the count=3 arm.
    "spotify.DiscoverSaveAndReport": Branch(
        pick=_count_pick,
        branches={
            "2": _discover_branch(2),
            "3": _discover_branch(3),
        },
    ),
    "spotify.CollectLikedRecentAndPlay": [
        *open_liked_songs(),
        # liked∩recent rows sit at data-fixed liked-list positions 1/3/6/8/9;
        # the pre_scrolls below encode that geometry (~5 rows per screen,
        # scroll position persists across menu/sheet round-trips).
        *add_liked_track_to_new_playlist("{liked_recent_1}", "{playlist}"),
        *return_to_liked_songs(),
        *add_liked_track_to_existing_playlist_visible("{liked_recent_2}", "{playlist}"),
        *add_liked_track_to_existing_playlist_visible("{liked_recent_3}", "{playlist}", pre_scrolls=1),
        *add_liked_track_to_existing_playlist_visible("{liked_recent_4}", "{playlist}", pre_scrolls=1),
        *add_liked_track_to_existing_playlist_visible("{liked_recent_5}", "{playlist}"),
        *play_created_playlist_from_liked("{playlist}"),
        complete(),
    ],
    # count=1 is the live-test pin; sampling always takes the count=2 arm.
    "spotify.BuildPlaylistFromTwoArtists": Branch(
        pick=_count_pick,
        branches={
            "1": _two_artists_branch(1),
            "2": _two_artists_branch(2),
        },
    ),
}
