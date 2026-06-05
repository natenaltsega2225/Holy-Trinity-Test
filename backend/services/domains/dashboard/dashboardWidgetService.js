// backend/services/domains/dashboard/dashboardWidgetService.js
"use strict";

const {

  getFinanceDashboardSummary,

} = require(
  "../finance/financeDashboardService"
);

const {

  getExecutiveDashboard,

} = require(
  "../analytics/analyticsDashboardService"
);

const {

  getReminderStats,

} = require(
  "../reminders/reminderService"
);

const {

  getNotificationStats,

} = require(
  "../notifications/notificationService"
);

const {

  getSecuritySummary,

} = require(
  "../security/securityAuditService"
);

/* =========================================================
   WIDGET TYPES
========================================================= */

const WIDGET_TYPES = {

  KPI: "kpi",

  CHART: "chart",

  TABLE: "table",

  ACTIVITY: "activity",

  SUMMARY: "summary",
};

/* =========================================================
   HELPERS
========================================================= */

function createWidget({

  id,

  title,

  type,

  size = "md",

  data = null,
}) {

  return {

    id,

    title,

    type,

    size,

    data,
  };
}

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

async function getAdminDashboardWidgets() {

  const [

    executive,

    reminders,

    notifications,

    security,

  ] = await Promise.all([

    getExecutiveDashboard(),

    getReminderStats(),

    getNotificationStats(),

    getSecuritySummary(),
  ]);

  return [

    createWidget({

      id:
        "executive-kpis",

      title:
        "Executive KPIs",

      type:
        WIDGET_TYPES.KPI,

      size:
        "xl",

      data:
        executive.revenue,
    }),

    createWidget({

      id:
        "membership-growth",

      title:
        "Membership Growth",

      type:
        WIDGET_TYPES.CHART,

      size:
        "lg",

      data:
        executive.member_growth,
    }),

    createWidget({

      id:
        "donation-breakdown",

      title:
        "Donation Analytics",

      type:
        WIDGET_TYPES.CHART,

      size:
        "lg",

      data:
        executive.donations,
    }),

    createWidget({

      id:
        "notification-stats",

      title:
        "Notifications",

      type:
        WIDGET_TYPES.SUMMARY,

      size:
        "md",

      data:
        notifications,
    }),

    createWidget({

      id:
        "security-summary",

      title:
        "Security Summary",

      type:
        WIDGET_TYPES.SUMMARY,

      size:
        "md",

      data:
        security,
    }),

    createWidget({

      id:
        "reminder-summary",

      title:
        "Reminders",

      type:
        WIDGET_TYPES.SUMMARY,

      size:
        "md",

      data:
        reminders,
    }),
  ];
}

/* =========================================================
   FINANCE DASHBOARD
========================================================= */

async function getFinanceDashboardWidgets() {

  const finance =
    await getFinanceDashboardSummary();

  return [

    createWidget({

      id:
        "finance-kpis",

      title:
        "Finance KPIs",

      type:
        WIDGET_TYPES.KPI,

      size:
        "xl",

      data:
        finance.kpis,
    }),

    createWidget({

      id:
        "monthly-revenue",

      title:
        "Monthly Revenue",

      type:
        WIDGET_TYPES.CHART,

      size:
        "lg",

      data:
        finance.monthly,
    }),

    createWidget({

      id:
        "payment-methods",

      title:
        "Payment Methods",

      type:
        WIDGET_TYPES.CHART,

      size:
        "lg",

      data:
        finance.methods,
    }),

    createWidget({

      id:
        "categories",

      title:
        "Category Breakdown",

      type:
        WIDGET_TYPES.TABLE,

      size:
        "md",

      data:
        finance.categories,
    }),

    createWidget({

      id:
        "recent-payments",

      title:
        "Recent Payments",

      type:
        WIDGET_TYPES.TABLE,

      size:
        "xl",

      data:
        finance.recent,
    }),
  ];
}

/* =========================================================
   MEMBER DASHBOARD
========================================================= */

async function getMemberDashboardWidgets(
  payload = {}
) {

  return [

    createWidget({

      id:
        "welcome",

      title:
        `Welcome ${payload.full_name || ""}`,

      type:
        WIDGET_TYPES.SUMMARY,

      size:
        "lg",

      data: {

        membership_status:
          payload.membership_status,

        member_no:
          payload.member_no,
      },
    }),

    createWidget({

      id:
        "member-payments",

      title:
        "My Payments",

      type:
        WIDGET_TYPES.TABLE,

      size:
        "lg",

      data:
        payload.payments || [],
    }),

    createWidget({

      id:
        "member-receipts",

      title:
        "My Receipts",

      type:
        WIDGET_TYPES.TABLE,

      size:
        "lg",

      data:
        payload.receipts || [],
    }),
  ];
}

/* =========================================================
   RECONCILIATION DASHBOARD
========================================================= */

async function getReconciliationDashboardWidgets(
  payload = {}
) {

  return [

    createWidget({

      id:
        "reconciliation-summary",

      title:
        "Reconciliation Summary",

      type:
        WIDGET_TYPES.KPI,

      size:
        "xl",

      data:
        payload.summary || {},
    }),

    createWidget({

      id:
        "unmatched-items",

      title:
        "Unmatched Items",

      type:
        WIDGET_TYPES.TABLE,

      size:
        "xl",

      data:
        payload.unmatched || [],
    }),

    createWidget({

      id:
        "discrepancies",

      title:
        "Discrepancies",

      type:
        WIDGET_TYPES.TABLE,

      size:
        "lg",

      data:
        payload.discrepancies || [],
    }),
  ];
}

/* =========================================================
   ROLE DASHBOARD
========================================================= */

async function getDashboardByRole(

  role,

  payload = {}
) {

  switch (
    String(role || "")
      .toLowerCase()
  ) {

    case "super_admin":

    case "admin":

      return getAdminDashboardWidgets();

    case "finance":

      return getFinanceDashboardWidgets();

    case "reconciliation":

      return getReconciliationDashboardWidgets(
        payload
      );

    case "member":

    default:

      return getMemberDashboardWidgets(
        payload
      );
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  WIDGET_TYPES,

  createWidget,

  getAdminDashboardWidgets,

  getFinanceDashboardWidgets,

  getMemberDashboardWidgets,

  getReconciliationDashboardWidgets,

  getDashboardByRole,
};