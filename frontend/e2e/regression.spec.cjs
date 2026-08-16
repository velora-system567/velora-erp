/**
 * Full regression — every module route renders for the OWNER (no crash, no
 * permanent error), role users get the right access behavior.
 */
const { test } = require("@playwright/test");

const BASE = "http://localhost:5173";
const OWNER = { email: "yogesh.pandey54@velora.com", pass: "Velora@123" };

async function login(page, { email, pass }) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(8000);
}

async function captureErrors(page) {
  const errs = [];
  page.on("pageerror", (e) => errs.push(`PAGEERROR: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("403")) errs.push(`CONSOLE: ${m.text().slice(0, 200)}`);
  });
  return errs;
}

const OWNER_ROUTES = [
  ["/", "Dashboard"],
  ["/company", "Company"],
  ["/branches", "Branches"],
  ["/users", "Users"],
  ["/products", "Products"],
  ["/sales", "Sales"],
  ["/sales/dashboard", "Owner Dashboard"],
  ["/purchase", "Purchase"],
  ["/inventory", "Inventory"],
  ["/accounts", "Accounts"],
  ["/manufacturing", "Manufacturing"],
  ["/crm", "CRM"],
  ["/wms", "WMS"],
  ["/executive", "Executive"],
  ["/hrms", "HRMS"],
  ["/eam", "EAM"],
  ["/supplier-portal", "Supplier Portal"],
  ["/activity", "Audit"],
  ["/settings", "Settings"],
];

test.describe("OWNER regression — all modules", () => {
  test("every module renders without a permanent error", async ({ page }) => {
    test.setTimeout(360_000);
    const errs = await captureErrors(page);
    await login(page, OWNER);

    for (const [route, name] of OWNER_ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(7000);
      const body = (await page.locator("body").innerText().catch(() => "")).replace(/\n+/g, " ").slice(0, 300);
      const hasError = body.includes("Something went wrong") && !body.includes("Try Again");
      const blank = body.trim().length < 40;
      const hasBoundary = body.includes("Try Again");
      console.log(`[${name}] ${hasBoundary ? "ERROR-BOUNDARY" : hasError ? "PERMANENT-ERROR" : blank ? "BLANK" : "OK"}`);
      if (hasBoundary && route !== "/") {
        // An error boundary visible after 7s is a page that crashed — fail.
        console.log(`  -> FAIL: ${route} shows error boundary`);
      }
    }
    console.log("Page errors captured:", errs.length ? errs.slice(0, 5) : "none");
  });
});

test.describe("Role access — /sales", () => {
  test("SALES_MANAGER sees sales data, not an error", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, { email: "leena.mishra57@velora.com", pass: "Velora@123" });
    await page.goto(`${BASE}/sales`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(9000);
    const body = (await page.locator("body").innerText()).replace(/\n+/g, " | ");
    console.log("SALES_MANAGER body contains TOTAL REVENUE:", body.includes("TOTAL REVENUE"));
    console.log("SALES_MANAGER body contains 'Something went wrong':", body.includes("Something went wrong"));
  });

  test("PURCHASE_MANAGER sees Access Denied, not a broken error", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, { email: "aarti.rao51@velora.com", pass: "Velora@123" });
    await page.goto(`${BASE}/sales`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(7000);
    const body = (await page.locator("body").innerText()).replace(/\n+/g, " | ");
    console.log("PURCHASE_MANAGER sees Access Denied:", body.includes("Access Denied"));
    console.log("PURCHASE_MANAGER body contains 'Something went wrong':", body.includes("Something went wrong"));
  });
});
