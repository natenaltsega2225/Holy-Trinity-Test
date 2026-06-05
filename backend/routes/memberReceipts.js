// backend/routes/memberReceipts.js
"use strict";

const express = require("express");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const {
  listReceipts,
  getReceiptById,
  getReceiptByNumber,
} = require("../services/domains/receipts/receiptService");

const router = express.Router();

router.use(authRequired);

router.use(
  requireRole(
    "member",
    "finance",
    "admin",
    "super_admin"
  )
);

function memberId(req) {
  return Number(
    req.user?.member_id ||
    req.user?.memberId ||
    0
  ) || null;
}

function isFinance(req) {
  return ["finance", "admin", "super_admin"].includes(
    String(req.user?.role || "").toLowerCase()
  );
}

async function validateAccess(req, receipt) {
  if (!receipt) return false;
  if (isFinance(req)) return true;

  const mid = memberId(req);
  if (!mid) return false;

  return Number(receipt.member_id) === Number(mid);
}

async function listMyReceipts(req, res) {
  try {
    const mid = memberId(req);

    if (!mid) {
      return res.status(403).json({
        error: "Member profile missing.",
      });
    }

    const rows = await listReceipts({
      member_id: mid,
      category: req.query.category,
      status: req.query.status,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.json({
      ok: true,
      rows,
    });
  } catch (err) {
    console.error("member receipts list error:", err);

    return res.status(500).json({
      error: "Failed to load receipts.",
    });
  }
}

router.get("/me", listMyReceipts);
router.get("/receipts", listMyReceipts);

router.get("/number/:receiptNumber", async (req, res) => {
  try {
    const receipt = await getReceiptByNumber(
      req.params.receiptNumber
    );

    if (!receipt) {
      return res.status(404).json({
        error: "Receipt not found.",
      });
    }

    const allowed = await validateAccess(req, receipt);

    if (!allowed) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    return res.json({
      ok: true,
      receipt,
    });
  } catch (err) {
    console.error("member receipt lookup error:", err);

    return res.status(500).json({
      error: "Failed to load receipt.",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const receipt = await getReceiptById(req.params.id);

    if (!receipt) {
      return res.status(404).json({
        error: "Receipt not found.",
      });
    }

    const allowed = await validateAccess(req, receipt);

    if (!allowed) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    return res.json({
      ok: true,
      receipt,
    });
  } catch (err) {
    console.error("member receipt get error:", err);

    return res.status(500).json({
      error: "Failed to load receipt.",
    });
  }
});

module.exports = router;