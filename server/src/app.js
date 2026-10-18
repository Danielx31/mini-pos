import express from "express";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openDatabase, initializeDatabase, productDto, couponDto } from "./db.js";
import { hashPassword, verifyPassword, randomToken, hashToken, cookieValue, clearCookie, SESSION_SECONDS } from "./security.js";

const DEFAULT_TAX_RATE = 0.08;
const CATEGORY_TAX_RATES = { Food: 0.05, Drinks: 0.08, Sides: 0.08, Snacks: 0.1 };
const MAX_ITEMS = 100;
const MAX_QUANTITY = 99;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;
const MANAGEMENT_ROLES = ["admin", "manager"];
const ACCOUNT_ROLES = [...MANAGEMENT_ROLES, "cashier"];

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function requireValid(condition, message) {
  if (!condition) throw new ApiError(400, message);
}

function text(value, maxLength, label) {
  requireValid(typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength, `${label} is required and must be at most ${maxLength} characters.`);
  return value.trim();
}

function optionalText(value, maxLength) {
  requireValid(value === undefined || value === null || typeof value === "string", "Invalid text value.");
  const result = (value ?? "").trim();
  requireValid(result.length <= maxLength, `Text must be at most ${maxLength} characters.`);
  return result;
}

function wholeNumber(value, label) {
  const parsed = Number(value);
  requireValid((typeof value === "number" || typeof value === "string") && value !== "" && Number.isSafeInteger(parsed) && parsed >= 0, `${label} must be a non-negative whole number.`);
  return parsed;
}

function cents(value, label) {
  const parsed = Number(value);
  requireValid((typeof value === "number" || typeof value === "string") && value !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000 && Math.abs(Math.round(parsed * 100) - parsed * 100) < 1e-8, `${label} must be a valid amount with at most two decimal places.`);
  return Math.round(parsed * 100);
}

async function readProducts(db) {
  return (await db.prepare("SELECT * FROM products WHERE active=1 ORDER BY name").all()).map(productDto);
}

async function ensureProductIsNotParked(db, productId) {
  const parked = (await db.prepare("SELECT payload_json FROM holds").all())
    .some((row) => JSON.parse(row.payload_json).items.some((item) => item.productId === productId));
  if (parked) throw new ApiError(409, "This product is in a parked order. Remove that parked order before removing the product.");
}

async function readPendingProductRequests(db, requesterId = null) {
  const sql = `SELECT requests.id, requests.product_id, requests.product_name, requests.requested_at,
    users.display_name AS requester_name FROM product_delete_requests AS requests
    JOIN users ON users.id=requests.requested_by WHERE requests.status='pending'`;
  const rows = requesterId
    ? await db.prepare(`${sql} AND requests.requested_by=? ORDER BY requests.requested_at`).all(requesterId)
    : await db.prepare(`${sql} ORDER BY requests.requested_at`).all();
  return rows.map((row) => ({
    id: row.id, productId: row.product_id, productName: row.product_name,
    requestedAt: row.requested_at, requesterName: row.requester_name,
  }));
}

async function readCoupons(db) {
  return (await db.prepare("SELECT * FROM coupons ORDER BY id").all()).map(couponDto);
}

async function readTaxRates(db) {
  return Object.fromEntries((await db.prepare("SELECT category, rate FROM tax_rates").all()).map(({ category, rate }) => [category, rate]));
}

function creditDto(row) {
  return {
    customerName: row.customer_name, customerContact: row.customer_contact,
    dueDate: row.due_date, total: row.total_cents / 100,
    balance: row.balance_cents / 100,
  };
}

function orderWithCredit(order, credit, refunded = false) {
  if (!credit) return order;
  const verificationStatus = refunded ? "cancelled" : credit.balance === 0 ? "paid" : credit.balance < credit.total ? "partially_paid" : "unpaid";
  return { ...order, credit, payment: { ...order.payment, verificationStatus } };
}

async function readCreditSale(db, orderNumber) {
  const row = await db.prepare("SELECT * FROM credit_sales WHERE order_number=?").get(orderNumber);
  return row ? creditDto(row) : null;
}

async function readCreditPayments(db, orderNumber) {
  const rows = await db.prepare(`SELECT payments.id,payments.amount_cents,payments.method,payments.note,
    payments.received_at,users.display_name AS received_by
    FROM credit_payments AS payments JOIN users ON users.id=payments.received_by
    WHERE payments.order_number=? ORDER BY payments.received_at DESC`).all(orderNumber);
  return rows.map((row) => ({
    id: row.id, amount: row.amount_cents / 100, method: row.method,
    note: row.note, receivedAt: row.received_at, receivedBy: row.received_by,
  }));
}

async function readCreditSales(db) {
  const rows = await db.prepare(`SELECT credit_sales.*, orders.payload_json, orders.refunded, orders.archived
    FROM credit_sales JOIN orders ON orders.order_number=credit_sales.order_number
    ORDER BY credit_sales.created_at DESC`).all();
  const payments = await db.prepare("SELECT order_number,amount_cents FROM credit_payments").all();
  const paidByOrder = new Map();
  for (const payment of payments) {
    paidByOrder.set(payment.order_number, (paidByOrder.get(payment.order_number) ?? 0) + payment.amount_cents);
  }
  return rows.map((row) => {
    const order = JSON.parse(row.payload_json);
    const paidCents = paidByOrder.get(row.order_number) ?? 0;
    return {
      orderNumber: row.order_number, checkedOutAt: order.checkedOutAt,
      customerName: row.customer_name, customerContact: row.customer_contact,
      dueDate: row.due_date, total: row.total_cents / 100,
      paid: paidCents / 100, balance: row.balance_cents / 100,
      status: row.refunded ? "refunded" : row.balance_cents === 0 ? "paid" : paidCents > 0 ? "partial" : "unpaid",
      archived: Boolean(row.archived),
      items: order.items.map((item) => ({
        productId: item.productId, name: item.name, quantity: item.quantity,
        price: item.price, lineTotal: Math.round(item.price * item.quantity * 100) / 100,
      })),
    };
  });
}

async function readOpeningCredits(db) {
  const rows = await db.prepare("SELECT * FROM opening_credits ORDER BY created_at DESC").all();
  const payments = await db.prepare(`SELECT payments.opening_credit_id,payments.id,payments.amount_cents,payments.note,
    payments.received_at,users.display_name AS received_by
    FROM opening_credit_payments AS payments JOIN users ON users.id=payments.received_by
    ORDER BY payments.received_at DESC`).all();
  const paymentsByCredit = new Map();
  for (const payment of payments) {
    if (!paymentsByCredit.has(payment.opening_credit_id)) paymentsByCredit.set(payment.opening_credit_id, []);
    paymentsByCredit.get(payment.opening_credit_id).push({
      id: payment.id, amount: payment.amount_cents / 100, note: payment.note,
      receivedAt: payment.received_at, receivedBy: payment.received_by,
    });
  }
  return rows.map((row) => ({
    id: row.id, customerName: row.customer_name, customerContact: row.customer_contact,
    itemDetails: row.item_details, priorDate: row.prior_date, recordedAt: row.created_at,
    total: row.total_cents / 100, paid: (row.total_cents - row.balance_cents) / 100,
    balance: row.balance_cents / 100,
    status: row.balance_cents === 0 ? "paid" : row.balance_cents < row.total_cents ? "partial" : "unpaid",
    payments: paymentsByCredit.get(row.id) ?? [],
  }));
}

async function readOrders(db, archived = 0) {
  const rows = await db.prepare(`SELECT orders.*, credit_sales.customer_name,credit_sales.customer_contact,
    credit_sales.due_date,credit_sales.total_cents,credit_sales.balance_cents
    FROM orders LEFT JOIN credit_sales ON credit_sales.order_number=orders.order_number
    WHERE orders.archived=? ORDER BY orders.created_at DESC`).all(archived);
  return rows.map((row) => {
    const credit = row.customer_name == null ? null : creditDto(row);
    return {
      ...orderWithCredit(JSON.parse(row.payload_json), credit, Boolean(row.refunded)),
      refunded: Boolean(row.refunded), refundedAt: row.refunded_at,
    };
  });
}

async function readHolds(db) {
  return (await db.prepare("SELECT payload_json FROM holds ORDER BY created_at DESC").all()).map((row) => JSON.parse(row.payload_json));
}

async function couponForCode(db, code, subtotalCents) {
  if (!code) return null;
  const coupon = await db.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE").get(code);
  if (!coupon || !coupon.active || (coupon.expires_at && Date.parse(coupon.expires_at) < Date.now()) ||
    (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) || subtotalCents < coupon.min_order_cents) {
    throw new ApiError(409, "Coupon is no longer valid for this order.");
  }
  return coupon;
}

async function quote(db, requestedItems, couponCode) {
  requireValid(Array.isArray(requestedItems) && requestedItems.length > 0 && requestedItems.length <= MAX_ITEMS, "Add at least one valid item.");
  const seen = new Set();
  const items = [];
  for (const requested of requestedItems) {
    requireValid(requested && typeof requested.productId === "string" && !seen.has(requested.productId), "Invalid or duplicate product.");
    seen.add(requested.productId);
    const quantity = wholeNumber(requested.quantity, "Quantity");
    requireValid(quantity >= 1 && quantity <= MAX_QUANTITY, "Quantity must be between 1 and 99.");
    const product = await db.prepare("SELECT * FROM products WHERE id = ? AND active=1").get(requested.productId);
    if (!product) throw new ApiError(409, `Product ${requested.productId} is no longer available.`);
    if (product.stock < quantity) throw new ApiError(409, `Only ${product.stock} of ${product.name} available.`);
    items.push({ productId: product.id, name: product.name, category: product.category, price: product.price_cents / 100, quantity, lineCents: product.price_cents * quantity });
  }
  const subtotalCents = items.reduce((sum, item) => sum + item.lineCents, 0);
  const coupon = await couponForCode(db, couponCode, subtotalCents);
  const discountCents = coupon ? Math.min(subtotalCents, coupon.type === "percentage" ? Math.round(subtotalCents * coupon.value / 100) : coupon.value) : 0;
  const taxOverrides = await readTaxRates(db);
  let allocatedDiscount = 0;
  let taxCents = 0;
  const rates = new Set();
  items.forEach((item, index) => {
    const lineDiscount = subtotalCents === 0 ? 0 : index === items.length - 1 ? discountCents - allocatedDiscount : Math.round(discountCents * item.lineCents / subtotalCents);
    allocatedDiscount += lineDiscount;
    const rate = taxOverrides[item.category] ?? CATEGORY_TAX_RATES[item.category] ?? DEFAULT_TAX_RATE;
    rates.add(rate);
    taxCents += Math.round((item.lineCents - lineDiscount) * rate);
    delete item.lineCents;
  });
  const summary = {
    items, itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: subtotalCents / 100, discount: discountCents / 100,
    coupon: coupon ? couponDto(coupon) : null, tax: taxCents / 100,
    taxRateSummary: rates.size === 1 ? `${Math.round([...rates][0] * 100)}%` : "Variable rates",
    total: (subtotalCents - discountCents + taxCents) / 100,
  };
  return summary;
}

export function createApp(db, options = {}) {
  const app = express();
  const secureCookies = options.secureCookies ?? process.env.NODE_ENV === "production";
  const publicOrigin = options.publicOrigin ?? process.env.POS_PUBLIC_ORIGIN;
  app.disable("x-powered-by");
  if (options.trustProxy) app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    res.set("X-Frame-Options", "DENY");
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.use("/api/v1", async (req, _res, next) => {
    try {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const expected = publicOrigin ?? `${req.protocol}://${req.get("host")}`;
      if (req.get("origin") !== expected) return next(new ApiError(403, "Request origin is not allowed."));
    }
    const cookie = req.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("pos_session="));
    const token = cookie?.slice("pos_session=".length);
    if (token) {
      const session = await db.prepare("SELECT sessions.*, users.username, users.display_name, users.role FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ? AND users.active = 1").get(hashToken(token), Date.now());
      if (session) req.session = session;
    }
    next();
    } catch (error) { next(error); }
  });

  function auth(req, _res, next) {
    if (!req.session) return next(new ApiError(401, "Please sign in."));
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("x-csrf-token") !== req.session.csrf_token) return next(new ApiError(403, "Invalid request token."));
    next();
  }
  function admin(req, _res, next) {
    if (req.session.role !== "admin") return next(new ApiError(403, "Administrator access required."));
    next();
  }
  function manager(req, _res, next) {
    if (!MANAGEMENT_ROLES.includes(req.session.role)) return next(new ApiError(403, "Manager access required."));
    next();
  }
  function managerOnly(req, _res, next) {
    if (req.session.role !== "manager") return next(new ApiError(403, "Manager access required."));
    next();
  }

  app.post("/api/v1/auth/login", async (req, res, next) => {
    try {
      const username = text(req.body?.username, 80, "Username");
      const password = req.body?.password;
      requireValid(typeof password === "string" && password.length > 0 && password.length <= 1024, "Password is required and must be at most 1024 characters.");
      const key = `${req.ip}:${username.toLowerCase()}`;
      const now = Date.now();
      const until = now + LOGIN_WINDOW_MS;
      await db.prepare("DELETE FROM login_attempts WHERE until<?").run(now);
      const attempt = await db.prepare("INSERT INTO login_attempts (attempt_key,count,until) VALUES (?,1,?) ON CONFLICT(attempt_key) DO UPDATE SET count=CASE WHEN login_attempts.until>? THEN login_attempts.count+1 ELSE 1 END, until=? RETURNING count")
        .get(key, until, now, until);
      if (attempt.count > MAX_LOGIN_ATTEMPTS) throw new ApiError(429, "Too many login attempts. Try again later.");
      const user = await db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE AND active = 1").get(username);
      if (!user || !verifyPassword(password, user.password_hash)) {
        throw new ApiError(401, "Invalid username or password.");
      }
      await db.prepare("DELETE FROM login_attempts WHERE attempt_key=?").run(key);
      const token = randomToken();
      const csrfToken = randomToken();
      await db.prepare("INSERT INTO sessions (token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)").run(hashToken(token), user.id, csrfToken, Date.now() + SESSION_SECONDS * 1000);
      res.set("Set-Cookie", cookieValue(token, secureCookies));
      res.json({ user: { username: user.username, displayName: user.display_name, role: user.role }, csrfToken });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/auth/me", auth, (req, res) => res.json({ user: { username: req.session.username, displayName: req.session.display_name, role: req.session.role }, csrfToken: req.session.csrf_token }));
  app.post("/api/v1/auth/logout", auth, async (req, res) => {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(req.session.token_hash);
    res.set("Set-Cookie", clearCookie(secureCookies));
    res.json({ ok: true });
  });
  app.post("/api/v1/users", auth, admin, async (req, res, next) => {
    try {
      const username = text(req.body?.username, 80, "Username");
      const displayName = text(req.body?.displayName, 100, "Display name");
      const password = req.body?.password;
      requireValid(/^[a-zA-Z0-9._-]+$/.test(username), "Username may contain only letters, numbers, periods, underscores, and hyphens.");
      requireValid(typeof password === "string" && password.length >= 12 && password.length <= 1024, "Password must have 12 to 1024 characters.");
      requireValid(ACCOUNT_ROLES.includes(req.body?.role), "Invalid role.");
      await db.prepare("INSERT INTO users (id,username,display_name,role,password_hash,created_at) VALUES (?,?,?,?,?,?)").run(randomUUID(), username, displayName, req.body.role, hashPassword(password), new Date().toISOString());
      res.status(201).json({ ok: true });
    } catch (error) { next(error); }
  });

  app.get("/api/v1/bootstrap", auth, async (_req, res) => res.json({ products: await readProducts(db), coupons: await readCoupons(db), taxRates: await readTaxRates(db), orders: await readOrders(db), parkedOrders: await readHolds(db) }));
  app.get("/api/v1/menu", async (_req, res, next) => {
    try {
      const products = await db.prepare("SELECT name,category,price_cents FROM products WHERE active=1 AND stock > 0 ORDER BY category,name").all();
      res.json(products.map((product) => ({ name: product.name, category: product.category, price: product.price_cents / 100 })));
    } catch (error) { next(error); }
  });
  app.get("/api/v1/products", auth, async (_req, res) => res.json(await readProducts(db)));
  function productInput(body) {
    return {
      name: text(body?.name, 100, "Name"), category: text(body?.category, 80, "Category"),
      sku: optionalText(body?.sku, 80) || null, priceCents: cents(body?.price, "Price"),
      stock: wholeNumber(body?.stock, "Stock"), threshold: wholeNumber(body?.lowStockThreshold, "Low stock threshold"),
    };
  }
  app.post("/api/v1/products", auth, manager, async (req, res, next) => {
    try {
      const input = productInput(req.body);
      const id = `p-${randomUUID()}`;
      await db.prepare("INSERT INTO products (id,sku,name,category,price_cents,stock,low_stock_threshold) VALUES (?,?,?,?,?,?,?)").run(id, input.sku, input.name, input.category, input.priceCents, input.stock, input.threshold);
      res.status(201).json({ ok: true, message: `\"${input.name}\" added successfully.`, products: await readProducts(db) });
    } catch (error) { next(error); }
  });
  app.put("/api/v1/products/:id", auth, manager, async (req, res, next) => {
    try {
      const input = productInput(req.body);
      const result = await db.prepare("UPDATE products SET sku=?, name=?, category=?, price_cents=?, stock=?, low_stock_threshold=? WHERE id=? AND active=1").run(input.sku, input.name, input.category, input.priceCents, input.stock, input.threshold, req.params.id);
      if (!result.changes) throw new ApiError(404, "Product not found.");
      res.json({ ok: true, message: `\"${input.name}\" updated successfully.`, products: await readProducts(db) });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/product-delete-requests", auth, manager, async (req, res, next) => {
    try {
      res.json(await readPendingProductRequests(db, req.session.role === "manager" ? req.session.user_id : null));
    } catch (error) { next(error); }
  });
  app.post("/api/v1/products/:id/delete-request", auth, managerOnly, async (req, res, next) => {
    try {
      const result = await db.transaction(async () => {
        const product = await db.prepare("SELECT id,name FROM products WHERE id=? AND active=1").get(req.params.id);
        if (!product) throw new ApiError(404, "Product not found in the active catalog.");
        await ensureProductIsNotParked(db, product.id);
        await db.prepare("INSERT INTO product_delete_requests (id,product_id,product_name,requested_by,requested_at,status,pending_product_id) VALUES (?,?,?,?,?,'pending',?)")
          .run(randomUUID(), product.id, product.name, req.session.user_id, new Date().toISOString(), product.id);
        return product;
      });
      res.status(201).json({ ok: true, message: `Removal request for \"${result.name}\" sent to an admin.`, requests: await readPendingProductRequests(db, req.session.user_id) });
    } catch (error) {
      if (error.code === "23505") return next(new ApiError(409, "A removal request for this product is already pending admin approval."));
      next(error);
    }
  });
  app.post("/api/v1/product-delete-requests/:id/decision", auth, admin, async (req, res, next) => {
    try {
      requireValid(["approve", "reject"].includes(req.body?.decision), "Decision must be approve or reject.");
      const decision = req.body.decision;
      const request = await db.transaction(async () => {
        const pending = await db.prepare("SELECT * FROM product_delete_requests WHERE id=? AND status='pending'").get(req.params.id);
        if (!pending) throw new ApiError(404, "Pending removal request not found.");
        if (decision === "approve") {
          const product = await db.prepare("SELECT id FROM products WHERE id=? AND active=1").get(pending.product_id);
          if (!product) throw new ApiError(409, "Product is no longer in the active catalog.");
          await ensureProductIsNotParked(db, product.id);
          await db.prepare("UPDATE products SET active=0, archived_name=name, archived_sku=sku, name='Archived ' || id, sku=NULL WHERE id=? AND active=1").run(product.id);
        }
        await db.prepare("UPDATE product_delete_requests SET status=?, pending_product_id=NULL, reviewed_by=?, reviewed_at=? WHERE id=? AND status='pending'")
          .run(decision === "approve" ? "approved" : "rejected", req.session.user_id, new Date().toISOString(), pending.id);
        return pending;
      });
      res.json({ ok: true, message: decision === "approve" ? `\"${request.product_name}\" removed from the active catalog.` : `Removal request for \"${request.product_name}\" rejected.`, products: await readProducts(db), requests: await readPendingProductRequests(db) });
    } catch (error) { next(error); }
  });
  app.delete("/api/v1/products/:id", auth, admin, async (req, res, next) => {
    try {
      const product = await db.transaction(async () => {
        const active = await db.prepare("SELECT id,name FROM products WHERE id=? AND active=1").get(req.params.id);
        if (!active) throw new ApiError(404, "Product not found in the active catalog.");
        await ensureProductIsNotParked(db, active.id);
        await db.prepare("UPDATE products SET active=0, archived_name=name, archived_sku=sku, name='Archived ' || id, sku=NULL WHERE id=? AND active=1").run(active.id);
        await db.prepare("UPDATE product_delete_requests SET status='approved', pending_product_id=NULL, reviewed_by=?, reviewed_at=? WHERE pending_product_id=?")
          .run(req.session.user_id, new Date().toISOString(), active.id);
        return active;
      });
      res.json({ ok: true, message: `\"${product.name}\" removed from the active catalog. Past sales and refunds remain intact.`, products: await readProducts(db), requests: await readPendingProductRequests(db) });
    } catch (error) { next(error); }
  });
  app.delete("/api/v1/products", auth, admin, async (req, res, next) => {
    try { await db.transaction(async () => {
      if (await db.prepare("SELECT 1 FROM holds LIMIT 1").get()) throw new ApiError(409, "Remove parked orders before clearing the catalog.");
      await db.prepare("UPDATE products SET active=0, archived_name=name, archived_sku=sku, name='Archived ' || id, sku=NULL WHERE active=1").run();
      await db.prepare("UPDATE product_delete_requests SET status='approved', pending_product_id=NULL, reviewed_by=?, reviewed_at=? WHERE status='pending'")
        .run(req.session.user_id, new Date().toISOString());
    });
    res.json({ ok: true, message: "Active product catalog cleared. Past sales and refunds remain intact.", products: await readProducts(db), requests: await readPendingProductRequests(db) });
    } catch (error) { next(error); }
  });
  app.put("/api/v1/tax-rates/:category", auth, manager, async (req, res, next) => {
    try {
      const category = text(req.params.category, 80, "Category");
      const rate = Number(req.body?.rate);
      requireValid((typeof req.body?.rate === "number" || typeof req.body?.rate === "string") && req.body.rate !== "" && Number.isFinite(rate) && rate >= 0 && rate <= 1, "Tax rate must be between 0 and 1.");
      await db.prepare("INSERT INTO tax_rates (category,rate) VALUES (?,?) ON CONFLICT(category) DO UPDATE SET rate=excluded.rate").run(category, rate);
      res.json({ ok: true, message: `Tax rate for ${category} updated.`, taxRates: await readTaxRates(db) });
    } catch (error) { next(error); }
  });
  app.delete("/api/v1/tax-rates", auth, manager, async (_req, res) => {
    await db.prepare("DELETE FROM tax_rates").run();
    res.json({ ok: true, message: "Category tax rates reset to defaults.", taxRates: {} });
  });

  app.post("/api/v1/holds", auth, async (req, res, next) => {
    try {
      const hold = await db.transaction(async () => {
        const summary = await quote(db, req.body?.items, req.body?.couponCode);
        const holdNumber = `HOLD-${randomUUID()}`;
        const payload = { ...summary, holdNumber, parkedAt: new Date().toISOString(), customerLabel: optionalText(req.body?.customerLabel, 60), note: optionalText(req.body?.note, 140) };
        await db.prepare("INSERT INTO holds (hold_number,payload_json,created_at,created_by) VALUES (?,?,?,?)").run(holdNumber, JSON.stringify(payload), payload.parkedAt, req.session.user_id);
        return payload;
      });
      res.status(201).json({ ok: true, message: `Order parked as ${hold.holdNumber}.`, hold, parkedOrders: await readHolds(db) });
    } catch (error) { next(error); }
  });
  app.post("/api/v1/holds/:number/recall", auth, async (req, res, next) => {
    try {
      const hold = await db.transaction(async () => {
        const row = await db.prepare("SELECT payload_json FROM holds WHERE hold_number=?").get(req.params.number);
        if (!row) throw new ApiError(404, "Parked order not found.");
        const payload = JSON.parse(row.payload_json);
        const refreshed = await quote(db, payload.items, payload.coupon?.code);
        await db.prepare("DELETE FROM holds WHERE hold_number=?").run(req.params.number);
        return { ...payload, ...refreshed };
      });
      res.json({ ok: true, message: `Recalled ${hold.holdNumber} into the current cart.`, hold, parkedOrders: await readHolds(db) });
    } catch (error) { next(error); }
  });
  app.delete("/api/v1/holds/:number", auth, async (req, res, next) => {
    try {
      const result = await db.prepare("DELETE FROM holds WHERE hold_number=?").run(req.params.number);
      if (!result.changes) throw new ApiError(404, "Parked order not found.");
      res.json({ ok: true, message: `Removed parked order ${req.params.number}.`, parkedOrders: await readHolds(db) });
    } catch (error) { next(error); }
  });

  app.post("/api/v1/orders", auth, async (req, res, next) => {
    try {
      const sale = await db.transaction(async () => {
        requireValid(typeof req.body?.checkoutKey === "string" && /^[0-9a-f-]{36}$/i.test(req.body.checkoutKey), "Invalid checkout request ID.");
        const previous = await db.prepare("SELECT payload_json FROM orders WHERE checkout_key=?").get(req.body.checkoutKey);
        if (previous) {
          const order = JSON.parse(previous.payload_json);
          const credit = await readCreditSale(db, order.orderNumber);
          return { order: orderWithCredit(order, credit), products: await readProducts(db), coupons: await readCoupons(db) };
        }
        const summary = await quote(db, req.body?.items, req.body?.couponCode);
        const paymentMethod = req.body?.paymentMethod;
        requireValid(["cash", "card", "e-wallet", "credit"].includes(paymentMethod), "Invalid payment method.");
        const tenderedCents = paymentMethod === "cash" ? cents(req.body?.cashTendered, "Cash tendered") : null;
        if (paymentMethod === "cash" && tenderedCents < Math.round(summary.total * 100)) throw new ApiError(409, "Cash tendered is less than total.");
        const customerName = paymentMethod === "credit" ? text(req.body?.customerName, 100, "Customer name") : null;
        const customerContact = paymentMethod === "credit" ? optionalText(req.body?.customerContact, 100) || null : null;
        const dueDate = paymentMethod === "credit" ? optionalText(req.body?.dueDate, 10) || null : null;
        if (dueDate) requireValid(/^\d{4}-\d{2}-\d{2}$/.test(dueDate) && !Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)) && new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) === dueDate, "Due date must be a valid date.");
        const totalCents = Math.round(summary.total * 100);
        if (paymentMethod === "credit") requireValid(totalCents > 0, "Utang requires an amount due greater than zero.");
        for (const item of summary.items) {
          const result = await db.prepare("UPDATE products SET stock=stock-CAST(? AS INTEGER) WHERE id=? AND stock>=CAST(? AS INTEGER)").run(item.quantity, item.productId, item.quantity);
          if (!result.changes) throw new ApiError(409, `Insufficient stock for ${item.name}.`);
        }
        if (summary.coupon) await db.prepare("UPDATE coupons SET used_count=used_count+1 WHERE id=?").run(summary.coupon.id);
        const payload = {
          ...summary, orderNumber: `ORD-${randomUUID()}`, checkedOutAt: new Date().toISOString(),
          payment: {
            paymentMethod,
            verificationStatus: paymentMethod === "credit" ? "unpaid" : paymentMethod === "cash" ? "cash_recorded" : "not_verified",
            cashTendered: tenderedCents === null ? null : tenderedCents / 100,
            change: tenderedCents === null ? null : (tenderedCents - Math.round(summary.total * 100)) / 100,
          },
        };
        await db.prepare("INSERT INTO orders (order_number,payload_json,created_at,created_by,checkout_key) VALUES (?,?,?,?,?)").run(payload.orderNumber, JSON.stringify(payload), payload.checkedOutAt, req.session.user_id, req.body.checkoutKey);
        if (paymentMethod === "credit") {
          await db.prepare("INSERT INTO credit_sales (order_number,customer_name,customer_contact,due_date,total_cents,balance_cents,created_at) VALUES (?,?,?,?,?,?,?)")
            .run(payload.orderNumber, customerName, customerContact, dueDate, totalCents, totalCents, payload.checkedOutAt);
          payload.credit = { customerName, customerContact, dueDate, total: summary.total, balance: summary.total };
        }
        return { order: payload, products: await readProducts(db), coupons: await readCoupons(db) };
      });
      res.status(201).json({ ok: true, message: `Sale recorded as ${sale.order.orderNumber}.`, ...sale });
    } catch (error) {
      if (error.code === "23505" && error.constraint === "orders_checkout_key_key") {
        try {
          const previous = await db.prepare("SELECT payload_json FROM orders WHERE checkout_key=?").get(req.body?.checkoutKey);
          if (previous) {
            const order = JSON.parse(previous.payload_json);
            const credit = await readCreditSale(db, order.orderNumber);
            res.status(201).json({ ok: true, message: `Sale recorded as ${order.orderNumber}.`, order: orderWithCredit(order, credit), products: await readProducts(db), coupons: await readCoupons(db) });
            return;
          }
        } catch (lookupError) { next(lookupError); return; }
      }
      next(error);
    }
  });
  app.post("/api/v1/orders/:number/refund", auth, manager, async (req, res, next) => {
    try {
      const hadCreditPayments = await db.transaction(async () => {
        const row = await db.prepare("SELECT * FROM orders WHERE order_number=?").get(req.params.number);
        if (!row) throw new ApiError(404, "Order not found.");
        if (row.refunded) throw new ApiError(409, "Order has already been refunded.");
        const order = JSON.parse(row.payload_json);
        for (const item of order.items) {
          const result = await db.prepare("UPDATE products SET stock=stock+CAST(? AS INTEGER) WHERE id=?").run(item.quantity, item.productId);
          if (!result.changes) throw new ApiError(409, `Cannot restore stock: product ${item.name} no longer exists.`);
        }
        await db.prepare("UPDATE orders SET refunded=1, refunded_at=? WHERE order_number=?").run(new Date().toISOString(), req.params.number);
        await db.prepare("UPDATE credit_sales SET balance_cents=0 WHERE order_number=?").run(req.params.number);
        return Boolean(await db.prepare("SELECT 1 FROM credit_payments WHERE order_number=? LIMIT 1").get(req.params.number));
      });
      const repaymentNotice = hadCreditPayments ? " Return any collected utang repayments outside Mini POS." : "";
      res.json({ ok: true, message: `Refund recorded for ${req.params.number}; inventory restored. Return any card or e-wallet funds outside Mini POS.${repaymentNotice}`, products: await readProducts(db), orders: await readOrders(db) });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/credit-sales", auth, async (_req, res, next) => {
    try { res.json(await readCreditSales(db)); }
    catch (error) { next(error); }
  });
  app.get("/api/v1/opening-credits", auth, async (_req, res, next) => {
    try { res.json(await readOpeningCredits(db)); }
    catch (error) { next(error); }
  });
  app.post("/api/v1/opening-credits", auth, async (req, res, next) => {
    try {
      requireValid(typeof req.body?.entryKey === "string" && /^[0-9a-f-]{36}$/i.test(req.body.entryKey), "Invalid opening credit request ID.");
      const customerName = text(req.body.customerName, 100, "Customer name");
      const customerContact = optionalText(req.body.customerContact, 100) || null;
      const itemDetails = optionalText(req.body.itemDetails, 500) || null;
      const priorDate = optionalText(req.body.priorDate, 10) || null;
      if (priorDate) requireValid(/^\d{4}-\d{2}-\d{2}$/.test(priorDate) && !Number.isNaN(Date.parse(`${priorDate}T00:00:00Z`)) && new Date(`${priorDate}T00:00:00Z`).toISOString().slice(0, 10) === priorDate, "Prior date must be a valid date.");
      const totalCents = cents(req.body.amount, "Opening balance");
      requireValid(totalCents > 0, "Opening balance must be greater than zero.");
      const result = await db.transaction(async () => {
        const previous = await db.prepare("SELECT * FROM opening_credits WHERE entry_key=?").get(req.body.entryKey);
        if (previous) {
          if (previous.customer_name !== customerName || previous.customer_contact !== customerContact || previous.item_details !== itemDetails || previous.prior_date !== priorDate || previous.total_cents !== totalCents) {
            throw new ApiError(409, "Opening credit request ID was already used for a different balance.");
          }
          return { duplicate: true };
        }
        await db.prepare(`INSERT INTO opening_credits
          (id,entry_key,customer_name,customer_contact,item_details,prior_date,total_cents,balance_cents,created_at,created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .run(randomUUID(), req.body.entryKey, customerName, customerContact, itemDetails, priorDate, totalCents, totalCents, new Date().toISOString(), req.session.user_id);
        return { duplicate: false };
      });
      res.status(result.duplicate ? 200 : 201).json({
        ok: true, message: result.duplicate ? "Opening balance was already recorded." : "Opening balance recorded.",
        openingCredits: await readOpeningCredits(db),
      });
    } catch (error) { next(error); }
  });
  app.post("/api/v1/opening-credits/:id/payments", auth, async (req, res, next) => {
    try {
      const amountCents = cents(req.body?.amount, "Repayment amount");
      requireValid(amountCents > 0, "Repayment amount must be greater than zero.");
      requireValid(typeof req.body?.paymentKey === "string" && /^[0-9a-f-]{36}$/i.test(req.body.paymentKey), "Invalid repayment request ID.");
      const note = optionalText(req.body?.note, 200) || null;
      const result = await db.transaction(async () => {
        const previous = await db.prepare("SELECT opening_credit_id,amount_cents FROM opening_credit_payments WHERE payment_key=?").get(req.body.paymentKey);
        if (previous) {
          if (previous.opening_credit_id !== req.params.id || previous.amount_cents !== amountCents) throw new ApiError(409, "Repayment request ID was already used for a different payment.");
          return { duplicate: true };
        }
        const updated = await db.prepare(`UPDATE opening_credits SET balance_cents=balance_cents-CAST(? AS INTEGER)
          WHERE id=? AND balance_cents>=CAST(? AS INTEGER)`).run(amountCents, req.params.id, amountCents);
        if (!updated.changes) {
          if (!await db.prepare("SELECT 1 FROM opening_credits WHERE id=?").get(req.params.id)) throw new ApiError(404, "Opening credit not found.");
          throw new ApiError(409, "Repayment exceeds the outstanding balance.");
        }
        await db.prepare(`INSERT INTO opening_credit_payments
          (id,opening_credit_id,payment_key,amount_cents,note,received_by,received_at) VALUES (?,?,?,?,?,?,?)`)
          .run(randomUUID(), req.params.id, req.body.paymentKey, amountCents, note, req.session.user_id, new Date().toISOString());
        return { duplicate: false };
      });
      res.status(result.duplicate ? 200 : 201).json({
        ok: true, message: result.duplicate ? "Repayment was already recorded." : "Cash repayment recorded.",
        openingCredits: await readOpeningCredits(db),
      });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/orders/:number/credit-payments", auth, async (req, res, next) => {
    try {
      if (!await readCreditSale(db, req.params.number)) throw new ApiError(404, "Utang sale not found.");
      res.json(await readCreditPayments(db, req.params.number));
    } catch (error) { next(error); }
  });
  app.post("/api/v1/orders/:number/credit-payments", auth, async (req, res, next) => {
    try {
      const amountCents = cents(req.body?.amount, "Repayment amount");
      requireValid(amountCents > 0, "Repayment amount must be greater than zero.");
      requireValid(req.body?.method === "cash", "Only cash repayments can be recorded.");
      requireValid(typeof req.body?.paymentKey === "string" && /^[0-9a-f-]{36}$/i.test(req.body.paymentKey), "Invalid repayment request ID.");
      const note = optionalText(req.body?.note, 200) || null;
      const result = await db.transaction(async () => {
        const previous = await db.prepare("SELECT order_number,amount_cents FROM credit_payments WHERE payment_key=?").get(req.body.paymentKey);
        if (previous) {
          if (previous.order_number !== req.params.number || previous.amount_cents !== amountCents) throw new ApiError(409, "Repayment request ID was already used for a different payment.");
          return { duplicate: true };
        }
        const order = await db.prepare("SELECT refunded FROM orders WHERE order_number=?").get(req.params.number);
        const credit = await db.prepare("SELECT balance_cents FROM credit_sales WHERE order_number=?").get(req.params.number);
        if (!order || !credit) throw new ApiError(404, "Utang sale not found.");
        if (order.refunded) throw new ApiError(409, "Refunded sales cannot receive repayments.");
        if (amountCents > credit.balance_cents) throw new ApiError(409, "Repayment exceeds the outstanding balance.");
        const updated = await db.prepare("UPDATE credit_sales SET balance_cents=balance_cents-CAST(? AS INTEGER) WHERE order_number=? AND balance_cents>=CAST(? AS INTEGER)").run(amountCents, req.params.number, amountCents);
        if (!updated.changes) throw new ApiError(409, "Repayment exceeds the outstanding balance.");
        await db.prepare("INSERT INTO credit_payments (id,order_number,payment_key,amount_cents,method,note,received_by,received_at) VALUES (?,?,?,?,?,?,?,?)")
          .run(randomUUID(), req.params.number, req.body.paymentKey, amountCents, "cash", note, req.session.user_id, new Date().toISOString());
        return { duplicate: false };
      });
      res.status(result.duplicate ? 200 : 201).json({
        ok: true, message: result.duplicate ? "Repayment was already recorded." : "Cash repayment recorded.",
        credit: await readCreditSale(db, req.params.number),
        payments: await readCreditPayments(db, req.params.number),
        orders: await readOrders(db),
      });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/orders/archive", auth, manager, async (_req, res) => {
    res.json(await readOrders(db, 1));
  });
  app.delete("/api/v1/orders", auth, manager, async (_req, res) => {
    await db.prepare("UPDATE orders SET archived=1 WHERE archived=0 AND order_number NOT IN (SELECT order_number FROM credit_sales WHERE balance_cents>0)").run();
    res.json({ ok: true, message: "Paid orders archived. Utang orders with a balance remain visible.", orders: await readOrders(db) });
  });

  const dist = fileURLToPath(new URL("../../dist", import.meta.url));
  if (options.serveStatic !== false && existsSync(dist)) {
    app.use(express.static(dist, { index: false }));
    app.use((req, res, next) => req.method === "GET" && !req.path.startsWith("/api/") ? res.sendFile(resolve(dist, "index.html")) : next());
  }
  app.use((error, _req, res, _next) => {
    if (error instanceof ApiError) return res.status(error.status).json({ ok: false, message: error.message });
    if (["23505", "23503", "23514"].includes(error.code)) return res.status(409).json({ ok: false, message: "This value already exists or violates a data constraint." });
    if (error.status === 400) return res.status(400).json({ ok: false, message: "Invalid request body." });
    if (error.type === "entity.too.large") return res.status(413).json({ ok: false, message: "Request is too large." });
    console.error(error);
    res.status(500).json({ ok: false, message: "Server error. Please try again." });
  });
  return app;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const db = openDatabase();
  await initializeDatabase(db);
  const port = Number(process.env.PORT ?? 3000);
  createApp(db).listen(port, () => console.log(`Mini POS server listening on http://localhost:${port}`));
}
