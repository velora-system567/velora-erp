/**
 * Sales Diagnostic — Detailed check of what's happening on /sales
 */
const { test, expect } = require("@playwright/test");
const BASE = "http://localhost:5173";

test("Sales diagnostic — capture query state", async ({ page }) => {
  test.setTimeout(120_000);

  const apiCalls = [];
  page.on("response", (resp) => {
    if (resp.url().includes("/api/")) {
      apiCalls.push({
        url: resp.url().replace(BASE, ""),
        status: resp.status(),
        time: Date.now(),
      });
    }
  });

  page.on("pageerror", (err) => console.error(`PAGE_ERROR: ${err.message}`));

  // Login
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"], input[name="email"]').first().fill("jishan@velora.com");
  await page.locator('input[type="password"]').first().fill("Velora@123");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);

  console.log(`After login: ${page.url().replace(BASE, "/")}`);

  // Navigate to Sales
  apiCalls.length = 0;
  await page.goto(`${BASE}/sales`, { waitUntil: "domcontentloaded", timeout: 15_000 });

  // Wait 15 seconds — plenty of time
  await page.waitForTimeout(15_000);

  // Capture body text
  const bodyText = await page.evaluate(() => document.body?.innerText || "");
  console.log(`\n=== BODY TEXT (first 500 chars) ===\n${bodyText.slice(0, 500)}`);
  console.log(`\n=== BODY LENGTH: ${bodyText.length} ===`);

  // Check for skeleton loaders (they're CSS-animated grey boxes)
  const skeletonCount = await page.locator('[class*="animate-pulse"], [class*="skeleton"], [class*="Skeleton"]').count();
  console.log(`\n=== SKELETON ELEMENTS: ${skeletonCount} ===`);

  // Check what API calls were made
  console.log(`\n=== API CALLS (${apiCalls.length} total) ===`);
  for (const call of apiCalls) {
    console.log(`  ${call.status} ${call.url}`);
  }

  // Check if there are any visible error messages
  const errorVisible = await page.locator('text="Something went wrong"').count();
  const accessDenied = await page.locator('text="Access Denied"').count();
  console.log(`\n=== ERROR STATES ===`);
  console.log(`  "Something went wrong": ${errorVisible}`);
  console.log(`  "Access Denied": ${accessDenied}`);

  // Check if "Sales Management" header is visible
  const headerVisible = await page.locator('text="Sales Management"').count();
  console.log(`  "Sales Management" header: ${headerVisible}`);

  // Take screenshot
  await page.screenshot({ path: "e2e/screenshots/sales-diag.png", fullPage: true });

  // Check if skeleton is still showing after 15s — that's the bug
  console.log(`\n=== CONCLUSION ===`);
  if (skeletonCount > 0 && !bodyText.includes("Total Revenue") && !bodyText.includes("No sales data")) {
    console.log("STUCK ON SKELETON LOADING — data never populated");
  } else if (bodyText.includes("Total Revenue") || bodyText.includes("Total revenue")) {
    console.log("Dashboard loaded successfully");
  } else if (bodyText.includes("No sales data")) {
    console.log("Empty state shown — no data");
  } else {
    console.log("Unknown state — check screenshot");
  }
});
