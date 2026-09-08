import { chromium } from "playwright";
const BASE = "http://localhost:5173";
(async()=>{
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({viewport:{width:1440,height:900}});
  const page = await ctx.newPage();
  const logs=[];
  page.on("console",m=>logs.push(m.type()+": "+m.text().slice(0,300)));
  page.on("pageerror",e=>logs.push("PAGEERROR: "+String(e).slice(0,300)));

  await page.goto(BASE+"/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',"jishan@velora.com");
  await page.fill('input[type="password"]',"Velora@123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(2000);

  // Navigate to Orders
  await page.goto(BASE+"/sales?tab=Orders",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(3000);

  // Find ALL buttons with text containing "New order"
  const btns = page.locator("button").filter({hasText:/new order/i});
  const count = await btns.count();
  console.log("Buttons matching 'New order':", count);
  for(let i=0;i<count;i++){
    const txt = await btns.nth(i).innerText();
    const disabled = await btns.nth(i).isDisabled();
    const vis = await btns.nth(i).isVisible();
    const tag = await btns.nth(i).evaluate(el=>el.tagName+" type="+el.type+" onclick="+!!el.onclick);
    console.log("  ["+i+"] text='"+txt+"' disabled="+disabled+" visible="+vis+" "+tag);
  }

  // Also check AddButton in PageHeader
  const addBtns = page.locator("[class*='rounded-lg'][class*='bg-blue'][class*='font-semibold']").filter({hasText:/new order/i});
  console.log("PageHeader add buttons:", await addBtns.count());

  // Click the first "New order" button
  if(count>0){
    console.log("Clicking first 'New order' button...");
    const urlBefore = page.url();
    await btns.first().click();
    await page.waitForTimeout(2000);
    const urlAfter = page.url();
    console.log("URL before:", urlBefore);
    console.log("URL after:", urlAfter);
    console.log("URL changed:", urlBefore !== urlAfter);

    // Check if any form opened
    const h3s = await page.locator("h3").allInnerTexts();
    console.log("h3 elements on page:", h3s);

    // Check for any modal/overlay
    const modals = await page.locator("[class*='modal'],[class*='dialog'],[role='dialog']").count();
    console.log("Modal elements:", modals);
  }

  console.log("\nConsole logs after click:");
  logs.forEach(l=>console.log("  "+l));

  await browser.close();
})();