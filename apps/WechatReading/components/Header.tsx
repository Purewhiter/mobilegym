import React from 'react';
import { IcSearch } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';

const Header: React.FC = () => {
  const { bindTap } = useWechatReadingGestures();
  const s = useWechatReadingStrings();

  return (
    <div className="pt-10 pb-2 px-4 bg-(--app-c-tw-bg-slate-100) sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-10 bg-(--app-c-tw-bg-gray-100) rounded-full flex items-center px-4 gap-2 active:opacity-70"
          style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
          {...bindTap('search.open')}
        >
          <IcSearch size={dimens.header_search_icon_size} className="text-(--app-c-tw-text-gray-400)" />
          <div className="flex-1 text-(--app-settings-item-text-size) text-(--app-c-tw-text-gray-400) truncate">
            {s.search_placeholder_default}
          </div>
          <div className="w-(--app-comp-header-width-1) h-4 bg-(--app-c-tw-bg-gray-300) mx-2" />
          <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-gray-600) font-medium whitespace-nowrap px-1">
            {s.header_bookstore}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Header;

