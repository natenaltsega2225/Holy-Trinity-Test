// backend/routes/securityAudit.js
"use strict";

const express =
  require("express");

const router =
  express.Router();

const {

  authRequired,

} = require(
  "../middleware/auth"
);

const {

  requireRole,

} = require(
  "../middleware/roles"
);

const {

  listSecurityEvents,

} = require(
  "../services/domains/security/securityAuditService"
);

/* =========================================================
   HELPERS
========================================================= */

function toInt(
  value,
  fallback = 0
) {

  const n =
    Number(value);

  return Number.isFinite(n)
    ? Math.trunc(n)
    : fallback;
}

function clamp(
  value,
  min,
  max
) {

  return Math.max(
    min,
    Math.min(max, value)
  );
}

/* =========================================================
   GET SECURITY AUDIT LOGS
========================================================= */

router.get(
  "/",

  authRequired,

  requireRole(
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const limit =
        clamp(
          toInt(
            req.query.limit,
            50
          ),
          1,
          500
        );

      const offset =
        Math.max(
          0,
          toInt(
            req.query.offset,
            0
          )
        );

      const rows =
        await listSecurityEvents({

          user_id:
            req.query.user_id,

          email:
            req.query.email,

          event_type:
            req.query.event_type,

          severity:
            req.query.severity,

          limit,

          offset,
        });

      return res.json({

        ok: true,

        rows,

        pagination: {

          limit,

          offset,
        },
      });

    } catch (err) {

      console.error(
        "GET /security-audit error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load security audit logs.",
      });
    }
  }
);

/* =========================================================
   GET FAILED LOGIN EVENTS
========================================================= */

router.get(
  "/failed-logins",

  authRequired,

  requireRole(
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const rows =
        await listSecurityEvents({

          event_type:
            "login_failed",

          limit:
            200,
        });

      return res.json({

        ok: true,

        rows,
      });

    } catch (err) {

      console.error(
        "GET /security-audit/failed-logins error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load failed login events.",
      });
    }
  }
);

/* =========================================================
   GET SUSPICIOUS EVENTS
========================================================= */

router.get(
  "/suspicious",

  authRequired,

  requireRole(
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const rows =
        await listSecurityEvents({

          severity:
            "critical",

          limit:
            200,
        });

      return res.json({

        ok: true,

        rows,
      });

    } catch (err) {

      console.error(
        "GET /security-audit/suspicious error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load suspicious security events.",
      });
    }
  }
);

/* =========================================================
   EXPORTS
========================================================= */

module.exports =
  router;