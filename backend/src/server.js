import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`Velora ERP API listening on port ${env.PORT}`);

  // Warm the Prisma connection pool at boot (non-blocking) so the first user
  // request doesn't pay the cold-connect cost (~2-3s on this Neon instance).
  // With serverless Fluid Compute reusing warm instances, this turns the slow
  // first-request window into a fast steady-state immediately.
  import("./config/db.js").then(({ checkDatabaseHealth }) =>
    checkDatabaseHealth().then(({ latencyMs }) => {
      console.log(`[DB] Connection warmup complete (${latencyMs}ms)`);
    }).catch(() => { /* warmup failure is non-fatal — handled per request */ }),
  );
});
