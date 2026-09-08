import { chromium } from "playwright";
const BASE = "http://localhost:5173";
(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
  page.on("console",m=>{if(m.type()==="error")console.log("CONSOLE:",m.text().slice(0,200))});
  await page.goto(BASE+"/login",{waitUntil:"networkidle"});
  await page.fill('input[type="email"]',"jishan@velora.com");
  await page.fill('input[type="password"]',"Velora@123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/$|\/sales|\/dashboard/,{timeout:30000});
  await page.waitForTimeout(2500);
  const aside = page.locator("aside").first();
  console.log("initial width:", await aside.evaluate(el=>el.offsetWidth));
  console.log("collapse btn count:", await page.locator('aside button[title="Collapse sidebar"]').count());
  await page.locator('aside button[title="Collapse sidebar"]').first().click();
  await page.waitForTimeout(800);
  console.log("after click-collapse width:", await aside.evaluate(el=>el.offsetWidth));
  console.log("openBtn count:", await page.locator('button[aria-label="Open sidebar"]').count());
  // now expand via open button
  await page.locator('button[aria-label="Open sidebar"]').click();
  await page.waitForTimeout(800);
  console.log("after openBtn width:", await aside.evaluate(el=>el.offsetWidth));
  // try keyboard shortcut
  await page.keyboard.press("Control+Shift+s");
  await page.waitForTimeout(900);
  console.log("after Ctrl+Shift+s width:", await aside.evaluate(el=>el.offsetWidth));
  // try uppercase variant
  if(await aside.evaluate(el=>el.offsetWidth) > 100){
    await page.keyboard.press("Control+Shift+S");
    await page.waitForTimeout(900);
    console.log("after Ctrl+Shift+S width:", await aside.evaluate(el=>el.offsetWidth));
  }
  console.log("openBtn count final:", await page.locator('button[aria-label="Open sidebar"]').count());
  await browser.close();
})();