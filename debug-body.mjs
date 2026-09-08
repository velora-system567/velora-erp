import { chromium } from "playwright";
const BASE = "http://localhost:5173";
(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
  page.on("request",r=>{
    if(r.url().includes("/api/sales-orders")&&r.method()==="POST"){
      console.log("REQUEST BODY:", r.postData());
    }
  });
  page.on("response",r=>{
    if(r.url().includes("/api/sales-orders")&&r.method()==="POST"){
      r.text().then(t=>console.log("RESPONSE:",r.status(),t.slice(0,300)));
    }
  });

  await page.goto(BASE+"/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',"jishan@velora.com");
  await page.fill('input[type="password"]',"Velora@123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(2000);

  await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(3000);
  await page.getByRole("button",{name:/New order/i}).first().click();
  await page.waitForTimeout(1500);

  // Select first customer
  const custSelect = page.locator("select").filter({hasText:/Select customer/}).first();
  const opts = await custSelect.locator("option").all();
  console.log("Customer options:", opts.length);
  if(opts.length>1) await custSelect.selectOption({index:1});

  // Fill line: set description, qty=2, rate=1000
  const lineDesc = page.locator('input[placeholder="Description"]').first();
  const lineQty = page.locator('input[type="number"][min="0.01"]').first();
  const lineRate = page.locator('input[type="number"][min="0"]').first();
  await lineDesc.fill("Browser Test Item");
  await lineQty.fill("2");
  await lineRate.fill("1000");
  await page.waitForTimeout(300);

  await page.getByRole("button",{name:/Create Sales Order/i}).click();
  await page.waitForTimeout(5000);

  await browser.close();
})();