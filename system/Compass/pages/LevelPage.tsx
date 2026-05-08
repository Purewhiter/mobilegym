import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CompassTopBar, COMPASS_TOP_BAR_HEIGHT } from '../components/CompassTopBar';
import { LevelDial } from '../components/LevelDial';
import { LatLonBar } from '../components/LatLonBar';
import { MoreMenuPopover } from '../components/MoreMenuPopover';
import { useCompassGestures } from '../hooks/useCompassGestures';
import { useCompassStore } from '../state';
import { formatLatLon } from '../data';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function LevelPage() {
  const [searchParams] = useSearchParams();
  const menuOpen = searchParams.get('menu') === 'true';
  const { bindTap, back } = useCompassGestures();

  const s = useAppStrings(strings, stringsEn);

  // 从 Zustand store 直接读取
  const levelAngleDeg = useCompassStore(st => st.levelAngleDeg);
  const latitude = useCompassStore(st => st.latitude);
  const longitude = useCompassStore(st => st.longitude);

  const latLonLabels = { latNorth: s.lat_north, latSouth: s.lat_south, lonEast: s.lon_east, lonWest: s.lon_west };
  const { latLabel, latValue, lonLabel, lonValue } = latitude !== null && longitude !== null
    ? formatLatLon(latitude, longitude, latLonLabels)
    : { latLabel: s.lat_north, latValue: '--', lonLabel: s.lon_east, lonValue: '--' };

  return (
    <div className="w-full h-full bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-black/90 pointer-events-none" />

      <CompassTopBar
        active="level"
        className="absolute inset-x-0 top-0 z-40"
        compassTabProps={!menuOpen ? bindTap<HTMLButtonElement>('tab.compass') : undefined}
        moreProps={!menuOpen ? bindTap<HTMLButtonElement>('menu.open.level') : undefined}
      />

      {/* Title (aligned with compass page: same vertical offset) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-10"
        style={{ top: COMPASS_TOP_BAR_HEIGHT + 6 }}
      >
        <div className="flex items-baseline justify-center font-semibold tracking-wide">
          <span className="text-[52px] leading-none">{levelAngleDeg}</span>
          <span className="text-[28px] leading-none translate-y-[6px]">°</span>
        </div>
      </div>

      {/* Level dial: same position and size as compass dial (top=203, size=284) */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 203 }}>
        <LevelDial size={284} angleDeg={levelAngleDeg} />
      </div>

      {/* LatLonBar: same position as compass page (top=606) */}
      <div className="absolute inset-x-0" style={{ top: 606 }}>
        <LatLonBar
          latLabel={latLabel}
          latValue={latValue}
          lonLabel={lonLabel}
          lonValue={lonValue}
        />
      </div>

      {menuOpen ? (
        <MoreMenuPopover
          onBackdropClick={() => back(1)}
          privacyProps={bindTap<HTMLButtonElement>('privacy.open')}
          permissionsProps={bindTap<HTMLButtonElement>('permissions.open')}
        />
      ) : null}
    </div>
  );
}
