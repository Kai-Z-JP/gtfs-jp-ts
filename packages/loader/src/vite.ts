import type { OutputAsset, OutputChunk } from 'rollup';
import type { Plugin } from 'vite';

const SQLITE_STABLE_ASSET_NAMES = new Set(['sqlite3.wasm', 'sqlite3-opfs-async-proxy.js']);

const SQLITE_STABLE_FILE_PATTERNS = [
  {
    stableFileName: 'assets/sqlite3.wasm',
    filePattern: /^assets\/sqlite3(?:-[^/]+)?\.wasm$/,
  },
  {
    stableFileName: 'assets/sqlite3-opfs-async-proxy.js',
    filePattern: /^assets\/sqlite3-opfs-async-proxy(?:-[^/]+)?\.js$/,
  },
];

const toStableSource = (output: OutputAsset | OutputChunk): string | Uint8Array | undefined => {
  if (output.type === 'asset') {
    return output.source;
  }

  return output.code;
};

export const gtfsLoaderPlugin = (): Plugin => ({
  name: 'gtfs-loader',
  config() {
    return {
      optimizeDeps: {
        exclude: ['@gtfs-jp/loader', '@sqlite.org/sqlite-wasm'],
      },
      build: {
        rollupOptions: {
          output: {
            assetFileNames(assetInfo) {
              const assetName = assetInfo.name ?? '';
              if (SQLITE_STABLE_ASSET_NAMES.has(assetName)) {
                return `assets/${assetName}`;
              }
              return 'assets/[name]-[hash][extname]';
            },
          },
        },
      },
    };
  },
  generateBundle(_, bundle) {
    for (const { stableFileName, filePattern } of SQLITE_STABLE_FILE_PATTERNS) {
      if (bundle[stableFileName]) {
        continue;
      }

      const candidate = Object.values(bundle).find((output) => filePattern.test(output.fileName));
      const source = candidate ? toStableSource(candidate) : undefined;

      if (source === undefined) {
        continue;
      }

      this.emitFile({
        type: 'asset',
        fileName: stableFileName,
        source,
      });
    }
  },
});
