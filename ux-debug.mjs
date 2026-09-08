import { chromium } from "playwright";
(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
  await page.goto("http://localhost:5173/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',"jishan@velora.com");
  await page.fill('input[type="password"]',"Velora@123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(5000);
  const body = await page.locator("body").innerText();
  const idx = body.indexOf("Needs your attention");
  if(idx===-1){
    console.log("'Needs your attention' NOT found in body text");
    console.log("Page has 'attention'?", body.includes("attention"));
    console.log("Page has 'All clear'?", body.includes("All clear"));
    console.log("Body snippet:", body.slice(0,800));
  } else {
    console.log("FOUND at index",idx);
    console.log("Context:", body.slice(idx, idx+200));
  }
  await browser.close();
})();