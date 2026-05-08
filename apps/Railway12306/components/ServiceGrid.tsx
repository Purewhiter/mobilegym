import React from 'react';
import { ICON_REGISTRY, IcMonitor } from '../res/icons';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { localizeRailwayItemName, localizeRailwayItemTag } from '../utils/localizeRailwayItem';
const ICON_MAP: Record<string, any> = ICON_REGISTRY;

interface ServiceGridProps {
  items: { id: string; name: string; icon: string; color?: string; tag?: string }[];
  columns?: number;
  iconBg?: string;
  iconColor?: string;
  onItemClick?: (id: string) => void;
}

export const ServiceGrid: React.FC<ServiceGridProps> = ({
  items, columns = 5, iconBg = 'bg-[#EBF3FF]', iconColor = 'text-app-primary', onItemClick,
}) => {
  const s = useRailwayStrings();
  return (
    <div className="grid gap-y-4 gap-x-2 py-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {items.map(item => {
        const Icon = ICON_MAP[item.icon] || IcMonitor;
        const tag = localizeRailwayItemTag(item.tag, s);
        return (
          <div
            key={item.id}
            className="flex flex-col items-center gap-1 relative active:opacity-70"
            onClick={() => onItemClick?.(item.id)}
          >
            {tag && (
              <span className="absolute -top-1 right-0 text-[8px] text-white bg-red-500 rounded-full px-1 leading-tight z-10">
                {tag}
              </span>
            )}
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${!item.color ? iconBg : ''}`}
              style={item.color ? { backgroundColor: `${item.color}15` } : undefined}
            >
              <Icon size={22} className={!item.color ? iconColor : ''} style={item.color ? { color: item.color } : undefined} />
            </div>
            <span className="text-[11px] text-gray-700 text-center leading-tight">{localizeRailwayItemName(item.id, item.name, s)}</span>
          </div>
        );
      })}
    </div>
  );
};
