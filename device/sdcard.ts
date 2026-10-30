/**
 * public/sdcard scanner, shared by the Vite `/api/sdcard` endpoint, the build
 * manifest, and the device server's file system seed.
 */

import fs from 'node:fs';
import path from 'node:path';

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

function scanDirectory(dir: string, basePath: string, out: { files: SdcardFile[]; directories: SdcardDirectory[] }) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Keep system dot directories (`.data`, `.cache`); skip OS noise and our manifest.
    if (entry.name === '.DS_Store' || entry.name === 'manifest.json') continue;
    const fullPath = path.join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    const stats = fs.statSync(fullPath);
    if (entry.isDirectory()) {
      out.directories.push({ path: '/sdcard/' + relativePath, name: entry.name, modifiedAt: stats.mtimeMs });
      scanDirectory(fullPath, relativePath, out);
    } else if (entry.isFile()) {
      out.files.push({
        path: '/sdcard/' + relativePath,
        uri: '/sdcard/' + relativePath,
        name: entry.name,
        mimeType: sdcardMimeType(entry.name),
        size: stats.size,
        modifiedAt: stats.mtimeMs,
      });
    }
  }
}

/** Scan `sdcardDir` (normally `<root>/public/sdcard`). */
export function scanSdcard(sdcardDir: string): SdcardScan {
  const out = { files: [] as SdcardFile[], directories: [] as SdcardDirectory[] };
  scanDirectory(sdcardDir, '', out);
  return { totalFiles: out.files.length, totalDirectories: out.directories.length, ...out };
}
