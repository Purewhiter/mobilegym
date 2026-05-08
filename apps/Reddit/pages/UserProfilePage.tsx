import React from 'react';
import { useLocation } from 'react-router-dom';
import { IcArrowBack, IcSearch, IcShare, IcMore, IcNavForward, IcFilter, IcEye, IcSend } from '../res/icons';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { getUserAvatar } from '../utils/userIdentity';

const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Reddit/${s}`; };

type ProfileTabKey = 'posts' | 'comments' | 'about';

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const formatCompactInt = (n: number): string => {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\\.0$/, '')}k`;
  return `${Math.round(n / 1000)}k`;
};

function getUsernameFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/user\/([^/?#]+)/);
  if (!m) return null;
  const u = decodeURIComponent(m[1]);
  return u ? u : null;
}

export const UserProfilePage: React.FC = () => {
  const location = useLocation();
  const { bindTap, bindBack } = useRedditGestures();

  const profileUsername = getUsernameFromPath(location.pathname) ?? 'unknown';
  const sp = new URLSearchParams(location.search);
  const tabRaw = sp.get('tab') as ProfileTabKey | null;
  const tab: ProfileTabKey = tabRaw === 'comments' || tabRaw === 'about' ? tabRaw : 'posts';

  const karma = 1 + (hashString(profileUsername) % 9999);
  const postKarma = Math.max(1, karma % 10);
  const commentKarma = 0;
  const activeIn = 1 + (hashString(`active:${profileUsername}`) % 9);
  const accountAge = `${10 + (hashString(`age:${profileUsername}`) % 50)}d`;
  const achievements = 5;

  const avatar = getUserAvatar(profileUsername);

  return (
    <div className="flex flex-col h-full bg-app-surface">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-10 pb-3 bg-[#0B2D5C]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Back"
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10"
            {...bindBack()}
          >
            <IcArrowBack className="w-6 h-6 text-white" strokeWidth={2} />
          </button>
          <div className="text-[16px] font-semibold text-white truncate">{profileUsername}</div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Search"
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10"
          >
            <IcSearch className="w-5 h-5 text-white" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Share"
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10"
          >
            <IcShare className="w-5 h-5 text-white" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="More"
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10"
          >
            <IcMore className="w-5 h-5 text-white" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar bg-app-surface" data-scroll-container="main" data-scroll-direction="vertical">
        {/* 上半屏：深蓝背景 */}
        <div className="bg-gradient-to-b from-[#0B2D5C] via-[#08346B] to-[#061A36] px-5 pt-4 pb-5">
          <div className="flex flex-col items-start min-w-0">
            <div className="w-(--app-profile-avatar-size) h-(--app-profile-avatar-size) rounded-full bg-white/10 p-(--app-profile-avatar-ring)">
              <div className="w-full h-full rounded-full bg-[#2EE6A5] overflow-hidden">
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : null}
              </div>
            </div>

            <div className="mt-4 min-w-0">
              <div className="flex items-baseline gap-3 min-w-0">
                <div className="text-(--app-profile-username-size) font-black text-white truncate">{profileUsername}</div>
              </div>
              <div className="mt-1 text-[13px] text-white/70">{`u/${profileUsername}`} • 0 followers</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[14px] text-white/85">
            <button type="button" className="flex items-center gap-2 active:opacity-90">
              <span className="font-semibold">Add social link</span>
              <IcNavForward className="w-4 h-4 text-white/70" />
            </button>

            <button type="button" className="flex items-center gap-2 active:opacity-90">
              <div className="flex -space-x-1">
                <div className="w-5 h-5 rounded-full bg-[#2EE6A5] border border-white/30" />
                <div className="w-5 h-5 rounded-full bg-[#FFD24A] border border-white/30" />
                <div className="w-5 h-5 rounded-full bg-app-primary border border-white/30" />
              </div>
              <span className="font-semibold">{achievements} achievements</span>
              <IcNavForward className="w-4 h-4 text-white/70" />
            </button>
          </div>

          <div className="mt-4 h-px bg-white/15" />

          <div className="mt-4 grid grid-cols-4 divide-x divide-white/15">
            {[
              { label: 'Karma', value: formatCompactInt(karma) },
              { label: 'Contributions', value: '0' },
              { label: 'Account Age', value: accountAge },
              { label: 'Active In', value: String(activeIn) },
            ].map((item) => (
              <div key={item.label} className="px-2 text-center">
                <div className="text-[18px] font-black text-white leading-none">{item.value}</div>
                <div className="mt-1 text-[12px] text-white/70">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 下半屏：白底（Tabs + 内容） */}
        <div className="bg-app-surface">
          <div className="px-4 border-b border-app-border">
            <div className="flex items-end gap-10">
              {(
                [
                  { key: 'posts' as const, label: 'Posts' },
                  { key: 'comments' as const, label: 'Comments' },
                  { key: 'about' as const, label: 'About' },
                ] as const
              ).map((t) => {
                const active = tab === t.key;
                return (
                  <div
                    key={t.key}
                    className="flex flex-col items-center cursor-pointer select-none"
                    {...bindTap('profile.user.tab.switch', { params: { username: profileUsername, tab: t.key } })}
                  >
                    <div className={`py-3 text-[15px] font-bold ${active ? 'text-black' : 'text-gray-400'}`}>
                      {t.label}
                    </div>
                    {active && <div className="w-[60px] h-0.5 bg-black rounded-full" />}
                  </div>
                );
              })}
            </div>
          </div>

          {tab === 'posts' && (
            <div className="px-4 py-10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="h-10 px-4 rounded-full border border-app-border bg-app-surface text-[14px] font-semibold text-gray-700 active:bg-gray-50 flex items-center gap-2"
                >
                  <IcFilter className="w-4 h-4" strokeWidth={2} />
                  Feed Options
                </button>
              </div>

              <div className="mt-4 border border-app-border rounded-2xl bg-app-surface overflow-hidden">
                <button type="button" className="w-full px-4 py-4 flex items-center justify-between active:bg-gray-50">
                  <div className="flex items-center gap-3 text-[14px] text-gray-700">
                    <IcEye className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
                    <span className="font-semibold">Showing all posts</span>
                  </div>
                  <IcNavForward className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="mt-10 relative flex flex-col items-center text-center">
                <button
                  type="button"
                  aria-label="Quick action"
                  className="absolute right-0 top-2 w-12 h-12 rounded-full bg-gray-200/80 flex items-center justify-center text-app-text-muted active:bg-gray-200"
                >
                  <IcSend className="w-6 h-6 -rotate-[12deg]" strokeWidth={2} />
                </button>

                <div className="w-[210px] h-[150px] flex items-center justify-center overflow-hidden">
                  <img
                    src={asset('others/profile_posts_empty.png')}
                    alt=""
                    className="w-full h-full object-contain"
                    draggable={false}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = asset('others/u_wherewindsmeet.png');
                    }}
                  />
                </div>

                <div className="mt-8 text-[30px] font-black text-app-text leading-tight">
                  You don&apos;t have any posts yet
                </div>
                <div className="mt-3 text-[15px] text-app-text-muted leading-relaxed max-w-[320px]">
                  Once you post to a community, it&apos;ll show up here. If you&apos;d rather hide your posts, update your
                  settings.
                </div>

                <button
                  type="button"
                  className="mt-8 h-12 px-10 rounded-full bg-[#0045AC] text-white font-black text-[16px] shadow-sm active:opacity-95"
                >
                  Update Settings
                </button>
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <div className="px-4 py-16 text-center">
              <div className="text-[22px] font-black text-app-text">No comments yet</div>
              <div className="mt-2 text-[14px] text-app-text-muted">User comments are not available in this demo.</div>
            </div>
          )}

          {tab === 'about' && (
            <div className="bg-app-surface">
              <div className="px-5 py-6">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="text-(--app-profile-username-size) font-black text-app-text leading-none">{formatCompactInt(postKarma)}</div>
                    <div className="mt-2 text-[14px] text-app-text-muted">Post Karma</div>
                  </div>
                  <div>
                    <div className="text-(--app-profile-username-size) font-black text-app-text leading-none">{formatCompactInt(commentKarma)}</div>
                    <div className="mt-2 text-[14px] text-app-text-muted">Comment Karma</div>
                  </div>
                </div>
              </div>

              <div className="h-3 bg-gray-100" />
              <div className="px-5 py-4 bg-gray-100">
                <div className="text-[13px] font-black tracking-wider text-app-text-muted">TROPHIES</div>
              </div>
              <div className="h-[420px] bg-app-surface" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
