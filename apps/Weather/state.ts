import { createDeviceAppStore } from '../../os/device/deviceStore';
import { getDefaultWeatherState, type WeatherState } from './utils/weatherStore';

// The app's state lives in the device server session (device/stateOnly.ts);
// pages keep writing this store with `setState(fn)` and every write is saved
// there. weatherLibrary 是只读的静态快照 + 启动时按模拟今天重新对齐日期，
// 留在页面上不进会话，避免跨天后存下的数据与前端展示（materializeBundle 实时重写）
// 不一致，也让 bench 每次启动都读到正确日期。
export const useWeatherStore = createDeviceAppStore<WeatherState, Record<never, never>>(
  'weather',
  getDefaultWeatherState(),
  { localKeys: ['weatherLibrary'], syncSetState: true },
  () => ({}),
);
