import { randomUUID } from "node:crypto";
import { openDatabase, initializeDatabase } from "./db.js";
import { hashPassword } from "./security.js";
import { readHiddenPassword } from "./password-input.js";

const [role, username, ...nameParts] = process.argv.slice(2);
const displayName = nameParts.join(" ").trim() || username;
if (!["admin", "manager", "cashier"].includes(role) || !username || username.length > 80 || !/^[a-zA-Z0-9._-]+$/.test(username) || displayName.length > 100) {
  console.error("Usage: npm run create-user -- <admin|manager|cashier> <username> [display name]");
  process.exit(1);
}

let db;
try {
  db = openDatabase(null, { direct: true });
  await db.query("SELECT 1");
  const password = await readHiddenPassword();
  if (password.length < 12) throw new Error("Password must have at least 12 characters.");
  await initializeDatabase(db);
  await db.prepare("INSERT INTO users (id,username,display_name,role,password_hash,created_at) VALUES (?,?,?,?,?,?)")
    .run(randomUUID(), username, displayName, role, hashPassword(password), new Date().toISOString());
  console.log(`Created ${role} user ${username}.`);
} catch (error) {
  const message = error.code === "23505" ? "Username already exists." : error.message;
  console.error(message);
  process.exitCode = 1;
} finally {
  await db?.close();
}
