// backend/services/emailService.js
"use strict";

const nodemailer = require("nodemailer");
const path = require("path");
const pool = require("../db");

const APP_NAME =
  process.env.APP_NAME ||
  "Holy Trinity EOTC";

const FRONTEND_URL = String(
  process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    "http://18.224.63.249"
).replace(/\/+$/, "");

const SMTP_HOST =
  process.env.SMTP_HOST ||
  "smtp.gmail.com";

const SMTP_PORT =
  Number(process.env.SMTP_PORT || 465);

const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "true") === "true";

const SMTP_USER =
  String(process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();

const SMTP_PASS =
  String(process.env.SMTP_PASS || process.env.EMAIL_PASS || "").trim();

const SMTP_FROM =
  process.env.SMTP_FROM ||
  process.env.EMAIL_FROM ||
  `"${APP_NAME}" <${SMTP_USER || "finance@holytrinity.local"}>`;

const CHURCH_NAME =
  process.env.CHURCH_NAME ||
  process.env.ORGANIZATION_NAME ||
  "Debre Berhan Holy Trinity Ethiopian Orthodox Tewahedo Church";

const CHURCH_ADDRESS =
  process.env.CHURCH_ADDRESS ||
  "2558 Couchville Pike, Nashville, TN 37217";

const CHURCH_PHONE =
  process.env.CHURCH_PHONE ||
  "(615) 674-7405";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth:
    SMTP_USER && SMTP_PASS
      ? {
          user: SMTP_USER,
          pass: SMTP_PASS,
        }
      : undefined,
});

const metaCache = new Map();
const META_TTL_MS = 60 * 1000;

(async () => {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      console.error("SMTP credentials missing", {
        SMTP_USER_EXISTS: Boolean(SMTP_USER),
        SMTP_PASS_EXISTS: Boolean(SMTP_PASS),
      });
      return;
    }

    await transporter.verify();
    console.log("Email transporter ready");
  } catch (err) {
    console.error("Email transporter failed:", err.message);
  }
})();

async function columnsFor(tableName) {
  const cached = metaCache.get(tableName);

  if (cached && Date.now() - cached.loadedAt < META_TTL_MS) {
    return cached.columns;
  }

  const [rows] = await pool.query(
    `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    `,
    [tableName]
  );

  const columns = new Set(rows.map((row) => row.COLUMN_NAME));

  metaCache.set(tableName, {
    columns,
    loadedAt: Date.now(),
  });

  return columns;
}

async function firstExistingTable(names) {
  for (const name of names) {
    const columns = await columnsFor(name);
    if (columns.size) return name;
  }

  return null;
}

function has(columns, column) {
  return columns && columns.has(column);
}

function sqlId(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(String(name || ""))) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }

  return `\`${name}\``;
}

function clean(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loginURL() {
  return `${FRONTEND_URL}/login`;
}

function resetURL(token = "") {
  if (!token) return `${FRONTEND_URL}/reset-password`;
  return `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

function shouldUseRawHtml(options = {}, html = "") {
  if (options.raw === true) return true;
  if (options.layout === false) return true;
  if (options.template === false) return true;
  if (options.skipDefaultLayout === true) return true;
  if (options.suppressDefaultLayout === true) return true;

  return /^\s*(<!doctype|<html[\s>])/i.test(String(html || ""));
}

function wrap(body, options = {}) {
  const preheader = clean(options.preheader);

  return `
  <div style="background:#f5f7fb;padding:36px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    ${
      preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>`
        : ""
    }
    <div style="max-width:720px;margin:auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#0f3e67;color:#ffffff;padding:28px 32px;text-align:center;">
        <h1 style="margin:0;font-size:26px;">${escapeHtml(APP_NAME)}</h1>
        <div style="margin-top:8px;color:#d8e5f3;font-size:13px;">Finance & Membership Platform</div>
      </div>
      <div style="padding:34px;">${body || ""}</div>
      <div style="border-top:1px solid #e5e7eb;padding:20px;font-size:12px;color:#667085;text-align:center;line-height:1.6;background:#f8fafc;">
        ${escapeHtml(CHURCH_NAME)}<br/>
        ${escapeHtml(CHURCH_ADDRESS)}
      </div>
    </div>
  </div>`;
}

function renderHtml(html, options = {}) {
  const body = html || "";

  if (shouldUseRawHtml(options, body)) {
    return body;
  }

  return wrap(body, options);
}

async function getTransporter() {
  return transporter;
}

async function sendMail(payload = {}) {
  const {
    to,
    subject,
    html,
    text,
    attachments = [],
    cc,
    bcc,
    replyTo,
    from,
  } = payload;

  try {
    const recipient = clean(to);

    if (!recipient) {
      throw new Error("Recipient email missing.");
    }

    const renderedHtml = renderHtml(html || "", payload);

    const result = await transporter.sendMail({
      from: from || SMTP_FROM,
      to: recipient,
      cc: cc || undefined,
      bcc: bcc || undefined,
      replyTo: replyTo || undefined,
      subject: clean(subject, "Holy Trinity Notification"),
      html: renderedHtml,
      text: text || stripHtml(html || renderedHtml),
      attachments,
    });

    console.log("Email sent:", {
      to: recipient,
      subject: clean(subject, "Holy Trinity Notification"),
      messageId: result.messageId,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (err) {
    console.error("Email failed:", err.message);

    return {
      success: false,
      error: err.message,
    };
  }
}

async function sendGenericEmail(payload = {}) {
  return sendMail(payload);
}

async function sendEmail(payload = {}) {
  return sendMail(payload);
}

function welcomeRow(label, value) {
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

async function sendMemberWelcomeEmail(payload = {}) {
  const loginLink =
    payload.login_url ||
    payload.loginUrl ||
    loginURL();

  const fullName =
    payload.fullName ||
    payload.full_name ||
    payload.name ||
    "Member";

  const memberNo =
    payload.memberNo ||
    payload.member_no ||
    payload.member_number ||
    "--";

  const username =
    payload.username ||
    String(memberNo).toLowerCase();

  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Welcome to Holy Trinity</title>
  </head>
  <body style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef3f8;padding:34px 14px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:760px;background:#ffffff;border:1px solid #d7e2ef;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:#0f3f70;padding:28px 32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:64px;vertical-align:middle;">
                      <div style="width:52px;height:52px;border:2px solid #dbeafe;color:#ffffff;text-align:center;line-height:52px;font-size:31px;">&#10013;</div>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="color:#ffffff;font-size:21px;font-weight:800;line-height:1.35;">
                        ${escapeHtml(CHURCH_NAME)}
                      </div>
                      <div style="margin-top:6px;color:#cfe3ff;font-size:13px;font-weight:700;">
                        Holy Trinity Finance & Membership Platform
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:34px;">
                <h1 style="margin:0 0 16px;color:#0f172a;font-size:26px;line-height:1.3;">
                  Welcome to Holy Trinity
                </h1>

                <p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.8;">
                  Dear <strong>${escapeHtml(clean(fullName, "Member"))}</strong>,
                </p>

                <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.8;">
                  Your church membership account has been created. Please use the login information below for your first sign-in. For security, the system will ask you to create a new password before opening your member dashboard.
                </p>

                <h2 style="margin:0 0 12px;color:#0f3f70;font-size:18px;">
                  Member Login Information
                </h2>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #d6e2ef;border-radius:12px;overflow:hidden;">
                  ${welcomeRow("Member ID", memberNo)}
                  ${welcomeRow("Username", username)}
                  ${welcomeRow("Email", payload.to || payload.email)}
                  ${welcomeRow("Temporary Password", payload.temporaryPassword || payload.temporary_password)}
                  ${welcomeRow("Membership Plan", payload.planName || payload.plan_name)}
                  ${welcomeRow("Coverage", payload.coverageLabel || payload.coverage_label)}
                  ${welcomeRow("Payment Number", payload.paymentNumber || payload.payment_number)}
                  ${welcomeRow("Invoice Number", payload.invoiceNumber || payload.invoice_number)}
                  ${welcomeRow("Receipt Number", payload.receiptNumber || payload.receipt_number)}
                  ${Number(payload.registration_fee || 0) ? welcomeRow("Registration Fee", money(payload.registration_fee)) : ""}
                  ${Number(payload.membership_amount || 0) ? welcomeRow("Membership Dues", money(payload.membership_amount)) : ""}
                  ${Number(payload.processing_fee || 0) ? welcomeRow("Processing Fee", money(payload.processing_fee)) : ""}
                  ${Number(payload.total_amount || 0) ? welcomeRow("Total Paid", money(payload.total_amount)) : ""}
                </table>

                <div style="margin:26px 0;">
                  <a href="${escapeHtml(loginLink)}" target="_blank" style="background:#0f3f70;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;display:inline-block;font-weight:800;font-size:14px;">
                    Login to Member Portal
                  </a>
                </div>

                <div style="padding:16px 18px;background:#f8fafc;border:1px solid #dbe5ef;border-radius:12px;margin:0 0 26px;">
                  <div style="color:#0f3f70;font-size:16px;font-weight:800;margin-bottom:10px;">
                    First Login Steps
                  </div>
                  <ol style="margin:0;padding-left:20px;color:#334155;font-size:14px;line-height:1.8;">
                    <li>Open the login link.</li>
                    <li>Enter your Member ID or Username.</li>
                    <li>Enter your temporary password.</li>
                    <li>Create your new secure password when prompted.</li>
                    <li>Continue to your member dashboard.</li>
                  </ol>
                </div>

                <div style="padding:16px 18px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;color:#7f1d1d;font-size:14px;line-height:1.75;">
                  <strong>Security notice:</strong>
                  Do not forward this email. Your temporary password should only be used by you for first login. After you set a new password, keep it private and do not share it with church staff.
                </div>
              </td>
            </tr>

            <tr>
              <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:22px 32px;text-align:center;color:#64748b;font-size:12px;line-height:1.7;">
                This message was sent by Holy Trinity Finance & Membership Platform.<br/>
                ${escapeHtml(CHURCH_NAME)}<br/>
                ${escapeHtml(CHURCH_ADDRESS)} | ${escapeHtml(CHURCH_PHONE)}
              </td>
            </tr>
          </table>

          <div style="max-width:760px;margin:14px auto 0;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
            If the login button does not work, copy and paste this link into your browser:<br/>
            <span style="color:#0f3f70;">${escapeHtml(loginLink)}</span>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;

  return sendMail({
    to: payload.to || payload.email,
    subject: "Welcome to Holy Trinity EOTC - Your Member Login",
    text:
      `Welcome to Holy Trinity\n\n` +
      `Dear ${clean(fullName, "Member")},\n\n` +
      `Member ID: ${clean(memberNo, "--")}\n` +
      `Username: ${clean(username, "--")}\n` +
      `Temporary Password: ${clean(payload.temporaryPassword || payload.temporary_password, "--")}\n` +
      `Login: ${loginLink}`,
    html,
    raw: true,
    layout: false,
    skipDefaultLayout: true,
  });
}

async function sendReceiptEmail(payload = {}) {
  const receiptId =
    payload.receipt_id ||
    payload.receiptId ||
    null;

  if (receiptId) {
    try {
      const receiptEmailService = require("./domains/receipts/receiptEmailService");

      return receiptEmailService.sendReceiptEmail(receiptId, {
        email: payload.to || payload.email || null,
        subject: payload.subject || null,
        cc: payload.cc || null,
        bcc: payload.bcc || null,
        source: payload.source || "shared_email_service",
      });
    } catch (err) {
      console.error("Enterprise receipt email delegation failed:", err.message);
    }
  }

  const attachments = [];

  if (payload.pdfPath) {
    attachments.push({
      filename: `${clean(payload.receiptNumber, "receipt")}.pdf`,
      path: payload.pdfPath,
      contentType: "application/pdf",
    });
  } else if (payload.pdfBuffer) {
    attachments.push({
      filename: `${clean(payload.receiptNumber, "receipt")}.pdf`,
      content: payload.pdfBuffer,
      contentType: "application/pdf",
    });
  }

  return sendMail({
    to: payload.to || payload.email,
    subject: `Payment Receipt ${clean(payload.receiptNumber, "")}`,
    text: `Thank you for your payment. Receipt ${clean(payload.receiptNumber, "--")}. Amount: ${money(payload.amount)}.`,
    html: `
      <h2 style="margin:0 0 18px;color:#0f172a;">Payment Receipt</h2>
      <p style="color:#475569;line-height:1.7;">
        Dear ${escapeHtml(clean(payload.fullName, "Member / Guest"))},<br/><br/>
        Thank you for your payment and continued support of ${escapeHtml(CHURCH_NAME)}.
        ${attachments.length ? "A PDF copy of your receipt is attached." : ""}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:22px;font-size:14px;">
        <tr><td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Receipt #</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(clean(payload.receiptNumber, "--"))}</td></tr>
        <tr><td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Payment #</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(clean(payload.paymentNumber, "--"))}</td></tr>
        <tr><td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Invoice #</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(clean(payload.invoiceNumber, "--"))}</td></tr>
        <tr><td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Amount</strong></td><td style="padding:10px;border:1px solid #e5e7eb;font-weight:800;">${money(payload.amount)}</td></tr>
      </table>
    `,
    attachments,
  });
}

async function findInvoiceIdByNumber(invoiceNumber) {
  const number = clean(invoiceNumber);

  if (!number) return null;

  const columns = await columnsFor("tbl_finance_invoices");

  const candidates = ["invoice_number", "invoice_no", "number"].filter((column) =>
    has(columns, column)
  );

  if (!candidates.length) return null;

  const where = candidates.map((column) => `${sqlId(column)} = ?`).join(" OR ");
  const values = candidates.map(() => number);

  const [rows] = await pool.query(
    `
    SELECT id
    FROM tbl_finance_invoices
    WHERE ${where}
    ORDER BY id DESC
    LIMIT 1
    `,
    values
  );

  return rows[0]?.id || null;
}

async function findInvoiceIdByPaymentId(paymentId) {
  const id = clean(paymentId);

  if (!id) return null;

  const invoiceColumns = await columnsFor("tbl_finance_invoices");

  if (has(invoiceColumns, "payment_id")) {
    const [rows] = await pool.query(
      `
      SELECT id
      FROM tbl_finance_invoices
      WHERE payment_id = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [id]
    );

    if (rows[0]?.id) return rows[0].id;
  }

  const paymentTable = await firstExistingTable([
    "tbl_finance_payments",
    "tbl_payments",
  ]);

  if (!paymentTable) return null;

  const paymentColumns = await columnsFor(paymentTable);

  if (!has(paymentColumns, "invoice_id")) return null;

  const [rows] = await pool.query(
    `
    SELECT invoice_id
    FROM ${sqlId(paymentTable)}
    WHERE id = ?
      AND invoice_id IS NOT NULL
    LIMIT 1
    `,
    [id]
  );

  return rows[0]?.invoice_id || null;
}

async function sendBasicInvoiceEmail(payload = {}) {
  const attachments = [];

  if (payload.pdfPath) {
    attachments.push({
      filename: `${clean(payload.invoiceNumber, "invoice")}.pdf`,
      path: payload.pdfPath,
      contentType: "application/pdf",
    });
  } else if (payload.pdfBuffer) {
    attachments.push({
      filename: `${clean(payload.invoiceNumber, "invoice")}.pdf`,
      content: payload.pdfBuffer,
      contentType: "application/pdf",
    });
  }

  return sendMail({
    to: payload.to || payload.email,
    subject: `Finance Invoice ${clean(payload.invoiceNumber, "")}`,
    text: `Invoice ${clean(payload.invoiceNumber, "--")} has been generated. Amount: ${money(payload.amount)}.`,
    html: `
      <h2 style="margin:0 0 18px;color:#0f172a;">Finance Invoice</h2>
      <p style="color:#475569;line-height:1.7;">
        Dear ${escapeHtml(clean(payload.fullName, "Member / Guest"))},<br/><br/>
        Your invoice has been generated.
        ${attachments.length ? "A PDF copy is attached for your records." : ""}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:22px;font-size:14px;">
        <tr><td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Invoice #</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(clean(payload.invoiceNumber, "--"))}</td></tr>
        <tr><td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Amount</strong></td><td style="padding:10px;border:1px solid #e5e7eb;font-weight:800;">${money(payload.amount)}</td></tr>
      </table>
    `,
    attachments,
  });
}

async function sendInvoiceEmail(payload = {}) {
  try {
    const resolvedInvoiceId =
      payload.invoice_id ||
      payload.invoiceId ||
      payload.id ||
      (payload.payment_id || payload.paymentId
        ? await findInvoiceIdByPaymentId(payload.payment_id || payload.paymentId)
        : null) ||
      (payload.invoice_number || payload.invoiceNumber || payload.number
        ? await findInvoiceIdByNumber(
            payload.invoice_number ||
              payload.invoiceNumber ||
              payload.number
          )
        : null);

    if (resolvedInvoiceId) {
      const enterpriseInvoiceEmail = require("./domains/invoices/invoiceEmailService");

      return enterpriseInvoiceEmail.sendInvoiceEmail(resolvedInvoiceId, {
        email: payload.to || payload.email || null,
        subject: payload.subject || null,
        cc: payload.cc || null,
        bcc: payload.bcc || null,
        attachPdf: payload.attachPdf !== false,
        source: payload.source || "shared_email_service",
      });
    }

    console.warn("Enterprise invoice email fallback used because invoice id was not resolved:", {
      invoiceNumber: payload.invoice_number || payload.invoiceNumber || payload.number || null,
      paymentId: payload.payment_id || payload.paymentId || null,
      to: payload.to || payload.email || null,
    });

    return sendBasicInvoiceEmail(payload);
  } catch (err) {
    console.error("Enterprise invoice email delegation failed:", err.message);
    return sendBasicInvoiceEmail(payload);
  }
}

async function sendPasswordResetEmail({ to, fullName, resetLink, token }) {
  const link = resetLink || resetURL(token);

  return sendMail({
    to,
    subject: "Reset Your Holy Trinity Password",
    text: `Hello ${clean(fullName, "Member")}. Use this password reset link: ${link}`,
    html: `
      <h2 style="margin:0 0 18px;color:#0f172a;">Password Reset Request</h2>
      <p style="color:#475569;line-height:1.7;">
        Dear ${escapeHtml(clean(fullName, "Member"))},<br/><br/>
        We received a request to reset your password. Use the secure link below to create a new password.
      </p>
      <div style="margin-top:26px;">
        <a href="${escapeHtml(link)}" style="background:#0f3e67;color:#ffffff;padding:13px 22px;border-radius:9px;text-decoration:none;display:inline-block;font-weight:800;">Reset Password</a>
      </div>
    `,
  });
}

function prettyType(type) {
  return clean(type, "Certificate")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function sendCertificateEmail({
  to,
  pdfPath,
  recipientName,
  certificateNumber,
  type,
  churchName = CHURCH_NAME,
  priestName,
  administratorName,
  secondaryName,
}) {
  const attachments = [];

  if (pdfPath) {
    attachments.push({
      filename: path.basename(pdfPath),
      path: pdfPath,
      contentType: "application/pdf",
    });
  }

  const subject =
    type === "marriage_certificate" || type === "engagement_certificate"
      ? `${prettyType(type)} Certificate for ${clean(recipientName, "Recipient")} & ${clean(secondaryName)} - ${churchName}`
      : `${prettyType(type)} Certificate for ${clean(recipientName, "Recipient")} - ${churchName}`;

  return sendMail({
    to,
    subject,
    text: `Your ${prettyType(type)} certificate is attached.`,
    html: `
      <h2 style="margin:0 0 18px;color:#0f172a;">${escapeHtml(prettyType(type))}</h2>
      <p style="color:#475569;line-height:1.7;">
        Dear ${escapeHtml(clean(recipientName, "Recipient"))},<br/><br/>
        Your certificate PDF is attached to this email.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:22px;font-size:14px;">
        <tr><td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Certificate #</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(clean(certificateNumber, "--"))}</td></tr>
        <tr><td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Church</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(clean(churchName, CHURCH_NAME))}</td></tr>
        ${
          priestName
            ? `<tr><td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Priest</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(clean(priestName))}</td></tr>`
            : ""
        }
        ${
          administratorName
            ? `<tr><td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Administrator</strong></td><td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(clean(administratorName))}</td></tr>`
            : ""
        }
      </table>
    `,
    attachments,
  });
}

module.exports = {
  transporter,
  getTransporter,

  sendMail,
  sendEmail,
  sendGenericEmail,

  sendReceiptEmail,
  sendInvoiceEmail,
  sendMemberWelcomeEmail,
  sendPasswordResetEmail,
  sendCertificateEmail,
};