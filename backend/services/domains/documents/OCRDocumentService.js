// backend/services/domains/documents/OCRDocumentService.js
"use strict";

const fs =
  require("fs");

const path =
  require("path");

const Tesseract =
  require("tesseract.js");

const pdfParse =
  require("pdf-parse");

/* =========================================================
   HELPERS
========================================================= */

function safe(
  value
) {

  return String(
    value || ""
  ).trim();
}

function normalizeText(
  value
) {

  return safe(value)

    .replace(/\s+/g, " ")

    .trim();
}

/* =========================================================
   OCR IMAGE
========================================================= */

async function extractTextFromImage(
  imagePath
) {

  try {

    const result =
      await Tesseract.recognize(

        imagePath,

        "eng"
      );

    return {

      success: true,

      text:
        normalizeText(
          result?.data?.text
        ),

      raw:
        result,
    };

  } catch (err) {

    console.error(
      "extractTextFromImage error:",
      err
    );

    return {

      success: false,

      error:
        err.message,
    };
  }
}

/* =========================================================
   OCR PDF
========================================================= */

async function extractTextFromPdf(
  pdfPath
) {

  try {

    const buffer =
      await fs.promises.readFile(
        pdfPath
      );

    const result =
      await pdfParse(
        buffer
      );

    return {

      success: true,

      text:
        normalizeText(
          result.text
        ),

      pages:
        result.numpages,
    };

  } catch (err) {

    console.error(
      "extractTextFromPdf error:",
      err
    );

    return {

      success: false,

      error:
        err.message,
    };
  }
}

/* =========================================================
   EXTRACT DOCUMENT TEXT
========================================================= */

async function extractDocumentText(
  filePath
) {

  const ext =
    path
      .extname(
        filePath || ""
      )
      .toLowerCase();

  /* =====================================
     IMAGE
  ===================================== */

  if (

    [
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".bmp",
    ].includes(ext)

  ) {

    return extractTextFromImage(
      filePath
    );
  }

  /* =====================================
     PDF
  ===================================== */

  if (
    ext === ".pdf"
  ) {

    return extractTextFromPdf(
      filePath
    );
  }

  return {

    success: false,

    error:
      "Unsupported file type.",
  };
}

/* =========================================================
   RECEIPT EXTRACTION
========================================================= */

async function extractReceiptData(
  text
) {

  const normalized =
    normalizeText(
      text
    );

  const amountMatch =
    normalized.match(
      /\$?\s?(\d+(?:\.\d{2})?)/
    );

  const emailMatch =
    normalized.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
    );

  const phoneMatch =
    normalized.match(
      /(\+?\d[\d\s\-()]{7,})/g
    );

  return {

    amount:
      amountMatch
        ? Number(
            amountMatch[1]
          )
        : null,

    email:
      emailMatch?.[0] || null,

    phone:
      phoneMatch?.[0] || null,

    raw_text:
      normalized,
  };
}

/* =========================================================
   INVOICE EXTRACTION
========================================================= */

async function extractInvoiceData(
  text
) {

  const normalized =
    normalizeText(
      text
    );

  const invoiceNumber =
    normalized.match(
      /invoice[\s#:]*([A-Z0-9\-]+)/i
    );

  const amount =
    normalized.match(
      /\$?\s?(\d+(?:\.\d{2})?)/
    );

  return {

    invoice_number:
      invoiceNumber?.[1] || null,

    amount:
      amount
        ? Number(
            amount[1]
          )
        : null,

    raw_text:
      normalized,
  };
}

/* =========================================================
   OCR ANALYTICS
========================================================= */

async function generateOcrSummary(
  text
) {

  const normalized =
    normalizeText(
      text
    );

  return {

    characters:
      normalized.length,

    words:
      normalized.split(" ")
        .length,

    lines:
      normalized.split("\n")
        .length,
  };
}

/* =========================================================
   SMART DOCUMENT PARSER
========================================================= */

async function smartParseDocument(
  filePath
) {

  const extraction =
    await extractDocumentText(
      filePath
    );

  if (
    !extraction.success
  ) {

    return extraction;
  }

  const text =
    extraction.text;

  const lower =
    text.toLowerCase();

  let parsed = {};

  /* =====================================
     RECEIPT
  ===================================== */

  if (
    lower.includes("receipt")
  ) {

    parsed =
      await extractReceiptData(
        text
      );
  }

  /* =====================================
     INVOICE
  ===================================== */

  else if (
    lower.includes("invoice")
  ) {

    parsed =
      await extractInvoiceData(
        text
      );
  }

  return {

    success: true,

    text,

    parsed,

    analytics:
      await generateOcrSummary(
        text
      ),
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  extractTextFromImage,

  extractTextFromPdf,

  extractDocumentText,

  extractReceiptData,

  extractInvoiceData,

  generateOcrSummary,

  smartParseDocument,
};