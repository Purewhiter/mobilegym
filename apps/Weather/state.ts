import { createAppStore } from '../../os/createAppStore';
import { getDefaultWeatherState } from './utils/weatherStore';

// weatherLibrary 是只读的静态快照 + 启动时按模拟今天重新对齐日期，
// 不参与持久化，避免跨天后持久化数据与前端展示（materializeBundle 实时重写）
// 不一致，也让 bench 每次启动都读到正确日期。
export const useWeatherStore = createAppStore('weather', getDefaultWeatherState(), {
  partialize: (state) => {
    const { weatherLibrary: _omit, ...rest } = state;
    return rest;
  },
});
