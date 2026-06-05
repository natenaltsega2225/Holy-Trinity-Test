// backend/services/domains/ai/aiInsightsService.js
"use strict";

const {

  getExecutiveDashboard,

} = require(
  "../analytics/analyticsDashboardService"
);

const {

  getFinanceDashboardSummary,

} = require(
  "../finance/financeDashboardService"
);

const {

  getReminderStats,

} = require(
  "../reminders/reminderService"
);

const {

  getSecuritySummary,

} = require(
  "../security/securityAuditService"
);

/* =========================================================
   HELPERS
========================================================= */

function money(
  value
) {

  return `$${Number(
    value || 0
  ).toFixed(2)}`;
}

/* =========================================================
   FINANCE INSIGHTS
========================================================= */

async function generateFinanceInsights() {

  const finance =
    await getFinanceDashboardSummary();

  const insights = [];

  /* =====================================
     TOTAL REVENUE
  ===================================== */

  if (
    finance?.kpis?.total_revenue
  ) {

    insights.push({

      type:
        "finance",

      severity:
        "info",

      title:
        "Revenue Summary",

      insight:
        `
        Total recorded revenue is
        ${money(
          finance.kpis.total_revenue
        )}.
        `.trim(),
    });
  }

  /* =====================================
     FAILED PAYMENTS
  ===================================== */

  if (
    finance?.kpis?.failed_payments >
    10
  ) {

    insights.push({

      type:
        "finance",

      severity:
        "warning",

      title:
        "Failed Payments Detected",

      insight:
        `
        There are
        ${finance.kpis.failed_payments}
        failed payments requiring review.
        `.trim(),
    });
  }

  return insights;
}

/* =========================================================
   EXECUTIVE INSIGHTS
========================================================= */

async function generateExecutiveInsights() {

  const dashboard =
    await getExecutiveDashboard();

  const insights = [];

  /* =====================================
     MEMBERSHIP GROWTH
  ===================================== */

  const growth =
    dashboard?.member_growth || [];

  if (
    growth.length >= 2
  ) {

    const latest =
      growth[
        growth.length - 1
      ];

    insights.push({

      type:
        "membership",

      severity:
        "success",

      title:
        "Membership Growth",

      insight:
        `
        Latest membership registrations:
        ${latest.registrations || 0}.
        `.trim(),
    });
  }

  /* =====================================
     DONATION INSIGHTS
  ===================================== */

  const donations =
    dashboard?.donations || [];

  if (
    donations.length
  ) {

    const top =
      donations[0];

    insights.push({

      type:
        "donation",

      severity:
        "info",

      title:
        "Top Donation Category",

      insight:
        `
        Highest donation category:
        ${top.sub_category || "Unknown"}.
        `.trim(),
    });
  }

  return insights;
}

/* =========================================================
   SECURITY INSIGHTS
========================================================= */

async function generateSecurityInsights() {

  const security =
    await getSecuritySummary();

  const insights = [];

  if (
    security.failed_logins >
    20
  ) {

    insights.push({

      type:
        "security",

      severity:
        "danger",

      title:
        "High Failed Login Activity",

      insight:
        `
        Failed logins exceed normal threshold.
        Review suspicious activity immediately.
        `.trim(),
    });
  }

  if (
    security.critical_events >
    0
  ) {

    insights.push({

      type:
        "security",

      severity:
        "warning",

      title:
        "Critical Security Events",

      insight:
        `
        Critical security events were detected.
        `.trim(),
    });
  }

  return insights;
}

/* =========================================================
   REMINDER INSIGHTS
========================================================= */

async function generateReminderInsights() {

  const reminders =
    await getReminderStats();

  const insights = [];

  if (
    reminders.failed >
    0
  ) {

    insights.push({

      type:
        "reminders",

      severity:
        "warning",

      title:
        "Reminder Failures",

      insight:
        `
        ${reminders.failed}
        reminders failed delivery.
        `.trim(),
    });
  }

  return insights;
}

/* =========================================================
   ANOMALY DETECTION
========================================================= */

async function detectAnomalies() {

  const anomalies = [];

  const finance =
    await getFinanceDashboardSummary();

  if (
    finance?.kpis?.largest_payment >
    10000
  ) {

    anomalies.push({

      type:
        "finance",

      severity:
        "warning",

      title:
        "Large Payment Detected",

      insight:
        `
        A payment exceeded expected threshold.
        `.trim(),
    });
  }

  return anomalies;
}

/* =========================================================
   EXECUTIVE AI SUMMARY
========================================================= */

async function generateExecutiveAiSummary() {

  const [

    finance,

    executive,

    security,

    reminders,

    anomalies,

  ] = await Promise.all([

    generateFinanceInsights(),

    generateExecutiveInsights(),

    generateSecurityInsights(),

    generateReminderInsights(),

    detectAnomalies(),
  ]);

  return {

    finance,

    executive,

    security,

    reminders,

    anomalies,

    generated_at:
      new Date()
        .toISOString(),
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  generateFinanceInsights,

  generateExecutiveInsights,

  generateSecurityInsights,

  generateReminderInsights,

  detectAnomalies,

  generateExecutiveAiSummary,
};