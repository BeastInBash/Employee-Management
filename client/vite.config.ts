import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // React and Framer Motion change far less often than app code and the
        // first screen needs all of them, so they get their own long-lived files:
        // a deploy that only touches the app leaves them cached. Everything else
        // (charts, Radix primitives, icons) is left to the default splitting, which
        // keeps each library with the pages that use it. Don't add a rule for a
        // library only some pages use: a manual chunk also absorbs that library's
        // dependencies, and when one of those is shared with the shell, the whole
        // chunk lands in the first download (it happened with recharts).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
            return "react";
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return "motion";
        },
      },
    },
  },
});
