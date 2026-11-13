/**
 * Device server entry: builds the engine with every app module and returns the
 * `/__device` HTTP handler. Loaded by the Vite plugin (dev: ssrLoadModule,
 * preview: esbuild bundle), so app modules stay plain TypeScript.
 */

import { createBilibiliModule } from '../apps/Bilibili/device';
import { createRailway12306Module } from '../apps/Railway12306/device';
import { createRedBookModule } from '../apps/RedBook/device';
import { createRedditModule } from '../apps/Reddit/device';
import { createXModule } from '../apps/X/device';
import { createEbayModule } from '../apps/Ebay/device';
import { createSpotifyModule } from '../apps/Spotify/device';
import { DeviceServer } from './engine';
import { createFsModule } from './fs';
import { createStateOnlyModule } from './stateOnly';
import { createDeviceHttpHandler } from './http';

export interface DeviceServerOptions {
  /** Repository root; app modules read their catalogs relative to it. */
  root: string;
  /** Same value the page uses for `VITE_CDN_BASE` (default `/cdn`). */
  cdnBase: string;
  /**
   * Where `/@app-assets/` is served: `/@app-assets/` at the root, `/sim/@app-assets/`
   * under `VITE_BASE=/sim/`. The page bundle gets this prefix rewritten at build
   * time; URLs the server returns must carry it too.
   */
  appAssetsBase?: string;
  /** Shard number when several server processes run behind one proxy. */
  shard?: number;
}

export function createDeviceServer(options: DeviceServerOptions) {
  // Apps whose state logic stays on the page (createDeviceAppStore syncSetState:
  // WeChat, Alipay, the system apps, ...) are not listed: the session just
  // stores what the page shows, which the state-only module does for any app id.
  const server = new DeviceServer(options.root, options.shard, createStateOnlyModule);
  server.register(createFsModule());
  const appAssetsBase = options.appAssetsBase ?? '/@app-assets/';
  server.register(createRedBookModule({ cdnBase: options.cdnBase, appAssetsBase }));
  server.register(createBilibiliModule({ cdnBase: options.cdnBase }));
  server.register(createRailway12306Module());
  server.register(createRedditModule({ appAssetsBase, cdnBase: options.cdnBase }));
  server.register(createXModule({ cdnBase: options.cdnBase }));
  server.register(createEbayModule());
  server.register(createSpotifyModule());
  return { server, handler: createDeviceHttpHandler(server) };
}
