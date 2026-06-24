// backend/services/domains/jobs/scheduledJobsService.js
"use strict";

const cron = require("node-cron");

const DEFAULT_TIMEZONE =
  process.env.JOBS_TIMEZONE ||
  process.env.TZ ||
  "America/Chicago";

const jobs = new Map();
const running = new Set();
const lastRuns = new Map();

/* -------------------------------------------------------------------------- */
/* Safe Module Loading                                                        */
/* -------------------------------------------------------------------------- */

function optionalRequire(label, path) {
  try {
    return require(path);
  } catch (err) {
    console.warn(`Scheduled job dependency not loaded: ${label}`, err.message);

    return {};
  }
}

function getReminderService() {
  return optionalRequire(
    "notifications/reminderService",
    "../notifications/reminderService"
  );
}

function getFinanceReminderAutomationService() {
  return optionalRequire(
    "financeReminderAutomationService",
    "../../financeReminderAutomationService"
  );
}

function getExportService() {
  return optionalRequire(
    "export/exportService",
    "../export/exportService"
  );
}

function getStripeReconciliationService() {
  return optionalRequire(
    "reconciliation/stripeReconciliationService",
    "../reconciliation/stripeReconciliationService"
  );
}

function getFinanceDashboardService() {
  return optionalRequire(
    "finance/financeDashboardService",
    "../finance/financeDashboardService"
  );
}

function getExecutiveKpiService() {
  const reportsService = optionalRequire(
    "reports/executiveKpiService",
    "../reports/executiveKpiService"
  );

  if (
    typeof reportsService.getExecutiveDashboard === "function" ||
    typeof reportsService.getExecutiveKpis === "function"
  ) {
    return reportsService;
  }

  return optionalRequire(
    "analytics/analyticsDashboardService",
    "../analytics/analyticsDashboardService"
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function boolEnv(name, fallback = false) {
  const value = process.env[name];

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function numberEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
}

function logJob(name, message, payload) {
  const suffix = payload ? ` ${JSON.stringify(payload)}` : "";

  console.log(
    `[JOB:${name}] ${new Date().toISOString()} ${message}${suffix}`
  );
}

function setRunStatus(name, status, extra = {}) {
  lastRuns.set(name, {
    name,
    status,
    ...extra,
    updated_at: new Date().toISOString(),
  });
}

async function withJobLock(name, fn) {
  if (running.has(name)) {
    logJob(name, "Skipped because previous run is still active.");

    return {
      skipped: true,
      reason: "already_running",
    };
  }

  running.add(name);

  const startedAt = Date.now();

  setRunStatus(name, "running", {
    started_at: new Date(startedAt).toISOString(),
  });

  try {
    logJob(name, "Starting.");

    const result = await fn();

    const durationMs = Date.now() - startedAt;

    setRunStatus(name, "success", {
      duration_ms: durationMs,
      result,
      finished_at: new Date().toISOString(),
    });

    logJob(name, "Completed.", {
      duration_ms: durationMs,
    });

    return {
      success: true,
      duration_ms: durationMs,
      result,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    setRunStatus(name, "failed", {
      duration_ms: durationMs,
      error: err.message,
      finished_at: new Date().toISOString(),
    });

    console.error(`[JOB:${name}] Failed:`, err);

    return {
      success: false,
      duration_ms: durationMs,
      error: err.message,
    };
  } finally {
    running.delete(name);
  }
}

function scheduleJob(name, expression, handler, options = {}) {
  if (jobs.has(name)) {
    return jobs.get(name);
  }

  if (!cron.validate(expression)) {
    throw new Error(`Invalid cron expression for ${name}: ${expression}`);
  }

  const task = cron.schedule(
    expression,
    async () => {
      await withJobLock(name, handler);
    },
    {
      scheduled: false,
      timezone: options.timezone || DEFAULT_TIMEZONE,
    }
  );

  jobs.set(name, {
    name,
    expression,
    timezone: options.timezone || DEFAULT_TIMEZONE,
    description: options.description || null,
    enabled: options.enabled !== false,
    task,
  });

  return jobs.get(name);
}

function shouldRegisterJobs() {
  return boolEnv("ENABLE_SCHEDULED_JOBS", true);
}

/* -------------------------------------------------------------------------- */
/* Reminder Jobs                                                              */
/* -------------------------------------------------------------------------- */

async function runReminderJob() {
  return withJobLock("REMINDERS", async () => {
    const reminderService = getReminderService();
    const automationService = getFinanceReminderAutomationService();

    const result = {
      pending_reminders: null,
      finance_automation: null,
    };

    if (typeof reminderService.processPendingReminders === "function") {
      result.pending_reminders = await reminderService.processPendingReminders({
        limit: numberEnv("REMINDER_JOB_LIMIT", 100),
      });
    }

    if (typeof automationService.runFinanceReminderAutomation === "function") {
      result.finance_automation =
        await automationService.runFinanceReminderAutomation({
          source: "scheduled_job",
          limit: numberEnv("FINANCE_REMINDER_JOB_LIMIT", 100),
        });
    } else if (typeof automationService.processFinanceReminders === "function") {
      result.finance_automation =
        await automationService.processFinanceReminders({
          source: "scheduled_job",
          limit: numberEnv("FINANCE_REMINDER_JOB_LIMIT", 100),
        });
    }

    return result;
  });
}

/* -------------------------------------------------------------------------- */
/* Export Cleanup Job                                                         */
/* -------------------------------------------------------------------------- */

async function runExportCleanupJob() {
  return withJobLock("EXPORT_CLEANUP", async () => {
    const exportService = getExportService();

    if (typeof exportService.cleanupExports !== "function") {
      return {
        skipped: true,
        reason: "cleanupExports is not available",
      };
    }

    return exportService.cleanupExports(
      numberEnv("EXPORT_RETENTION_HOURS", 24)
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Stripe Reconciliation Job                                                  */
/* -------------------------------------------------------------------------- */

async function runStripeReconJob() {
  return withJobLock("STRIPE_RECON", async () => {
    const service = getStripeReconciliationService();

    const reconciliationId =
      clean(process.env.ACTIVE_STRIPE_RECONCILIATION_ID, 80) || null;

    if (!reconciliationId) {
      return {
        skipped: true,
        reason: "ACTIVE_STRIPE_RECONCILIATION_ID is not set",
      };
    }

    const result = {
      payments: null,
      refunds: null,
    };

    if (typeof service.importStripePayments === "function") {
      result.payments = await service.importStripePayments(reconciliationId);
    }

    if (typeof service.importStripeRefunds === "function") {
      result.refunds = await service.importStripeRefunds(reconciliationId);
    }

    return result;
  });
}

/* -------------------------------------------------------------------------- */
/* Finance Summary Job                                                        */
/* -------------------------------------------------------------------------- */

async function runFinanceSummaryJob() {
  return withJobLock("FINANCE_SUMMARY", async () => {
    const service = getFinanceDashboardService();

    if (typeof service.getFinanceDashboardSummary !== "function") {
      return {
        skipped: true,
        reason: "getFinanceDashboardSummary is not available",
      };
    }

    const summary = await service.getFinanceDashboardSummary({
      period: "today",
      source: "scheduled_job",
    });

    logJob("FINANCE_SUMMARY", "Summary generated.", {
      total_revenue: summary?.kpis?.total_revenue,
      total_transactions: summary?.kpis?.total_transactions,
    });

    return summary;
  });
}

/* -------------------------------------------------------------------------- */
/* Executive KPI Job                                                          */
/* -------------------------------------------------------------------------- */

async function runExecutiveKpiJob() {
  return withJobLock("EXECUTIVE_KPI", async () => {
    const service = getExecutiveKpiService();

    if (typeof service.getExecutiveDashboard === "function") {
      return service.getExecutiveDashboard({
        source: "scheduled_job",
      });
    }

    if (typeof service.getExecutiveKpis === "function") {
      return service.getExecutiveKpis({
        source: "scheduled_job",
      });
    }

    return {
      skipped: true,
      reason: "Executive KPI service is not available",
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Membership / Pledge Automation                                             */
/* -------------------------------------------------------------------------- */

async function runMembershipOverdueJob() {
  return withJobLock("MEMBERSHIP_OVERDUE", async () => {
    const service = optionalRequire(
      "membership/membershipRenewalService",
      "../membership/membershipRenewalService"
    );

    if (typeof service.processExpiredMemberships !== "function") {
      return {
        skipped: true,
        reason: "processExpiredMemberships is not available",
      };
    }

    return service.processExpiredMemberships();
  });
}

async function runPledgeAutomationJob() {
  return withJobLock("PLEDGE_AUTOMATION", async () => {
    const overdueService = optionalRequire(
      "pledge/pledgeAutoOverdueProcessor",
      "../pledge/pledgeAutoOverdueProcessor"
    );

    const reminderService = optionalRequire(
      "pledge/pledgeAutoReminderProcessor",
      "../pledge/pledgeAutoReminderProcessor"
    );

    const result = {
      overdue: null,
      reminders: null,
    };

    if (typeof overdueService.processAutoOverduePledges === "function") {
      result.overdue = await overdueService.processAutoOverduePledges({
        source: "scheduled_job",
      });
    } else if (typeof overdueService.runPledgeAutoOverdueProcessor === "function") {
      result.overdue = await overdueService.runPledgeAutoOverdueProcessor({
        source: "scheduled_job",
      });
    }

    if (typeof reminderService.processAutoReminders === "function") {
      result.reminders = await reminderService.processAutoReminders({
        source: "scheduled_job",
      });
    } else if (typeof reminderService.runPledgeAutoReminderProcessor === "function") {
      result.reminders = await reminderService.runPledgeAutoReminderProcessor({
        source: "scheduled_job",
      });
    }

    return result;
  });
}

/* -------------------------------------------------------------------------- */
/* Registration                                                               */
/* -------------------------------------------------------------------------- */

function registerScheduledJobs(options = {}) {
  if (!shouldRegisterJobs() && !options.force) {
    console.log("Scheduled jobs disabled by ENABLE_SCHEDULED_JOBS=false.");

    return {
      ok: true,
      enabled: false,
      jobs: [],
    };
  }

  const timezone = options.timezone || DEFAULT_TIMEZONE;

  scheduleJob(
    "REMINDERS",
    process.env.REMINDER_JOB_CRON || "*/5 * * * *",
    async () => runReminderJob(),
    {
      timezone,
      description: "Processes queued reminders and finance reminder automation.",
    }
  );

  scheduleJob(
    "PLEDGE_AUTOMATION",
    process.env.PLEDGE_AUTOMATION_JOB_CRON || "*/15 * * * *",
    async () => runPledgeAutomationJob(),
    {
      timezone,
      description: "Processes overdue pledge status and pledge reminder queue.",
    }
  );

  scheduleJob(
    "MEMBERSHIP_OVERDUE",
    process.env.MEMBERSHIP_OVERDUE_JOB_CRON || "0 1 * * *",
    async () => runMembershipOverdueJob(),
    {
      timezone,
      description: "Marks expired memberships and renewal status.",
    }
  );

  scheduleJob(
    "EXPORT_CLEANUP",
    process.env.EXPORT_CLEANUP_JOB_CRON || "0 2 * * *",
    async () => runExportCleanupJob(),
    {
      timezone,
      description: "Deletes old generated export files.",
    }
  );

  scheduleJob(
    "STRIPE_RECON",
    process.env.STRIPE_RECON_JOB_CRON || "0 * * * *",
    async () => runStripeReconJob(),
    {
      timezone,
      description: "Imports Stripe payments/refunds into reconciliation when configured.",
    }
  );

  scheduleJob(
    "FINANCE_SUMMARY",
    process.env.FINANCE_SUMMARY_JOB_CRON || "0 6 * * *",
    async () => runFinanceSummaryJob(),
    {
      timezone,
      description: "Generates daily finance dashboard summary.",
    }
  );

  scheduleJob(
    "EXECUTIVE_KPI",
    process.env.EXECUTIVE_KPI_JOB_CRON || "0 7 * * *",
    async () => runExecutiveKpiJob(),
    {
      timezone,
      description: "Generates executive KPI snapshot.",
    }
  );

  for (const job of jobs.values()) {
    if (job.enabled) {
      job.task.start();
    }
  }

  console.log(
    `Scheduled jobs registered: ${Array.from(jobs.keys()).join(", ")}`
  );

  return {
    ok: true,
    enabled: true,
    timezone,
    jobs: listScheduledJobs(),
  };
}

function stopScheduledJobs() {
  for (const job of jobs.values()) {
    job.task.stop();
  }

  return {
    ok: true,
    stopped: jobs.size,
  };
}

function destroyScheduledJobs() {
  for (const job of jobs.values()) {
    job.task.stop();
    job.task.destroy();
  }

  jobs.clear();
  running.clear();

  return {
    ok: true,
  };
}

function listScheduledJobs() {
  return Array.from(jobs.values()).map((job) => ({
    name: job.name,
    expression: job.expression,
    timezone: job.timezone,
    description: job.description,
    enabled: job.enabled,
    running: running.has(job.name),
    last_run: lastRuns.get(job.name) || null,
  }));
}

async function runJobByName(name) {
  const key = clean(name, 80).toUpperCase();

  const runners = {
    REMINDERS: runReminderJob,
    EXPORT_CLEANUP: runExportCleanupJob,
    STRIPE_RECON: runStripeReconJob,
    FINANCE_SUMMARY: runFinanceSummaryJob,
    EXECUTIVE_KPI: runExecutiveKpiJob,
    MEMBERSHIP_OVERDUE: runMembershipOverdueJob,
    PLEDGE_AUTOMATION: runPledgeAutomationJob,
  };

  if (!runners[key]) {
    throw new Error(`Unknown scheduled job: ${name}`);
  }

  return runners[key]();
}

function getScheduledJobHealth() {
  return {
    ok: true,
    enabled: shouldRegisterJobs(),
    timezone: DEFAULT_TIMEZONE,
    registered_jobs: jobs.size,
    running: Array.from(running),
    jobs: listScheduledJobs(),
    timestamp: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

module.exports = {
  registerScheduledJobs,
  stopScheduledJobs,
  destroyScheduledJobs,
  listScheduledJobs,
  runJobByName,
  getScheduledJobHealth,

  runReminderJob,
  runExportCleanupJob,
  runStripeReconJob,
  runFinanceSummaryJob,
  runExecutiveKpiJob,
  runMembershipOverdueJob,
  runPledgeAutomationJob,
};