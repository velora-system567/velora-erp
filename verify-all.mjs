/**
 * Comprehensive verification — fresh session, login, then each module loads
 * on FIRST attempt (no Try Again). Uses a sales manager + an admin + an owner.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const USERS = [
  { email: "leena.mishra57@velora.com", pass: "Velora@123", label: "SALES_MANAGER" },
  { email: "jishan@velora.com", pass: "Velora@123", label: "OWNER" },
  { email: "vandana.chauhan55@velora.com", pass: "Velora@123", label: "ADMIN" },
];
const ROUTES = ["/", "/sales", "/inventory", "/purchase", "/crm", "/accounts", "/reports", "/hrms"];

const browser = await chromium.launch({ headless: true });

for (const u of USERS) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });

  // Fresh session: new context = no stored tokens
  console.log(`\n======== ${u.label} (${u.email}) — FRESH SESSION ========`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(600);
  await page.fill('input[type="email"]', u.email);
  await page.fill('input[type="password"]', u.pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(9000);

  for (const route of ROUTES) {
    const t0 = Date.now();
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);
    const body = (await page.locator("body").innerText().catch(() => "")).replace(/\n+/g, " ");
    const sw = body.includes("Something went wrong") || body.includes("unexpected error");
    const accessDenied = body.includes("Access Denied");
    const blank = body.trim().length < 40;
    const label = sw ? "ERROR-BOUNDARY" : accessDenied ? "ACCESS-DENIED" : blank ? "BLANK" : "OK";
    console.log(`  ${route.padEnd(12)} ${String(Date.now() - t0).padStart(5)}ms ${label.padEnd(16)} ${body.slice(0, 55)}`);
    if (sw) {
      const summary = page.locator("summary", { hasText: "Error details" });
      if (await summary.count()) {
        await summary.first().click();
        const pre = await page.locator("details pre").first().innerText().catch(() => "");
        console.log(`      BOUNDARY DETAIL: ${pre.slice(0, 300)}`);
      }
    }
  }

  const realErrors = errors.filter((e) => !e.includes("404") && !e.includes("Failed to fetch"));
  console.log(`  ${u.label} uncaught errors: ${realErrors.length ? realErrors.slice(0, 3).join(" | ") : "NONE"}`);
  await context.close();
}

await browser.close();
console.log("\n=== DONE ===");
