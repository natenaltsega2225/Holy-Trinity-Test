// backend/services/domains/dashboard/dashboardWidgetService.js
"use strict";

const WIDGET_TYPES = Object.freeze({
  KPI: "kpi",
  CHART: "chart",
  TABLE: "table",
  ACTIVITY: "activity",
  SUMMARY: "summary",
  ALERT: "alert",
  ACTIONS: "actions",
});

const WIDGET_SIZES = Object.freeze({
  SM: "sm",
  MD: "md",
  LG: "lg",
  XL: "xl",
  FULL: "full",
});

/* -------------------------------------------------------------------------- */
/* Safe Require                                                               */
/* -------------------------------------------------------------------------- */

function optionalRequire(label, path) {
  try {
    return require(path);
  } catch (err) {
    console.warn(`Dashboard dependency not loaded: ${label}`, err.message);
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

function roleKey(role) {
  return clean(role, 80).toLowerCase();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

async function safeCall(label, fn, fallback) {
  try {
    if (typeof fn !== "function") return fallback;
    return await fn();
  } catch (err) {
    console.error(`Dashboard widget load failed: ${label}`, err);
    return fallback;
  }
}

function createWidget({
  id,
  title,
  type,
  size = WIDGET_SIZES.MD,
  data = null,
  meta = {},
  actions = [],
  priority = 50,
  refresh_seconds = 300,
  empty_state = null,
}) {
  return {
    id: clean(id, 120),
    title: clean(title, 180),
    type,
    size,
    priority,
    refresh_seconds,
    data,
    meta,
    actions,
    empty_state,
  };
}

function createKpi(label, value, options = {}) {
  return {
    label,
    value,
    format: options.format || "number",
    tone: options.tone || "default",
    helper: options.helper || null,
    delta: options.delta || null,
  };
}

function normalizeFilters(payload = {}) {
  return {
    period: clean(payload.period || "all", 40),
    date_from: clean(payload.date_from || payload.from, 40) || null,
    date_to: clean(payload.date_to || payload.to, 40) || null,
    limit: Math.min(100, Math.max(1, Number(payload.limit || 10))),
  };
}

function sortWidgets(widgets = []) {
  return widgets
    .filter(Boolean)
    .sort((a, b) => Number(a.priority || 50) - Number(b.priority || 50));
}

/* -------------------------------------------------------------------------- */
/* Admin Dashboard                                                            */
/* -------------------------------------------------------------------------- */

async function getAdminDashboardWidgets(payload = {}) {
  const filters = normalizeFilters(payload);

  const financeService = getFinanceService();
  const analyticsService = getAnalyticsService();
  const reminderService = getReminderService();
  const notificationService = getNotificationService();
  const securityService = getSecurityService();

  const [finance, executive, reminders, notifications, security] =
    await Promise.all([
      safeCall(
        "finance summary",
        () => financeService.getFinanceDashboardSummary?.(filters),
        {}
      ),
      safeCall(
        "executive dashboard",
        () => analyticsService.getExecutiveDashboard?.(filters),
        {}
      ),
      safeCall(
        "reminder stats",
        () => reminderService.getReminderStats?.(filters),
        {}
      ),
      safeCall(
        "notification stats",
        () => notificationService.getNotificationStats?.(filters),
        {}
      ),
      safeCall(
        "security summary",
        () =>
          securityService.getSecuritySummary?.(filters) ||
          securityService.getSecurityAuditSummary?.(filters),
        {}
      ),
    ]);

  const revenue = executive.revenue || finance.kpis || {};
  const membership = executive.membership || finance.members || {};
  const invoices = executive.invoices || finance.overdue_invoices || {};
  const pledges = executive.pledges || finance.pledges || {};

  return sortWidgets([
    createWidget({
      id: "admin-executive-kpis",
      title: "Executive KPIs",
      type: WIDGET_TYPES.KPI,
      size: WIDGET_SIZES.XL,
      priority: 10,
      data: [
        createKpi("Year Revenue", money(revenue.year_revenue || revenue.total_revenue), {
          format: "currency",
          tone: "success",
        }),
        createKpi("Active Members", numberValue(membership.active_members), {
          tone: "primary",
        }),
        createKpi("Outstanding Invoices", money(invoices.total_balance_due), {
          format: "currency",
          tone: "warning",
        }),
        createKpi("Outstanding Pledges", money(pledges.outstanding_amount), {
          format: "currency",
          tone: "warning",
        }),
      ],
      meta: {
        generated_at: executive.generated_at || finance.generated_at || new Date().toISOString(),
      },
    }),

    createWidget({
      id: "admin-revenue-trend",
      title: "Revenue Trend",
      type: WIDGET_TYPES.CHART,
      size: WIDGET_SIZES.LG,
      priority: 20,
      data: safeArray(executive.monthly_revenue || finance.monthly),
      meta: {
        chart: "line",
        x_key: "month_key",
        y_key: "total_amount",
      },
    }),

    createWidget({
      id: "admin-payment-methods",
      title: "Payment Methods",
      type: WIDGET_TYPES.CHART,
      size: WIDGET_SIZES.LG,
      priority: 30,
      data: safeArray(executive.payment_methods || finance.methods),
      meta: {
        chart: "donut",
        label_key: "method",
        value_key: "total_amount",
      },
    }),

    createWidget({
      id: "admin-membership",
      title: "Membership",
      type: WIDGET_TYPES.SUMMARY,
      size: WIDGET_SIZES.MD,
      priority: 40,
      data: membership,
    }),

    createWidget({
      id: "admin-notifications",
      title: "Notifications",
      type: WIDGET_TYPES.SUMMARY,
      size: WIDGET_SIZES.MD,
      priority: 50,
      data: notifications,
    }),

    createWidget({
      id: "admin-reminders",
      title: "Reminders",
      type: WIDGET_TYPES.SUMMARY,
      size: WIDGET_SIZES.MD,
      priority: 60,
      data: reminders,
    }),

    createWidget({
      id: "admin-security",
      title: "Security Summary",
      type: WIDGET_TYPES.ALERT,
      size: WIDGET_SIZES.MD,
      priority: 70,
      data: security,
    }),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Finance Dashboard                                                          */
/* -------------------------------------------------------------------------- */

async function getFinanceDashboardWidgets(payload = {}) {
  const filters = normalizeFilters(payload);
  const financeService = getFinanceService();

  const finance = await safeCall(
    "finance dashboard",
    () => financeService.getFinanceDashboardSummary?.(filters),
    {}
  );

  const kpis = finance.kpis || {};
  const pledges = finance.pledges || {};
  const invoices = finance.overdue_invoices || {};
  const members = finance.members || {};

  return sortWidgets([
    createWidget({
      id: "finance-kpis",
      title: "Finance KPIs",
      type: WIDGET_TYPES.KPI,
      size: WIDGET_SIZES.XL,
      priority: 10,
      data: [
        createKpi("Today Revenue", money(kpis.today_revenue), {
          format: "currency",
          tone: "success",
        }),
        createKpi("Month Revenue", money(kpis.month_revenue), {
          format: "currency",
          tone: "success",
        }),
        createKpi("Year Revenue", money(kpis.year_revenue), {
          format: "currency",
          tone: "success",
        }),
        createKpi("Transactions", numberValue(kpis.total_transactions), {
          tone: "primary",
        }),
      ],
      meta: {
        period: finance.period,
        generated_at: finance.generated_at,
      },
    }),

    createWidget({
      id: "finance-revenue-by-category",
      title: "Revenue By Category",
      type: WIDGET_TYPES.TABLE,
      size: WIDGET_SIZES.LG,
      priority: 20,
      data: safeArray(finance.categories),
    }),

    createWidget({
      id: "finance-payment-methods",
      title: "Payment Methods",
      type: WIDGET_TYPES.CHART,
      size: WIDGET_SIZES.LG,
      priority: 30,
      data: safeArray(finance.methods),
      meta: {
        chart: "bar",
        label_key: "method",
        value_key: "total_amount",
      },
    }),

    createWidget({
      id: "finance-monthly-revenue",
      title: "Monthly Revenue",
      type: WIDGET_TYPES.CHART,
      size: WIDGET_SIZES.LG,
      priority: 40,
      data: safeArray(finance.monthly),
      meta: {
        chart: "line",
        x_key: "month_key",
        y_key: "total_amount",
      },
    }),

    createWidget({
      id: "finance-pledges",
      title: "Pledge Summary",
      type: WIDGET_TYPES.SUMMARY,
      size: WIDGET_SIZES.MD,
      priority: 50,
      data: pledges,
      actions: [
        {
          label: "View Pledges",
          to: "/dash/finance/pledges",
        },
      ],
    }),

    createWidget({
      id: "finance-invoices",
      title: "Invoice Summary",
      type: WIDGET_TYPES.SUMMARY,
      size: WIDGET_SIZES.MD,
      priority: 60,
      data: invoices,
      actions: [
        {
          label: "View Invoices",
          to: "/dash/finance/invoices",
        },
      ],
    }),

    createWidget({
      id: "finance-members",
      title: "Member Summary",
      type: WIDGET_TYPES.SUMMARY,
      size: WIDGET_SIZES.MD,
      priority: 70,
      data: members,
      actions: [
        {
          label: "Register Member",
          to: "/dash/finance/registration",
        },
      ],
    }),

    createWidget({
      id: "finance-recent-payments",
      title: "Recent Payments",
      type: WIDGET_TYPES.TABLE,
      size: WIDGET_SIZES.FULL,
      priority: 80,
      data: safeArray(finance.recent),
      empty_state: "No recent payments found.",
    }),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Member Dashboard                                                           */
/* -------------------------------------------------------------------------- */

async function getMemberDashboardWidgets(payload = {}) {
  const membership = payload.membership || {};
  const subscription = payload.subscription || {};
  const payments = safeArray(payload.payments);
  const receipts = safeArray(payload.receipts);
  const invoices = safeArray(payload.invoices);
  const pledges = safeArray(payload.pledges);

  return sortWidgets([
    createWidget({
      id: "member-welcome",
      title: `Welcome ${clean(payload.full_name || membership.full_name, 120)}`,
      type: WIDGET_TYPES.SUMMARY,
      size: WIDGET_SIZES.LG,
      priority: 10,
      data: {
        member_no: payload.member_no || membership.member_no || null,
        membership_status:
          payload.membership_status ||
          membership.membership_status ||
          null,
        membership_end_date:
          payload.membership_end_date ||
          membership.membership_end_date ||
          null,
      },
    }),

    createWidget({
      id: "member-subscription",
      title: "Membership Coverage",
      type: WIDGET_TYPES.SUMMARY,
      size: WIDGET_SIZES.LG,
      priority: 20,
      data: subscription,
      actions: [
        {
          label: "Manage Auto Payment",
          to: "/dash/member/subscription",
        },
      ],
    }),

    createWidget({
      id: "member-open-invoices",
      title: "Open Invoices",
      type: WIDGET_TYPES.TABLE,
      size: WIDGET_SIZES.LG,
      priority: 30,
      data: invoices.filter((row) =>
        ["draft", "open", "pending", "partial", "overdue"].includes(
          clean(row.status, 40).toLowerCase()
        )
      ),
      actions: [
        {
          label: "View Invoices",
          to: "/dash/member/invoices",
        },
      ],
    }),

    createWidget({
      id: "member-payments",
      title: "My Payments",
      type: WIDGET_TYPES.TABLE,
      size: WIDGET_SIZES.LG,
      priority: 40,
      data: payments,
      empty_state: "No payments found.",
    }),

    createWidget({
      id: "member-receipts",
      title: "My Receipts",
      type: WIDGET_TYPES.TABLE,
      size: WIDGET_SIZES.LG,
      priority: 50,
      data: receipts,
      empty_state: "No receipts found.",
    }),

    createWidget({
      id: "member-pledges",
      title: "My Pledges",
      type: WIDGET_TYPES.TABLE,
      size: WIDGET_SIZES.LG,
      priority: 60,
      data: pledges,
      empty_state: "No pledges found.",
    }),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Reconciliation Dashboard                                                   */
/* -------------------------------------------------------------------------- */

async function getReconciliationDashboardWidgets(payload = {}) {
  const summary = payload.summary || {};
  const unmatched = safeArray(payload.unmatched);
  const discrepancies = safeArray(payload.discrepancies);
  const recent = safeArray(payload.recent);

  return sortWidgets([
    createWidget({
      id: "reconciliation-summary",
      title: "Reconciliation Summary",
      type: WIDGET_TYPES.KPI,
      size: WIDGET_SIZES.XL,
      priority: 10,
      data: [
        createKpi("Matched", numberValue(summary.matched), {
          tone: "success",
        }),
        createKpi("Unmatched", numberValue(summary.unmatched), {
          tone: "warning",
        }),
        createKpi("Discrepancies", numberValue(summary.discrepancies), {
          tone: "danger",
        }),
        createKpi("Total Amount", money(summary.total_amount), {
          format: "currency",
        }),
      ],
    }),

    createWidget({
      id: "reconciliation-unmatched",
      title: "Unmatched Items",
      type: WIDGET_TYPES.TABLE,
      size: WIDGET_SIZES.XL,
      priority: 20,
      data: unmatched,
    }),

    createWidget({
      id: "reconciliation-discrepancies",
      title: "Discrepancies",
      type: WIDGET_TYPES.TABLE,
      size: WIDGET_SIZES.LG,
      priority: 30,
      data: discrepancies,
    }),

    createWidget({
      id: "reconciliation-recent",
      title: "Recent Reconciliation Activity",
      type: WIDGET_TYPES.ACTIVITY,
      size: WIDGET_SIZES.LG,
      priority: 40,
      data: recent,
    }),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Role Router                                                                */
/* -------------------------------------------------------------------------- */

async function getDashboardByRole(role, payload = {}) {
  switch (roleKey(role)) {
    case "super_admin":
    case "admin":
      return getAdminDashboardWidgets(payload);

    case "finance":
      return getFinanceDashboardWidgets(payload);

    case "reconciliation":
      return getReconciliationDashboardWidgets(payload);

    case "member":
    default:
      return getMemberDashboardWidgets(payload);
  }
}

async function getDashboardWidgetSummary(role, payload = {}) {
  const widgets = await getDashboardByRole(role, payload);

  return {
    ok: true,
    role: roleKey(role) || "member",
    count: widgets.length,
    widgets,
    generated_at: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

module.exports = {
  WIDGET_TYPES,
  WIDGET_SIZES,

  createWidget,
  createKpi,

  getAdminDashboardWidgets,
  getFinanceDashboardWidgets,
  getMemberDashboardWidgets,
  getReconciliationDashboardWidgets,

  getDashboardByRole,
  getDashboardWidgetSummary,
};