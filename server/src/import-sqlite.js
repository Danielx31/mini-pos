import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { DEFAULT_COUPONS, openDatabase, initializeDatabase } from "./db.js";

const SOURCE_TABLES = ["users", "products", "coupons", "tax_rates", "orders", "holds"];

function readSnapshot(filename) {
  const source = new Database(filename, { readonly: true, fileMustExist: true });
  try {
    return source.transaction(() => Object.fromEntries(
      SOURCE_TABLES.map((table) => [table, source.prepare(`SELECT * FROM ${table}`).all()]),
    ))();
  } finally {
    source.close();
  }
}

export async function importSqlite(db, filename) {
  const snapshot = readSnapshot(filename);
  await db.transaction(async () => {
    for (const table of ["users", "orders", "holds"]) {
      const { total } = await db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get();
      if (Number(total) !== 0) throw new Error("PostgreSQL already contains accounts or sales. Import into a fresh database only.");
    }
    const products = await db.prepare("SELECT id,name,category,price_cents,stock,low_stock_threshold FROM products ORDER BY id").all();
    const coupons = await db.prepare("SELECT id,code,description,type,value,min_order_cents,max_uses FROM coupons ORDER BY id").all();
    const expectedCoupons = DEFAULT_COUPONS.map(([code, description, type, value, min_order_cents, max_uses], index) => ({ id: index + 1, code, description, type, value, min_order_cents, max_uses }));
    if (products.length !== 0 || JSON.stringify(coupons) !== JSON.stringify(expectedCoupons)) {
      throw new Error("PostgreSQL catalog has changed. Import into a fresh database only.");
    }

    await db.query("DELETE FROM coupons");
    await db.query("DELETE FROM products");
    for (const row of snapshot.users) {
      await db.prepare("INSERT INTO users (id,username,display_name,role,password_hash,created_at,active) VALUES (?,?,?,?,?,?,?)")
        .run(row.id, row.username, row.display_name, row.role, row.password_hash, row.created_at, row.active ?? 1);
    }
    for (const row of snapshot.products) {
      await db.prepare("INSERT INTO products (id,sku,name,category,price_cents,stock,low_stock_threshold) VALUES (?,?,?,?,?,?,?)")
        .run(row.id, row.sku, row.name, row.category, row.price_cents, row.stock, row.low_stock_threshold);
    }
    for (const row of snapshot.coupons) {
      await db.prepare("INSERT INTO coupons (id,code,description,type,value,min_order_cents,max_uses,used_count,active,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(row.id, row.code, row.description, row.type, row.value, row.min_order_cents, row.max_uses, row.used_count, row.active, row.expires_at);
    }
    for (const row of snapshot.tax_rates) {
      await db.prepare("INSERT INTO tax_rates (category,rate) VALUES (?,?)").run(row.category, row.rate);
    }
    for (const row of snapshot.orders) {
      await db.prepare("INSERT INTO orders (order_number,payload_json,refunded,refunded_at,created_at,created_by,checkout_key,archived) VALUES (?,?,?,?,?,?,?,?)")
        .run(row.order_number, row.payload_json, row.refunded, row.refunded_at, row.created_at, row.created_by, row.checkout_key, row.archived ?? 0);
    }
    for (const row of snapshot.holds) {
      await db.prepare("INSERT INTO holds (hold_number,payload_json,created_at,created_by) VALUES (?,?,?,?)")
        .run(row.hold_number, row.payload_json, row.created_at, row.created_by);
    }
  });
  return Object.fromEntries(SOURCE_TABLES.map((table) => [table, snapshot[table].length]));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const filename = resolve(process.argv[2] ?? fileURLToPath(new URL("../data/pos.sqlite", import.meta.url)));
  if (!existsSync(filename)) {
    console.error("SQLite file was not found. Pass its path after --.");
    process.exitCode = 1;
  } else {
    let db;
    try {
      db = openDatabase(null, { direct: true });
      await initializeDatabase(db);
      const counts = await importSqlite(db, filename);
      console.log(`Imported ${counts.users} users, ${counts.products} products, ${counts.orders} orders, and ${counts.holds} parked orders. Sign in again with the existing credentials.`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    } finally {
      await db?.close();
    }
  }
}
