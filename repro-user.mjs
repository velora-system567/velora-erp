/**
 * Repro a specific user against localhost:5173 across all major modules.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const USER = process.env.RUSER || "usha.iyer49@velora.com";
const PASS = "Velora@123";
const MODULES = ["/", "/sales", "/inventory", "/purchase", "/accounts", "/crm", "/executive", "/activity", "/products"];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(`${e.message}\n${(e.stack || "").split("\n").slice(0, 8).join("\n")}`));

  console.log("=== LOGIN as", USER, "===");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(800);
  await page.fill('input[type="email"]', USER);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(9000);
  console.log("URL:", page.url());

  for (const route of MODULES) {
    const t0 = Date.now();
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(8000);
    const body = (await page.locator("body").innerText().catch(() => "")).replace(/\n+/g, " | ");
    const sw = body.includes("Something went wrong");
    const denied = body.includes("Permission denied");
    const blank = body.trim().length < 40;
    const status = sw ? "ERROR" : denied ? "DENIED" : blank ? "BLANK" : "OK";
    console.log(`${route.padEnd(14)} ${(Date.now()-t0)+"ms".padStart(6)} ${status} | ${body.slice(0,80)}`);
    if (sw || denied) {
      const summary = page.locator("summary", { hasText: "Error details" });
      if (await summary.count()) {
        await summary.first().click();
        await page.waitForTimeout(300);
        console.log(`  └─ ${(await page.locator("details pre").first().innerText().catch(()=>"")).slice(0,400)}`);
      }
    }
  }

  console.log("\n=== PAGE ERRORS ===");
  console.log(pageErrors.length ? pageErrors.slice(0, 6).join("\n---\n") : "(none)");
  await browser.close();
})();
