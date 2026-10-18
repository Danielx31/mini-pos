# Mini POS System

A Point of Sale (POS) system built with Vue 3, Vite, Pinia, a Node.js API, and PostgreSQL.

## Run with PostgreSQL

Use Node.js 22.9 or newer. Install both projects once:

```powershell
npm install
npm --prefix server install
```

Create a PostgreSQL database first. For the linked Neon project, sign in and deploy the Postgres service from the project root:

```powershell
neon login
neon init -y --no-agent-setup --org-id org-quiet-unit-49782796 --project-id bitter-hill-56633944 --branch production --services postgres
neon config plan
neon deploy
```

The Codex Neon plugin is installed separately and includes the Neon MCP server. The `--no-agent-setup` flag avoids reinstalling it. `neon deploy` pulls database environment variables into the gitignored `.env.local` file, which the Node commands load automatically. Keep the URL and password out of Git and chat. If you use another PostgreSQL provider, set `DATABASE_URL` in every terminal running the API, import, or account commands; replace the text inside the quotes below with the real URL:

```powershell
$env:DATABASE_URL = "PASTE_YOUR_REAL_POSTGRESQL_CONNECTION_URL_HERE"
```

Do not run the command with `PASTE_YOUR_REAL_POSTGRESQL_CONNECTION_URL_HERE` still in it. The account command checks the database connection first, then initializes the schema and prompts for a password of at least 12 characters without displaying it:

```powershell
npm --prefix server run create-user -- admin yourname "Your Name"
```

If Neon provides both `DATABASE_URL` (direct) and `DATABASE_URL_POOLED`, keep both in the local environment. The POS server prefers the pooled URL; account setup and SQLite import use the direct URL. Neon CLI may instead provide `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct); the app supports that naming too. `neon deploy` pulls these into a gitignored `.env.local`, which the Node commands load automatically. An old `DATABASE_URL` already set in PowerShell takes precedence over `.env.local`, so clear an obsolete value with `Remove-Item Env:DATABASE_URL` before running the commands.

After signing in as an administrator, open **Accounts** in the POS navigation to create cashier, manager, or administrator accounts. Only administrators can open that page or use its API endpoint. You can also create accounts from the terminal with the command above, using `manager` or `cashier` as the role. The terminal command requires direct database access and is intended for setup and recovery. To reset a password or disable an account, run `npm --prefix server run manage-user -- reset-password username` or `npm --prefix server run manage-user -- disable username`. `enable username` reactivates an account. Password resets and status changes revoke existing sessions.

| Role | Access |
| --- | --- |
| Cashier | Sales, order history, and parked orders |
| Manager | Cashier access plus product editing, removal requests, taxes, analytics, refunds, and order archives |
| Admin | Manager access plus account creation, product removal approval, and direct catalog removal |

Start the API and Vue development server in separate terminals. The development API command restarts automatically when you edit files in `server/src`:

```powershell
npm run server:dev
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`) or `/menu` to see the public customer menu. Staff sign in at `/admin-pos`; after sign-in, that same URL shows the POS. Vite proxies `/api` to the Node server on port 3000. No default passwords or demo accounts are installed. PostgreSQL stores the application data; `DATABASE_URL` must be available to the Node process.

The API owns users, sessions, products, stock, orders, refunds, coupons, tax rates, and parked orders. Cashiers may sell and hold orders. Managers may edit products and request their removal. Only admins can approve or reject those requests, remove a product immediately, or use **Products → Clear Catalog**. Removal archives a product in PostgreSQL, hides it from the POS and customer menu, and releases its name and SKU for reuse. The archived row keeps its original name and SKU in `archived_name` and `archived_sku`; recorded sales and refunds keep their product references. Parked orders must be cleared before the referenced product can be removed. Admins alone can create accounts in the application. Archived orders remain in PostgreSQL and are available to managers and admins from `GET /api/v1/orders/archive`. The server recalculates sale totals and changes stock and orders in one PostgreSQL transaction. Card and e-wallet choices record only the selected method with `verificationStatus: "not_verified"`; staff must confirm those payments outside Mini POS. This project does not charge a card or wallet or return funds for a recorded refund. Sales totals include unverified electronic methods and are labeled as recorded sales.

Money is entered in pesos with at most two decimal places. Checkout, discounts, tax, cash change, and reports calculate in integer cent values, with tax rounded per line. Stock, low stock thresholds, sale quantities, and disposal quantities must be whole numbers; entries such as `3.5` are rejected by the API.

Only managers and admins can record refunds. Refunded orders remain in order history for review but are excluded from recorded sales totals, analytics charts, and product sales rankings.

Managers and admins can choose a customer menu emoji when adding or editing a product in **Products**. The icon appears on the public menu while the product is in stock. Existing products and products set to **Category default** keep their category icon. Run `npm --prefix server run migrate` with the direct PostgreSQL connection before deploying this change to an existing database; the migration adds a nullable icon column without changing existing products.

For expired items found during a manual shelf check, managers and admins can use **Products → Dispose expired**. Enter the number of units to discard, with optional package expiry date and note. Mini POS subtracts those units from sellable stock and records who disposed of them and when; it does not create a sale or change sales totals. The latest 100 entries are visible in **Expired stock disposal history**. When stock reaches zero, the product no longer appears on the customer menu and checkout rejects it. Products do not track separate expiry dates for individual batches, so choose the quantity you inspected.

When holding a sale, the server checks current products and stock and assigns a UUID-based hold number. Recall checks availability again and leaves the hold in place if an item is unavailable or stock is insufficient. If the network fails while saving or recalling, keep the POS tab open and use **Retry Hold Order** or **Retry Recall**. The cart is paused until that retry confirms the result; the same request ID prevents a duplicate hold or recall. A page reload clears this pending retry state, so check the parked order list before starting a new hold.

### Customer utang (pay later)

Any signed-in staff member can choose **Utang · Pay later** at checkout. Enter a customer name, with optional contact details and due date. The sale reduces stock and records the full amount as an unpaid balance; it does not record cash received. The staff-only **Utang list** (`/credits`) shows every customer's utang sale, its items and recorded unit prices, total, cash repaid, and balance, including sales whose orders were archived. Search and filter the list, then use **Record payment** to open an unpaid sale in **Orders**. Partial cash repayments are allowed up to the remaining balance. The receipt and order history show the current balance, and outstanding utang appears separately from recorded sales totals. Card and e-wallet repayments are not supported because Mini POS cannot verify those payments. Each repayment records who entered it and when; retries use a unique request ID to avoid recording the same repayment twice. Orders with an outstanding balance stay visible when paid orders are archived. Refunding an utang sale cancels its remaining balance while preserving repayment history; return any collected cash outside Mini POS.

To carry forward credit from before Mini POS, open the staff-only **Utang list** and use **Add credit from before Mini POS**. Enter the amount still owed after any earlier payments, with the customer's name and optional matching contact, original date, and item details. This opening balance appears in the customer and overall Utang totals but does not create a sale or change stock. Open the customer to record later cash repayments and see who recorded them. Use the same name and contact as future utang sales so the records group together. **Orders** reports outstanding POS utang only; the Utang list includes both POS sales and opening balances.

### Move existing SQLite data

Keep a backup of `server/data/pos.sqlite` and stop the old API before the final import. With `DATABASE_URL` pointing to a **fresh** PostgreSQL database, run:

```powershell
npm --prefix server run import-sqlite
```

The importer copies users, password hashes, products, coupons, tax rates, orders, and parked orders in one transaction. It does not import sessions; users sign in again. It refuses a PostgreSQL database with existing users or sales, or a catalog that is not fresh. Imported SQLite products appear in the new catalog. If they are only sample products, an admin can use **Products → Clear Catalog** after resolving any parked orders to start empty. Keep the SQLite backup until you have checked accounts, stock, and order history in the new database. Do not create a new admin first when importing existing users.

### Deploy on Vercel

Connect a PostgreSQL provider through the Vercel Marketplace or another hosted PostgreSQL service. Set `DATABASE_URL` in the Vercel project environment. For Production, set `POS_PUBLIC_ORIGIN` to the exact HTTPS site origin; Preview deployments can omit it and use their request origin. Initialize the database from a trusted terminal using `create-user` or `import-sqlite` **before** deploying, with the same `DATABASE_URL`. Vercel builds the Vue frontend and routes `/api/v1/*` to a Node Function using `vercel.json`. Use a separate PostgreSQL database for Preview deployments so test sales do not enter production. The function also initializes the schema on cold start.

Before deploying catalog or utang changes to an existing Vercel database, run `npm --prefix server run migrate` from a trusted terminal with `.env.local` pointing to that database. The command uses the direct PostgreSQL URL and adds the archive, approval, and utang tables without removing existing products or sales. Test it against a Neon development branch first, then run it against production and redeploy Vercel. This keeps schema changes under your control rather than waiting for a Vercel cold start.

For an IIS deployment, run `npm run build` and `npm run server` with `NODE_ENV=production` and `POS_PUBLIC_ORIGIN` set to the site's exact HTTPS origin. The Node server serves `dist` and the API on port 3000. On IIS, install URL Rewrite and Application Request Routing, enable proxying, terminate HTTPS at IIS, and use the generated `dist/web.config` to forward all requests to the Node process. Set `PORT` if port 3000 is unavailable, and update `public/web.config` and `vite.config.js` accordingly.

Existing browser `localStorage` records are left untouched and are not automatically imported. Back up the old browser data before switching a live register. A fresh PostgreSQL database starts with an empty product catalog and sample coupons; create a first user with the command above, then add your own products in **Products**.

Run the full quality gate with `npm run check` before deploying.

## Tech Stack & Syntax

This project uses the following technologies and syntax patterns:

### Frontend Framework

- **Vue 3** with Composition API and `<script setup>` syntax
  - Why: Vue 3 provides better performance, TypeScript support, and modern reactivity system compared to Vue 2
  - Syntax: `<script setup>` for cleaner component code without explicit `setup()` function

### Build Tool

- **Vite** for fast development and optimized production builds
  - Why: Significantly faster than traditional bundlers like Webpack, with hot module replacement

### State Management

- **Pinia** (Vue's official state management library)
  - Why: Lightweight, TypeScript-friendly, and designed specifically for Vue 3 (replaces Vuex)
  - Syntax: Uses Composition API with `defineStore()` and reactive refs/computed

### Routing

- **Vue Router 4** with programmatic navigation
  - Why: Official Vue routing solution with route guards and lazy loading support

### Styling

- **Tailwind CSS** for utility-first CSS
  - Why: Rapid UI development, consistent design system, small bundle size with purging

### Development Tools

- **ESLint** for JavaScript, TypeScript, and Vue linting
- **vue-tsc** for TypeScript and typed Vue component checks
- **Node.js test runner** for API and frontend regression tests

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── AppNavbar.vue    # Navigation bar component
│   └── HelloWorld.vue   # Example component
├── views/               # Page-level components (routes)
│   ├── DashboardView.vue      # Main POS interface
│   ├── LoginView.vue          # Authentication page
│   ├── OrderHistoryView.vue   # Transaction history
│   └── ProductManagementView.vue # Product CRUD interface
├── layouts/             # Layout components (future use)
├── ui/                  # UI-specific components (future use)
├── composables/         # Custom Vue composables (hooks)
│   └── useFormatters.js # Currency/date formatting logic
├── stores/              # Pinia state management stores
│   ├── auth.js          # Authentication state
│   ├── pos.js           # POS/cart logic
│   ├── products.js      # Product catalog state
│   ├── orders.js        # Order history state
│   └── coupons.js       # Discount/coupon logic
├── services/            # API services and business logic (future use)
├── utils/               # Pure utility functions (future use)
├── constants/           # Application constants
│   └── routes.js        # Route names and config
├── router/              # Vue Router configuration
│   └── index.js         # Route definitions and guards
├── assets/              # Static assets (images, icons)
└── main.js              # Application entry point
```

### Folder Organization Rationale

- **components/**: Reusable components that can be used across multiple pages
- **views/**: Page-level components that correspond to routes (following Vue.js conventions)
- **composables/**: Custom logic hooks using Vue's Composition API (equivalent to React hooks)
- **stores/**: Global state management with Pinia stores for different domains
- **constants/**: Magic numbers and strings that are used across the app
- **services/**: API calls and external service integrations (expandable for backend integration)

## Features

- 🔐 Server sessions with role permissions
- 🛒 Point of sale interface with cart management
- 📊 Product catalog management (CRUD operations)
- 📋 Order/transaction history
- 💰 Discount and coupon system
- 📱 Responsive design with Tailwind CSS
- 🛡️ Route guards for protected pages

## Getting Started

### Prerequisites

- Node.js 22.9+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Quality checks

Install both lockfiles, then run the same checks used by GitHub Actions:

```powershell
npm ci
npm ci --prefix server
npm run check
```

`npm run check` runs ESLint, Vue/TypeScript type checking, frontend and API tests, and a production build. Each check can also run separately with `npm run lint`, `npm run typecheck`, `npm test`, or `npm run build`. API tests use an in-memory PostgreSQL stand-in and do not connect to Neon. Type checking currently covers the TypeScript modules and typed Vue components; the remaining JavaScript files are linted and can be converted incrementally. GitHub Actions runs these checks on pushes and pull requests.

## Architecture Decisions

### Why Pinia over Redux/Vuex?

- Pinia is the official Vue 3 state management solution
- Better TypeScript support out of the box
- Simpler API with Composition API integration
- Smaller bundle size

### Why Composition API?

- Better code organization and reusability
- Improved TypeScript support
- Easier testing of individual pieces of logic
- Future-proof for Vue 3 ecosystem

### Why Tailwind CSS?

- Utility-first approach reduces custom CSS
- Consistent spacing and color system
- Responsive design utilities built-in
- Tree-shaking removes unused styles

## Future Enhancements

- [x] Node.js backend API and PostgreSQL storage
- [x] User roles and permissions
- [x] Inventory management
- [x] Receipt printing
- [ ] Multi-store support
- [ ] Real-time updates with WebSockets
