import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const BACKEND = "http://localhost:4000";
const USER = "jishan@velora.com";
const PASS = "Velora@123";
const TABS = ["Dashboard","Leads","Quotations","Orders","Delivery","Invoices","Receipts"];
let passed=0, failed=0;
const results=[];
function ok(l,d){passed++; results.push("PASS: "+l+(d?" -- "+d:""))}
function fail(l,d){failed++; results.push("FAIL: "+l+(d?" -- "+d:""))}
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1440,height:900}});
  const page = await ctx.newPage();
  const netFail=[],conErr=[];
  page.on("response",r=>{if(r.url().includes("/api/")&&r.status()>=400)netFail.push(r.status()+" "+r.request().method()+" "+r.url())});
  page.on("pageerror",e=>conErr.push("PAGEERROR: "+String(e).slice(0,500)));
  await page.goto(BASE+"/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',USER);
  await page.fill('input[type="password"]',PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(2000);
  ok("Login");
  for(const tab of TABS){
    await page.goto(BASE+"/sales",{waitUntil:"domcontentloaded"});
    await page.waitForTimeout(1500);
    await page.getByRole("tab",{name:tab}).click({timeout:5000});
    await page.waitForTimeout(4000);
    const body=await page.locator("body").innerText();
    if(body.includes("Something went wrong")||body.includes("Error details"))fail("Tab: "+tab,"error state");
    else ok("Tab: "+tab);
  }
  await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(4000);
  const ob=await page.locator("body").innerText();
  const ot=await page.getByRole("tab",{name:"Orders"}).getAttribute("aria-selected");
  if(ot==="true"&&!ob.includes("Something went wrong"))ok("Deep link /sales?tab=Orders");
  else fail("Deep link /sales?tab=Orders","tab="+ot);
  await page.goto(BASE+"/sales?tab=Quotations",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(3000);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForTimeout(4000);
  const qb=await page.locator("body").innerText();
  const qt=await page.getByRole("tab",{name:"Quotations"}).getAttribute("aria-selected");
  if(qt==="true"&&!qb.includes("Something went wrong"))ok("Refresh on Quotations");
  else fail("Refresh on Quotations","tab="+qt);
  await page.goto(BASE+"/sales?tab=Leads",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2500);
  const addBtn=page.getByRole("button",{name:/Add lead/i});
  if(await addBtn.count()===0){fail("Add Lead: button missing")}
  else{
    await addBtn.first().click();
    await page.waitForTimeout(800);
    if(await page.locator("h3",{hasText:/New lead/}).count()===0)fail("Add Lead: form did not open");
    else{
      const uniqueName="E2E Lead "+Date.now();
      await page.locator('input[placeholder="Lead name"]').fill(uniqueName);
      await page.locator('input[placeholder="lead@example.com"]').fill("e2e"+Date.now()+"@test.com");
      await page.locator('input[placeholder="City"]').fill("Testville");
      await page.getByRole("button",{name:/Create lead/}).click();
      await page.waitForTimeout(3000);
      const formStillOpen=await page.locator("h3",{hasText:/New lead/}).count();
      if(formStillOpen>0)fail("Add Lead","form still open after submit");
      else ok("Add Lead","form submitted and closed");
      await page.waitForTimeout(1000);
      const bodyAfter=await page.locator("body").innerText();
      if(bodyAfter.includes(uniqueName))ok("Add Lead visible on page");
    }
  }
  let lr;
  try{const r=await fetch(BACKEND+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:USER,password:PASS})});lr=await r.json()}catch(e){fail("Backend: login",String(e))}
  const tok=lr&&lr.data&&lr.data.accessToken;
  if(tok){
    const r1=await fetch(BACKEND+"/api/sales-orders?status=garbage",{headers:{Authorization:"Bearer "+tok}});
    if(r1.status===422)ok("Backend: invalid status returns 422");
    else fail("Backend: invalid status","expected 422 got "+r1.status);
    const r2=await fetch(BACKEND+"/api/sales-orders?page=1&limit=5",{headers:{Authorization:"Bearer "+tok}});
    if(r2.status===200)ok("Backend: normal query still 200");
    else fail("Backend: normal query",""+r2.status);
    const r3=await fetch(BACKEND+"/api/leads?status=undefined",{headers:{Authorization:"Bearer "+tok}});
    if(r3.status===422)ok("Backend: status=undefined returns 422");
    else fail("Backend: status=undefined","expected 422 got "+r3.status);
    const r4=await fetch(BACKEND+"/api/leads?page=1&limit=5",{headers:{Authorization:"Bearer "+tok}});
    if(r4.status===200)ok("Backend: leads list returns 200");
    else fail("Backend: leads list",""+r4.status);
  }
  if(netFail.some(u=>u.includes("status=undefined")))fail("No status=undefined in network");
  else ok("No status=undefined in network");
  const re=conErr.filter(e=>!e.includes("favicon"));
  if(re.length>0)fail("Console errors",re.slice(0,3).join(" | "));
  else ok("No console errors");
  console.log("");
  console.log("========== SALES E2E REPORT ==========");
  console.log("  "+passed+" passed, "+failed+" failed");
  results.forEach(r=>console.log("  "+r));
  if(netFail.length){console.log("");console.log("  API >=400:");netFail.forEach(r=>console.log("    "+r))}
  console.log("======================================");
  console.log("");
  await browser.close();
  process.exit(failed>0?1:0);
})();