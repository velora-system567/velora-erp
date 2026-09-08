import { chromium } from "playwright";
const BASE = "http://localhost:5173";
(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
  page.on("pageerror",e=>console.log("PAGEERROR:",String(e).slice(0,200)));
  const apiCalls=[];
  page.on("request",r=>{if(r.url().includes("/api/sales-orders")&&r.method()==="POST")apiCalls.push({body:r.postData()?.slice(0,300)})});
  page.on("response",r=>{if(r.url().includes("/api/sales-orders")&&r.method()==="POST")apiCalls.push({status:r.status()})});

  await page.goto(BASE+"/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',"jishan@velora.com");
  await page.fill('input[type="password"]',"Velora@123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(2000);

  await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(3000);

  // Check customer dropdown has options now
  const custOpts = await page.locator("select").filter({hasText:/Select customer/}).first().locator("option").count();
  console.log("Customer options in dropdown:", custOpts);

  await page.getByRole("button",{name:/New order/i}).first().click();
  await page.waitForTimeout(1500);

  // Check form opened
  const formH3 = await page.locator("h3").allInnerTexts();
  console.log("Form h3s:", formH3);

  // Select customer
  const custSelect = page.locator("select").filter({hasText:/Select customer/}).first();
  const cOpts = await custSelect.locator("option").count();
  console.log("Customer options after form open:", cOpts);
  if(cOpts>1) await custSelect.selectOption({index:1});

  // Fill line
  await page.locator('input[placeholder="Description"]').first().fill("E2E Order Item");
  await page.locator('input[type="number"][min="0.01"]').first().fill("3");
  await page.locator('input[type="number"][min="0"]').first().fill("1000");
  await page.waitForTimeout(300);

  // Submit
  await page.getByRole("button",{name:/Create Sales Order/i}).click();
  await page.waitForTimeout(5000);

  console.log("API calls:", JSON.stringify(apiCalls));
  const formGone = (await page.locator("h3",{hasText:/New Sales Order/}).count()) === 0;
  console.log("Form closed:", formGone);
  const body = await page.locator("body").innerText();
  console.log("List has SO/:", body.includes("SO/"));

  await browser.close();
})();