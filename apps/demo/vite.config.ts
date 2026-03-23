import {defineConfig} from "vite";
import react from "@vitejs/plugin-react-swc";
import {gtfsLoaderPlugin} from "@gtfs-jp/loader/vite";

export default defineConfig({
  plugins: [react(), gtfsLoaderPlugin()],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    allowedHosts: ["gtfs.konekone.mobi"]
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
