import React from 'react';
import { IcFileSearch } from '../res/icons';
import { useLocale } from '../../../os/locale';

interface EmptyStateProps {
  message?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message }) => {
  const locale = useLocale();
  const resolvedMessage = message ?? (locale === 'en' ? 'No orders yet' : '暂无订单');

  return (
    <div className="flex flex-col items-center justify-center py-32">
      <div className="relative w-24 h-24 mb-4">
        <div className="absolute inset-0 bg-[#EBF3FF] rounded-lg transform rotate-3"></div>
        <div className="absolute inset-1 bg-[#D6E6FF] rounded-lg flex items-center justify-center">
          <IcFileSearch size={36} className="text-app-primary/50" />
        </div>
        <div className="absolute -top-1 -left-2 w-2 h-2 rounded-full bg-app-primary/20" />
        <div className="absolute -top-2 right-2 w-1.5 h-1.5 text-app-primary/30">+</div>
        <div className="absolute -bottom-1 left-4 w-1 h-1 rounded-full bg-app-primary/15" />
        <div className="absolute top-2 -right-3 w-2 h-2 rounded-full bg-app-primary/10" />
      </div>
      <span className="text-gray-400 text-sm">{resolvedMessage}</span>
    </div>
  );
};
