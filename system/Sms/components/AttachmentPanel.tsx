import React from 'react';
import { ATTACHMENT_OPTIONS } from '../constants';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
const smsIcon = (name: string) => name ? `/@app-assets/Sms/icons/${name}.svg` : '';

/** Attachment id → string key mapping */
const ATTACHMENT_LABEL_KEYS: Record<string, keyof typeof strings> = {
  emoji: 'attachment_emoji',
  card: 'attachment_card',
  image: 'attachment_image',
  photo: 'attachment_photo',
  favorites: 'attachment_favorites',
  schedule: 'attachment_schedule',
  theme: 'attachment_theme',
  audio: 'attachment_audio',
  video: 'attachment_video',
  slideshow: 'attachment_slideshow',
};

/** Load SVG icon from assets */
const SmsIcon: React.FC<{ name: string; size?: number; className?: string }> = ({
    name,
    size = 24,
    className = '',
}) => {
    const iconPath = smsIcon(name);
    if (!iconPath) return null;

    return (
        <img
            src={iconPath}
            alt={name}
            width={size}
            height={size}
            className={className}
            style={{ opacity: 0.7 }}
        />
    );
};

export const AttachmentPanel: React.FC = () => {
    const s = useAppStrings(strings, stringsEn);
    return (
        <div className="bg-app-bg px-3 pb-2">
            <div className="grid grid-cols-4 gap-2">
                {ATTACHMENT_OPTIONS.map((option) => (
                    <button
                        key={option.id}
                        className="flex flex-col items-center justify-center bg-app-surface rounded-xl py-4 px-2 active:bg-gray-50"
                    >
                        <div className="w-8 h-8 flex items-center justify-center mb-2">
                            <SmsIcon name={option.icon} size={28} />
                        </div>
                        <span className="text-[12px] text-gray-600">
                            {s[ATTACHMENT_LABEL_KEYS[option.id]] ?? option.label}
                        </span>
                    </button>
                ))}
            </div>
            {/* Pagination dots */}
            <div className="flex justify-center gap-1.5 mt-3 pb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            </div>
        </div>
    );
};
