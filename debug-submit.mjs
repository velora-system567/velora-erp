import { chromium } from "playwright";
const BASE = "http://localhost:5173";
(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
  const apiCalls=[];
  page.on("response",r=>{if(r.url().includes("/api/sales-orders")&&r.request().method()==="POST")apiCalls.push({url:r.url(),status:r.status()})});

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

  // Select customer
  const selects = await page.locator("select").all();
  for(const s of selects){
    const opts = await s.locator("option").allInnerTexts();
    if(opts.some(o=>o.includes("Select customer"))){
      const customerOpts = opts.filter(o=>!o.includes("Select"));
      console.log("Customer dropdown found, options:", customerOpts.length);
      if(customerOpts.length>0) await s.selectOption({index:1});
      break;
    }
  }

  // Fill line item: description, qty, rate
  const allInputs = await page.locator("input").all();
  for(const inp of allInputs){
    const ph = await inp.getAttribute("placeholder");
    const type = await inp.getAttribute("type");
    const min = await inp.getAttribute("min");
    const val = await inp.inputValue();
    if(ph==="Description"&&val==="") await inp.fill("Test Widget");
    if(type==="number"&&min==="0.01"&&(val==="1"||val==="")) await inp.fill("3");
    if(type==="number"&&min==="0"&&(val==="0"||val==="")) await inp.fill("500");
  }

  await page.waitForTimeout(500);
  const submitBtn = page.getByRole("button",{name:/Create Sales Order/i});
  console.log("Submit button found:", await submitBtn.count()>0);
  console.log("Submit button enabled:", !(await submitBtn.isDisabled()));
  await submitBtn.click();
  await page.waitForTimeout(4000);

  console.log("API calls:", apiCalls);
  const formStill = await page.locator("h3",{hasText:/New Sales Order/}).count();
  console.log("Form still open:", formStill>0);
  if(formStill>0){
    // Check for error messages
    const errors = await page.locator("[class*='rose'],[class*='error'],[class*='red']").allInnerTexts();
    console.log("Error elements:", errors.slice(0,3));
  }

  const body = await page.locator("body").innerText();
  console.log("Has SO/ in list:", body.includes("SO/"));

  await browser.close();
})();