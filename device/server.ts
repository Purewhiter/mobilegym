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
import { DeviceServer } from './engine';
import { createFsModule } from './fs';
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
  const server = new DeviceServer(options.root, options.shard);
  server.register(createFsModule());
  const appAssetsBase = options.appAssetsBase ?? '/@app-assets/';
  server.register(createRedBookModule({ cdnBase: options.cdnBase, appAssetsBase }));
  server.register(createBilibiliModule({ cdnBase: options.cdnBase }));
  server.register(createRailway12306Module());
  server.register(createRedditModule({ appAssetsBase }));
  server.register(createXModule());
  return { server, handler: createDeviceHttpHandler(server) };
}
