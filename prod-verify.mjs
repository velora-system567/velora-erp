import { chromium } from "playwright";
const BASE = "https://velora-erp.vercel.app";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const r = [];
  function ok(l) { r.push("PASS: " + l); }
  function fail(l, d) { r.push("FAIL: " + l + (d ? " -- " + d : "")); }
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "jishan@velora.com");
  await page.fill('input[type="password"]', "Velora@123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(2000);
  for (const tab of ["Dashboard", "Leads", "Orders", "Quotations", "Delivery", "Invoices", "Receipts"]) {
    await page.goto(BASE + "/sales?tab=" + tab, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const b = await page.locator("body").innerText();
    if (b.includes("Something went wrong")) fail(tab + ": list", "error");
    else ok(tab + ": list");
  }
  await page.goto(BASE + "/sales?tab=Orders", { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
  await page.locator("button").filter({ hasText: /new order/i }).first().click();
  await page.waitForTimeout(2000);
  const h3 = await page.locator("h3").allInnerTexts();
  if (h3.some(h => h.includes("Sales Order"))) ok("New Order form opens");
  else fail("New Order form", h3);
  console.log("");
  console.log("=== PROD VERIFICATION ===");
  r.forEach(x => console.log(" " + x));
  console.log("=========================");
  await browser.close();
})();
