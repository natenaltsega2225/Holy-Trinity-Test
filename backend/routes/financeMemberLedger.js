// backend/routes/financeMemberLedger.js
"use strict";

const express = require("express");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const ledgerService = require("../services/domains/ledger/ledgerService");

const router = express.Router();

router.use(authRequired);

const financeOnly = requireRole("finance", "admin", "super_admin");

function intParam(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function cleanYear(value) {
  const year = Number(value || new Date().getFullYear());
  const current = new Date().getFullYear();

  if (!Number.isFinite(year) || year < 2000 || year > current + 1) {
    return current;
  }

  return Math.floor(year);
}

function routeError(res, err, fallback) {
  console.error(fallback, err);

  return res.status(err.status || err.statusCode || 500).json({
    ok: false,
    error: err.status || err.statusCode ? err.message : fallback,
  });
}

function queryFilters(req, extra = {}) {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(250, Math.max(1, Number(req.query.limit || req.query.pageSize || 50)));

  return {
    ...extra,
    search: req.query.search || req.query.q || "",
    category: req.query.category || "",
    method: req.query.method || req.query.payment_method || "",
    status: req.query.status || "",
    from: req.query.from || req.query.date_from || req.query.start_date || "",
    to: req.query.to || req.query.date_to || req.query.end_date || "",
    year: req.query.year || "",
    page,
    limit,
  };
}

function statementFilename(statement, extension) {
  const memberNo = String(statement.member?.member_no || statement.member?.id || "member")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-+/g, "-");

  return `${statement.year}-holy-trinity-contribution-statement-${memberNo}.${extension}`;
}

async function selfMemberId(req) {
  const memberId = await ledgerService.resolveMemberIdForUser(req.user || {});

  if (!memberId) {
    const err = new Error("Member profile was not found for this account.");
    err.status = 404;
    throw err;
  }

  return memberId;
}

async function sendStatementDownload(res, statement) {
  const rendered = await ledgerService.statementPdfBuffer(statement);
  const filename = statementFilename(statement, rendered.extension || "pdf");

  res.setHeader("Content-Type", rendered.contentType || "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");

  return res.send(rendered.buffer);
}

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/ledger/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "financeMemberLedger",
    version: "enterprise-tax-statement",
    member_routes: [
      "GET /api/member/ledger",
      "GET /api/member/ledger/statement/:year",
      "GET /api/member/ledger/statement/:year/pdf",
      "POST /api/member/ledger/statement/:year/email",
    ],
    finance_routes: [
      "GET /api/finance/member-ledger",
      "GET /api/finance/member-ledger/statements",
      "POST /api/finance/member-ledger/statements/email",
      "GET /api/finance/member-ledger/:memberId",
      "GET /api/finance/member-ledger/:memberId/statement/:year",
      "GET /api/finance/member-ledger/:memberId/statement/:year/pdf",
      "POST /api/finance/member-ledger/:memberId/statement/:year/email",
    ],
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Member Self-Service                                                        */
/* -------------------------------------------------------------------------- */

router.get("/ledger", async (req, res) => {
  try {
    const memberId = await selfMemberId(req);
    const result = await ledgerService.listLedgerEntries(
      queryFilters(req, { member_id: memberId })
    );

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load member ledger.");
  }
});

router.get("/ledger/statement/:year", async (req, res) => {
  try {
    const memberId = await selfMemberId(req);
    const statement = await ledgerService.getMemberYearStatement({
      member_id: memberId,
      year: cleanYear(req.params.year),
    });

    return res.json({
      ok: true,
      statement,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load contribution statement.");
  }
});

router.get("/ledger/statement/:year/html", async (req, res) => {
  try {
    const memberId = await selfMemberId(req);
    const statement = await ledgerService.getMemberYearStatement({
      member_id: memberId,
      year: cleanYear(req.params.year),
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    return res.send(ledgerService.statementHtml(statement));
  } catch (err) {
    return routeError(res, err, "Failed to render contribution statement.");
  }
});

router.get("/ledger/statement/:year/pdf", async (req, res) => {
  try {
    const memberId = await selfMemberId(req);
    const statement = await ledgerService.getMemberYearStatement({
      member_id: memberId,
      year: cleanYear(req.params.year),
    });

    return sendStatementDownload(res, statement);
  } catch (err) {
    return routeError(res, err, "Failed to download contribution statement.");
  }
});

router.post("/ledger/statement/:year/email", async (req, res) => {
  try {
    const memberId = await selfMemberId(req);
    const result = await ledgerService.emailMemberYearStatement({
      member_id: memberId,
      year: cleanYear(req.params.year),
      to: req.body?.to || req.user?.email || null,
      actor_id: req.user?.id || null,
    });

    return res.json({
      ok: true,
      message: "Contribution statement email queued/sent.",
      statement: result.statement,
    });
  } catch (err) {
    return routeError(res, err, "Failed to email contribution statement.");
  }
});

/* -------------------------------------------------------------------------- */
/* Finance Team                                                               */
/* -------------------------------------------------------------------------- */

async function listFinanceLedgerEntries(req, res) {
  try {
    const result = await ledgerService.listLedgerEntries(queryFilters(req));

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load finance member ledger.");
  }
}

async function listFinanceMemberStatements(req, res) {
  try {
    const result = await ledgerService.listMemberYearStatements({
      ...queryFilters(req),
      year: cleanYear(req.query.year),
      only_with_activity:
        req.query.only_with_activity === "1" ||
        req.query.with_activity_only === "1",
    });

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load annual member statements.");
  }
}

async function emailFinanceMemberStatements(req, res) {
  try {
    const year = cleanYear(req.body?.year || req.query.year);
    const ids = Array.isArray(req.body?.member_ids)
      ? req.body.member_ids.map((id) => intParam(id)).filter(Boolean)
      : [];

    if (!ids.length) {
      return res.status(400).json({
        ok: false,
        error: "At least one member id is required.",
      });
    }

    const results = [];

    for (const memberId of ids.slice(0, 250)) {
      try {
        const result = await ledgerService.emailMemberYearStatement({
          member_id: memberId,
          year,
          actor_id: req.user?.id || null,
        });

        results.push({
          member_id: memberId,
          ok: true,
          email: result.statement?.member?.email || null,
        });
      } catch (err) {
        results.push({
          member_id: memberId,
          ok: false,
          error: err.message,
        });
      }
    }

    return res.json({
      ok: true,
      year,
      sent: results.filter((row) => row.ok).length,
      failed: results.filter((row) => !row.ok).length,
      results,
    });
  } catch (err) {
    return routeError(res, err, "Failed to email annual member statements.");
  }
}

async function listFinanceMemberLedger(req, res) {
  try {
    const memberId = intParam(req.params.memberId);

    if (!memberId) {
      return res.status(400).json({
        ok: false,
        error: "Valid member id is required.",
      });
    }

    const result = await ledgerService.listLedgerEntries(
      queryFilters(req, { member_id: memberId })
    );

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load member ledger.");
  }
}

async function getFinanceMemberStatement(req, res) {
  try {
    const memberId = intParam(req.params.memberId);

    if (!memberId) {
      return res.status(400).json({
        ok: false,
        error: "Valid member id is required.",
      });
    }

    const statement = await ledgerService.getMemberYearStatement({
      member_id: memberId,
      year: cleanYear(req.params.year),
    });

    return res.json({
      ok: true,
      statement,
    });
  } catch (err) {
    return routeError(res, err, "Failed to load contribution statement.");
  }
}

async function getFinanceMemberStatementHtml(req, res) {
  try {
    const memberId = intParam(req.params.memberId);

    if (!memberId) {
      return res.status(400).json({
        ok: false,
        error: "Valid member id is required.",
      });
    }

    const statement = await ledgerService.getMemberYearStatement({
      member_id: memberId,
      year: cleanYear(req.params.year),
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    return res.send(ledgerService.statementHtml(statement));
  } catch (err) {
    return routeError(res, err, "Failed to render contribution statement.");
  }
}

async function getFinanceMemberStatementPdf(req, res) {
  try {
    const memberId = intParam(req.params.memberId);

    if (!memberId) {
      return res.status(400).json({
        ok: false,
        error: "Valid member id is required.",
      });
    }

    const statement = await ledgerService.getMemberYearStatement({
      member_id: memberId,
      year: cleanYear(req.params.year),
    });

    return sendStatementDownload(res, statement);
  } catch (err) {
    return routeError(res, err, "Failed to download contribution statement.");
  }
}

async function emailFinanceMemberStatement(req, res) {
  try {
    const memberId = intParam(req.params.memberId);

    if (!memberId) {
      return res.status(400).json({
        ok: false,
        error: "Valid member id is required.",
      });
    }

    const result = await ledgerService.emailMemberYearStatement({
      member_id: memberId,
      year: cleanYear(req.params.year),
      to: req.body?.to || null,
      actor_id: req.user?.id || null,
    });

    return res.json({
      ok: true,
      message: "Contribution statement email queued/sent.",
      statement: result.statement,
    });
  } catch (err) {
    return routeError(res, err, "Failed to email contribution statement.");
  }
}

router.get("/member-ledger", financeOnly, listFinanceLedgerEntries);
router.get("/member-ledger/statements", financeOnly, listFinanceMemberStatements);
router.post("/member-ledger/statements/email", financeOnly, emailFinanceMemberStatements);

/*
  Compatibility aliases:
  - Use these when this router is mounted at /api/finance/member-ledger.
  - The /member-ledger/* routes above work when mounted at /api/finance.
*/
router.get("/", financeOnly, listFinanceLedgerEntries);
router.get("/statements", financeOnly, listFinanceMemberStatements);
router.post("/statements/email", financeOnly, emailFinanceMemberStatements);

router.get("/member-ledger/:memberId", financeOnly, listFinanceMemberLedger);
router.get("/member-ledger/:memberId/statement/:year", financeOnly, getFinanceMemberStatement);
router.get("/member-ledger/:memberId/statement/:year/html", financeOnly, getFinanceMemberStatementHtml);
router.get("/member-ledger/:memberId/statement/:year/pdf", financeOnly, getFinanceMemberStatementPdf);
router.post("/member-ledger/:memberId/statement/:year/email", financeOnly, emailFinanceMemberStatement);

router.get("/:memberId/statement/:year", financeOnly, getFinanceMemberStatement);
router.get("/:memberId/statement/:year/html", financeOnly, getFinanceMemberStatementHtml);
router.get("/:memberId/statement/:year/pdf", financeOnly, getFinanceMemberStatementPdf);
router.post("/:memberId/statement/:year/email", financeOnly, emailFinanceMemberStatement);

module.exports = router;
