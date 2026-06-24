// backend/services/domains/ai/aiInsightsService.js
"use strict";

/* -------------------------------------------------------------------------- */
/* Safe Service Loading                                                       */
/* -------------------------------------------------------------------------- */

function optionalRequire(label, path) {
  try {
    return require(path);
  } catch (err) {
    console.warn(`AI insights dependency not loaded: ${label}`, err.message);
    return {};
  }
}

function getFinanceService() {
  return optionalRequire(
    "financeDashboardService",
    "../finance/financeDashboardService"
  );
}

function getAnalyticsService() {
  return optionalRequire(
    "analyticsDashboardService",
    "../analytics/analyticsDashboardService"
  );
}

function getReminderService() {
  const notificationReminder = optionalRequire(
    "notifications/reminderService",
    "../notifications/reminderService"
  );

  if (typeof notificationReminder.getReminderStats === "function") {
    return notificationReminder;
  }

  return optionalRequire(
    "reminders/reminderService",
    "../reminders/reminderService"
  );
}

function getNotificationService() {
  return optionalRequire(
    "notificationService",
    "../notifications/notificationService"
  );
}

function getSecurityService() {
  const securityService = optionalRequire(
    "securityAuditService",
    "../security/securityAuditService"
  );

  if (typeof securityService.getSecuritySummary === "function") {
    return securityService;
  }

  return optionalRequire(
    "auditTrailReportingService",
    "../reports/auditTrailReportingService"
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function formatMoney(value) {
  return money(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function percent(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? `${Math.round(n * 10) / 10}%` : "0%";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

async function safeCall(label, fn, fallback) {
  try {
    if (typeof fn !== "function") return fallback;
    return await fn();
  } catch (err) {
    console.error(`AI insight source failed: ${label}`, err);
    return fallback;
  }
}

function normalizeFilters(filters = {}) {
  return {
    period: clean(filters.period || "all", 40),
    date_from: clean(filters.date_from || filters.from, 40) || null,
    date_to: clean(filters.date_to || filters.to, 40) || null,
    limit: Math.min(100, Math.max(1, Number(filters.limit || 25))),
  };
}

function severityRank(severity) {
  const ranks = {
    danger: 10,
    critical: 10,
    warning: 8,
    success: 4,
    info: 3,
    neutral: 1,
  };

  return ranks[clean(severity, 40).toLowerCase()] || 1;
}

function createInsight({
  id,
  type,
  severity = "info",
  title,
  insight,
  metric = null,
  recommendation = null,
  actions = [],
  confidence = 0.85,
  priority = 50,
  source = "rules_engine",
}) {
  return {
    id: clean(id, 120),
    type: clean(type || "general", 80),
    severity: clean(severity || "info", 40),
    title: clean(title, 180),
    insight: clean(insight, 1000),
    metric,
    recommendation: recommendation ? clean(recommendation, 1000) : null,
    actions: safeArray(actions),
    confidence: Math.min(1, Math.max(0, Number(confidence || 0.85))),
    priority: Number(priority || 50),
    source,
    generated_at: new Date().toISOString(),
  };
}

function sortInsights(rows = []) {
  return safeArray(rows)
    .filter((row) => row && row.title && row.insight)
    .sort((a, b) => {
      const severityDiff = severityRank(b.severity) - severityRank(a.severity);
      if (severityDiff !== 0) return severityDiff;

      return Number(a.priority || 50) - Number(b.priority || 50);
    });
}

/* -------------------------------------------------------------------------- */
/* Finance Insights                                                           */
/* -------------------------------------------------------------------------- */

async function generateFinanceInsights(filters = {}) {
  const normalized = normalizeFilters(filters);
  const financeService = getFinanceService();

  const finance = await safeCall(
    "finance dashboard summary",
    () => financeService.getFinanceDashboardSummary?.(normalized),
    {}
  );

  const kpis = finance.kpis || {};
  const pledges = finance.pledges || {};
  const invoices = finance.overdue_invoices || {};
  const receiptEmails = finance.receipt_emails || {};

  const insights = [];

  if (numberValue(kpis.total_revenue) > 0) {
    insights.push(
      createInsight({
        id: "finance-revenue-summary",
        type: "finance",
        severity: "success",
        title: "Revenue Summary",
        insight: `Total recorded revenue is ${formatMoney(kpis.total_revenue)} across ${numberValue(kpis.total_transactions)} payment records.`,
        metric: {
          total_revenue: money(kpis.total_revenue),
          total_transactions: numberValue(kpis.total_transactions),
        },
        recommendation:
          "Review category and method breakdowns weekly to confirm all manual and online payments are reconciled.",
        priority: 20,
      })
    );
  }

  if (numberValue(kpis.month_revenue) <= 0) {
    insights.push(
      createInsight({
        id: "finance-no-month-revenue",
        type: "finance",
        severity: "warning",
        title: "No Monthly Revenue Recorded",
        insight:
          "No revenue has been recorded for the current month in the finance dashboard.",
        recommendation:
          "Confirm Stripe webhooks, manual entries, and receipt generation are working before month-end reporting.",
        actions: [
          {
            label: "Open Payments",
            to: "/dash/finance/payments",
          },
        ],
        priority: 15,
      })
    );
  }

  if (numberValue(invoices.total_balance_due || invoices.open_balance_due) > 0) {
    insights.push(
      createInsight({
        id: "finance-outstanding-invoices",
        type: "invoices",
        severity: "warning",
        title: "Outstanding Invoice Balance",
        insight: `There is ${formatMoney(invoices.total_balance_due || invoices.open_balance_due)} in outstanding invoice balance.`,
        metric: {
          open_invoices: numberValue(invoices.open_invoices || invoices.invoices),
          balance_due: money(invoices.total_balance_due || invoices.open_balance_due),
        },
        recommendation:
          "Send invoice reminders with payment links and review overdue invoices with the finance team.",
        actions: [
          {
            label: "View Invoices",
            to: "/dash/finance/invoices",
          },
        ],
        priority: 10,
      })
    );
  }

  if (numberValue(pledges.outstanding_amount) > 0) {
    insights.push(
      createInsight({
        id: "finance-outstanding-pledges",
        type: "pledges",
        severity: numberValue(pledges.overdue_pledges) > 0 ? "warning" : "info",
        title: "Outstanding Pledge Balance",
        insight: `Outstanding pledge balance is ${formatMoney(pledges.outstanding_amount)} across ${numberValue(pledges.active_pledges)} active pledges.`,
        metric: {
          active_pledges: numberValue(pledges.active_pledges),
          overdue_pledges: numberValue(pledges.overdue_pledges),
          outstanding_amount: money(pledges.outstanding_amount),
        },
        recommendation:
          "Use pledge reminders with invoice payment links for both members and guest donors.",
        actions: [
          {
            label: "View Pledges",
            to: "/dash/finance/pledges",
          },
        ],
        priority: 12,
      })
    );
  }

  if (numberValue(receiptEmails.failed || kpis.receipt_emails_failed) > 0) {
    insights.push(
      createInsight({
        id: "finance-receipt-email-failures",
        type: "receipts",
        severity: "warning",
        title: "Receipt Email Failures",
        insight: `${numberValue(receiptEmails.failed || kpis.receipt_emails_failed)} receipt emails failed delivery.`,
        recommendation:
          "Review failed receipt emails, confirm recipient addresses, and resend from the receipt center.",
        actions: [
          {
            label: "Open Receipt Center",
            to: "/dash/finance/receipts",
          },
        ],
        priority: 8,
      })
    );
  }

  return sortInsights(insights);
}

/* -------------------------------------------------------------------------- */
/* Executive Insights                                                         */
/* -------------------------------------------------------------------------- */

async function generateExecutiveInsights(filters = {}) {
  const normalized = normalizeFilters(filters);
  const analyticsService = getAnalyticsService();

  const dashboard = await safeCall(
    "executive dashboard",
    () => analyticsService.getExecutiveDashboard?.(normalized),
    {}
  );

  const insights = [];

  const revenue = dashboard.revenue || {};
  const membership = dashboard.membership || {};
  const growth = safeArray(dashboard.member_growth);
  const donations = safeArray(dashboard.donations);
  const programs = safeArray(dashboard.events);
  const invoices = dashboard.invoices || {};
  const pledges = dashboard.pledges || {};

  if (numberValue(revenue.year_revenue || revenue.total_revenue) > 0) {
    insights.push(
      createInsight({
        id: "executive-revenue-health",
        type: "executive",
        severity: "success",
        title: "Executive Revenue Health",
        insight: `Year-to-date revenue is ${formatMoney(revenue.year_revenue || revenue.total_revenue)}.`,
        metric: {
          year_revenue: money(revenue.year_revenue || revenue.total_revenue),
          average_payment: money(revenue.average_payment),
        },
        recommendation:
          "Compare revenue by payment method and category before monthly finance review.",
        priority: 25,
      })
    );
  }

  if (growth.length >= 1) {
    const latest = growth[growth.length - 1];

    insights.push(
      createInsight({
        id: "executive-member-growth",
        type: "membership",
        severity: "info",
        title: "Membership Growth",
        insight: `Latest membership registration period shows ${numberValue(latest.registrations)} new registration(s).`,
        metric: {
          month_key: latest.month_key,
          registrations: numberValue(latest.registrations),
        },
        recommendation:
          "Confirm each new member received welcome email, username, temporary password, invoice, and receipt.",
        priority: 30,
      })
    );
  }

  if (numberValue(membership.pending_members) > 0) {
    insights.push(
      createInsight({
        id: "executive-pending-members",
        type: "membership",
        severity: "warning",
        title: "Pending Member Registrations",
        insight: `${numberValue(membership.pending_members)} member registration(s) are pending payment or activation.`,
        recommendation:
          "Follow up on pending Stripe checkouts and manually verify staff-assisted registrations.",
        actions: [
          {
            label: "Open Members",
            to: "/dash/finance/members",
          },
        ],
        priority: 9,
      })
    );
  }

  if (donations.length) {
    const top = donations[0];

    insights.push(
      createInsight({
        id: "executive-top-donation-category",
        type: "donation",
        severity: "info",
        title: "Top Donation Category",
        insight: `Highest donation category is ${top.sub_category || "General Donation"} with ${formatMoney(top.total_amount)} recorded.`,
        metric: {
          category: top.sub_category || "general_donation",
          amount: money(top.total_amount),
        },
        recommendation:
          "Use this trend in finance reports and donor stewardship summaries.",
        priority: 35,
      })
    );
  }

  if (programs.length) {
    const topProgram = programs[0];

    insights.push(
      createInsight({
        id: "executive-program-revenue",
        type: "programs",
        severity: "info",
        title: "Program Revenue",
        insight: `${topProgram.category || "Program"} currently leads program revenue with ${formatMoney(topProgram.revenue)}.`,
        metric: {
          category: topProgram.category,
          registrations: numberValue(topProgram.registrations),
          revenue: money(topProgram.revenue),
        },
        recommendation:
          "Review school and trip registration pricing tiers to ensure every participant is billed correctly.",
        priority: 40,
      })
    );
  }

  if (numberValue(invoices.overdue_invoices) > 0) {
    insights.push(
      createInsight({
        id: "executive-overdue-invoices",
        type: "invoices",
        severity: "warning",
        title: "Overdue Invoices",
        insight: `${numberValue(invoices.overdue_invoices)} invoice(s) are overdue.`,
        recommendation:
          "Send reminders with payment links and review unresolved balances before reporting close.",
        priority: 7,
      })
    );
  }

  if (numberValue(pledges.overdue_pledges) > 0) {
    insights.push(
      createInsight({
        id: "executive-overdue-pledges",
        type: "pledges",
        severity: "warning",
        title: "Overdue Pledges",
        insight: `${numberValue(pledges.overdue_pledges)} pledge(s) are overdue.`,
        recommendation:
          "Trigger pledge reminder emails and confirm guest donor contact information.",
        priority: 7,
      })
    );
  }

  return sortInsights(insights);
}

/* -------------------------------------------------------------------------- */
/* Security Insights                                                          */
/* -------------------------------------------------------------------------- */

async function generateSecurityInsights(filters = {}) {
  const normalized = normalizeFilters(filters);
  const securityService = getSecurityService();

  const security = await safeCall(
    "security summary",
    () =>
      securityService.getSecuritySummary?.(normalized) ||
      securityService.getSecurityAuditSummary?.(normalized),
    {}
  );

  const insights = [];

  const failedLogins = numberValue(
    security.failed_logins ||
      security.failed_login_count ||
      security.login_failures
  );

  const criticalEvents = numberValue(
    security.critical_events ||
      security.critical_count
  );

  const suspiciousEvents = numberValue(
    security.suspicious_events ||
      security.suspicious_count
  );

  if (failedLogins > 20) {
    insights.push(
      createInsight({
        id: "security-high-failed-logins",
        type: "security",
        severity: "danger",
        title: "High Failed Login Activity",
        insight: `${failedLogins} failed login event(s) were detected.`,
        recommendation:
          "Review suspicious IP addresses, confirm account lockout behavior, and check admin login attempts.",
        actions: [
          {
            label: "View Audit Reports",
            to: "/dash/admin/audit-reports",
          },
        ],
        priority: 1,
      })
    );
  }

  if (criticalEvents > 0) {
    insights.push(
      createInsight({
        id: "security-critical-events",
        type: "security",
        severity: "danger",
        title: "Critical Security Events",
        insight: `${criticalEvents} critical security event(s) were detected.`,
        recommendation:
          "Review the audit trail immediately and verify no unauthorized finance action occurred.",
        priority: 2,
      })
    );
  }

  if (suspiciousEvents > 0) {
    insights.push(
      createInsight({
        id: "security-suspicious-events",
        type: "security",
        severity: "warning",
        title: "Suspicious Activity",
        insight: `${suspiciousEvents} suspicious audit event(s) require review.`,
        recommendation:
          "Check user, IP address, action type, and timestamp for each suspicious event.",
        priority: 5,
      })
    );
  }

  if (!insights.length) {
    insights.push(
      createInsight({
        id: "security-normal",
        type: "security",
        severity: "success",
        title: "Security Activity Normal",
        insight: "No high-risk security signals were found in the current summary.",
        recommendation:
          "Continue reviewing audit reports during finance close and user access changes.",
        priority: 80,
      })
    );
  }

  return sortInsights(insights);
}

/* -------------------------------------------------------------------------- */
/* Reminder / Notification Insights                                           */
/* -------------------------------------------------------------------------- */

async function generateReminderInsights(filters = {}) {
  const normalized = normalizeFilters(filters);
  const reminderService = getReminderService();
  const notificationService = getNotificationService();

  const reminders = await safeCall(
    "reminder stats",
    () => reminderService.getReminderStats?.(normalized),
    {}
  );

  const notifications = await safeCall(
    "notification stats",
    () => notificationService.getNotificationStats?.(normalized),
    {}
  );

  const insights = [];

  const failedReminders = numberValue(reminders.failed);
  const queuedReminders = numberValue(reminders.queued || reminders.pending);
  const failedNotifications = numberValue(notifications.failed);

  if (failedReminders > 0) {
    insights.push(
      createInsight({
        id: "reminder-failures",
        type: "reminders",
        severity: "warning",
        title: "Reminder Failures",
        insight: `${failedReminders} reminder(s) failed delivery.`,
        recommendation:
          "Review failed reminder rows, confirm email addresses, and retry delivery.",
        priority: 10,
      })
    );
  }

  if (queuedReminders > 50) {
    insights.push(
      createInsight({
        id: "reminder-queue-high",
        type: "reminders",
        severity: "warning",
        title: "Reminder Queue Is Growing",
        insight: `${queuedReminders} reminder(s) are queued or pending.`,
        recommendation:
          "Confirm scheduled jobs are running and email transporter is healthy.",
        priority: 12,
      })
    );
  }

  if (failedNotifications > 0) {
    insights.push(
      createInsight({
        id: "notification-failures",
        type: "notifications",
        severity: "warning",
        title: "Notification Failures",
        insight: `${failedNotifications} notification(s) failed delivery.`,
        recommendation:
          "Review notification logs and retry failed finance, invoice, receipt, and pledge emails.",
        priority: 11,
      })
    );
  }

  return sortInsights(insights);
}

/* -------------------------------------------------------------------------- */
/* Anomaly Detection                                                          */
/* -------------------------------------------------------------------------- */

async function detectAnomalies(filters = {}) {
  const normalized = normalizeFilters(filters);
  const financeService = getFinanceService();
  const analyticsService = getAnalyticsService();

  const [finance, executive] = await Promise.all([
    safeCall(
      "finance dashboard anomaly source",
      () => financeService.getFinanceDashboardSummary?.(normalized),
      {}
    ),
    safeCall(
      "executive dashboard anomaly source",
      () => analyticsService.getExecutiveDashboard?.(normalized),
      {}
    ),
  ]);

  const anomalies = [];
  const kpis = finance.kpis || {};
  const revenue = executive.revenue || {};

  const largestPayment = numberValue(revenue.largest_payment);
  const averagePayment = numberValue(revenue.average_payment);

  if (largestPayment >= 10000) {
    anomalies.push(
      createInsight({
        id: "anomaly-large-payment",
        type: "finance",
        severity: "warning",
        title: "Large Payment Detected",
        insight: `A payment of ${formatMoney(largestPayment)} exceeded the review threshold.`,
        metric: {
          largest_payment: money(largestPayment),
        },
        recommendation:
          "Verify the payment source, receipt, invoice, card/ACH reference, and reconciliation status.",
        priority: 4,
      })
    );
  }

  if (averagePayment > 0 && largestPayment >= averagePayment * 5) {
    anomalies.push(
      createInsight({
        id: "anomaly-payment-outlier",
        type: "finance",
        severity: "warning",
        title: "Payment Outlier",
        insight: `Largest payment is more than five times the average payment of ${formatMoney(averagePayment)}.`,
        recommendation:
          "Review this transaction for correct category, donor, campaign, and receipt allocation.",
        priority: 6,
      })
    );
  }

  if (
    numberValue(kpis.cash_total) > 0 &&
    numberValue(kpis.cash_total) > numberValue(kpis.card_total) + numberValue(kpis.ach_total)
  ) {
    anomalies.push(
      createInsight({
        id: "anomaly-cash-heavy",
        type: "finance",
        severity: "info",
        title: "Cash Payments Are High",
        insight: `Cash revenue is ${formatMoney(kpis.cash_total)}, higher than online card/ACH revenue for this period.`,
        recommendation:
          "Confirm cash batches, staff recorder, receipt issuance, and reconciliation records are complete.",
        priority: 45,
      })
    );
  }

  return sortInsights(anomalies);
}

/* -------------------------------------------------------------------------- */
/* Executive AI Summary                                                       */
/* -------------------------------------------------------------------------- */

async function generateExecutiveAiSummary(filters = {}) {
  const normalized = normalizeFilters(filters);

  const [
    finance,
    executive,
    security,
    reminders,
    anomalies,
  ] = await Promise.all([
    generateFinanceInsights(normalized),
    generateExecutiveInsights(normalized),
    generateSecurityInsights(normalized),
    generateReminderInsights(normalized),
    detectAnomalies(normalized),
  ]);

  const all = sortInsights([
    ...finance,
    ...executive,
    ...security,
    ...reminders,
    ...anomalies,
  ]);

  return {
    ok: true,
    engine: "enterprise_rules_ai",
    period: normalized.period,
    date_from: normalized.date_from,
    date_to: normalized.date_to,

    counts: {
      total: all.length,
      danger: all.filter((row) => ["danger", "critical"].includes(row.severity)).length,
      warning: all.filter((row) => row.severity === "warning").length,
      info: all.filter((row) => row.severity === "info").length,
      success: all.filter((row) => row.severity === "success").length,
    },

    finance,
    executive,
    security,
    reminders,
    anomalies,
    all,

    generated_at: new Date().toISOString(),
  };
}

async function getAiInsights(filters = {}) {
  return generateExecutiveAiSummary(filters);
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

module.exports = {
  createInsight,

  generateFinanceInsights,
  generateExecutiveInsights,
  generateSecurityInsights,
  generateReminderInsights,
  detectAnomalies,

  generateExecutiveAiSummary,
  getAiInsights,
};