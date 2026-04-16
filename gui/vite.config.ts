import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "../src/core"),
    },
  },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  // For Tauri bundling: output relative paths so the app works when loaded
  // from the tauri:// scheme in the final bundle.
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
});
