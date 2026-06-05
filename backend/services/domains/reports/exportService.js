// backend/services/domains/export/exportService.js
"use strict";

const fs =
  require("fs");

const path =
  require("path");

const ExcelJS =
  require("exceljs");

const {
  createObjectCsvWriter,
} = require(
  "csv-writer"
);

/* =========================================================
   HELPERS
========================================================= */

function ensureExportDir() {

  const dir =
    path.join(

      process.cwd(),

      "uploads",

      "exports"
    );

  if (
    !fs.existsSync(dir)
  ) {

    fs.mkdirSync(
      dir,
      {
        recursive: true,
      }
    );
  }

  return dir;
}

function safeFileName(
  name
) {

  return String(
    name || "export"
  )

    .replace(/[^a-z0-9-_]/gi, "-")
    .toLowerCase();
}

function createExportPath(
  fileName,
  extension
) {

  const dir =
    ensureExportDir();

  const finalName =
    `${safeFileName(
      fileName
    )}-${Date.now()}.${extension}`;

  return {

    dir,

    file_name:
      finalName,

    file_path:
      path.join(
        dir,
        finalName
      ),

    file_url:
      `/uploads/exports/${finalName}`,
  };
}

/* =========================================================
   EXPORT EXCEL
========================================================= */

async function exportExcel({

  rows = [],

  fileName = "export",

  sheetName = "Sheet1",

  summary = null,
}) {

  const workbook =
    new ExcelJS.Workbook();

  const sheet =
    workbook.addWorksheet(
      sheetName
    );

  /* =====================================
     EMPTY
  ===================================== */

  if (!rows.length) {

    sheet.addRow([
      "No data available",
    ]);
  }

  /* =====================================
     HEADERS
  ===================================== */

  if (rows.length) {

    const headers =
      Object.keys(
        rows[0]
      );

    const headerRow =
      sheet.addRow(
        headers
      );

    headerRow.font = {
      bold: true,
    };

    /* ===============================
       DATA
    =============================== */

    rows.forEach((row) => {

      sheet.addRow(
        headers.map(
          (h) => row[h]
        )
      );
    });

    /* ===============================
       AUTO WIDTH
    =============================== */

    headers.forEach(

      (header, index) => {

        const column =
          sheet.getColumn(
            index + 1
          );

        column.width =
          Math.max(

            20,

            String(header)
              .length + 5
          );
      }
    );
  }

  /* =====================================
     SUMMARY SHEET
  ===================================== */

  if (summary) {

    const summarySheet =
      workbook.addWorksheet(
        "Summary"
      );

    Object.entries(
      summary
    ).forEach(

      ([key, value]) => {

        summarySheet.addRow([
          key,
          value,
        ]);
      }
    );
  }

  const exportInfo =
    createExportPath(
      fileName,
      "xlsx"
    );

  await workbook.xlsx.writeFile(
    exportInfo.file_path
  );

  return {

    success: true,

    ...exportInfo,
  };
}

/* =========================================================
   EXPORT CSV
========================================================= */

async function exportCsv({

  rows = [],

  fileName = "export",
}) {

  const exportInfo =
    createExportPath(
      fileName,
      "csv"
    );

  const headers =
    rows.length

      ? Object.keys(
          rows[0]
        ).map((key) => ({

          id: key,

          title: key,
        }))

      : [];

  const csvWriter =
    createObjectCsvWriter({

      path:
        exportInfo.file_path,

      header:
        headers,
    });

  await csvWriter.writeRecords(
    rows
  );

  return {

    success: true,

    ...exportInfo,
  };
}

/* =========================================================
   EXPORT JSON
========================================================= */

async function exportJson({

  rows = [],

  fileName = "export",
}) {

  const exportInfo =
    createExportPath(
      fileName,
      "json"
    );

  await fs.promises.writeFile(

    exportInfo.file_path,

    JSON.stringify(
      rows,
      null,
      2
    )
  );

  return {

    success: true,

    ...exportInfo,
  };
}

/* =========================================================
   CLEANUP EXPORTS
========================================================= */

async function cleanupExports(
  olderThanHours = 24
) {

  const dir =
    ensureExportDir();

  const files =
    await fs.promises.readdir(
      dir
    );

  let deleted = 0;

  for (const file of files) {

    try {

      const fullPath =
        path.join(
          dir,
          file
        );

      const stats =
        await fs.promises.stat(
          fullPath
        );

      const ageHours =

        (
          Date.now() -
          stats.mtimeMs
        ) /

        (1000 * 60 * 60);

      if (
        ageHours >
        olderThanHours
      ) {

        await fs.promises.unlink(
          fullPath
        );

        deleted++;
      }

    } catch (err) {

      console.error(
        "cleanupExports file error:",
        err.message
      );
    }
  }

  return {

    success: true,

    deleted,
  };
}

/* =========================================================
   EXPORT STATS
========================================================= */

async function getExportStats() {

  const dir =
    ensureExportDir();

  const files =
    await fs.promises.readdir(
      dir
    );

  let totalSize = 0;

  for (const file of files) {

    try {

      const stats =
        await fs.promises.stat(
          path.join(
            dir,
            file
          )
        );

      totalSize +=
        stats.size;

    } catch {}
  }

  return {

    total_files:
      files.length,

    total_size_bytes:
      totalSize,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  exportExcel,

  exportCsv,

  exportJson,

  cleanupExports,

  getExportStats,
};