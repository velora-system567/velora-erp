# Velora ERP v1.5.0 Release Notes

Version 1.5.0 delivers a production-grade inventory module comparable to Odoo or Zoho Inventory.

## What Changed

### Inventory Control Tower
- Real-time KPI grid: inventory value (FIFO), total stock, turnover rate, reserved stock, out-of-stock, low stock, overstock, and expiring batches.
- Warehouse summary with percentage share bars and ABC Pareto analysis.
- Movement heatmap showing 7 days of stock activity by hour.
- Reorder recommendations with urgency indicators.

### Products
- Full product lifecycle management (Draft → Active → Discontinued → Obsolete).
- SKU auto-generation with configurable prefixes (RM/FG/SF/SR/CN + brand + name).
- Barcode generation and manual entry support.
- Category, brand, unit of measure, and GST rate management.
- Batch and serial number tracking configuration.

### Reports
- Stock Valuation Report: per-item FIFO cost, quantity, and percentage of total value.
- Movement Report: grouped by transaction type (purchase, sale, transfer, adjustment, etc.).
- Dead/Slow-Moving Stock: items with aging > 90 days and no recent sales activity.
- Fast-Moving Products: top 5 highest-value stocked items.
- Low Stock Alerts: actionable reorder suggestions with urgency levels.
- All reports support CSV export.

### Suppliers
- Vendor list with purchase order counts and total purchase value.
- Supplier detail view with purchase order history and payment records.
- Search by name, GSTIN, or PAN.

### Technical
- Modular component architecture replacing 985-line monolithic file.
- Warehouse names now returned throughout all API responses (no raw UUIDs).
- Proper tenant isolation and permission checks on all new endpoints.
- Frontend build size: 1.5 MB JS, 38 KB CSS (gzipped: 439 KB JS, 7 KB CSS).

---

# Velora ERP v1.4.3 Release Notes

Version 1.4.3 improves mobile and cross-device layout quality.

## What Changed

- Added mobile header and bottom navigation.
- Fixed typography so Android/browser custom fonts do not make ERP text look unprofessional.
- Improved mobile card spacing, button sizing, dashboard grids, and safe-area padding.
- Kept desktop sidebar productivity layout intact.

---

# Velora ERP v1.4.2 Release Notes

Version 1.4.2 fixes the blank hosted frontend by removing legacy React/Next dependencies from the root workspace.

## What Changed

- Removed old root Next.js and React 19 dependencies.
- Kept the frontend on React 18 as required by the ERP prompt.
- Changed routing to a standard layout route with `Outlet`.
- Improved build consistency and frontend load reliability on Vercel.

---

# Velora ERP v1.4.1 Release Notes

Version 1.4.1 fixes the hosted frontend behavior when the backend API has not yet been deployed.

## What Changed

- The public Vercel frontend no longer attempts to call `http://localhost:4000/api`.
- Login and Dashboard now show a clear backend connection message until `VITE_API_BASE_URL` is configured.
- Added `frontend/.env.example`.

---

# Velora ERP v1.4.0 Release Notes

Version 1.4.0 updates Velora ERP to the requested multi-tenant ERP architecture foundation.

## What Changed

- Added `backend/` Express API and `frontend/` React/Vite app structure.
- Added Docker Compose for local PostgreSQL and Redis.
- Added Prisma schema foundation for tenants, companies, branches, users, roles, permissions, master data, sales/purchase documents, inventory, payments, journal entries, and audit logs.
- Added Auth module scaffolding for tenant onboarding, login, token refresh, logout, password reset flow, and `/auth/me`.
- Added tenant-authenticated API route surfaces for master data, sales, purchase, inventory, accounts, and dashboard KPIs.
- Added frontend login and dashboard shell with empty states for a fresh ERP install.

---

# Velora ERP v1.3.0 Release Notes

Version 1.3.0 converts the Core Platform into a true fresh-install ERP baseline.

## What Changed

- Removed all demo business data.
- The ERP now starts with an empty company, branch, employee, product, notification, import/export, role, and audit state.
- Added clear empty states such as "No Products Found", "No Branches Created", and "No Company Created".
- Dashboard now guides the business owner to enter their own company data first.
- No Velora admin, SaaS metrics, fake reports, placeholder records, sample analytics, or demo entities are shown.

---

# Velora ERP v1.2.0 Release Notes

Version 1.2.0 redesigns Velora ERP as a modern business operating system for Indian MSMEs.

## What Changed

- Simple left sidebar with clear labels and fast navigation.
- White default theme with minimal colors and blue-only accent.
- Dashboard focused on what owners need now: overview, pending work, alerts, quick actions, and recent activity.
- Fewer distracting visuals and no unnecessary charts.
- Larger readable typography, softer cards, cleaner spacing, and better tablet/mobile behavior.

---

# Velora ERP v1.1.0 Release Notes

Version 1.1.0 improves the Core Platform experience for Indian MSME founders and operators.

## What Changed

- Clean white interface with simpler visual hierarchy.
- Founder-friendly language instead of technical admin terminology.
- Clear first-screen actions for adding records and importing Excel data.
- Practical sections for company setup, branches, people, item master, alerts, imports, and activity history.
- Better alignment with businesses in Pune, Nashik, Kolhapur, and MIDC industrial areas.

---

# Velora ERP v1.0.0 Release Notes

Phase 1 establishes the permanent Core Platform foundation for future Velora ERP modules.

## Scope

- Company Management
- Branch Management
- User Management
- Role Based Access Control
- Product / Item Master
- Executive Dashboard
- Notifications
- Excel / CSV Import and Export tracking
- Audit Logs

## Architecture

- Next.js App Router with strict TypeScript.
- Clean domain-first structure under `src/lib`.
- Reusable dashboard, data table, form draft, and audit timeline components.
- Seed repository data isolated from UI so persistence can be replaced later.

## Compatibility

Future modules should extend the domain model and navigation registry without modifying existing core contracts wherever possible.
