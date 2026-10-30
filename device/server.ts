/**
 * Device server entry: builds the engine with every app module and returns the
 * `/__device` HTTP handler. Loaded by the Vite plugin (dev: ssrLoadModule,
 * preview: esbuild bundle), so app modules stay plain TypeScript.
 */

import { createBilibiliModule } from '../apps/Bilibili/device';
import { createRedBookModule } from '../apps/RedBook/device';
import { DeviceServer } from './engine';
import { createFsModule } from './fs';
import { createDeviceHttpHandler } from './http';

export interface DeviceServerOptions {
  /** Repository root; app modules read their catalogs relative to it. */
  root: string;
  /** Same value the page uses for `VITE_CDN_BASE` (default `/cdn`). */
  cdnBase: string;
}

export function createDeviceServer(options: DeviceServerOptions) {
  const server = new DeviceServer(options.root);
  server.register(createFsModule());
  server.register(createRedBookModule({ cdnBase: options.cdnBase }));
  server.register(createBilibiliModule({ cdnBase: options.cdnBase }));
  return { server, handler: createDeviceHttpHandler(server) };
}
