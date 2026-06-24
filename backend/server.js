// backend/server.js
"use strict";

/* -------------------------------------------------------------------------- */
/* Environment                                                                */
/* -------------------------------------------------------------------------- */

require("dotenv").config();

/* -------------------------------------------------------------------------- */
/* Core                                                                       */
/* -------------------------------------------------------------------------- */

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const app = express();

/* -------------------------------------------------------------------------- */
/* Database                                                                   */
/* -------------------------------------------------------------------------- */

require("./db");

/* -------------------------------------------------------------------------- */
/* Route Loader                                                               */
/* -------------------------------------------------------------------------- */

function requireRoute(name, modulePath, options = {}) {
  try {
    const router = require(modulePath);

    if (typeof router !== "function") {
      throw new TypeError(`${name} must export an Express router.`);
    }

    return router;
  } catch (err) {
    if (options.optional) {
      console.warn(`Optional route not loaded: ${name}`, err.message);
      return null;
    }

    console.error(`Failed loading route: ${name}`);
    console.error(err);
    throw err;
  }
}

function mountRoute(name, basePath, router) {
  if (!router) return;

  try {
    app.use(basePath, router);
    console.log(`Mounted ${name} -> ${basePath}`);
  } catch (err) {
    console.error(`Failed mounting ${name} -> ${basePath}`);
    console.error(err);
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* Optional Services                                                          */
/* -------------------------------------------------------------------------- */

let financeReminderAutomationService = null;

try {
  financeReminderAutomationService = require("./services/financeReminderAutomationService");
} catch (err) {
  console.warn("Finance reminder automation service not loaded:", err.message);
}

let scheduledJobsService = null;

try {
  scheduledJobsService = require("./services/domains/jobs/scheduledJobsService");
} catch (err) {
  console.warn("Scheduled jobs service not loaded:", err.message);
}

function getFinanceReminderStarter() {
  if (!financeReminderAutomationService) return null;

  return (
    financeReminderAutomationService.startFinanceReminderScheduler ||
    financeReminderAutomationService.startFinanceReminderAutomation ||
    financeReminderAutomationService.startScheduler ||
    financeReminderAutomationService.start ||
    null
  );
}

function getFinanceReminderStopper() {
  if (!financeReminderAutomationService) return null;

  return (
    financeReminderAutomationService.stopFinanceReminderScheduler ||
    financeReminderAutomationService.stopFinanceReminderAutomation ||
    financeReminderAutomationService.stopScheduler ||
    financeReminderAutomationService.stop ||
    null
  );
}

/* -------------------------------------------------------------------------- */
/* Route Imports                                                              */
/* -------------------------------------------------------------------------- */

const stripeWebhookRoutes = requireRoute(
  "stripeWebhookRoutes",
  "./routes/stripeWebhook"
);

/* Auth / account */
const authRoutes = requireRoute("authRoutes", "./routes/auth");
const accountRoutes = requireRoute("accountRoutes", "./routes/accountProfile");

/* Members */
const membersRoutes = requireRoute("membersRoutes", "./routes/members");

const memberPaymentsRoutes = requireRoute( "memberPaymentsRoutes","./routes/memberPayments");

const memberReceiptsRoutes = requireRoute(
  "memberReceiptsRoutes",
  "./routes/memberReceipts"
);

const memberInvoicesRoutes = requireRoute(
  "memberInvoicesRoutes",
  "./routes/invoices"
);

const memberDocumentsRoutes = requireRoute(
  "memberDocumentsRoutes",
  "./routes/memberDocuments"
);

const memberStatementsRoutes = requireRoute(
  "memberStatementsRoutes",
  "./routes/memberStatements",
  { optional: true }
);

/* Admin */
const adminMembershipPlansRoutes = requireRoute(
  "adminMembershipPlansRoutes",
  "./routes/adminMembershipPlans"
);

const adminAccessUsersRoutes = requireRoute(
  "adminAccessUsersRoutes",
  "./routes/adminAccessUsers"
);

const adminMemberDocumentsRoutes = requireRoute(
  "adminMemberDocumentsRoutes",
  "./routes/adminMemberDocuments"
);

const adminMemberDependentsRoutes = requireRoute(
  "adminMemberDependentsRoutes",
  "./routes/adminMemberDependents"
);

const dashboardThemesRoutes = requireRoute(
  "dashboardThemesRoutes",
  "./routes/dashboardThemes"
);

const auditReportsRoutes = requireRoute(
  "auditReportsRoutes",
  "./routes/auditReports",
  { optional: true }
);
const adminServePostsRoutes = require("./routes/adminServePosts");
// const adminAccessUsersRoutes = require("./routes/adminAccessUsers");


/* Finance */
const executiveKpisRoutes = requireRoute(
  "executiveKpisRoutes",
  "./routes/executiveKpis",
  { optional: true }
);

const financeSearchRoutes = requireRoute(
  "financeSearchRoutes",
  "./routes/financeSearch"
);

const financeDashboardRoutes = requireRoute(
  "financeDashboardRoutes",
  "./routes/financeDashboard"
);

const financeSettingsRoutes = requireRoute(
  "financeSettingsRoutes",
  "./routes/financeSettings",
  { optional: true }
);

const financeNotificationsRoutes = requireRoute(
  "financeNotificationsRoutes",
  "./routes/financeNotifications",
  { optional: true }
);

const financeAuditLogsRoutes = requireRoute(
  "financeAuditLogsRoutes",
  "./routes/financeAuditLogs",
  { optional: true }
);

const financeExpensesRoutes = requireRoute(
  "financeExpensesRoutes",
  "./routes/financeExpenses"
);

const financeMembersRoutes = requireRoute(
  "financeMembersRoutes",
  "./routes/financeMembers"
);

const financeRegistrationRoutes = requireRoute(
  "financeRegistrationRoutes",
  "./routes/financeRegistration"
);

const financePledgesRoutes = requireRoute(
  "financePledgesRoutes",
  "./routes/financePledges"
);

const pledgeRemindersRoutes = requireRoute(
  "pledgeRemindersRoutes",
  "./routes/pledgeReminders",
  { optional: true }
);

const membershipRemindersRoutes = requireRoute(
  "membershipRemindersRoutes",
  "./routes/membershipReminders",
  { optional: true }
);

const financePaymentsRoutes = requireRoute(
  "financePaymentsRoutes",
  "./routes/financePayments"
);

const financeReceiptsRoutes = requireRoute(
  "financeReceiptsRoutes",
  "./routes/financeReceipts"
);

const financeInvoicesRoutes = requireRoute(
  "financeInvoicesRoutes",
  "./routes/financeInvoices"
);

const financeReportsRoutes = requireRoute(
  "financeReportsRoutes",
  "./routes/financeReports"
);

const financeEntriesRoutes = requireRoute(
  "financeEntriesRoutes",
  "./routes/financeEntries"
);

const financeMemberLedgerRoutes = requireRoute(
  "financeMemberLedgerRoutes",
  "./routes/financeMemberLedger"
);
const financeReminderSchedulesRoutes =
  require("./routes/financeReminderSchedules");
/* Public receipt / invoice */

const receiptsRoutes = requireRoute("receiptsRoutes", "./routes/receipts");

const publicInvoicesRoutes = requireRoute(
  "publicInvoicesRoutes",
  "./routes/publicInvoices"
);

/* Payments / checkout */
const duesRoutes = requireRoute("duesRoutes", "./routes/dues");
const paymentsRoutes = requireRoute("paymentsRoutes", "./routes/payments");

const subscriptionRoutes = requireRoute(
  "subscriptionRoutes",
  "./routes/subscription"
);

const unifiedCheckoutRoutes = requireRoute(
  "unifiedCheckoutRoutes",
  "./routes/unifiedCheckout"
);

/* Settings */
const publicSettingsRoutes = requireRoute(
  "publicSettingsRoutes",
  "./routes/publicSettings"
);

const systemSettingsRoutes = requireRoute(
  "systemSettingsRoutes",
  "./routes/systemSettings"
);

/* Media */
const mediaRoutes = requireRoute("mediaRoutes", "./routes/mediaResources");

/* Programs */
const schoolRoutes = requireRoute("schoolRoutes", "./routes/school");
const tripRoutes = requireRoute("tripRoutes", "./routes/trip");

const newsEventsRoutes = requireRoute(
  "newsEventsRoutes",
  "./routes/newsEvents"
);

const programRegistrationsRoutes = requireRoute(
  "programRegistrationsRoutes",
  "./routes/programRegistrations"
);

/* Forms */
const formSubmissionRoutes = requireRoute(
  "formSubmissionRoutes",
  "./routes/formSubmission"
);

/* Volunteers */
const servePostsRoutes = requireRoute("servePostsRoutes", "./routes/servePosts");

const volunteerApplicationsRoutes = requireRoute(
  "volunteerApplicationsRoutes",
  "./routes/volunteerApplications"
);

const volunteerHoursRoutes = requireRoute(
  "volunteerHoursRoutes",
  "./routes/volunteerHours"
);

const volunteerHoursPublicRoutes = requireRoute(
  "volunteerHoursPublicRoutes",
  "./routes/volunteerHoursPublic"
);

const volunteerRecognitionRoutes = requireRoute(
  "volunteerRecognitionRoutes",
  "./routes/volunteerRecognition"
);

/* Certificates / reconciliation / analytics */
const certificatesRoutes = requireRoute(
  "certificatesRoutes",
  "./routes/certificates"
);

const reconciliationRoutes = requireRoute(
  "reconciliationRoutes",
  "./routes/reconciliation"
);

const programAnalyticsRoutes = requireRoute(
  "programAnalyticsRoutes",
  "./routes/programAnalytics"
);

/* -------------------------------------------------------------------------- */
/* App Settings                                                               */
/* -------------------------------------------------------------------------- */

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(compression());
const rateLimit = require("express-rate-limit");
/* -------------------------------------------------------------------------- */
/* CORS                                                                       */
/* -------------------------------------------------------------------------- */

const allowList = new Set();

function addCorsOrigins(value) {
  String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => allowList.add(origin));
}

addCorsOrigins(process.env.ORIGIN);
addCorsOrigins(process.env.CORS_ORIGINS);
addCorsOrigins(process.env.FRONTEND_URL);
addCorsOrigins(process.env.CLIENT_URL);
addCorsOrigins(process.env.APP_URL);
addCorsOrigins(process.env.PUBLIC_APP_URL);
addCorsOrigins(process.env.BACKEND_PUBLIC_URL);

[
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].forEach((origin) => allowList.add(origin));

console.log("Allowed CORS origins:", [...allowList].join(","));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowList.has(origin)) return callback(null, true);

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Requested-With",
      "X-Request-Id",
    ],
    exposedHeaders: ["X-Request-Id"],
  })
);

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

// app.use(
//   helmet({
//     crossOriginResourcePolicy: {
//       policy: "cross-origin",
//     },
//   })
// );
app.use(
  helmet({
    frameguard: {
      action: "deny",
    },

    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },

    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);
/* -------------------------------------------------------------------------- */
/* Request Identity / Logger                                                  */
/* -------------------------------------------------------------------------- */

// app.use((req, res, next) => {
//   const requestId = req.headers["x-request-id"] || crypto.randomUUID();

//   req.requestId = String(requestId);
//   req.id = req.requestId;

//   res.setHeader("X-Request-Id", req.requestId);

//   console.log(
//     `[${req.requestId}] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`
//   );

//   next();
// });
app.use((req, res, next) => {
  const startedAt = Date.now();

  const requestId =
    req.headers["x-request-id"] ||
    crypto.randomUUID();

  req.requestId = String(requestId);
  req.id = req.requestId;

  res.setHeader(
    "X-Request-Id",
    req.requestId
  );

  res.on("finish", () => {
    console.log(
      `[${req.requestId}]`,
      req.method,
      req.originalUrl,
      res.statusCode,
      `${Date.now() - startedAt}ms`
    );
  });

  next();
});

/* -------------------------------------------------------------------------- */
/* Stripe Webhook                                                             */
/* Must be mounted before express.json().                                     */
/* -------------------------------------------------------------------------- */

mountRoute("stripeWebhookRoutes", "/api/stripe/webhook", stripeWebhookRoutes);

/* -------------------------------------------------------------------------- */
/* Body Parsers                                                               */
/* -------------------------------------------------------------------------- */

app.use(
  express.json({
    limit: process.env.JSON_BODY_LIMIT || "25mb",
    strict: false,
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.URLENCODED_BODY_LIMIT || "25mb",
  })
);

app.use(cookieParser(process.env.COOKIE_SECRET || undefined));

/* -------------------------------------------------------------------------- */
/* Static Files                                                               */
/* -------------------------------------------------------------------------- */

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: process.env.STATIC_MAX_AGE || "1h",
  })
);

app.use(
  "/backend/imgs",
  express.static(path.join(__dirname, "imgs"), {
    maxAge: process.env.STATIC_MAX_AGE || "1h",
  })
);

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

app.get("/", (_req, res) => {
  return res.json({
    ok: true,
    name: "Holy Trinity API",
  });
});

app.get("/api", (_req, res) => {
  return res.json({
    ok: true,
    api: true,
  });
});
//health
// app.get("/api/health", (_req, res) => {
//   return res.json({
//     ok: true,
//     uptime: process.uptime(),
//     timestamp: new Date().toISOString(),
//   });
// });
app.get("/api/health", async (_req, res) => {
  const health = {
    ok: true,
    service: "Holy Trinity API",
    environment: process.env.NODE_ENV || "development",
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heap_used_mb: Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      ),
      heap_total_mb: Math.round(
        process.memoryUsage().heapTotal / 1024 / 1024
      ),
    },
    database: false,
  };

  try {
    const pool = require("./db");

    await pool.query("SELECT 1");

    health.database = true;
  } catch (err) {
    health.ok = false;
    health.database = false;
    health.database_error = err.message;
  }

  return res.status(health.ok ? 200 : 503).json(health);
});
//limit
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const publicInvoiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", loginLimiter);
app.use("/api/public/invoices", publicInvoiceLimiter);
/* -------------------------------------------------------------------------- */
/* Auth / Account                                                             */
/* -------------------------------------------------------------------------- */

mountRoute("authRoutes", "/api/auth", authRoutes);
mountRoute("accountRoutes", "/api/account", accountRoutes);

/* -------------------------------------------------------------------------- */
/* Members                                                                    */
/* -------------------------------------------------------------------------- */

mountRoute("membersRoutes", "/api/members", membersRoutes);
mountRoute("memberPaymentsRoutes", "/api/member", memberPaymentsRoutes);
mountRoute("memberLedgerRoutes", "/api/member", financeMemberLedgerRoutes);
mountRoute("memberReceiptsRoutes", "/api/member/receipts", memberReceiptsRoutes);
mountRoute("memberInvoicesRoutes", "/api/member/invoices", memberInvoicesRoutes);
mountRoute("memberDocumentsRoutes", "/api/member/documents", memberDocumentsRoutes);
mountRoute("memberStatementsRoutes", "/api/member/statements", memberStatementsRoutes);

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

mountRoute(
  "adminMembershipPlansRoutes",
  "/api/admin/membership-plans",
  adminMembershipPlansRoutes
);

mountRoute(
  "adminAccessUsersRoutes",
  "/api/admin/access-users",
  adminAccessUsersRoutes
);

mountRoute(
  "adminAccessUsersRoutesAlias",
  "/api/admin/users",
  adminAccessUsersRoutes
);

mountRoute(
  "adminMemberDocumentsRoutes",
  "/api/admin/member-documents",
  adminMemberDocumentsRoutes
);

mountRoute(
  "dashboardThemesRoutes",
  "/api/admin/dashboard-themes",
  dashboardThemesRoutes
);

mountRoute(
  "adminAuditReportsRoutes",
  "/api/admin/audit-reports",
  auditReportsRoutes
);
mountRoute(
  "adminServePostsRoutes",
  "/api/admin/serve-posts",
  adminServePostsRoutes
);

// mountRoute(
//   "adminAccessUsersRoutes",
//   "/api/admin/access-users",
//   adminAccessUsersRoutes
// );
/* -------------------------------------------------------------------------- */
/* Finance                                                                    */
/* -------------------------------------------------------------------------- */

/*
  Keep exact finance routes before broad /api/finance routers.
  This prevents routes like /api/finance/settings and /api/finance/audit-logs
  from being captured by generic /:id handlers in other finance routers.
*/

mountRoute(
  "financeSettingsRoutes",
  "/api/finance/settings",
  financeSettingsRoutes
);

mountRoute(
  "financeNotificationsRoutes",
  "/api/finance/notifications",
  financeNotificationsRoutes
);

mountRoute(
  "financeAuditLogsRoutes",
  "/api/finance/audit-logs",
  financeAuditLogsRoutes
);

mountRoute(
  "financeAuditLogsRoutesAlias",
  "/api/finance/audit",
  financeAuditLogsRoutes
);

mountRoute(
  "financeAuditReportsAlias",
  "/api/finance/reports/audit",
  financeAuditLogsRoutes
);

mountRoute(
  "financeAuditReportsRoutes",
  "/api/finance/audit-reports",
  auditReportsRoutes
);

mountRoute(
  "executiveKpisRoutes",
  "/api/finance/executive-kpis",
  executiveKpisRoutes
);

mountRoute(
  "membershipRemindersRoutes",
  "/api/finance/membership-reminders",
  membershipRemindersRoutes
);

mountRoute(
  "pledgeRemindersRoutes",
  "/api/finance/pledge-reminders",
  pledgeRemindersRoutes
);

mountRoute(
  "financeRegistrationRoutes",
  "/api/finance/registration",
  financeRegistrationRoutes
);

mountRoute("financePledgesRoutes", "/api/finance/pledges", financePledgesRoutes);
mountRoute("financePaymentsRoutes", "/api/finance/payments", financePaymentsRoutes);
mountRoute("financeReportsRoutes", "/api/finance/reports", financeReportsRoutes);


/* Finance Reminder Schedules */
app.use(
  "/api/finance/reminder-schedules",
  financeReminderSchedulesRoutes
);

console.log(
  "Mounted financeReminderSchedulesRoutes -> /api/finance/reminder-schedules"
)
/*
  Expenses must stay after exact finance routes because the expenses router
  also supports dynamic /:id paths. It still serves:
  - GET/POST /api/finance/expenses
  - GET/POST /api/finance/reimbursements
  - GET/POST /api/finance/expenses/categories
*/
mountRoute("financeExpensesRoutes", "/api/finance", financeExpensesRoutes);

/*
  Broad /api/finance routers are intentionally mounted later.
*/
mountRoute("financeSearchRoutes", "/api/finance", financeSearchRoutes);
mountRoute("financeDashboardRoutes", "/api/finance", financeDashboardRoutes);
mountRoute("financeMembersRoutes", "/api/finance", financeMembersRoutes);
mountRoute("financeReceiptsRoutes", "/api/finance", financeReceiptsRoutes);
mountRoute("financeInvoicesRoutes", "/api/finance", financeInvoicesRoutes);
mountRoute("financeInvoicesRoutesAlias", "/api/invoices", financeInvoicesRoutes);
mountRoute("financeEntriesRoutes", "/api/finance", financeEntriesRoutes);
mountRoute("financeMemberLedgerRoutes", "/api/finance", financeMemberLedgerRoutes);

mountRoute(
  "financeMemberStatementsRoutes",
  "/api/finance/statements",
  memberStatementsRoutes
);

mountRoute(
  "adminMemberDependentsRoutes",
  "/api/finance",
  adminMemberDependentsRoutes
);

/* -------------------------------------------------------------------------- */
/* Public Receipts / Public Invoices                                          */
/* -------------------------------------------------------------------------- */

mountRoute("receiptsRoutes", "/api/receipts", receiptsRoutes);
mountRoute("publicInvoicesRoutes", "/api/public/invoices", publicInvoicesRoutes);

/* -------------------------------------------------------------------------- */
/* Payments / Checkout                                                        */
/* -------------------------------------------------------------------------- */

mountRoute("duesRoutes", "/api/dues", duesRoutes);
mountRoute("paymentsRoutes", "/api/payments", paymentsRoutes);
mountRoute("subscriptionRoutes", "/api/subscription", subscriptionRoutes);
mountRoute("unifiedCheckoutRoutes", "/api/checkout", unifiedCheckoutRoutes);

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

mountRoute("publicSettingsRoutes", "/api/settings", publicSettingsRoutes);
mountRoute("systemSettingsRoutes", "/api/system-settings", systemSettingsRoutes);

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

mountRoute("mediaRoutes", "/api/media", mediaRoutes);
mountRoute("mediaRoutesAdmin", "/api/admin", mediaRoutes);

/* -------------------------------------------------------------------------- */
/* Programs                                                                   */
/* -------------------------------------------------------------------------- */

mountRoute("schoolRoutes", "/api/school", schoolRoutes);
mountRoute("tripRoutes", "/api/trip", tripRoutes);
mountRoute("newsEventsRoutes", "/api/news-events", newsEventsRoutes);

mountRoute(
  "programRegistrationsRoutes",
  "/api/program-registrations",
  programRegistrationsRoutes
);

/* -------------------------------------------------------------------------- */
/* Forms                                                                      */
/* -------------------------------------------------------------------------- */

mountRoute("formSubmissionRoutes", "/api/forms", formSubmissionRoutes);

/* -------------------------------------------------------------------------- */
/* Volunteers                                                                 */
/* -------------------------------------------------------------------------- */

mountRoute("servePostsRoutes", "/api/serve-posts", servePostsRoutes);

mountRoute(
  "volunteerApplicationsRoutes",
  "/api/volunteers/applications",
  volunteerApplicationsRoutes
);

mountRoute("volunteerHoursRoutes", "/api/volunteers/hours", volunteerHoursRoutes);

mountRoute(
  "volunteerHoursPublicRoutes",
  "/api/public/volunteer-hours",
  volunteerHoursPublicRoutes
);

mountRoute(
  "volunteerRecognitionRoutes",
  "/api/volunteers/recognition",
  volunteerRecognitionRoutes
);

/* -------------------------------------------------------------------------- */
/* Certificates / Reconciliation / Analytics                                  */
/* -------------------------------------------------------------------------- */

mountRoute("certificatesRoutes", "/api/certificates", certificatesRoutes);
mountRoute("reconciliationRoutes", "/api/reconciliation", reconciliationRoutes);

mountRoute(
  "programAnalyticsRoutes",
  "/api/program-analytics",
  programAnalyticsRoutes
);

/* -------------------------------------------------------------------------- */
/* API 404                                                                    */
/* -------------------------------------------------------------------------- */

app.use("/api", (req, res) => {
  return res.status(404).json({
    ok: false,
    error: "API Route Not Found",
    path: req.originalUrl,
  });
});

/* -------------------------------------------------------------------------- */
/* Global Error Handler                                                       */
/* -------------------------------------------------------------------------- */

app.use((err, req, res, _next) => {
  const status =
    String(err.message || "").startsWith("CORS blocked")
      ? 403
      : err.status || err.statusCode || 500;

  console.error(`[${req.requestId || "NO_REQUEST_ID"}]`, err);

  return res.status(status).json({
    ok: false,
    error:
      status === 500
        ? "Internal Server Error"
        : err.message || "Request failed.",
  });
});

/* -------------------------------------------------------------------------- */
/* Process Errors                                                             */
/* -------------------------------------------------------------------------- */

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

/* -------------------------------------------------------------------------- */
/* Start Server                                                               */
/* -------------------------------------------------------------------------- */

const PORT = Number(process.env.PORT || 5000);
let server = null;

async function startSchedulers() {
  const starter = getFinanceReminderStarter();

  if (typeof starter === "function") {
    try {
      const result = await starter();

      console.log("Finance reminder scheduler:", {
        enabled: result?.enabled !== false,
        already_started: Boolean(result?.already_started),
      });
    } catch (err) {
      console.error("Finance reminder scheduler failed:", err);
    }
  }

  if (
    scheduledJobsService &&
    typeof scheduledJobsService.registerScheduledJobs === "function"
  ) {
    try {
      const result = scheduledJobsService.registerScheduledJobs();

      console.log("Scheduled jobs:", {
        enabled: result?.enabled !== false,
        registered_jobs: result?.jobs?.length || 0,
      });
    } catch (err) {
      console.error("Scheduled jobs failed:", err);
    }
  }
}

function startServer() {
  if (server) return server;

  server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    startSchedulers();
  });

  server.keepAliveTimeout = Number(
    process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS || 65000
  );

  server.headersTimeout = Number(
    process.env.SERVER_HEADERS_TIMEOUT_MS || 66000
  );

  server.on("error", (err) => {
    console.error("Server listen error:", err);
    throw err;
  });

  return server;
}

/* -------------------------------------------------------------------------- */
/* Graceful Shutdown                                                          */
/* -------------------------------------------------------------------------- */

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`${signal} received. Closing server...`);

  const stopper = getFinanceReminderStopper();

  if (typeof stopper === "function") {
    try {
      await stopper();
    } catch (err) {
      console.error("Finance reminder scheduler stop failed:", err);
    }
  }

  if (
    scheduledJobsService &&
    typeof scheduledJobsService.stopScheduledJobs === "function"
  ) {
    try {
      scheduledJobsService.stopScheduledJobs();
    } catch (err) {
      console.error("Scheduled jobs stop failed:", err);
    }
  }

  if (!server) {
    process.exit(0);
    return;
  }

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, Number(process.env.SHUTDOWN_TIMEOUT_MS || 15000)).unref();
}

if (require.main === module) {
  startServer();

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = app;
module.exports.startServer = startServer;
module.exports.shutdown = shutdown;
