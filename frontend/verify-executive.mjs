import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 150)));
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.fill('input[type="email"]', "leena.mishra57@velora.com");
await page.fill('input[type="password"]', "Velora@123");
await page.click('button[type="submit"]');
await page.waitForTimeout(9000);
// Direct /executive
await page.goto(`${BASE}/executive`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
let body = (await page.locator("body").innerText()).replace(/\n+/g, " ");
console.log("/executive:", body.includes("Something went wrong") ? "ERROR" : body.trim().length < 40 ? "BLANK" : "OK", "|", body.slice(0, 80));
// Now navigate via sidebar from dashboard
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const link = page.locator('a[href="/executive"]').first();
if (await link.count()) {
  await link.click();
  await page.waitForTimeout(5000);
  body = (await page.locator("body").innerText()).replace(/\n+/g, " ");
  console.log("sidebar->/executive:", body.includes("Something went wrong") ? "ERROR" : body.trim().length < 40 ? "BLANK" : "OK", "|", body.slice(0, 80));
} else {
  console.log("sidebar link /executive NOT FOUND");
}
await browser.close();
