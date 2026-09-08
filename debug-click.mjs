import { chromium } from "playwright";
const BASE = "http://localhost:5173";
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1440,height:900}});
  const page = await ctx.newPage();
  page.on("pageerror",e=>console.log("PAGEERROR:",String(e).slice(0,200)));

  await page.goto(BASE+"/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',"jishan@velora.com");
  await page.fill('input[type="password"]',"Velora@123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(2000);

  await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(3000);

  const btn = page.locator("button").filter({hasText:/new order/i}).first();
  console.log("Button exists:", await btn.count()>0);
  console.log("Button visible:", await btn.isVisible());

  await btn.click();
  await page.waitForTimeout(1500);

  const h3 = await page.locator("h3").allInnerTexts();
  console.log("h3 after click:", h3);

  const formVisible = await page.locator("form").count() > 0;
  console.log("Form visible:", formVisible);

  const bodyText = (await page.locator("body").innerText()).slice(0,600);
  console.log("Body includes 'Sales Order':", bodyText.includes("Sales Order"));
  console.log("Body includes 'Customer':", bodyText.includes("Customer"));
  console.log("Body includes 'Line items':", bodyText.includes("Line items"));

  // Test all tabs
  for(const [tab,formText] of [["Quotations","New Quotation"],["Orders","New Sales Order"],["Delivery","New Delivery Note"],["Invoices","New Invoice"]]){
    await page.goto(BASE+"/sales?tab="+tab,{waitUntil:"domcontentloaded"});
    await page.waitForTimeout(2500);
    const addBtn = page.locator("button").filter({hasText:new RegExp("new "+tab.slice(0,-1),"i")}).first();
    if(await addBtn.count()>0){
      await addBtn.click();
      await page.waitForTimeout(1000);
      const found = await page.locator("h3").allInnerTexts();
      console.log(tab+": form h3s:", found);
    }
  }

  await browser.close();
})();