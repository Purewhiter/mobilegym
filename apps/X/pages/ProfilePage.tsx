import React from 'react';
import { IcBalloon, IcCalendar, IcLocation, IcRepost } from '../res/icons';
import { useXStore, selectUser } from '../state';
import { useXUserProfilePosts } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { XImage } from '../components/XMedia';
import { BookmarkToast } from '../components/BookmarkToast';
import { XRetweetSheet } from '../components/XRetweetSheet';
import { XTimelinePostCard } from '../components/XTimelinePostCard';

export const ProfilePage: React.FC = () => {
  const user = useXStore(selectUser);
  const myPosts = useXUserProfilePosts(user.id, 80);
  const toggleRetweet = useXStore(s => s.toggleRetweet);
  const { bindBack, go } = useXGestures();
  const s = useXStrings();
  const [retweetMenuPostId, setRetweetMenuPostId] = React.useState<string | null>(null);
  const [showBookmarkToast, setShowBookmarkToast] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'posts' | 'replies' | 'subs' | 'videos' | 'photos' | 'articles'>('posts');

  const tabs = [
    { id: 'posts', label: s.profile_tab_posts },
    { id: 'replies', label: s.profile_tab_replies },
    { id: 'subs', label: s.profile_tab_subs },
    { id: 'videos', label: s.profile_tab_videos },
    { id: 'photos', label: s.profile_tab_photos },
    { id: 'articles', label: s.profile_tab_articles },
  ] as const;

  return (
    <div className="flex flex-col bg-app-bg min-h-full text-app-text pb-20 pt-10">
      <div className="h-32 bg-gray-200 relative">
        {user.banner ? <XImage src={user.banner} alt="Banner" className="w-full h-full object-cover" /> : null}
        <div className="absolute top-4 left-4 w-8 h-8 bg-white/70 rounded-full flex items-center justify-center cursor-pointer" {...bindBack()}>
          ←
        </div>
      </div>

      <div className="px-4 relative mb-4">
        <div className="w-20 h-20 rounded-full bg-app-bg absolute -top-10 border-4 border-app-bg overflow-hidden">
          {user.avatar ? (
            <XImage src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-pink-600 flex items-center justify-center text-white font-bold text-2xl">
              {user.name[0]}
            </div>
          )}
        </div>
        <div className="flex justify-end pt-3">
          <button className="bg-app-bg border border-app-border rounded-full px-4 py-1.5 font-bold text-sm text-app-text">
            {s.profile_edit_button}
          </button>
        </div>

        <div className="mt-3">
          <div className="font-bold text-xl flex items-center gap-1">
            {user.name}
            {user.verified && <span className="text-blue-400">✓</span>}
          </div>
          <div className="text-gray-500 text-sm">{`@${user.id}`}</div>
        </div>

        {user.bio ? <div className="mt-3 text-sm whitespace-pre-wrap">{user.bio}</div> : null}

        <div className="mt-3 flex items-center gap-4 text-gray-500 text-sm flex-wrap">
          {user.location && (
            <span className="flex items-center gap-1">
              <IcLocation size={15} />
              {user.location}
            </span>
          )}
          {user.birthDate && (
            <span className="flex items-center gap-1">
              <IcBalloon size={15} />
              {user.birthDate}
            </span>
          )}
          {user.joinDate && (
            <span className="flex items-center gap-1">
              <IcCalendar size={15} />
              {user.joinDate}
            </span>
          )}
        </div>

        <div className="mt-3 flex gap-4 text-sm">
          <div className="cursor-pointer active:opacity-50" onClick={() => go('connections.open', { id: user.id, type: 'following' })}>
            <span className="font-bold text-app-text">{user.following}</span> <span className="text-gray-500">{s.profile_following_label}</span>
          </div>
          <div className="cursor-pointer active:opacity-50" onClick={() => go('connections.open', { id: user.id, type: 'followers' })}>
            <span className="font-bold text-app-text">{user.followers}</span> <span className="text-gray-500">{s.profile_followers_label}</span>
          </div>
        </div>
      </div>

      <div className="flex border-b border-app-border mt-2 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`flex-none px-4 py-3 text-center cursor-pointer relative ${activeTab === tab.id ? 'font-bold text-app-text' : 'text-gray-500'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full mx-2" />}
          </div>
        ))}
      </div>

      <div>
        {activeTab === 'subs' ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="font-bold text-xl mb-2">{s.profile_subs_unlock_title}</div>
            <div className="text-gray-500 mb-6 text-sm">{s.profile_subs_unlock_desc}</div>
            <button className="bg-app-text text-app-bg px-8 py-2.5 rounded-full font-bold text-sm">{s.profile_subs_unlock_button}</button>
          </div>
        ) : activeTab === 'articles' ? (
          <div className="p-10 text-center text-gray-500">
            <div className="font-bold text-lg text-app-text mb-2">{s.profile_articles_empty_title}</div>
            <div className="text-sm">{s.profile_articles_empty_desc}</div>
          </div>
        ) : (
          (() => {
            let displayPosts = myPosts;
            if (activeTab === 'videos') {
              displayPosts = myPosts.filter(post => (post.retweetedPost ?? post).video);
            } else if (activeTab === 'photos') {
              displayPosts = myPosts.filter(post => {
                const mediaPost = post.retweetedPost ?? post;
                return mediaPost.image && !mediaPost.video;
              });
            }

            if (displayPosts.length === 0) {
              const emptyTitle = activeTab === 'videos'
                ? s.profile_videos_empty
                : activeTab === 'photos'
                  ? s.profile_photos_empty
                  : activeTab === 'replies'
                    ? s.profile_replies_empty
                    : s.profile_content_empty;

              return (
                <div className="p-10 text-center text-gray-500">
                  <div className="font-bold text-lg text-app-text mb-2">{emptyTitle}</div>
                  <div className="text-sm">{s.profile_content_empty_desc}</div>
                </div>
              );
            }

            return displayPosts.map(post => {
              const sourcePost = post.retweetedPost ?? post;
              return (
                <XTimelinePostCard
                  key={post.id}
                  post={sourcePost}
                  topContent={
                    post.retweetedPost ? (
                      <div className="ml-[52px] mb-2 flex items-center gap-1 text-sm text-green-500">
                        <IcRepost size={14} />
                        <span>{s.common_you_reposted}</span>
                      </div>
                    ) : null
                  }
                  actionIds={{
                    retweet: 'profile.post.retweet',
                    like: 'profile.post.like',
                    bookmark: 'profile.post.bookmark',
                    share: 'profile.post.share',
                  }}
                  onRetweetTrigger={setRetweetMenuPostId}
                  onBookmarkAdded={() => setShowBookmarkToast(true)}
                />
              );
            });
          })()
        )}
      </div>

      <XRetweetSheet
        postId={retweetMenuPostId}
        onClose={() => setRetweetMenuPostId(null)}
        onRetweet={toggleRetweet}
        onQuote={(postId) => {
          go('compose.open', { quotedPostId: postId });
        }}
        onViewActivity={(postId) => go('status.activity.open', { id: postId })}
      />

      <BookmarkToast visible={showBookmarkToast} onClose={() => setShowBookmarkToast(false)} />
    </div>
  );
};
