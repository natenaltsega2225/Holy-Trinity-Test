// backend/routes/membershipReminders.js
"use strict";

const express = require("express");
const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const membershipReminderService = require(
  "../services/domains/membership/membershipReminderService"
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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

function toDateOrNull(value) {
  const text = clean(value, 40);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;

  return text.slice(0, 10);
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
  const fn = membershipReminderService[name];

  if (typeof fn !== "function") {
    const err = new Error(
      `Membership reminder service is missing ${name}().`
    );
    err.statusCode = 501;
    throw err;
  }

  return fn;
}

function optionalServiceFunction(service, names = []) {
  for (const name of names) {
    if (typeof service?.[name] === "function") {
      return service[name];
    }
  }

  return null;
}

function buildReminderOptions(req) {
  const source = {
    ...(req.query || {}),
    ...(req.body || {}),
  };

  return {
    days_ahead: toInt(
      source.days_ahead ?? source.daysAhead,
      30,
      0,
      365
    ),

    grace_days: toInt(
      source.grace_days ?? source.graceDays,
      0,
      0,
      90
    ),

    reminder_cooldown_hours: toInt(
      source.reminder_cooldown_hours ?? source.reminderCooldownHours,
      72,
      1,
      8760
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

    limit: toInt(source.limit, 250, 1, 1000),

    member_id: source.member_id || source.memberId
      ? toInt(source.member_id || source.memberId, null, 1, 999999999)
      : null,

    member_no: clean(source.member_no || source.memberNo, 80) || null,

    email: clean(source.email, 190).toLowerCase() || null,

    status: clean(source.status, 40).toLowerCase() || null,

    from_date:
      toDateOrNull(source.from_date || source.fromDate) || null,

    to_date:
      toDateOrNull(source.to_date || source.toDate) || null,

    reminder_type:
      clean(source.reminder_type || source.reminderType, 60) ||
      "membership_dues",

    include_overdue: toBool(source.include_overdue, true),
    include_open: toBool(source.include_open, true),
    include_partial: toBool(source.include_partial, true),
    include_recently_reminded: toBool(source.include_recently_reminded, false),

    force: toBool(source.force, false),
    force_new_invoice: toBool(source.force_new_invoice || source.forceNewInvoice, false),
    dry_run: toBool(source.dry_run || source.dryRun, false),

    send_email: toBool(source.send_email ?? source.sendEmail, true),
    create_invoice: toBool(
      source.create_invoice ?? source.createInvoice,
      true
    ),
    create_payment_link: toBool(
      source.create_payment_link ?? source.createPaymentLink,
      true
    ),

    frontend_url:
      clean(
        source.frontend_url ||
          source.frontendUrl ||
          process.env.FRONTEND_URL ||
          process.env.APP_URL,
        500
      ) || null,

    subject: clean(source.subject, 255) || null,
    message: clean(source.message, 5000) || null,
    notes: clean(source.notes, 2000) || null,

    actor: getActor(req),
    created_by:
      req.user?.id ||
      req.user?.user_id ||
      req.auth?.id ||
      null,

    request_id: req.id || req.requestId || null,
  };
}

function normalizeRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.members)) return result.members;
  return [];
}

function amountDue(row = {}) {
  return Number(
    row.balance_due ??
      row.amount_due ??
      row.remaining_amount ??
      row.total_due ??
      row.monthly_amount ??
      row.amount ??
      0
  );
}

function monthLabel(row = {}) {
  if (row.coverage_label) return row.coverage_label;

  const month =
    row.coverage_month ||
    row.month ||
    row.month_name ||
    null;

  const year =
    row.coverage_year ||
    row.year ||
    null;

  if (month && year) return `${month} ${year}`;
  if (month) return String(month);
  if (year) return String(year);

  return null;
}

function buildSummary(rows = []) {
  const memberIds = new Set();
  let totalDue = 0;
  let overdueRows = 0;
  let partialRows = 0;
  let openRows = 0;

  for (const row of rows) {
    if (row.member_id) memberIds.add(String(row.member_id));

    const due = amountDue(row);
    totalDue += due;

    const status = String(
      row.status ||
        row.coverage_status ||
        row.invoice_status ||
        ""
    ).toLowerCase();

    if (status === "overdue") overdueRows += 1;
    if (status === "partial" || status === "partially_paid") partialRows += 1;

    if (
      status === "open" ||
      status === "pending" ||
      status === "unpaid" ||
      status === "due"
    ) {
      openRows += 1;
    }
  }

  return {
    total_rows: rows.length,
    total_members: memberIds.size,
    total_due: Number(totalDue.toFixed(2)),
    overdue_rows: overdueRows,
    partial_rows: partialRows,
    open_rows: openRows,
  };
}

function groupRowsByMember(rows = []) {
  const groups = new Map();

  for (const row of rows) {
    if (Array.isArray(row.items) || Array.isArray(row.dues)) {
      const key = String(row.member_id || row.id || groups.size + 1);
      groups.set(key, row);
      continue;
    }

    const memberId = row.member_id || row.id;
    const key = String(memberId || "unknown");

    if (!groups.has(key)) {
      groups.set(key, {
        member_id: memberId || null,
        member_no: row.member_no || null,
        full_name:
          row.full_name ||
          row.member_name ||
          row.name ||
          "Member",
        email: row.email || null,
        phone: row.phone || null,
        items: [],
        dues: [],
        months: [],
        total_due: 0,
      });
    }

    const group = groups.get(key);
    const due = amountDue(row);
    const label = monthLabel(row);

    group.items.push(row);
    group.dues.push(row);
    group.total_due = Number((Number(group.total_due || 0) + due).toFixed(2));

    if (label && !group.months.includes(label)) {
      group.months.push(label);
    }
  }

  return Array.from(groups.values());
}

async function findDueRows(options) {
  const findMembershipDuesToRemind = requireServiceFunction(
    "findMembershipDuesToRemind"
  );

  const conn = await pool.getConnection();

  try {
    const result =
      findMembershipDuesToRemind.length >= 2
        ? await findMembershipDuesToRemind(conn, options)
        : await findMembershipDuesToRemind(options);

    return normalizeRows(result);
  } finally {
    conn.release();
  }
}

/* -------------------------------------------------------------------------- */
/* Public health                                                              */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  res.json({
    ok: true,
    module: "membershipReminders",
    version: "enterprise",
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
  res.json({
    ok: true,
    reminder_types: [
      "membership_dues",
      "membership_overdue",
      "membership_renewal",
      "membership_final_notice",
    ],
    statuses: [
      "open",
      "pending",
      "partial",
      "unpaid",
      "overdue",
      "due",
    ],
    delivery_channels: [
      "email",
    ],
    supported_actions: [
      "list_due",
      "preview_member",
      "send_member",
      "create_invoice",
      "create_secure_payment_link",
      "process_batch",
      "automation_status",
      "automation_run",
    ],
  });
});

/* -------------------------------------------------------------------------- */
/* Due candidates                                                             */
/* -------------------------------------------------------------------------- */

router.get(
  "/due",
  asyncHandler(async (req, res) => {
    const options = buildReminderOptions(req);
    const rows = await findDueRows(options);

    res.json({
      ok: true,
      filters: options,
      summary: buildSummary(rows),
      rows,
      groups: groupRowsByMember(rows),
    });
  })
);

router.get(
  "/candidates",
  asyncHandler(async (req, res) => {
    const options = buildReminderOptions(req);
    const rows = await findDueRows(options);

    res.json({
      ok: true,
      filters: options,
      summary: buildSummary(rows),
      rows,
      groups: groupRowsByMember(rows),
    });
  })
);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const options = buildReminderOptions(req);
    const rows = await findDueRows(options);

    res.json({
      ok: true,
      filters: options,
      summary: buildSummary(rows),
    });
  })
);

/* -------------------------------------------------------------------------- */
/* Member-specific preview                                                    */
/* -------------------------------------------------------------------------- */

router.get(
  "/members/:memberId/due",
  asyncHandler(async (req, res) => {
    const memberId = toInt(req.params.memberId, 0, 1);

    const options = {
      ...buildReminderOptions(req),
      member_id: memberId,
      limit: 200,
    };

    const rows = await findDueRows(options);
    const groups = groupRowsByMember(rows);

    res.json({
      ok: true,
      member_id: memberId,
      summary: buildSummary(rows),
      group: groups[0] || null,
      rows,
    });
  })
);

router.get(
  "/members/:memberId/preview",
  asyncHandler(async (req, res) => {
    const memberId = toInt(req.params.memberId, 0, 1);

    const options = {
      ...buildReminderOptions(req),
      member_id: memberId,
      limit: 200,
      dry_run: true,
      include_recently_reminded: true,
    };

    const rows = await findDueRows(options);
    const groups = groupRowsByMember(rows);

    res.json({
      ok: true,
      dry_run: true,
      member_id: memberId,
      summary: buildSummary(rows),
      group: groups[0] || null,
      rows,
    });
  })
);

/* -------------------------------------------------------------------------- */
/* Single-member reminder                                                     */
/* -------------------------------------------------------------------------- */

router.post(
  "/members/:memberId/send",
  asyncHandler(async (req, res) => {
    const memberId = toInt(req.params.memberId, 0, 1);

    const sendMembershipReminderForMember = requireServiceFunction(
      "sendMembershipReminderForMember"
    );

    const options = {
      ...buildReminderOptions(req),
      member_id: memberId,
      send_email: true,
      include_recently_reminded: true,
    };

    const result = await sendMembershipReminderForMember(memberId, options);

    res.json({
      ok: true,
      member_id: memberId,
      result,
    });
  })
);

router.post(
  "/send",
  asyncHandler(async (req, res) => {
    const memberId = toInt(req.body?.member_id || req.body?.memberId, 0, 1);

    if (!memberId) {
      return res.status(400).json({
        ok: false,
        error: "member_id is required.",
      });
    }

    const sendMembershipReminderForMember = requireServiceFunction(
      "sendMembershipReminderForMember"
    );

    const options = {
      ...buildReminderOptions(req),
      member_id: memberId,
      send_email: true,
      include_recently_reminded: true,
    };

    const result = await sendMembershipReminderForMember(memberId, options);

    return res.json({
      ok: true,
      member_id: memberId,
      result,
    });
  })
);

/* -------------------------------------------------------------------------- */
/* Create invoice/link without sending email                                  */
/* -------------------------------------------------------------------------- */

router.post(
  "/members/:memberId/invoice",
  asyncHandler(async (req, res) => {
    const memberId = toInt(req.params.memberId, 0, 1);

    const sendMembershipReminderForMember = requireServiceFunction(
      "sendMembershipReminderForMember"
    );

    const options = {
      ...buildReminderOptions(req),
      member_id: memberId,
      send_email: false,
      create_invoice: true,
      create_payment_link: true,
      include_recently_reminded: true,
      force: true,
    };

    const result = await sendMembershipReminderForMember(memberId, options);

    if (result?.skipped) {
      return res.status(404).json({
        ok: false,
        member_id: memberId,
        error: result.reason || "No open membership dues found for this member.",
        result,
      });
    }

    return res.json({
      ok: true,
      member_id: memberId,
      result,
    });
  })
);

router.post(
  "/members/:memberId/link",
  asyncHandler(async (req, res) => {
    const memberId = toInt(req.params.memberId, 0, 1);

    const sendMembershipReminderForMember = requireServiceFunction(
      "sendMembershipReminderForMember"
    );

    const options = {
      ...buildReminderOptions(req),
      member_id: memberId,
      send_email: false,
      create_invoice: true,
      create_payment_link: true,
      include_recently_reminded: true,
      force: true,
    };

    const result = await sendMembershipReminderForMember(memberId, options);

    if (result?.skipped) {
      return res.status(404).json({
        ok: false,
        member_id: memberId,
        error: result.reason || "No open membership dues found for this member.",
        result,
      });
    }

    return res.json({
      ok: true,
      member_id: memberId,
      result,
    });
  })
);

/* -------------------------------------------------------------------------- */
/* Batch processing                                                           */
/* -------------------------------------------------------------------------- */

async function processBatch(req, res) {
  const options = buildReminderOptions(req);

  if (options.dry_run) {
    const rows = await findDueRows(options);

    return res.json({
      ok: true,
      dry_run: true,
      summary: buildSummary(rows),
      groups: groupRowsByMember(rows),
      rows,
    });
  }

  const processMembershipDuesReminders = requireServiceFunction(
    "processMembershipDuesReminders"
  );

  const result = await processMembershipDuesReminders(options);

  return res.json({
    ok: true,
    result,
  });
}

router.post("/process", asyncHandler(processBatch));
router.post("/run", asyncHandler(processBatch));

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

    const options = {
      ...buildReminderOptions(req),
      enabled: true,
      force: toBool(req.body?.force, true),
      dry_run: toBool(req.body?.dry_run || req.body?.dryRun, false),
      membership_enabled: true,
      pledge_reminder_enabled: false,
      pledge_overdue_enabled: false,
      run_key:
        clean(req.body?.run_key || req.body?.runKey, 80) ||
        `membership-manual-${Date.now()}`,
    };

    const result = await runFn(options);

    return res.json({
      ok: true,
      result,
    });
  })
);

router.post(
  "/automation/start",
  asyncHandler(async (req, res) => {
    const startFn = optionalServiceFunction(
      financeReminderAutomationService,
      [
        "startFinanceReminderScheduler",
        "startFinanceReminderAutomation",
        "startScheduler",
        "start",
      ]
    );

    if (!startFn) {
      return res.status(501).json({
        ok: false,
        error: "Finance reminder automation service is not available.",
      });
    }

    const result = startFn({
      ...buildReminderOptions(req),
      enabled: true,
    });

    return res.json({
      ok: true,
      result,
    });
  })
);

router.post(
  "/automation/stop",
  asyncHandler(async (_req, res) => {
    const stopFn = optionalServiceFunction(
      financeReminderAutomationService,
      [
        "stopFinanceReminderScheduler",
        "stopFinanceReminderAutomation",
        "stopScheduler",
        "stop",
      ]
    );

    if (!stopFn) {
      return res.status(501).json({
        ok: false,
        error: "Finance reminder automation service is not available.",
      });
    }

    const result = stopFn();

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
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;

  console.error("membershipReminders route error:", {
    message: err.message,
    statusCode,
    request_id: req.id || req.requestId || null,
  });

  return res.status(statusCode).json({
    ok: false,
    error:
      process.env.NODE_ENV === "production" && statusCode >= 500
        ? "Membership reminder request failed."
        : err.message || "Membership reminder request failed.",
  });
});

module.exports = router;