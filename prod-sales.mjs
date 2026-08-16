/**
 * Test the PRODUCTION SPA: login as jishan@velora.com, open /sales,
 * capture the exact client-side exception.
 */
import { chromium } from "playwright";

const BASE = "https://velora-erp.vercel.app";
const USER = "leena.mishra57@velora.com";
const PASS = "Velora@123";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(`${e.message}\n${(e.stack || "").split("\n").slice(0, 6).join("\n")}`));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 500)); });
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400) console.log("API", r.status(), r.url().replace(BASE, ""));
  });

  console.log("=== LOGIN ===");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', USER);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(8000);
  console.log("URL after login:", page.url());

  console.log("\n=== DIRECT /sales ===");
  await page.goto(`${BASE}/sales`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(12000);
  const body = (await page.locator("body").innerText()).replace(/\n+/g, " | ");
  console.log("BODY:", body.slice(0, 800));

  console.log("\n=== PAGE ERRORS ===");
  console.log(pageErrors.length ? pageErrors.slice(0, 4).join("\n---\n") : "(none)");
  console.log("\n=== CONSOLE ERRORS ===");
  console.log(consoleErrors.length ? consoleErrors.slice(0, 6).join("\n---\n") : "(none)");

  // Try clicking Try Again
  const ta = page.locator("text=Try Again");
  if (await ta.count()) {
    await ta.first().click();
    await page.waitForTimeout(8000);
    console.log("\n=== After Try Again ===");
    console.log((await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 500));
  }

  await browser.close();
})();
