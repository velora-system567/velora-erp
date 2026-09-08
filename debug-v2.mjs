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

  // Hard navigate to force full reload
  await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"networkidle"});
  await page.waitForTimeout(5000);

  // Check ALL selects for customer options
  const selects = await page.locator("select").all();
  for(let i=0;i<selects.length;i++){
    const opts = await selects[i].locator("option").allInnerTexts();
    console.log("Select #"+i+":", opts.length, "options:", opts.slice(0,3));
  }

  // Check if the "New order" button exists
  const newOrderBtn = page.locator("button").filter({hasText:/new order/i});
  console.log("New order button count:", await newOrderBtn.count());

  // Click it
  if(await newOrderBtn.count()>0){
    await newOrderBtn.first().click();
    await page.waitForTimeout(3000);
    const h3 = await page.locator("h3").allInnerTexts();
    console.log("h3 after click:", h3);
    // Check customer dropdown again (form rendered)
    const formSelects = await page.locator("select").all();
    for(let i=0;i<formSelects.length;i++){
      const opts = await formSelects[i].locator("option").allInnerTexts();
      console.log("Form Select #"+i+":", opts.length, "options:", opts.slice(0,3));
    }
  }

  await browser.close();
})();