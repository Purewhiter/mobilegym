/**
 * HTTP surface of the device server, mounted at `/__device` by the Vite plugin
 * (dev and preview) so the phone page and the Python bench talk to the same
 * process that serves the bundle.
 *
 *   GET    /health
 *   POST   /sessions                                  -> { id }
 *   DELETE /sessions/:sid
 *   GET    /sessions/:sid/apps/:app/state              -> { initialized, version, state }
 *   PUT    /sessions/:sid/apps/:app/state   {state}    -> { version, state }
 *   POST   /sessions/:sid/apps/:app/commands/:name {args, now} -> { result, version, state }
 *   POST   /sessions/:sid/apps/:app/queries/:name {args}       -> { result }
 *   GET    /sessions/:sid/apps/:app/records/:coll/:id  -> { record }
 *   GET    /sessions/:sid/apps/:app/overlay/:coll      -> { overlay }
 *   PUT    /sessions/:sid/blobs   (raw body)          -> { id, size, type }
 *   GET    /sessions/:sid/blobs/:id                   -> raw bytes
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { DeviceError, type DeviceServer } from './engine';

type Next = (err?: unknown) => void;

const MAX_JSON_BYTES = 32 * 1024 * 1024;
const MAX_BLOB_BYTES = 128 * 1024 * 1024;

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > limit) throw new DeviceError(413, `body exceeds ${limit} bytes`);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) {
      req.destroy();
      throw new DeviceError(413, `body exceeds ${limit} bytes`);
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks, size);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readBody(req, MAX_JSON_BYTES);
  if (!body.length) return {};
  const parsed = JSON.parse(body.toString('utf8'));
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

export function createDeviceHttpHandler(server: DeviceServer) {
  return async (req: IncomingMessage, res: ServerResponse, next: Next): Promise<void> => {
    // Mounted under /__device, so req.url is the remainder ("/sessions/...").
    const url = new URL(req.url ?? '/', 'http://device.local');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const method = req.method ?? 'GET';
    try {
      if (parts[0] === 'health' && method === 'GET') {
        return send(res, 200, { ok: true, apps: server.appIds(), sessions: server.sessionCount() });
      }
      if (parts[0] !== 'sessions') return next();

      if (parts.length === 1 && method === 'POST') {
        return send(res, 200, { id: server.createSession().id });
      }

      const session = server.getSession(parts[1] ?? '');
      if (!session) throw new DeviceError(404, `unknown session ${parts[1]}`);

      if (parts.length === 2 && method === 'DELETE') {
        server.deleteSession(session.id);
        return send(res, 200, { ok: true });
      }
      if (parts[2] === 'blobs') {
        if (parts.length === 3 && method === 'PUT') {
          const data = await readBody(req, MAX_BLOB_BYTES);
          const type = String(req.headers['content-type'] || 'application/octet-stream');
          return send(res, 200, { id: session.putBlob(data, type), size: data.length, type });
        }
        const blob = parts[3] ? session.blobs.get(parts[3]) : undefined;
        if (parts.length === 4 && method === 'GET') {
          if (!blob) throw new DeviceError(404, `unknown blob ${parts[3]}`);
          res.statusCode = 200;
          res.setHeader('Content-Type', blob.type);
          res.setHeader('Content-Length', String(blob.data.length));
          // Blob ids are never reused within a session, so the bytes never change.
          res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
          res.end(blob.data);
          return;
        }
        return next();
      }
      if (parts[2] !== 'apps' || !parts[3]) return next();
      const appId = parts[3];
      const kind = parts[4];

      if (kind === 'state' && method === 'GET') {
        if (!server.isInitialized(session, appId)) {
          return send(res, 200, { initialized: false, version: session.version, state: null });
        }
        return send(res, 200, {
          initialized: true,
          version: session.version,
          state: server.exportState(session, appId),
        });
      }
      if (kind === 'state' && method === 'PUT') {
        const body = await readJson(req);
        const state = server.importState(session, appId, body.state);
        return send(res, 200, { version: session.version, state });
      }
      if (kind === 'commands' && parts[5] && method === 'POST') {
        const body = await readJson(req);
        const args = Array.isArray(body.args) ? body.args : [];
        const now = typeof body.now === 'number' ? body.now : Date.now();
        return send(res, 200, server.runCommand(session, appId, parts[5], args, { now }));
      }
      if (kind === 'queries' && parts[5] && method === 'POST') {
        const body = await readJson(req);
        const args = (body.args && typeof body.args === 'object' ? body.args : {}) as Record<string, unknown>;
        return send(res, 200, { result: server.runQuery(session, appId, parts[5], args) });
      }
      if (kind === 'records' && parts[5] && parts[6] && method === 'GET') {
        return send(res, 200, { record: server.getRecord(session, appId, parts[5], parts[6]) ?? null });
      }
      if (kind === 'overlay' && parts[5] && method === 'GET') {
        return send(res, 200, { overlay: server.overlay(session, appId, parts[5]) });
      }
      return next();
    } catch (err) {
      const status = err instanceof DeviceError ? err.status : 500;
      const message = err instanceof Error ? err.message : String(err);
      if (status === 500) console.error('[device] request failed:', method, url.pathname, err);
      return send(res, status, { error: message });
    }
  };
}
