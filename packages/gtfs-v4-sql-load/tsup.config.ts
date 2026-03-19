import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "browser",
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  skipNodeModulesBundle: true,
  noExternal: [/^(papaparse|jszip)(\/.*)?$/],
  external: ["@sqlite.org/sqlite-wasm", "@hyperload/gtfs-v4-struct"],
});
