/** Full Sales module E2E: login as OWNER, click every tab, capture errors + network. */
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const USER = process.env.REPRO_USER || "jishan@velora.com";
const PASS = process.env.REPRO_PASS || "Velora@123";
const TABS = ["Dashboard", "Leads", "Quotations", "Orders", "Delivery", "Invoices", "Receipts"];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 1500)); });
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400) failedRequests.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 1500)));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', USER);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Direct navigation to /sales (refresh/direct-nav test)
  await page.goto(`${BASE}/sales`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  for (const tab of TABS) {
    try {
      await page.getByRole("tab", { name: tab }).click({ timeout: 5000 });
      await page.waitForTimeout(3500);
      const body = await page.locator("body").innerText();
      const hasErrorState = body.includes("Something went wrong");
      const hasBoundary = body.includes("We hit a snag") || body.includes("Error details");
      let errText = "";
      if (hasErrorState || hasBoundary) {
        const summary = page.locator("summary", { hasText: "Error details" });
        if (await summary.count()) {
          await summary.first().click().catch(() => {});
          await page.waitForTimeout(300);
          errText = (await page.locator("details pre").first().innerText().catch(() => "")).slice(0, 800);
        } else {
          const idx = body.indexOf("Something went wrong");
          errText = body.slice(idx, idx + 300).replace(/\n/g, " | ");
        }
      }
      console.log(`TAB ${tab}: ${hasErrorState ? "ERROR-STATE" : hasBoundary ? "BOUNDARY" : "OK"}${errText ? "\n   >>> " + errText : ""}`);
    } catch (e) {
      console.log(`TAB ${tab}: CLICK-FAIL ${String(e).slice(0, 200)}`);
    }
  }

  console.log("\n=== API >=400 ===");
  console.log(failedRequests.length ? failedRequests.join("\n") : "(none)");
  console.log("\n=== CONSOLE ERRORS ===");
  console.log(consoleErrors.length ? consoleErrors.slice(0, 10).join("\n---\n") : "(none)");
  await browser.close();
})();
