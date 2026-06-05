// backend/services/domains/invoices/invoiceEmailService.js
"use strict";

const path = require("path");

const db = require("../../../db");

const emailService = require("../../emailService");

const {
  generateInvoicePdf,
} = require("./invoicePdfService");

const {
  getInvoiceById,
} = require("./invoiceService");

/* =========================================================
   HELPERS
========================================================= */

function safe(value, fallback = "") {
  const v = String(value ?? "").trim();
  return v || fallback;
}

function money(value) {
  return Number(value || 0).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  );
}

/* =========================================================
   TEMPLATE
========================================================= */

function invoiceEmailTemplate(
  invoice
) {

  return `
  <div
    style="
      font-family:Arial,sans-serif;
      background:#f8fafc;
      padding:40px;
    "
  >

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
          color:white;
          padding:32px;
          text-align:center;
        "
      >

        <h1
          style="
            margin:0;
            font-size:28px;
          "
        >
          Holy Trinity Ethiopian Orthodox Church
        </h1>

        <div
          style="
            margin-top:10px;
            font-size:14px;
            opacity:.85;
          "
        >
          ቅድስት ሥላሴ ቤተ ክርስቲያን
        </div>

      </div>

      <div style="padding:36px;">

        <h2
          style="
            margin-top:0;
            color:#2563eb;
          "
        >
          Finance Invoice
        </h2>

        <p
          style="
            color:#475569;
            line-height:1.7;
          "
        >
          Dear ${safe(invoice.full_name)},
          <br /><br />

          Please find your official invoice attached.
        </p>

        <table
          width="100%"
          cellpadding="10"
          style="
            border-collapse:collapse;
            margin-top:24px;
          "
        >

          <tr>
            <td
              style="
                background:#f8fafc;
                border:1px solid #e2e8f0;
                width:40%;
              "
            >
              Invoice Number
            </td>

            <td
              style="
                border:1px solid #e2e8f0;
              "
            >
              ${safe(invoice.invoice_number)}
            </td>
          </tr>

          <tr>
            <td
              style="
                background:#f8fafc;
                border:1px solid #e2e8f0;
              "
            >
              Category
            </td>

            <td
              style="
                border:1px solid #e2e8f0;
              "
            >
              ${safe(invoice.category_label)}
            </td>
          </tr>

          <tr>
            <td
              style="
                background:#f8fafc;
                border:1px solid #e2e8f0;
              "
            >
              Total Amount
            </td>

            <td
              style="
                border:1px solid #e2e8f0;
                font-weight:bold;
              "
            >
              ${money(
                invoice.total_amount
              )}
            </td>
          </tr>

          <tr>
            <td
              style="
                background:#f8fafc;
                border:1px solid #e2e8f0;
              "
            >
              Paid Amount
            </td>

            <td
              style="
                border:1px solid #e2e8f0;
              "
            >
              ${money(
                invoice.paid_amount
              )}
            </td>
          </tr>

          <tr>
            <td
              style="
                background:#f8fafc;
                border:1px solid #e2e8f0;
              "
            >
              Balance Due
            </td>

            <td
              style="
                border:1px solid #e2e8f0;
                color:#dc2626;
                font-weight:bold;
              "
            >
              ${money(
                invoice.balance_due
              )}
            </td>
          </tr>

        </table>

        ${
          invoice.payments?.length
            ? `
            <div style="margin-top:35px;">

              <h3
                style="
                  color:#0f172a;
                "
              >
                Payment Summary
              </h3>

              ${invoice.payments
                .map(
                  (payment) => `
                  <div
                    style="
                      border:1px solid #e2e8f0;
                      border-radius:12px;
                      padding:16px;
                      margin-top:12px;
                    "
                  >

                    <div>
                      <strong>
                        ${payment.category_label}
                      </strong>
                    </div>

                    <div style="margin-top:8px;">
                      Amount:
                      ${money(payment.amount)}
                    </div>

                    ${
                      payment.membership
                        ? `
                        <div style="margin-top:8px;">
                          Coverage:
                          ${payment.membership.coverage_label}
                        </div>
                        `
                        : ""
                    }

                    ${
                      payment.donation
                        ? `
                        <div style="margin-top:8px;">
                          Donation:
                          ${payment.donation.donation_label}
                        </div>
                        `
                        : ""
                    }

                    ${
                      payment.program
                        ? `
                        <div style="margin-top:8px;">
                          Program:
                          ${payment.program.program_name}
                        </div>
                        `
                        : ""
                    }

                  </div>
                  `
                )
                .join("")}

            </div>
            `
            : ""
        }

        <div
          style="
            margin-top:40px;
            font-size:13px;
            color:#64748b;
            line-height:1.7;
          "
        >
          This invoice is an official church finance document.
          Please retain it for your records.
        </div>

      </div>

    </div>

  </div>
  `;
}

/* =========================================================
   SEND EMAIL
========================================================= */

async function sendInvoiceEmail(
  invoiceId,
  options = {}
) {

  const invoice =
    await getInvoiceById(
      invoiceId
    );

  if (!invoice) {
    throw new Error(
      "Invoice not found."
    );
  }

  const email =
    safe(
      options.email ||
      invoice.email
    );

  if (!email) {
    throw new Error(
      "Invoice email missing."
    );
  }

  let pdfUrl =
    invoice.pdf_url;

  if (!pdfUrl) {

    const pdf =
      await generateInvoicePdf(
        invoice
      );

    pdfUrl =
      pdf.pdf_url;

    await db.query(
      `
      UPDATE tbl_finance_invoices
      SET
        pdf_url = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        pdfUrl,
        invoice.id,
      ]
    );
  }

  const filePath =
    path.join(
      process.cwd(),
      pdfUrl.replace(
        /^\/+/,
        ""
      )
    );

  await emailService.sendMail({

    to: email,

    subject:
      `Invoice ${invoice.invoice_number}`,

    html:
      invoiceEmailTemplate(
        invoice
      ),

    attachments: [
      {
        filename:
          `${invoice.invoice_number}.pdf`,
        path: filePath,
      },
    ],
  });

  await db.query(
    `
    UPDATE tbl_finance_invoices
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
      invoice.id,
    ]
  );

  return {
    ok: true,
    emailed_to: email,
  };
}

/* =========================================================
   RESEND
========================================================= */

async function resendInvoiceEmail(
  invoiceId,
  options = {}
) {

  return sendInvoiceEmail(
    invoiceId,
    options
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  sendInvoiceEmail,
  resendInvoiceEmail,
  invoiceEmailTemplate,
};