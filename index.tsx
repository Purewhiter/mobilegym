
import './os/storageIsolationBootstrap';
import './os/providers/bootstrap';
import './os/providers/SmsReceiverBootstrap';

// 等比缩放：保持 360×800 内部布局，视口不够时按比例缩小
function updateSimScale() {
  const scale = Math.min(window.innerWidth / 360, window.innerHeight / 800, 1);
  document.documentElement.style.setProperty('--sim-scale', String(scale));
}
updateSimScale();
window.addEventListener('resize', updateSimScale);

window.addEventListener('unhandledrejection', (event) => {
  console.error('[OS] Unhandled promise rejection:', event.reason);
});

// 桌面/小组件会在 App 未打开时直接读取这些 store，保留按需的最小预加载集合。
import './apps/Weather/state';
import './system/Clock/state';
import './apps/Spotify/state';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { OSProvider } from './os/OSContext';
import { SystemShell } from './os/SystemShell';
import { ThemeProvider } from './os/ThemeContext';
import { BootGate } from './os/BootGate';
import { SIMULATOR_CONFIG } from './os/data';
import * as TimeService from './os/TimeService';
import * as LocationService from './os/LocationService';
import * as SkinService from './os/SkinService';

// Agent Bridge for MCP server control (dev only, excluded from prod build)
if (import.meta.env.DEV) {
  import('./os/AgentBridge');
}

// Initialize time service based on config
TimeService.initTimeService({
  mode: SIMULATOR_CONFIG.time.mode,
  simulatedTime: SIMULATOR_CONFIG.time.simulatedTime,
  flowing: SIMULATOR_CONFIG.time.flowing,
  speed: SIMULATOR_CONFIG.time.speed,
});

// Initialize location service based on config
LocationService.initLocationService({
  mode: SIMULATOR_CONFIG.location.mode,
  simulatedLocation: typeof SIMULATOR_CONFIG.location.simulatedLocation === 'string'
    ? LocationService.PRESET_LOCATIONS[SIMULATOR_CONFIG.location.simulatedLocation.toLowerCase()]
    : SIMULATOR_CONFIG.location.simulatedLocation
});

// Init runtime skin from URL (?skin=neutral)
SkinService.initFromUrl();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <OSProvider>
      <ThemeProvider>
        <BootGate>
          <SystemShell />
        </BootGate>
      </ThemeProvider>
    </OSProvider>
  </React.StrictMode>
);

// 仿真环境布局调试：暴露当前页面 HTML，便于与真机 dump 对比
import { getSimLayoutHTML as getSimLayoutHTMLImpl } from './os/simLayoutExport';

declare global {
  interface Window {
    /** 获取当前页面布局 HTML。options.visibleOnly=true 时只导出当前视口可见内容，与安卓单屏 dump 对齐 */
    getSimLayoutHTML?: (options?: { visibleOnly?: boolean }) => string;
  }
}
if (typeof window !== 'undefined') {
  window.getSimLayoutHTML = (options) => getSimLayoutHTMLImpl(options);
}
