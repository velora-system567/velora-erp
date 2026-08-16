/**
 * Cascade Trace — Reproduce the 4-5 second failure precisely.
 *
 * Logs EVERY event with timestamps to identify the FIRST failure
 * that triggers the cascade to "Something went wrong".
 *
 * Strategy:
 * 1. Login via browser (injects tokens)
 * 2. Navigate to Dashboard
 * 3. Capture ALL console messages, network requests/responses, page errors
 *   for 20 seconds
 * 4. Take screenshots every 2 seconds
 * 5. Log a timeline of events to find the trigger
 */
const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:5173";
const API = "http://localhost:4000";

test("trace 4-5s cascade failure on Dashboard", async ({ page }) => {
  test.setTimeout(120_000);

  const TIMELINE = [];
  const API_LOG = [];

  function log(msg) {
    const ts = Date.now();
    TIMELINE.push({ ts, msg });
    console.log(`[${msg}]`);
  }

  // ── Intercept ALL network traffic ──────────────────────────────
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/")) {
      API_LOG.push({
        time: Date.now(),
        phase: "request",
        method: req.method(),
        url: url.replace(BASE, ""),
      });
      log(`→ REQ ${req.method()} ${url.replace(BASE, "").replace(API.replace("http://", ""), "")}`);
    }
  });

  page.on("response", (resp) => {
    const url = resp.url();
    if (url.includes("/api/")) {
      const entry = {
        time: Date.now(),
        phase: "response",
        status: resp.status(),
        url: url.replace(BASE, "").replace(API.replace("http://", ""), ""),
      };
      API_LOG.push(entry);
      const icon = resp.status() >= 400 ? "❌" : "✅";
      log(`${icon} RES ${resp.status()} ${url.replace(BASE, "").replace(API.replace("http://", ""), "")}`);
    }
  });

  page.on("requestfailed", (req) => {
    log(`💥 REQ_FAILED ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
  });

  // ── Console messages ───────────────────────────────────────────
  page.on("console", (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (type === "error") {
      log(`🔴 CONSOLE_ERROR: ${text.slice(0, 200)}`);
    } else if (type === "warn") {
      log(`🟡 CONSOLE_WARN: ${text.slice(0, 200)}`);
    }
  });

  // ── Page errors (React exceptions) ─────────────────────────────
  page.on("pageerror", (err) => {
    log(`💥 PAGE_ERROR: ${err.message?.slice(0, 200)}`);
    if (err.stack) log(`   STACK: ${err.stack.slice(0, 300)}`);
  });

  // ── Unhandled rejections ───────────────────────────────────────
  page.on("crash", () => {
    log(`💀 PAGE_CRASH`);
  });

  // ── Step 1: Login via UI ──────────────────────────────────────
  log("=== PHASE: LOGIN ===");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20_000 });
  await page.waitForTimeout(2000);

  // Fill login form via UI
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  await emailInput.fill("jishan@velora.com");
  await passwordInput.fill("Velora@123");

  const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")').first();
  await submitBtn.click();

  // Wait for redirect to dashboard (or any authenticated page)
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
  log(`Logged in — redirected to: ${page.url().replace(BASE, "/")}`);

  // Decode JWT to check permissions
  const jwtPayload = await page.evaluate(() => {
    const token = localStorage.getItem("velora_access_token");
    if (!token) return null;
    try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
  });
  log(`JWT sub: ${jwtPayload?.sub}`);
  log(`JWT permissions: ${JSON.stringify(jwtPayload?.permissions?.slice(0, 5))}...`);
  log(`JWT exp: ${new Date(jwtPayload?.exp * 1000).toISOString()}`);

  // ── Step 2: Navigate to Dashboard and MONITOR ──────────────────
  log("=== PHASE: NAVIGATE TO DASHBOARD ===");
  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  log(`Navigation complete at +${Date.now() - t0}ms`);

  // ── Step 3: Monitor for 20 seconds, take screenshots every 2s ─
  log("=== PHASE: MONITORING (20 seconds) ===");
  for (let sec = 0; sec <= 20; sec += 2) {
    await page.waitForTimeout(sec === 0 ? 0 : 2000);

    const elapsed = Date.now() - t0;
    const bodyText = await page.evaluate(() => document.body?.innerText || "");
    const hasErrorPage = bodyText.includes("Something went wrong") ||
      bodyText.includes("An unexpected error occurred") ||
      bodyText.includes("Failed to load module");

    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes("/login");

    await page.screenshot({
      path: `e2e/screenshots/cascade-t${sec}s.png`,
      fullPage: false,
    });

    log(`📸 t=${elapsed}ms (${sec}s) url=${currentUrl.replace(BASE, "/")} errorPage=${hasErrorPage} bodyLen=${bodyText.length}`);

    if (hasErrorPage) {
      log(`❌ ERROR PAGE DETECTED at t=${elapsed}ms!`);
      // Capture the full error page text
      const errorText = await page.evaluate(() => document.body?.innerText || "");
      log(`Error page content: ${errorText.slice(0, 500)}`);
      break;
    }

    if (isLoginPage) {
      log(`🔴 REDIRECTED TO LOGIN at t=${elapsed}ms! Session may have expired.`);
      break;
    }
  }

  // ── Step 4: Analyze the timeline ───────────────────────────────
  log("=== PHASE: ANALYSIS ===");
  log(`Total API calls: ${API_LOG.filter((e) => e.phase === "request").length}`);
  log(`Total API responses: ${API_LOG.filter((e) => e.phase === "response").length}`);

  const failedApis = API_LOG.filter((e) => e.phase === "response" && e.status >= 400);
  if (failedApis.length) {
    log(`❌ FAILED API CALLS:`);
    for (const f of failedApis) {
      log(`  ${f.status} ${f.url}`);
    }
  }

  const consoleErrors = TIMELINE.filter((e) => e.msg.includes("CONSOLE_ERROR"));
  if (consoleErrors.length) {
    log(`❌ CONSOLE ERRORS (${consoleErrors.length}):`);
    for (const e of consoleErrors) {
      log(`  ${e.msg}`);
    }
  }

  const pageErrors = TIMELINE.filter((e) => e.msg.includes("PAGE_ERROR"));
  if (pageErrors.length) {
    log(`❌ PAGE ERRORS (${pageErrors.length}):`);
    for (const e of pageErrors) {
      log(`  ${e.msg}`);
    }
  }

  // Check auth state at the end
  const finalAuthState = await page.evaluate(() => ({
    hasToken: !!localStorage.getItem("velora_access_token"),
    hasRefresh: !!localStorage.getItem("velora_refresh_token"),
    hasUser: !!localStorage.getItem("velora_user"),
    currentUrl: window.location.href,
  }));
  log(`Final auth state: ${JSON.stringify(finalAuthState)}`);

  log("=== TRACE COMPLETE ===");

  // This test is for diagnosis only — don't fail on findings
  // The findings are logged above for analysis
});
