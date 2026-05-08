import React, { useState, useEffect } from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { createPortal } from 'react-dom';
import { useNavigationType } from 'react-router-dom';
import { IcUser } from '../../res/icons';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStore } from '../../state';
import { WechatSmartImage } from '../../components/WechatSmartImage';

export const NearbyPeople: React.FC = () => {
  const t = useWechatStrings();
  const navigationType = useNavigationType();
  const shouldShowLoading = navigationType === 'PUSH';
  const [loading, setLoading] = useState(shouldShowLoading);
  const { bindTap } = useWechatGestures();
  const nearbyUsers = useWechatStore(s => s.nearbyPeople) || []; // 从全局数据获取

  useEffect(() => {
    if (!shouldShowLoading) {
      setLoading(false);
      return;
    }
    // 模拟加载延迟
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [shouldShowLoading]);



  return (
    <div className="relative min-h-full bg-app-surface">
      {/* 列表内容 */}
      {!loading && (
        <div className="pb-8">
          {nearbyUsers.map((user) => {
            const isMale = user.gender === t.common_male;
            return (
              <div
                key={user.wxid}
                className="flex items-start px-4 py-3 border-b border-(--app-c-tw-border-gray-100) active:bg-(--app-c-tw-bg-gray-50)"
                {...bindTap<HTMLDivElement>('nearbyPeople.user.profile', { params: { id: user.wxid } })}
              >
                {/* 头像 */}
                <div className="w-(--app-chat-list-item-avatar-size) h-(--app-chat-list-item-avatar-size) rounded-[6px] overflow-hidden flex-shrink-0 mr-3">
                  <WechatSmartImage src={user.avatar} className="w-full h-full object-cover" alt={user.name} />
                </div>

                {/* 中间信息 */}
                <div className="flex-1 min-w-0 mt-0.5">
                  <div className="flex items-center mb-1">
                    <span className="text-(--app-chat-bubble-text-size) font-medium text-app-text truncate max-w-(--app-card-width-180) mr-1">
                      {user.name}
                    </span>
                    {/* 性别图标 */}
                    <div className={`${isMale ? 'text-(--app-c-common-link-blue)' : 'text-(--app-c-common-link-pink)'}`}>
                      <IcUser size={dimens.icSizeTiny} fill="currentColor" strokeWidth={0} />
                    </div>
                  </div>
                  <div className="text-(--app-chat-system-msg-text-size) text-(--app-c-common-text-hint)">{user.distance}</div>
                </div>

                {/* 右侧签名 */}
                {user.signature && (
                  <div className="ml-2 max-w-(--app-discover-nearby-people-width-120) bg-(--app-c-search-bar-bg) px-2 py-1.5 rounded-[4px] relative mt-1">
                    {/* 小三角 */}
                    <div className="absolute left-[-5px] top-[10px] w-0 h-0 border-t-[5px] border-t-transparent border-r-[6px] border-r-(--app-c-discover-nearby-people-border-right-f0f0) border-b-[5px] border-b-transparent"></div>
                    <div className="text-(--app-chat-time-label-text-size) text-app-text-muted leading-tight line-clamp-2">
                      {user.signature}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 加载弹窗蒙层 - 使用 Portal 确保全屏显示，z-index 低于手势条(3300) */}
      {loading && createPortal(
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/40">
           {/* 加载框 */}
           <div className="w-(--app-modal-width-160) h-(--app-modal-height-160) bg-(--app-c-overlay-dark-item-hover) rounded-[12px] flex flex-col items-center justify-center">
             {/* 旋转的 Loading 图标 */}
             <svg className="w-10 h-10 mb-4" viewBox="0 0 50 50">
               <circle cx="25" cy="25" r="20" stroke="#888" strokeWidth="4" fill="none" opacity="0.5" />
               <g>
                 <path
                   d="M25 5 A20 20 0 0 1 45 25"
                   stroke="#ffffff"
                   strokeWidth="4"
                   fill="none"
                   strokeLinecap="round"
                 />
                 <animateTransform
                   attributeName="transform"
                   type="rotate"
                   from="0 25 25"
                   to="360 25 25"
                   dur="1s"
                   repeatCount="indefinite"
                 />
               </g>
             </svg>
             <div className="text-white text-(--app-search-filter-text-size) text-center">正在查找<br/>{t.discover_nearby}</div>
           </div>
        </div>,
        document.body
      )}
    </div>
  );
};
