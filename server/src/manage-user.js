import { openDatabase, initializeDatabase } from "./db.js";
import { hashPassword } from "./security.js";
import { readHiddenPassword } from "./password-input.js";

const [action, username] = process.argv.slice(2);
if (!["reset-password", "disable", "enable"].includes(action) || !username) {
  console.error("Usage: npm run manage-user -- <reset-password|disable|enable> <username>");
  process.exit(1);
}

let db;
try {
  const password = action === "reset-password" ? await readHiddenPassword() : null;
  if (password !== null && password.length < 12) throw new Error("Password must have at least 12 characters.");
  db = openDatabase(null, { direct: true });
  await initializeDatabase(db);
  const user = await db.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").get(username);
  if (!user) throw new Error("User not found.");
  await db.transaction(async () => {
    if (action === "reset-password") await db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(password), user.id);
    else await db.prepare("UPDATE users SET active=? WHERE id=?").run(action === "enable" ? 1 : 0, user.id);
    await db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
  });
  console.log(`${action} completed for ${username}. Existing sessions revoked.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db?.close();
}
