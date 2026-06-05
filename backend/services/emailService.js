
// backend/services/emailService.js
"use strict";

const nodemailer = require("nodemailer");
const path = require("path");

const APP_NAME = "Holy Trinity EOTC";
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://18.224.63.249").replace(/\/+$/, "");

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "true") === "true";
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "").trim();
const SMTP_FROM = process.env.SMTP_FROM || `"${APP_NAME}" <${SMTP_USER}>`;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

(async () => {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      console.error("❌ SMTP credentials missing", {
        SMTP_USER,
        SMTP_PASS_EXISTS: !!SMTP_PASS,
      });
      return;
    }

    await transporter.verify();
    console.log("✅ Email transporter ready");
  } catch (err) {
    console.error("❌ Email transporter failed:", err.message);
  }
})();

function clean(value, fallback = "") {
  const v = String(value ?? "").trim();
  return v || fallback;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function loginURL() {
  return `${FRONTEND_URL}/login`;
}

function resetURL(token = "") {
  if (!token) return `${FRONTEND_URL}/reset-password`;
  return `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

function wrap(body) {
  return `
  <div style="background:#f5f7fb;padding:40px;font-family:Arial,sans-serif;">
    <div style="max-width:720px;margin:auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#0d3b66;color:white;padding:28px;text-align:center;">
        <h1 style="margin:0;font-size:26px;">${APP_NAME}</h1>
        <div style="margin-top:8px;opacity:.9;font-size:13px;">Finance & Membership Platform</div>
      </div>

      <div style="padding:35px;">
        ${body}
      </div>

      <div style="border-top:1px solid #eee;padding:20px;font-size:12px;color:#666;text-align:center;">
        Holy Trinity Ethiopian Orthodox Church<br/>Nashville, Tennessee
      </div>
    </div>
  </div>
  `;
}

async function sendMail({
  to,
  subject,
  html,
  text,
  attachments = [],
}) {
  try {
    if (!to) {
      throw new Error("Recipient email missing.");
    }

    const result = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html: wrap(html),
      text,
      attachments,
    });

    console.log("📧 Email sent:", {
      to,
      subject,
      messageId: result.messageId,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (err) {
    console.error("❌ Email failed:", err.message);

    return {
      success: false,
      error: err.message,
    };
  }
}

/* =========================================================
   WELCOME EMAIL — NEW MEMBERS ONLY
========================================================= */

async function sendMemberWelcomeEmail({
  to,
  fullName,
  memberNo,
  username,
  temporaryPassword,
  resetToken,
  resetLink,
  planName,
  coverageLabel,
}) {
  const loginLink = loginURL();
  const passwordLink = resetLink || resetURL(resetToken);

  return sendMail({
    to,
    subject: "Welcome To Holy Trinity EOTC",
    text:
      `Welcome ${clean(fullName, "Member")}. ` +
      `Your member number is ${clean(memberNo, "--")}. ` +
      `Username: ${clean(username, "--")}. ` +
      `Login: ${loginLink}. Reset password: ${passwordLink}`,

    html: `
      <h2>Welcome To Holy Trinity EOTC</h2>

      <p>Dear ${clean(fullName, "Member")},</p>

      <p>Your church member account has been successfully created.</p>

      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Member ID</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${clean(memberNo, "--")}</td>
        </tr>

        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Username</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${clean(username, "--")}</td>
        </tr>

        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Temporary Password</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;color:#b91c1c;font-weight:bold;">
            ${clean(temporaryPassword, "--")}
          </td>
        </tr>

        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Membership Plan</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${clean(planName, "--")}</td>
        </tr>

        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Coverage</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${clean(coverageLabel, "--")}</td>
        </tr>
      </table>

      <div style="margin-top:30px;">
        <a href="${loginLink}" style="background:#0d3b66;color:white;padding:14px 26px;border-radius:8px;text-decoration:none;display:inline-block;margin-right:10px;">
          Login To Your Account
        </a>

        <a href="${passwordLink}" style="background:#ffffff;color:#0d3b66;padding:13px 24px;border-radius:8px;text-decoration:none;display:inline-block;border:1px solid #0d3b66;">
          Reset Password
        </a>
      </div>

      <p style="margin-top:24px;color:#b91c1c;font-size:13px;">
        For security purposes, please reset your password after your first login.
      </p>
    `,
  });
}

/* =========================================================
   RECEIPT EMAIL — NEW + EXISTING MEMBERS
========================================================= */

async function sendReceiptEmail({
  to,
  fullName,
  amount,
  receiptNumber,
  paymentNumber,
  invoiceNumber,
  paymentMethod,
  category,
  planName,
  coverageLabel,
  coverageMonths,
  pdfBuffer,
  pdfPath,
}) {
  const attachments = [];

  if (pdfPath) {
    attachments.push({
      filename: `${receiptNumber}.pdf`,
      path: pdfPath,
      contentType: "application/pdf",
    });
  } else if (pdfBuffer) {
    attachments.push({
      filename: `${receiptNumber}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    });
  }

  const coverageText =
    coverageLabel ||
    (Array.isArray(coverageMonths) && coverageMonths.length
      ? coverageMonths.map((m) => m.label || m.month || m).join(", ")
      : "");

  return sendMail({
    to,
    subject: `Payment Receipt ${receiptNumber}`,
    text:
      `Thank you for your payment. Receipt ${receiptNumber}. ` +
      `Amount: ${money(amount)}. Coverage: ${coverageText || "N/A"}.`,

    html: `
      <h2>Payment Receipt</h2>

      <p>Dear ${clean(fullName, "Member")},</p>

      <p>Thank you for your payment. Your official receipt PDF is attached.</p>

      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Receipt #</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${clean(receiptNumber, "--")}</td>
        </tr>

        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Payment #</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${clean(paymentNumber, "--")}</td>
        </tr>

        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Invoice #</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${clean(invoiceNumber, "--")}</td>
        </tr>

        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Amount</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;font-weight:bold;color:#047857;">${money(amount)}</td>
        </tr>

        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Category</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${clean(category, "--")}</td>
        </tr>

        <tr>
          <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Method</strong></td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${clean(paymentMethod, "--")}</td>
        </tr>

        ${
          planName
            ? `
            <tr>
              <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Plan</strong></td>
              <td style="padding:10px;border:1px solid #e5e7eb;">${clean(planName, "--")}</td>
            </tr>
            `
            : ""
        }

        ${
          coverageText
            ? `
            <tr>
              <td style="padding:10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Coverage Months</strong></td>
              <td style="padding:10px;border:1px solid #e5e7eb;">${clean(coverageText, "--")}</td>
            </tr>
            `
            : ""
        }
      </table>

      <p style="margin-top:25px;">
        Thank you for supporting Holy Trinity Ethiopian Orthodox Church.
      </p>
    `,

    attachments,
  });
}

/* =========================================================
   INVOICE EMAIL
========================================================= */

async function sendInvoiceEmail({
  to,
  fullName,
  invoiceNumber,
  amount,
  pdfBuffer,
}) {
  return sendMail({
    to,
    subject: `Invoice ${invoiceNumber}`,
    text: `Invoice ${invoiceNumber} attached.`,
    html: `
      <h2>Finance Invoice</h2>
      <p>Dear ${clean(fullName, "Member")},</p>
      <p>Your invoice has been generated.</p>

      <table style="width:100%;border-collapse:collapse;margin-top:20px;">
        <tr><td><strong>Invoice #</strong></td><td>${clean(invoiceNumber)}</td></tr>
        <tr><td><strong>Amount</strong></td><td>${money(amount)}</td></tr>
      </table>
    `,
    attachments: pdfBuffer
      ? [
          {
            filename: `${invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : [],
  });
}

/* =========================================================
   PASSWORD RESET
========================================================= */

async function sendPasswordResetEmail({
  to,
  fullName,
  resetLink,
}) {
  return sendMail({
    to,
    subject: "Password Reset",
    text: `Reset your password: ${resetLink}`,
    html: `
      <h2>Password Reset</h2>

      <p>Hello ${clean(fullName, "User")},</p>

      <p>A password reset was requested. Click the button below to create your new password.</p>

      <div style="margin-top:25px;">
        <a href="${clean(resetLink)}" style="background:#0d3b66;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
          Reset Password
        </a>
      </div>
    `,
  });
}

/* =========================================================
   CERTIFICATE HELPERS
========================================================= */

function prettyType(type) {
  return String(type || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildCertificateHtml({
  recipientName,
  certificateNumber,
  type,
  churchName,
  priestName,
  administratorName,
}) {
  return `
    <h2>${prettyType(type)} Certificate</h2>

    <p>Dear ${clean(recipientName, "Member")},</p>

    <p>Your official church certificate has been generated successfully.</p>

    <table style="width:100%;border-collapse:collapse;margin-top:20px;">
      <tr><td><strong>Certificate Type</strong></td><td>${prettyType(type)}</td></tr>
      <tr><td><strong>Certificate Number</strong></td><td>${clean(certificateNumber)}</td></tr>
      <tr><td><strong>Church</strong></td><td>${clean(churchName)}</td></tr>

      ${
        priestName
          ? `<tr><td><strong>Priest</strong></td><td>${clean(priestName)}</td></tr>`
          : ""
      }

      ${
        administratorName
          ? `<tr><td><strong>Administrator</strong></td><td>${clean(administratorName)}</td></tr>`
          : ""
      }
    </table>

    <p style="margin-top:25px;">Your certificate PDF is attached to this email.</p>
  `;
}

async function sendCertificateEmail({
  to,
  pdfPath,
  recipientName,
  certificateNumber,
  type,
  churchName = "Holy Trinity Ethiopian Orthodox Church",
  priestName,
  administratorName,
  secondaryName,
}) {
  try {
    const recipient = clean(to);

    if (!recipient) {
      return {
        success: false,
        error: "Recipient email missing.",
      };
    }

    const attachments = [];

    if (pdfPath) {
      attachments.push({
        filename: path.basename(pdfPath),
        path: pdfPath,
        contentType: "application/pdf",
      });
    }

    const subject =
      type === "marriage_certificate" ||
      type === "engagement_certificate"
        ? `${prettyType(type)} Certificate for ${recipientName} & ${
            secondaryName || ""
          } • ${churchName}`
        : `${prettyType(type)} Certificate for ${recipientName} • ${churchName}`;

    return sendMail({
      to: recipient,
      subject,
      html: buildCertificateHtml({
        recipientName,
        certificateNumber,
        type,
        churchName,
        priestName,
        administratorName,
      }),
      text: `Your ${prettyType(type)} certificate is attached.`,
      attachments,
    });
  } catch (err) {
    console.error("sendCertificateEmail error:", err);

    return {
      success: false,
      error: err.message || "Failed to send certificate email.",
    };
  }
}

module.exports = {
  sendMail,
  sendReceiptEmail,
  sendInvoiceEmail,
  sendMemberWelcomeEmail,
  sendPasswordResetEmail,
  sendCertificateEmail,
};