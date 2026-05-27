/**
 * MediaSessionService — OS-level "now playing" state, modeled after Android's
 * `MediaSession` / `MediaSessionManager` so widgets/lockscreen/notification
 * media controls don't have to know which music app is the source.
 *
 * Real Android flow
 * -----------------
 * 1. A media app (Spotify, Apple Music, ...) creates a `MediaSession` and
 *    calls `setMetadata()` / `setPlaybackState()` as playback changes.
 * 2. System surfaces (lockscreen, notification controls, MAML music widget)
 *    enumerate sessions via `MediaSessionManager.getActiveSessions()` and
 *    pick the most recently active one.
 * 3. Surfaces read metadata via `MediaController` and never import code from
 *    the source app.
 *
 * mobile-gym mirror
 * -----------------
 * - {@link MediaSessionService.setActiveSession} — publisher API; the source
 *   app calls this on play-state / track changes.
 * - {@link MediaSessionService.getActiveSession} — consumer API; the music
 *   ambient adapter in `os/providers/SystemWidgetProvider.ts` reads here.
 * - Multi-session support: simplified to a single "active" session pointer.
 *   Last publisher wins. Add a session stack only if a future scenario needs
 *   independent sessions from multiple apps simultaneously.
 *
 * State is volatile (no persistence). Sessions die with the page refresh.
 */
import BroadcastBus from './BroadcastBus';
import { createVolatileOsStore } from './createOsStore';

export const ACTION_MEDIA_SESSION_CHANGED = 'com.miui.os.MEDIA_SESSION_CHANGED';

export interface ActiveMediaSession {
  /** Display title of the current track. */
  title: string;
  /** Artist/creator string. */
  artist: string;
  /** Track duration in ms (0 if unknown). */
  durationMs: number;
  /** Current playback position in ms (0 if unknown / not tracked). */
  positionMs: number;
  /** True iff playback is currently advancing. */
  isPlaying: boolean;
  /**
   * Source app's package name. The MAML music widget reads this to attribute
   * playback (`music_control.package`). Required because widgets must show
   * the icon of the controlling app.
   */
  packageName: string;
  /** Source app's launcher activity / class name. */
  activityClass: string;
}

interface MediaSessionState {
  active: ActiveMediaSession | null;
}

const store = createVolatileOsStore<MediaSessionState>(
  'media_session',
  { active: null },
  { registerToServiceRegistry: true },
);

function emit(): void {
  BroadcastBus.sendBroadcast({ action: ACTION_MEDIA_SESSION_CHANGED });
}

export const MediaSessionService = {
  /**
   * Publish or update the active session. Pass `null` to clear (e.g. when
   * the user stops playback and exits the source app).
   *
   * Callers (publishers): typically the source music app's state module,
   * subscribed to its own store so any track/play-state change forwards
   * here. See `apps/Spotify/state.ts` for an example.
   */
  setActiveSession(session: ActiveMediaSession | null): void {
    const prev = store.getState().active;
    if (prev === session) return;
    if (prev && session && areSessionsEqual(prev, session)) return;
    store.setState({ active: session });
    emit();
  },

  /**
   * Read the current active session, or `null` if no app is publishing.
   * Used by the WMR music ambient adapter and any other consumer that needs
   * "what's playing right now".
   */
  getActiveSession(): ActiveMediaSession | null {
    return store.getState().active;
  },

  /** Convenience: clear the active session. */
  clearActiveSession(): void {
    MediaSessionService.setActiveSession(null);
  },
};

function areSessionsEqual(a: ActiveMediaSession, b: ActiveMediaSession): boolean {
  return (
    a.title === b.title &&
    a.artist === b.artist &&
    a.durationMs === b.durationMs &&
    a.positionMs === b.positionMs &&
    a.isPlaying === b.isPlaying &&
    a.packageName === b.packageName &&
    a.activityClass === b.activityClass
  );
}

export default MediaSessionService;
