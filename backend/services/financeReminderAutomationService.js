// backend/services/financeReminderAutomationService.js
"use strict";

const pool = require("../db");

function optionalRequire(path, fallback = {}) {
  try {
    return require(path);
  } catch (err) {
    console.warn(`Optional finance automation dependency not loaded: ${path}`, err.message);
    return fallback;
  }
}

const membershipReminderService = optionalRequire(
  "./domains/membership/membershipReminderService"
);

const pledgeReminderService = optionalRequire(
  "./domains/pledge/pledgeReminderService"
);

const pledgeAutoReminderProcessor = optionalRequire(
  "./domains/pledge/pledgeAutoReminderProcessor"
);

const pledgeAutoOverdueProcessor = optionalRequire(
  "./domains/pledge/pledgeAutoOverdueProcessor"
);

const DEFAULT_LOCK_NAME = "holy_trinity_finance_reminder_automation";

const state = {
  timer: null,
  enabled: false,
  running: false,
  lastRunKey: null,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastResult: null,
  lastError: null,
  runCount: 0,
  skippedCount: 0,
};

function boolEnv(name, fallback = false) {
  const value = process.env[name];

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function intEnv(name, fallback, min = 0, max = 100000) {
  const parsed = Number.parseInt(process.env[name], 10);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(parsed, min), max);
}

function buildConfig(overrides = {}) {
  return {
    enabled:
      overrides.enabled ??
      boolEnv("FINANCE_REMINDER_AUTOMATION_ENABLED", false),

    run_on_startup:
      overrides.run_on_startup ??
      boolEnv("FINANCE_REMINDER_RUN_ON_STARTUP", false),

    daily_hour:
      overrides.daily_hour ??
      intEnv("FINANCE_REMINDER_DAILY_HOUR", 8, 0, 23),

    daily_minute:
      overrides.daily_minute ??
      intEnv("FINANCE_REMINDER_DAILY_MINUTE", 0, 0, 59),

    tick_seconds:
      overrides.tick_seconds ??
      intEnv("FINANCE_REMINDER_TICK_SECONDS", 60, 15, 3600),

    lock_name:
      overrides.lock_name ||
      process.env.FINANCE_REMINDER_LOCK_NAME ||
      DEFAULT_LOCK_NAME,

    lock_timeout_seconds:
      overrides.lock_timeout_seconds ??
      intEnv("FINANCE_REMINDER_LOCK_TIMEOUT_SECONDS", 2, 0, 60),

    batch_limit:
      overrides.batch_limit ??
      intEnv("FINANCE_REMINDER_BATCH_LIMIT", 250, 1, 2000),

    continue_on_job_error:
      overrides.continue_on_job_error ??
      boolEnv("FINANCE_REMINDER_CONTINUE_ON_JOB_ERROR", true),

    membership_enabled:
      overrides.membership_enabled ??
      boolEnv("MEMBERSHIP_REMINDERS_ENABLED", true),

    membership_days_ahead:
      overrides.membership_days_ahead ??
      intEnv("MEMBERSHIP_DUES_REMINDER_DAYS_AHEAD", 30, 0, 365),

    membership_grace_days:
      overrides.membership_grace_days ??
      intEnv("MEMBERSHIP_DUES_REMINDER_GRACE_DAYS", 0, 0, 90),

    membership_cooldown_hours:
      overrides.membership_cooldown_hours ??
      intEnv("MEMBERSHIP_DUES_REMINDER_COOLDOWN_HOURS", 72, 1, 8760),

    pledge_overdue_enabled:
      overrides.pledge_overdue_enabled ??
      boolEnv("PLEDGE_OVERDUE_PROCESSOR_ENABLED", true),

    pledge_reminder_enabled:
      overrides.pledge_reminder_enabled ??
      boolEnv("PLEDGE_REMINDERS_ENABLED", true),

    pledge_days_ahead:
      overrides.pledge_days_ahead ??
      intEnv("PLEDGE_REMINDER_DAYS_AHEAD", 14, 0, 365),

    pledge_cooldown_days:
      overrides.pledge_cooldown_days ??
      intEnv("PLEDGE_REMINDER_COOLDOWN_DAYS", 7, 0, 365),

    public_link_ttl_days:
      overrides.public_link_ttl_days ??
      intEnv("PUBLIC_INVOICE_LINK_TTL_DAYS", 30, 1, 365),

    frontend_url:
      overrides.frontend_url ||
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      "http://localhost:5173",

    send_email:
      overrides.send_email !== undefined
        ? Boolean(overrides.send_email)
        : true,

    create_invoice:
      overrides.create_invoice !== undefined
        ? Boolean(overrides.create_invoice)
        : true,

    create_payment_link:
      overrides.create_payment_link !== undefined
        ? Boolean(overrides.create_payment_link)
        : true,

    force: Boolean(overrides.force),
    dry_run: Boolean(overrides.dry_run),
  };
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function serializeError(err) {
  if (!err) return null;

  return {
    message: err.message || String(err),
    code: err.code || null,
    stack:
      process.env.NODE_ENV === "production"
        ? null
        : err.stack || null,
  };
}

function findFunction(mod, names = []) {
  for (const name of names) {
    if (typeof mod?.[name] === "function") {
      return mod[name];
    }
  }

  return null;
}

function shouldRunNow(config, now = new Date()) {
  const key = dateKey(now);

  if (state.running) return false;
  if (state.lastRunKey === key && !config.force) return false;

  const hour = now.getHours();
  const minute = now.getMinutes();

  if (hour > config.daily_hour) return true;

  return hour === config.daily_hour && minute >= config.daily_minute;
}

async function withMysqlLock(lockName, timeoutSeconds, fn) {
  const conn = await pool.getConnection();

  try {
    const [[lockRow]] = await conn.query(
      "SELECT GET_LOCK(?, ?) AS acquired",
      [lockName, timeoutSeconds]
    );

    if (Number(lockRow?.acquired || 0) !== 1) {
      state.skippedCount += 1;

      return {
        ok: true,
        skipped: true,
        reason: "Another finance reminder automation run is active.",
      };
    }

    try {
      return await fn(conn);
    } finally {
      await conn.query("SELECT RELEASE_LOCK(?) AS released", [lockName]);
    }
  } finally {
    conn.release();
  }
}

function systemActor() {
  return {
    user_id: null,
    role: "system",
    name: "Holy Trinity Finance Automation",
    ip: null,
    user_agent: "finance-reminder-automation",
  };
}

/* -------------------------------------------------------------------------- */
/* Optional run log                                                           */
/* -------------------------------------------------------------------------- */

async function automationRunTableExists(conn) {
  try {
    const [rows] = await conn.query(
      "SHOW TABLES LIKE 'tbl_finance_automation_runs'"
    );

    return rows.length > 0;
  } catch (_err) {
    return false;
  }
}

async function findExistingRun(conn, jobName, runKey) {
  if (!(await automationRunTableExists(conn))) return null;

  const [rows] = await conn.query(
    `
    SELECT id, job_name, run_key, status, started_at, finished_at
    FROM tbl_finance_automation_runs
    WHERE job_name = ?
      AND run_key = ?
    LIMIT 1
    `,
    [jobName, runKey]
  );

  return rows[0] || null;
}

async function createAutomationRun(conn, payload = {}) {
  if (!(await automationRunTableExists(conn))) return null;

  const [result] = await conn.query(
    `
    INSERT INTO tbl_finance_automation_runs
    (
      job_name,
      run_key,
      status,
      started_at,
      options_json,
      created_at,
      updated_at
    )
    VALUES (?, ?, 'running', NOW(), ?, NOW(), NOW())
    `,
    [
      payload.job_name,
      payload.run_key,
      JSON.stringify(payload.options || {}),
    ]
  );

  return result.insertId;
}

async function finishAutomationRun(conn, runId, payload = {}) {
  if (!runId) return;

  await conn.query(
    `
    UPDATE tbl_finance_automation_runs
    SET
      status = ?,
      finished_at = NOW(),
      result_json = ?,
      error_json = ?,
      updated_at = NOW()
    WHERE id = ?
    `,
    [
      payload.status || "completed",
      JSON.stringify(payload.result || null),
      JSON.stringify(payload.error || null),
      runId,
    ]
  );
}

/* -------------------------------------------------------------------------- */
/* Job wrapper                                                                */
/* -------------------------------------------------------------------------- */

async function runJob(name, fn, config) {
  const startedAt = new Date();

  if (typeof fn !== "function") {
    return {
      ok: true,
      skipped: true,
      module: name,
      reason: "Job function not available.",
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
    };
  }

  try {
    const result = await fn();

    return {
      ok: result?.ok !== false && result?.success !== false,
      module: name,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      result,
    };
  } catch (err) {
    const error = serializeError(err);

    if (!config.continue_on_job_error) {
      throw err;
    }

    return {
      ok: false,
      module: name,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      error,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Jobs                                                                       */
/* -------------------------------------------------------------------------- */

async function runMembershipReminderJob(config) {
  if (!config.membership_enabled) {
    return {
      ok: true,
      skipped: true,
      module: "membership",
      reason: "Membership reminders disabled.",
    };
  }

  const fn = membershipReminderService.processMembershipDuesReminders;

  return runJob(
    "membership",
    fn
      ? () =>
          fn({
            days_ahead: config.membership_days_ahead,
            grace_days: config.membership_grace_days,
            reminder_cooldown_hours: config.membership_cooldown_hours,
            public_link_ttl_days: config.public_link_ttl_days,
            limit: config.batch_limit,

            send_email: config.send_email,
            create_invoice: config.create_invoice,
            create_payment_link: config.create_payment_link,

            include_open: true,
            include_partial: true,
            include_overdue: true,

            reminder_type: "membership_dues",
            frontend_url: config.frontend_url,
            dry_run: config.dry_run,
            force: config.force,

            actor: systemActor(),
            created_by: null,
            request_id: `membership-auto-${Date.now()}`,
          })
      : null,
    config
  );
}

async function runPledgeOverdueJob(config) {
  if (!config.pledge_overdue_enabled) {
    return {
      ok: true,
      skipped: true,
      module: "pledge_overdue",
      reason: "Pledge overdue processor disabled.",
    };
  }

  const fn = findFunction(pledgeAutoOverdueProcessor, [
    "processAutoOverduePledges",
    "runPledgeAutoOverdueProcessor",
    "run",
  ]);

  return runJob(
    "pledge_overdue",
    fn
      ? () =>
          fn({
            limit: config.batch_limit,
            dry_run: config.dry_run,
            force: config.force,
            actor: systemActor(),
            request_id: `pledge-overdue-auto-${Date.now()}`,
          })
      : null,
    config
  );
}

async function runPledgeReminderJob(config) {
  if (!config.pledge_reminder_enabled) {
    return {
      ok: true,
      skipped: true,
      module: "pledge_reminders",
      reason: "Pledge reminders disabled.",
    };
  }

  const directFn = findFunction(pledgeReminderService, [
    "sendBulkPledgeReminders",
    "sendPledgeReminderBatch",
  ]);

  const processorFn = findFunction(pledgeAutoReminderProcessor, [
    "processAutoReminders",
    "runPledgeAutoReminderProcessor",
    "run",
  ]);

  const fn = directFn || processorFn;

  return runJob(
    "pledge_reminders",
    fn
      ? () =>
          fn({
            lookAheadDays: config.pledge_days_ahead,
            days_ahead: config.pledge_days_ahead,
            cooldownDays: config.pledge_cooldown_days,
            public_link_ttl_days: config.public_link_ttl_days,
            limit: config.batch_limit,

            send_email: config.send_email,
            create_invoice: config.create_invoice,
            create_payment_link: config.create_payment_link,

            include_overdue: true,
            include_open: true,
            include_partial: true,
            include_members: true,
            include_non_members: true,

            reminderType: "auto",
            reminder_type: "pledge_reminder",

            frontend_url: config.frontend_url,
            dryRun: config.dry_run,
            dry_run: config.dry_run,
            force: config.force,

            actor: systemActor(),
            actorId: null,
            request_id: `pledge-reminder-auto-${Date.now()}`,
          })
      : null,
    config
  );
}

/* -------------------------------------------------------------------------- */
/* Main runner                                                                */
/* -------------------------------------------------------------------------- */

function summarizeJobs(jobs = {}) {
  const values = Object.values(jobs);

  return {
    ok: values.every((job) => job?.ok !== false),
    total_jobs: values.length,
    failed_jobs: values.filter((job) => job?.ok === false).length,
    skipped_jobs: values.filter((job) => job?.skipped).length,
  };
}

async function runFinanceReminderAutomation(overrides = {}) {
  const config = buildConfig(overrides);
  const runKey = overrides.run_key || dateKey(new Date());
  const jobName = "finance_reminder_automation";

  if (state.running) {
    state.skippedCount += 1;

    return {
      ok: true,
      skipped: true,
      reason: "Finance reminder automation is already running.",
    };
  }

  state.running = true;
  state.lastStartedAt = new Date().toISOString();
  state.lastError = null;

  return withMysqlLock(
    config.lock_name,
    config.lock_timeout_seconds,
    async (conn) => {
      let runId = null;

      try {
        if (!config.force && !config.dry_run) {
          const existing = await findExistingRun(conn, jobName, runKey);

          if (existing) {
            state.skippedCount += 1;

            return {
              ok: true,
              skipped: true,
              reason: "Finance reminder automation already ran for this run key.",
              existing_run: existing,
            };
          }
        }

        if (!config.dry_run) {
          runId = await createAutomationRun(conn, {
            job_name: jobName,
            run_key: runKey,
            options: {
              ...config,
              public_invoice_token_secret_configured: Boolean(
                process.env.PUBLIC_INVOICE_TOKEN_SECRET
              ),
            },
          });
        }

        const startedAt = new Date();

        const membership = await runMembershipReminderJob(config);
        const pledgeOverdue = await runPledgeOverdueJob(config);
        const pledgeReminders = await runPledgeReminderJob(config);

        const jobs = {
          membership,
          pledge_overdue: pledgeOverdue,
          pledge_reminders: pledgeReminders,
        };

        const summary = summarizeJobs(jobs);

        const result = {
          ok: summary.ok,
          run_key: runKey,
          dry_run: config.dry_run,
          started_at: startedAt.toISOString(),
          finished_at: new Date().toISOString(),
          summary,
          jobs,
        };

        if (!config.dry_run) {
          await finishAutomationRun(conn, runId, {
            status: summary.ok ? "completed" : "completed_with_errors",
            result,
          });
        }

        state.runCount += 1;
        state.lastRunKey = runKey;
        state.lastResult = result;
        state.lastFinishedAt = new Date().toISOString();

        return result;
      } catch (err) {
        const error = serializeError(err);

        if (!config.dry_run) {
          await finishAutomationRun(conn, runId, {
            status: "failed",
            error,
          });
        }

        state.lastError = error;
        state.lastFinishedAt = new Date().toISOString();

        throw err;
      }
    }
  )
    .finally(() => {
      state.running = false;
    });
}

/* -------------------------------------------------------------------------- */
/* Scheduler                                                                  */
/* -------------------------------------------------------------------------- */

function startFinanceReminderScheduler(overrides = {}) {
  const config = buildConfig(overrides);

  if (!config.enabled) {
    state.enabled = false;

    return {
      ok: true,
      enabled: false,
      message:
        "Finance reminder automation is disabled. Set FINANCE_REMINDER_AUTOMATION_ENABLED=true to enable.",
    };
  }

  if (state.timer) {
    return {
      ok: true,
      enabled: true,
      already_started: true,
      state: getFinanceReminderSchedulerStatus(),
    };
  }

  state.enabled = true;

  const tick = async () => {
    const currentConfig = buildConfig(overrides);

    if (!currentConfig.enabled) return;
    if (!shouldRunNow(currentConfig)) return;

    try {
      await runFinanceReminderAutomation({
        ...currentConfig,
        run_key: dateKey(new Date()),
      });
    } catch (err) {
      console.error("Finance reminder automation failed:", serializeError(err));
    }
  };

  state.timer = setInterval(tick, config.tick_seconds * 1000);
  state.timer.unref?.();

  if (config.run_on_startup) {
    setTimeout(() => {
      runFinanceReminderAutomation({
        ...config,
        run_key: dateKey(new Date()),
      }).catch((err) => {
        console.error(
          "Startup finance reminder automation failed:",
          serializeError(err)
        );
      });
    }, 5000).unref?.();
  }

  return {
    ok: true,
    enabled: true,
    config,
    state: getFinanceReminderSchedulerStatus(),
  };
}

function stopFinanceReminderScheduler() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  state.enabled = false;

  return {
    ok: true,
    stopped: true,
    state: getFinanceReminderSchedulerStatus(),
  };
}

function getFinanceReminderSchedulerStatus() {
  return {
    enabled: state.enabled,
    running: state.running,
    has_timer: Boolean(state.timer),
    last_run_key: state.lastRunKey,
    last_started_at: state.lastStartedAt,
    last_finished_at: state.lastFinishedAt,
    last_result: state.lastResult,
    last_error: state.lastError,
    run_count: state.runCount,
    skipped_count: state.skippedCount,
  };
}

module.exports = {
  buildConfig,

  runFinanceReminderAutomation,

  startFinanceReminderScheduler,
  startFinanceReminderAutomation: startFinanceReminderScheduler,
  startScheduler: startFinanceReminderScheduler,
  start: startFinanceReminderScheduler,

  stopFinanceReminderScheduler,
  stopFinanceReminderAutomation: stopFinanceReminderScheduler,
  stopScheduler: stopFinanceReminderScheduler,
  stop: stopFinanceReminderScheduler,

  getFinanceReminderSchedulerStatus,
  getFinanceReminderAutomationStatus: getFinanceReminderSchedulerStatus,
  status: getFinanceReminderSchedulerStatus,

  runMembershipReminderJob,
  runPledgeOverdueJob,
  runPledgeReminderJob,
};