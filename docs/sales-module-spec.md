# Velora ERP — Sales Module Specification (Capture Before Removal)

> **Status:** Captured 2026-08-16, prior to clean removal of the legacy Sales module.
> **Objective:** This document is the single source of truth for rebuilding Sales. Do NOT ship the old implementation; rebuild from this spec.
> **Incident context:** `/sales` repeatedly hit the generic "Something went wrong" error boundary in production. Root cause (see `INCIDENT-REPORT-sales-error-boundary.md`) was a permission-seed bug that left roles with zero active permissions, causing 403s on every Sales API call, which the `RouteErrorBoundary` rendered as a generic crash. That incident is resolved, but the module is being removed and rebuilt clean.

---

## 1. Current Sales UI

Two top-level frontend entry points exist:

1. **`SalesPage`** (`/sales`) — the full sales workbench, a tabbed interface with 6 tabs:
   - `dashboard` — KPIs & charts
   - `leads` — Lead management
   - `quotations` — Quotations
   - `orders` — Sales orders
   - `invoices` — Invoices
   - `receipts` — Payment receipts
2. **`OwnerDashboard`** — the owner's morning dashboard (fetched via `salesApi.ownerDashboard()`). Rendered when the role is OWNER/owner-type and the Sales route resolves to it.

Layout: page header (title, subtitle, Add button, Refresh, secondary action) → sticky `FilterBar` → `QuickFilters` chips → `SavedFilters` → `SalesTable` (per tab) → optional `BulkActions` floating bar.

---

## 2. Current Navigation

- Sidebar module key `sales`, permission key `sales:view`, path `/sales`, icon `ShoppingCart` (see `frontend/src/hooks/usePermissions.js` MODULES list, line ~159).
- IMPORTANT wiring quirk: CRM is currently mapped to `sales:view` + path `/crm` (line ~164). On removal of Sales, CRM must keep a working permission + path — do NOT leave CRM dependent on the Sales module.
- `AppShell.getActiveRoutes`: `sales: ["/sales", "/crm"]`.
- `App.jsx` routes: `<SalesPage>` at `/sales`, `<OwnerDashboard>` for the owner entry. Both wrapped by `<PermissionGuard module="sales" requiredPermission="sales:view" />` and `<RouteErrorBoundary>`.
- `PermissionGuard` `MODULE_LABELS` has `sales: "Sales"`.

---

## 3. Every KPI

### Sales Dashboard (`/sales/dashboard` → `getSalesDashboard`)
Returned by `backend/src/modules/sales/sales.service.js:608`:
- **Total Invoiced (all time)** — `businessDocument` aggregate `INVOICE`, `_sum.totalAmount`, `_count`.
- **Monthly Invoices** — `INVOICE` where `documentDate >= monthStart`, sum + count.
- **Total Sales Orders** — `count` of `SALES_ORDER`.
- **Pending Sales Orders** — `count` of `SALES_ORDER` where status in `DRAFT, SUBMITTED, APPROVED`.
- **Total Delivery Notes** — `count` of `DELIVERY_NOTE`.
- **Monthly Receipts** — `payment.aggregate` where `paymentType=RECEIPT`, `paymentDate >= monthStart`, `_sum.amount`.
- **Top 5 Customers** — `businessDocument.groupBy` by `partyId` (`INVOICE`, not CANCELLED), sum + count, top 5.
- **Recent Sales Order Activity** — `businessDocument.findMany` `SALES_ORDER`, `orderBy updatedAt desc`, take 10.

### Owner Dashboard (`/sales/owner-dashboard` → `getOwnerDashboard`, `sales.service.js:473`)
- **Today's Revenue** — `INVOICE` where `documentDate` in today, `_sum.totalAmount`, `_count`.
- **Today's Follow-ups** — leads with `nextFollowUp` today; top 3 opportunities by value.
- **Monthly Revenue** — `INVOICE` where `documentDate >= monthStart`.
- **Total Outstanding** — `INVOICE` where status not CANCELLED, `_sum.totalAmount`.
- **Pending Orders** — `SALES_ORDER` in `DRAFT, SUBMITTED, APPROVED`.
- **Draft Quotes** — `QUOTATION` with status `DRAFT`.
- **Overdue Invoices (30+ days)** — `INVOICE` not CANCELLED, `documentDate < 30d ago`, take 5.
- **Top 5 Selling Products (this month)** — `businessDocumentLine.groupBy` by `itemId` (INVOICE lines this month), sum qty + lineTotal.
- **Top Sales People (this month)** — `businessDocument.groupBy` by `createdBy` (INVOICE this month), sum totalAmount.
- **Recent Wins** — recently created INVOICE rows.
- **Today's Follow-ups** — leads with follow-up today.
- **Inactive Customers (60+ days)** — customers with no INVOICE in 60 days.
- **Low Stock Items** — delegates to `inventory.service.getLowStockAlerts()`.

---

## 4. KPI Formulas

All money stored in **paise** (integer). Display via `formatRupees` (frontend) / divide by 100.

- Revenue/Outstanding/Collections = `SUM(businessDocument.totalAmount)` (paise) over the filtered set.
- Pending Orders = `COUNT` with status filter.
- Top Customers/Products/People = Prisma `groupBy` + `_sum`, sorted desc, `take 5`.
- Outstanding per invoice = `totalAmount - SUM(paymentAllocation.amount)` where allocations match `documentId` (see `getOutstandingReport`, `sales.service.js:669`).
- Aging days = `floor((now - documentDate) / 86400000)`.
- Days overdue = `floor((now - documentDate) / 86400000)`.

`computeDocumentTotals(lines, gstTreatment)` (shared util, `backend/src/utils/money.js`) computes: `subtotal`, `discount`, `taxableAmount`, `cgstAmount`, `sgstAmount` (INTRA_STATE) or `igstAmount` (INTER_STATE), `roundOff`, `totalAmount`. Line totals: `round(quantity * ratePaise - discountPaise)`.

---

## 5. Charts

- **Sales Analytics chart** (`/sales/analytics` → `getSalesAnalytics`, `sales.service.js:651`): a 12-month time series. For each of the last 12 months: `revenue` (INVOICE sum), `invoices` (count), `orders` (SALES_ORDER count), `collections` (RECEIPT sum). Returned as array of `{ month, revenue, invoices, orders, collections }`. Consumed by `SalesPage` dashboard tab (and referenced by Dashboard/Bi analytics).
- **Top Customers / Top Products** rendered as ranked lists (not necessarily a charting lib) in dashboards.

---

## 6. Tables

`SalesTable` (`frontend/src/pages/sales/components/SalesTable.jsx`) — generic, sortable, selectable, paginated table driven by per-tab column configs. Features:
- Sortable headers (asc/desc toggle), client-side + server-side sort params.
- Column filter popovers.
- Row selection (checkbox) → drives `BulkActions`.
- Pagination (page/limit, default limit 20, max 500).
- Footer totals.
- Empty state + loading skeleton (`SkeletonTable`).
- Per-tab column sets: leads, quotations, sales orders, invoices, receipts (defined in `SalesPage.jsx`).

List endpoints all support the `listQuery` schema (`sales.routes.js:57`): `page, limit, status, q, dateFrom, dateTo, customerId, branchId, createdBy, amountMin, amountMax, sortBy, sortOrder`.

---

## 7. Filters

`useSalesFilters` (`hooks/useSalesFilters.js`) is the single filter-state owner:
- **Quick filter chips** (`QUICK_FILTERS`): All, Today, Yesterday, This Week, Last Week, This Month, Last Month, Pending, Approved, Draft, Cancelled, Closed, High Value, Low Value. Date logic computed client-side (`getQuickDateRange`).
- **Advanced `FilterBar`**: global debounced search (`q`), status dropdown, date range (`DateRangePicker` with presets Today/Yesterday/Last 7/Last 30/This Month/Last Month/Custom), customer dropdown, sales-executive (createdBy) dropdown, branch dropdown, amount range (min/max), sort options, reset, export.
- **Saved filter presets** persisted in `localStorage` key `velora_sales_saved_filters` (`SavedFilters.jsx`).
- **Grouping / selection / pagination** state also lives here.

---

## 8. Search

- Global table search → `q` param to list endpoints (server-side `contains ... mode: insensitive` on name/contactPerson/phone/email/city/requirement/notes for leads; document no/party for docs).
- `ExportMenu` offers Excel/CSV/PDF/Print (CSV via shared `exportCsv`).
- Item search endpoint `/items/search` (sales routes) for line-item pickers.

---

## 9. Forms

### Lead form (`leads` tab)
Fields: `name` (min 2, required), `contactPerson`, `phone`, `email` (optional email), `city`, `source`, `priority` (HIGH/MEDIUM/LOW, default MEDIUM), `status` (NEW/QUALIFIED/LOST/CONVERTED, default NEW), `value` (number >=0), `notes`, `requirement`, `nextFollowUp`.
- Create: `POST /leads` (permission `sales:create`).
- Edit: `PATCH /leads/:id` (`sales:update`).
- Delete: `DELETE /leads/:id` (`sales:delete`).
- Validated by `leadSchema` (`sales.routes.js:76`).

### Document forms (Quotation / Sales Order / Delivery Note / Invoice)
Shared `docHeaderSchema` (`sales.routes.js:49`): `customerId` (optional uuid), `documentDate`, `gstTreatment` (INTRA_STATE/INTER_STATE, default INTRA_STATE), `terms`, `lines[]` where each line = `itemId` (optional), `description`, `quantity` (>0), `rate` (>=0), `discount` (>=0, default 0), `gstRate` (int 0–28, default 18).
- `POST /quotations`, `POST /sales-orders`, `POST /invoices` (`sales:create`).
- `POST /quotations/:id/convert-to-order` (`sales:approve`) → creates `SALES_ORDER`.
- `PATCH /quotations/:id/status`, `PATCH /sales-orders/:id/status` (`sales:approve`) with allowed status enums.
- `POST /delivery-notes` (`dnSchema`: customerId, salesOrderId, warehouseId, lines[itemId, description, quantity, rate]) (`sales:create`).

### Payment Receipt form
`receiptSchema` (`sales.routes.js:256`): `customerId`, `amount` (>0), `mode` (CASH/CHEQUE/NEFT/RTGS/UPI/CARD), `referenceNo`, `bankName`, `narration`, `paymentDate`, `allocations[]` of `{ invoiceId, amount }`.
- `POST /payment-receipts` (`sales:payment`).

---

## 10. Modals / Drawers

Legacy Sales did NOT use separate modal/drawer components for create/edit — forms were inline within tab panels (lead form inline; doc forms were inline panels/forms inside `SalesPage`). The shared `FilterBar`, `ExportMenu`, `SavedFilters`, `DateRangePicker` use popover/dropdown UI (not full modals). `BulkActions` is a floating sticky bar.

---

## 11. Sales Order Workflow

Lifecycle (documented in `sales.service.js` header):
**Quotation → Sales Order → Delivery Note → Tax Invoice → Payment Receipt**

- `createQuotation` → `businessDocument` `QUOTATION` (status DRAFT) + `businessDocumentLine`s.
- `convertQuotationToOrder` → reads QUOTATION (rejects if CLOSED/already converted), creates `SALES_ORDER`.
- Direct `POST /sales-orders` creates SO without quotation.
- `createDeliveryNote` → `DELIVERY_NOTE`; if `warehouseId` present, calls **`debitStockForSale`** (inventory) per line → FIFO stock deduction + `StockLedger` write.
- `createInvoice` → `INVOICE`; posts accounting journal via **`postSalesInvoiceJournal`** (accounts).
- `recordPaymentReceipt` → `Payment` (paymentType RECEIPT) + `PaymentAllocation`s + journal via **`postPaymentJournal`** (accounts).
- Status transitions via `updateDocStatus`.
- Doc numbers via `nextDocNumber` (prefixes QT/SO/DN/INV).

---

## 12. Customer Workflow

- Customers are a **shared** `Customer` model (also used by CRM, Accounts, Inventory reservations). Sales reads them via `coreApi.list("customers")` for dropdowns and the owner dashboard.
- Customer outstanding: `GET /customers/:id/outstanding` and `GET /customers/:id/ledger` (sales routes) — built on `businessDocument` + `paymentAllocation`.
- Customer creation is NOT in Sales; it lives in Core/Master/CRM.

---

## 13. Product / Inventory Workflow

- Items read via `coreApi.list("items")` for line-item pickers.
- On Delivery Note creation, **`debitStockForSale`** (inventory.service) deducts stock (FIFO via `StockBatch`, ledger via `StockLedger`). This is the ONLY Sales→Inventory write path.
- `getLowStockAlerts` (inventory.service) is reused by the owner dashboard.

---

## 14. API Contracts

Base: `/api`. All sales routes mounted at `/api` via `salesRoutes` (registered in `backend/src/app.js`).
Auth: `requireAuth, requireTenant` on router; per-route `requirePermission(...)`.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/leads` | `sales:view` | list leads (listQuery + priority/source) |
| POST | `/leads` | `sales:create` | create lead |
| PATCH | `/leads/:id` | `sales:update` | update lead |
| DELETE | `/leads/:id` | `sales:delete` | delete lead |
| GET | `/quotations` | `sales:view` | list quotations |
| POST | `/quotations` | `sales:create` | create quotation |
| GET | `/quotations/:id` | `sales:view` | get quotation |
| POST | `/quotations/:id/convert-to-order` | `sales:approve` | → sales order |
| PATCH | `/quotations/:id/status` | `sales:approve` | status change |
| GET | `/sales-orders` | `sales:view` | list SOs |
| POST | `/sales-orders` | `sales:create` | create SO |
| GET | `/sales-orders/:id` | `sales:view` | get SO |
| PATCH | `/sales-orders/:id/status` | `sales:approve` | status change |
| GET | `/delivery-notes` | `sales:view` | list DNs |
| POST | `/delivery-notes` | `sales:create` | create DN |
| GET | `/delivery-notes/:id` | `sales:view` | get DN |
| GET | `/invoices` | `sales:view` | list invoices |
| POST | `/invoices` | `sales:create` | create invoice |
| GET | `/invoices/:id` | `sales:view` | get invoice |
| GET | `/payment-receipts` | `sales:view` | list receipts |
| POST | `/payment-receipts` | `sales:payment` | record receipt |
| GET | `/sales/dashboard` | `sales:view` | dashboard KPIs (cached 30s single-flight) |
| GET | `/sales/analytics` | `sales:view` | 12-month analytics |
| GET | `/sales/owner-dashboard` | `sales:view` | owner morning dashboard |
| GET | `/sales/outstanding-report` | `sales:view` | outstanding report |
| GET | `/customers/:id/outstanding` | `sales:view` OR `master:view` | customer outstanding |
| GET | `/customers/:id/ledger` | `sales:view` | customer ledger |
| GET | `/items/search` | `sales:view` | item search for pickers |

Shared `listQuery` (page/limit/status/q/dateFrom/dateTo/customerId/branchId/createdBy/amountMin/amountMax/sortBy/sortOrder).

Frontend API surface: `salesApi` + `leadsApi` in `frontend/src/services/api.js` (lines ~302–388). Hooks in `frontend/src/pages/sales/hooks/useSalesData.js`.

---

## 15. Database Dependencies

Prisma: `backend/prisma/schema.prisma`.

**Models used by Sales (MOSTLY SHARED — see §16):**
- `BusinessDocument` (`business_documents`) — quotations, SOs, DNs, INVOICES. **SHARED** (Accounts, BI, AI, Admin all read it).
- `BusinessDocumentLine` — line items. **SHARED**.
- `Lead` (`leads`) — **Sales/CRM shared** (CRM reads leads; BI/AI count leads).
- `Payment` (`payments`) — RECEIPT records. **SHARED** (Purchase uses PAYMENT; Accounts journals; CRM reads).
- `PaymentAllocation` — receipt→invoice allocation. **SHARED** (Accounts).
- `Customer` — party. **SHARED** (CRM/Accounts/Inventory).
- `Item` — line items. **SHARED** (Inventory/Procurement).
- `StockBatch` / `StockLedger` — written via `debitStockForSale`. **SHARED** (Inventory).

**Enums touched by Sales:**
- `DocumentStatus` (DRAFT/SUBMITTED/APPROVED/REJECTED/CANCELLED/CLOSED) — **SHARED**.
- `LeadStatus` (NEW/QUALIFIED/LOST/CONVERTED) — **SHARED** (CRM).
- `GstTreatment` (INTRA_STATE/INTER_STATE) — **SHARED**.
- `PaymentMode` (CASH/CHEQUE/NEFT/RTGS/UPI/CARD) — **SHARED**.
- `PaymentType` (RECEIPT/PAYMENT) — **SHARED**.
- `UserRoleName` includes `SALES_MANAGER`, `SALES_EXECUTIVE`, legacy `SALESMAN` — **SHARED** (auth/RBAC).

**⚠️ No Sales-only Prisma model exists.** Every Sales model/enum is shared with ≥1 other ERP module. **Do NOT delete/alter any Prisma model or enum during removal.** No migration is required for removal.

---

## 16. Shared Dependencies (MUST PRESERVE)

- **`BusinessDocument`, `BusinessDocumentLine`, `Lead`, `Payment`, `PaymentAllocation`, `Customer`, `Item`, `StockBatch`, `StockLedger`** models — shared.
- **All enums above** — shared.
- **`debitStockForSale`** in `backend/src/modules/inventory/inventory.service.js` — inventory write path; keep (inventory uses `debitStock` generally; this wrapper is Sales-specific but harmless — safe to keep or remove, but do NOT remove `debitStock`/`creditStock`).
- **`postSalesInvoiceJournal`, `postPaymentJournal`** in `backend/src/modules/accounts/accounting.service.js` — Accounts; keep.
- **`computeDocumentTotals`, `rupeesToPaise`** (`backend/src/utils/money.js`) — shared across modules; keep.
- **`nextDocNumber`** (`backend/src/utils/doc-number.js`) — shared; keep.
- **`cachedCompute`** (`backend/src/utils/single-flight-cache.js`) — shared; keep.
- **`coreApi.list("customers"|"items"|"users"|"branches")`** — shared master API; keep.
- **Shared UI primitives** in `frontend/src/pages/inventory/components/shared.jsx` (`Card`, `KpiTile`, `SectionHeader`, `Pill`, `StatusPill`, `exportCsv`, `number`, `date`) — used by OwnerDashboard/SalesPage; KEEP (Inventory depends on them).
- **`CRM` module** — currently wired to `sales:view` + `/crm` (a legacy coupling). On Sales removal, ensure CRM has its own working permission + route (it does: `crm:view`, `/crm` via `CrmPage`). Verify CRM still loads.

---

## 17. Permissions

Defined in `backend/src/utils/permissions.js` PERMISSIONS:
`SALES_READ=sales:view`, `SALES_CREATE=sales:create`, `SALES_UPDATE=sales:edit`, `SALES_DELETE=sales:delete`, `SALES_APPROVE=sales:approve`, `SALES_PAYMENT=sales:payment`.

- These permission keys are referenced by **other modules too** (CRM uses `sales:view`; `coreApi` master reads use `master:view`; customer outstanding allows `master:view`).
- `ROLE_PERMISSIONS` / `ROLE_DEFAULT_PERMISSIONS` maps in `backend/src/utils/permission-engine.js` include `sales:*` for `SALES_MANAGER`/`SALES_EXECUTIVE`. KEEP these permission constants and role mappings — they are part of the shared RBAC system. Do NOT strip `sales:*` from role maps (a prior incident was caused by permission-seed corruption).
- Frontend `usePermissions.js` MODULES list has the `sales` module entry — remove the `sales` module entry (but keep `crm` entry working).

---

## 18. Loading States

- `SkeletonCards` / `SkeletonTable` (shared `frontend/src/components/Skeleton.jsx`) for dashboard + table loading.
- React Query `isPending` → skeleton; `refetchInterval: 30s`, `refetchOnWindowFocus`, `staleTime: 60s` for dashboards.
- Masters fetched via `Promise.allSettled` so a 403 on one (e.g. `users`) never blanks the rest.

## 19. Empty States

- `EmptyState` (shared) for: no dashboard data, no rows, no search results.
- Owner dashboard: "No follow-ups scheduled today", "No overdue invoices ✅", "No invoices this month", "No data" fallbacks.

## 20. Error States

- `ErrorBanner` / `ErrorState` (shared `frontend/src/components/ErrorState.jsx`) for query errors with retry.
- `RouteErrorBoundary` wraps every route; renders "Something went wrong" + retry/home on uncaught exceptions. **This is what `/sales` hit in production** — caused by permission 403 → AccessDenied/empty data → render failure, NOT by Sales-specific code.

## 21. Responsive Behavior

- Container `max-w-7xl` with `px-4 sm:px-6 md:py-6 xl:p-8`.
- FilterBar sticky `top-0 z-30`, `-mx-1` full-bleed on mobile.
- Export label hidden on mobile (`hidden sm:inline`).
- Quick filter chips wrap (`flex-wrap`).
- Tables scroll horizontally on small screens; bulk actions bar is `sticky bottom-4`.
- OwnerDashboard uses responsive grid (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` style patterns via `Card`).

---

## 22. Existing Problems Discovered

1. **Production error boundary on `/sales`** — root cause was permission-seed corruption (roles had zero active permissions → 403 on all Sales APIs → `RouteErrorBoundary` "Something went wrong"). Documented in `INCIDENT-REPORT-sales-error-boundary.md`. Resolved by seed fix, but the module is being removed anyway.
2. **CRM coupled to `sales:view`** in `usePermissions.js` (line ~164) — fragile; a Sales removal must not break CRM.
3. **Heavy dashboard endpoints** — `getOwnerDashboard` / `getSalesDashboard` run 10–13 parallel aggregates; mitigated by `cachedCompute` (30s) on `/sales/dashboard`.
4. **No separate modal/drawer layer** — inline forms; rebuild should consider dedicated drawer/modal pattern for consistency with other modules.
5. **`debitStockForSale` only triggers when `warehouseId` is provided** on delivery notes — stock may not deduct if warehouse omitted.

---

## 23. Recommended Architecture for Future Rebuild

- **Keep all shared models/enums/permissions** exactly as they are.
- Rebuild `/sales` as a clean module folder `frontend/src/pages/sales/` + `backend/src/modules/sales/` with:
  - A single tabbed `SalesPage` (dashboard, leads, quotations, orders, invoices, receipts).
  - Dedicated drawer/modal components for create/edit (avoid inline forms).
  - Reuse shared `Card`, `KpiTile`, `Skeleton*`, `EmptyState`, `ErrorState`, `PageHeader`, `LiveIndicator`.
  - Keep the 6-permission model (`sales:view/create/edit/delete/approve/payment`).
  - Keep lifecycle Quotation→SO→DN→Invoice→Receipt with stock debit on DN and journal posts on Invoice/Receipt.
  - Fix CRM coupling: give CRM its own permission (`crm:view`) rather than borrowing `sales:view`.
  - Add a lightweight "module under rebuild" placeholder route for the interim (what this removal ships).
- Do NOT introduce new Prisma models; extend `BusinessDocument` patterns if needed.
- Ensure permission seed includes `sales:*` for `SALES_MANAGER`/`SALES_EXECUTIVE` to avoid the prior incident.

---

*End of specification. This file is the contract for the Sales rebuild.*
