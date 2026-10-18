import { createApp } from "../server/src/app.js";
import { initializeDatabase, openDatabase } from "../server/src/db.js";

let appPromise;

export default async function handler(req, res) {
  const path = req.query?.path;
  if (typeof path !== "string" || path.startsWith("/") || path.includes("..") || !/^[a-zA-Z0-9/%._-]+$/.test(path)) {
    res.status(404).json({ ok: false, message: "API route not found." });
    return;
  }
  req.url = `/api/v1/${path}`;
  if (!appPromise) {
    appPromise = (async () => {
      const setupDb = openDatabase(null, { direct: true });
      try { await initializeDatabase(setupDb); }
      finally { await setupDb.close(); }
      return createApp(openDatabase(), { serveStatic: false, trustProxy: true });
    })();
  }
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    appPromise = undefined;
    console.error("Database initialization failed:", error);
    return res.status(503).json({ ok: false, message: "Database is unavailable. Please try again." });
  }
}
