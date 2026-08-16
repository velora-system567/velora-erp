import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const browser = await chromium.launch({ headless: true });

// Scenario 1: fresh login -> /sales -> refresh /sales -> data visible
let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message.slice(0, 150)));

console.log("S1: login + direct /sales + REFRESH");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(500);
await page.fill('input[type="email"]', "leena.mishra57@velora.com");
await page.fill('input[type="password"]', "Velora@123");
await page.click('button[type="submit"]');
await page.waitForTimeout(9000);
await page.goto(`${BASE}/sales`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(7000);
let body = (await page.locator("body").innerText()).replace(/\n+/g, " ");
console.log("  direct /sales:", body.includes("Something went wrong") ? "ERROR" : "OK", "| has KPI data:", /₹/.test(body) ? "YES" : "no");
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
body = (await page.locator("body").innerText()).replace(/\n+/g, " ");
console.log("  after REFRESH:", body.includes("Something went wrong") ? "ERROR" : "OK", "| has KPI data:", /₹/.test(body) ? "YES" : "no");
await ctx.close();

// Scenario 2: logout -> login -> /sales
ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
page = await ctx.newPage();
page.on("pageerror", (e) => errs.push(e.message.slice(0, 150)));
console.log("\nS2: logout -> login -> /sales");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(500);
await page.fill('input[type="email"]', "leena.mishra57@velora.com");
await page.fill('input[type="password"]', "Velora@123");
await page.click('button[type="submit"]');
await page.waitForTimeout(9000);
// logout
const logout = page.locator("text=Logout").first();
if (await logout.count()) { await logout.click(); await page.waitForTimeout(3000); }
await page.waitForURL(/login/, { timeout: 10000 }).catch(() => {});
console.log("  after logout URL:", page.url());
// login again
await page.fill('input[type="email"]', "leena.mishra57@velora.com");
await page.fill('input[type="password"]', "Velora@123");
await page.click('button[type="submit"]');
await page.waitForTimeout(9000);
await page.goto(`${BASE}/sales`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(7000);
body = (await page.locator("body").innerText()).replace(/\n+/g, " ");
console.log("  login->/sales:", body.includes("Something went wrong") ? "ERROR" : "OK", "| has KPI data:", /₹/.test(body) ? "YES" : "no");
console.log("  uncaught errors:", errs.length ? errs.slice(0,3) : "NONE");
await ctx.close();
await browser.close();
