/**
 * public/sdcard scanner, shared by the Vite `/api/sdcard` endpoint, the build
 * manifest, and the device server's file system seed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { SDCARD_DEFAULT_MODIFIED_AT, SDCARD_MODIFIED_AT } from './sdcardTimes';

export interface SdcardFile {
  path: string;
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedAt: number;
}

export interface SdcardDirectory {
  path: string;
  name: string;
  modifiedAt: number;
}

export interface SdcardScan {
  /** Modified time of `/sdcard` itself: its newest direct entry. */
  modifiedAt: number;
  totalFiles: number;
  totalDirectories: number;
  files: SdcardFile[];
  directories: SdcardDirectory[];
}

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.apk': 'application/vnd.android.package-archive',
};

export function sdcardMimeType(fileName: string): string {
  return MIME_TYPES[path.extname(fileName).toLowerCase()] || 'application/octet-stream';
}

/** Returns the directory's modified time: its newest direct entry. */
function scanDirectory(dir: string, basePath: string, out: { files: SdcardFile[]; directories: SdcardDirectory[] }): number {
  if (!fs.existsSync(dir)) return SDCARD_DEFAULT_MODIFIED_AT;
  // readdir order depends on the host file system; sort so the seed tree is the same everywhere.
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  let newest = -Infinity;
  for (const entry of entries) {
    // Keep system dot directories (`.data`, `.cache`); skip OS noise and our manifest.
    if (entry.name === '.DS_Store' || entry.name === 'manifest.json') continue;
    const fullPath = path.join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    let modifiedAt: number;
    if (entry.isDirectory()) {
      const directory: SdcardDirectory = { path: '/sdcard/' + relativePath, name: entry.name, modifiedAt: 0 };
      out.directories.push(directory);
      modifiedAt = directory.modifiedAt = scanDirectory(fullPath, relativePath, out);
    } else if (entry.isFile()) {
      // Fixed times, not the host mtime (see sdcardTimes.ts).
      if (Object.hasOwn(SDCARD_MODIFIED_AT, relativePath)) {
        modifiedAt = SDCARD_MODIFIED_AT[relativePath];
      } else {
        modifiedAt = SDCARD_DEFAULT_MODIFIED_AT;
        console.warn(`[sdcard] ${relativePath} has no fixed time in device/sdcardTimes.ts; using the default`);
      }
      out.files.push({
        path: '/sdcard/' + relativePath,
        uri: '/sdcard/' + relativePath,
        name: entry.name,
        mimeType: sdcardMimeType(entry.name),
        size: fs.statSync(fullPath).size,
        modifiedAt,
      });
    } else {
      continue;
    }
    newest = Math.max(newest, modifiedAt);
  }
  return Number.isFinite(newest) ? newest : SDCARD_DEFAULT_MODIFIED_AT;
}

/** Scan `sdcardDir` (normally `<root>/public/sdcard`). */
export function scanSdcard(sdcardDir: string): SdcardScan {
  const out = { files: [] as SdcardFile[], directories: [] as SdcardDirectory[] };
  const modifiedAt = scanDirectory(sdcardDir, '', out);
  return { modifiedAt, totalFiles: out.files.length, totalDirectories: out.directories.length, ...out };
}
