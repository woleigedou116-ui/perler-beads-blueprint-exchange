import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8765",
    },
  },
  test: {
    css: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
