// backend/routes/auditReports.js
"use strict";

const express = require("express");
const path = require("path");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const auditService = require("../services/domains/reports/auditTrailReportingService");

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "auditReports",
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

function normalizeReport(value) {
  const report = String(value || "all").trim().toLowerCase();

  if (
    [
      "all",
      "finance",
      "security",
      "failed-logins",
      "failed_logins",
      "suspicious",
      "user-activity",
      "user_activity",
    ].includes(report)
  ) {
    return report.replaceAll("_", "-");
  }

  return "all";
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
/* KPIs / Summaries                                                           */
/* -------------------------------------------------------------------------- */

router.get("/kpis", async (req, res) => {
  try {
    const kpis = await auditService.getAuditKpis(req.query);

    return res.json({
      ok: true,
      kpis,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load audit KPIs.");
  }
});

router.get("/summary", async (req, res) => {
  try {
    const [
      kpis,
      actions,
      finance,
      security,
      users,
    ] = await Promise.all([
      auditService.getAuditKpis(req.query),
      auditService.getAdminAuditSummary(req.query),
      auditService.getFinanceAuditSummary(req.query),
      auditService.getSecurityAuditSummary(req.query),
      auditService.getAdminUserActivity(req.query),
    ]);

    return res.json({
      ok: true,
      kpis,
      actions,
      finance,
      security,
      users,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return routeError(res, err, "Failed to load audit summary.");
  }
});

router.get("/actions", async (req, res) => {
  try {
    const rows = await auditService.getAdminAuditSummary(req.query);

    return res.json({
      ok: true,
      total: rows.length,
      rows,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load audit actions.");
  }
});

router.get("/users", async (req, res) => {
  try {
    const rows = await auditService.getAdminUserActivity(req.query);

    return res.json({
      ok: true,
      total: rows.length,
      rows,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load audit user activity.");
  }
});

/* -------------------------------------------------------------------------- */
/* Audit Logs                                                                 */
/* -------------------------------------------------------------------------- */

router.get("/", async (req, res) => {
  try {
    const rows = await auditService.getAuditLogs(req.query);

    return res.json({
      ok: true,
      total: rows.length,
      rows,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load audit logs.");
  }
});

router.get("/logs", async (req, res) => {
  try {
    const rows = await auditService.getAuditLogs(req.query);

    return res.json({
      ok: true,
      total: rows.length,
      rows,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load audit logs.");
  }
});

router.get("/finance", async (req, res) => {
  try {
    const rows = await auditService.getFinanceAuditReport(req.query);

    return res.json({
      ok: true,
      total: rows.length,
      rows,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load finance audit report.");
  }
});

router.get("/security", async (req, res) => {
  try {
    const rows = await auditService.getSecurityAuditReport(req.query);

    return res.json({
      ok: true,
      total: rows.length,
      rows,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load security audit report.");
  }
});

router.get("/failed-logins", async (req, res) => {
  try {
    const rows = await auditService.getFailedLoginReport(req.query);

    return res.json({
      ok: true,
      total: rows.length,
      rows,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load failed login report.");
  }
});

router.get("/suspicious", async (req, res) => {
  try {
    const rows = await auditService.getSuspiciousSecurityEvents(req.query);

    return res.json({
      ok: true,
      total: rows.length,
      rows,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load suspicious audit events.");
  }
});

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/export", async (req, res) => {
  try {
    const report = normalizeReport(req.query.report);
    const format = normalizeFormat(req.query.format);

    let exportReport = report;

    if (report === "failed-logins") {
      exportReport = "failed-logins";
    }

    if (report === "suspicious") {
      const rows = await auditService.getSuspiciousSecurityEvents({
        ...req.query,
        limit: req.query.limit || 5000,
      });

      const result =
        format === "csv"
          ? await require("../services/domains/export/exportService").exportCsv({
              rows,
              fileName: "suspicious-audit-events",
            })
          : format === "json"
            ? await require("../services/domains/export/exportService").exportJson({
                rows,
                fileName: "suspicious-audit-events",
                summary: {
                  total_rows: rows.length,
                  generated_at: new Date().toISOString(),
                },
              })
            : await require("../services/domains/export/exportService").exportExcel({
                rows,
                fileName: "suspicious-audit-events",
                sheetName: "Suspicious Audit",
                summary: {
                  total_rows: rows.length,
                  generated_at: new Date().toISOString(),
                },
              });

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
    }

    if (report === "user-activity") {
      const rows = await auditService.getAdminUserActivity(req.query);

      const result =
        format === "csv"
          ? await require("../services/domains/export/exportService").exportCsv({
              rows,
              fileName: "audit-user-activity",
            })
          : format === "json"
            ? await require("../services/domains/export/exportService").exportJson({
                rows,
                fileName: "audit-user-activity",
                summary: {
                  total_rows: rows.length,
                  generated_at: new Date().toISOString(),
                },
              })
            : await require("../services/domains/export/exportService").exportExcel({
                rows,
                fileName: "audit-user-activity",
                sheetName: "User Activity",
                summary: {
                  total_rows: rows.length,
                  generated_at: new Date().toISOString(),
                },
              });

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
    }

    const result = await auditService.exportAuditReport({
      report: exportReport,
      format,
      filters: req.query,
    });

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
    return routeError(res, err, "Failed to export audit report.");
  }
});

module.exports = router;