/**
 * Repro current state: login, open /sales, capture exact exception.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const USER = "jishan@velora.com";
const PASS = "Velora@123";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on("pageerror", (e) => pageErrors.push(`${e.message}\n${(e.stack || "").split("\n").slice(0, 12).join("\n")}`));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 2000)); });
  page.on("requestfailed", (r) => failedRequests.push(`${r.failure()?.errorText} ${r.url().replace(BASE, "")}`));
  page.on("response", (r) => { if (r.url().includes("/api/") && r.status() >= 400) console.log("API", r.status(), r.url().replace(BASE, "")); });

  console.log("=== LOGIN ===");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', USER);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(10000);
  console.log("URL after login:", page.url());

  console.log("\n=== DIRECT /sales ===");
  await page.goto(`${BASE}/sales`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(12000);
  const body = (await page.locator("body").innerText().catch(() => "")).replace(/\n+/g, " | ");
  console.log("BODY:", body.slice(0, 600));

  // Expand error details if present
  const summary = page.locator("summary", { hasText: "Error details" });
  if (await summary.count()) {
    await summary.first().click();
    await page.waitForTimeout(300);
    const pre = page.locator("details pre");
    console.log("\n=== EXACT ERROR (from boundary) ===");
    console.log((await pre.first().innerText().catch(() => "n/a")).slice(0, 3000));
  }

  console.log("\n=== PAGE ERRORS ===");
  console.log(pageErrors.length ? pageErrors.slice(0, 5).join("\n---\n") : "(none)");
  console.log("\n=== CONSOLE ERRORS ===");
  console.log(consoleErrors.length ? consoleErrors.slice(0, 6).join("\n---\n") : "(none)");
  console.log("\n=== FAILED REQUESTS ===");
  console.log(failedRequests.length ? failedRequests.slice(0, 8) : "(none)");

  await browser.close();
})();
