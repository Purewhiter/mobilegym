#!/usr/bin/env node
/**
 * Bundle the standalone device server (device/main.ts) into one ESM file.
 *
 *   node scripts/server/build_device_server.mjs [outfile]
 *
 * Default output: .nginx/device-server.mjs (used by start_nginx_gateway.sh).
 */

import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.resolve(process.argv[2] ?? path.join(root, '.nginx', 'device-server.mjs'));

await build({
  entryPoints: [path.join(root, 'device', 'main.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'warning',
});
console.log(`[build] device server -> ${path.relative(root, outfile)}`);
