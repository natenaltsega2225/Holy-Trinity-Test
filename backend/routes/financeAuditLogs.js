// backend/routes/financeAuditLogs.js
"use strict";

const express =
  require("express");

const {
  authRequired,
  requireRole,
} = require(
  "../middleware/auth"
);

const pool =
  require("../db");

const router =
  express.Router();

/* =========================================================
   SECURITY
========================================================= */

router.use(
  authRequired
);

router.use(
  requireRole(
    "finance",
    "admin",
    "super_admin",
    "reconciliation"
  )
);

/* =========================================================
   GET AUDIT LOGS
========================================================= */

router.get(
  "/",

  async (
    req,
    res
  ) => {

    try {

      const where =
        [];

      const params =
        [];

      if (
        req.query.search
      ) {

        where.push(`
          (
            action_type LIKE ?
            OR entity_type LIKE ?
            OR ip_address LIKE ?
          )
        `);

        const q =
          `%${req.query.search}%`;

        params.push(
          q,
          q,
          q
        );
      }

      if (
        req.query.actor_id
      ) {

        where.push(
          "actor_id = ?"
        );

        params.push(
          req.query.actor_id
        );
      }

      if (
        req.query.action_type
      ) {

        where.push(
          "action_type LIKE ?"
        );

        params.push(
          `%${req.query.action_type}%`
        );
      }

      if (
        req.query.entity_type
      ) {

        where.push(
          "entity_type LIKE ?"
        );

        params.push(
          `%${req.query.entity_type}%`
        );
      }

      if (
        req.query.date_from
      ) {

        where.push(
          "DATE(created_at) >= DATE(?)"
        );

        params.push(
          req.query.date_from
        );
      }

      if (
        req.query.date_to
      ) {

        where.push(
          "DATE(created_at) <= DATE(?)"
        );

        params.push(
          req.query.date_to
        );
      }

      const whereSql =
        where.length
          ? `WHERE ${where.join(" AND ")}`
          : "";

      const [rows] =
        await pool.query(
          `
          SELECT *
          FROM tbl_audit_logs
          ${whereSql}
          ORDER BY created_at DESC
          LIMIT 500
          `,
          params
        );

      const [[stats]] =
        await pool.query(
          `
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN action_type LIKE '%reverse%' THEN 1 ELSE 0 END) AS reversals,
            SUM(CASE WHEN action_type LIKE '%export%' THEN 1 ELSE 0 END) AS exports,
            SUM(CASE WHEN action_type LIKE '%reconcile%' THEN 1 ELSE 0 END) AS reconciliations
          FROM tbl_audit_logs
          `
        );

      return res.json({

        ok: true,

        rows,

        stats,
      });

    } catch (err) {

      console.error(
        "finance audit logs error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to load audit logs.",
      });
    }
  }
);

/* =========================================================
   SINGLE AUDIT LOG
========================================================= */

router.get(
  "/:id",

  async (
    req,
    res
  ) => {

    try {

      const [[row]] =
        await pool.query(
          `
          SELECT *
          FROM tbl_audit_logs
          WHERE id = ?
          LIMIT 1
          `,
          [
            req.params.id,
          ]
        );

      if (!row) {

        return res.status(404).json({

          ok: false,

          error:
            "Audit log not found.",
        });
      }

      return res.json({

        ok: true,

        row,
      });

    } catch (err) {

      console.error(
        "single audit log error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to load audit log.",
      });
    }
  }
);

/* =========================================================
   AUDIT STATS
========================================================= */

router.get(
  "/stats/overview",

  async (
    req,
    res
  ) => {

    try {

      const [[stats]] =
        await pool.query(
          `
          SELECT
            COUNT(*) AS total,
            COUNT(DISTINCT actor_id) AS actors,
            COUNT(DISTINCT entity_type) AS entities,
            MAX(created_at) AS latest_activity
          FROM tbl_audit_logs
          `
        );

      return res.json({

        ok: true,

        stats,
      });

    } catch (err) {

      console.error(
        "audit stats error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to load audit stats.",
      });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

router.get(
  "/export",

  async (
    req,
    res
  ) => {

    try {

      const [rows] =
        await pool.query(
          `
          SELECT *
          FROM tbl_audit_logs
          ORDER BY created_at DESC
          LIMIT 5000
          `
        );

      return res.json({

        ok: true,

        exported_at:
          new Date().toISOString(),

        total:
          rows.length,

        rows,
      });

    } catch (err) {

      console.error(
        "audit export error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to export audit logs.",
      });
    }
  }
);

module.exports =
  router;