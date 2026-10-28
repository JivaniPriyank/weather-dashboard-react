import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// While developing (npm run dev), Vite serves the React app on http://localhost:5173
// and passes API, admin and file requests on to Django on http://127.0.0.1:8000.
// For everyday use (npm run build), the finished app goes into ../static/app and
// Django serves it, so only `python manage.py runserver` is needed.
const django = "http://127.0.0.1:8000";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/static/app/" : "/",
  build: { outDir: "../static/app", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/api": django,
      "/admin": django,
      "/static": django,
      "/manifest.webmanifest": django,
      "/sw.js": django,
    },
  },
}));
