// backend/services/domains/invoices/invoicePdfService.js
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
   MEMBERSHIP SECTION
========================================================= */

function renderMembership(
  doc,
  invoice,
  startY
) {

  const membership =
    invoice.payments.find(
      (p) => p.membership
    )?.membership;

  if (!membership) {
    return startY;
  }

  sectionTitle(
    doc,
    "Membership Coverage",
    startY
  );

  drawLabelValue(
    doc,
    "Membership Plan",
    membership.plan_name,
    60,
    startY + 30
  );

  drawLabelValue(
    doc,
    "Months Paid",
    membership.months_paid,
    320,
    startY + 30
  );

  let y =
    startY + 90;

  membership.coverage_months.forEach(
    (row) => {

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
    }
  );

  return y + 10;
}

/* =========================================================
   DONATION SECTION
========================================================= */

function renderDonation(
  doc,
  invoice,
  startY
) {

  const donation =
    invoice.payments.find(
      (p) => p.donation
    )?.donation;

  if (!donation) {
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
    donation.donation_label,
    60,
    startY + 30
  );

  return startY + 80;
}

/* =========================================================
   PROGRAM SECTION
========================================================= */

function renderProgram(
  doc,
  invoice,
  startY
) {

  const program =
    invoice.payments.find(
      (p) => p.program
    )?.program;

  if (!program) {
    return startY;
  }

  sectionTitle(
    doc,
    "Program Details",
    startY
  );

  drawLabelValue(
    doc,
    "Program",
    program.program_name,
    60,
    startY + 30
  );

  drawLabelValue(
    doc,
    "Participants",
    program.quantity,
    320,
    startY + 30
  );

  let y =
    startY + 90;

  if (
    Array.isArray(
      program.participants
    ) &&
    program.participants.length
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

    program.participants.forEach(
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
   RECEIPTS TABLE
========================================================= */

function renderReceipts(
  doc,
  invoice,
  startY
) {

  if (
    !Array.isArray(
      invoice.receipts
    ) ||
    !invoice.receipts.length
  ) {
    return startY;
  }

  sectionTitle(
    doc,
    "Linked Receipts",
    startY
  );

  let y =
    startY + 35;

  invoice.receipts.forEach(
    (receipt) => {

      doc
        .fontSize(10)
        .fillColor("#0f172a")
        .text(
          receipt.receipt_number,
          60,
          y
        );

      doc
        .fontSize(10)
        .fillColor("#475569")
        .text(
          publicMoney(
            receipt.amount
          ),
          300,
          y
        );

      doc
        .fontSize(10)
        .fillColor("#16a34a")
        .text(
          receipt.status,
          430,
          y
        );

      y += 18;
    }
  );

  return y + 10;
}

/* =========================================================
   GENERATE PDF
========================================================= */

async function generateInvoicePdf(
  invoice
) {

  const uploadsDir =
    path.join(
      process.cwd(),
      "uploads",
      "invoices"
    );

  ensureDir(uploadsDir);

  const fileName =
    `${invoice.invoice_number}.pdf`;

  const filePath =
    path.join(
      uploadsDir,
      fileName
    );

  const pdfUrl =
    `/uploads/invoices/${fileName}`;

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
      "Finance Invoice",
      {
        align: "center",
      }
    );

  doc.moveDown(2);

  /* =====================================================
     CORE INFO
  ===================================================== */

  drawLabelValue(
    doc,
    "Invoice Number",
    invoice.invoice_number,
    50,
    160
  );

  drawLabelValue(
    doc,
    "Status",
    invoice.status,
    220,
    160
  );

  drawLabelValue(
    doc,
    "Category",
    invoice.category_label,
    390,
    160
  );

  drawLabelValue(
    doc,
    "Member / Guest",
    invoice.full_name,
    50,
    220
  );

  drawLabelValue(
    doc,
    "Email",
    invoice.email,
    220,
    220
  );

  drawLabelValue(
    doc,
    "Phone",
    invoice.phone,
    390,
    220
  );

  drawLabelValue(
    doc,
    "Subtotal",
    publicMoney(
      invoice.subtotal
    ),
    50,
    290
  );

  drawLabelValue(
    doc,
    "Paid",
    publicMoney(
      invoice.paid_amount
    ),
    220,
    290
  );

  drawLabelValue(
    doc,
    "Balance",
    publicMoney(
      invoice.balance_due
    ),
    390,
    290
  );

  /* =====================================================
     DYNAMIC SECTIONS
  ===================================================== */

  let y = 380;

  y =
    renderMembership(
      doc,
      invoice,
      y
    );

  y =
    renderDonation(
      doc,
      invoice,
      y
    );

  y =
    renderProgram(
      doc,
      invoice,
      y
    );

  y =
    renderReceipts(
      doc,
      invoice,
      y
    );

  /* =====================================================
     FOOTER
  ===================================================== */

  doc
    .fontSize(9)
    .fillColor("#64748b")
    .text(
      "Official church finance invoice document.",
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
  generateInvoicePdf,
};