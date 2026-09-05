// @lovable.dev/vite-tanstack-config already includes the following - do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Enable HTTPS so mobile browsers allow getUserMedia (camera access).
    // Mobile Chrome/Safari block navigator.mediaDevices on plain HTTP
    // for any origin that isn't localhost. basicSsl generates a self-signed
    // cert automatically — accept it once in your phone's browser.
    plugins: [basicSsl()],
    server: {
      host: true,       // expose on local network (0.0.0.0) so phones can connect
      proxy: {
        // Forward all /api/* requests to the Flask backend (port 5000)
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
        },
      },
    },
  },
});
