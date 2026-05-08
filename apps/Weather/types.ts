export type WeatherCityDefinition = {
  id: string;
  name: string;
  /** 经度 */
  lon: number;
  /** 纬度 */
  lat: number;
};

export type SearchableCity = WeatherCityDefinition & {
  /** 省/直辖市/自治区 */
  adm1: string;
  /** 地级市（区县级城市为父级市名） */
  adm2: string;
  /** 全拼（用于拼音搜索） */
  pinyin: string;
};

export type TempUnit = 'celsius' | 'fahrenheit';
export type WindUnit = 'beaufort' | 'kmh' | 'ms' | 'mph' | 'kn';
export type PressureUnit = 'hpa' | 'mmhg' | 'inhg';

export interface WeatherSettings {
  morningEveningAlert: boolean;
  warningAlert: boolean;
  abnormalWeatherAlert: boolean;
  nightDnd: boolean;
  tempUnit: TempUnit;
  windUnit: WindUnit;
  pressureUnit: PressureUnit;
  nightAutoUpdate: boolean;
  revokeConsent: boolean;
}

export interface WeatherNow {
  obsTime: string;
  temp: string;
  feelsLike: string;
  icon: string;
  text: string;
  wind360: string;
  windDir: string;
  windScale: string;
  windSpeed: string;
  humidity: string;
  precip: string;
  pressure: string;
  vis: string;
  cloud: string;
  dew: string;
}

export interface WeatherDaily {
  fxDate: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moonPhase: string;
  moonPhaseIcon: string;
  tempMax: string;
  tempMin: string;
  iconDay: string;
  textDay: string;
  iconNight: string;
  textNight: string;
  wind360Day: string;
  windDirDay: string;
  windScaleDay: string;
  windSpeedDay: string;
  wind360Night: string;
  windDirNight: string;
  windScaleNight: string;
  windSpeedNight: string;
  humidity: string;
  precip: string;
  pressure: string;
  vis: string;
  cloud: string;
  uvIndex: string;
}

export interface WeatherHourly {
  fxTime: string;
  temp: string;
  icon: string;
  text: string;
  wind360: string;
  windDir: string;
  windScale: string;
  windSpeed: string;
  humidity: string;
  pop: string;
  precip: string;
  pressure: string;
  cloud: string;
  dew: string;
}

export interface WeatherIndex {
  date: string;
  type: string;
  name: string;
  level: string;
  category: string;
  text: string;
}

export interface WeatherWarning {
  id: string;
  sender: string;
  pubTime: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  level: string;
  severity: string;
  severityColor: string;
  type: string;
  typeName: string;
  text: string;
  related: string;
}

export interface MinutelyPrecipitation {
  fxTime: string;
  precip: string;
  type: string;
}

export interface AirQuality {
  pubTime: string;
  aqi: string;
  level: string;
  category: string;
  primaryPollutant: string;
  pm10: string;
  pm2p5: string;
  no2: string;
  so2: string;
  co: string;
  o3: string;
}

export interface City {
  name: string;
  id: string;
  lat: string;
  lon: string;
  adm2: string;
  adm1: string;
  country: string;
  tz: string;
  utcOffset: string;
  isDst: string;
  type: string;
  rank: string;
  fxLink: string;
}

export type WeatherBundle = {
  now: WeatherNow;
  daily: WeatherDaily[];
  hourly: WeatherHourly[];
  indices: WeatherIndex[];
  warnings: WeatherWarning[];
  airQuality: AirQuality | null;
  minutely: { summary: string; minutely: MinutelyPrecipitation[] } | null;
};

export type AirQualityForecastDay = {
  forecastStartTime: string;
  forecastEndTime: string;
  aqi: string;
  level: string;
  category: string;
  primaryPollutant: string;
};

export type WeatherLibraryEntry = {
  lonLat: string;
  locationName?: string;
  bundle?: WeatherBundle;
  historicalYesterday?: WeatherDaily | null;
  airQualityForecast?: AirQualityForecastDay[];
};

export type WeatherLibrary = Record<string, WeatherLibraryEntry>;
