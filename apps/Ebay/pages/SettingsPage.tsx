import React, { useMemo, useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useEbayStore } from '../state';
import { useEbayGestures } from '../navigation';
import { useEbayStrings } from '../hooks/useEbayStrings';

type ThemeOption = {
  id: 'light' | 'dark' | 'battery' | 'system';
  label: string;
  subtitle: string;
};

const THEME_OPTION_IDS: ThemeOption['id'][] = ['light', 'dark', 'battery', 'system'];

const SettingsPage: React.FC = () => {
  const { bindBack } = useEbayGestures();
  const s = useEbayStrings();
  const themeId = useEbayStore(st => st.settings.themeId);
  const updateSettings = useEbayStore(st => st.updateSettings);
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);
  const themeOptions = useMemo<ThemeOption[]>(() => THEME_OPTION_IDS.map((id) => {
    switch (id) {
      case 'light':
        return { id, label: s.settings_theme_light, subtitle: s.settings_theme_light_desc };
      case 'dark':
        return { id, label: s.settings_theme_dark, subtitle: s.settings_theme_dark_desc };
      case 'battery':
        return { id, label: s.settings_theme_battery, subtitle: s.settings_theme_battery_desc };
      case 'system':
      default:
        return { id, label: s.settings_theme_system, subtitle: s.settings_theme_system_desc };
    }
  }), [s]);
  const currentTheme = themeOptions.find(o => o.id === themeId) ?? themeOptions[themeOptions.length - 1];

  const handleThemeSelect = (option: ThemeOption) => {
    updateSettings({ themeId: option.id });
    // setTimeout(() => setIsThemeDialogOpen(false), 200); // Optional delay for effect
    setIsThemeDialogOpen(false);
  };

  return (
    <div className="h-full bg-app-surface flex flex-col relative">
      {/* Header */}
      <div className="flex items-center px-4 py-3 pt-12 border-b border-gray-100 sticky top-0 bg-app-surface z-10">
        <button className="mr-4" {...bindBack()}>
          <IcNavBack size={24} className="text-black" />
        </button>
        <h1 className="text-xl font-bold text-black">{s.settings_title}</h1>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-app-surface">
        
        {/* Account Section */}
        <SectionHeader title={s.settings_account} />
        <Item title={s.settings_sign_in} />
        <Divider />

        {/* General Section */}
        <SectionHeader title={s.settings_general} />
        <Item 
          title={s.settings_theme} 
          subtitle={currentTheme.subtitle}
          onClick={() => setIsThemeDialogOpen(true)}
        />
        <Item 
          title={s.settings_country} 
          subtitle={s.settings_country_value} 
        />
        <Item title={s.settings_translation} />
        <Item title={s.settings_clear_searches} />
        <Divider />

        {/* Support Section */}
        <SectionHeader title={s.settings_support} />
        <Item 
          title={s.settings_customer_service} 
          subtitle={s.settings_customer_service_desc} 
        />
        <Item title={s.settings_shake_to_report} />
        <Divider />

        {/* About Section */}
        <SectionHeader title={s.settings_about} />
        <Item title={s.settings_terms} />
        <Item title={s.settings_privacy} />
        <Item title={s.settings_privacy_choices} />
        <Item title={s.settings_ads} />
        <Item title={s.settings_accessibility} />
        <Item title={s.settings_legal} />

        {/* Footer */}
        <div className="py-8 text-center">
            <p className="text-app-text-muted text-sm mb-1">{s.settings_version}</p>
            <p className="text-app-text-muted text-sm">6.244.0.1</p>
        </div>
        
        {/* Extra padding for bottom navigation area if needed, though this page covers full screen usually */}
        <div className="h-6"></div>
      </div>

      {/* Theme Selection Dialog Overlay */}
      {isThemeDialogOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-app-surface rounded-lg w-[85%] max-w-sm shadow-xl overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-xl font-bold text-black mb-4">{s.settings_choose_theme}</h3>
              
              <div className="space-y-6">
                {themeOptions.map((option) => (
                  <div 
                    key={option.id} 
                    className="flex items-start cursor-pointer"
                    onClick={() => handleThemeSelect(option)}
                  >
                    {/* Radio Button */}
                    <div className="flex-shrink-0 mt-1 mr-4">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        currentTheme.id === option.id ? 'border-blue-600' : 'border-gray-500'
                      }`}>
                        {currentTheme.id === option.id && (
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                        )}
                      </div>
                    </div>
                    
                    {/* Text */}
                    <div>
                      <div className="text-base font-medium text-black leading-none mb-1.5">{option.label}</div>
                      <div className="text-sm text-app-text-muted leading-snug">{option.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="px-6 py-4 flex justify-end">
              <button 
                onClick={() => setIsThemeDialogOpen(false)}
                className="text-blue-600 font-medium text-base px-2 py-1"
              >
                {s.settings_cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <div className="px-4 pt-6 pb-2">
    <h2 className="text-blue-600 font-medium text-base">{title}</h2>
  </div>
);

const Item = ({ title, subtitle, onClick }: { title: string; subtitle?: string; onClick?: () => void }) => (
  <div 
    className={`px-4 py-4 ${onClick ? 'active:bg-gray-100 cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <div className="text-base text-black font-normal">{title}</div>
    {subtitle && <div className="text-sm text-app-text-muted mt-1">{subtitle}</div>}
  </div>
);

const Divider = () => (
  <div className="mx-4 border-b border-app-border"></div>
);

export default SettingsPage;
