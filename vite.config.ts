
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { execFileSync, spawn, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Vite plugin to log HTTP access requests
 * Works for both dev server (npm run dev) and preview server (npm run preview)
 */
function accessLogPlugin() {
  const logMiddleware = (req, res, next) => {
    const start = Date.now();
    const originalEnd = res.end;
    
    res.end = function(...args) {
      const duration = Date.now() - start;
      const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      const status = res.statusCode;
      const method = req.method || 'GET';
      const url = req.url || '/';
      
      const statusColor = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${time} \x1b[36m${method}\x1b[0m ${url} ${statusColor}${status}\x1b[0m ${duration}ms`);
      
      return originalEnd.apply(this, args);
    };
    
    next();
  };

  return {
    name: 'access-log',
    configureServer(server) {
      server.middlewares.use(logMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(logMiddleware);
    }
  };
}

/**
 * Vite plugin to provide /api/list-public-files endpoint
 * This allows HTML viewers to auto-discover data files in the public directory
 */
function listPublicFilesPlugin() {
  return {
    name: 'list-public-files',
    configureServer(server) {
      server.middlewares.use('/api/list-public-files', (req, res) => {
        const publicDir = path.resolve(__dirname, 'public');
        
        try {
          const files = fs.readdirSync(publicDir);
          
          // Categorize files based on naming patterns
          const actionTasks: { id: string; label: string; file: string }[] = [];
          const navGraphs: { id: string; label: string; file: string }[] = [];

          for (const file of files) {
            const filePath = path.join(publicDir, file);
            const stat = fs.statSync(filePath);
            if (!stat.isFile()) continue;

            const lowerFile = file.toLowerCase();

            // Action tasks: *_action_tasks*.json or *_action_tasks*.jsonl
            if (lowerFile.includes('action_tasks') && (file.endsWith('.json') || file.endsWith('.jsonl'))) {
              actionTasks.push({
                id: file.replace(/\.[^.]+$/, ''),
                label: generateLabel(file, 'action_tasks'),
                file: `/${file}`,
              });
            }
            // Nav graphs: *_nav_graph*.json OR *_data_graph*.json (both use same format)
            else if ((lowerFile.includes('nav_graph') || lowerFile.includes('data_graph')) && file.endsWith('.json')) {
              navGraphs.push({
                id: file.replace(/\.[^.]+$/, ''),
                label: generateLabel(file, lowerFile.includes('data_graph') ? 'data_graph' : 'nav_graph'),
                file: `/${file}`,
              });
            }
          }

          // Sort by filename
          const sortByFile = (a, b) => a.file.localeCompare(b.file);
          actionTasks.sort(sortByFile);
          navGraphs.sort(sortByFile);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            action_tasks: actionTasks,
            nav_graphs: navGraphs,
          }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
    }
  };
}

/**
 * Vite plugin for file system scanning with caching
 * Provides /api/sdcard endpoint - scans only when files change
 */
function fileSystemPlugin() {
  const SDCARD_DIR = path.resolve(__dirname, 'public/sdcard');
  
  // 缓存扫描结果
  let cachedResult: { 
    totalFiles: number; 
    totalDirectories: number;
    files: any[]; 
    directories: any[];
  } | null = null;
  let cacheValid = false;
  
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
  
  function getMimeType(fileName: string) {
    const ext = path.extname(fileName).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
  }
  
  function scanDirectory(dir: string, basePath = ''): { files: any[]; directories: any[] } {
    const result = { files: [] as any[], directories: [] as any[] };
    if (!fs.existsSync(dir)) return result;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      
      // Do not skip system dot directories (e.g. `.data`, `.cache`).
      // Only skip known noisy OS/generated files.
      if (entry.name === '.DS_Store' || entry.name === 'manifest.json') continue;
      
      if (entry.isDirectory()) {
        const stats = fs.statSync(fullPath);
        // 添加目录本身
        result.directories.push({
          path: '/sdcard/' + relativePath,
          name: entry.name,
          modifiedAt: stats.mtimeMs,
        });
        // 递归扫描子目录
        const sub = scanDirectory(fullPath, relativePath);
        result.files.push(...sub.files);
        result.directories.push(...sub.directories);
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        result.files.push({
          path: '/sdcard/' + relativePath,
          uri: '/sdcard/' + relativePath,
          name: entry.name,
          mimeType: getMimeType(entry.name),
          size: stats.size,
          modifiedAt: stats.mtimeMs,
        });
      }
    }
    return result;
  }
  
  function refreshCache() {
    if (!fs.existsSync(SDCARD_DIR)) {
      fs.mkdirSync(SDCARD_DIR, { recursive: true });
    }
    const { files, directories } = scanDirectory(SDCARD_DIR);
    cachedResult = { 
      totalFiles: files.length, 
      totalDirectories: directories.length,
      files, 
      directories 
    };
    cacheValid = true;
    console.log(`[sdcard] Scanned ${files.length} files, ${directories.length} directories`);
  }
  
  return {
    name: 'filesystem-api',

    // Build: emit static manifest so FileSystemService can discover files without /api/sdcard
    generateBundle() {
      const { files, directories } = scanDirectory(SDCARD_DIR);
      const manifest = {
        totalFiles: files.length,
        totalDirectories: directories.length,
        files,
        directories,
      };
      (this as any).emitFile({
        type: 'asset',
        fileName: 'sdcard/manifest.json',
        source: JSON.stringify(manifest),
      });
      console.log(`[sdcard] Emitted manifest.json (${files.length} files, ${directories.length} dirs)`);
    },

    configureServer(server) {
      // 初始扫描
      refreshCache();
      
      // 监视文件变化，使缓存失效
      server.watcher.add(SDCARD_DIR);
      server.watcher.on('all', (event, filePath) => {
        if (filePath.startsWith(SDCARD_DIR)) {
          const basename = path.basename(filePath);
          // Only skip known OS-generated noise files, not system dot-directories like .data
          if (basename === '.DS_Store' || basename === 'manifest.json') return;
          cacheValid = false;
          console.log(`[sdcard] ${event}: ${path.relative(SDCARD_DIR, filePath)}`);
        }
      });
      
      // API 端点 - 使用缓存
      server.middlewares.use('/api/sdcard', (_req, res) => {
        try {
          // 只在缓存失效时重新扫描
          if (!cacheValid) {
            refreshCache();
          }
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(cachedResult));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
    },
  };
}

/**
 * Vite plugin to serve runs directory for run_explorer.html
 * Provides /api/runs endpoints to list and read run data
 */
function runsExplorerPlugin() {
  const RUNS_DIR = path.resolve(__dirname, 'runs');
  
  return {
    name: 'runs-explorer-api',
    
    configureServer(server) {
      // GET /api/runs - List all run directories
      server.middlewares.use('/api/runs', (req, res, next) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const pathParts = url.pathname.split('/').filter(Boolean);
        
        const isRunDir = (dir: string) => {
          return fs.existsSync(path.join(dir, 'meta.json'))
            || fs.existsSync(path.join(dir, 'results.jsonl'))
            || fs.existsSync(path.join(dir, 'trajectory'));
        };
        const isDirEntry = (e: fs.Dirent) => e.isDirectory() || e.isSymbolicLink();

        // /api/runs - list runs (supports nested dirs like agent/timestamp)
        if (pathParts.length === 0) {
          try {
            if (!fs.existsSync(RUNS_DIR)) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ runs: [] }));
              return;
            }



            const runs: string[] = [];
            const topEntries = fs.readdirSync(RUNS_DIR, { withFileTypes: true });
            for (const e of topEntries) {
              if (!isDirEntry(e)) continue;
              const topDir = path.join(RUNS_DIR, e.name);
              if (isRunDir(topDir)) {
                // Flat: runs/<run_name>/meta.json
                runs.push(e.name);
              } else {
                // Nested: runs/<agent>/<timestamp>/meta.json
                const subEntries = fs.readdirSync(topDir, { withFileTypes: true });
                for (const sub of subEntries) {
                  if (!isDirEntry(sub)) continue;
                  if (isRunDir(path.join(topDir, sub.name))) {
                    runs.push(`${e.name}/${sub.name}`);
                  }
                }
              }
            }
            runs.sort((a, b) => b.localeCompare(a));
            
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ runs }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
          return;
        }
        
        // /api/runs/:runName/... - access run files
        // runName can be 1-part (flat) or 2-part (nested: agent/timestamp)

        
        let runDepth = 1; // how many pathParts make up the runName
        let runDir = path.join(RUNS_DIR, pathParts[0]);
        
        // Try nested: pathParts[0]/pathParts[1]
        if (pathParts.length >= 2 && !isRunDir(runDir)) {
          const nested = path.join(RUNS_DIR, pathParts[0], pathParts[1]);
          if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
            runDir = nested;
            runDepth = 2;
          }
        }
        
        const runName = pathParts.slice(0, runDepth).join('/');
        
        // Security: prevent path traversal
        if (!runDir.startsWith(RUNS_DIR) || runName.includes('..')) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
        
        if (!fs.existsSync(runDir)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Run not found' }));
          return;
        }
        
        const subPath = pathParts.slice(runDepth).join('/');
        
        // /api/runs/:runName - list run contents (special endpoint)
        if (!subPath) {
          try {
            const entries = fs.readdirSync(runDir, { withFileTypes: true });
            const files = entries.filter(e => e.isFile()).map(e => e.name);
            const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ files, directories: dirs }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
          return;
        }
        
        // /api/runs/:runName/trajectory - list task directories
        if (subPath === 'trajectory') {
          const trajDir = path.join(runDir, 'trajectory');
          if (!fs.existsSync(trajDir)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ tasks: [] }));
            return;
          }
          
          try {
            const entries = fs.readdirSync(trajDir, { withFileTypes: true });
            const tasks = entries.filter(e => e.isDirectory()).map(e => e.name);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ tasks }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
          return;
        }
        
        // /api/runs/:runName/trajectory/:taskDir - list task contents
        const subParts = subPath.split('/');
        if (subParts[0] === 'trajectory' && subParts.length === 2) {
          const taskDir = path.join(runDir, subPath);
          if (!taskDir.startsWith(runDir)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: 'Forbidden' }));
            return;
          }
          
          if (!fs.existsSync(taskDir)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Task not found' }));
            return;
          }
          
          try {
            const entries = fs.readdirSync(taskDir);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ files: entries }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
          return;
        }
        
        // /api/runs/:runName/* - serve file
        const filePath = path.join(runDir, subPath);
        
        // Security: prevent path traversal
        if (!filePath.startsWith(runDir)) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
        
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'File not found' }));
          return;
        }
        
        // Serve file with appropriate content type
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.json': 'application/json',
          '.jsonl': 'application/x-ndjson',
          '.txt': 'text/plain; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
        };
        
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        
        const content = fs.readFileSync(filePath);
        res.end(content);
      });
    },
  };
}

/**
 * 让 app 自带的静态资源在 dev/build 下都能通过稳定 URL 访问。
 *
 * URL:
 * - /@app-assets/<AppName>/<path>
 *   → 文件: apps/<AppName>/assets/<path>
 * - /@app-assets/<AppName>/wmr/<path>
 *   → 文件: apps/<AppName>/wmr/<path>
 *
 * Dev:  中间件直接伺服文件
 * Build: generateBundle 把文件拷贝到 dist/@app-assets/
 */
function serveAppAssetsPlugin() {
  const MIME: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.json': 'application/json',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  };

  const PREFIX = '/@app-assets/';
  let resolvedBase = '/';

  function walkDir(dir: string, base: string, cb: (filePath: string, relPath: string) => void) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walkDir(full, rel, cb);
      else if (entry.isFile()) cb(full, rel);
    }
  }

  function resolveAppStaticFile(appName: string, relPath: string): string | null {
    for (const base of ['apps', 'system']) {
      const appRoot = path.join(__dirname, base, appName);
      const target = relPath.startsWith('wmr/')
        ? path.join(appRoot, 'wmr', relPath.slice('wmr/'.length))
        : path.join(appRoot, 'assets', relPath);
      if (target.startsWith(appRoot) && fs.existsSync(target)) return target;
    }
    return null;
  }

  return {
    name: 'serve-app-assets',

    configResolved(config: { base: string }) {
      resolvedBase = config.base || '/';
    },

    // ── Dev: 中间件伺服 ──
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url;
        if (!url || !url.startsWith(PREFIX)) return next();

        const relPath = decodeURIComponent(url.slice(PREFIX.length).split('?')[0]);
        if (relPath.includes('..') || relPath.startsWith('/')) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        const slashIdx = relPath.indexOf('/');
        if (slashIdx <= 0) return next();
        const appName = relPath.slice(0, slashIdx);
        const assetRel = relPath.slice(slashIdx + 1);

        const filePath = resolveAppStaticFile(appName, assetRel);
        if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next();

        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'max-age=31536000, immutable');
        fs.createReadStream(filePath).pipe(res);
      });
    },

    // ── Build: 拷贝到 dist ──
    generateBundle(_options: unknown, bundle: Record<string, any>) {
      // 子路径部署（base=/sim/）时，代码里硬编码的 `/@app-assets/` 绝对前缀
      // 取不到（实际在 <base>@app-assets/）。base !== '/' 时把产物里的该前缀
      // 统一改写为带 base 的版本（base='/' 为 no-op，根部署/dev 行为不变）。
      if (resolvedBase !== '/') {
        const want = `${resolvedBase}@app-assets/`;
        for (const file of Object.values(bundle)) {
          if (file.type === 'chunk' && typeof file.code === 'string') {
            file.code = file.code.split(PREFIX).join(want);
          } else if (file.type === 'asset' && typeof file.source === 'string') {
            file.source = file.source.split(PREFIX).join(want);
          }
        }
      }

      for (const base of ['apps', 'system']) {
        const baseDir = path.join(__dirname, base);
        if (!fs.existsSync(baseDir)) continue;
        for (const app of fs.readdirSync(baseDir, { withFileTypes: true })) {
          if (!app.isDirectory()) continue;
          const assetsDir = path.join(baseDir, app.name, 'assets');
          if (fs.existsSync(assetsDir)) {
            walkDir(assetsDir, '', (filePath, relPath) => {
              (this as any).emitFile({
                type: 'asset',
                fileName: `@app-assets/${app.name}/${relPath}`,
                source: fs.readFileSync(filePath),
              });
            });
          }

          const wmrDir = path.join(baseDir, app.name, 'wmr');
          if (fs.existsSync(wmrDir)) {
            walkDir(wmrDir, '', (filePath, relPath) => {
              (this as any).emitFile({
                type: 'asset',
                fileName: `@app-assets/${app.name}/wmr/${relPath}`,
                source: fs.readFileSync(filePath),
              });
            });
          }
        }
      }
    },
  };
}

/**
 * Dev 环境下把 /cdn/ 映射到仓库根的 mobilegym-data/（gitignored），
 * 与生产 nginx 的 alias 行为一致；生产 nginx.source.conf 里的 location /cdn/ 等价。
 */
function serveCdnPlugin() {
  const MIME: Record<string, string> = {
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.json': 'application/json',
  };
  const CDN_ROOT = path.resolve(__dirname, 'mobilegym-data');
  const serveCdnMiddleware = (req, res, next) => {
    const url = req.url || '/';
    const rel = decodeURIComponent(url.split('?')[0]).replace(/^\/+/, '');
    if (!rel || rel.includes('..')) return next();

    const filePath = path.join(CDN_ROOT, rel);
    if (!filePath.startsWith(CDN_ROOT) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return next();
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    fs.createReadStream(filePath).pipe(res);
  };

  return {
    name: 'serve-cdn',
    configureServer(server) {
      server.middlewares.use('/cdn/', serveCdnMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/cdn/', serveCdnMiddleware);
    },
  };
}

/**
 * 把 apps/Map/sw/ 暴露到根路径：
 *   /map-sw.js         → apps/Map/sw/map-sw.js
 *   /map-cache/<file>  → apps/Map/sw/<file>
 * Service Worker 注册要求 SW 文件能拿到根 scope，所以这两个路径必须在站点根。
 * 文件源码留在 Map App 内部，避免污染 public/。
 *
 * 生产 build 时把整目录复制到 dist/，preview/线上行为与 dev 一致。
 */
function mapServiceWorkerPlugin() {
  const SW_ROOT = path.resolve(__dirname, 'apps/Map/sw');
  const MIME: Record<string, string> = {
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.css': 'text/css',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.bin': 'application/octet-stream',
  };

  const sendFile = (res: any, filePath: string) => {
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Service-Worker-Allowed', '/');
    fs.createReadStream(filePath).pipe(res);
  };

  const swMiddleware = (req: any, res: any, next: any) => {
    if (req.url && req.url.split('?')[0] === '/map-sw.js') {
      const filePath = path.join(SW_ROOT, 'map-sw.js');
      if (fs.existsSync(filePath)) return sendFile(res, filePath);
    }
    next();
  };

  const cacheMiddleware = (req: any, res: any, next: any) => {
    const url = req.url || '/';
    const rel = decodeURIComponent(url.split('?')[0]).replace(/^\/map-cache\//, '');
    if (!rel || rel.includes('..')) return next();
    const filePath = path.join(SW_ROOT, rel);
    if (!filePath.startsWith(SW_ROOT) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      // 显式 404，避免落到 Vite 的 SPA fallback 把 index.html 当成缓存文件返回
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('not found');
      return;
    }
    sendFile(res, filePath);
  };

  function copyDirRecursive(src: string, dst: string) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      const s = path.join(src, name);
      const d = path.join(dst, name);
      const stat = fs.statSync(s);
      if (stat.isDirectory()) copyDirRecursive(s, d);
      else fs.copyFileSync(s, d);
    }
  }

  return {
    name: 'map-service-worker',
    configureServer(server: any) {
      server.middlewares.use(swMiddleware);
      server.middlewares.use('/map-cache/', cacheMiddleware);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(swMiddleware);
      server.middlewares.use('/map-cache/', cacheMiddleware);
    },
    closeBundle() {
      // 生产 build：把 SW 文件复制到 dist 根
      const outDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(outDir)) return;
      const swSrc = path.join(SW_ROOT, 'map-sw.js');
      if (fs.existsSync(swSrc)) fs.copyFileSync(swSrc, path.join(outDir, 'map-sw.js'));
      const manifestSrc = path.join(SW_ROOT, 'manifest.json');
      const filesSrc = path.join(SW_ROOT, 'files');
      const cacheDst = path.join(outDir, 'map-cache');
      fs.mkdirSync(cacheDst, { recursive: true });
      if (fs.existsSync(manifestSrc)) fs.copyFileSync(manifestSrc, path.join(cacheDst, 'manifest.json'));
      if (fs.existsSync(filesSrc)) copyDirRecursive(filesSrc, path.join(cacheDst, 'files'));
    },
  };
}

/**
 * 用 Tailwind CLI (Rust 原生) 代替 JS 插件生成 CSS。
 * JS 插件需 ~40 秒，CLI 只需 ~1 秒。
 *
 * Dev:  先同步 build 一次确保 index.css 存在，再后台 --watch
 * Build: 同步 build 一次即可
 */
function tailwindCliPlugin() {
  const bin = path.join(__dirname, 'node_modules', '.bin', 'tailwindcss');
  const input = path.join(__dirname, 'app.css');
  const output = path.join(__dirname, 'index.css');
  const isWin = process.platform === 'win32';
  let child: ChildProcess | null = null;
  let stopping = false;
  let restartCount = 0;
  let lastStartTime = 0;

  const MAX_FAST_RESTARTS = 5;
  const FAST_EXIT_THRESHOLD_MS = 3000;

  function buildSync() {
    execFileSync(bin, ['-i', input, '-o', output], {
      cwd: __dirname,
      stdio: 'pipe',
      shell: isWin,
    });
  }

  function startWatch() {
    if (stopping) return;

    const now = Date.now();
    if (now - lastStartTime < FAST_EXIT_THRESHOLD_MS) {
      restartCount++;
    } else {
      restartCount = 0;
    }

    if (restartCount >= MAX_FAST_RESTARTS) {
      console.error(
        `\x1b[31m[tailwind] ✗ watcher crashed ${MAX_FAST_RESTARTS} times in a row, giving up.\x1b[0m\n` +
        `  CSS will NOT auto-update. Restart the dev server to retry.`
      );
      return;
    }

    lastStartTime = now;
    child = spawn(bin, ['-i', input, '-o', output, '--watch=always'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
    });

    const pid = child.pid;
    console.log(`\x1b[36m[tailwind]\x1b[0m watcher started (pid ${pid})`);

    child.stderr?.on('data', (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg && !msg.includes('Done in')) console.log(`\x1b[36m[tailwind]\x1b[0m ${msg}`);
    });

    child.on('exit', (code, signal) => {
      child = null;
      if (stopping) return;
      const delay = Math.min(1000 * 2 ** restartCount, 10000);
      console.warn(
        `\x1b[33m[tailwind] ⚠ watcher exited unexpectedly\x1b[0m (code=${code}, signal=${signal}), restarting in ${delay}ms...`
      );
      setTimeout(startWatch, delay);
    });

    child.on('error', (err) => {
      console.error(`\x1b[31m[tailwind] ✗ watcher error:\x1b[0m`, err.message);
    });
  }

  function stopWatch() {
    stopping = true;
    if (!child) return;
    child.kill();
    child = null;
  }

  return {
    name: 'tailwind-cli',

    buildStart() {
      buildSync();
    },

    configureServer(server: any) {
      buildSync();
      startWatch();
      server.httpServer?.on('close', stopWatch);
    },
  };
}

/**
 * Unified API Gateway (single same-origin entry)
 *
 * Motivation:
 * - Avoid sprinkling many bespoke /api/* proxy middlewares as apps grow
 * - Provide one stable entry for ALL apps: /api/gw/<service>/<path...>
 *
 * How to extend:
 * - Add/adjust service config in this function (no new middleware needed)
 */
function apiGatewayPlugin(mode: string) {
  const env = loadEnv(mode, process.cwd(), '');

  const cfg = {
    gateway: {
      // Optional allowlist for generic fetch proxy (comma separated hosts). Empty = allow all.
      allowHosts: (env.VITE_GW_ALLOW_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean),
    },
  } as const;

  const isAllowedHost = (host: string) => {
    const allow = cfg.gateway.allowHosts;
    if (!allow.length) return true; // default: allow all (dev tool)
    return allow.includes(host);
  };

  const readJsonBody = (req): Promise<any> =>
    new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => {
        if (!data) return resolve({});
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });

  // ---------------- Cookie jar (server-side, per session) ----------------
  type CookieEntry = { value: string; expiresAt?: number };
  type CookieJar = Map<string, Map<string, CookieEntry>>; // host -> name -> entry
  const COOKIE_JARS: Map<string, CookieJar> = (globalThis as any).__GW_COOKIE_JARS__ || new Map();
  (globalThis as any).__GW_COOKIE_JARS__ = COOKIE_JARS;

  // ---------------- Proxy 404 cache (avoid repeated upstream calls for dead URLs) ----------------
  const PROXY_404_CACHE_MAX = 500;
  const PROXY_404_TTL_MS = 5 * 60 * 1000; // 5 min
  const PROXY_404_CACHE: Map<string, number> = (globalThis as any).__GW_PROXY_404_CACHE__ || new Map();
  (globalThis as any).__GW_PROXY_404_CACHE__ = PROXY_404_CACHE;

  const proxy404CacheGet = (url: string): boolean => {
    const expiresAt = PROXY_404_CACHE.get(url);
    if (expiresAt == null) return false;
    if (Date.now() > expiresAt) {
      PROXY_404_CACHE.delete(url);
      return false;
    }
    return true;
  };

  const proxy404CacheSet = (url: string) => {
    PROXY_404_CACHE.set(url, Date.now() + PROXY_404_TTL_MS);
    if (PROXY_404_CACHE.size > PROXY_404_CACHE_MAX) {
      const now = Date.now();
      for (const [k, exp] of PROXY_404_CACHE.entries()) {
        if (exp <= now) PROXY_404_CACHE.delete(k);
      }
    }
  };

  const getSessionId = (req) => {
    const h = req.headers?.['x-gw-session'];
    if (!h) return 'anon';
    if (Array.isArray(h)) return h[0] || 'anon';
    return String(h);
  };

  const getJar = (sessionId: string): CookieJar => {
    let jar = COOKIE_JARS.get(sessionId);
    if (!jar) {
      jar = new Map();
      COOKIE_JARS.set(sessionId, jar);
    }
    return jar;
  };

  const parseSetCookie = (setCookie: string): { name: string; value: string; expiresAt?: number } | null => {
    const parts = setCookie.split(';').map(s => s.trim());
    const [nv, ...attrs] = parts;
    const eq = nv.indexOf('=');
    if (eq <= 0) return null;
    const name = nv.slice(0, eq);
    const value = nv.slice(eq + 1);
    let expiresAt: number | undefined;
    for (const a of attrs) {
      const [k, v] = a.split('=');
      const key = (k || '').toLowerCase();
      const val = (v || '').trim();
      if (key === 'max-age') {
        const sec = Number(val);
        if (!Number.isNaN(sec)) expiresAt = Date.now() + sec * 1000;
      } else if (key === 'expires') {
        const t = Date.parse(val);
        if (!Number.isNaN(t)) expiresAt = t;
      }
    }
    return { name, value, expiresAt };
  };

  const storeCookies = (sessionId: string, host: string, setCookies: string[]) => {
    if (!setCookies?.length) return;
    const jar = getJar(sessionId);
    let hostMap = jar.get(host);
    if (!hostMap) {
      hostMap = new Map();
      jar.set(host, hostMap);
    }
    for (const sc of setCookies) {
      const parsed = parseSetCookie(sc);
      if (!parsed) continue;
      // Expired -> delete
      if (parsed.expiresAt != null && parsed.expiresAt <= Date.now()) {
        hostMap.delete(parsed.name);
        continue;
      }
      hostMap.set(parsed.name, { value: parsed.value, expiresAt: parsed.expiresAt });
    }
  };

  const buildCookieHeader = (sessionId: string, host: string): string | undefined => {
    const jar = getJar(sessionId);
    const hostMap = jar.get(host);
    if (!hostMap) return undefined;
    const now = Date.now();
    const pairs: string[] = [];
    for (const [name, entry] of hostMap.entries()) {
      if (entry.expiresAt != null && entry.expiresAt <= now) {
        hostMap.delete(name);
        continue;
      }
      pairs.push(`${name}=${entry.value}`);
    }
    return pairs.length ? pairs.join('; ') : undefined;
  };

  const forwardHeaders = (upstreamHeaders: Headers, res, allowList?: string[]) => {
    // Forward a safe subset of headers. (Hop-by-hop headers must not be forwarded.)
    const allow = allowList ?? [
      'content-type',
      'content-length',
      'content-encoding',
      'cache-control',
      'expires',
      'etag',
      'last-modified',
      'vary',
    ];
    for (const k of allow) {
      const v = upstreamHeaders.get(k);
      if (v) res.setHeader(k, v);
    }
  };

  const handler = async (req, res) => {
    try {
      const incoming = new URL(req.url || '/', `http://${req.headers.host}`);
      /**
       * Path parsing note (IMPORTANT):
       * When mounted via `server.middlewares.use('/api/gw', handler)`, Connect will strip the mount prefix.
       * So `req.url` becomes `/fetch` instead of `/api/gw/fetch`.
       * We support BOTH forms:
       * - /api/gw/<service>/<rest...>
       * - /<service>/<rest...>          (prefix stripped)
       */
      const parts = incoming.pathname.split('/').filter(Boolean);
      const hasFullPrefix = parts[0] === 'api' && parts[1] === 'gw';
      const service = hasFullPrefix ? parts[2] : parts[0];
      const restPath = '/' + (hasFullPrefix ? parts.slice(3) : parts.slice(1)).join('/');

      if (!service) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing service in path: /api/gw/<service>/...' }));
        return;
      }

      // ---- Generic fetch proxy: POST /api/gw/fetch  { url, method, headers, body }
      // This is the universal escape hatch for CORS. Apps should prefer this via os/NetworkService.
      if (service === 'fetch') {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
          return;
        }
        const payload = await readJsonBody(req);
        const target = payload?.url;
        if (!target || typeof target !== 'string') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing payload.url' }));
          return;
        }
        const u = new URL(target);
        if (!(u.protocol === 'https:' || u.protocol === 'http:')) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Only http/https protocols are allowed' }));
          return;
        }
        if (!isAllowedHost(u.host)) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Host not allowed: ${u.host}` }));
          return;
        }

        const sessionId = getSessionId(req);
        const method = (payload.method || 'GET').toUpperCase();
        const headers = payload.headers && typeof payload.headers === 'object' ? payload.headers : undefined;
        const body = typeof payload.body === 'string' ? payload.body : undefined;

        // Stream proxy to avoid buffering large responses in memory.
        const controller = new AbortController();
        const abortUpstream = () => {
          try {
            controller.abort();
          } catch {
            // ignore
          }
        };
        res.on('close', abortUpstream);
        res.on('error', abortUpstream);

        let upstreamResp: Response;
        try {
          // Avoid upstream compression to prevent content-encoding/body mismatch.
          // (Some fetch implementations may transparently decompress.)
          const upstreamHeaders = { ...(headers || {}) };
          if (!('accept-encoding' in Object.keys(upstreamHeaders).reduce((m, k) => ((m[k.toLowerCase()] = upstreamHeaders[k]), m), {} as any))) {
            upstreamHeaders['accept-encoding'] = 'identity';
          }
          // Cookie jar (only if caller didn't explicitly set Cookie)
          const hasCookie = Object.keys(upstreamHeaders).some(k => k.toLowerCase() === 'cookie');
          if (!hasCookie) {
            const cookie = buildCookieHeader(sessionId, u.host);
            if (cookie) upstreamHeaders['cookie'] = cookie;
          }

          upstreamResp = await fetch(u.toString(), {
            method,
            headers: upstreamHeaders,
            body,
            signal: controller.signal,
          });
        } catch (e: any) {
          // Client closed early -> fetch may reject with AbortError, treat as normal.
          const name = e?.name || '';
          if (name === 'AbortError' || controller.signal.aborted) {
            if (!res.writableEnded) res.end();
            return;
          }
          throw e;
        }

        res.statusCode = upstreamResp.status;
        // IMPORTANT:
        // Do NOT forward content-encoding/content-length here.
        // Upstream fetch may transparently decompress while keeping headers,
        // which would make browsers fail with "Failed to fetch".
        forwardHeaders(upstreamResp.headers, res, [
          'content-type',
          'cache-control',
          'expires',
          'etag',
          'last-modified',
          'vary',
        ]);

        if (!upstreamResp.body) {
          res.end();
          return;
        }

        // Store Set-Cookie into jar (Node fetch provides getSetCookie in recent versions)
        const getSetCookie = (upstreamResp.headers as any).getSetCookie?.bind(upstreamResp.headers);
        const setCookies: string[] = typeof getSetCookie === 'function' ? getSetCookie() : [];
        if (setCookies?.length) storeCookies(sessionId, u.host, setCookies);

        // Node 18+ supports web streams; convert to Node stream for piping.
        const nodeStream = Readable.fromWeb(upstreamResp.body as any);
        nodeStream.on('error', (e: any) => {
          // AbortError is expected when client disconnects; don't crash dev server.
          const name = e?.name || '';
          if (name === 'AbortError' || controller.signal.aborted) return;
          console.warn('[gw/fetch] stream error:', e?.message || e);
        });
        res.on('close', () => {
          // Ensure stream is destroyed to stop work.
          try {
            nodeStream.destroy();
          } catch {
            // ignore
          }
        });
        nodeStream.pipe(res);
        return;
      }

      // ---- Generic streaming proxy: /api/gw/proxy?url=https://...
      // For non-string bodies (FormData/Blob/ArrayBuffer/ReadableStream) we tunnel request body through gateway.
      if (service === 'proxy') {
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        const sessionId = getSessionId(req);
        const target = incoming.searchParams.get('url');
        if (!target) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing query param: url' }));
          return;
        }
        const u = new URL(target);
        if (!(u.protocol === 'https:' || u.protocol === 'http:')) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Only http/https protocols are allowed' }));
          return;
        }
        if (!isAllowedHost(u.host)) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Host not allowed: ${u.host}` }));
          return;
        }

        const method = (req.method || 'GET').toUpperCase();
        if (method === 'GET' && proxy404CacheGet(u.toString())) {
          res.statusCode = 404;
          res.end();
          return;
        }

        const controller = new AbortController();
        const abortUpstream = () => {
          try {
            controller.abort();
          } catch {
            // ignore
          }
        };
        res.on('close', abortUpstream);
        res.on('error', abortUpstream);

        // Build upstream headers from incoming request headers.
        // Strip hop-by-hop, browser-internal, and localhost-leaking headers so
        // upstream CDNs (e.g. pbs.twimg.com) see a clean server-side request.
        const upstreamHeaders: Record<string, string> = {};
        const skipHeaders = new Set([
          'connection',
          'keep-alive',
          'proxy-authenticate',
          'proxy-authorization',
          'te',
          'trailer',
          'transfer-encoding',
          'upgrade',
          'host',
          // Browser-internal — meaningless/misleading for server-side fetch
          'origin',
          'referer',
          'sec-fetch-dest',
          'sec-fetch-mode',
          'sec-fetch-site',
          'sec-fetch-user',
          'x-gw-session',
        ]);
        for (const [k, v] of Object.entries(req.headers || {})) {
          const key = k.toLowerCase();
          if (skipHeaders.has(key)) continue;
          if (typeof v === 'string') upstreamHeaders[key] = v;
          else if (Array.isArray(v)) upstreamHeaders[key] = v.join(', ');
        }
        // Force identity encoding so upstream returns uncompressed body.
        // This makes content-length safe to forward (no compress/decompress mismatch).
        upstreamHeaders['accept-encoding'] = 'identity';
        // Cookie jar if no explicit cookie
        if (!('cookie' in upstreamHeaders)) {
          const cookie = buildCookieHeader(sessionId, u.host);
          if (cookie) upstreamHeaders['cookie'] = cookie;
        }

        const canHaveBody = method !== 'GET' && method !== 'HEAD';

        let upstreamResp: Response;
        try {
          const bodyWeb = canHaveBody && (Readable as any).toWeb
            ? (Readable as any).toWeb(req) : undefined;
          const fetchOpts: any = {
            method,
            headers: upstreamHeaders,
            signal: controller.signal,
          };
          if (bodyWeb) {
            fetchOpts.body = bodyWeb;
            fetchOpts.duplex = 'half';
          }
          try {
            upstreamResp = await fetch(u.toString(), fetchOpts);
          } catch (e: any) {
            // Retry once for transient network errors.
            const code = e?.cause?.code || e?.code || '';
            const msg = e?.cause?.message || e?.message || String(e);
            const canRetry = typeof code === 'string' && (
              code.includes('UND_ERR_CONNECT') ||
              code.includes('UND_ERR_SOCKET') ||
              code.includes('UND_ERR_HEADERS_TIMEOUT') ||
              code.includes('UND_ERR_BODY_TIMEOUT') ||
              code.includes('ECONNRESET') ||
              code.includes('EPIPE') ||
              code.includes('ETIMEDOUT') ||
              code.includes('ENOTFOUND') ||
              code.includes('EAI_AGAIN')
            );

            if (canRetry && !controller.signal.aborted) {
              console.warn('[gw/proxy] upstream fetch failed, retrying once:', {
                url: u.toString(),
                code,
                message: msg,
              });
              await sleep(120);
              upstreamResp = await fetch(u.toString(), fetchOpts);
            } else {
              throw e;
            }
          }
        } catch (e: any) {
          const name = e?.name || '';
          if (name === 'AbortError' || controller.signal.aborted) {
            if (!res.writableEnded) res.end();
            return;
          }
          // Important: proxy requests are often used for images/videos; callers can't easily read the JSON error body.
          // Log the full error on server side to help debug intermittent upstream failures.
          const code = e?.cause?.code || e?.code || '';
          const msg = e?.cause?.message || e?.message || String(e);
          console.warn('[gw/proxy] upstream fetch error:', {
            url: u.toString(),
            method,
            code,
            message: msg,
          });
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: msg, code, url: u.toString() }));
          return;
        }

        res.statusCode = upstreamResp.status;
        if (method === 'GET' && upstreamResp.status === 404) {
          proxy404CacheSet(u.toString());
        }
        // Node.js 22+ auto-decompresses gzip/deflate responses, so the
        // original content-length from upstream refers to the *compressed*
        // size while the body we pipe is already decompressed. Forwarding
        // that stale content-length causes the browser to truncate the
        // response. Skip it when content-encoding is present.
        const upstreamEncoded = !!upstreamResp.headers.get('content-encoding');
        const proxyAllowHeaders = [
          'content-type',
          ...(upstreamEncoded ? [] : ['content-length']),
          'content-range',
          'accept-ranges',
          'cache-control',
          'expires',
          'etag',
          'last-modified',
          'vary',
          'content-disposition',
          'location',
        ];
        forwardHeaders(upstreamResp.headers, res, proxyAllowHeaders);

        // Store cookies
        const getSetCookie = (upstreamResp.headers as any).getSetCookie?.bind(upstreamResp.headers);
        const setCookies: string[] = typeof getSetCookie === 'function' ? getSetCookie() : [];
        if (setCookies?.length) storeCookies(sessionId, u.host, setCookies);

        if (!upstreamResp.body) {
          res.end();
          return;
        }

        let nodeStream: any;
        try {
          nodeStream = Readable.fromWeb(upstreamResp.body as any);
        } catch (e: any) {
          console.warn('[gw/proxy] Readable.fromWeb failed:', e?.message || e);
          res.end();
          return;
        }
        nodeStream.on('error', (e: any) => {
          const name = e?.name || '';
          if (name === 'AbortError' || controller.signal.aborted) return;
          console.warn('[gw/proxy] stream error:', e?.message || e);
        });
        res.on('close', () => {
          try {
            nodeStream.destroy();
          } catch {}
        });
        nodeStream.pipe(res);
        return;
      }

      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `Unknown service: ${service}` }));
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err?.message || String(err) }));
    }
  };

  return {
    name: 'api-gateway',
    configureServer(server) {
      server.middlewares.use('/api/gw', handler);
      server.middlewares.use('/api/gw/', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/gw', handler);
      server.middlewares.use('/api/gw/', handler);
    },
  };
}

/**
 * Generate a human-readable label from filename
 * Format: "appName [Type]" or "appName [Type] (suffix)"
 */
function generateLabel(filename, type) {
  // Remove extension
  let name = filename.replace(/\.(jsonl?|json)$/, '');
  
  // Extract app name (everything before the first type indicator)
  const typePatterns = [
    /_?action_tasks_?/gi,
    /_?nav_graph_?/gi,
    /_?data_graph_?/gi,
  ];
  
  let appName = name;
  let suffix = '';
  
  // Find the first type pattern match and split there
  for (const pattern of typePatterns) {
    const match = name.match(pattern);
    if (match) {
      const idx = name.search(pattern);
      appName = name.slice(0, idx).replace(/_+$/, '');
      suffix = name.slice(idx + match[0].length).replace(/^_+|_+$/g, '');
      break;
    }
  }
  
  // Build label: "appName [Type] (suffix)"
  const parts: string[] = [];
  if (appName) parts.push(appName);
  
  // Add type indicator
  if (type === 'nav_graph') {
    parts.push('[Schema]');
  } else if (type === 'data_graph') {
    parts.push('[Data]');
  } else if (type === 'action_tasks') {
    // Determine if it's data or schema based on suffix
    if (suffix === 'data') {
      parts.push('[Data]');
      suffix = ''; // consumed
    } else {
      parts.push('[Schema]');
    }
  }
  
  // Add remaining suffix if any
  if (suffix) {
    const cleanSuffix = suffix.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanSuffix) parts.push(`(${cleanSuffix})`);
  }
  
  // Fallback if nothing was extracted
  if (parts.length === 0) {
    parts.push(filename);
  }
  
  return parts.join(' ');
}

export default defineConfig(({ mode }) => {
  return {
    // 默认根路径部署（mobilegym.dev/、本地 dev、bench_env 都用 '/'）。
    // demo 分支的 GitHub Pages 部署把模拟器放在 /sim/ 子路径，通过
    // VITE_BASE=/sim/ 覆盖，使打包出的资源 URL 自动带前缀。
    base: process.env.VITE_BASE || '/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      watch: {
        ignored: [
          '**/runs/**',
          '**/runs-old/**',
          '**/runs-*/**',
          '**/mobilegym-data/**',
        ],
      },
    },
    plugins: [
      tailwindCliPlugin(),
      react(),
      accessLogPlugin(),
      serveAppAssetsPlugin(),
      serveCdnPlugin(),
      mapServiceWorkerPlugin(),
      listPublicFilesPlugin(),
      fileSystemPlugin(),
      runsExplorerPlugin(),
      apiGatewayPlugin(mode),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom', 'lucide-react'],
    },
    // @sqlite.org/sqlite-wasm 在内部用 `new URL("sqlite3.wasm", import.meta.url)`
    // 定位它的 WASM 二进制。Vite 的 dep optimizer 会把包重打包到 .vite/deps/，
    // 但不会顺带把 sqlite3.wasm 复制过去；导致运行时 import.meta.url 指向 .vite/deps
    // 时 fetch sqlite3.wasm 拿到 SPA fallback 的 HTML。`exclude` 阻止预打包，
    // import.meta.url 就回到 node_modules/.../dist/，wasm 能正确就近加载。
    optimizeDeps: {
      exclude: ['@sqlite.org/sqlite-wasm'],
    },
  };
});
