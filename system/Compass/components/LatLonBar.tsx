import React from 'react';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function LatLonBar(props: {
  latLabel?: string;
  latValue?: string;
  lonLabel?: string;
  lonValue?: string;
  className?: string;
}) {
  const s = useAppStrings(strings, stringsEn);
  const {
    latLabel = s.lat_north,
    latValue = `40°24'8"`,
    lonLabel = s.lon_east,
    lonValue = `116°40'50"`,
    className,
  } = props;

  return (
    <div className={`w-full flex items-end justify-center gap-11 ${className ?? ''}`}>
      <div className="flex flex-col items-center">
        <div className="text-[#cccccc] text-[16px] mb-[11px]">{latLabel}</div>
        <div className="text-white text-[21px] tracking-wide">{latValue}</div>
      </div>
      <div className="flex flex-col items-center">
        <div className="text-[#cccccc] text-[16px] mb-[11px]">{lonLabel}</div>
        <div className="text-white text-[21px] tracking-wide">{lonValue}</div>
      </div>
    </div>
  );
}

