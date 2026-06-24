// backend/routes/pledgeReminders.js
"use strict";

const express = require("express");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const pledgeReminderService = require(
  "../services/domains/pledge/pledgeReminderService"
);

function optionalRequire(path, fallback = {}) {
  try {
    return require(path);
  } catch (_err) {
    return fallback;
  }
}

const financeReminderAutomationService = optionalRequire(
  "../services/financeReminderAutomationService"
);

const router = express.Router();

const FINANCE_ROLES = [
  "finance",
  "admin",
  "super_admin",
];

function clean(value, max = 255) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;

  return ["1", "true", "yes", "y", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function toInt(value, fallback = 0, min = 0, max = 100000) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function getActor(req) {
  return {
    user_id:
      req.user?.id ||
      req.user?.user_id ||
      req.auth?.id ||
      null,

    role:
      req.user?.role ||
      req.user?.user_role ||
      req.auth?.role ||
      null,

    name:
      req.user?.full_name ||
      req.user?.name ||
      req.user?.email ||
      null,

    ip:
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      null,

    user_agent:
      req.headers["user-agent"] || null,
  };
}

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function requireServiceFunction(name) {
  const fn = pledgeReminderService[name];

  if (typeof fn !== "function") {
    const err = new Error(`Pledge reminder service is missing ${name}().`);
    err.statusCode = 501;
    throw err;
  }

  return fn;
}

function optionalServiceFunction(service, names = []) {
  for (const name of names) {
    if (typeof service?.[name] === "function") return service[name];
  }

  return null;
}

function buildOptions(req) {
  const source = {
    ...(req.query || {}),
    ...(req.body || {}),
  };

  return {
    lookAheadDays: toInt(
      source.lookAheadDays ?? source.look_ahead_days,
      14,
      0,
      365
    ),

    days_ahead: toInt(
      source.days_ahead ?? source.daysAhead,
      14,
      0,
      365
    ),

    cooldownDays: toInt(
      source.cooldownDays ?? source.cooldown_days,
      7,
      0,
      365
    ),

    public_link_ttl_days: toInt(
      source.public_link_ttl_days ??
        source.publicLinkTtlDays ??
        source.link_expires_days ??
        source.linkExpiresDays,
      30,
      1,
      365
    ),

    limit: toInt(source.limit, 100, 1, 500),

    pledge_id:
      source.pledge_id || source.pledgeId
        ? toInt(source.pledge_id || source.pledgeId, null, 1, 999999999)
        : null,

    campaign_id:
      source.campaign_id || source.campaignId
        ? toInt(source.campaign_id || source.campaignId, null, 1, 999999999)
        : null,

    member_id:
      source.member_id || source.memberId
        ? toInt(source.member_id || source.memberId, null, 1, 999999999)
        : null,

    email: clean(source.email || source.to, 190).toLowerCase() || null,
    phone: clean(source.phone, 80) || null,
    full_name: clean(source.full_name || source.fullName, 180) || null,

    reminderType:
      clean(source.reminderType || source.reminder_type, 80) ||
      "manual",

    subject: clean(source.subject, 255) || null,
    message: clean(source.message, 5000) || null,
    notes: clean(source.notes, 2000) || null,

    include_overdue: toBool(source.include_overdue, true),
    include_open: toBool(source.include_open, true),
    include_partial: toBool(source.include_partial, true),
    include_members: toBool(source.include_members, true),
    include_non_members: toBool(source.include_non_members, true),

    force: toBool(source.force, false),
    force_new_invoice: toBool(source.force_new_invoice || source.forceNewInvoice, false),
    dryRun: toBool(source.dryRun || source.dry_run, false),
    dry_run: toBool(source.dryRun || source.dry_run, false),

    send_email: toBool(source.send_email ?? source.sendEmail, true),
    create_invoice: toBool(source.create_invoice ?? source.createInvoice, true),
    create_payment_link: toBool(source.create_payment_link ?? source.createPaymentLink, true),

    actor: getActor(req),
    actorId:
      req.user?.id ||
      req.user?.user_id ||
      req.auth?.id ||
      null,

    request_id: req.id || req.requestId || null,
  };
}

function summarize(rows = []) {
  const summary = {
    total: rows.length,
    members: 0,
    non_members: 0,
    with_email: 0,
    missing_email: 0,
    total_due: 0,
    overdue: 0,
    due_today: 0,
    upcoming: 0,
  };

  for (const row of rows) {
    if (row.member_id) summary.members += 1;
    else summary.non_members += 1;

    if (row.email) summary.with_email += 1;
    else summary.missing_email += 1;

    summary.total_due += Number(row.amount_due || 0);

    if (Number(row.days_until_due) < 0) summary.overdue += 1;
    else if (Number(row.days_until_due) === 0) summary.due_today += 1;
    else summary.upcoming += 1;
  }

  summary.total_due = Number(summary.total_due.toFixed(2));

  return summary;
}

/* -------------------------------------------------------------------------- */
/* Public health                                                              */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "pledgeReminders",
    version: "enterprise",
    supports_members: true,
    supports_non_members: true,
    public_invoice_links: true,
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

router.use(authRequired);
router.use(requireRole(...FINANCE_ROLES));

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

router.get("/filters", (_req, res) => {
  return res.json({
    ok: true,
    reminder_types: [
      "manual",
      "auto",
      "before_due",
      "due_today",
      "overdue",
      "final_notice",
    ],
    statuses: [
      "receivable",
      "active",
      "partial",
      "invoiced",
      "open",
      "pending",
      "overdue",
    ],
    donor_types: [
      "member",
      "non_member",
    ],
    supported_actions: [
      "list_candidates",
      "preview",
      "send_one",
      "send_bulk",
      "create_invoice_link",
      "automation_status",
      "automation_run",
    ],
  });
});

/* -------------------------------------------------------------------------- */
/* Candidates                                                                 */
/* -------------------------------------------------------------------------- */

router.get(
  "/candidates",
  asyncHandler(async (req, res) => {
    const getReminderCandidates = requireServiceFunction("getReminderCandidates");
    const options = buildOptions(req);

    const rows = await getReminderCandidates(options);

    return res.json({
      ok: true,
      filters: options,
      summary: summarize(rows),
      rows,
    });
  })
);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const getReminderCandidates = requireServiceFunction("getReminderCandidates");
    const options = buildOptions(req);

    const rows = await getReminderCandidates(options);

    return res.json({
      ok: true,
      filters: options,
      summary: summarize(rows),
    });
  })
);

/* -------------------------------------------------------------------------- */
/* Single pledge                                                              */
/* -------------------------------------------------------------------------- */

router.get(
  "/pledges/:pledgeId",
  asyncHandler(async (req, res) => {
    const pledgeId = toInt(req.params.pledgeId, 0, 1);
    const getPledgeForReminder = requireServiceFunction("getPledgeForReminder");

    const pledge = await getPledgeForReminder(pledgeId, buildOptions(req));

    if (!pledge) {
      return res.status(404).json({
        ok: false,
        error: "Pledge not found.",
      });
    }

    return res.json({
      ok: true,
      pledge,
    });
  })
);

router.get(
  "/pledges/:pledgeId/preview",
  asyncHandler(async (req, res) => {
    const pledgeId = toInt(req.params.pledgeId, 0, 1);
    const getPledgeReminderPreview = requireServiceFunction(
      "getPledgeReminderPreview"
    );

    const result = await getPledgeReminderPreview(pledgeId, {
      ...buildOptions(req),
      force: true,
    });

    return res.status(result.ok === false ? 404 : 200).json(result);
  })
);

router.post(
  "/pledges/:pledgeId/send",
  asyncHandler(async (req, res) => {
    const pledgeId = toInt(req.params.pledgeId, 0, 1);
    const sendPledgeReminder = requireServiceFunction("sendPledgeReminder");

    const result = await sendPledgeReminder({
      ...buildOptions(req),
      pledge_id: pledgeId,
      send_email: true,
    });

    return res.status(result.ok === false ? 400 : 200).json({
      ok: result.ok !== false,
      result,
    });
  })
);

router.post(
  "/pledges/:pledgeId/link",
  asyncHandler(async (req, res) => {
    const pledgeId = toInt(req.params.pledgeId, 0, 1);
    const sendPledgeReminder = requireServiceFunction("sendPledgeReminder");

    const result = await sendPledgeReminder({
      ...buildOptions(req),
      pledge_id: pledgeId,
      send_email: false,
      force: true,
    });

    return res.status(result.ok === false ? 400 : 200).json({
      ok: result.ok !== false,
      result,
    });
  })
);

router.post(
  "/send",
  asyncHandler(async (req, res) => {
    const pledgeId = toInt(req.body?.pledge_id || req.body?.pledgeId, 0, 1);

    if (!pledgeId) {
      return res.status(400).json({
        ok: false,
        error: "pledge_id is required.",
      });
    }

    const sendPledgeReminder = requireServiceFunction("sendPledgeReminder");

    const result = await sendPledgeReminder({
      ...buildOptions(req),
      pledge_id: pledgeId,
      send_email: true,
    });

    return res.status(result.ok === false ? 400 : 200).json({
      ok: result.ok !== false,
      result,
    });
  })
);

/* -------------------------------------------------------------------------- */
/* Batch                                                                      */
/* -------------------------------------------------------------------------- */

async function runBatch(req, res) {
  const options = buildOptions(req);

  if (options.dryRun || options.dry_run) {
    const getReminderCandidates = requireServiceFunction("getReminderCandidates");
    const rows = await getReminderCandidates(options);

    return res.json({
      ok: true,
      dry_run: true,
      filters: options,
      summary: summarize(rows),
      rows,
    });
  }

  const sendBulkPledgeReminders = requireServiceFunction("sendBulkPledgeReminders");
  const result = await sendBulkPledgeReminders(options);

  return res.json({
    ok: result.ok !== false,
    result,
  });
}

router.post("/process", asyncHandler(runBatch));
router.post("/run", asyncHandler(runBatch));
router.post("/batch/send", asyncHandler(runBatch));

/* -------------------------------------------------------------------------- */
/* Automation controls                                                        */
/* -------------------------------------------------------------------------- */

router.get(
  "/automation/status",
  asyncHandler(async (_req, res) => {
    const statusFn = optionalServiceFunction(
      financeReminderAutomationService,
      [
        "getFinanceReminderSchedulerStatus",
        "getFinanceReminderAutomationStatus",
        "status",
      ]
    );

    if (!statusFn) {
      return res.status(501).json({
        ok: false,
        error: "Finance reminder automation service is not available.",
      });
    }

    return res.json({
      ok: true,
      status: statusFn(),
    });
  })
);

router.post(
  "/automation/run",
  asyncHandler(async (req, res) => {
    const runFn = optionalServiceFunction(
      financeReminderAutomationService,
      ["runFinanceReminderAutomation"]
    );

    if (!runFn) {
      return res.status(501).json({
        ok: false,
        error: "Finance reminder automation service is not available.",
      });
    }

    const result = await runFn({
      ...buildOptions(req),
      enabled: true,
      force: toBool(req.body?.force, true),
      membership_enabled: false,
      pledge_reminder_enabled: true,
      pledge_overdue_enabled: true,
      run_key:
        clean(req.body?.run_key || req.body?.runKey, 80) ||
        `pledge-manual-${Date.now()}`,
    });

    return res.json({
      ok: true,
      result,
    });
  })
);

/* -------------------------------------------------------------------------- */
/* Error handler                                                              */
/* -------------------------------------------------------------------------- */

router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const statusCode = err.statusCode || err.status || 500;

  console.error("pledgeReminders route error:", {
    message: err.message,
    statusCode,
    request_id: req.id || req.requestId || null,
  });

  return res.status(statusCode).json({
    ok: false,
    error:
      process.env.NODE_ENV === "production" && statusCode >= 500
        ? "Pledge reminder request failed."
        : err.message || "Pledge reminder request failed.",
  });
});

module.exports = router;