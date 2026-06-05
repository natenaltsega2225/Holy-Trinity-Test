
// backend/services/pdfService.js

"use strict";

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const BRAND = {
  church:
    "Holy Trinity Ethiopian Orthodox Tewahedo Church",

  address:
    "Nashville, Tennessee",

  phone:
    "(615) 674-7405",

  email:
    "finance@holytrinity.org",

  website:
    "www.holytrinity.org",
};

/* =========================================================
   HELPERS
========================================================= */

function money(value) {

  return `$${Number(
    value || 0
  ).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function formatDate(value) {

  if (!value) return "--";

  const d =
    new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {

    return String(value);
  }

  return d.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }
  );
}

function pretty(value) {

  if (!value) {
    return "--";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (c) => c.toUpperCase()
    );
}

function coverageLabel(
  row = {}
) {

  if (
    row.coverage_label
  ) {
    return row.coverage_label;
  }

  const start =
    row.coverage_start ||
    row.period_start;

  const end =
    row.coverage_end ||
    row.period_end;

  if (
    !start ||
    !end
  ) {

    return "--";
  }

  const s =
    new Date(start);

  const e =
    new Date(end);

  if (
    Number.isNaN(
      s.getTime()
    ) ||
    Number.isNaN(
      e.getTime()
    )
  ) {

    return `${start} → ${end}`;
  }

  const fmt = (d) =>
    d.toLocaleDateString(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      }
    );

  return `${fmt(s)} – ${fmt(e)}`;
}

function cardDisplay(
  row = {}
) {

  if (
    !row.card_last4
  ) {

    return "--";
  }

  return `${String(
    row.card_brand ||
      "CARD"
  ).toUpperCase()} •••• ${row.card_last4}`;
}

function safeText(
  value,
  fallback = "--"
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return fallback;
  }

  return String(value);
}

function ensurePdfValue(
  value
) {

  return safeText(
    value,
    "--"
  );
}

/* =========================================================
   DRAW HELPERS
========================================================= */

function drawDivider(
  doc,
  y
) {

  doc
    .strokeColor(
      "#D6DCE5"
    )
    .lineWidth(1)
    .moveTo(48, y)
    .lineTo(565, y)
    .stroke();
}

function addLogo(doc) {

  const logoPath =
    path.join(
      __dirname,
      "../public/brand/church-logo.png"
    );

  if (
    fs.existsSync(
      logoPath
    )
  ) {

    doc.image(
      logoPath,
      50,
      40,
      { width: 72 }
    );
  }
}

function addWatermark(
  doc,
  text = "PAID"
) {

  if (!text) return;

  doc.save();

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(64)
    .fillColor(
      "#F1F5F9"
    )
    .rotate(
      -28,
      {
        origin: [306, 396],
      }
    )
    .text(
      text,
      135,
      360,
      {
        width: 340,
        align:
          "center",
      }
    );

  doc.restore();
}

function addHeader(
  doc,
  title,
  options = {}
) {

  addWatermark(
    doc,
    options.watermark || ""
  );

  addLogo(doc);

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(18)
    .fillColor(
      "#0F172A"
    )
    .text(
      BRAND.church,
      140,
      42,
      {
        width: 260,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(
      "#475569"
    )
    .text(
      BRAND.address,
      140,
      68
    )
    .text(
      BRAND.phone,
      140,
      82
    )
    .text(
      BRAND.email,
      140,
      96
    );

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(22)
    .fillColor(
      "#111827"
    )
    .text(
      title,
      365,
      55,
      {
        width: 190,
        align:
          "right",
      }
    );

  drawDivider(
    doc,
    130
  );
}

function infoRow(
  doc,
  label,
  value,
  y
) {

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(10)
    .fillColor(
      "#334155"
    )
    .text(
      ensurePdfValue(
        label
      ),
      55,
      y,
      {
        width: 115,
      }
    );

  doc
    .font(
      "Helvetica"
    )
    .fillColor(
      "#111827"
    )
    .text(
      ensurePdfValue(
        value
      ),
      180,
      y,
      {
        width: 360,
      }
    );
}

function addFooter(doc) {

  drawDivider(
    doc,
    730
  );

  doc
    .fontSize(9)
    .fillColor(
      "#64748B"
    )
    .font(
      "Helvetica"
    )
    .text(
      `
Thank you for supporting Holy Trinity Ethiopian Orthodox Tewahedo Church.
      `,
      50,
      742,
      {
        align:
          "center",
        width: 520,
      }
    );

  doc.text(
    `${BRAND.website} • ${BRAND.email}`,
    {
      align:
        "center",
    }
  );

  doc.text(
    `Generated ${new Date().toLocaleString(
      "en-US"
    )}`,
    {
      align:
        "center",
    }
  );
}

function ensureSpace(
  doc,
  y,
  needed = 40
) {

  if (
    y + needed < 720
  ) {

    return y;
  }

  addFooter(doc);

  doc.addPage();

  return 60;
}

/* =========================================================
   RECEIPT PDF
========================================================= */

function generateReceiptPdfBuffer(
  receipt = {}
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      try {

        const doc =
          new PDFDocument(
            {
              size:
                "LETTER",

              margin: 48,
            }
          );

        const chunks = [];

        doc.on(
          "data",
          (chunk) =>
            chunks.push(
              chunk
            )
        );

        doc.on(
          "end",
          () =>
            resolve(
              Buffer.concat(
                chunks
              )
            )
        );

        addHeader(
          doc,
          "OFFICIAL RECEIPT",
          {
            watermark:
              "PAID",
          }
        );

        let y = 160;

        const rows = [

          [
            "Receipt Number",
            receipt.receipt_number,
          ],

          [
            "Invoice Number",
            receipt.invoice_number,
          ],

          [
            "Payment Number",
            receipt.payment_number,
          ],

          [
            "Member / Donor",
            receipt.full_name ||
              receipt.full_name_snapshot,
          ],

          [
            "Member #",
            receipt.member_no,
          ],

          [
            "Email",
            receipt.email ||
              receipt.email_to,
          ],

          [
            "Category",
            pretty(
              receipt.category ||
                receipt.payment_type
            ),
          ],

          [
            "Details",
            pretty(
              receipt.sub_category
            ),
          ],
        ];

        if (
          receipt.donation_category
        ) {

          rows.push([
            "Donation Purpose",
            pretty(
              receipt.donation_category
            ),
          ]);
        }

        if (
          receipt.program_name
        ) {

          rows.push([
            "Program",
            receipt.program_name,
          ]);
        }

        rows.push(

          [
            "Coverage Period",
            coverageLabel(
              receipt
            ),
          ],

          [
            "Months Paid",
            receipt.months_paid
              ? `${receipt.months_paid} Month${
                  Number(
                    receipt.months_paid
                  ) > 1
                    ? "s"
                    : ""
                }`
              : "--",
          ],

          [
            "Payment Method",
            pretty(
              receipt.payment_method ||
                receipt.method
            ),
          ],

          [
            "Payment Source",
            pretty(
              receipt.payment_source ||
                receipt.provider
            ),
          ],

          [
            "Card",
            cardDisplay(
              receipt
            ),
          ],

          [
            "Expiration",
            receipt.card_exp_month &&
            receipt.card_exp_year
              ? `${receipt.card_exp_month}/${receipt.card_exp_year}`
              : "--",
          ],

          [
            "Receipt Status",
            pretty(
              receipt.status ||
                "paid"
            ),
          ],

          [
            "Issued At",
            formatDate(
              receipt.issued_at
            ),
          ]
        );

        rows.forEach(
          ([
            label,
            value,
          ]) => {

            y =
              ensureSpace(
                doc,
                y,
                24
              );

            infoRow(
              doc,
              label,
              value,
              y
            );

            y += 22;
          }
        );

        y += 20;

        y =
          ensureSpace(
            doc,
            y,
            130
          );

        drawDivider(
          doc,
          y
        );

        y += 20;

        doc
          .font(
            "Helvetica-Bold"
          )
          .fontSize(13)
          .fillColor(
            "#0F172A"
          )
          .text(
            "PAYMENT SUMMARY",
            50,
            y
          );

        y += 30;

        doc
          .roundedRect(
            50,
            y,
            515,
            80,
            8
          )
          .fillAndStroke(
            "#F8FAFC",
            "#CBD5E1"
          );

        doc
          .fillColor(
            "#0F172A"
          )
          .fontSize(12)
          .font(
            "Helvetica-Bold"
          )
          .text(
            "Total Paid",
            70,
            y + 18
          );

        doc
          .fontSize(26)
          .text(
            money(
              receipt.amount
            ),
            70,
            y + 40
          );

        doc
          .fontSize(10)
          .fillColor(
            "#475569"
          )
          .font(
            "Helvetica"
          )
          .text(
            `Receipt ${receipt.receipt_number || ""}`,
            340,
            y + 30,
            {
              width: 190,
              align:
                "right",
            }
          );

        addFooter(doc);

        doc.end();

      } catch (err) {

        reject(err);
      }
    }
  );
}

/* =========================================================
   INVOICE PDF
========================================================= */

function generateInvoicePdfBuffer(
  invoice = {},
  items = []
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      try {

        const doc =
          new PDFDocument(
            {
              size:
                "LETTER",

              margin: 48,
            }
          );

        const chunks = [];

        doc.on(
          "data",
          (chunk) =>
            chunks.push(
              chunk
            )
        );

        doc.on(
          "end",
          () =>
            resolve(
              Buffer.concat(
                chunks
              )
            )
        );

        addHeader(
          doc,
          "INVOICE",
          {
            watermark:
              String(
                invoice.status || ""
              ).toLowerCase() ===
              "paid"
                ? "PAID"
                : "INVOICE",
          }
        );

        let y = 160;

        const rows = [

          [
            "Invoice Number",
            invoice.invoice_number,
          ],

          [
            "Receipt Number",
            invoice.receipt_number,
          ],

          [
            "Payment Number",
            invoice.payment_number,
          ],

          [
            "Member / Donor",
            invoice.full_name ||
              invoice.full_name_snapshot,
          ],

          [
            "Member #",
            invoice.member_no,
          ],

          [
            "Email",
            invoice.email,
          ],

          [
            "Invoice Date",
            formatDate(
              invoice.invoice_date ||
                invoice.created_at
            ),
          ],

          [
            "Due Date",
            formatDate(
              invoice.due_date
            ),
          ],

          [
            "Status",
            pretty(
              invoice.status
            ),
          ],

          [
            "Coverage",
            coverageLabel(
              invoice
            ),
          ],
        ];

        rows.forEach(
          ([
            label,
            value,
          ]) => {

            y =
              ensureSpace(
                doc,
                y,
                24
              );

            infoRow(
              doc,
              label,
              value,
              y
            );

            y += 22;
          }
        );

        y += 20;

        y =
          ensureSpace(
            doc,
            y,
            120
          );

        drawDivider(
          doc,
          y
        );

        y += 20;

        doc
          .font(
            "Helvetica-Bold"
          )
          .fontSize(12)
          .fillColor(
            "#111827"
          );

        doc.text(
          "Description",
          55,
          y
        );

        doc.text(
          "Qty",
          365,
          y
        );

        doc.text(
          "Amount",
          465,
          y
        );

        y += 18;

        drawDivider(
          doc,
          y
        );

        y += 12;

        const invoiceItems =
          Array.isArray(
            items
          ) &&
          items.length
            ? items
            : [
                {
                  description:
                    invoice.description ||
                    "Invoice Payment",

                  quantity: 1,

                  amount:
                    invoice.total_amount ||
                    invoice.amount,

                  line_total:
                    invoice.total_amount ||
                    invoice.amount,
                },
              ];

        invoiceItems.forEach(
          (item) => {

            y =
              ensureSpace(
                doc,
                y,
                40
              );

            doc
              .font(
                "Helvetica"
              )
              .fontSize(10)
              .fillColor(
                "#111827"
              )
              .text(
                item.description ||
                  item.item_name ||
                  "Item",
                55,
                y,
                {
                  width: 290,
                }
              );

            doc.text(
              String(
                item.quantity ||
                  1
              ),
              365,
              y
            );

            doc.text(
              money(
                item.line_total ||
                  item.amount ||
                  0
              ),
              465,
              y,
              {
                width: 90,
                align:
                  "right",
              }
            );

            y += 30;
          }
        );

        y += 10;

        y =
          ensureSpace(
            doc,
            y,
            110
          );

        drawDivider(
          doc,
          y
        );

        y += 20;

        const total =
          invoice.total_amount ||
          invoice.amount ||
          0;

        const paid =
          invoice.paid_amount ??
          total;

        const balance =
          invoice.balance_due ??
          0;

        doc
          .font(
            "Helvetica-Bold"
          )
          .fontSize(12)
          .fillColor(
            "#111827"
          );

        doc.text(
          "Total",
          370,
          y
        );

        doc.text(
          money(total),
          465,
          y,
          {
            width: 90,
            align:
              "right",
          }
        );

        y += 22;

        doc.text(
          "Paid",
          370,
          y
        );

        doc.text(
          money(paid),
          465,
          y,
          {
            width: 90,
            align:
              "right",
          }
        );

        y += 22;

        doc.text(
          "Balance",
          370,
          y
        );

        doc.text(
          money(balance),
          465,
          y,
          {
            width: 90,
            align:
              "right",
          }
        );

        addFooter(doc);

        doc.end();

      } catch (err) {

        reject(err);
      }
    }
  );
}

module.exports = {

  generateReceiptPdfBuffer,

  generateInvoicePdfBuffer,
};