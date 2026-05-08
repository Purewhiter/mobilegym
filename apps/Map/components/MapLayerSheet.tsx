import React from 'react';
import { IcClose, IcMap, IcBus, IcBike, TrafficInfoIcon } from '../res/icons';
import { useMapBackHandler } from '../hooks/useMapBackHandler';
import { useMapStrings } from '../hooks/useMapStrings';

/** hybrid = 卫星影像 + 道路与 POI 标注（对应客户端「卫星」开关的常见效果） */
export type MapBaseTypeId = 'roadmap' | 'hybrid' | 'terrain';

export interface MapDetailToggles {
  transit: boolean;
  traffic: boolean;
  biking: boolean;
  threeD: boolean;
  streetView: boolean;
  wildfire: boolean;
  airQuality: boolean;
}

interface MapLayerSheetProps {
  open: boolean;
  onClose: () => void;
  baseMapType: MapBaseTypeId;
  onBaseMapChange: (t: MapBaseTypeId) => void;
  details: MapDetailToggles;
  onDetailChange: (key: keyof MapDetailToggles, value: boolean) => void;
}

const TEAL = 'border-teal-600 text-teal-700';
const MUTED = 'border-gray-200 text-gray-600';

function Tile({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors active:opacity-90 ${
        selected ? TEAL : MUTED
      }`}
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-lg bg-gray-50 ${
          selected ? 'ring-2 ring-teal-500/30' : ''
        }`}
      >
        {children}
      </div>
      <span className={`text-xs font-medium ${selected ? 'text-teal-700' : 'text-gray-700'}`}>{label}</span>
    </button>
  );
}

function DetailTile({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-colors active:opacity-90 ${
        active ? TEAL : MUTED
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center">{children}</div>
      <span className={`text-center text-[11px] leading-tight font-medium ${active ? 'text-teal-700' : 'text-gray-700'}`}>
        {label}
      </span>
    </button>
  );
}

/** 卫星简笔画 */
function SatelliteGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" className="text-emerald-700" />
      <path d="M5 12h14M12 5c2 4 2 10 0 14M12 5c-2 4-2 10 0 14" stroke="currentColor" strokeWidth="1" className="text-emerald-600/80" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" className="text-amber-600" />
      <circle cx="15" cy="14" r="1" fill="currentColor" className="text-blue-500" />
    </svg>
  );
}

function TerrainGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M3 18 L8 10 L12 14 L16 8 L21 18 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        className="text-amber-700/30"
      />
      <path d="M3 18h18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Cube3DGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 3L20 7v10l-8 4-8-4V7l8-4z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="currentColor"
        className="text-slate-600/20"
      />
      <path d="M12 3v8M12 11L4 7M12 11l8-4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function PegmanGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="8" r="3" fill="#FBC02D" />
      <path d="M8 22c0-4 2-7 4-7s4 3 4 7" fill="#F9A825" />
    </svg>
  );
}

function WildfireGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="9" fill="#E53935" />
      <path
        d="M12 7c2 3 1 6-1 8 2-1 4-4 2-7-1 2-3 3-1-1z"
        fill="#FFEB3B"
        opacity="0.9"
      />
    </svg>
  );
}

function AirGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="9" fill="#43A047" />
      <path d="M6 12h12M6 15h12M6 9h12" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export const MapLayerSheet: React.FC<MapLayerSheetProps> = ({
  open,
  onClose,
  baseMapType,
  onBaseMapChange,
  details,
  onDetailChange,
}) => {
  const s = useMapStrings();

  useMapBackHandler(
    () => {
      onClose();
      return true;
    },
    { enabled: open, priority: 900 },
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="map-layer-sheet-title">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label={s.filter_cancel} />
      <div className="relative mx-auto w-full max-w-lg animate-slide-up rounded-t-2xl bg-app-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 id="map-layer-sheet-title" className="text-lg font-medium text-gray-900">
            {s.map_type}
          </h2>
          <button
            type="button"
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 active:bg-gray-200"
            onClick={onClose}
            aria-label={s.filter_cancel}
          >
            <IcClose size={22} />
          </button>
        </div>

        <div className="px-4 pb-3 pt-4">
          <div className="grid grid-cols-3 gap-3">
            <Tile selected={baseMapType === 'roadmap'} onClick={() => onBaseMapChange('roadmap')} label={s.map_type_default}>
              <IcMap size={28} className="text-slate-600" />
            </Tile>
            <Tile selected={baseMapType === 'hybrid'} onClick={() => onBaseMapChange('hybrid')} label={s.map_type_satellite}>
              <SatelliteGlyph />
            </Tile>
            <Tile selected={baseMapType === 'terrain'} onClick={() => onBaseMapChange('terrain')} label={s.map_type_terrain}>
              <TerrainGlyph />
            </Tile>
          </div>
        </div>

        <div className="mx-4 border-t border-gray-100" />

        <div className="px-4 pb-6 pt-4">
          <div className="mb-3 text-sm font-medium text-gray-500">{s.map_details}</div>
          <div className="grid grid-cols-4 gap-2">
            <DetailTile
              active={details.transit}
              onClick={() => onDetailChange('transit', !details.transit)}
              label={s.map_detail_transit}
            >
              <IcBus size={26} className="text-blue-600" />
            </DetailTile>
            <DetailTile
              active={details.traffic}
              onClick={() => onDetailChange('traffic', !details.traffic)}
              label={s.map_detail_traffic}
            >
              <TrafficInfoIcon className="h-7 w-7 text-green-600" />
            </DetailTile>
            <DetailTile
              active={details.biking}
              onClick={() => onDetailChange('biking', !details.biking)}
              label={s.map_detail_bicycling}
            >
              <IcBike size={26} className="text-emerald-600" />
            </DetailTile>
            <DetailTile active={details.threeD} onClick={() => onDetailChange('threeD', !details.threeD)} label="3D">
              <Cube3DGlyph />
            </DetailTile>
            <DetailTile
              active={details.streetView}
              onClick={() => onDetailChange('streetView', !details.streetView)}
              label={s.map_detail_street_view}
            >
              <PegmanGlyph />
            </DetailTile>
            <DetailTile
              active={details.wildfire}
              onClick={() => onDetailChange('wildfire', !details.wildfire)}
              label={s.map_detail_wildfire}
            >
              <WildfireGlyph />
            </DetailTile>
            <DetailTile
              active={details.airQuality}
              onClick={() => onDetailChange('airQuality', !details.airQuality)}
              label={s.map_detail_air_quality}
            >
              <AirGlyph />
            </DetailTile>
          </div>
        </div>
      </div>
    </div>
  );
};
