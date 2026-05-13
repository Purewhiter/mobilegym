import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack } from '../res/icons';
const ChevronLeft = IcNavBack;
import { useRedBookStore } from '../state';
import { useRedBookView } from '../data/view';
import { useShallow } from 'zustand/react/shallow';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
export const FollowListPage: React.FC = () => {
  const s = useRedBookStrings();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type'); // 0 = fans, 1 = following
  const title = type === '1' ? s.following : s.followers;
  const { user, followUser } = useRedBookStore(useShallow(s => ({ user: s.user, followUser: s.followUser })));
  const view = useRedBookView();
  const { bindTap, bindBack } = useRedBookGestures();

  // Filter users based on type
  const userList = useMemo(() => {
      const users = view.userIds.map(id => view.usersById[id]).filter(Boolean);
      if (type === '1') {
          const set = new Set(user.followingIds || []);
          return users.filter(u => set.has(u.id));
      } else {
          // Followers
          const set = new Set(user.followerIds || []);
          return users.filter(u => set.has(u.id));
      }
  }, [type, view.usersById, view.userIds, user.followingIds, user.followerIds]);

  return (
    <div className="h-full flex flex-col bg-app-surface">
      {/* Header */}
      <div className="pt-10 px-4 pb-3 flex items-center border-b border-gray-100 sticky top-0 bg-app-surface z-10">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{title}</span>
        </div>
      </div>

      {/* List */}
      <div
        className="flex-1 overflow-y-auto"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
          {userList.length > 0 ? (
              userList.map((item) => (
                  (() => {
                    const isFollowing = (user.followingIds || []).includes(item.id);
                    return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-4 py-3 active:bg-gray-50 cursor-pointer"
                    {...bindTap('user.open', { params: { userId: item.id } })}
                  >
                      <div className="flex items-center gap-3 flex-1 overflow-hidden">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                              {item.avatar ? (
                                  <img src={item.avatar} className="w-full h-full object-cover" />
                              ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-500 text-xs">User</div>
                              )}
                          </div>
                          <div className="flex flex-col min-w-0">
                              <span className="text-[15px] text-app-text font-medium truncate">{item.name}</span>
                              <span className="text-[12px] text-app-text-muted truncate">{item.intro || s.no_bio}</span>
                          </div>
                      </div>

                      <button
                        className={`ml-3 px-4 py-1.5 rounded-full text-[12px] font-medium border ${
                            isFollowing
                            ? 'border-[#ccc] text-app-text-muted bg-transparent'
                            : 'bg-app-primary text-white border-transparent'
                        }`}
                        onClick={(e) => {
                            e.stopPropagation();
                            followUser(item.id);
                        }}
                      >
                          {isFollowing ? s.following_2 : s.following}
                      </button>
                  </div>
                    );
                  })()
              ))
          ) : (
             <div className="flex flex-col items-center justify-center pt-20 text-app-text-muted">
                 <span>{s.none}{title}</span>
             </div>
          )}
      </div>
    </div>
  );
};
