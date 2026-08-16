/**
 * Definitive repro — login fresh, open /sales, capture the EXACT exception
 * that reaches the error boundary, with component stack.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const USER = process.env.RUSER || "aarti.rao51@velora.com";
const PASS = "Velora@123";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];
  const apiResponses = [];

  page.on("pageerror", (e) => {
    pageErrors.push(`MESSAGE: ${e.message}\nSTACK:\n${e.stack || "(no stack)"}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      consoleErrors.push(m.text().slice(0, 3000));
    }
  });
  page.on("response", (r) => {
    if (r.url().includes("/api/")) {
      apiResponses.push({ status: r.status(), url: r.url().replace(BASE, "").split("?")[0] });
    }
  });

  console.log("=== LOGIN ===");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await page.fill('input[type="email"]', USER);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(12000);
  console.log("URL after login:", page.url());

  console.log("\n=== DIRECT /sales ===");
  await page.goto(`${BASE}/sales`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(15000);

  const body = (await page.locator("body").innerText().catch(() => "")).replace(/\n+/g, " | ");
  console.log("BODY:", body.slice(0, 400));

  // Expand error details if present
  const summary = page.locator("summary", { hasText: "Error details" });
  if (await summary.count()) {
    await summary.first().click();
    await page.waitForTimeout(300);
    const pre = page.locator("details pre");
    console.log("\n=== EXACT ERROR (from boundary) ===");
    console.log((await pre.first().innerText().catch(() => "n/a")).slice(0, 5000));
  }

  console.log("\n=== PAGE ERRORS ===");
  console.log(pageErrors.length ? pageErrors.slice(0, 4).join("\n---\n---\n") : "(none)");

  console.log("\n=== CONSOLE ERRORS ===");
  console.log(consoleErrors.length ? consoleErrors.slice(0, 6).join("\n---\n---\n") : "(none)");

  console.log("\n=== API RESPONSES ===");
  for (const r of apiResponses) console.log(r.status, r.url);

  // Try Try Again
  const ta = page.locator("text=Try Again");
  if (await ta.count()) {
    await ta.first().click();
    await page.waitForTimeout(10000);
    const body2 = (await page.locator("body").innerText().catch(() => "")).replace(/\n+/g, " | ");
    console.log("\n=== AFTER TRY AGAIN ===");
    console.log(body2.slice(0, 400));
    // New page errors after retry?
    console.log("PAGE ERRORS after retry:", pageErrors.length ? "see above" : "(none new)");
  }

  await browser.close();
})();
