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

  // Hard reload to pick up reverted code
  await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"networkidle"});
  await page.waitForTimeout(5000);

  // Click New order
  await page.locator("button").filter({hasText:/new order/i}).first().click();
  await page.waitForTimeout(2000);

  // Check form opened
  const h3 = await page.locator("h3").allInnerTexts();
  console.log("Form h3s:", h3);

  // Check customer dropdown
  const custSelect = page.locator("select").filter({hasText:/Select customer/}).first();
  const cOpts = await custSelect.locator("option").allInnerTexts();
  console.log("Customer options:", cOpts.length, cOpts.slice(0,3));

  if(cOpts.length > 1){
    await custSelect.selectOption({index:1});
    console.log("Customer selected");
  }

  // Fill line items
  await page.locator('input[placeholder="Description"]').first().fill("Final Test Widget");
  await page.locator('input[type="number"][min="0.01"]').first().fill("2");
  await page.locator('input[type="number"][min="0"]').first().fill("750");
  await page.waitForTimeout(300);

  // Submit
  const submit = page.getByRole("button",{name:/Create Sales Order/i});
  console.log("Submit button:", await submit.count()>0);
  await submit.click();
  await page.waitForTimeout(5000);

  // Check result
  const formGone = (await page.locator("h3",{hasText:/New Sales Order/}).count()) === 0;
  console.log("Form closed after submit:", formGone);
  const body = await page.locator("body").innerText();
  console.log("Has SO/ in list:", body.includes("SO/"));

  // Verify via API
  const resp = await page.evaluate(async()=>{
    const token = localStorage.getItem("velora_access_token");
    const r = await fetch("/api/sales-orders?page=1&limit=5",{headers:{Authorization:"Bearer "+token}});
    return await r.json();
  });
  console.log("Orders via API:", resp.data?.meta?.total, "orders");
  if(resp.data?.rows) resp.data.rows.slice(0,3).forEach(r=>console.log("  ",r.documentNo,"-",r.party?.name,"-",r.totalAmount));

  await browser.close();
})();