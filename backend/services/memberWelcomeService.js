// backend/services/memberWelcomeService.js
"use strict";

const emailService = require("./emailService");

const { publicMoney } = require("../utils/financeHelpers");

const CHURCH_NAME =
  process.env.CHURCH_NAME ||
  "Debre Berhan Holy Trinity Ethiopian Orthodox Tewahedo Church";

const APP_NAME =
  process.env.APP_NAME ||
  "Holy Trinity Finance & Membership Platform";

const CHURCH_ADDRESS =
  process.env.CHURCH_ADDRESS ||
  "2558 Couchville Pike, Nashville, TN 37217";

const CHURCH_PHONE =
  process.env.CHURCH_PHONE ||
  "(615) 674-7405";

const CHURCH_EMAIL =
  process.env.CHURCH_EMAIL ||
  process.env.FROM_EMAIL ||
  "";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function frontendUrl() {
  return String(
    process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      "http://18.224.63.249"
  ).replace(/\/+$/, "");
}

function defaultLoginUrl() {
  return `${frontendUrl()}/login`;
}

function defaultDashboardUrl() {
  return process.env.MEMBER_DASHBOARD_URL || `${frontendUrl()}/dash/member`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanText(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function moneyText(value) {
  const amount = Number(value || 0);

  if (typeof publicMoney === "function") {
    try {
      return publicMoney(amount);
    } catch {
      // Use local formatter below.
    }
  }

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function monthLabel(month, year) {
  const index = Number(month) - 1;
  if (index < 0 || index > 11) return "";
  return year ? `${MONTHS[index]} ${year}` : MONTHS[index];
}

function coverageLabelFromPayload(payload = {}) {
  if (payload.coverage_label || payload.coverageLabel) {
    return payload.coverage_label || payload.coverageLabel;
  }

  const startMonth =
    payload.coverage_start_month ||
    payload.coverageStartMonth ||
    payload.start_month;

  const endMonth =
    payload.coverage_end_month ||
    payload.coverageEndMonth ||
    payload.end_month;

  const startYear =
    payload.coverage_start_year ||
    payload.coverage_year ||
    payload.coverageYear ||
    new Date().getFullYear();

  const endYear =
    payload.coverage_end_year ||
    payload.coverage_year ||
    payload.coverageYear ||
    startYear;

  if (!startMonth || !endMonth) return "";

  const start = monthLabel(startMonth, startYear);
  const end = monthLabel(endMonth, endYear);

  if (!start || !end) return "";

  if (String(startYear) === String(endYear)) {
    return `${MONTHS[Number(startMonth) - 1]} - ${
      MONTHS[Number(endMonth) - 1]
    } ${startYear}`;
  }

  return `${start} - ${end}`;
}

function optionalRow(label, value) {
  if (value === undefined || value === null || value === "") return "";

  return `
    <tr>
      <td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:13px;font-weight:700;width:210px;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:700;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}

function optionalMoneyRow(label, value) {
  const amount = Number(value || 0);
  if (!amount) return "";
  return optionalRow(label, moneyText(amount));
}

function normalizeWelcomePayload(payload = {}) {
  const memberNo =
    payload.member_no ||
    payload.member_number ||
    payload.memberNo ||
    "";

  const username =
    payload.username ||
    payload.generated_username ||
    payload.generatedUsername ||
    (memberNo ? String(memberNo).toLowerCase() : payload.email) ||
    "";

  return {
    ...payload,

    email: payload.email || payload.to || "",

    full_name: cleanText(
      payload.full_name ||
        payload.fullName ||
        payload.name,
      "Member"
    ),

    member_no: cleanText(memberNo),

    username: cleanText(username),

    temporary_password: cleanText(
      payload.temporary_password ||
        payload.temp_password ||
        payload.generated_temp_password ||
        payload.temporaryPassword
    ),

    login_url:
      payload.login_url ||
      payload.loginUrl ||
      defaultLoginUrl(),

    dashboard_url:
      payload.dashboard_url ||
      payload.dashboardUrl ||
      defaultDashboardUrl(),

    payment_pending:
      Number(payload.payment_pending || 0) === 1 ||
      payload.paymentPending === true,

    checkout_url:
      payload.checkout_url ||
      payload.checkoutUrl ||
      "",

    plan_name:
      payload.plan_name ||
      payload.planName ||
      "Membership",

    coverage_label: coverageLabelFromPayload(payload),

    invoice_number:
      payload.invoice_number ||
      payload.invoiceNumber ||
      "",

    receipt_number:
      payload.receipt_number ||
      payload.receiptNumber ||
      "",

    payment_number:
      payload.payment_number ||
      payload.paymentNumber ||
      "",
  };
}

function buildWelcomeSubject(payload = {}) {
  const data = normalizeWelcomePayload(payload);

  if (data.payment_pending) {
    return "Complete Your Holy Trinity Membership Registration";
  }

  return "Welcome to Holy Trinity EOTC - Your Member Login";
}

function buildPreheader(payload = {}) {
  const data = normalizeWelcomePayload(payload);

  if (data.payment_pending) {
    return "Your membership account is ready and waiting for payment confirmation.";
  }

  return "Your membership account is ready. Sign in with your Member ID or username and temporary password.";
}

function buildAccountTable(data) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #d6e2ef;border-radius:12px;overflow:hidden;">
      ${optionalRow("Member ID", data.member_no)}
      ${optionalRow("Username", data.username)}
      ${optionalRow("Email", data.email)}
      ${optionalRow("Temporary Password", data.temporary_password)}
      ${optionalRow("Membership Plan", data.plan_name)}
      ${optionalRow("Coverage", data.coverage_label)}
      ${optionalRow("Payment Number", data.payment_number)}
      ${optionalRow("Invoice Number", data.invoice_number)}
      ${optionalRow("Receipt Number", data.receipt_number)}
      ${optionalMoneyRow("Registration Fee", data.registration_fee)}
      ${optionalMoneyRow("Membership Dues", data.membership_amount)}
      ${optionalMoneyRow("Processing Fee", data.processing_fee)}
      ${optionalMoneyRow("Total Paid", data.total_amount)}
    </table>
  `;
}

function buildStep(number, text, green = false) {
  return `
    <tr>
      <td style="width:38px;vertical-align:top;padding:6px 0;">
        <div style="width:28px;height:28px;border-radius:999px;background:${
          green ? "#047857" : "#0f3f70"
        };color:#ffffff;text-align:center;line-height:28px;font-size:13px;font-weight:800;">
          ${number}
        </div>
      </td>
      <td style="padding:6px 0;color:#334155;font-size:14px;line-height:1.7;">
        ${escapeHtml(text)}
      </td>
    </tr>
  `;
}

function buildFirstLoginSteps() {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      ${buildStep(1, "Open the login link below.")}
      ${buildStep(2, "Enter your Member ID or Username.")}
      ${buildStep(3, "Enter your temporary password.")}
      ${buildStep(4, "Create your new secure password when prompted.")}
      ${buildStep(5, "After the password change is successful, continue to your member dashboard.", true)}
    </table>
  `;
}

function buildPaymentPendingBlock(data) {
  if (!data.payment_pending) return "";

  return `
    <div style="margin:0 0 24px;padding:16px 18px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;color:#9a3412;font-size:14px;line-height:1.7;">
      <strong>Payment pending:</strong>
      Your membership account has been created, but it will be fully activated after payment confirmation.
    </div>

    ${
      data.checkout_url
        ? `
          <div style="margin:0 0 26px;">
            <a href="${escapeHtml(data.checkout_url)}" target="_blank" style="background:#0f3f70;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;display:inline-block;font-weight:800;font-size:14px;">
              Complete Payment
            </a>
          </div>
        `
        : ""
    }
  `;
}

function buildWelcomeHtml(payload = {}) {
  const data = normalizeWelcomePayload(payload);
  const preheader = buildPreheader(data);

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(buildWelcomeSubject(data))}</title>
  </head>

  <body style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preheader)}
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef3f8;padding:34px 14px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:760px;background:#ffffff;border:1px solid #d7e2ef;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:#0f3f70;padding:28px 32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:64px;vertical-align:middle;">
                      <div style="width:52px;height:52px;border:2px solid #dbeafe;color:#ffffff;text-align:center;line-height:52px;font-size:31px;font-weight:400;">
                        &#10013;
                      </div>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="color:#ffffff;font-size:21px;font-weight:800;line-height:1.35;">
                        ${escapeHtml(CHURCH_NAME)}
                      </div>
                      <div style="margin-top:6px;color:#cfe3ff;font-size:13px;font-weight:700;">
                        ${escapeHtml(APP_NAME)}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:34px 34px 16px;">
                <h1 style="margin:0 0 16px;color:#0f172a;font-size:26px;line-height:1.3;">
                  Welcome to Holy Trinity
                </h1>

                <p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.8;">
                  Dear <strong>${escapeHtml(data.full_name)}</strong>,
                </p>

                <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.8;">
                  Your church membership account has been created. Please use the login information below for your first sign-in. For security, the system will ask you to create a new password before opening your member dashboard.
                </p>

                ${buildPaymentPendingBlock(data)}

                <h2 style="margin:0 0 12px;color:#0f3f70;font-size:18px;">
                  Member Login Information
                </h2>

                ${buildAccountTable(data)}

                <div style="margin:26px 0;">
                  <a href="${escapeHtml(data.login_url)}" target="_blank" style="background:#0f3f70;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;display:inline-block;font-weight:800;font-size:14px;">
                    Login to Member Portal
                  </a>
                </div>

                <div style="padding:16px 18px;background:#f8fafc;border:1px solid #dbe5ef;border-radius:12px;margin:0 0 26px;">
                  <div style="color:#0f3f70;font-size:16px;font-weight:800;margin-bottom:10px;">
                    First Login Steps
                  </div>
                  ${buildFirstLoginSteps()}
                </div>

                <div style="padding:16px 18px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;color:#7f1d1d;font-size:14px;line-height:1.75;margin:0 0 26px;">
                  <strong>Security notice:</strong>
                  Do not forward this email. Your temporary password should only be used by you for first login. After you set a new password, keep it private and do not share it with church staff.
                </div>

                <h2 style="margin:0 0 12px;color:#0f3f70;font-size:18px;">
                  Church Contact
                </h2>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbe5ef;border-radius:12px;background:#f8fafc;">
                  <tr>
                    <td style="padding:16px 18px;color:#334155;font-size:14px;line-height:1.75;">
                      <strong>${escapeHtml(CHURCH_NAME)}</strong><br/>
                      ${escapeHtml(CHURCH_ADDRESS)}<br/>
                      Phone: ${escapeHtml(CHURCH_PHONE)}
                      ${CHURCH_EMAIL ? `<br/>Email: ${escapeHtml(CHURCH_EMAIL)}` : ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:22px 32px;text-align:center;color:#64748b;font-size:12px;line-height:1.7;">
                This message was sent by ${escapeHtml(APP_NAME)}.<br/>
                ${escapeHtml(CHURCH_NAME)}
              </td>
            </tr>
          </table>

          <div style="max-width:760px;margin:14px auto 0;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
            If the login button does not work, copy and paste this link into your browser:<br/>
            <span style="color:#0f3f70;">${escapeHtml(data.login_url)}</span>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}

function buildWelcomeText(payload = {}) {
  const data = normalizeWelcomePayload(payload);

  return [
    "Welcome to Holy Trinity",
    "",
    `Dear ${data.full_name},`,
    "",
    "Your church membership account has been created. Please use the login information below for your first sign-in.",
    "",
    "Member Login Information",
    `Member ID: ${data.member_no}`,
    `Username: ${data.username}`,
    `Email: ${data.email}`,
    `Temporary Password: ${data.temporary_password}`,
    `Membership Plan: ${data.plan_name}`,
    data.coverage_label ? `Coverage: ${data.coverage_label}` : "",
    data.payment_number ? `Payment Number: ${data.payment_number}` : "",
    data.invoice_number ? `Invoice Number: ${data.invoice_number}` : "",
    data.receipt_number ? `Receipt Number: ${data.receipt_number}` : "",
    Number(data.registration_fee || 0) ? `Registration Fee: ${moneyText(data.registration_fee)}` : "",
    Number(data.membership_amount || 0) ? `Membership Dues: ${moneyText(data.membership_amount)}` : "",
    Number(data.processing_fee || 0) ? `Processing Fee: ${moneyText(data.processing_fee)}` : "",
    Number(data.total_amount || 0) ? `Total Paid: ${moneyText(data.total_amount)}` : "",
    "",
    `Login to Member Portal: ${data.login_url}`,
    "",
    "First Login Steps",
    "1. Open the login link.",
    "2. Enter your Member ID or Username.",
    "3. Enter your temporary password.",
    "4. Create your new secure password when prompted.",
    "5. Continue to your member dashboard.",
    "",
    "Security notice: Do not forward this email or share your temporary password.",
    "",
    "Church Contact",
    CHURCH_NAME,
    CHURCH_ADDRESS,
    `Phone: ${CHURCH_PHONE}`,
    CHURCH_EMAIL ? `Email: ${CHURCH_EMAIL}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function emailSenderCandidates() {
  return [
    ["sendMail", emailService.sendMail],
    ["sendEmail", emailService.sendEmail],
    ["sendGenericEmail", emailService.sendGenericEmail],
  ].filter(([, fn]) => typeof fn === "function");
}

async function sendEmailMessage(message) {
  const candidates = emailSenderCandidates();

  if (!candidates.length) {
    throw new Error("No email sender is configured.");
  }

  const payload = {
    ...message,
    raw: true,
    layout: false,
    template: false,
    skipDefaultLayout: true,
    suppressDefaultLayout: true,
    suppressDefaultHeader: true,
    suppressDefaultFooter: true,
  };

  let lastError = null;

  for (const [name, sender] of candidates) {
    try {
      const result = await sender(payload);

      return {
        success: true,
        provider: name,
        ...(result || {}),
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to send welcome email.");
}

async function sendMemberWelcomeEmail(payload = {}) {
  const data = normalizeWelcomePayload(payload);

  if (!data.email) {
    return {
      success: false,
      skipped: true,
      error: "No member email provided.",
    };
  }

  try {
    const result = await sendEmailMessage({
      to: data.email,
      subject: buildWelcomeSubject(data),
      html: buildWelcomeHtml(data),
      text: buildWelcomeText(data),
    });

    return {
      success: true,
      ...result,
    };
  } catch (err) {
    console.error("sendMemberWelcomeEmail error:", err);

    return {
      success: false,
      error: err.message,
    };
  }
}

module.exports = {
  buildWelcomeHtml,
  buildWelcomeText,
  buildWelcomeSubject,
  sendMemberWelcomeEmail,
};