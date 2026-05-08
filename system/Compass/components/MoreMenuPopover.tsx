import React from 'react';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

/** 真机内层容器 (list/spring_back) 在 360 视口下的位置与尺寸，来自 compare_layouts diff_report */
const POPOVER_LEFT = 149;
const POPOVER_TOP = 87;
const POPOVER_WIDTH = 195;
const POPOVER_HEIGHT = 109;

export function MoreMenuPopover(props: {
  privacyProps: React.HTMLAttributes<HTMLButtonElement>;
  permissionsProps: React.HTMLAttributes<HTMLButtonElement>;
  onBackdropClick: () => void;
}) {
  const { privacyProps, permissionsProps, onBackdropClick } = props;
  const s = useAppStrings(strings, stringsEn);

  return (
    <div className="absolute inset-0 z-50">
      <button
        type="button"
        aria-label={s.menu_close}
        className="absolute inset-0 bg-transparent"
        onClick={onBackdropClick}
      />

      <div
        className="absolute bg-white overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
        style={{
          left: POPOVER_LEFT,
          top: POPOVER_TOP,
          width: POPOVER_WIDTH,
          height: POPOVER_HEIGHT,
          borderRadius: 18,
        }}
      >
        {/* 真机 trace: 行内文字 padding 左/右 19.6dp，第一行 pt 17.4 / pb 11.4，第二行 pt 11.4 / pb 17.4，文字高 26dp */}
        <button
          type="button"
          className="w-full text-left text-gray-900 active:bg-gray-100 px-5 text-[19px] leading-[26px]"
          style={{ height: POPOVER_HEIGHT / 2, paddingTop: 17, paddingBottom: 11 }}
          {...privacyProps}
        >
          {s.menu_view_privacy_policy}
        </button>
        <button
          type="button"
          className="w-full text-left text-gray-900 active:bg-gray-100 px-5 text-[19px] leading-[26px]"
          style={{ height: POPOVER_HEIGHT / 2, paddingTop: 11, paddingBottom: 17 }}
          {...permissionsProps}
        >
          {s.menu_permissions}
        </button>
      </div>
    </div>
  );
}

