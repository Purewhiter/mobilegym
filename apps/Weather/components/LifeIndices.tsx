import React from 'react';
import { WeatherIndex } from '../types';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcClothing, IcSun, IcFitness, IcDrive, IcRain, IcSnow } from '../res/icons';
import { useAppStrings } from '@/os/useAppStrings';
import { getLocalizedLifeIndexCategory, getLocalizedLifeIndexName } from '../utils/localizedText';

interface LifeIndicesProps {
  indices: WeatherIndex[];
}

export const LifeIndices: React.FC<LifeIndicesProps> = ({ indices }) => {
  const s = useAppStrings(strings, stringsEn);
  if (!indices || indices.length === 0) return null;

  // Map index type to icon
  // 1: Sport, 2: IcDrive Wash, 3: Dress, 5: UV, 9: Flu
  const getIcon = (type: string) => {
    switch (type) {
      case '1': return <IcFitness />;
      case '2': return <IcDrive />;
      case '3': return <IcClothing />;
      case '5': return <IcSun />;
      case '9': return <IcSnow />;
      default: return <IcRain />;
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3 px-[11px] mb-4">
      {indices.map((item) => (
        <div
          key={item.type}
          className="backdrop-blur-md border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-white h-28"
          style={{ backgroundColor: colors.card_surface_light, borderColor: colors.card_border }}
        >
          <div className="opacity-80">
            {getIcon(item.type)}
          </div>
          <span className="text-sm font-medium">{getLocalizedLifeIndexCategory(item.category, s, item.type)}</span>
          <span className="text-xs opacity-60">{getLocalizedLifeIndexName(item.type, item.name, s)}</span>
        </div>
      ))}
    </div>
  );
};
