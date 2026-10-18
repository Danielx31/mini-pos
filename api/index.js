import { createApp } from "../server/src/app.js";
import { openDatabase } from "../server/src/db.js";

let app;

export default function handler(req, res) {
  const path = req.query?.path;
  if (typeof path !== "string" || path.startsWith("/") || path.includes("..") || !/^[a-zA-Z0-9/%._-]+$/.test(path)) {
    res.status(404).json({ ok: false, message: "API route not found." });
    return;
  }
  req.url = `/api/v1/${path}`;
  if (!app) {
    try {
      app = createApp(openDatabase(), { serveStatic: false, trustProxy: true });
    } catch {
      res.status(503).json({ ok: false, message: "Database is not configured." });
      return;
    }
  }
  return app(req, res);
}
