import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/virtual-piano/",
  build: { outDir: "build" },
  server: { host: "127.0.0.1", port: 3000 },
  test: { globals: true, environment: "jsdom" },
});
