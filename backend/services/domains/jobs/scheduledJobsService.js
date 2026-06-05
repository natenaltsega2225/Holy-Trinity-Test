// backend/services/domains/jobs/scheduledJobsService.js
"use strict";

const cron =
  require("node-cron");

const {

  processPendingReminders,

} = require(
  "../notifications/reminderService"
);

const {

  cleanupExports,

} = require(
  "../export/exportService"
);

const {

  importStripePayments,

  importStripeRefunds,

} = require(
  "../reconciliation/stripeReconciliationService"
);

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

/* =========================================================
   HELPERS
========================================================= */

function logJob(
  name,
  message
) {

  console.log(

    `[JOB:${name}] ${message}`
  );
}

/* =========================================================
   REMINDER JOB
========================================================= */

async function runReminderJob() {

  try {

    logJob(
      "REMINDERS",
      "Starting..."
    );

    const result =
      await processPendingReminders();

    logJob(
      "REMINDERS",
      `Processed ${result.processed}`
    );

  } catch (err) {

    console.error(
      "[JOB:REMINDERS]",
      err
    );
  }
}

/* =========================================================
   EXPORT CLEANUP JOB
========================================================= */

async function runExportCleanupJob() {

  try {

    logJob(
      "EXPORT_CLEANUP",
      "Starting..."
    );

    const result =
      await cleanupExports(24);

    logJob(
      "EXPORT_CLEANUP",
      `Deleted ${result.deleted}`
    );

  } catch (err) {

    console.error(
      "[JOB:EXPORT_CLEANUP]",
      err
    );
  }
}

/* =========================================================
   STRIPE RECON JOB
========================================================= */

async function runStripeReconJob() {

  try {

    logJob(
      "STRIPE_RECON",
      "Starting..."
    );

    /* =====================================
       OPTIONAL:
       Attach active reconciliation id
    ===================================== */

    const reconciliationId =
      null;

    if (
      reconciliationId
    ) {

      await importStripePayments(
        reconciliationId
      );

      await importStripeRefunds(
        reconciliationId
      );
    }

    logJob(
      "STRIPE_RECON",
      "Completed"
    );

  } catch (err) {

    console.error(
      "[JOB:STRIPE_RECON]",
      err
    );
  }
}

/* =========================================================
   DAILY FINANCE SUMMARY
========================================================= */

async function runFinanceSummaryJob() {

  try {

    logJob(
      "FINANCE_SUMMARY",
      "Generating summary..."
    );

    const summary =
      await getFinanceDashboardSummary();

    console.log(
      "[FINANCE SUMMARY]",
      JSON.stringify(
        summary,
        null,
        2
      )
    );

  } catch (err) {

    console.error(
      "[JOB:FINANCE_SUMMARY]",
      err
    );
  }
}

/* =========================================================
   EXECUTIVE KPI JOB
========================================================= */

async function runExecutiveKpiJob() {

  try {

    logJob(
      "EXECUTIVE_KPI",
      "Generating..."
    );

    const data =
      await getExecutiveDashboard();

    console.log(
      "[EXECUTIVE KPI]",
      JSON.stringify(
        data,
        null,
        2
      )
    );

  } catch (err) {

    console.error(
      "[JOB:EXECUTIVE_KPI]",
      err
    );
  }
}

/* =========================================================
   REGISTER ALL JOBS
========================================================= */

function registerScheduledJobs() {

  /* =====================================
     EVERY 5 MINUTES
  ===================================== */

  cron.schedule(

    "*/5 * * * *",

    async () => {

      await runReminderJob();
    }
  );

  /* =====================================
     DAILY EXPORT CLEANUP
     2:00 AM
  ===================================== */

  cron.schedule(

    "0 2 * * *",

    async () => {

      await runExportCleanupJob();
    }
  );

  /* =====================================
     STRIPE RECON
     EVERY HOUR
  ===================================== */

  cron.schedule(

    "0 * * * *",

    async () => {

      await runStripeReconJob();
    }
  );

  /* =====================================
     DAILY FINANCE SUMMARY
     6:00 AM
  ===================================== */

  cron.schedule(

    "0 6 * * *",

    async () => {

      await runFinanceSummaryJob();
    }
  );

  /* =====================================
     DAILY EXECUTIVE KPI
     7:00 AM
  ===================================== */

  cron.schedule(

    "0 7 * * *",

    async () => {

      await runExecutiveKpiJob();
    }
  );

  console.log(
    "Scheduled jobs registered."
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  registerScheduledJobs,

  runReminderJob,

  runExportCleanupJob,

  runStripeReconJob,

  runFinanceSummaryJob,

  runExecutiveKpiJob,
};