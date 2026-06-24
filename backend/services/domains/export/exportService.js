// backend/services/domains/export/exportService.js
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ExcelJS = require("exceljs");

let Json2CsvParser = null;

try {
  Json2CsvParser = require("json2csv").Parser;
} catch (_err) {
  Json2CsvParser = null;
}

/* -------------------------------------------------------------------------- */
/* Paths                                                                      */
/* -------------------------------------------------------------------------- */

const BACKEND_ROOT = path.resolve(__dirname, "../../..", "..");

const EXPORT_DIR =
  process.env.EXPORT_DIR ||
  path.join(BACKEND_ROOT, "uploads", "exports");

const EXPORT_PUBLIC_BASE =
  process.env.EXPORT_PUBLIC_BASE ||
  "/uploads/exports";

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, {
      recursive: true,
    });
  }

  return EXPORT_DIR;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeFileName(value = "export") {
  const text = String(value || "export")
    .trim()
    .replace(/[^a-z0-9-_ ]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return text || "export";
}

function safeSheetName(value = "Sheet1") {
  const text = String(value || "Sheet1")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim()
    .slice(0, 31);

  return text || "Sheet1";
}

function createExportPath(fileName, extension) {
  ensureExportDir();

  const safeExtension = String(extension || "xlsx")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

  const finalName = [
    safeFileName(fileName),
    Date.now(),
    crypto.randomBytes(3).toString("hex").toUpperCase(),
  ].join("-") + `.${safeExtension}`;

  return {
    dir: EXPORT_DIR,
    file_name: finalName,
    file_path: path.join(EXPORT_DIR, finalName),
    file_url: `${EXPORT_PUBLIC_BASE.replace(/\/+$/, "")}/${finalName}`,
  };
}

function normalizeValue(value) {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_err) {
      return String(value);
    }
  }

  return value;
}

function normalizeRows(rows = []) {
  return rows.map((row) => {
    const next = {};

    Object.entries(row || {}).forEach(([key, value]) => {
      next[key] = normalizeValue(value);
    });

    return next;
  });
}

function getHeaders(rows = [], preferred = []) {
  const keys = new Set();

  preferred.forEach((key) => {
    if (key) keys.add(key);
  });

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => keys.add(key));
  });

  return [...keys];
}

function humanHeader(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildColumns(rows = [], columns = []) {
  if (columns.length) {
    return columns.map((column) => {
      if (typeof column === "string") {
        return {
          header: humanHeader(column),
          key: column,
          width: 22,
        };
      }

      return {
        header: column.header || humanHeader(column.key),
        key: column.key || column.id,
        width: Number(column.width || 22),
      };
    });
  }

  const headers = getHeaders(rows);

  return headers.map((key) => ({
    header: humanHeader(key),
    key,
    width: Math.min(
      60,
      Math.max(
        16,
        humanHeader(key).length + 4,
        ...rows.slice(0, 100).map((row) => String(row[key] || "").length + 2)
      )
    ),
  }));
}

function escapeCsv(value) {
  const text = String(normalizeValue(value));
  const escaped = text.replace(/"/g, '""');

  return /[",\n\r]/.test(escaped)
    ? `"${escaped}"`
    : escaped;
}

function buildCsv(rows = [], fields = []) {
  const headers = fields.length ? fields : getHeaders(rows);

  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((key) => escapeCsv(row[key])).join(",")),
  ];

  return lines.join("\n");
}

function addEmptySheetMessage(sheet) {
  sheet.addRow(["No data available"]);
  const row = sheet.getRow(1);
  row.font = { italic: true, color: { argb: "FF64748B" } };
}

function styleWorksheet(sheet) {
  if (sheet.rowCount < 1) return;

  const header = sheet.getRow(1);

  header.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F3F68" },
  };

  header.alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  header.height = 24;

  sheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  if (sheet.columnCount && sheet.rowCount > 1) {
    sheet.autoFilter = {
      from: {
        row: 1,
        column: 1,
      },
      to: {
        row: 1,
        column: sheet.columnCount,
      },
    };
  }

  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.alignment = {
        vertical: "top",
        wrapText: true,
      };

      cell.border = {
        bottom: {
          style: "thin",
          color: { argb: "FFE5E7EB" },
        },
      };
    });

    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      });
    }
  });
}

function addSummarySheet(workbook, summary = {}) {
  const sheet = workbook.addWorksheet("Summary");

  sheet.columns = [
    {
      header: "Metric",
      key: "metric",
      width: 34,
    },
    {
      header: "Value",
      key: "value",
      width: 50,
    },
  ];

  Object.entries(summary).forEach(([key, value]) => {
    sheet.addRow({
      metric: humanHeader(key),
      value: normalizeValue(value),
    });
  });

  styleWorksheet(sheet);
}

function workbookBase() {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Holy Trinity Finance & Membership Platform";
  workbook.lastModifiedBy = "Holy Trinity Finance & Membership Platform";
  workbook.created = new Date();
  workbook.modified = new Date();

  workbook.properties = {
    title: "Holy Trinity Finance Export",
    subject: "Enterprise finance report export",
    company: "Holy Trinity",
  };

  return workbook;
}

/* -------------------------------------------------------------------------- */
/* CSV                                                                        */
/* -------------------------------------------------------------------------- */

async function exportCsv({
  rows = [],
  fields = [],
  fileName = "export",
} = {}) {
  const safeRows = normalizeRows(rows);
  const headers = fields.length ? fields : getHeaders(safeRows);

  let csv;

  if (Json2CsvParser) {
    const parser = new Json2CsvParser({
      fields: headers,
      withBOM: true,
    });

    csv = parser.parse(safeRows);
  } else {
    csv = buildCsv(safeRows, headers);
  }

  const exportInfo = createExportPath(fileName, "csv");

  await fs.promises.writeFile(
    exportInfo.file_path,
    `\uFEFF${csv}`,
    "utf8"
  );

  return {
    success: true,
    type: "csv",
    total_rows: safeRows.length,
    ...exportInfo,
  };
}

/* -------------------------------------------------------------------------- */
/* Excel                                                                      */
/* -------------------------------------------------------------------------- */

async function exportExcel({
  rows = [],
  columns = [],
  fileName = "export",
  sheetName = "Sheet1",
  summary = null,
} = {}) {
  const workbook = workbookBase();
  const sheet = workbook.addWorksheet(safeSheetName(sheetName));
  const safeRows = normalizeRows(rows);

  if (!safeRows.length) {
    addEmptySheetMessage(sheet);
  } else {
    sheet.columns = buildColumns(safeRows, columns);

    safeRows.forEach((row) => {
      sheet.addRow(row);
    });

    styleWorksheet(sheet);
  }

  if (summary) {
    addSummarySheet(workbook, {
      ...summary,
      total_rows: safeRows.length,
      generated_at: new Date().toISOString(),
    });
  }

  const exportInfo = createExportPath(fileName, "xlsx");

  await workbook.xlsx.writeFile(exportInfo.file_path);

  return {
    success: true,
    type: "xlsx",
    total_rows: safeRows.length,
    ...exportInfo,
  };
}

async function exportMultiSheetExcel({
  sheets = [],
  fileName = "export",
  summary = null,
} = {}) {
  const workbook = workbookBase();

  if (!sheets.length) {
    const sheet = workbook.addWorksheet("Report");
    addEmptySheetMessage(sheet);
  }

  for (const sheetPayload of sheets) {
    const safeRows = normalizeRows(sheetPayload.rows || []);
    const sheet = workbook.addWorksheet(
      safeSheetName(sheetPayload.name || sheetPayload.sheetName || "Sheet")
    );

    if (!safeRows.length) {
      addEmptySheetMessage(sheet);
      continue;
    }

    sheet.columns = buildColumns(safeRows, sheetPayload.columns || []);

    safeRows.forEach((row) => {
      sheet.addRow(row);
    });

    styleWorksheet(sheet);
  }

  if (summary) {
    addSummarySheet(workbook, {
      ...summary,
      generated_at: new Date().toISOString(),
    });
  }

  const exportInfo = createExportPath(fileName, "xlsx");

  await workbook.xlsx.writeFile(exportInfo.file_path);

  return {
    success: true,
    type: "xlsx",
    total_sheets: sheets.length,
    ...exportInfo,
  };
}

/* -------------------------------------------------------------------------- */
/* JSON                                                                       */
/* -------------------------------------------------------------------------- */

async function exportJson({
  rows = [],
  fileName = "export",
  summary = null,
} = {}) {
  const safeRows = normalizeRows(rows);
  const exportInfo = createExportPath(fileName, "json");

  await fs.promises.writeFile(
    exportInfo.file_path,
    JSON.stringify(
      {
        success: true,
        generated_at: new Date().toISOString(),
        total_rows: safeRows.length,
        summary,
        rows: safeRows,
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    success: true,
    type: "json",
    total_rows: safeRows.length,
    ...exportInfo,
  };
}

/* -------------------------------------------------------------------------- */
/* Domain Export Helpers                                                      */
/* -------------------------------------------------------------------------- */

async function exportPayments(payload = {}) {
  return exportExcel({
    rows: payload.rows || [],
    columns: payload.columns || [],
    fileName: payload.fileName || "payments",
    sheetName: "Payments",
    summary: payload.summary,
  });
}

async function exportDonations(payload = {}) {
  return exportExcel({
    rows: payload.rows || [],
    columns: payload.columns || [],
    fileName: payload.fileName || "donations",
    sheetName: "Donations",
    summary: payload.summary,
  });
}

async function exportReceipts(payload = {}) {
  return exportExcel({
    rows: payload.rows || [],
    columns: payload.columns || [],
    fileName: payload.fileName || "receipts",
    sheetName: "Receipts",
    summary: payload.summary,
  });
}

async function exportInvoices(payload = {}) {
  return exportExcel({
    rows: payload.rows || [],
    columns: payload.columns || [],
    fileName: payload.fileName || "invoices",
    sheetName: "Invoices",
    summary: payload.summary,
  });
}

async function exportMembers(payload = {}) {
  return exportExcel({
    rows: payload.rows || [],
    columns: payload.columns || [],
    fileName: payload.fileName || "members",
    sheetName: "Members",
    summary: payload.summary,
  });
}

async function exportPledges(payload = {}) {
  return exportExcel({
    rows: payload.rows || [],
    columns: payload.columns || [],
    fileName: payload.fileName || "pledges",
    sheetName: "Pledges",
    summary: payload.summary,
  });
}

async function exportProgramRegistrations(payload = {}) {
  return exportExcel({
    rows: payload.rows || [],
    columns: payload.columns || [],
    fileName: payload.fileName || "program-registrations",
    sheetName: "Program Registrations",
    summary: payload.summary,
  });
}

/* -------------------------------------------------------------------------- */
/* Maintenance                                                                */
/* -------------------------------------------------------------------------- */

async function cleanupExports(olderThanHours = 24) {
  ensureExportDir();

  const files = await fs.promises.readdir(EXPORT_DIR);
  const now = Date.now();

  let deleted = 0;

  for (const file of files) {
    try {
      const filePath = path.join(EXPORT_DIR, file);
      const stat = await fs.promises.stat(filePath);

      if (!stat.isFile()) continue;

      const ageHours = (now - stat.mtimeMs) / 1000 / 60 / 60;

      if (ageHours > Number(olderThanHours || 24)) {
        await fs.promises.unlink(filePath);
        deleted += 1;
      }
    } catch (err) {
      console.error("cleanupExports file error:", err.message);
    }
  }

  return {
    success: true,
    deleted,
  };
}

async function getExportStats() {
  ensureExportDir();

  const files = await fs.promises.readdir(EXPORT_DIR);

  let totalSize = 0;
  let totalFiles = 0;

  for (const file of files) {
    try {
      const stat = await fs.promises.stat(path.join(EXPORT_DIR, file));

      if (!stat.isFile()) continue;

      totalFiles += 1;
      totalSize += stat.size;
    } catch (_err) {}
  }

  return {
    total_files: totalFiles,
    total_size_bytes: totalSize,
    export_dir: EXPORT_DIR,
    public_base: EXPORT_PUBLIC_BASE,
  };
}

module.exports = {
  EXPORT_DIR,
  EXPORT_PUBLIC_BASE,

  ensureExportDir,
  safeFileName,
  createExportPath,

  exportCsv,
  exportExcel,
  exportMultiSheetExcel,
  exportJson,

  exportPayments,
  exportDonations,
  exportReceipts,
  exportInvoices,
  exportMembers,
  exportPledges,
  exportProgramRegistrations,

  cleanupExports,
  getExportStats,
};