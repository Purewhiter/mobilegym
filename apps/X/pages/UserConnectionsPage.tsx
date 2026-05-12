import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { currentUser } from '../data';
import { useXStore, selectEffectiveFollowedSet } from '../state';
import { useXAllUsers } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { XImage } from '../components/XMedia';
import { XUser } from '../types';

const meUserId: string = currentUser.id;

export const UserConnectionsPage: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const type = (searchParams.get('type') as 'following' | 'followers') || 'following';

  const users = useXAllUsers();
  const followedSet = useXStore(selectEffectiveFollowedSet);
  const toggleFollow = useXStore(s => s.toggleFollow);
  const { bindBack, bindTap, go } = useXGestures();
  const s = useXStrings();

  const user = id ? users[id] : null;
  const isFollowing = React.useCallback(
    (userId: string) => followedSet.has(userId),
    [followedSet],
  );

  const connections = React.useMemo(() => {
    if (!id) return [];

    const allUsers = Object.values(users) as XUser[];

    if (type === 'following') {
      if (id === meUserId) {
        return allUsers.filter(item => followedSet.has(item.id));
      }
      return allUsers.slice(0, 15);
    }

    if (id === meUserId) {
      return allUsers.slice(5, 20);
    }

    const simulated = allUsers.slice(10, 25);
    if (followedSet.has(id)) {
      const me = users[meUserId];
      if (me && !simulated.find(item => item.id === me.id)) {
        simulated.unshift(me);
      }
    } else {
      const index = simulated.findIndex(item => item.id === meUserId);
      if (index !== -1) simulated.splice(index, 1);
    }
    return simulated;
  }, [id, followedSet, type, users]);

  if (!user) return null;

  return (
    <div className="flex flex-col bg-app-bg min-h-full text-app-text pb-20 pt-10">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-app-border">
        <div className="w-8 h-8 flex items-center justify-center cursor-pointer" {...bindBack()}>
          ←
        </div>
        <div>
          <div className="font-bold text-lg">{user.name}</div>
          <div className="text-gray-500 text-xs">{`@${user.id}`}</div>
        </div>
      </div>

      <div className="flex border-b border-app-border">
        <div className={`flex-1 text-center py-3 cursor-pointer relative ${type === 'following' ? 'font-bold text-app-text' : 'text-gray-500'}`} onClick={() => go('connections.tab.toFollowing', { id: id! })}>
          {s.connections_tab_following}
          {type === 'following' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full mx-10" />}
        </div>
        <div className={`flex-1 text-center py-3 cursor-pointer relative ${type === 'followers' ? 'font-bold text-app-text' : 'text-gray-500'}`} onClick={() => go('connections.tab.toFollowers', { id: id! })}>
          {s.connections_tab_followers}
          {type === 'followers' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full mx-10" />}
        </div>
      </div>

      <div className="flex-1">
        {connections.map(connection => {
          const isMe = connection.id === meUserId;
          const amIFollowing = isFollowing(connection.id);

          return (
            <div key={connection.id} className="flex items-center p-4 border-b border-app-border">
              <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden cursor-pointer" {...bindTap('user.open.fromPost', { params: { id: connection.id }, stopPropagation: true })}>
                {connection.avatar ? (
                  <XImage src={connection.avatar} alt={connection.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-pink-600 flex items-center justify-center text-white font-bold">
                    {connection.name[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" {...bindTap('user.open.fromPost', { params: { id: connection.id } })}>
                <div className="font-bold truncate">{connection.name}</div>
                <div className="text-gray-500 text-sm truncate">{`@${connection.id}`}</div>
                {connection.bio && <div className="text-gray-400 text-sm truncate">{connection.bio}</div>}
              </div>
              {!isMe && (
                <button
                  type="button"
                  className={`ml-2 rounded-full px-4 py-1.5 font-bold text-sm ${amIFollowing ? 'bg-app-bg border border-app-border text-app-text' : 'bg-app-text text-app-bg'}`}
                  onClick={(event: React.MouseEvent) => {
                    event.stopPropagation();
                    toggleFollow(connection.id);
                  }}
                >
                  {amIFollowing ? s.connections_following_button : s.connections_follow_button}
                </button>
              )}
            </div>
          );
        })}
        {connections.length === 0 && <div className="p-8 text-center text-gray-500">{s.connections_empty}</div>}
      </div>
    </div>
  );
};
