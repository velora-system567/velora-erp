/**
 * Velora ERP — Email Service (Resend only)
 *
 * Sends transactional emails via Resend with branded HTML templates.
 *
 * ── Configuration ──────────────────────────────────────────────
 *   RESEND_API_KEY    Required in production. Get one at https://resend.com
 *   OTP_FROM_EMAIL    Sender address, e.g. "noreply@yourdomain.com"
 *
 * ── Development ────────────────────────────────────────────────
 * When Resend is not configured (RESEND_API_KEY / OTP_FROM_EMAIL missing),
 * the service logs the email contents to the server console instead of
 * sending. This lets you test the full auth flow without an email provider.
 *
 * In production, missing config causes a clear error with instructions.
 * ────────────────────────────────────────────────────────────────
 */

import { env } from "../config/env.js";

function checkConfig() {
  const missing = [];
  if (!env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!env.OTP_FROM_EMAIL) missing.push("OTP_FROM_EMAIL");
  return missing;
}

export { checkConfig };

/**
 * Core send function. Uses Resend API for delivery.
 * Falls back to console.log in development when config is missing.
 */
async function send({ to, subject, html }) {
  const missing = checkConfig();

  if (missing.length > 0) {
    if (env.NODE_ENV === "production") {
      throw new Error(
        `Email delivery requires: ${missing.join(", ")}. ` +
        "Set these in your environment variables or .env file."
      );
    }
    // Development: log to console so flows can be tested without an email provider
    console.log("\n" + "=".repeat(60));
    console.log("📧 DEV EMAIL — No email provider configured");
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body:    ${html.replace(/<[^>]*>/g, "").trim().slice(0, 300)}…`);
    console.log("=".repeat(60) + "\n");
    console.log(`💡 To send real emails, add to your .env:\n   RESEND_API_KEY=re_...\n   OTP_FROM_EMAIL=noreply@yourdomain.com\n`);
    return null;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.OTP_FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Resend API error (${response.status}): ${errBody}`);
  }

  return response.json();
}

// ─── HTML Templates ─────────────────────────────────────────────

function layout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f1f5f9; color: #0f172a; line-height: 1.6; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); padding: 40px 32px; }
    .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .logo-icon { width: 40px; height: 40px; background: #2563eb; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; font-weight: 700; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #0f172a; }
    p { font-size: 15px; color: #475569; margin-bottom: 16px; }
    .code { font-size: 32px; font-weight: 800; letter-spacing: 8px; text-align: center; color: #2563eb; background: #eff6ff; border-radius: 12px; padding: 20px 16px; margin: 24px 0; font-family: 'Courier New', monospace; }
    .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; margin: 8px 0; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo"><div class="logo-icon">V</div><span style="font-size:18px;font-weight:700">Velora ERP</span></div>
      ${content}
    </div>
    <div class="footer">
      <p>Velora ERP — Business Operating System for Indian MSMEs</p>
      <p>If you did not request this email, please ignore it.</p>
    </div>
  </div>
</body>
</html>`;
}

export function verificationEmailHtml(code) {
  return layout(`
    <h1>Verify your email address</h1>
    <p>Thank you for creating your Velora ERP account. Use the code below to confirm your email address.</p>
    <div class="code">${code}</div>
    <p style="text-align:center;font-size:13px;color:#64748b">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
  `);
}

export function otpEmailHtml(code, purpose = "verification") {
  const title = purpose === "password-reset" ? "Reset your password" : "Your verification code";
  const desc = purpose === "password-reset"
    ? "Use the code below to reset your password. If you did not request this, please ignore this email."
    : "Use the code below to complete your verification.";
  return layout(`
    <h1>${title}</h1>
    <p>${desc}</p>
    <div class="code">${code}</div>
    <p style="text-align:center;font-size:13px;color:#64748b">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
  `);
}

export function welcomeEmailHtml(name) {
  return layout(`
    <h1>Welcome to Velora ERP, ${name}!</h1>
    <p>Your company workspace has been created successfully. You now have access to:</p>
    <table style="width:100%;margin:20px 0;border-collapse:collapse">
      <tr><td style="padding:8px 0;font-size:14px">📊 Dashboard &amp; Analytics</td></tr>
      <tr><td style="padding:8px 0;font-size:14px">📦 Inventory Management</td></tr>
      <tr><td style="padding:8px 0;font-size:14px">🛒 Sales &amp; Purchase Management</td></tr>
      <tr><td style="padding:8px 0;font-size:14px">💰 Accounting &amp; GST Reports</td></tr>
      <tr><td style="padding:8px 0;font-size:14px">🏭 Manufacturing &amp; Quality Control</td></tr>
    </table>
    <p>Start by setting up your company profile and adding your products.</p>
    <div style="text-align:center"><a class="btn" href="${env.FRONTEND_URL}/login">Login to your workspace</a></div>
  `);
}

export function passwordResetConfirmationHtml() {
  return layout(`
    <h1>Password reset successful</h1>
    <p>Your password has been changed successfully. If you did not make this change, please contact your administrator immediately.</p>
    <div style="text-align:center"><a class="btn" href="${env.FRONTEND_URL}/login">Login to your account</a></div>
  `);
}

// ─── Public API ─────────────────────────────────────────────────

export async function sendVerificationEmail({ to, code }) {
  return send({ to, subject: "Verify your email address — Velora ERP", html: verificationEmailHtml(code) });
}

export async function sendOtpEmail({ to, code, purpose = "verification" }) {
  const subject = purpose === "password-reset" ? "Password reset code — Velora ERP" : "Your verification code — Velora ERP";
  return send({ to, subject, html: otpEmailHtml(code, purpose) });
}

export async function sendWelcomeEmail({ to, name }) {
  return send({ to, subject: "Welcome to Velora ERP!", html: welcomeEmailHtml(name) });
}

export async function sendPasswordResetConfirmation({ to }) {
  return send({ to, subject: "Password reset successful — Velora ERP", html: passwordResetConfirmationHtml() });
}
