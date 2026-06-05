// backend/services/domains/receipts/receiptEmailService.js
"use strict";

const fs = require("fs");
const path = require("path");

const db = require("../../../db");

const emailService = require("../../emailService");

const {
  generateReceiptPdf,
} = require("./receiptPdfService");

const {
  getReceiptById,
} = require("./receiptService");

/* =========================================================
   HELPERS
========================================================= */

function safe(value, fallback = "") {
  const v = String(value ?? "").trim();
  return v || fallback;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePdfPath(pdfUrl) {
  if (!pdfUrl) return null;

  return path.join(
    process.cwd(),
    String(pdfUrl).replace(/^\/+/, "")
  );
}

function renderMembershipSection(receipt) {
  if (!receipt.membership) return "";

  const months = Array.isArray(receipt.membership.coverage_months)
    ? receipt.membership.coverage_months
    : [];

  return `
    <div style="margin-top:28px;">
      <h3 style="margin:0 0 12px;color:#0f172a;">
        Membership Coverage
      </h3>

      <div style="color:#475569;margin-bottom:10px;">
        <strong>Plan:</strong>
        ${escapeHtml(receipt.membership.plan_name || "Membership Plan")}
      </div>

      <div style="color:#475569;margin-bottom:14px;">
        <strong>Coverage:</strong>
        ${escapeHtml(receipt.membership.coverage_label || "--")}
      </div>

      ${
        months.length
          ? `
          <div style="display:block;">
            ${months
              .map(
                (m) => `
                <span
                  style="
                    display:inline-block;
                    margin:4px 6px 4px 0;
                    padding:6px 10px;
                    border-radius:999px;
                    background:#dcfce7;
                    color:#166534;
                    font-size:12px;
                    font-weight:700;
                  "
                >
                  ✓ ${escapeHtml(m.label || m.month || "")}
                </span>
              `
              )
              .join("")}
          </div>
          `
          : ""
      }
    </div>
  `;
}

function renderDonationSection(receipt) {
  if (!receipt.donation) return "";

  return `
    <div style="margin-top:28px;">
      <h3 style="margin:0 0 12px;color:#0f172a;">
        Donation Details
      </h3>

      <div style="color:#475569;">
        <strong>Donation Category:</strong>
        ${escapeHtml(receipt.donation.donation_label || "General Donation")}
      </div>
    </div>
  `;
}

function renderProgramSection(receipt) {
  if (!receipt.program) return "";

  const participants = Array.isArray(receipt.program.participants)
    ? receipt.program.participants
    : [];

  return `
    <div style="margin-top:28px;">
      <h3 style="margin:0 0 12px;color:#0f172a;">
        ${
          receipt.program.type === "trip"
            ? "Trip Registration Details"
            : "School Program Details"
        }
      </h3>

      <div style="color:#475569;margin-bottom:8px;">
        <strong>Program:</strong>
        ${escapeHtml(receipt.program.program_name || "--")}
      </div>

      <div style="color:#475569;margin-bottom:8px;">
        <strong>Participants:</strong>
        ${Number(receipt.program.quantity || participants.length || 1)}
      </div>

      ${
        participants.length
          ? `
          <ul style="margin:10px 0 0 18px;color:#475569;">
            ${participants
              .map((person) => {
                const name =
                  typeof person === "string"
                    ? person
                    : person.full_name ||
                      person.name ||
                      person.student_name ||
                      person.traveler_name ||
                      "--";

                return `<li>${escapeHtml(name)}</li>`;
              })
              .join("")}
          </ul>
          `
          : ""
      }
    </div>
  `;
}

/* =========================================================
   EMAIL TEMPLATE
========================================================= */

function receiptEmailTemplate(receipt) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:36px;">
    <div
      style="
        max-width:720px;
        margin:auto;
        background:#ffffff;
        border-radius:18px;
        overflow:hidden;
        border:1px solid #e2e8f0;
      "
    >
      <div
        style="
          background:#0f172a;
          color:#ffffff;
          padding:30px;
          text-align:center;
        "
      >
        <h1 style="margin:0;font-size:26px;">
          Holy Trinity Ethiopian Orthodox Church
        </h1>

        <div style="margin-top:10px;font-size:14px;opacity:.85;">
          ቅድስት ሥላሴ ቤተ ክርስቲያን
        </div>
      </div>

      <div style="padding:34px;">
        <h2 style="margin:0;color:#2563eb;font-size:24px;">
          ${escapeHtml(safe(receipt.title, "Payment Receipt"))}
        </h2>

        <p style="color:#475569;line-height:1.7;margin-top:18px;">
          Dear ${escapeHtml(safe(receipt.full_name, "Member / Guest"))},
          <br /><br />
          Thank you for your payment and continued support of
          Holy Trinity Ethiopian Orthodox Church.
        </p>

        <table
          width="100%"
          cellpadding="10"
          style="border-collapse:collapse;margin-top:24px;font-size:14px;"
        >
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;width:40%;">
              Receipt Number
            </td>
            <td style="border:1px solid #e2e8f0;">
              ${escapeHtml(receipt.receipt_number)}
            </td>
          </tr>

          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;">
              Payment Type
            </td>
            <td style="border:1px solid #e2e8f0;">
              ${escapeHtml(receipt.category_label)}
            </td>
          </tr>

          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;">
              Amount
            </td>
            <td style="border:1px solid #e2e8f0;font-weight:bold;">
              ${money(receipt.amount)}
            </td>
          </tr>

          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;">
              Payment Method
            </td>
            <td style="border:1px solid #e2e8f0;">
              ${escapeHtml(receipt.payment_method_label || "--")}
            </td>
          </tr>

          ${
            receipt.card_label && receipt.card_label !== "--"
              ? `
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;">
                  Card
                </td>
                <td style="border:1px solid #e2e8f0;">
                  ${escapeHtml(receipt.card_label)}
                </td>
              </tr>
              `
              : ""
          }
        </table>

        ${renderMembershipSection(receipt)}
        ${renderDonationSection(receipt)}
        ${renderProgramSection(receipt)}

        <div
          style="
            margin-top:38px;
            font-size:13px;
            color:#64748b;
            line-height:1.7;
          "
        >
          This email serves as your official payment receipt.
          Please keep this receipt for your records.
        </div>
      </div>
    </div>
  </div>
  `;
}

async function sendReceiptEmail(receiptId, options = {}) {
  const receipt = await getReceiptById(receiptId);

  if (!receipt) {
    throw new Error("Receipt not found.");
  }

  const email = safe(
    options.email ||
    receipt.email ||
    receipt.emailed_to
  );

  if (!email) {
    throw new Error("Receipt email address missing.");
  }

  let pdfUrl =
    receipt.pdf_url || null;

  let filePath =
    pdfUrl
      ? normalizePdfPath(pdfUrl)
      : null;

  if (
    !filePath ||
    !fs.existsSync(filePath)
  ) {
    const pdf =
      await generateReceiptPdf(receipt);

    pdfUrl =
      pdf?.pdf_url || null;

    filePath =
      pdf?.file_path || null;

    if (
      pdfUrl &&
      filePath &&
      fs.existsSync(filePath)
    ) {
      await db.query(
        `
        UPDATE tbl_finance_receipts
        SET
          pdf_url = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          pdfUrl,
          receipt.id,
        ]
      );
    }
  }

  if (
    !filePath ||
    !fs.existsSync(filePath)
  ) {
    throw new Error(
      "Receipt PDF file missing after generation."
    );
  }

  const subject =
    `${receipt.title || "Payment Receipt"} - ${receipt.receipt_number}`;

  try {
    await emailService.sendMail({
      to: email,
      subject,
      html: receiptEmailTemplate(receipt),
      attachments: [
        {
          filename:
            `${receipt.receipt_number}.pdf`,
          path:
            filePath,
          contentType:
            "application/pdf",
        },
      ],
    });

    await db.query(
      `
      UPDATE tbl_finance_receipts
      SET
        email_status = 'sent',
        emailed_to = ?,
        emailed_at = NOW(),
        email_error = NULL,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        email,
        receipt.id,
      ]
    );

    return {
      ok: true,
      emailed_to: email,
      pdf_url: pdfUrl,
      file_path: filePath,
    };
  } catch (err) {
    await db.query(
      `
      UPDATE tbl_finance_receipts
      SET
        email_status = 'failed',
        emailed_to = ?,
        email_error = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        email,
        String(err.message || err).slice(0, 1000),
        receipt.id,
      ]
    );

    throw err;
  }
}
/* =========================================================
   RESEND EMAIL BY PAYMENT
========================================================= */

async function resendReceiptEmail(paymentId, options = {}) {
  const [rows] = await db.query(
    `
    SELECT id
    FROM tbl_finance_receipts
    WHERE payment_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [paymentId]
  );

  if (!rows.length) {
    throw new Error("Receipt not found.");
  }

  return sendReceiptEmail(rows[0].id, options);
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  sendReceiptEmail,
  resendReceiptEmail,
  receiptEmailTemplate,
};