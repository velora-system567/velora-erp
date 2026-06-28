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
