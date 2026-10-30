/**
 * Standalone device server: the same engine the Vite plugin mounts, as its own
 * Node process, for deployments that serve the built page from nginx
 * (scripts/server/start_nginx_gateway.sh). Serves `/__device/*`.
 *
 *   node device-server.mjs --port 4190 --root <repo> [--cdn-base /cdn] [--base /sim/] [--shard 0]
 *
 * Bundle first (scripts/server/build_device_server.mjs); app modules are
 * plain TypeScript.
 */

import { createServer } from 'node:http';
import { resolve } from 'node:path';

import { createDeviceServer } from './server';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const port = Number(arg('port') ?? 4190);
const host = arg('host') ?? '127.0.0.1';
const root = resolve(arg('root') ?? process.cwd());
const cdnBase = (arg('cdn-base') ?? process.env.VITE_CDN_BASE ?? '/cdn').trim().replace(/\/+$/, '') || '/cdn';
// Same as the page's VITE_BASE: app asset URLs the server returns live under it.
const base = (arg('base') ?? process.env.VITE_BASE ?? '/').trim().replace(/\/+$/, '');
const shardArg = arg('shard');
const shard = shardArg === undefined ? undefined : Number(shardArg);

const { server, handler } = createDeviceServer({ root, cdnBase, appAssetsBase: `${base}/@app-assets/`, shard });

// Load every catalog now, so the first page of a run does not pay for it.
const started = Date.now();
server.warmCatalogs();
console.log(`[device] catalogs ready in ${Date.now() - started}ms (${server.appIds().join(', ')})`);

const PREFIX = '/__device';

createServer((req, res) => {
  const url = req.url ?? '/';
  const rest = url === PREFIX ? '/' : url.startsWith(`${PREFIX}/`) ? url.slice(PREFIX.length) : null;
  const notFound = () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: `not found: ${url}` }));
  };
  if (rest === null) return notFound();
  req.url = rest;
  void handler(req, res, (err?: unknown) => {
    if (!err) return notFound();
    console.error('[device] request failed', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err) }));
  });
}).listen(port, host, () => {
  console.log(`[device] shard ${shard ?? '-'} listening on http://${host}:${port}${PREFIX}`);
});
