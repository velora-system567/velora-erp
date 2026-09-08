import { chromium } from "playwright";
const BASE = "http://localhost:5173";
(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();

  await page.goto(BASE+"/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',"jishan@velora.com");
  await page.fill('input[type="password"]',"Velora@123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(2000);
  await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"networkidle"});
  await page.waitForTimeout(5000);

  await page.locator("button").filter({hasText:/new order/i}).first().click();
  await page.waitForTimeout(2000);

  // Select customer
  await page.locator("select").filter({hasText:/Select customer/}).first().selectOption({index:1});

  // Fill line
  await page.locator('input[placeholder="Description"]').first().fill("Debug Item");
  await page.locator('input[type="number"][min="0.01"]').first().fill("1");
  await page.locator('input[type="number"][min="0"]').first().fill("500");

  // Intercept the request
  await page.route("**/api/sales-orders", async route => {
    const req = route.request();
    if(req.method()==="POST"){
      console.log("INTERCEPTED POST body:", req.postData());
      const response = await route.fetch();
      console.log("Response status:", response.status());
      const body = await response.text();
      console.log("Response body:", body.slice(0,500));
      await route.fulfill({response});
    } else {
      await route.continue();
    }
  });

  await page.getByRole("button",{name:/Create Sales Order/i}).click();
  await page.waitForTimeout(5000);
  await browser.close();
})();