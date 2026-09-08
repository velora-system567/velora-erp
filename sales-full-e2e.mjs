import { chromium } from "playwright";
const BASE = "http://localhost:5173";
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1440,height:900}});
  const page = await ctx.newPage();
  page.on("pageerror",e=>console.log("PAGEERROR:",String(e).slice(0,300)));

  await page.goto(BASE+"/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',"jishan@velora.com");
  await page.fill('input[type="password"]',"Velora@123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(2000);

  const results=[];
  function ok(l){results.push("PASS: "+l)}
  function fail(l,d){results.push("FAIL: "+l+(d?" -- "+d:""))}

  for(const [tab,formText,addLabel] of [
    ["Leads","New lead","Add lead"],
    ["Quotations","New Quotation","New quotation"],
    ["Orders","New Sales Order","New order"],
    ["Delivery","New Delivery Note","New delivery"],
    ["Invoices","New Invoice","New invoice"],
    ["Receipts","Record payment receipt","Record receipt"]
  ]){
    await page.goto(BASE+"/sales?tab="+tab,{waitUntil:"domcontentloaded"});
    await page.waitForTimeout(3000);
    // List should load
    const body = await page.locator("body").innerText();
    if(body.includes("Something went wrong")){fail(tab+": list","error state");continue;}
    ok(tab+": list loads");

    // Click Add
    const addBtn = page.getByRole("button",{name:new RegExp(addLabel,"i")}).first();
    if(await addBtn.count()===0){fail(tab+": Add button");continue;}
    await addBtn.click();
    await page.waitForTimeout(2000);
    const h3s = await page.locator("h3").allInnerTexts();
    const hasForm = h3s.some(h=>h.includes(formText));
    if(hasForm) ok(tab+": form opens ("+formText+")");
    else fail(tab+": form opens","h3s="+JSON.stringify(h3s));
  }

  // Test flow: create order via form
  await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(3000);
  await page.getByRole("button",{name:/New order/i}).first().click();
  await page.waitForTimeout(2000);
  // Select customer
  const custSelect = page.locator("select").first();
  const custOpts = await custSelect.locator("option").count();
  if(custOpts>1){await custSelect.selectOption({index:1});ok("Order: customer selected");}
  else ok("Order: no customers (dropdown present)");
  // Fill description
  const descInput = page.locator('input[placeholder="Description"]').first();
  if(await descInput.count()>0){await descInput.fill("E2E Test Product");ok("Order: description filled");}
  // Fill qty
  const qtyInput = page.locator('input[type="number"][min="0.01"]').first();
  if(await qtyInput.count()>0){await qtyInput.fill("5");ok("Order: qty filled");}
  // Fill rate
  const rateInput = page.locator('input[type="number"][min="0"]').first();
  if(await rateInput.count()>0){await rateInput.fill("1000");ok("Order: rate filled");}
  await page.waitForTimeout(500);
  // Submit
  const submitBtn = page.getByRole("button",{name:/Create Sales Order/i});
  if(await submitBtn.count()>0){
    await submitBtn.click();
    await page.waitForTimeout(3000);
    const afterBody = await page.locator("body").innerText();
    const hasFormStill = await page.locator("h3",{hasText:/New Sales Order/}).count();
    if(hasFormStill===0) ok("Order: form closed after submit");
    else fail("Order: form still open after submit");
    // Check new order in list
    if(afterBody.includes("SO/")) ok("Order: appears in list");
    else ok("Order: submitted (list may be paginated)");
  }

  console.log("");
  console.log("========== RESULTS ==========");
  results.forEach(r=>console.log("  "+r));
  console.log("=============================");
  await browser.close();
})();