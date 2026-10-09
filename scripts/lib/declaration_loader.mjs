/**
 * Shared TS-aware module loader for the navigation toolchain.
 *
 * Why this exists:
 * - check_navigation_declaration_consistency.mjs used to re-extract the declaration
 *   with a hand-written AST walker that silently skipped non-object-literal array
 *   elements (SpreadElement, constant refs, ...). navigation_declaration_analyzer.mjs
 *   evaluated the module with vm instead. The two readers disagreed on what was
 *   "declared" (e.g. spread actions were invisible to the checker).
 * - This module is now the single source of truth for loading navigation
 *   declarations and data configs: transpile TypeScript on the fly, evaluate in vm,
 *   and resolve relative .ts/.tsx imports with a ts-aware require (so declarations
 *   may import constants from sibling files without crashing on native require).
 *
 * Consumers: navigation_declaration_analyzer.mjs, check_navigation_declaration_consistency.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

/** Canonical export name every navigation.declaration.ts must provide. */
export const NAVIGATION_DECLARATION_EXPORT = 'NAVIGATION_DECLARATION';

/**
 * Error thrown when a declaration/data module cannot be loaded.
 * Always carries the real cause message and the offending file path.
 */
export class DeclarationLoadError extends Error {
  /**
   * @param {string} message
   * @param {{filePath?: string, hint?: string, cause?: unknown}} [meta]
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = 'DeclarationLoadError';
    this.filePath = meta.filePath;
    this.hint = meta.hint;
    if (meta.cause !== undefined) this.cause = meta.cause;
  }
}

/**
 * Resolve an app argument (name or path) to an app directory.
 * Tries, in order: the argument as a direct path, then each root (default apps/, system/).
 *
 * @param {string} appArg
 * @param {{roots?: string[], cwd?: string}} [options]
 * @returns {string} absolute app directory path
 */
export function resolveAppDir(appArg, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const roots = [...new Set(options.roots ?? ['apps', 'system'])];
  const tried = [];

  const direct = path.resolve(cwd, appArg);
  tried.push(direct);
  if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) {
    return direct;
  }

  for (const root of roots) {
    const joined = path.resolve(cwd, root, appArg);
    if (tried.includes(joined)) continue;
    tried.push(joined);
    if (fs.existsSync(joined) && fs.statSync(joined).isDirectory()) {
      return joined;
    }
  }

  const err = new Error(
    `Could not find app directory for "${appArg}". Tried:\n${tried.map(t => ` - ${t}`).join('\n')}`,
  );
  err.code = 'APP_DIR_NOT_FOUND';
  err.tried = tried;
  throw err;
}

const ASSET_STUB_RE = /\.(png|jpe?g|gif|webp|svg|css)$/;

function transpileTs(absPath) {
  let source;
  try {
    source = fs.readFileSync(absPath, 'utf-8');
  } catch (cause) {
    throw new DeclarationLoadError(`Failed to read ${absPath}: ${cause.message}`, {
      filePath: absPath,
      cause,
    });
  }
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: absPath,
    reportDiagnostics: true,
  });
  if (transpiled.diagnostics?.length) {
    const message = ts.formatDiagnosticsWithColorAndContext(transpiled.diagnostics, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: fileName => fileName,
      getNewLine: () => '\n',
    });
    throw new DeclarationLoadError(`Failed to transpile ${absPath}:\n${message}`, {
      filePath: absPath,
    });
  }
  // TS keeps `import.meta` intact even when transpiling to CommonJS.
  // Replace it only inside this Node-side loader so Vite/browser runtime is unaffected.
  return transpiled.outputText.replace(/\bimport\.meta\b/g, '__IMPORT_META__');
}

/**
 * Create a fresh evaluation session (module cache + import.meta shim) and return
 * a function that evaluates a .ts/.tsx module and returns its exports.
 */
function createTsModuleEvaluator() {
  const tsModuleCache = new Map(); // absPath -> module.exports
  const importMetaShim = {
    env: process.env,
    hot: undefined,
    glob: () => {
      throw new Error('import.meta.glob is not supported when loading modules in Node.');
    },
  };

  const makeTsAwareRequire = (parentFilePath) => {
    const nativeRequire = createRequire(pathToFileURL(parentFilePath));
    const parentDir = path.dirname(parentFilePath);

    const LOADABLE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs', '.node']);

    const resolveRelative = (req) => {
      const base = path.resolve(parentDir, req);
      const candidates = [];
      const ext = path.extname(base).toLowerCase();
      if (ext && LOADABLE_EXTS.has(ext)) {
        candidates.push(base);
      } else {
        // No extension — or a dotted basename like `navigation.types` / `nav.parts`
        // where path.extname() lies (".types" is not a real extension).
        // Try the literal path first, then the usual resolution suffixes.
        if (ext) candidates.push(base);
        candidates.push(`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.json`);
        candidates.push(path.join(base, 'index.ts'), path.join(base, 'index.tsx'), path.join(base, 'index.js'));
      }
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
      return null;
    };

    /** @type {(req:string)=>any} */
    const reqFn = (req) => {
      // Stub common non-js assets used by apps (images/styles) to avoid runtime loader errors.
      if (ASSET_STUB_RE.test(req)) {
        return req;
      }

      // Relative/local imports: handle TS/TSX via transpile+vm
      if (req.startsWith('.') || req.startsWith('/')) {
        const resolved = resolveRelative(req);
        if (!resolved) {
          // Let native require throw a useful error with its resolver.
          return nativeRequire(req);
        }
        const ext = path.extname(resolved).toLowerCase();
        if (ext === '.ts' || ext === '.tsx') {
          return evaluateFile(resolved);
        }
        // .js/.json etc: use native require on the resolved absolute path
        return nativeRequire(resolved);
      }

      // Bare specifiers: delegate to node resolver (node_modules / builtin)
      return nativeRequire(req);
    };

    return reqFn;
  };

  /** Evaluate a .ts/.tsx module in vm; returns module.exports. */
  function evaluateFile(absPath) {
    if (tsModuleCache.has(absPath)) return tsModuleCache.get(absPath);

    const module = { exports: {} };
    // Pre-populate cache to break require cycles.
    tsModuleCache.set(absPath, module.exports);
    const context = {
      module,
      exports: module.exports,
      require: makeTsAwareRequire(absPath),
      __dirname: path.dirname(absPath),
      __filename: absPath,
      __IMPORT_META__: importMetaShim,
      console,
      process,
      // vm.runInNewContext creates a bare ECMAScript realm without Node's
      // platform globals; expose the ones app modules legitimately use.
      structuredClone,
    };
    const js = transpileTs(absPath);
    try {
      vm.runInNewContext(js, context, { filename: absPath });
    } catch (cause) {
      if (cause instanceof DeclarationLoadError) throw cause;
      throw new DeclarationLoadError(
        `Failed to evaluate ${absPath}: ${cause?.message ?? String(cause)}`,
        { filePath: absPath, cause },
      );
    }
    // Ensure cache points at final exports object (module.exports may be reassigned).
    tsModuleCache.set(absPath, context.module.exports);
    return context.module.exports;
  }

  return evaluateFile;
}

/**
 * Evaluate a TypeScript module and return all of its exports.
 * Relative .ts/.tsx imports are transpiled on the fly; non-js assets are stubbed.
 *
 * @param {string} filePath absolute or cwd-relative path to a .ts/.tsx file
 * @returns {Record<string, any>} module exports
 */
export function loadModuleExports(filePath) {
  const absPath = path.resolve(filePath);
  const evaluateFile = createTsModuleEvaluator();
  return evaluateFile(absPath);
}

/**
 * Load a navigation.declaration.ts module and return the NAVIGATION_DECLARATION export.
 * Throws DeclarationLoadError with the real cause + file path on any failure,
 * including a clear "must export NAVIGATION_DECLARATION" hint when the canonical
 * export is missing (e.g. a lowercase `navigationDeclaration` export).
 *
 * @param {string} filePath
 * @returns {any} the evaluated NAVIGATION_DECLARATION object
 */
export function loadNavigationDeclaration(filePath) {
  const absPath = path.resolve(filePath);
  const exportsObj = loadModuleExports(absPath);

  const declaration = exportsObj?.[NAVIGATION_DECLARATION_EXPORT];
  if (!declaration) {
    const available = Object.keys(exportsObj ?? {});
    const hint =
      `navigation.declaration.ts must export \`${NAVIGATION_DECLARATION_EXPORT}\` ` +
      `(应导出 ${NAVIGATION_DECLARATION_EXPORT})` +
      (available.length ? `; found exports: ${available.join(', ')}` : '; the module has no exports');
    throw new DeclarationLoadError(
      `${NAVIGATION_DECLARATION_EXPORT} not found in ${absPath}. ${hint}.`,
      { filePath: absPath, hint },
    );
  }
  return declaration;
}

/**
 * Load a data config module (e.g. data/index.ts) and return the requested export.
 * When exportName is omitted, auto-detects the first `*_CONFIG` export.
 *
 * @param {string} filePath
 * @param {string} [exportName]
 */
export function loadDataConfig(filePath, exportName) {
  const absPath = path.resolve(filePath);
  const exportsObj = loadModuleExports(absPath);

  if (exportName) {
    if (!exportsObj[exportName]) {
      throw new DeclarationLoadError(
        `Export "${exportName}" not found in ${absPath}. Found exports: ${Object.keys(exportsObj).join(', ') || '(none)'}`,
        { filePath: absPath },
      );
    }
    return exportsObj[exportName];
  }

  const configKey = Object.keys(exportsObj).find(key => key.endsWith('_CONFIG'));
  if (configKey) {
    return exportsObj[configKey];
  }

  throw new DeclarationLoadError(
    `No *_CONFIG export found in ${absPath}. Use --data-export to specify.`,
    { filePath: absPath },
  );
}
