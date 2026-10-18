import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_PRODUCTS = [
  ["p-001", "Bottled Water", "Drinks", 100, 50, 10],
  ["p-002", "Sparkling Soda", "Drinks", 175, 30, 5],
  ["p-003", "Classic Burger", "Food", 550, 25, 3],
  ["p-004", "Chicken Sandwich", "Food", 625, 20, 3],
  ["p-005", "French Fries", "Sides", 250, 40, 8],
  ["p-006", "Garden Salad", "Sides", 375, 15, 2],
  ["p-007", "Chocolate Bar", "Snacks", 125, 35, 5],
  ["p-008", "Fresh Coffee", "Drinks", 225, 12, 3],
];

export const DEFAULT_COUPONS = [
  ["SAVE10", "10% off your order", "percentage", 10, 0, null],
  ["FLAT5", "$5 off orders over $20", "fixed", 500, 2000, null],
  ["WELCOME20", "20% off one order", "percentage", 20, 1000, 1],
];

function allowManagerRole(db) {
  const usersSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql ?? "";
  if (usersSchema.includes("'manager'")) return;

  // SQLite cannot change a CHECK constraint in place. Preserve user IDs so sales and sessions keep their references.
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','manager','cashier')),
          password_hash TEXT NOT NULL, created_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO users_new (id,username,display_name,role,password_hash,created_at,active)
          SELECT id,username,display_name,role,password_hash,created_at,active FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
      if (db.pragma("foreign_key_check").length > 0) throw new Error("User migration failed foreign key validation.");
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

export function openDatabase(filename = process.env.POS_DB_PATH ?? fileURLToPath(new URL("../data/pos.sqlite", import.meta.url))) {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','manager','cashier')),
      password_hash TEXT NOT NULL, created_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, sku TEXT UNIQUE COLLATE NOCASE, name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      category TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
      stock INTEGER NOT NULL CHECK(stock >= 0), low_stock_threshold INTEGER NOT NULL CHECK(low_stock_threshold >= 0)
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      description TEXT NOT NULL, type TEXT NOT NULL, value INTEGER NOT NULL,
      min_order_cents INTEGER NOT NULL, max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1, expires_at TEXT
    );
    CREATE TABLE IF NOT EXISTS tax_rates (
      category TEXT PRIMARY KEY, rate REAL NOT NULL CHECK(rate BETWEEN 0 AND 1)
    );
    CREATE TABLE IF NOT EXISTS orders (
      order_number TEXT PRIMARY KEY, payload_json TEXT NOT NULL, refunded INTEGER NOT NULL DEFAULT 0,
      refunded_at TEXT, created_at TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id),
      checkout_key TEXT NOT NULL UNIQUE, archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS holds (
      hold_number TEXT PRIMARY KEY, payload_json TEXT NOT NULL, created_at TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);
  if (!db.pragma("table_info(users)").some((column) => column.name === "active")) {
    db.exec("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
  }
  allowManagerRole(db);
  if (!db.pragma("table_info(orders)").some((column) => column.name === "archived")) {
    db.exec("ALTER TABLE orders ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }
  db.transaction(() => {
    if (!db.prepare("SELECT 1 FROM app_meta WHERE key='initial_seed'").get()) {
      const insertProduct = db.prepare("INSERT INTO products (id,name,category,price_cents,stock,low_stock_threshold) VALUES (?,?,?,?,?,?)");
      for (const product of DEFAULT_PRODUCTS) insertProduct.run(...product);
      const insertCoupon = db.prepare("INSERT INTO coupons (code,description,type,value,min_order_cents,max_uses) VALUES (?,?,?,?,?,?)");
      for (const coupon of DEFAULT_COUPONS) insertCoupon.run(...coupon);
      db.prepare("INSERT INTO app_meta (key,value) VALUES ('initial_seed','1')").run();
    }
  })();
  return db;
}

export function productDto(row) {
  return {
    id: row.id, sku: row.sku ?? undefined, name: row.name, category: row.category,
    price: row.price_cents / 100, stock: row.stock,
    lowStockThreshold: row.low_stock_threshold,
  };
}

export function couponDto(row) {
  return {
    id: row.id, code: row.code, description: row.description, type: row.type,
    value: row.type === "fixed" ? row.value / 100 : row.value,
    minOrderAmount: row.min_order_cents / 100, maxUses: row.max_uses,
    usedCount: row.used_count, active: Boolean(row.active), expiresAt: row.expires_at,
  };
}
