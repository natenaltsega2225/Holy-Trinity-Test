// backend/routes/financeSettings.js
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
    "super_admin"
  )
);

/* =========================================================
   GET SETTINGS
========================================================= */

router.get(
  "/",

  async (
    req,
    res
  ) => {

    try {

      const [rows] =
        await pool.query(
          `
          SELECT
            setting_key,
            setting_value
          FROM tbl_finance_settings
          `
        );

      const settings =
        {};

      for (const row of rows) {

        let value =
          row.setting_value;

        try {

          value =
            JSON.parse(
              row.setting_value
            );

        } catch {}

        settings[
          row.setting_key
        ] = value;
      }

      return res.json({

        ok: true,
        settings,
      });

    } catch (err) {

      console.error(
        "finance settings error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to load finance settings.",
      });
    }
  }
);

/* =========================================================
   SAVE SETTINGS
========================================================= */

router.put(
  "/",

  async (
    req,
    res
  ) => {

    const conn =
      await pool.getConnection();

    try {

      await conn.beginTransaction();

      const entries =
        Object.entries(
          req.body || {}
        );

      for (const [
        key,
        value,
      ] of entries) {

        await conn.query(
          `
          INSERT INTO tbl_finance_settings
          (
            setting_key,
            setting_value,
            updated_at
          )
          VALUES
          (
            ?,
            ?,
            NOW()
          )
          ON DUPLICATE KEY UPDATE
            setting_value = VALUES(setting_value),
            updated_at = NOW()
          `,
          [
            key,
            JSON.stringify(
              value
            ),
          ]
        );
      }

      await conn.commit();

      return res.json({

        ok: true,

        message:
          "Finance settings updated successfully.",
      });

    } catch (err) {

      await conn.rollback();

      console.error(
        "finance settings save error:",
        err
      );

      return res.status(500).json({

        ok: false,

        error:
          "Failed to save finance settings.",
      });

    } finally {

      conn.release();
    }
  }
);

module.exports =
  router;