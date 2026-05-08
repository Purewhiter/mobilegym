import React from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight } = SIMULATOR_CONFIG.framework;
import { useCompassGestures } from '../hooks/useCompassGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
// 真机尺寸 (scale factor 3)：权限项 [35,473][1045,705] → 1010×232 px → 337×77 dp
const ROW_LEFT_DP = 35 / 3;       // ≈11.67
const ROW_TOP_FIRST_DP = 473 / 3; // ≈157.67
const ROW_WIDTH_DP = 1010 / 3;    // ≈336.67
const ROW_HEIGHT_DP = 232 / 3;    // ≈77.33

// 真机标题 com.miui.compass:id/action_bar_title_expand Bounds [76,296][452,422] → 376×126 px → 125×42 dp
const TITLE_LEFT_DP = 76 / 3;     // ≈25.33
const TITLE_TOP_DP = 296 / 3;     // ≈98.67
const TITLE_WIDTH_DP = 376 / 3;   // ≈125.33
const TITLE_HEIGHT_DP = 126 / 3;  // 42

// 真机 action_bar_container 总高 150.3 dp；返回按钮 (19.7, 48) 39×39 dp
const ACTION_BAR_HEIGHT_DP = 150.3;
const BACK_BTN_LEFT_DP = 19.7;
const BACK_BTN_TOP_DP = 48;
const BACK_BTN_SIZE_DP = 39;

function PermissionRow(props: {
  title: string;
  desc: string;
  status: string;
}) {
  const { title, desc, status } = props;
  return (
    <div
      className="flex items-center justify-between"
      style={{
        height: ROW_HEIGHT_DP,
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[22px] font-semibold text-gray-900 leading-tight">{title}</div>
        <div className="text-[16px] text-gray-500 mt-1">{desc}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[16px] text-gray-400">{status}</span>
        <IcNavForward size={20} className="text-gray-300" />
      </div>
    </div>
  );
}

export function PermissionsPage() {
  const { bindBack } = useCompassGestures();
  const s = useAppStrings(strings, stringsEn);

  return (
    <div className="w-full h-full text-black overflow-hidden" style={{ backgroundColor: '#F7F7F7' }} data-status-bar-foreground="dark">
      {/* 与真机 action_bar_container 一致：总高 150.3 dp（含状态栏），返回按钮 (19.7, 48) 39×39 */}
      <div
        className="relative"
        style={{ height: ACTION_BAR_HEIGHT_DP }}
      >
        <div style={{ height: statusBarHeight }} />
        <button
          type="button"
          aria-label={s.back}
          className="absolute flex items-center justify-center text-gray-700 active:opacity-60"
          style={{
            left: BACK_BTN_LEFT_DP,
            top: BACK_BTN_TOP_DP,
            width: BACK_BTN_SIZE_DP,
            height: BACK_BTN_SIZE_DP,
          }}
          {...bindBack<HTMLButtonElement>()}
        >
          <IcNavBack size={22} />
        </button>
        <div
          id="action_bar_title_expand"
          className="absolute font-semibold tracking-tight text-gray-900"
          style={{
            left: TITLE_LEFT_DP,
            top: TITLE_TOP_DP,
            width: TITLE_WIDTH_DP,
            height: TITLE_HEIGHT_DP,
            fontSize: 28,
            lineHeight: `${TITLE_HEIGHT_DP}px`,
          }}
        >
          {s.permission_title}
        </div>
      </div>

      {/* 权限卡片：与真机选项尺寸一致 337×77 dp 每行 */}
      <div
        className="rounded-[24px] overflow-hidden bg-white"
        style={{
          marginLeft: ROW_LEFT_DP,
          marginRight: ROW_LEFT_DP,
          width: ROW_WIDTH_DP,
          marginTop: ROW_TOP_FIRST_DP - ACTION_BAR_HEIGHT_DP,
        }}
      >
        <PermissionRow title={s.permission_location_title} desc={s.permission_location_desc} status={s.permission_status_allowed} />
        <PermissionRow title={s.permission_camera_title} desc={s.permission_camera_desc} status={s.permission_status_allowed} />
      </div>
    </div>
  );
}

