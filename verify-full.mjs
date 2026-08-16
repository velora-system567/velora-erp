/** Verify every module route on FIRST load from a fresh session. */
import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const ROUTES = ["/", "/sales", "/inventory", "/purchase", "/crm", "/accounts", "/hrms", "/eam", "/wms", "/manufacturing", "/executive", "/activity", "/admin", "/settings", "/supplier-portal", "/users", "/branches", "/company", "/products"];
const browser = await chromium.launch({ headless: true });

for (const u of [
  { email: "leena.mishra57@velora.com", pass: "Velora@123", label: "SALES_MANAGER" },
  { email: "jishan@velora.com", pass: "Velora@123", label: "OWNER" },
]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 180)));
  console.log(`\n=== ${u.label} — fresh session ===`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  await page.fill('input[type="email"]', u.email);
  await page.fill('input[type="password"]', u.pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(9000);

  let fail = 0;
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    const body = (await page.locator("body").innerText().catch(() => "")).replace(/\n+/g, " ");
    const sw = body.includes("Something went wrong") || body.includes("unexpected error");
    const ad = body.includes("Access Denied");
    const blank = body.trim().length < 40;
    const label = sw ? "ERROR" : ad ? "DENIED" : blank ? "BLANK" : "ok";
    if (sw) {
      fail++;
      const s = page.locator("summary", { hasText: "Error details" });
      if (await s.count()) { await s.first().click(); console.log(`  ${route} => ${label}: ${(await page.locator('details pre').first().innerText().catch(()=>"")).slice(0,250)}`); }
      else console.log(`  ${route} => ${label} (no details)`);
    } else if (blank) {
      fail++;
      console.log(`  ${route} => ${label}`);
    }
  }
  console.log(`  ${u.label} failures: ${fail}; uncaught errors: ${errs.length ? errs.slice(0,3).join(" | ") : "NONE"}`);
  await context.close();
}
await browser.close();
console.log("\n=== DONE ===");
