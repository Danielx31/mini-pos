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

### Customer utang (pay later)

Any signed-in staff member can choose **Utang · Pay later** at checkout. Enter a customer name, with optional contact details and due date. The sale reduces stock and records the full amount as an unpaid balance; it does not record cash received. In **Orders**, search by customer name, open the sale, and record each cash repayment. Partial repayments are allowed up to the remaining balance. The receipt and order history show the current balance, and outstanding utang appears separately from recorded sales totals. Card and e-wallet repayments are not supported because Mini POS cannot verify those payments. Each repayment records who entered it and when; retries use a unique request ID to avoid recording the same repayment twice. Orders with an outstanding balance stay visible when paid orders are archived. Refunding an utang sale cancels its remaining balance while preserving repayment history; return any collected cash outside Mini POS.

### Move existing SQLite data

Keep a backup of `server/data/pos.sqlite` and stop the old API before the final import. With `DATABASE_URL` pointing to a **fresh** PostgreSQL database, run:

```powershell
npm --prefix server run import-sqlite
```

The importer copies users, password hashes, products, coupons, tax rates, orders, and parked orders in one transaction. It does not import sessions; users sign in again. It refuses a PostgreSQL database with existing users or sales, or a catalog that is not fresh. Imported SQLite products appear in the new catalog. If they are only sample products, an admin can use **Products → Clear Catalog** after resolving any parked orders to start empty. Keep the SQLite backup until you have checked accounts, stock, and order history in the new database. Do not create a new admin first when importing existing users.

### Deploy on Vercel

Connect a PostgreSQL provider through the Vercel Marketplace or another hosted PostgreSQL service. Set `DATABASE_URL` in the Vercel project environment. For Production, set `POS_PUBLIC_ORIGIN` to the exact HTTPS site origin; Preview deployments can omit it and use their request origin. Initialize the database from a trusted terminal using `create-user` or `import-sqlite` **before** deploying, with the same `DATABASE_URL`. Vercel builds the Vue frontend and routes `/api/v1/*` to a Node Function using `vercel.json`. Use a separate PostgreSQL database for Preview deployments so test sales do not enter production. The function does not run schema initialization on requests.

Before deploying catalog or utang changes to an existing Vercel database, run `npm --prefix server run migrate` from a trusted terminal with `.env.local` pointing to that database. The command uses the direct PostgreSQL URL and adds the archive, approval, and utang tables without removing existing products or sales. Test it against a Neon development branch first, then run it against production and redeploy Vercel. The Vercel Function does not run schema initialization on requests.

For an IIS deployment, run `npm run build` and `npm run server` with `NODE_ENV=production` and `POS_PUBLIC_ORIGIN` set to the site's exact HTTPS origin. The Node server serves `dist` and the API on port 3000. On IIS, install URL Rewrite and Application Request Routing, enable proxying, terminate HTTPS at IIS, and use the generated `dist/web.config` to forward all requests to the Node process. Set `PORT` if port 3000 is unavailable, and update `public/web.config` and `vite.config.js` accordingly.

Existing browser `localStorage` records are left untouched and are not automatically imported. Back up the old browser data before switching a live register. A fresh PostgreSQL database starts with an empty product catalog and sample coupons; create a first user with the command above, then add your own products in **Products**.

Run the API checks with `npm run test:server` and the frontend build with `npm run build`.

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

- **ESLint + Prettier** for code quality
- **Vitest** for unit testing (when added)

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
