/**
 * Cold-start first-load test: login and immediately open /, /sales, /inventory.
 * Verifies no error boundary / "Something went wrong" / blank page.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const USER = "yogesh.pandey54@velora.com";
const PASS = "Velora@123";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 300)));
page.on("response", (r) => {
  if (r.url().includes("/api/") && r.status() >= 500) console.log("  5xx:", r.status(), r.url().replace(BASE, ""));
});

console.log("Login...");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
await page.fill('input[type="email"]', USER);
await page.fill('input[type="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForTimeout(10000);
console.log("After login URL:", page.url());

for (const route of ["/", "/sales", "/inventory", "/purchase", "/accounts", "/crm"]) {
  const t0 = Date.now();
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(9000);
  const body = (await page.locator("body").innerText().catch(() => "")).replace(/\n+/g, " ");
  const sw = body.includes("Something went wrong");
  const blank = body.trim().length < 40;
  console.log(`${route.padEnd(14)} ${(Date.now() - t0) + "ms".padStart(6)} ${sw ? "ERROR" : blank ? "BLANK" : "OK"} | ${body.slice(0, 70)}`);
}

console.log("\nPage errors:", pageErrors.length ? pageErrors.slice(0, 3) : "none");
await browser.close();
