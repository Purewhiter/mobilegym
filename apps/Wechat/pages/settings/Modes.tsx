import React from 'react';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../hooks/useWechatGestures';

// Care Mode
export const CareMode: React.FC = () => {
  const t = useWechatStrings();
  const { settings, updateSettings } = useWechatStore(
    useShallow(s => ({
      settings: s.settings,
      updateSettings: s.updateSettings,
    })),
  );
  const { modes } = settings;
  const { bindTap } = useWechatGestures();
  const careFeatures = [t.care_mode_feature_1, t.care_mode_feature_2, t.care_mode_feature_3];

  const toggle = () => {
    updateSettings({
      ...settings,
      modes: { ...modes, care: !modes.care },
    });
  };

  return (
    <div className="bg-app-surface min-h-full flex flex-col items-center pt-6 px-6">
      <div className="mb-6">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
            fill="#f6c444"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-medium text-app-text mb-10">{t.settings_care_mode}</h1>

      <div className="text-app-text text-(--app-settings-item-text-size) self-start font-medium mb-4">{t.care_mode_intro}</div>
      <ul className="text-(--app-c-tw-text-gray-500) text-(--app-chat-bubble-text-size) self-start space-y-3 leading-relaxed mb-20">
        {careFeatures.map(feature => (
          <li key={feature}>· {feature}</li>
        ))}
      </ul>

      <div className="mt-auto mb-20 flex justify-center w-full">
        <button
          {...bindTap<HTMLButtonElement>(
            { kind: 'action', id: 'settings.careMode.toggle' },
            { onTrigger: toggle },
          )}
          className="w-(--app-item-width-184) bg-app-primary text-white py-2.5 rounded-lg font-bold text-(--app-settings-item-text-size) active:opacity-80"
        >
          {modes.care ? t.common_turn_off : t.common_turn_on}
        </button>
      </div>
    </div>
  );
};

// Minor Mode
export const MinorMode: React.FC = () => {
  const t = useWechatStrings();
  const { settings, updateSettings } = useWechatStore(
    useShallow(s => ({
      settings: s.settings,
      updateSettings: s.updateSettings,
    })),
  );
  const { modes } = settings;
  const [agreed, setAgreed] = React.useState(false);
  const { bindTap } = useWechatGestures();

  const toggle = () => {
    if (!modes.minor && !agreed) return;
    updateSettings({
      ...settings,
      modes: { ...modes, minor: !modes.minor },
    });
  };

  return (
    <div className="bg-app-surface min-h-full flex flex-col items-center pt-6 px-6">
      <div className="mb-6">
        <svg
          width="80"
          height="80"
          viewBox="0 0 24 24"
          className="text-app-primary"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22v-8.3" />
          <path d="M12 3a9 9 0 0 0-9 9" />
          <path d="M12 3a9 9 0 0 1 9 9" />
        </svg>
      </div>
      <h1 className="text-2xl font-medium text-app-text mb-6">{t.settings_minor_mode}</h1>

      <p className="text-app-text text-(--app-chat-bubble-text-size) text-center leading-loose mb-20 px-2">
        {t.minor_mode_description}
      </p>

      <div className="mt-auto mb-10 w-full flex flex-col items-center">
        {!modes.minor && (
          <div
            {...bindTap<HTMLDivElement>(
              { kind: 'action', id: 'settings.minorMode.agreement.toggle' },
              { onTrigger: () => setAgreed(!agreed) },
            )}
            className="flex items-center mb-6"
          >
            <div
              className={`w-5 h-5 rounded-full border mr-2 flex items-center justify-center ${
                agreed ? 'bg-app-primary border-app-primary' : 'border-(--app-c-tw-border-gray-300)'
              }`}
            >
              {agreed && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </div>
            <span className="text-(--app-c-tw-text-gray-500) text-xs">{t.minor_mode_agreement}</span>
          </div>
        )}

        <button
          {...bindTap<HTMLButtonElement>(
            { kind: 'action', id: 'settings.minorMode.toggle' },
            { onTrigger: toggle },
          )}
          className={`w-(--app-item-width-184) py-2.5 rounded-lg font-bold text-(--app-chat-bubble-text-size)${
            !modes.minor && !agreed
              ? 'bg-(--app-c-tw-bg-gray-100) text-(--app-c-tw-text-gray-300)'
              : 'bg-app-primary text-white active:opacity-80'
          }`}
          style={{
            transition:
              'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)',
          }}
        >
          {modes.minor ? t.common_turn_off : t.common_turn_on}
        </button>
      </div>
    </div>
  );
};
