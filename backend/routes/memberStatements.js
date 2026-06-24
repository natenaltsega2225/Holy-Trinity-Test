// backend/routes/memberStatements.js
"use strict";

const express = require("express");
const path = require("path");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const statementService = require("../services/domains/reports/memberStatementService");

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "memberStatements",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

router.use(authRequired);

router.use(
  requireRole(
    "member",
    "finance",
    "admin",
    "super_admin",
    "reconciliation"
  )
);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function role(req) {
  return String(req.user?.role || "").toLowerCase();
}

function isFinanceUser(req) {
  return [
    "finance",
    "admin",
    "super_admin",
    "reconciliation",
  ].includes(role(req));
}

function currentMemberId(req) {
  return (
    Number(
      req.user?.member_id ||
      req.user?.memberId ||
      req.user?.member?.id ||
      0
    ) || null
  );
}

function requestedMemberId(req) {
  return (
    Number(
      req.params.memberId ||
      req.params.member_id ||
      req.query.member_id ||
      req.query.memberId ||
      0
    ) || null
  );
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function resolveAllowedMemberId(req) {
  const requested = requestedMemberId(req);
  const self = currentMemberId(req);

  if (isFinanceUser(req)) {
    const memberId = requested || self;

    if (!memberId) {
      throw httpError(400, "member_id is required.");
    }

    return memberId;
  }

  if (!self) {
    throw httpError(403, "Member profile missing.");
  }

  if (requested && Number(requested) !== Number(self)) {
    throw httpError(403, "Access denied.");
  }

  return self;
}

function normalizeStatementType(value) {
  const type = String(value || "full").trim().toLowerCase();

  if (["monthly", "month"].includes(type)) return "monthly";
  if (["quarterly", "quarter"].includes(type)) return "quarterly";
  if (["annual", "yearly", "year"].includes(type)) return "annual";
  if (["full", "all"].includes(type)) return "full";

  return "full";
}

function normalizeFormat(value) {
  const format = String(value || "xlsx").trim().toLowerCase();

  if (["csv", "json", "xlsx"].includes(format)) {
    return format;
  }

  return "xlsx";
}

function shouldDownload(req) {
  return ["1", "true", "yes", "download"].includes(
    String(req.query.download || "").toLowerCase()
  );
}

function sendRouteError(res, err, fallback) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(fallback, err);
  }

  return res.status(status).json({
    ok: false,
    error: status >= 500 ? fallback : err.message,
  });
}

async function buildStatement(memberId, req, forcedType = null) {
  const type = normalizeStatementType(
    forcedType ||
    req.query.statement_type ||
    req.query.type
  );

  if (type === "monthly") {
    return statementService.getMonthlyStatement(memberId, req.query);
  }

  if (type === "quarterly") {
    return statementService.getQuarterlyStatement(memberId, req.query);
  }

  if (type === "annual") {
    return statementService.getAnnualStatement(memberId, req.query);
  }

  return statementService.getFullMemberStatement(memberId, req.query);
}

async function ensureMemberExists(memberId) {
  const member = await statementService.getMemberProfile(memberId);

  if (!member) {
    throw httpError(404, "Member not found.");
  }

  return member;
}

/* -------------------------------------------------------------------------- */
/* Statement Handlers                                                         */
/* -------------------------------------------------------------------------- */

async function handleStatement(req, res, forcedType = null) {
  try {
    const memberId = await resolveAllowedMemberId(req);

    await ensureMemberExists(memberId);

    const statement = await buildStatement(memberId, req, forcedType);

    return res.json({
      ok: true,
      statement,
    });
  } catch (err) {
    return sendRouteError(res, err, "Failed to load member statement.");
  }
}

async function handleGiving(req, res) {
  try {
    const memberId = await resolveAllowedMemberId(req);
    const member = await ensureMemberExists(memberId);

    const [summary, giving] = await Promise.all([
      statementService.getMemberFinancialSummary(memberId, req.query),
      statementService.getGivingStatement(memberId, req.query),
    ]);

    return res.json({
      ok: true,
      member,
      summary,
      rows: giving,
      total: giving.length,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return sendRouteError(res, err, "Failed to load giving statement.");
  }
}

async function handleMembership(req, res) {
  try {
    const memberId = await resolveAllowedMemberId(req);
    const member = await ensureMemberExists(memberId);

    const rows = await statementService.getMembershipHistory(
      memberId,
      req.query
    );

    return res.json({
      ok: true,
      member,
      rows,
      total: rows.length,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return sendRouteError(res, err, "Failed to load membership statement.");
  }
}

async function handlePrograms(req, res) {
  try {
    const memberId = await resolveAllowedMemberId(req);
    const member = await ensureMemberExists(memberId);

    const rows = await statementService.getMemberProgramHistory(
      memberId,
      req.query
    );

    return res.json({
      ok: true,
      member,
      rows,
      total: rows.length,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return sendRouteError(res, err, "Failed to load program statement.");
  }
}

async function handlePledges(req, res) {
  try {
    const memberId = await resolveAllowedMemberId(req);
    const member = await ensureMemberExists(memberId);

    const rows = await statementService.getMemberPledgeHistory(
      memberId,
      req.query
    );

    return res.json({
      ok: true,
      member,
      rows,
      total: rows.length,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return sendRouteError(res, err, "Failed to load pledge statement.");
  }
}

async function handleExport(req, res, forcedType = null) {
  try {
    const memberId = await resolveAllowedMemberId(req);

    await ensureMemberExists(memberId);

    const format = normalizeFormat(req.query.format);
    const statementType = normalizeStatementType(
      forcedType ||
      req.query.statement_type ||
      req.query.type ||
      "annual"
    );

    const result = await statementService.exportMemberStatement({
      memberId,
      filters: req.query,
      format,
      statementType,
    });

    if (shouldDownload(req) && result.file_path) {
      const fullPath = path.resolve(result.file_path);
      const fileName = result.file_name || path.basename(fullPath);

      return res.download(fullPath, fileName);
    }

    return res.json({
      ok: true,
      export: result,
    });
  } catch (err) {
    return sendRouteError(res, err, "Failed to export member statement.");
  }
}

/* -------------------------------------------------------------------------- */
/* Member Self-Service Routes                                                 */
/* Mounted example: /api/member/statements                                    */
/* -------------------------------------------------------------------------- */

router.get("/", (req, res) => handleStatement(req, res));
router.get("/me", (req, res) => handleStatement(req, res));

router.get("/monthly", (req, res) => handleStatement(req, res, "monthly"));
router.get("/quarterly", (req, res) => handleStatement(req, res, "quarterly"));
router.get("/annual", (req, res) => handleStatement(req, res, "annual"));

router.get("/giving", handleGiving);
router.get("/membership", handleMembership);
router.get("/programs", handlePrograms);
router.get("/pledges", handlePledges);

router.get("/export", (req, res) => handleExport(req, res));

/* -------------------------------------------------------------------------- */
/* Finance/Admin Routes                                                       */
/* Mounted example: /api/finance/statements                                   */
/* -------------------------------------------------------------------------- */

router.get("/member/:memberId", (req, res) => handleStatement(req, res));

router.get("/member/:memberId/monthly", (req, res) =>
  handleStatement(req, res, "monthly")
);

router.get("/member/:memberId/quarterly", (req, res) =>
  handleStatement(req, res, "quarterly")
);

router.get("/member/:memberId/annual", (req, res) =>
  handleStatement(req, res, "annual")
);

router.get("/member/:memberId/giving", handleGiving);
router.get("/member/:memberId/membership", handleMembership);
router.get("/member/:memberId/programs", handlePrograms);
router.get("/member/:memberId/pledges", handlePledges);

router.get("/member/:memberId/export", (req, res) =>
  handleExport(req, res)
);

module.exports = router;