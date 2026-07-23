# Velora ERP

Velora ERP is an industry-grade, multi-tenant ERP for Indian MSME manufacturing and trading companies.

The ERP is the product customers use to manage their own company data: branches, users, items, customers, vendors, sales, purchases, inventory, accounts, audit logs, and dashboard KPIs.

It is not a Velora admin dashboard and does not ship with demo business records.

## Version

Current release: `v1.5.0` Enterprise Inventory Module.

## Stack

- Backend: Node.js, Express.js, Prisma, PostgreSQL, Redis, JWT, BullMQ
- Frontend: React 19, Vite, Tailwind CSS, TanStack Query, Zod, React Router v6, Recharts
- Infrastructure: Docker Compose for local PostgreSQL and Redis

## Inventory Module

The inventory module is a production-grade subsystem comparable to Odoo or Zoho Inventory:

| Feature | Description |
|---------|-------------|
| **Dashboard** | KPI grid (value, turnover, reserved), low-stock alerts, ABC analysis, warehouse summary, movement heatmap, reorder recommendations |
| **Products** | Full CRUD with SKU auto-generation, barcode/QR support, categories, brands, units of measure, GST config, tracking modes (batch/serial) |
| **Stock Management** | Stock In/Out via FIFO batches, transfers between warehouses, adjustments, opening stock, cycle counts |
| **Warehouses** | Multi-warehouse with locations, bin management, zones, warehouse types (store, quarantine, damage, returns, transit) |
| **Suppliers** | Management with purchase order history, payment tracking, credit terms, GST/PAN |
| **Reports** | Valuation report, movement analysis, dead/slow-moving stock, fast-moving products, low-stock alerts — all with CSV export |
| **Audit Trail** | Complete stock movement history with FIFO batch traceability, serial number tracking, reservation system |

## Configuration

The following environment variables are required to run the application:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `REDIS_URL` | ✅ Yes | Redis connection string (used for OTP, sessions, caching) |
| `JWT_ACCESS_SECRET` | ✅ Yes | JWT signing secret (min 24 characters) |
| `JWT_REFRESH_SECRET` | ✅ Yes | JWT refresh signing secret (min 24 characters) |
| `FRONTEND_URL` | ✅ Yes | Frontend URL for CORS and email links |
| `RESEND_API_KEY` | ⬜ For email | Resend API key for transactional emails (https://resend.com) |
| `OTP_FROM_EMAIL` | ⬜ For email | Sender email address for OTP and verification emails |

In **development**, the application works without email configuration — OTP codes and verification links are logged to the server console. Set `RESEND_API_KEY` and `OTP_FROM_EMAIL` for production email delivery.

SMS/Phone verification is optional and disabled by default. Email verification is always available as the primary method.

## Structure

```text
backend/
  src/config
  src/middleware
  src/modules/auth
  src/modules/master
  src/modules/sales
  src/modules/purchase
  src/modules/inventory
  src/modules/accounts
  src/modules/dashboard
  src/utils
  src/jobs
  prisma/schema.prisma
frontend/
  src/components
  src/pages
  src/hooks
  src/services
  src/store
  src/utils
```

## Local Development

```bash
cd backend
cp .env.example .env
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

## API Response Format

Every API returns:

```json
{
  "success": true,
  "data": {},
  "message": "",
  "meta": { "page": 1, "limit": 20, "total": 0 }
}
```

## Release Discipline

- `main`: production releases only
- `develop`: active development
- `feature/*`: individual features
- `release/*`: release preparation
- `hotfix/*`: production fixes

Maintain `CHANGELOG.md` and `RELEASE_NOTES.md` for every version.
