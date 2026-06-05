//backend\routes\financeCampaigns.js
"use strict";

const express = require("express");
const crypto = require("crypto");

const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const campaignRollupService =
  require("../services/domains/pledge/campaignRollupService");

const campaignDashboardService =
  require("../services/domains/pledge/campaignDashboardService");

const pledgeForecastService =
  require("../services/domains/pledge/pledgeForecastService");

const pledgeAgingService =
  require("../services/domains/pledge/pledgeAgingService");

const pledgeReceivableService =
  require("../services/domains/pledge/pledgeReceivableService");

const pledgeCampaignPerformanceService =
  require("../services/domains/pledge/pledgeCampaignPerformanceService");

const router = express.Router();

router.use(authRequired);

router.use(
  requireRole(
    "finance",
    "admin",
    "super_admin"
  )
);

/* =========================================================
   HELPERS
========================================================= */

function code(prefix) {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function money(v) {
  return Number(
    Number(v || 0).toFixed(2)
  );
}

/* =========================================================
   LIST CAMPAIGNS
========================================================= */

router.get("/", async (req, res) => {
  try {

    const page =
      Number(req.query.page || 1);

    const limit =
      Number(req.query.limit || 25);

    const offset =
      (page - 1) * limit;

    const search =
      req.query.search || "";

    const [rows] = await pool.query(
      `
      SELECT *

      FROM tbl_finance_campaigns

      WHERE
        name LIKE ?
        OR title LIKE ?

      ORDER BY id DESC

      LIMIT ?
      OFFSET ?
      `,
      [
        `%${search}%`,
        `%${search}%`,
        limit,
        offset,
      ]
    );

    const [[count]] =
      await pool.query(
        `
        SELECT COUNT(*) total
        FROM tbl_finance_campaigns
        WHERE
          name LIKE ?
          OR title LIKE ?
        `,
        [
          `%${search}%`,
          `%${search}%`,
        ]
      );

    res.json({
      ok: true,
      rows,
      pagination: {
        page,
        limit,
        total:
          Number(
            count.total || 0
          ),
      },
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      ok: false,
      error:
        "Failed to load campaigns",
    });
  }
});

/* =========================================================
   CREATE CAMPAIGN
========================================================= */

router.post("/", async (req, res) => {

  try {

    const campaignNumber =
      code("CMP");

    const [result] =
      await pool.query(
        `
        INSERT INTO tbl_finance_campaigns
        (
          campaign_number,
          name,
          description,
          goal_amount,
          start_date,
          end_date,
          status,
          created_by,
          created_at
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          campaignNumber,
          req.body.name,
          req.body.description || null,
          money(req.body.goal_amount),
          req.body.start_date || null,
          req.body.end_date || null,
          req.body.status || "active",
          req.user.id,
        ]
      );

    res.status(201).json({
      ok: true,
      campaign_id:
        result.insertId,
      campaign_number:
        campaignNumber,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      ok: false,
      error:
        "Failed to create campaign",
    });
  }
});

/* =========================================================
   UPDATE CAMPAIGN
========================================================= */

router.put("/:id", async (req, res) => {

  try {

    await pool.query(
      `
      UPDATE tbl_finance_campaigns

      SET
        name=?,
        description=?,
        goal_amount=?,
        start_date=?,
        end_date=?,
        status=?,
        updated_at=NOW()

      WHERE id=?
      `,
      [
        req.body.name,
        req.body.description,
        money(req.body.goal_amount),
        req.body.start_date,
        req.body.end_date,
        req.body.status,
        req.params.id,
      ]
    );

    res.json({
      ok: true,
    });

  } catch (err) {

    res.status(500).json({
      ok: false,
      error:
        err.message,
    });
  }
});

/* =========================================================
   CAMPAIGN DETAILS
========================================================= */

router.get("/:id", async (req, res) => {

  try {

    const [[campaign]] =
      await pool.query(
        `
        SELECT *
        FROM tbl_finance_campaigns
        WHERE id=?
        `,
        [req.params.id]
      );

    if (!campaign) {

      return res
        .status(404)
        .json({
          ok: false,
          error:
            "Campaign not found",
        });
    }

    const rollup =
      await campaignRollupService
        .getCampaignRollup(
          req.params.id
        );

    res.json({
      ok: true,
      campaign,
      rollup,
    });

  } catch (err) {

    res.status(500).json({
      ok: false,
      error:
        err.message,
    });
  }
});

/* =========================================================
   CAMPAIGN ROLLUP
========================================================= */

router.get(
  "/:id/rollup",
  async (req, res) => {

    try {

      const data =
        await campaignRollupService
          .getCampaignRollup(
            req.params.id
          );

      res.json({
        ok: true,
        data,
      });

    } catch (err) {

      res.status(500).json({
        ok: false,
        error:
          err.message,
      });
    }
  }
);

/* =========================================================
   DASHBOARD
========================================================= */

router.get(
  "/:id/dashboard",
  async (req, res) => {

    try {

      const dashboard =
        await campaignDashboardService
          .getCampaignDashboard(
            req.params.id
          );

      res.json({
        ok: true,
        dashboard,
      });

    } catch (err) {

      res.status(500).json({
        ok: false,
        error:
          err.message,
      });
    }
  }
);

/* =========================================================
   PERFORMANCE
========================================================= */

router.get(
  "/:id/performance",
  async (req, res) => {

    try {

      const data =
        await pledgeCampaignPerformanceService
          .getCampaignPerformance(
            req.params.id
          );

      res.json({
        ok: true,
        data,
      });

    } catch (err) {

      res.status(500).json({
        ok: false,
        error:
          err.message,
      });
    }
  }
);

/* =========================================================
   AGING
========================================================= */

router.get(
  "/:id/aging",
  async (req, res) => {

    try {

      const data =
        await pledgeAgingService
          .getCampaignAging(
            req.params.id
          );

      res.json({
        ok: true,
        data,
      });

    } catch (err) {

      res.status(500).json({
        ok: false,
        error:
          err.message,
      });
    }
  }
);

/* =========================================================
   RECEIVABLES
========================================================= */

router.get(
  "/:id/receivables",
  async (req, res) => {

    try {

      const data =
        await pledgeReceivableService
          .getCampaignReceivables(
            req.params.id
          );

      res.json({
        ok: true,
        data,
      });

    } catch (err) {

      res.status(500).json({
        ok: false,
        error:
          err.message,
      });
    }
  }
);

/* =========================================================
   FORECAST
========================================================= */

router.get(
  "/:id/forecast",
  async (req, res) => {

    try {

      const data =
        await pledgeForecastService
          .getCampaignForecast(
            req.params.id
          );

      res.json({
        ok: true,
        data,
      });

    } catch (err) {

      res.status(500).json({
        ok: false,
        error:
          err.message,
      });
    }
  }
);

/* =========================================================
   KPI DASHBOARD
========================================================= */

router.get(
  "/:id/kpis",
  async (req, res) => {

    try {

      const rollup =
        await campaignRollupService
          .getCampaignRollup(
            req.params.id
          );

      const performance =
        await pledgeCampaignPerformanceService
          .getCampaignPerformance(
            req.params.id
          );

      res.json({
        ok: true,
        kpis: {
          rollup,
          performance,
        },
      });

    } catch (err) {

      res.status(500).json({
        ok: false,
        error:
          err.message,
      });
    }
  }
);

/* =========================================================
   DELETE
========================================================= */

router.delete("/:id", async (req, res) => {

  try {

    await pool.query(
      `
      UPDATE tbl_finance_campaigns
      SET
        status='inactive',
        updated_at=NOW()
      WHERE id=?
      `,
      [req.params.id]
    );

    res.json({
      ok: true,
    });

  } catch (err) {

    res.status(500).json({
      ok: false,
      error:
        err.message,
    });
  }
});

module.exports = router;