/**
 * Reproduction v2: login, open /sales, expand "Error details", extract the
 * exact exception message + component stack.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const USER = process.env.REPRO_USER || "aarti.rao51@velora.com";
const PASS = process.env.REPRO_PASS || "Velora@123";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 2000));
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', USER);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);

  await page.goto(`${BASE}/sales`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);

  // Expand error details
  const summary = page.locator("summary", { hasText: "Error details" });
  if (await summary.count()) {
    await summary.first().click();
    await page.waitForTimeout(500);
    const pre = page.locator("details pre");
    const text = await pre.first().innerText();
    console.log("=== EXACT ERROR ===");
    console.log(text.slice(0, 2500));
  } else {
    console.log("No error details summary found. Body:");
    console.log((await page.locator("body").innerText()).slice(0, 500));
  }

  console.log("\n=== CONSOLE ERRORS ===");
  console.log(consoleErrors.length ? consoleErrors.slice(0, 8).join("\n---\n") : "(none)");
  await browser.close();
})();
