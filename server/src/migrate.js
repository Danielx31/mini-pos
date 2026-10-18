import { initializeDatabase, openDatabase } from "./db.js";

let db;
try {
  db = openDatabase(null, { direct: true });
  await initializeDatabase(db);
  console.log("Database schema is ready.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db?.close();
}
