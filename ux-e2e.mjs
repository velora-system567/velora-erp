import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const USER = "jishan@velora.com";
const PASS = "Velora@123";
let passed=0, failed=0;
const results=[];
function ok(l,d){passed++; results.push("PASS: "+l+(d?" -- "+d:""))}
function fail(l,d){failed++; results.push("FAIL: "+l+(d?" -- "+d:""))}
const browser = await chromium.launch({headless:true});

async function login(page){
  await page.goto(BASE+"/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',USER);
  await page.fill('input[type="password"]',PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(2500);
}

// ========== DESKTOP ==========
{
  const ctx = await browser.newContext({viewport:{width:1440,height:900}});
  const page = await ctx.newPage();
  await login(page);

  // 1. Dashboard greeting
  const h1 = await page.locator("h1").first().innerText();
  if(h1.includes("Good")||h1.includes("Welcome")) ok("Dashboard: greeting present","\""+h1.slice(0,40)+"\"");
  else fail("Dashboard: greeting",h1.slice(0,60));

  // 2. Quick actions present
  const qa = page.getByText("What do you want to do?");
  if(await qa.count()===1) ok("Dashboard: quick actions section");
  else fail("Dashboard: quick actions section");

  // 3. Quick action buttons exist
  for(const label of ["New Sale","Add Customer","New Quotation","Record Payment","Add Product"]){
    if(await page.getByText(label,{exact:true}).count()>=1) ok("Quick action: "+label);
    else fail("Quick action: "+label);
  }

  // 4. Needs your attention section
  const attn = page.getByText("Needs your attention");
  if(await attn.count()===1) ok("Dashboard: needs your attention section");
  else fail("Dashboard: needs your attention section");

  // 5. Sidebar category headers (expanded)
  for(const cat of ["Sell","Buy","Products","Money","People"]){
    if(await page.locator('nav p:text("'+cat+'")').count()>=1) ok("Sidebar category: "+cat);
    else fail("Sidebar category: "+cat);
  }

  // 6. Sidebar uses friendly labels
  if(await page.locator('nav a:has-text("Customers")').count()>=1) ok("Sidebar: 'Customers' instead of 'CRM'");
  else fail("Sidebar: 'Customers' label");

  // 7. Sidebar collapse + expand still works
  const aside = page.locator("aside").first();
  const collapseBtn = page.locator('aside button[title="Collapse sidebar"]');
  await collapseBtn.first().click();
  await page.waitForTimeout(700);
  const w1 = await aside.evaluate(el=>el.offsetWidth);
  if(w1<10) ok("Sidebar collapse still works");
  else fail("Sidebar collapse","width="+w1);

  // 8. Open sidebar button when collapsed
  const openBtn = page.locator('button[aria-label="Open sidebar"]');
  if(await openBtn.count()===1) ok("Open sidebar button appears when collapsed");
  else fail("Open sidebar button when collapsed");

  // 9. Category headers gone when collapsed (collapsed is flat icons)
  const catLabels = await page.locator('nav p:text("Sell")').count();
  if(catLabels===0) ok("Category headers hidden when collapsed");
  else fail("Category headers hidden when collapsed");

  // 10. Expand back
  await openBtn.click();
  await page.waitForTimeout(700);
  const w2 = await aside.evaluate(el=>el.offsetWidth);
  if(w2>200) ok("Expand back works");
  else fail("Expand back","width="+w2);

  // 11. Keyboard shortcut still works
  await page.keyboard.press("Control+Shift+S");
  await page.waitForTimeout(600);
  const w3 = await aside.evaluate(el=>el.offsetWidth);
  if(w3<10) ok("Keyboard shortcut still works");
  else fail("Keyboard shortcut","width="+w3);
  await page.keyboard.press("Control+Shift+S");
  await page.waitForTimeout(600);

  // 12. Navigation regression: Sales tabs still work
  const salesTabs = ["Dashboard","Leads","Orders","Receipts"];
  await page.goto(BASE+"/sales",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(1500);
  for(const tab of salesTabs){
    await page.getByRole("tab",{name:tab}).click({timeout:5000});
    await page.waitForTimeout(3000);
    const body = await page.locator("body").innerText();
    if(body.includes("Something went wrong")||body.includes("Error details")) fail("Sales tab: "+tab,"error state");
    else ok("Sales tab: "+tab+" works");
  }

  // 13. Dashboard KPI cards still render
  await page.goto(BASE+"/",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(3000);
  const kpiLabels = ["Today's sales","Money owed to you","Products low in stock","Pending orders"];
  for(const l of kpiLabels){
    const cnt = await page.getByText(l).count();
    if(cnt>=1) ok("KPI: "+l);
    else fail("KPI: "+l);
  }

  // 14. Human-friendly secondary labels
  const secLabels = ["This month's revenue","Money collected today","Invoices created today"];
  for(const l of secLabels){
    const cnt = await page.getByText(l).count();
    if(cnt>=1) ok("Label: "+l);
    else fail("Label: "+l);
  }

  await ctx.close();
}

// ========== MOBILE ==========
{
  const ctx = await browser.newContext({viewport:{width:390,height:844}});
  const page = await ctx.newPage();
  await login(page);
  const aside = page.locator("aside").first();
  const isVisible = await aside.isVisible().catch(()=>false);
  if(!isVisible) ok("Mobile: sidebar hidden by default");
  else fail("Mobile: sidebar hidden by default");
  // drawer opens
  await page.locator("header button").first().click();
  await page.waitForTimeout(600);
  const drawer = page.locator("aside.animate-slide-in-left");
  if(await drawer.isVisible().catch(()=>false)) ok("Mobile: drawer opens");
  else fail("Mobile: drawer opens");
  // category labels present in drawer
  if(await page.locator('p:text("Sell")').count()>=1) ok("Mobile: category labels in drawer");
  else fail("Mobile: category labels in drawer");
  await ctx.close();
}

await browser.close();
console.log("");
console.log("========== UX E2E REPORT ==========");
console.log("  "+passed+" passed, "+failed+" failed");
results.forEach(r=>console.log("  "+r));
console.log("====================================");
console.log("");
process.exit(failed>0?1:0);