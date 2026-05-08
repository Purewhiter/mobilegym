import React, { useCallback, useRef, useState } from 'react';
import { WeatherWarning } from '../types';
import { IcAlert } from '../res/icons';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import * as TimeService from '../../../os/TimeService';
import { getLocalizedWarningText, getLocalizedWarningType } from '../utils/localizedText';

interface WarningCardProps {
  warnings: WeatherWarning[];
}

const formatRelativeTime = (pubTime: string, s: typeof strings): string => {
  try {
    const pubDate = TimeService.fromTimestamp(TimeService.parseToTimestamp(pubTime));
    const now = TimeService.getDate();
    const diffMs = now.getTime() - pubDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      return s.warning_just_updated;
    }
    if (diffMinutes < 60) {
      return `${diffMinutes}${s.warning_minutes_ago}`;
    }
    if (diffHours < 24) {
      return diffHours === 1 ? s.warning_1hour_ago : `${diffHours}${s.warning_hours_ago}`;
    }
    if (diffDays === 0) {
      return s.warning_today_updated;
    }
    if (diffDays === 1) {
      return s.warning_1day_ago;
    }
    if (diffDays < 7) {
      return `${diffDays}${s.warning_days_ago}`;
    }
    return `${Math.floor(diffDays / 7)}${s.warning_weeks_ago}`;
  } catch {
    return s.warning_updated;
  }
};

export const WarningCard: React.FC<WarningCardProps> = ({ warnings }) => {
  const s = useAppStrings(strings, stringsEn);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getIconStyle = (color: string) => {
    switch (color) {
      case 'Blue':
        return 'text-blue-300';
      case 'Yellow':
        return 'text-yellow-300';
      case 'Orange':
        return 'text-orange-300';
      case 'Red':
        return 'text-red-300';
      default:
        return 'text-white';
    }
  };

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const newIndex = Math.round(container.scrollLeft / container.clientWidth);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < warnings.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, warnings.length]);

  if (!warnings || warnings.length === 0) {
    return (
      <div className="px-[11px] mb-2">
        <div className="rounded-2xl overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <div className="flex justify-between items-start mb-1">
              <div className="flex flex-col">
                <span className="font-medium text-base mb-1 invisible">Placeholder</span>
                <span className="text-xs invisible">Placeholder</span>
              </div>
              <div className="w-10 h-10" />
            </div>
            <div className="text-sm leading-relaxed line-clamp-2 mt-2 invisible">
              Placeholder placeholder placeholder placeholder
            </div>
          </div>
          <div className="pb-3 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-[11px] mb-2">
      <div
        className="rounded-2xl border backdrop-blur-md overflow-hidden"
        style={{ backgroundColor: colors.card_surface_warning, borderColor: colors.card_border }}
      >
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
          onScroll={handleScroll}
        >
          {warnings.map((warning, index) => {
            const iconStyle = getIconStyle(warning.severityColor);
            const warningType = getLocalizedWarningType(warning, s);
            const relativeTime = formatRelativeTime(warning.pubTime, s);

            return (
              <div key={index} className="w-full flex-shrink-0 snap-center px-4 pt-3 pb-1">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex flex-col">
                    <span className="font-medium text-base text-white mb-1">{warningType}</span>
                    <span className="text-xs text-white opacity-40">{relativeTime}</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <IcAlert size={26} className={iconStyle} />
                  </div>
                </div>

                <div className="text-sm leading-relaxed text-white opacity-40 line-clamp-2 mt-2">
                  {getLocalizedWarningText(warning, s)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-1.5 pb-3 h-4">
          {warnings.length > 1 && warnings.map((_, index) => (
            <div
              key={index}
              className={`h-1 rounded-full transition-all ${index === currentIndex ? 'w-4' : 'w-1.5'}`}
              style={{
                backgroundColor: index === currentIndex ? colors.warning_dot_active : colors.warning_dot_inactive,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
