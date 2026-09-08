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

// ---------- DESKTOP ----------
{
  const ctx = await browser.newContext({viewport:{width:1440,height:900}});
  const page = await ctx.newPage();
  const openBtn = page.locator('button[aria-label="Open sidebar"]');
  const aside = page.locator("aside").first();

  await login(page);
  const w0 = await aside.evaluate(el=>el.offsetWidth);
  if(w0>200) ok("Sidebar expanded by default ("+w0+"px)"); else fail("Sidebar expanded by default","width="+w0);
  if(await openBtn.count()===0) ok("Open button hidden while sidebar expanded"); else fail("Open button hidden while expanded");

  const collapseBtn = page.locator('aside button[title="Collapse sidebar"]');
  await collapseBtn.first().click();
  await page.waitForTimeout(800);
  const w1 = await aside.evaluate(el=>el.offsetWidth);
  if(w1<10) ok("Collapse button works"); else fail("Collapse button works","width="+w1);

  if(await openBtn.count()===1 && await openBtn.isVisible()) ok("Open sidebar button visible when collapsed"); else fail("Open button visible when collapsed");
  const ttl = await openBtn.getAttribute("title");
  if(ttl==="Open sidebar") ok("Tooltip title='Open sidebar'"); else fail("Tooltip title","got '"+ttl+"'");

  await openBtn.click();
  await page.waitForTimeout(800);
  const w2 = await aside.evaluate(el=>el.offsetWidth);
  if(w2>200) ok("Mouse click on Open button restores sidebar"); else fail("Mouse restore","width="+w2);

  await page.waitForTimeout(400);
  if(await openBtn.count()===0 || !(await openBtn.isVisible())) ok("Open button hides when sidebar expanded"); else fail("Open button hides when expanded");

  await page.keyboard.press("Control+Shift+S");
  await page.waitForTimeout(600);
  const w3 = await aside.evaluate(el=>el.offsetWidth);
  if(w3<10 && await openBtn.count()===1) ok("Keyboard shortcut still works + button reappears"); else fail("Shortcut collapse","width="+w3+" btn="+await openBtn.count());

  await openBtn.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  const w4 = await aside.evaluate(el=>el.offsetWidth);
  if(w4>200) ok("Keyboard Enter on Open button expands sidebar"); else fail("Keyboard Enter expands","width="+w4);

  await page.keyboard.press("Space"); // no-op check not needed; skip
  // persistence collapsed
  await page.locator('aside button[title="Collapse sidebar"]').first().click();
  await page.waitForTimeout(600);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForTimeout(3000);
  const w5 = await aside.evaluate(el=>el.offsetWidth);
  if(w5<10) ok("Collapsed state persists after refresh"); else fail("Persist collapsed","width="+w5);
  if(await openBtn.count()===1) ok("Open button present after refresh"); else fail("Open button after refresh");

  const modules = ["/sales","/inventory","/accounts","/crm","/hrms","/settings"];
  for(const m of modules){
    await page.goto(BASE+m,{waitUntil:"domcontentloaded"});
    await page.waitForTimeout(1500);
    const vis = await openBtn.count()===1 && await openBtn.isVisible();
    if(!vis){ fail("Module "+m,"button missing"); continue; }
    await openBtn.click();
    await page.waitForTimeout(700);
    const w = await aside.evaluate(el=>el.offsetWidth);
    if(w>200) ok("Module "+m+": restores sidebar"); else fail("Module "+m,"width="+w);
    await page.keyboard.press("Control+Shift+S");
    await page.waitForTimeout(500);
  }

  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2500);
  const w6 = await aside.evaluate(el=>el.offsetWidth);
  if(w6<10) ok("Still collapsed across module navigation (persisted)"); else fail("Collapsed persist","width="+w6);
  await ctx.close();
}

// ---------- MOBILE ----------
{
  const ctx = await browser.newContext({viewport:{width:390,height:844}});
  const page = await ctx.newPage();
  await login(page);
  const openBtn = page.locator('button[aria-label="Open sidebar"]');
  if(await openBtn.count()===0 || !(await openBtn.isVisible())) ok("Mobile: desktop Open button not rendered"); else fail("Mobile: desktop button rendered on mobile");
  // mobile drawer opens via header button
  const burger = page.locator("header button").first();
  await burger.click();
  await page.waitForTimeout(700);
  const drawerVisible = await page.locator("aside.animate-slide-in-left").isVisible().catch(()=>false);
  if(drawerVisible) ok("Mobile drawer opens"); else fail("Mobile drawer opens");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const drawerGone = !(await page.locator("aside.animate-slide-in-left").isVisible().catch(()=>false));
  if(drawerGone) ok("Mobile drawer closes with Escape"); else fail("Mobile drawer close");
  await ctx.close();
}

await browser.close();
console.log("");
console.log("========== SIDEBAR E2E REPORT ==========");
console.log("  "+passed+" passed, "+failed+" failed");
results.forEach(r=>console.log("  "+r));
console.log("========================================");
console.log("");
process.exit(failed>0?1:0);