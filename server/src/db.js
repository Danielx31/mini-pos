import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";

const { Pool } = pg;
const transactionClient = new AsyncLocalStorage();

export const DEFAULT_COUPONS = [
  ["SAVE10", "10% off your order", "percentage", 10, 0, null],
  ["FLAT5", "₱5 off orders over ₱20", "fixed", 500, 2000, null],
  ["WELCOME20", "20% off one order", "percentage", 20, 1000, 1],
];

function postgresSql(sql) {
  let index = 0;
  return sql
    .replace(/\?/g, () => `$${++index}`)
    .replace(/username\s*=\s*(\$\d+)\s+COLLATE NOCASE/gi, (_match, parameter) => `LOWER(username) = LOWER(${parameter})`)
    .replace(/code\s*=\s*(\$\d+)\s+COLLATE NOCASE/gi, (_match, parameter) => `LOWER(code) = LOWER(${parameter})`);
}

export function databaseConnectionString({ direct = false } = {}) {
  const connectionString = direct
    ? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required. Connect a PostgreSQL database first.");
  let address;
  try {
    address = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL from your database provider.");
  }
  if (address.hostname.toLowerCase() === "host" || address.password === "PASSWORD" || address.pathname === "/DATABASE") {
    throw new Error("DATABASE_URL still contains example values. Copy the real connection URL from your PostgreSQL provider.");
  }
  return connectionString;
}

export function openDatabase(pool = null, options = {}) {
  if (!pool) pool = new Pool({ connectionString: databaseConnectionString(options), max: 5, connectionTimeoutMillis: 10_000 });
  const serializable = options.serializable ?? true;
  const query = (sql, values = []) => (transactionClient.getStore() ?? pool).query(postgresSql(sql), values);
  return {
    query,
    prepare(sql) {
      return {
        async get(...values) { return (await query(sql, values)).rows[0]; },
        async all(...values) { return (await query(sql, values)).rows; },
        async run(...values) { return { changes: (await query(sql, values)).rowCount }; },
      };
    },
    async transaction(callback) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const client = await pool.connect();
        try {
          await client.query(serializable ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN");
          const result = await transactionClient.run(client, callback);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          if (serializable && error.code === "40001" && attempt < 2) continue;
          throw error;
        } finally {
          client.release();
        }
      }
    },
    close: () => pool.end(),
  };
}

export async function initializeDatabase(db) {
  await db.transaction(async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','manager','cashier')),
        password_hash TEXT NOT NULL, created_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
      CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        csrf_token TEXT NOT NULL, expires_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS login_attempts (
        attempt_key TEXT PRIMARY KEY, count INTEGER NOT NULL, until BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_login_attempts_until ON login_attempts(until);
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, sku TEXT UNIQUE, name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
        stock INTEGER NOT NULL CHECK(stock >= 0), low_stock_threshold INTEGER NOT NULL CHECK(low_stock_threshold >= 0),
        active INTEGER NOT NULL DEFAULT 1, archived_name TEXT, archived_sku TEXT
      );
      ALTER TABLE products ADD COLUMN IF NOT EXISTS active INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_name TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_sku TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_lower ON products (LOWER(sku));
      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_lower ON products (LOWER(name));
      CREATE TABLE IF NOT EXISTS product_delete_requests (
        id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), product_name TEXT NOT NULL,
        requested_by TEXT NOT NULL REFERENCES users(id), requested_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
        pending_product_id TEXT UNIQUE,
        reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL, type TEXT NOT NULL, value INTEGER NOT NULL,
        min_order_cents INTEGER NOT NULL, max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1, expires_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_lower ON coupons (LOWER(code));
      CREATE TABLE IF NOT EXISTS tax_rates (
        category TEXT PRIMARY KEY, rate DOUBLE PRECISION NOT NULL CHECK(rate BETWEEN 0 AND 1)
      );
      CREATE TABLE IF NOT EXISTS orders (
        order_number TEXT PRIMARY KEY, payload_json TEXT NOT NULL, refunded INTEGER NOT NULL DEFAULT 0,
        refunded_at TEXT, created_at TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id),
        checkout_key TEXT NOT NULL UNIQUE, archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS credit_sales (
        order_number TEXT PRIMARY KEY REFERENCES orders(order_number),
        customer_name TEXT NOT NULL, customer_contact TEXT, due_date TEXT,
        total_cents INTEGER NOT NULL CHECK(total_cents > 0),
        balance_cents INTEGER NOT NULL CHECK(balance_cents >= 0 AND balance_cents <= total_cents),
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS credit_payments (
        id TEXT PRIMARY KEY, order_number TEXT NOT NULL REFERENCES credit_sales(order_number),
        payment_key TEXT NOT NULL UNIQUE, amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
        method TEXT NOT NULL CHECK(method = 'cash'), note TEXT,
        received_by TEXT NOT NULL REFERENCES users(id), received_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_credit_payments_order ON credit_payments(order_number);
      CREATE TABLE IF NOT EXISTS opening_credits (
        id TEXT PRIMARY KEY, entry_key TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL, customer_contact TEXT, item_details TEXT, prior_date TEXT,
        total_cents INTEGER NOT NULL CHECK(total_cents > 0),
        balance_cents INTEGER NOT NULL CHECK(balance_cents >= 0 AND balance_cents <= total_cents),
        created_at TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS opening_credit_payments (
        id TEXT PRIMARY KEY, opening_credit_id TEXT NOT NULL REFERENCES opening_credits(id),
        payment_key TEXT NOT NULL UNIQUE, amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
        note TEXT, received_by TEXT NOT NULL REFERENCES users(id), received_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_opening_credit_payments_credit ON opening_credit_payments(opening_credit_id);
      CREATE TABLE IF NOT EXISTS holds (
        hold_number TEXT PRIMARY KEY, payload_json TEXT NOT NULL, created_at TEXT NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);
    const inserted = await db.query("INSERT INTO app_meta (key,value) VALUES ('initial_seed','1') ON CONFLICT (key) DO NOTHING RETURNING key");
    if (inserted.rowCount) {
      for (const [index, coupon] of DEFAULT_COUPONS.entries()) {
        await db.prepare("INSERT INTO coupons (id,code,description,type,value,min_order_cents,max_uses) VALUES (?,?,?,?,?,?,?)").run(index + 1, ...coupon);
      }
    }
  });
}

export function productDto(row) {
  return {
    id: row.id, sku: row.sku ?? undefined, name: row.name, category: row.category,
    price: row.price_cents / 100, stock: row.stock,
    lowStockThreshold: row.low_stock_threshold,
  };
}

export function couponDto(row) {
  const description = row.code === "FLAT5" && row.description === "$5 off orders over $20"
    ? "₱5 off orders over ₱20"
    : row.description;
  return {
    id: row.id, code: row.code, description, type: row.type,
    value: row.type === "fixed" ? row.value / 100 : row.value,
    minOrderAmount: row.min_order_cents / 100, maxUses: row.max_uses,
    usedCount: row.used_count, active: Boolean(row.active), expiresAt: row.expires_at,
  };
}
