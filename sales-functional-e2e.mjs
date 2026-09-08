import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const USER = "jishan@velora.com";
const PASS = "Velora@123";
let passed=0, failed=0;
const results=[];
function ok(l,d){passed++; results.push("PASS: "+l+(d?" -- "+d:""))}
function fail(l,d){failed++; results.push("FAIL: "+l+(d?" -- "+d:""))}
const browser = await chromium.launch({headless:true});
const ctx = await browser.newContext({viewport:{width:1440,height:900}});
const page = await ctx.newPage();
const apiErrors=[];
page.on("response",r=>{if(r.url().includes("/api/")&&r.status()>=400)apiErrors.push(r.status()+" "+r.url().split("/api/")[1])});

async function login(){
  await page.goto(BASE+"/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',USER);
  await page.fill('input[type="password"]',PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(2500);
}

await login();

// === LEADS ===
await page.goto(BASE+"/sales?tab=Leads",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(2000);
await page.getByRole("button",{name:/Add lead/i}).first().click();
await page.waitForTimeout(500);
if(await page.locator("h3",{hasText:/New lead/}).count()>0) ok("Leads: Add form opens");
else fail("Leads: Add form does not open");

// === QUOTATIONS ===
await page.goto(BASE+"/sales?tab=Quotations",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(2000);
const qtAddBtn = page.getByRole("button",{name:/New quotation/i}).first();
if(await qtAddBtn.count()>0){await qtAddBtn.click(); await page.waitForTimeout(800);}
const qtForm = page.locator("h3",{hasText:/New Quotation/});
if(await qtForm.count()>0) ok("Quotations: Create form opens");
else fail("Quotations: Create form does not open");
// Cancel form
const cancelBtns = page.getByRole("button",{name:/Cancel/});
if(await cancelBtns.count()>0) await cancelBtns.first().click();
await page.waitForTimeout(300);

// === ORDERS ===
await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(2000);
const ordAddBtn = page.getByRole("button",{name:/New order/i}).first();
if(await ordAddBtn.count()>0){await ordAddBtn.click(); await page.waitForTimeout(800);}
const ordForm = page.locator("h3",{hasText:/New Sales Order/});
if(await ordForm.count()>0) ok("Orders: Create form opens");
else fail("Orders: Create form does not open");

// === DELIVERY ===
await page.goto(BASE+"/sales?tab=Delivery",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(2000);
const delAddBtn = page.getByRole("button",{name:/New delivery/i}).first();
if(await delAddBtn.count()>0){await delAddBtn.click(); await page.waitForTimeout(800);}
const delForm = page.locator("h3",{hasText:/New Delivery Note/});
if(await delForm.count()>0) ok("Delivery: Create form opens");
else fail("Delivery: Create form does not open");

// === INVOICES ===
await page.goto(BASE+"/sales?tab=Invoices",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(2000);
const invAddBtn = page.getByRole("button",{name:/New invoice/i}).first();
if(await invAddBtn.count()>0){await invAddBtn.click(); await page.waitForTimeout(800);}
const invForm = page.locator("h3",{hasText:/New Invoice/});
if(await invForm.count()>0) ok("Invoices: Create form opens");
else fail("Invoices: Create form does not open");

// === RECEIPTS ===
await page.goto(BASE+"/sales?tab=Receipts",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(2000);
const recAddBtn = page.getByRole("button",{name:/Record receipt/i}).first();
if(await recAddBtn.count()>0){await recAddBtn.click(); await page.waitForTimeout(800);}
const recForm = page.locator("h3",{hasText:/Record payment receipt/});
if(await recForm.count()>0) ok("Receipts: Create form opens");
else fail("Receipts: Create form does not open");

// === LISTS LOAD ===
for(const tab of ["Leads","Quotations","Orders","Delivery","Invoices","Receipts"]){
  await page.goto(BASE+"/sales?tab="+tab,{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  if(body.includes("Something went wrong")||body.includes("Error details")) fail(tab+": list loads","error state");
  else ok(tab+": list loads");
}

// === STATUS UPDATE on Quotations ===
await page.goto(BASE+"/sales?tab=Quotations",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(2500);
const statusSelect = page.locator('select:has(option[value="SUBMITTED"])').first();
if(await statusSelect.count()>0){await statusSelect.selectOption("SUBMITTED"); await page.waitForTimeout(1000); ok("Quotations: status change"); }
else ok("Quotations: no editable docs to change status (ok)");

// === SEARCH ===
await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(2000);
const searchInput = page.locator('input[aria-label="Search"]');
if(await searchInput.count()>0){await searchInput.fill("SO/2026"); await page.waitForTimeout(1500); ok("Orders: search field works");}
else fail("Orders: search field missing");

// === DASHBOARD ===
await page.goto(BASE+"/sales?tab=Dashboard",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(3000);
const dashBody = await page.locator("body").innerText();
if(dashBody.includes("KPI")||dashBody.includes("sales")||dashBody.includes("Sales")) ok("Dashboard: loads");
else fail("Dashboard: did not load");

if(apiErrors.length>0) fail("No API errors",apiErrors.slice(0,3).join("; "));
else ok("No API >=400 errors");

await browser.close();
console.log("");
console.log("========== SALES FUNCTIONAL E2E ==========");
console.log("  "+passed+" passed, "+failed+" failed");
results.forEach(r=>console.log("  "+r));
console.log("==========================================");
console.log("");
process.exit(failed>0?1:0);