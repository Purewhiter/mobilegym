import React from 'react';
import { IcMoreVert } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight } = SIMULATOR_CONFIG.framework;
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
export const COMPASS_TOP_BAR_HEIGHT = statusBarHeight + 55;

export function CompassTopBar(props: {
  active: 'compass' | 'level';
  compassTabProps?: React.HTMLAttributes<HTMLButtonElement>;
  levelTabProps?: React.HTMLAttributes<HTMLButtonElement>;
  moreProps?: React.HTMLAttributes<HTMLButtonElement>;
  className?: string;
}) {
  const { active, compassTabProps, levelTabProps, moreProps, className } = props;
  const s = useAppStrings(strings, stringsEn);

  return (
    <div
      className={`w-full relative text-white ${className ?? ''}`}
      style={{ paddingTop: statusBarHeight, height: COMPASS_TOP_BAR_HEIGHT }}
    >
      <div className="h-(--app-topbar-title-row-height) flex items-center justify-center relative">
        <div className="flex items-center gap-6">
          <button
            type="button"
            className={`text-[22px] tracking-wide ${
              active === 'compass' ? 'text-white/80' : 'text-white/55'
            }`}
            {...(compassTabProps ?? {})}
          >
            {s.tab_compass}
          </button>
          <button
            type="button"
            className={`text-[22px] tracking-wide ${
              active === 'level' ? 'text-white/80' : 'text-white/55'
            }`}
            {...(levelTabProps ?? {})}
          >
            {s.tab_level}
          </button>
        </div>

        <button
          type="button"
          aria-label={s.menu_more}
          className="absolute right-5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 active:opacity-70"
          {...(moreProps ?? {})}
        >
          <IcMoreVert size={22} />
        </button>
      </div>
    </div>
  );
}

