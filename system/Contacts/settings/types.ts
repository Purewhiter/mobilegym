export interface PhoneSettingsItem {
  type: 'preference' | 'switch' | 'checkbox' | 'seekbar' | 'list' | 'value' | 'footer';
  key: string;
  title: string;
  summary?: string;
  defaultValue?: string;
  options?: Array<{ label: string; value: string }>;
  targetPage?: string;
}

export interface PhoneSettingsCategory {
  title?: string;
  items: PhoneSettingsItem[];
}

export interface PhoneSettingsPage {
  id: string;
  title: string;
  categories: PhoneSettingsCategory[];
}

