# Changelog

All notable changes to Velora ERP will be documented in this file.

## [1.4.0] - 2026-06-28

### Added
- Introduced the requested ERP monorepo structure with `backend/` and `frontend/`.
- Added Express.js API foundation with centralized responses, validation, auth middleware, tenant context, and error handling.
- Added Docker Compose for PostgreSQL and Redis.
- Added Prisma schema foundation covering multi-tenant auth, master data, sales/purchase document primitives, inventory ledger, payments, accounts, and audit logs.
- Added Auth module endpoints for register, login, refresh token, logout, forgot password, reset password, and current user.
- Added Master Data CRUD route foundation with tenant and company filtering.
- Added dashboard KPI route with Redis caching.
- Added React 18 + Vite frontend shell with login, dashboard, navigation, empty states, and module placeholders.

### Changed
- Repositioned the repository from a single Next.js UI prototype into an ERP application architecture foundation for customer tenant data.

## [1.3.0] - 2026-06-28

### Changed
- Removed all demo company, branch, employee, product, notification, audit, import, and role seed data.
- Updated the Core Platform to behave like a freshly installed commercial ERP with zero customer data.
- Added professional empty states for company setup, branches, employees, products, roles, imports, notifications, and audit history.
- Reworded the UI to represent the customer's own business rather than Velora administration.
- Preserved configurable Core Platform modules while ensuring every record must be created manually after installation.

## [1.2.0] - 2026-06-28

### Changed
- Redesigned the Core Platform into a desktop-first business operating system with a simple left sidebar.
- Reduced dashboard complexity around business overview, pending work, alerts, quick actions, recent activity, and important KPIs.
- Standardized the interface around a white theme with blue-only accent color, soft shadows, rounded corners, and clearer typography.
- Improved mobile and tablet navigation while preserving desktop productivity.
- Simplified labels and screen hierarchy for Indian MSME owners, managers, and employees with minimal training.

## [1.1.0] - 2026-06-28

### Changed
- Redesigned the Core Platform UI into a clean white workspace for Indian MSME founders.
- Simplified navigation, dashboard copy, alerts, roles, item master, imports, and audit language.
- Reframed the product around practical growth for Pune, Nashik, Kolhapur, and MIDC businesses.
- Improved readability, touch target sizing, contrast, and mobile-friendly spacing.

## [1.0.0] - 2026-06-28

### Added
- Core Platform foundation for Velora ERP.
- Company, branch, user, RBAC, and product master modules.
- Executive dashboard with dynamic summary cards, health indicators, recent activity, storage usage, and quick actions.
- Notification center supporting system, approval, warning, information, success, and error categories.
- Import/export operation registry for Excel and CSV workflows.
- Audit log model and seeded automatic platform activity examples.
- Versioning documentation and release notes for Phase 1.
