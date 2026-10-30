import { registerStateAdapter } from '../../os/createAppStore';
import { createDeviceAppStore } from '../../os/device/deviceStore';
import { COMPASS_CONFIG, getDirectionText } from './data';
import { getCurrentPosition } from '../../os/LocationService';

// ---- Types ----

interface CompassState {
  headingDeg: number;
  levelAngleDeg: number;
  directionText: string;
  latitude: number | null;
  longitude: number | null;
}

interface CompassActions {
  setHeading: (deg: number) => void;
  setLevelAngle: (deg: number) => void;
  fetchLocation: () => void;
}

// ---- Store ----

const initialState: CompassState = {
  headingDeg: COMPASS_CONFIG.headingDeg,
  levelAngleDeg: COMPASS_CONFIG.levelAngleDeg,
  directionText: getDirectionText(COMPASS_CONFIG.headingDeg),
  latitude: null,
  longitude: null,
};

// State lives in the device server session (device/stateOnly.ts); the actions
// below run here as before and every write is saved there.
export const useCompassStore = createDeviceAppStore<CompassState, CompassActions>(
  'compass',
  initialState,
  { localKeys: [], syncSetState: true },
  (_device, set) => ({
    setHeading: (deg: number) => {
      set({ headingDeg: deg, directionText: getDirectionText(deg) });
    },

    setLevelAngle: (deg: number) => {
      set({ levelAngleDeg: deg });
    },

    fetchLocation: () => {
      getCurrentPosition(
        (position) => {
          set({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        null,
      );
    },
  }),
);

// 确保 directionText 始终与 headingDeg 同步（App 未挂载时也能正确计算）
registerStateAdapter('compass', (state) => {
  if (state.directionText !== undefined) return state;
  return {
    ...state,
    directionText: getDirectionText(state.headingDeg ?? COMPASS_CONFIG.headingDeg),
  };
});
