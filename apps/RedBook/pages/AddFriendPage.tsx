import React from 'react';
import { useRedBookStrings } from '../hooks/useRedBookStrings';
import { useRedBookStore } from '../state';
import { IcNavBack, IcInfo, IcSettings, IcScan, IcClipboard, IcMessageCircle, IcNavForward } from '../res/icons';
import { useRedBookGestures } from '../hooks/useRedBookGestures';

const ChevronLeft = IcNavBack;
const Info = IcInfo;
const Settings = IcSettings;
const ScanLine = IcScan;
const Clipboard = IcClipboard;
const WechatIcon = IcMessageCircle;
const QQIcon = IcMessageCircle;
const ChevronRight = IcNavForward;

export const AddFriendPage: React.FC = () => {
  const s = useRedBookStrings();
  const currentUser = useRedBookStore(state => state.user);
  const { bindBack, bindTap } = useRedBookGestures();

  const redBookId = currentUser.id.replace('user_', '');

  return (
    <div className="h-full w-full flex flex-col bg-white text-gray-900" data-status-bar-foreground="light">
      {/* 顶部导航栏 */}
      <div className="pt-10 px-4 pb-3 flex items-center justify-between">
        <button className="active:opacity-60" {...bindBack()}>
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base font-medium">添加好友</span>
          <Info size={16} className="text-gray-400" />
        </div>
        <button className="active:opacity-70" {...bindTap('settings.open.fromAddFriend')}>
          <Settings size={20} className="text-gray-700" />
        </button>
      </div>

      {/* 内容区域 */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-8 bg-[#f7f7f7]"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* 中央二维码区域 */}
        <div className="mt-4 flex flex-col items-center">
          <div className="relative w-60 h-60 bg-white rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.06)] border border-gray-200 overflow-hidden">
            <div className="absolute inset-4">
              {/* 四角定位块 */}
              <div className="absolute left-0 top-0 w-11 h-11 flex items-center justify-center">
                <div className="w-9 h-9 rounded-2xl bg-black flex items-center justify-center">
                  <div className="w-5 h-5 rounded-xl bg-white" />
                </div>
              </div>
              <div className="absolute right-0 top-0 w-11 h-11 flex items-center justify-center">
                <div className="w-9 h-9 rounded-2xl bg-black flex items-center justify-center">
                  <div className="w-5 h-5 rounded-xl bg-white" />
                </div>
              </div>
              <div className="absolute left-0 bottom-0 w-11 h-11 flex items-center justify-center">
                <div className="w-9 h-9 rounded-2xl bg-black flex items-center justify-center">
                  <div className="w-5 h-5 rounded-xl bg-white" />
                </div>
              </div>
              <div className="absolute right-0 bottom-0 w-11 h-11 flex items-center justify-center">
                <div className="w-9 h-9 rounded-2xl bg-black flex items-center justify-center">
                  <div className="w-5 h-5 rounded-xl bg-white" />
                </div>
              </div>

              {/* 点阵背景 */}
              <div className="absolute inset-3 grid grid-cols-10 grid-rows-10">
                {Array.from({ length: 100 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1 h-1 rounded-full bg-black ${idx % 3 === 0 ? 'opacity-80' : 'opacity-0'}`}
                  />
                ))}
              </div>

              {/* 中心头像 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-18 h-18 rounded-full bg-white flex items-center justify-center shadow-md">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 用户名与小红书号 */}
          <div className="mt-4 text-center">
            <div className="text-[15px] font-medium text-gray-900">{currentUser.name}</div>
            <div className="mt-1 text-[12px] text-gray-500">小红书号：{redBookId}</div>
          </div>

          <div className="mt-3 text-[12px] text-gray-400">
            扫一扫上方二维码，添加我为小红书好友
          </div>
        </div>

        {/* 下方分享入口：扁平列表样式 */}
        <div className="mt-10 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {/* 扫一扫 */}
            <div className="flex items-center px-4 py-4">
              <ScanLine size={20} className="text-gray-600 mr-4" />
              <span className="flex-1 text-[14px] text-gray-900">扫一扫</span>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
            {/* 通讯录 */}
            <div className="flex items-center px-4 py-4">
              <Clipboard size={20} className="text-gray-600 mr-4" />
              <span className="flex-1 text-[14px] text-gray-900">通讯录</span>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
            {/* 微信好友 */}
            <div className="flex items-center px-4 py-4">
              <WechatIcon size={20} className="text-gray-600 mr-4" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-[14px] text-gray-900">微信好友</span>
                <span className="text-[12px] text-gray-400 mr-1">分享个人名片到微信</span>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
            {/* QQ 好友 */}
            <div className="flex items-center px-4 py-4">
              <QQIcon size={20} className="text-gray-600 mr-4" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-[14px] text-gray-900">QQ好友</span>
                <span className="text-[12px] text-gray-400 mr-1">分享个人名片到 QQ</span>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};