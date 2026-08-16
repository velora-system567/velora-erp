/**
 * 5-Minute Stability Test — stays on Dashboard for 5 full minutes.
 * Logs every event with precise timestamps to capture the exact moment
 * the cascade triggers (if it does).
 *
 * This is the definitive reproduction test for the "loads for 4-5 seconds
 * then transitions to error page" symptom.
 */
const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:5173";

test("5-minute stability — detect any delayed cascade", async ({ page }) => {
  test.setTimeout(420_000); // 7 minutes

  const EVENTS = [];
  let lastBodyText = "";
  let lastUrl = "";

  function log(type, msg) {
    const ts = Date.now();
    EVENTS.push({ ts, type, msg });
    console.log(`[${new Date(ts).toISOString().slice(11, 23)}] ${type}: ${msg}`);
  }

  // ── Monitor everything ─────────────────────────────────────────
  page.on("response", (resp) => {
    if (resp.url().includes("/api/")) {
      const s = resp.status();
      const p = resp.url().replace(BASE, "").replace(/http:\/\/localhost:\d+/, "");
      log(s >= 400 ? "API_FAIL" : "API_OK", `${s} ${p}`);
    }
  });

  page.on("pageerror", (err) => {
    log("PAGE_ERR", `${err.message?.slice(0, 300)}`);
    log("PAGE_ERR_STACK", `${err.stack?.slice(0, 500)}`);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (!t.includes("favicon") && !t.includes("ResizeObserver")) {
        log("CONSOLE_ERR", t.slice(0, 300));
      }
    }
    if (msg.type() === "warn") {
      const t = msg.text();
      if (t.includes("React") || t.includes("hydration") || t.includes("error")) {
        log("CONSOLE_WARN", t.slice(0, 300));
      }
    }
  });

  page.on("requestfailed", (req) => {
    log("REQ_FAIL", `${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
  });

  // ── Login ──────────────────────────────────────────────────────
  log("PHASE", "LOGIN");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20_000 });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first().fill("jishan@velora.com");
  await page.locator('input[type="password"]').first().fill("Velora@123");
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")').first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
  const loginTime = Date.now();
  log("AUTH", `Login successful at +0s`);

  // ── Navigate to Dashboard ──────────────────────────────────────
  log("PHASE", "NAVIGATE TO DASHBOARD");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  log("NAV", `Dashboard loaded at +${((Date.now() - loginTime) / 1000).toFixed(1)}s`);

  // ── Monitor for 5 MINUTES ─────────────────────────────────────
  log("PHASE", "5-MINUTE MONITORING");
  let errorDetected = false;
  let lastCheckTime = Date.now();

  for (let sec = 0; sec <= 300; sec += 5) {
    if (sec > 0) {
      await page.waitForTimeout(5000);
    }

    const elapsed = Date.now() - loginTime;
    const elapsedSec = (elapsed / 1000).toFixed(1);

    // Check current state
    let bodyText = "";
    let currentUrl = "";
    let hasError = false;
    let isLogin = false;

    try {
      bodyText = await page.evaluate(() => document.body?.innerText || "");
      currentUrl = page.url();
      hasError = bodyText.includes("Something went wrong") ||
        bodyText.includes("An unexpected error occurred") ||
        bodyText.includes("Failed to load module");
      isLogin = currentUrl.includes("/login");
    } catch (e) {
      log("EVAL_ERR", `Failed to read page state: ${e.message}`);
    }

    // Detect changes
    const bodyChanged = bodyText !== lastBodyText;
    const urlChanged = currentUrl !== lastUrl;

    if (bodyChanged || urlChanged) {
      log("STATE_CHANGE", `bodyLen=${bodyText.length} url=${currentUrl.replace(BASE, "/")} changed=${bodyChanged}`);
      lastBodyText = bodyText;
      lastUrl = currentUrl;
    }

    // Check for failure
    if (hasError) {
      errorDetected = true;
      log("❌ CASCADE_DETECTED", `Error page at +${elapsedSec}s`);
      log("❌ CASCADE_CONTENT", bodyText.slice(0, 500));
      await page.screenshot({ path: "e2e/screenshots/stability-ERROR.png" });
      break;
    }

    if (isLogin && sec > 5) {
      errorDetected = true;
      log("❌ REDIRECT_DETECTED", `Redirected to login at +${elapsedSec}s`);
      await page.screenshot({ path: "e2e/screenshots/stability-REDIRECT.png" });
      break;
    }

    // Periodic screenshot
    if (sec % 30 === 0) {
      await page.screenshot({ path: `e2e/screenshots/stability-${sec}s.png` });
    }

    // Periodic status
    if (sec % 60 === 0) {
      log("STATUS", `+${elapsedSec}s — url=${currentUrl.replace(BASE, "/")} bodyLen=${bodyText.length} events=${EVENTS.length}`);
    }
  }

  // ── Final Analysis ─────────────────────────────────────────────
  const totalTime = ((Date.now() - loginTime) / 1000).toFixed(1);
  log("PHASE", "FINAL ANALYSIS");
  log("RESULT", `Total monitoring time: ${totalTime}s`);
  log("RESULT", `Cascade detected: ${errorDetected}`);

  const apiFails = EVENTS.filter((e) => e.type === "API_FAIL");
  log("RESULT", `Failed API calls: ${apiFails.length}`);
  for (const f of apiFails) log("RESULT", `  ${f.msg}`);

  const pageErrors = EVENTS.filter((e) => e.type === "PAGE_ERR");
  log("RESULT", `Page errors: ${pageErrors.length}`);
  for (const e of pageErrors) log("RESULT", `  ${e.msg}`);

  const consoleErrors = EVENTS.filter((e) => e.type === "CONSOLE_ERR");
  log("RESULT", `Console errors: ${consoleErrors.length}`);
  for (const e of consoleErrors) log("RESULT", `  ${e.msg}`);

  // Verify final state
  const finalAuth = await page.evaluate(() => ({
    hasToken: !!localStorage.getItem("velora_access_token"),
    hasRefresh: !!localStorage.getItem("velora_refresh_token"),
    url: window.location.href,
  }));
  log("RESULT", `Final auth: ${JSON.stringify(finalAuth)}`);
});
