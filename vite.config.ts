import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the production build works under any path, including the
  // GitHub Pages project subpath (/metron-dashboard/).
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
