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
