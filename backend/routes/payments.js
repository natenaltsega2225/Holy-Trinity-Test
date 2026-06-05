

// backend/routes/payments.js
"use strict";

const express = require("express");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const {
  listPayments,
  getPaymentById,
  createPayment,
  refundPayment,
  reversePayment,
  reconcilePayment,
  unreconcilePayment,
  getPaymentStats,
} = require("../services/paymentService");

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeCategory(value) {

  const raw =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    [
      "membership",
      "membership_dues",
      "dues",
    ].includes(raw)
  ) {
    return "membership";
  }

  if (
    [
      "donation",
      "giving",
      "tithe",
    ].includes(raw)
  ) {
    return "donation";
  }

  if (
    [
      "school",
      "school_program",
      "kids_school",
    ].includes(raw)
  ) {
    return "school";
  }

  if (
    [
      "trip",
      "travel",
    ].includes(raw)
  ) {
    return "trip";
  }

  return raw;
}

function isFinance(req) {

  return [
    "finance",
    "admin",
    "super_admin",
    "reconciliation",
  ].includes(
    String(req.user?.role || "")
      .toLowerCase()
  );
}

function getMemberId(req) {

  return (
    Number(
      req.user?.member_id ||
      req.user?.memberId ||
      0
    ) || null
  );
}

async function validatePaymentAccess(
  req,
  payment
) {

  if (!payment) {
    return false;
  }

  if (isFinance(req)) {
    return true;
  }

  const memberId =
    getMemberId(req);

  if (!memberId) {
    return false;
  }

  return (
    Number(payment.member_id) ===
    Number(memberId)
  );
}

/* =========================================================
   SECURITY
========================================================= */

router.use(
  authRequired
);

/* =========================================================
   PAYMENT STATS
========================================================= */

router.get(
  "/stats/overview",

  requireRole(
    "finance",
    "admin",
    "super_admin",
    "reconciliation"
  ),

  async (_req, res) => {

    try {

      const stats =
        await getPaymentStats();

      return res.json({

        ok: true,

        stats,
      });

    } catch (err) {

      console.error(
        "payment stats error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load payment statistics.",
      });
    }
  }
);

/* =========================================================
   LIST PAYMENTS
========================================================= */

router.get(
  "/",

  async (req, res) => {

    try {

      const finance =
        isFinance(req);

      const rows =
        await listPayments({

          member_id:
            finance
              ? req.query.member_id
              : getMemberId(req),

          payment_type:
            req.query.payment_type,

          category:
            normalizeCategory(
              req.query.category
            ),

          sub_category:
            req.query.sub_category,

          method:
            req.query.method,

          provider:
            req.query.provider,

          status:
            req.query.status,

          reconciliation_status:
            req.query.reconciliation_status,

          donation_category:
            req.query.donation_category,

          coverage_year:
            req.query.coverage_year,

          plan_name:
            req.query.plan_name,

          program_name:
            req.query.program_name,

          search:
            req.query.search,

          date_from:
            req.query.date_from,

          date_to:
            req.query.date_to,

          page:
            req.query.page,

          limit:
            req.query.limit,
        });

      return res.json({

        ok: true,

        rows:
          rows.rows || rows,

        pagination:
          rows.pagination || null,

        summary:
          rows.summary || null,
      });

    } catch (err) {

      console.error(
        "list payments error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load payments.",
      });
    }
  }
);

/* =========================================================
   MY PAYMENTS
========================================================= */

router.get(
  "/member/me",

  async (req, res) => {

    try {

      const memberId =
        getMemberId(req);

      if (!memberId) {

        return res.status(403).json({

          error:
            "Member account not linked.",
        });
      }

      const rows =
        await listPayments({

          member_id:
            memberId,

          category:
            normalizeCategory(
              req.query.category
            ),

          status:
            req.query.status,

          search:
            req.query.search,

          page:
            req.query.page,

          limit:
            req.query.limit,
        });

      return res.json({

        ok: true,

        rows:
          rows.rows || rows,

        pagination:
          rows.pagination || null,
      });

    } catch (err) {

      console.error(
        "member payments error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load payments.",
      });
    }
  }
);

/* =========================================================
   GET SINGLE PAYMENT
========================================================= */

router.get(
  "/:id",

  async (req, res) => {

    try {

      const payment =
        await getPaymentById(
          req.params.id
        );

      if (!payment) {

        return res.status(404).json({

          error:
            "Payment not found.",
        });
      }

      const allowed =
        await validatePaymentAccess(
          req,
          payment
        );

      if (!allowed) {

        return res.status(403).json({

          error:
            "Access denied.",
        });
      }

      return res.json({

        ok: true,

        payment,
      });

    } catch (err) {

      console.error(
        "get payment error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load payment.",
      });
    }
  }
);

/* =========================================================
   CREATE PAYMENT
========================================================= */

router.post(
  "/",

  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const payload = {

        ...req.body,

        category:
          normalizeCategory(
            req.body.category
          ),

        payment_type:
          normalizeCategory(
            req.body.payment_type ||
            req.body.category
          ),

        created_by:
          req.user?.id,
      };

      const payment =
        await createPayment(
          payload
        );

      return res.status(201).json({

        ok: true,

        payment,
      });

    } catch (err) {

      console.error(
        "create payment error:",
        err
      );

      return res.status(400).json({

        error:
          err.message ||
          "Failed to create payment.",
      });
    }
  }
);

/* =========================================================
   REFUND PAYMENT
========================================================= */

router.post(
  "/:id/refund",

  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const result =
        await refundPayment({

          payment_id:
            req.params.id,

          amount:
            req.body.amount,

          reason:
            clean(
              req.body.reason
            ),

          refunded_by:
            req.user?.id,
        });

      return res.json({

        ok: true,

        result,
      });

    } catch (err) {

      console.error(
        "refund payment error:",
        err
      );

      return res.status(400).json({

        error:
          err.message ||
          "Failed to refund payment.",
      });
    }
  }
);

/* =========================================================
   REVERSE PAYMENT
========================================================= */

router.post(
  "/:id/reverse",

  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const result =
        await reversePayment({

          payment_id:
            req.params.id,

          reason:
            clean(
              req.body.reason
            ),

          reversed_by:
            req.user?.id,
        });

      return res.json({

        ok: true,

        result,
      });

    } catch (err) {

      console.error(
        "reverse payment error:",
        err
      );

      return res.status(400).json({

        error:
          err.message ||
          "Failed to reverse payment.",
      });
    }
  }
);

/* =========================================================
   RECONCILE PAYMENT
========================================================= */

router.post(
  "/:id/reconcile",

  requireRole(
    "finance",
    "admin",
    "super_admin",
    "reconciliation"
  ),

  async (req, res) => {

    try {

      const result =
        await reconcilePayment({

          payment_id:
            req.params.id,

          reconciliation_batch:
            clean(
              req.body.reconciliation_batch
            ),

          reconciled_by:
            req.user?.id,
        });

      return res.json({

        ok: true,

        result,
      });

    } catch (err) {

      console.error(
        "reconcile payment error:",
        err
      );

      return res.status(400).json({

        error:
          err.message ||
          "Failed to reconcile payment.",
      });
    }
  }
);

/* =========================================================
   UNRECONCILE PAYMENT
========================================================= */

router.post(
  "/:id/unreconcile",

  requireRole(
    "finance",
    "admin",
    "super_admin",
    "reconciliation"
  ),

  async (req, res) => {

    try {

      const result =
        await unreconcilePayment({

          payment_id:
            req.params.id,

          unreconciled_by:
            req.user?.id,
        });

      return res.json({

        ok: true,

        result,
      });

    } catch (err) {

      console.error(
        "unreconcile payment error:",
        err
      );

      return res.status(400).json({

        error:
          err.message ||
          "Failed to unreconcile payment.",
      });
    }
  }
);

module.exports = router;