# Velora ERP

Velora ERP is an industry-grade, multi-tenant ERP for Indian MSME manufacturing and trading companies.

The ERP is the product customers use to manage their own company data: branches, users, items, customers, vendors, sales, purchases, inventory, accounts, audit logs, and dashboard KPIs.

It is not a Velora admin dashboard and does not ship with demo business records.

## Version

Current release: `v1.4.0` Multi-Tenant ERP Architecture Foundation.

## Stack

- Backend: Node.js, Express.js, Prisma, PostgreSQL, Redis, JWT, BullMQ
- Frontend: React 18, Vite, Tailwind CSS, React Query, React Hook Form, Zod, React Router
- Infrastructure: Docker Compose for local PostgreSQL and Redis

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
