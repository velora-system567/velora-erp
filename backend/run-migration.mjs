import pg from "pg";
import fs from "fs";
import path from "path";

const { Client } = pg;

const client = new Client({
  connectionString: "postgresql://neondb_owner:npg_eBgGUsD52qSO@ep-dry-cake-ahqjfp92-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync(
  path.join("prisma", "migrations", "20260719120000_inventory_movements", "migration.sql"),
  "utf-8"
);

// Strip single-line comments then split by semicolons
function splitStatements(raw) {
  const cleaned = raw.replace(/^--.*$/gm, "").trim();
  return cleaned
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const statements = splitStatements(sql);

async function main() {
  await client.connect();
  console.log(`Connected. Executing ${statements.length} SQL statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ";";
    try {
      await client.query(stmt);
      console.log(`  [${i + 1}/${statements.length}] OK`);
    } catch (err) {
      if (["42710","42P07","42701"].includes(err.code)) {
        console.log(`  [${i + 1}/${statements.length}] Skipped (already exists)`);
      } else {
        console.error(`  [${i + 1}/${statements.length}] FAILED: ${err.code} - ${err.message}`);
        throw err;
      }
    }
  }

  console.log("\nMigration applied successfully");
  await client.end();
}

main().catch(async (e) => { console.error(e); process.exit(1); });