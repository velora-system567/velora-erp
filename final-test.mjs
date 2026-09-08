import { chromium } from "playwright";
const BASE = "http://localhost:5173";
(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
  page.on("pageerror",e=>console.log("PAGEERROR:",String(e).slice(0,300)));

  await page.goto(BASE+"/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',"jishan@velora.com");
  await page.fill('input[type="password"]',"Velora@123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(2000);

  const results=[];
  function ok(l,d){results.push("PASS: "+l+(d?" -- "+d:""))}
  function fail(l,d){results.push("FAIL: "+l+(d?" -- "+d:""))}

  // TEST 1: New Order button opens form
  await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"networkidle"});
  await page.waitForTimeout(5000);
  await page.locator("button").filter({hasText:/new order/i}).first().click();
  await page.waitForTimeout(2000);
  if(await page.locator("h3",{hasText:/New Sales Order/}).count()>0) ok("New Order button opens form");
  else fail("New Order button");

  // TEST 2: Customer dropdown populated
  const cOpts = await page.locator("select").filter({hasText:/Select customer/}).first().locator("option").count();
  if(cOpts>1) ok("Customer dropdown populated ("+cOpts+" options)");
  else fail("Customer dropdown","only "+cOpts+" options");

  // TEST 3: Create actual order
  await page.locator("select").filter({hasText:/Select customer/}).first().selectOption({index:1});
  await page.locator('input[placeholder="Description"]').first().fill("Production Test Order");
  await page.locator('input[type="number"][min="0.01"]').first().fill("5");
  await page.locator('input[type="number"][min="0"]').first().fill("1200");
  await page.waitForTimeout(300);
  await page.getByRole("button",{name:/Create Sales Order/i}).click();
  await page.waitForTimeout(5000);
  const formGone = (await page.locator("h3",{hasText:/New Sales Order/}).count())===0;
  if(formGone) ok("Order form closes after submit");
  else fail("Order form did not close after submit");
  const body = await page.locator("body").innerText();
  if(body.includes("SO/")) ok("New order appears in Orders list");
  else fail("New order not in list");

  // TEST 4: Create quotation
  await page.goto(BASE+"/sales?tab=Quotations",{waitUntil:"networkidle"});
  await page.waitForTimeout(4000);
  await page.locator("button").filter({hasText:/new quotation/i}).first().click();
  await page.waitForTimeout(2000);
  await page.locator("select").filter({hasText:/Select customer/}).first().selectOption({index:1});
  await page.locator('input[placeholder="Description"]').first().fill("Test Quotation");
  await page.locator('input[type="number"][min="0.01"]').first().fill("2");
  await page.locator('input[type="number"][min="0"]').first().fill("3000");
  await page.getByRole("button",{name:/Create Quotation/i}).click();
  await page.waitForTimeout(5000);
  if((await page.locator("h3",{hasText:/New Quotation/}).count())===0) ok("Quotation created");
  else fail("Quotation creation");

  // TEST 5: Create invoice
  await page.goto(BASE+"/sales?tab=Invoices",{waitUntil:"networkidle"});
  await page.waitForTimeout(4000);
  await page.locator("button").filter({hasText:/new invoice/i}).first().click();
  await page.waitForTimeout(2000);
  await page.locator("select").filter({hasText:/Select customer/}).first().selectOption({index:1});
  await page.locator('input[placeholder="Description"]').first().fill("Test Invoice");
  await page.locator('input[type="number"][min="0.01"]').first().fill("1");
  await page.locator('input[type="number"][min="0"]').first().fill("5000");
  await page.getByRole("button",{name:/Create Invoice/i}).click();
  await page.waitForTimeout(5000);
  if((await page.locator("h3",{hasText:/New Invoice/}).count())===0) ok("Invoice created");
  else fail("Invoice creation");

  // TEST 6: Refresh persistence
  await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"networkidle"});
  await page.waitForTimeout(4000);
  const refreshBody = await page.locator("body").innerText();
  if(refreshBody.includes("SO/")) ok("Orders persist after refresh");
  else fail("Orders persist after refresh");

  // TEST 7: Dashboard loads
  await page.goto(BASE+"/sales?tab=Dashboard",{waitUntil:"networkidle"});
  await page.waitForTimeout(4000);
  const dashBody = await page.locator("body").innerText();
  if(dashBody.includes("Sales")) ok("Dashboard loads");
  else fail("Dashboard");

  console.log("");
  console.log("========== FINAL REPORT ==========");
  results.forEach(r=>console.log("  "+r));
  console.log("==================================");
  await browser.close();
})();