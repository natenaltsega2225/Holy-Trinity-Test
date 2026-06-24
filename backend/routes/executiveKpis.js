// backend/routes/executiveKpis.js
"use strict";

const express = require("express");
const path = require("path");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const executiveKpiService = require("../services/domains/reports/executiveKpiService");

const {
  exportExcel,
  exportCsv,
  exportJson,
} = require("../services/domains/export/exportService");

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "executiveKpis",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

router.use(authRequired);

router.use(
  requireRole(
    "finance",
    "admin",
    "super_admin",
    "reconciliation"
  )
);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeFormat(value) {
  const format = String(value || "xlsx").trim().toLowerCase();

  if (["xlsx", "csv", "json"].includes(format)) {
    return format;
  }

  return "xlsx";
}

function wantsDownload(req) {
  return ["1", "true", "yes", "download"].includes(
    String(req.query.download || "").toLowerCase()
  );
}

function routeError(res, err, fallback) {
  console.error(fallback, err);

  return res.status(err.status || err.statusCode || 500).json({
    ok: false,
    error: err.status || err.statusCode ? err.message : fallback,
  });
}

/* -------------------------------------------------------------------------- */
/* Main Dashboard                                                             */
/* -------------------------------------------------------------------------- */

router.get("/", async (req, res) => {
  try {
    const kpis = await executiveKpiService.getExecutiveKpis(req.query);

    return res.json({
      ok: true,
      kpis,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load executive KPIs.");
  }
});

router.get("/summary", async (req, res) => {
  try {
    const kpis = await executiveKpiService.getExecutiveKpis(req.query);

    return res.json({
      ok: true,
      kpis,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load executive KPI summary.");
  }
});

router.get("/cards", async (req, res) => {
  try {
    const kpis = await executiveKpiService.getExecutiveKpis(req.query);

    return res.json({
      ok: true,
      cards: kpis.cards,
      generated_at: kpis.generated_at,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load executive KPI cards.");
  }
});

/* -------------------------------------------------------------------------- */
/* Section Endpoints                                                          */
/* -------------------------------------------------------------------------- */

router.get("/revenue", async (req, res) => {
  try {
    const revenue = await executiveKpiService.getRevenueKpis(req.query);

    return res.json({
      ok: true,
      revenue,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load revenue KPIs.");
  }
});

router.get("/members", async (req, res) => {
  try {
    const members = await executiveKpiService.getMemberKpis(req.query);

    return res.json({
      ok: true,
      members,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load member KPIs.");
  }
});

router.get("/invoices", async (_req, res) => {
  try {
    const invoices = await executiveKpiService.getInvoiceKpis();

    return res.json({
      ok: true,
      invoices,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load invoice KPIs.");
  }
});

router.get("/pledges", async (_req, res) => {
  try {
    const pledges = await executiveKpiService.getPledgeKpis();

    return res.json({
      ok: true,
      pledges,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load pledge KPIs.");
  }
});

router.get("/programs", async (req, res) => {
  try {
    const programs = await executiveKpiService.getProgramKpis(req.query);

    return res.json({
      ok: true,
      programs,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load program KPIs.");
  }
});

router.get("/emails", async (_req, res) => {
  try {
    const emails = await executiveKpiService.getEmailTrackingKpis();

    return res.json({
      ok: true,
      emails,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load email KPIs.");
  }
});

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/export", async (req, res) => {
  try {
    const format = normalizeFormat(req.query.format);
    const kpis = await executiveKpiService.getExecutiveKpis(req.query);
    const rows = executiveKpiService.flattenForExport(kpis);

    let result;

    if (format === "csv") {
      result = await exportCsv({
        rows,
        fileName: "executive-kpis",
      });
    } else if (format === "json") {
      result = await exportJson({
        rows,
        fileName: "executive-kpis",
        summary: {
          generated_at: kpis.generated_at,
          date_from: kpis.filters?.date_from || "",
          date_to: kpis.filters?.date_to || "",
        },
      });
    } else {
      result = await exportExcel({
        rows,
        fileName: "executive-kpis",
        sheetName: "Executive KPIs",
        summary: {
          generated_at: kpis.generated_at,
          date_from: kpis.filters?.date_from || "",
          date_to: kpis.filters?.date_to || "",
        },
      });
    }

    if (wantsDownload(req) && result.file_path) {
      return res.download(
        path.resolve(result.file_path),
        result.file_name || path.basename(result.file_path)
      );
    }

    return res.json({
      ok: true,
      export: result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to export executive KPIs.");
  }
});

module.exports = router;