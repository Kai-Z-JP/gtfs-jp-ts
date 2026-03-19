import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/parse-worker.ts"],
  format: ["esm"],
  platform: "browser",
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  skipNodeModulesBundle: true,
  noExternal: [/^(udsv|jszip)(\/.*)?$/],
  external: ["@sqlite.org/sqlite-wasm", "@gtfs-jp/types"],
});
