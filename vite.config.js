// ============================================================================
// vite.config.js - the demo's dev server (npm run dev).
// Besides serving the demo page, it mounts the real extension folder at
// /ext so the demo can load the exact content script and CSS the installed
// extension uses - what you try in the demo is what ships. The path checks
// in the middleware make sure /ext can only read files inside extension/.
// ============================================================================
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.join(root, "extension");

const MIME = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
};

export default defineConfig({
  root: path.join(root, "demo"),
  server: {
    host: "0.0.0.0",
    port: 8741,
    strictPort: true,
  },
  plugins: [
    {
      name: "serve-extension",
      configureServer(server) {
        server.middlewares.use("/ext", (req, res, next) => {
          try {
            const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
            const relative = urlPath.replace(/^\/+/, "");
            const file = path.normalize(path.join(extensionDir, relative));
            if (file !== extensionDir && !file.startsWith(extensionDir + path.sep)) return next();
            if (!existsSync(file) || statSync(file).isDirectory()) return next();
            res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
            res.setHeader("Cache-Control", "no-cache");
            createReadStream(file).pipe(res);
          } catch (error) {
            next();
          }
        });
      },
    },
  ],
});
