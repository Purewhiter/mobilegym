import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { currentUser } from '../data';
import { useXStore, selectEffectiveFollowedSet } from '../state';
import { useXConnections, useXUser } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { XImage } from '../components/XMedia';
import { routes } from '../routes';

const meUserId: string = currentUser.id;

export const UserConnectionsPage: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const type = (searchParams.get('type') as 'following' | 'followers') || 'following';

  const followedSet = useXStore(selectEffectiveFollowedSet);
  const toggleFollow = useXStore(s => s.toggleFollow);
  const { bindBack, bindNav, nav } = useXGestures();
  const s = useXStrings();

  const user = useXUser(id || '') ?? null;
  const isFollowing = React.useCallback(
    (userId: string) => followedSet.has(userId),
    [followedSet],
  );

  const connections = useXConnections(id || '', type);

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
        <div className={`flex-1 text-center py-3 cursor-pointer relative ${type === 'following' ? 'font-bold text-app-text' : 'text-gray-500'}`} onClick={() => nav.replace(routes.connections, { id: id! }, { search: { type: 'following' } })}>
          {s.connections_tab_following}
          {type === 'following' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full mx-10" />}
        </div>
        <div className={`flex-1 text-center py-3 cursor-pointer relative ${type === 'followers' ? 'font-bold text-app-text' : 'text-gray-500'}`} onClick={() => nav.replace(routes.connections, { id: id! }, { search: { type: 'followers' } })}>
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
              <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden cursor-pointer" {...bindNav(routes.user, { params: { id: connection.id }, stopPropagation: true })}>
                {connection.avatar ? (
                  <XImage src={connection.avatar} alt={connection.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-pink-600 flex items-center justify-center text-white font-bold">
                    {connection.name[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" {...bindNav(routes.user, { params: { id: connection.id } })}>
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
