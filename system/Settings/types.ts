// Settings App Type Definitions

/** SVG icon data extracted from Android vector drawables */
export interface SettingsIconData {
  bg: string;
  paths: Array<{ d: string; fillRule?: string }>;
}

/** A single preference item in a settings page */
export interface SettingsItem {
  type: 'preference' | 'switch' | 'checkbox' | 'seekbar' | 'list' | 'value' | 'footer';
  key: string;
  title: string;
  summary?: string;
  defaultValue?: string;
  /** For editable text preferences (best-effort from Android `android:inputType`) */
  inputType?: string;
  /** For list preferences */
  options?: Array<{ label: string; value: string }>;
  /** Navigate to this sub-page id */
  targetPage?: string;
  icon?: string;
}

/** A group of related preference items */
export interface SettingsCategory {
  title?: string;
  items: SettingsItem[];
}

/** A full settings sub-page */
export interface SettingsPage {
  id: string;
  title: string;
  categories: SettingsCategory[];
}

/** A main menu item on the settings home page */
export interface SettingsMainItem {
  id: string;
  title: string;
  /** Key into SETTINGS_ICONS */
  icon?: string;
  /** Navigate to this sub-page id */
  targetPage?: string;
  /** Dynamic summary text */
  summary?: string;
}

/** A section (card group) on the main page */
export interface SettingsMainSection {
  items: SettingsMainItem[];
}

// Settings dynamic state (stored in localStorage via SettingsContext)

export type SettingsValue = string | number | boolean | null;

export interface WifiSavedNetwork {
  ssid: string;
  security: 'WPA2' | 'WPA3' | 'OPEN';
  password?: string;
  autoJoin?: boolean;
  lastConnectedAt?: number;
}

export interface SettingsConfigState {
  /** Generic preference values keyed by Android preference key */
  preferences: Record<string, SettingsValue>;
  wifi: {
    savedNetworks: WifiSavedNetwork[];
  };
}
