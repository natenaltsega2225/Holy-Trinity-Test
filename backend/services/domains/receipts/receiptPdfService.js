// backend/services/domains/receipts/receiptPdfService.js
"use strict";

const fs = require("fs");
const path = require("path");

const PDFDocument = require("pdfkit");

const {
  publicMoney,
} = require("../../shared/paymentHelpers");

/* =========================================================
   HELPERS
========================================================= */

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true,
    });
  }
}

function safe(value, fallback = "--") {
  const v = String(value ?? "").trim();
  return v || fallback;
}

function drawLabelValue(
  doc,
  label,
  value,
  x,
  y
) {
  doc
    .fontSize(9)
    .fillColor("#64748b")
    .text(label, x, y);

  doc
    .fontSize(11)
    .fillColor("#0f172a")
    .text(
      safe(value),
      x,
      y + 12
    );
}

/* =========================================================
   SECTION TITLE
========================================================= */

function sectionTitle(
  doc,
  text,
  y
) {
  doc
    .fontSize(12)
    .fillColor("#2563eb")
    .text(text, 50, y);

  doc
    .moveTo(50, y + 18)
    .lineTo(550, y + 18)
    .strokeColor("#dbe2ea")
    .stroke();
}

/* =========================================================
   COVERAGE TABLE
========================================================= */

function renderCoverage(
  doc,
  receipt,
  startY
) {

  const rows =
    receipt.membership
      ?.coverage_months || [];

  if (!rows.length) {
    return startY;
  }

  sectionTitle(
    doc,
    "Membership Coverage",
    startY
  );

  let y = startY + 30;
doc
  .fontSize(10)
  .fillColor("#0f172a")
  .text(
    `Coverage Period: ${
      receipt.membership.coverage_label
    }`,
    60,
    y
  );

y += 30;
  rows.forEach((row) => {

    doc
      .rect(60, y, 10, 10)
      .stroke("#16a34a");

    doc
      .fontSize(10)
      .fillColor("#16a34a")
      .text("✓", 62, y - 1);

    doc
      .fontSize(10)
      .fillColor("#0f172a")
      .text(
        row.label,
        80,
        y - 1
      );

    y += 20;
  });

  return y + 10;
}

/* =========================================================
   DONATION DETAILS
========================================================= */

function renderDonation(
  doc,
  receipt,
  startY
) {

  if (!receipt.donation) {
    return startY;
  }

  sectionTitle(
    doc,
    "Donation Details",
    startY
  );

  drawLabelValue(
    doc,
    "Donation Category",
    receipt.donation
      .donation_label,
    60,
    startY + 30
  );

  return startY + 70;
}

/* =========================================================
   PROGRAM DETAILS
========================================================= */

function renderProgram(
  doc,
  receipt,
  startY
) {

  if (!receipt.program) {
    return startY;
  }

  sectionTitle(
    doc,
    "Program Details",
    startY
  );

  const p =
    receipt.program;

  drawLabelValue(
    doc,
    "Program",
    p.program_name,
    60,
    startY + 30
  );

  drawLabelValue(
    doc,
    "Participants",
    p.quantity,
    300,
    startY + 30
  );

  let y = startY + 80;

  if (
    Array.isArray(
      p.participants
    ) &&
    p.participants.length
  ) {

    doc
      .fontSize(10)
      .fillColor("#64748b")
      .text(
        "Participant List",
        60,
        y
      );

    y += 20;

    p.participants.forEach(
      (person) => {

        const name =
          typeof person ===
          "string"
            ? person
            : person.full_name ||
              person.name ||
              "--";

        doc
          .fontSize(10)
          .fillColor("#0f172a")
          .text(
            `• ${name}`,
            80,
            y
          );

        y += 18;
      }
    );
  }

  return y + 10;
}

/* =========================================================
   GENERATE PDF
========================================================= */

async function generateReceiptPdf(
  receipt
) {

  const uploadsDir =
    path.join(
      process.cwd(),
      "uploads",
      "receipts"
    );

  ensureDir(uploadsDir);

  const fileName =
    `${receipt.receipt_number}.pdf`;

  const filePath =
    path.join(
      uploadsDir,
      fileName
    );

  const pdfUrl =
    `/uploads/receipts/${fileName}`;

  const doc =
    new PDFDocument({
      margin: 50,
      size: "A4",
    });

  const stream =
    fs.createWriteStream(
      filePath
    );

  doc.pipe(stream);

  /* =====================================================
     HEADER
  ===================================================== */

  doc
    .fontSize(22)
    .fillColor("#0f172a")
    .text(
      "Holy Trinity Ethiopian Orthodox Church",
      {
        align: "center",
      }
    );

  doc
    .fontSize(11)
    .fillColor("#64748b")
    .text(
      "ቅድስት ሥላሴ ቤተ ክርስቲያን",
      {
        align: "center",
      }
    );

  doc.moveDown(1);

  doc
    .fontSize(20)
    .fillColor("#2563eb")
    .text(
      receipt.title ||
        "Payment Receipt",
      {
        align: "center",
      }
    );

  doc.moveDown(2);

  /* =====================================================
     RECEIPT INFO
  ===================================================== */

  drawLabelValue(
    doc,
    "Receipt Number",
    receipt.receipt_number,
    50,
    160
  );

  drawLabelValue(
    doc,
    "Payment Number",
    receipt.payment_number,
    220,
    160
  );

  drawLabelValue(
    doc,
    "Invoice Number",
    receipt.invoice_number,
    390,
    160
  );

  drawLabelValue(
    doc,
    "Member / Guest",
    receipt.full_name,
    50,
    220
  );

  drawLabelValue(
    doc,
    "Payment Type",
    receipt.category_label,
    220,
    220
  );

  drawLabelValue(
    doc,
    "Amount",
    publicMoney(
      receipt.amount
    ),
    390,
    220
  );

  drawLabelValue(
    doc,
    "Payment Method",
    receipt.payment_method_label,
    50,
    280
  );

  drawLabelValue(
    doc,
    "Card / Ref",
    receipt.card_label ||
      receipt.reference_no,
    220,
    280
  );

  drawLabelValue(
    doc,
    "Status",
    receipt.payment_status,
    390,
    280
  );

  /* =====================================================
     CATEGORY SECTIONS
  ===================================================== */

  let y = 360;

  if (
    receipt.membership
  ) {
    y =
      renderCoverage(
        doc,
        receipt,
        y
      );
  }

  if (
    receipt.donation
  ) {
    y =
      renderDonation(
        doc,
        receipt,
        y
      );
  }

  if (
    receipt.program
  ) {
    y =
      renderProgram(
        doc,
        receipt,
        y
      );
  }

  /* =====================================================
     FOOTER
  ===================================================== */

  doc
    .fontSize(9)
    .fillColor("#64748b")
    .text(
      "Thank you for supporting Holy Trinity Ethiopian Orthodox Church.",
      50,
      730,
      {
        align: "center",
        width: 500,
      }
    );

  doc.end();

  await new Promise(
    (resolve) => {
      stream.on(
        "finish",
        resolve
      );
    }
  );

  return {
    file_path: filePath,
    pdf_url: pdfUrl,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  generateReceiptPdf,
};