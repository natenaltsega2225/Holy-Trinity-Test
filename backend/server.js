
// backend/server.js

"use strict";

/* =========================================================
   ENV
========================================================= */

require("dotenv").config();

/* =========================================================
   CORE
========================================================= */

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

const app = express();

/* =========================================================
   DATABASE
========================================================= */

require("./db");

/* =========================================================
   ROUTE IMPORTS
========================================================= */

/* =========================================================
   STRIPE
========================================================= */

const stripeWebhookRoutes =
  require("./routes/stripeWebhook");

/* =========================================================
   AUTH
========================================================= */

const authRoutes =
  require("./routes/auth");

/* =========================================================
   ACCOUNT
========================================================= */

const accountRoutes =
  require("./routes/accountProfile");

/* =========================================================
   MEMBERS
========================================================= */

const membersRoutes =
  require("./routes/members");

// const memberBillingRoutes =
//   require("./routes/memberBilling");

const memberReceiptsRoutes =
  require("./routes/memberReceipts");

const memberDocumentsRoutes =
  require("./routes/memberDocuments");
const memberPaymentsRoutes =
  require("./routes/memberPayments");
/* =========================================================
   ADMIN
========================================================= */

const adminMembershipPlansRoutes =
  require("./routes/adminMembershipPlans");

const adminAccessUsersRoutes =
  require("./routes/adminAccessUsers");

const adminMemberDocumentsRoutes =
  require("./routes/adminMemberDocuments");

/* =========================================================
   FINANCE
========================================================= */
const financePledgesRoutes = require("./routes/financePledges");


const financeDashboardRoutes =
  require("./routes/financeDashboard");

const financeMembersRoutes =
  require("./routes/financeMembers");

const financePaymentsRoutes =
  require("./routes/financePayments");

const financeReceiptsRoutes =
  require("./routes/financeReceipts");

const financeInvoicesRoutes =
  require("./routes/financeInvoices");

const financeReportsRoutes =
  require("./routes/financeReports");

const financeEntriesRoutes =
  require("./routes/financeEntries");

const financeMemberLedgerRoutes =
  require("./routes/financeMemberLedger");

const financeCheckoutRoutes =
  require("./routes/financeCheckout");
/* =========================================================
   FAMILY / DEPENDENTS
========================================================= */

const adminMemberDependentsRoutes =
  require("./routes/adminMemberDependents");
/* =========================================================
   PUBLIC RECEIPTS / INVOICES
========================================================= */

const receiptsRoutes =
  require("./routes/receipts");

const invoicesRoutes =
  require("./routes/invoices");


/* =========================================================
   PAYMENTS
========================================================= */

const duesRoutes =
  require("./routes/dues");

const paymentsRoutes =
  require("./routes/payments");

const subscriptionRoutes =
  require("./routes/subscription");

const unifiedCheckoutRoutes =
  require("./routes/unifiedCheckout");

/* =========================================================
   SETTINGS
========================================================= */

const publicSettingsRoutes =
  require("./routes/publicSettings");

const dashboardThemesRoutes =
  require("./routes/dashboardThemes");

const systemSettingsRoutes =
  require("./routes/systemSettings");

/* =========================================================
   MEDIA
========================================================= */

const mediaRoutes =
  require("./routes/mediaResources");

/* =========================================================
   PROGRAMS
========================================================= */

const schoolRoutes =
  require("./routes/school");

const tripRoutes =
  require("./routes/trip");

const newsEventsRoutes =
  require("./routes/newsEvents");

const programRegistrationsRoutes =
  require("./routes/programRegistrations");

/* =========================================================
   FORMS
========================================================= */

const formSubmissionRoutes =
  require("./routes/formSubmission");

/* =========================================================
   VOLUNTEERS
========================================================= */

const servePostsRoutes =
  require("./routes/servePosts");

const volunteerApplicationsRoutes =
  require("./routes/volunteerApplications");

const volunteerHoursRoutes =
  require("./routes/volunteerHours");

const volunteerHoursPublicRoutes =
  require("./routes/volunteerHoursPublic");

const volunteerRecognitionRoutes =
  require("./routes/volunteerRecognition");

/* =========================================================
   CERTIFICATES
========================================================= */

const certificatesRoutes =
  require("./routes/certificates");

/* =========================================================
   RECONCILIATION
========================================================= */

const reconciliationRoutes =
  require("./routes/reconciliation");

/* =========================================================
   ANALYTICS
========================================================= */

const programAnalyticsRoutes =
  require("./routes/programAnalytics");

/* =========================================================
   APP SETTINGS
========================================================= */

app.set("trust proxy", 1);

app.disable("x-powered-by");

/* =========================================================
   CORS
========================================================= */

const allowList = new Set(
  (process.env.ORIGIN || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
);

allowList.add(
  "http://localhost:5173"
);

allowList.add(
  "http://127.0.0.1:5173"
);

allowList.add(
  "http://localhost:5174"
);

allowList.add(
  "http://localhost:3000"
);

console.log(
  "ORIGIN env:",
  [...allowList].join(",")
);

app.use(
  cors({
    origin(origin, callback) {

      if (!origin) {
        return callback(
          null,
          true
        );
      }

      if (
        allowList.has(origin)
      ) {
        return callback(
          null,
          true
        );
      }

      console.error(
        "CORS BLOCKED:",
        origin
      );

      return callback(
        new Error(
          `CORS blocked for origin: ${origin}`
        )
      );
    },

    credentials: true,
  })
);

/* =========================================================
   SECURITY
========================================================= */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

/* =========================================================
   REQUEST LOGGER
========================================================= */

app.use(
  (req, res, next) => {

    const requestId =
      crypto.randomUUID();

    req.requestId =
      requestId;

    res.setHeader(
      "X-Request-Id",
      requestId
    );

    console.log(
      `[${requestId}] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`
    );

    next();
  }
);

/* =========================================================
   STRIPE WEBHOOK
   MUST COME BEFORE BODY PARSERS
========================================================= */

app.use(
  "/api/stripe/webhook",
  stripeWebhookRoutes
);

/*
  TEMP COMPATIBILITY
*/

app.use(
  "//api/stripe/webhook",
  stripeWebhookRoutes
);

console.log(
  "✅ Mounted stripeWebhookRoutes -> /api/stripe/webhook"
);

/* =========================================================
   JSON PARSER
========================================================= */

app.use(
  (req, res, next) => {

    if (
      req.originalUrl.startsWith(
        "/api/stripe/webhook"
      ) ||
      req.originalUrl.startsWith(
        "//api/stripe/webhook"
      )
    ) {
      return next();
    }

    return express.json({
      limit: "25mb",
      strict: false,
    })(
      req,
      res,
      next
    );
  }
);

/* =========================================================
   URL ENCODED
========================================================= */

app.use(
  express.urlencoded({
    extended: true,
    limit: "25mb",
  })
);

/* =========================================================
   COOKIES
========================================================= */

app.use(
  cookieParser()
);

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  "/uploads",
  express.static(
    path.join(
      __dirname,
      "uploads"
    )
  )
);

app.use(
  "/backend/imgs",
  express.static(
    path.join(
      __dirname,
      "imgs"
    )
  )
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/",
  (_req, res) => {

    return res.json({
      ok: true,
      name:
        "Holy Trinity API",
    });
  }
);

app.get(
  "/api",
  (_req, res) => {

    return res.json({
      ok: true,
      api: true,
    });
  }
);

app.get(
  "/api/health",
  (_req, res) => {

    return res.json({
      ok: true,
      uptime:
        process.uptime(),
    });
  }
);

/* =========================================================
   SAFE ROUTE MOUNTER
========================================================= */

function mountRoute(
  name,
  basePath,
  router
) {

  try {

    if (
      !router ||
      typeof router !==
        "function"
    ) {

      console.error(
        `❌ Invalid router export for ${name}`
      );

      return;
    }

    app.use(
      basePath,
      router
    );

    console.log(
      `✅ Mounted ${name} -> ${basePath}`
    );

  } catch (err) {

    console.error(
      `❌ Failed mounting ${name}`
    );

    console.error(err);
  }
}

/* =========================================================
   AUTH
========================================================= */

mountRoute(
  "authRoutes",
  "/api/auth",
  authRoutes
);

/* =========================================================
   ACCOUNT
========================================================= */

mountRoute(
  "accountRoutes",
  "/api/account",
  accountRoutes
);

/* =========================================================
   MEMBERS
========================================================= */

mountRoute(
  "membersRoutes",
  "/api/members",
  membersRoutes
);

mountRoute(
  "memberPaymentsRoutes",
  "/api/member",
  memberPaymentsRoutes
);

mountRoute(
  "financeMemberLedgerMemberRoutes",
  "/api/member",
  financeMemberLedgerRoutes
);

mountRoute(
  "memberReceiptsRoutes",
  "/api/member/receipts",
  memberReceiptsRoutes
);

mountRoute(
  "invoicesRoutes",
  "/api/member/invoices",
  invoicesRoutes
);

mountRoute(
  "memberDocumentsRoutesMember",
  "/api/member/documents",
  memberDocumentsRoutes
);

/* =========================================================
   ADMIN
========================================================= */

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

/* =========================================================
   FINANCE
========================================================= */
mountRoute(
  "financePledgesRoutes",
  "/api/finance/pledges",
  financePledgesRoutes
);
mountRoute(
  "financeDashboardRoutes",
  "/api/finance",
  financeDashboardRoutes
);

mountRoute(
  "financeMembersRoutes",
  "/api/finance",
  financeMembersRoutes
);

mountRoute(
  "financePaymentsRoutes",
  "/api/finance/payments",
  financePaymentsRoutes
);

mountRoute(
  "financeReceiptsRoutes",
  "/api/finance",
  financeReceiptsRoutes
);

mountRoute(
  "financeInvoicesRoutes",
  "/api/finance/invoices",
  financeInvoicesRoutes
);

mountRoute(
  "financeInvoicesRoutesAlias",
  "/api/invoices",
  financeInvoicesRoutes
);

mountRoute(
  "receiptsRoutes",
  "/api/receipts",
  receiptsRoutes
);

mountRoute(
  "invoicesRoutes",
  "/api/member/invoices",
  invoicesRoutes
);

mountRoute(
  "financeReportsRoutes",
  "/api/finance/reports",
  financeReportsRoutes
);
mountRoute(
  "financeMemberLedgerMemberRoutes",
  "/api/member",
  financeMemberLedgerRoutes
);
mountRoute(
  "financeEntriesRoutes",
  "/api/finance",
  financeEntriesRoutes
);

mountRoute(
  "financeMemberLedgerRoutes",
  "/api/finance",
  financeMemberLedgerRoutes
);

mountRoute(
  "financeCheckoutRoutes",
  "/api/finance",
  financeCheckoutRoutes
);
/* =========================================================
   FAMILY / DEPENDENTS
========================================================= */

mountRoute(
  "adminMemberDependentsRoutes",
  "/api/finance",
  adminMemberDependentsRoutes
);
/* =========================================================
   PAYMENTS
========================================================= */

mountRoute(
  "duesRoutes",
  "/api/dues",
  duesRoutes
);

mountRoute(
  "paymentsRoutes",
  "/api/payments",
  paymentsRoutes
);

mountRoute(
  "subscriptionRoutes",
  "/api/subscription",
  subscriptionRoutes
);

mountRoute(
  "unifiedCheckoutRoutes",
  "/api/checkout",
  unifiedCheckoutRoutes
);

/* =========================================================
   SETTINGS
========================================================= */

mountRoute(
  "publicSettingsRoutes",
  "/api/settings",
  publicSettingsRoutes
);

mountRoute(
  "systemSettingsRoutes",
  "/api/system-settings",
  systemSettingsRoutes
);

/* =========================================================
   MEDIA
========================================================= */

mountRoute(
  "mediaRoutes",
  "/api/media",
  mediaRoutes
);

mountRoute(
  "mediaRoutesAdmin",
  "/api/admin",
  mediaRoutes
);

/* =========================================================
   PROGRAMS
========================================================= */

mountRoute(
  "schoolRoutes",
  "/api/school",
  schoolRoutes
);

mountRoute(
  "tripRoutes",
  "/api/trip",
  tripRoutes
);

mountRoute(
  "newsEventsRoutes",
  "/api/news-events",
  newsEventsRoutes
);

mountRoute(
  "programRegistrationsRoutes",
  "/api/program-registrations",
  programRegistrationsRoutes
);

/* =========================================================
   FORMS
========================================================= */

mountRoute(
  "formSubmissionRoutes",
  "/api/forms",
  formSubmissionRoutes
);

/* =========================================================
   VOLUNTEERS
========================================================= */

mountRoute(
  "servePostsRoutes",
  "/api/serve-posts",
  servePostsRoutes
);

mountRoute(
  "volunteerApplicationsRoutes",
  "/api/volunteers/applications",
  volunteerApplicationsRoutes
);

mountRoute(
  "volunteerHoursRoutes",
  "/api/volunteers/hours",
  volunteerHoursRoutes
);

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

/* =========================================================
   CERTIFICATES
========================================================= */

mountRoute(
  "certificatesRoutes",
  "/api/certificates",
  certificatesRoutes
);

/* =========================================================
   RECONCILIATION
========================================================= */

mountRoute(
  "reconciliationRoutes",
  "/api/reconciliation",
  reconciliationRoutes
);

/* =========================================================
   ANALYTICS
========================================================= */

mountRoute(
  "programAnalyticsRoutes",
  "/api/program-analytics",
  programAnalyticsRoutes
);

/* =========================================================
   API 404
========================================================= */

app.use(
  "/api",
  (req, res) => {

    return res.status(404).json({
      ok: false,
      error:
        "API Route Not Found",
      path:
        req.originalUrl,
    });
  }
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    err,
    req,
    res,
    _next
  ) => {

    console.error(
      `[${req.requestId || "NO_REQUEST_ID"}]`,
      err
    );

    return res.status(500).json({
      ok: false,

      error:
        err.message ||
        "Internal Server Error",
    });
  }
);

/* =========================================================
   PROCESS ERRORS
========================================================= */

process.on(
  "uncaughtException",
  (err) => {

    console.error(
      "UNCAUGHT EXCEPTION:",
      err
    );
  }
);

process.on(
  "unhandledRejection",
  (reason) => {

    console.error(
      "UNHANDLED REJECTION:",
      reason
    );
  }
);

/* =========================================================
   START SERVER
========================================================= */

const PORT =
  process.env.PORT || 5000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `🚀 Server running on port ${PORT}`
    );
  }
);
