// backend/services/domains/reports/auditTrailReportingService.js
"use strict";

const pool =
  require("../../../db");

const {

  findOne,

  findMany,

} = require(
  "../../../utils/dbHelpers"
);

const {

  exportExcel,

  exportCsv,

} = require(
  "../export/exportService"
);

/* =========================================================
   ADMIN AUDIT SUMMARY
========================================================= */

async function getAdminAuditSummary() {

  return findMany(

    pool,

    `
    SELECT

      action,

      COUNT(*) AS total_actions

    FROM tbl_admin_audit_logs

    GROUP BY action

    ORDER BY total_actions DESC
    `,

    []
  );
}

/* =========================================================
   SECURITY AUDIT SUMMARY
========================================================= */

async function getSecurityAuditSummary() {

  return findMany(

    pool,

    `
    SELECT

      event_type,

      severity,

      COUNT(*) AS total_events

    FROM tbl_security_audit_logs

    GROUP BY
      event_type,
      severity

    ORDER BY total_events DESC
    `,

    []
  );
}

/* =========================================================
   FAILED LOGIN REPORT
========================================================= */

async function getFailedLoginReport() {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_security_audit_logs

    WHERE event_type = 'login_failed'

    ORDER BY created_at DESC
    `,

    []
  );
}

/* =========================================================
   ADMIN USER ACTIVITY
========================================================= */

async function getAdminUserActivity() {

  return findMany(

    pool,

    `
    SELECT

      actor_id,

      actor_name,

      COUNT(*) AS total_actions

    FROM tbl_admin_audit_logs

    GROUP BY
      actor_id,
      actor_name

    ORDER BY total_actions DESC
    `,

    []
  );
}

/* =========================================================
   FINANCE AUDIT REPORT
========================================================= */

async function getFinanceAuditReport() {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_admin_audit_logs

    WHERE entity_type IN (

      'payment',

      'invoice',

      'receipt',

      'reconciliation'

    )

    ORDER BY created_at DESC
    `,

    []
  );
}

/* =========================================================
   SUSPICIOUS SECURITY EVENTS
========================================================= */

async function getSuspiciousSecurityEvents() {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_security_audit_logs

    WHERE severity IN (

      'critical',

      'warning'

    )

    ORDER BY created_at DESC
    `,

    []
  );
}

/* =========================================================
   AUDIT KPI SUMMARY
========================================================= */

async function getAuditKpis() {

  const [

    adminLogs,

    securityLogs,

    failedLogins,

  ] = await Promise.all([

    findOne(

      pool,

      `
      SELECT COUNT(*) AS total
      FROM tbl_admin_audit_logs
      `,

      []
    ),

    findOne(

      pool,

      `
      SELECT COUNT(*) AS total
      FROM tbl_security_audit_logs
      `,

      []
    ),

    findOne(

      pool,

      `
      SELECT COUNT(*) AS total
      FROM tbl_security_audit_logs
      WHERE event_type = 'login_failed'
      `,

      []
    ),
  ]);

  return {

    admin_logs:
      Number(
        adminLogs?.total || 0
      ),

    security_logs:
      Number(
        securityLogs?.total || 0
      ),

    failed_logins:
      Number(
        failedLogins?.total || 0
      ),
  };
}

/* =========================================================
   EXPORT ADMIN AUDIT
========================================================= */

async function exportAdminAuditReport(
  format = "xlsx"
) {

  const rows =
    await findMany(

      pool,

      `
      SELECT *

      FROM tbl_admin_audit_logs

      ORDER BY created_at DESC
      `,

      []
    );

  if (
    format === "csv"
  ) {

    return exportCsv({

      rows,

      fileName:
        "admin-audit-report",
    });
  }

  return exportExcel({

    rows,

    fileName:
      "admin-audit-report",

    sheetName:
      "Admin Audit",
    summary: {

      total_logs:
        rows.length,
    },
  });
}

/* =========================================================
   EXPORT SECURITY AUDIT
========================================================= */

async function exportSecurityAuditReport(
  format = "xlsx"
) {

  const rows =
    await findMany(

      pool,

      `
      SELECT *

      FROM tbl_security_audit_logs

      ORDER BY created_at DESC
      `,

      []
    );

  if (
    format === "csv"
  ) {

    return exportCsv({

      rows,

      fileName:
        "security-audit-report",
    });
  }

  return exportExcel({

    rows,

    fileName:
      "security-audit-report",

    sheetName:
      "Security Audit",
    summary: {

      total_logs:
        rows.length,
    },
  });
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  getAdminAuditSummary,

  getSecurityAuditSummary,

  getFailedLoginReport,

  getAdminUserActivity,

  getFinanceAuditReport,

  getSuspiciousSecurityEvents,

  getAuditKpis,

  exportAdminAuditReport,

  exportSecurityAuditReport,
};