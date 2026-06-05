// backend/services/domains/export/exportService.js
"use strict";

const fs =
  require("fs");

const path =
  require("path");

const os =
  require("os");

const ExcelJS =
  require("exceljs");

const {
  Parser,
} = require("json2csv");

/* =========================================================
   TEMP DIRECTORY
========================================================= */

const EXPORT_DIR =
  path.join(
    os.tmpdir(),
    "holytrinity-exports"
  );

if (
  !fs.existsSync(EXPORT_DIR)
) {

  fs.mkdirSync(
    EXPORT_DIR,
    {
      recursive: true,
    }
  );
}

/* =========================================================
   HELPERS
========================================================= */

function safeFileName(
  value = "export"
) {

  return String(value)
    .trim()
    .replace(/[^a-z0-9-_]/gi, "_")
    .toLowerCase();
}

function buildExportPath(
  prefix,
  extension
) {

  return path.join(

    EXPORT_DIR,

    `${safeFileName(prefix)}-${Date.now()}.${extension}`
  );
}

function autoColumns(
  rows = []
) {

  if (!rows.length) {
    return [];
  }

  return Object.keys(
    rows[0]
  ).map((key) => ({

    header:
      key,

    key,

    width:
      Math.max(
        18,
        key.length + 4
      ),
  }));
}

function normalizeRows(
  rows = []
) {

  return rows.map((row) => {

    const obj = {};

    Object.entries(row || {})
      .forEach(([k, v]) => {

        if (
          v === null ||
          v === undefined
        ) {

          obj[k] = "";

        } else if (
          typeof v === "object"
        ) {

          obj[k] =
            JSON.stringify(v);

        } else {

          obj[k] = v;
        }
      });

    return obj;
  });
}

/* =========================================================
   CSV EXPORT
========================================================= */

async function exportCsv({

  rows = [],

  fields = [],

  fileName = "export",
}) {

  const safeRows =
    normalizeRows(rows);

  const parser =
    new Parser({

      fields:
        fields.length

          ? fields

          : Object.keys(
              safeRows[0] || {}
            ),
    });

  const csv =
    parser.parse(
      safeRows
    );

  const filePath =
    buildExportPath(
      fileName,
      "csv"
    );

  await fs.promises.writeFile(
    filePath,
    csv,
    "utf8"
  );

  return {

    success: true,

    type:
      "csv",

    file_path:
      filePath,

    file_name:
      path.basename(
        filePath
      ),

    total_rows:
      safeRows.length,
  };
}

/* =========================================================
   SINGLE SHEET EXCEL
========================================================= */

async function exportExcel({

  rows = [],

  columns = [],

  fileName = "export",

  sheetName = "Sheet1",

  summary = null,
}) {

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "Holy Trinity Finance System";

  workbook.created =
    new Date();

  const sheet =
    workbook.addWorksheet(
      sheetName
    );

  const safeRows =
    normalizeRows(rows);

  sheet.columns =
    columns.length

      ? columns

      : autoColumns(
          safeRows
        );

  safeRows.forEach((row) => {

    sheet.addRow(row);
  });

  /* =====================================
     HEADER STYLE
  ===================================== */

  const headerRow =
    sheet.getRow(1);

  headerRow.font = {

    bold: true,

    size: 12,
  };

  headerRow.alignment = {

    vertical:
      "middle",

    horizontal:
      "center",
  };

  headerRow.height = 24;

  /* =====================================
     AUTO FILTER
  ===================================== */

  sheet.autoFilter = {

    from: "A1",

    to:
      `${sheet.getRow(1).cellCount}${sheet.rowCount}`,
  };

  /* =====================================
     SUMMARY SECTION
  ===================================== */

  if (summary) {

    sheet.addRow([]);

    sheet.addRow([
      "SUMMARY",
    ]);

    Object.entries(summary)
      .forEach(([k, v]) => {

        sheet.addRow([
          k,
          v,
        ]);
      });
  }

  const filePath =
    buildExportPath(
      fileName,
      "xlsx"
    );

  await workbook.xlsx.writeFile(
    filePath
  );

  return {

    success: true,

    type:
      "xlsx",

    file_path:
      filePath,

    file_name:
      path.basename(
        filePath
      ),

    total_rows:
      safeRows.length,
  };
}

/* =========================================================
   MULTI SHEET EXCEL
========================================================= */

async function exportMultiSheetExcel({

  sheets = [],

  fileName = "export",
}) {

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "Holy Trinity Finance System";

  workbook.created =
    new Date();

  for (const s of sheets) {

    const sheet =
      workbook.addWorksheet(
        s.name || "Sheet"
      );

    const rows =
      normalizeRows(
        s.rows || []
      );

    const columns =
      s.columns?.length

        ? s.columns

        : autoColumns(rows);

    sheet.columns =
      columns;

    rows.forEach((row) => {

      sheet.addRow(row);
    });

    const header =
      sheet.getRow(1);

    header.font = {

      bold: true,
    };

    header.alignment = {

      vertical:
        "middle",

      horizontal:
        "center",
    };

    sheet.autoFilter = {

      from: "A1",

      to:
        `${sheet.getRow(1).cellCount}${sheet.rowCount}`,
    };
  }

  const filePath =
    buildExportPath(
      fileName,
      "xlsx"
    );

  await workbook.xlsx.writeFile(
    filePath
  );

  return {

    success: true,

    type:
      "xlsx",

    file_path:
      filePath,

    file_name:
      path.basename(
        filePath
      ),
  };
}

/* =========================================================
   PAYMENT EXPORT
========================================================= */

async function exportPayments(
  payload = {}
) {

  return exportExcel({

    rows:
      payload.rows || [],

    fileName:
      payload.fileName ||
      "payments",

    sheetName:
      "Payments",

    summary:
      payload.summary,
  });
}

/* =========================================================
   DONATION EXPORT
========================================================= */

async function exportDonations(
  payload = {}
) {

  return exportExcel({

    rows:
      payload.rows || [],

    fileName:
      payload.fileName ||
      "donations",

    sheetName:
      "Donations",

    summary:
      payload.summary,
  });
}

/* =========================================================
   RECEIPT EXPORT
========================================================= */

async function exportReceipts(
  payload = {}
) {

  return exportExcel({

    rows:
      payload.rows || [],

    fileName:
      payload.fileName ||
      "receipts",

    sheetName:
      "Receipts",

    summary:
      payload.summary,
  });
}

/* =========================================================
   INVOICE EXPORT
========================================================= */

async function exportInvoices(
  payload = {}
) {

  return exportExcel({

    rows:
      payload.rows || [],

    fileName:
      payload.fileName ||
      "invoices",

    sheetName:
      "Invoices",

    summary:
      payload.summary,
  });
}

/* =========================================================
   MEMBER EXPORT
========================================================= */

async function exportMembers(
  payload = {}
) {

  return exportExcel({

    rows:
      payload.rows || [],

    fileName:
      payload.fileName ||
      "members",

    sheetName:
      "Members",

    summary:
      payload.summary,
  });
}

/* =========================================================
   CLEANUP OLD EXPORTS
========================================================= */

async function cleanupExports(
  olderThanHours = 24
) {

  const files =
    await fs.promises.readdir(
      EXPORT_DIR
    );

  const now =
    Date.now();

  let deleted = 0;

  for (const file of files) {

    const filePath =
      path.join(
        EXPORT_DIR,
        file
      );

    const stat =
      await fs.promises.stat(
        filePath
      );

    const ageHours =
      (
        now -
        stat.mtimeMs
      ) /
      1000 /
      60 /
      60;

    if (
      ageHours >
      olderThanHours
    ) {

      await fs.promises.unlink(
        filePath
      );

      deleted++;
    }
  }

  return {

    success: true,

    deleted,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  exportCsv,

  exportExcel,

  exportMultiSheetExcel,

  exportPayments,

  exportDonations,

  exportReceipts,

  exportInvoices,

  exportMembers,

  cleanupExports,
};