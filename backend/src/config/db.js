import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

let prisma;
let _lastHealthy = true;

/**
 * Resolve the connection URL Prisma should use at RUNTIME.
 *
 * Prisma manages its own connection pool, so it must talk DIRECTLY to the
 * database — NOT through the PgBouncer/Neon "-pooler" endpoint. Measured on
 * this project's Neon instance, routing Prisma through the pooler costs
 * ~1.3s of latency PER QUERY vs ~0.28s on the direct connection (a 5x
 * difference). That per-query cost was the dominant reason the ERP felt slow
 * and first loads timed out into error states.
 *
 * Order of preference:
 *   1. DATABASE_URL_UNPOOLED — set explicitly when provided (Vercel env pull
 *      provides this for the production project).
 *   2. DATABASE_URL with the "-pooler." hostname suffix stripped (the Neon
 *      direct host is always the pooler host without "-pooler").
 *   3. DATABASE_URL unchanged (any other provider).
 *
 * The pool is bounded with connection_limit so a handful of warm serverless
 * instances stay within the database's direct-connection limits.
 */
function resolveDatabaseUrl() {
  try {
    let url;
    if (env.DATABASE_URL_UNPOOLED) {
      url = new URL(env.DATABASE_URL_UNPOOLED);
    } else {
      url = new URL(env.DATABASE_URL);
      if (url.hostname.includes("-pooler.")) {
        url.hostname = url.hostname.replace("-pooler.", ".");
      }
    }
    // We are now talking directly to the database — the "pgbouncer=true"
    // hint (present in the pooler URL) is wrong here and forces PgBouncer
    // mode round-trips that slow every query.
    url.searchParams.delete("pgbouncer");
    // Bound the pool so a handful of warm serverless instances stay within
    // the database's direct-connection limits.
    url.searchParams.set("connection_limit", "5");
    return url.toString();
  } catch {
    return env.DATABASE_URL;
  }
}

export function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl: resolveDatabaseUrl(),
      log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
      // Prevent a single slow query from blocking the entire pool
      transactionOptions: { maxWait: 5000, timeout: 10000 },
    });

    // Monitor connection health
    prisma.$on("error", (e) => {
      if (_lastHealthy) {
        console.error("[DB] Database connection error:", e.message?.slice(0, 200));
        _lastHealthy = false;
      }
    });
  }

  return prisma;
}

/**
 * Quick database health check.
 * Returns { healthy: boolean, latencyMs: number }.
 * Used by the health endpoint and startup verification.
 */
export async function checkDatabaseHealth() {
  const start = Date.now();
  try {
    // Use getPrisma() — `prisma` is only initialized on first getPrisma() call,
    // so a direct reference here would be undefined on a cold start and the
    // health check would always report "degraded".
    await getPrisma().$queryRaw`SELECT 1`;
    _lastHealthy = true;
    return { healthy: true, latencyMs: Date.now() - start };
  } catch (err) {
    _lastHealthy = false;
    return { healthy: false, latencyMs: Date.now() - start, error: err.message?.slice(0, 100) };
  }
}

export function isDatabaseHealthy() {
  return _lastHealthy;
}
