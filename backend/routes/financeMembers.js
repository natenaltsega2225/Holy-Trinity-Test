//  //backend\routes\financeMembers.js


// "use strict";

// const express = require("express");
// const pool = require("../db");
// const { authRequired, requireRole } = require("../middleware/auth");
// const { writeAuditLog } = require("../utils/audit");
// const router = express.Router();

// function clean(v, max = 255) {
//   return String(v ?? "").trim().slice(0, max);
// }

// function nullable(v, max = 255) {
//   const s = clean(v, max);
//   return s || null;
// }

// function toId(v) {
//   const n = Number(v);
//   return Number.isInteger(n) && n > 0 ? n : null;
// }

// function toMoney(v, fallback = 0) {
//   const n = Number(v);
//   return Number.isFinite(n) ? Number(n.toFixed(2)) : fallback;
// }

// function toBool01(v, fallback = 1) {
//   if (v === true || v === 1 || v === "1") return 1;
//   if (v === false || v === 0 || v === "0") return 0;
//   return fallback;
// }

// function buildMemberNo(id) {
//   return `M-${String(id).padStart(5, "0")}`;
// }

// function isFinanceAllowed(req, res, next) {
//   return requireRole("finance", "admin")(req, res, next);
// }

// function buildHouseholdWhere(householdType, where, params) {
//   const normalized = clean(householdType || "", 50).toLowerCase();

//   if (normalized === "independent") {
//     where.push(`COALESCE(m.dependents_count, 0) = 0`);
//   } else if (normalized === "with_dependents") {
//     where.push(`COALESCE(m.dependents_count, 0) > 0`);
//   }
// }


// router.post("/members", authRequired, isFinanceAllowed, async (req, res) => {
//   const conn = await pool.getConnection();

//   try {
//     const first_name = clean(req.body.first_name, 100);
//     const last_name = clean(req.body.last_name, 100);
//     const full_name =
//       clean(req.body.full_name, 180) || `${first_name} ${last_name}`.trim();
//     const email = clean(req.body.email, 190).toLowerCase();
//     const phone = nullable(req.body.phone, 40);

//     const membership_status = clean(req.body.membership_status || "active", 50);
//     const status = clean(req.body.status || "active", 50);
//     const is_active = toBool01(req.body.is_active, 1);

//     const notes = nullable(req.body.notes, 5000);

//     const payment = req.body.payment || null;

//     if (!first_name || !last_name || !email) {
//       return res.status(400).json({
//         error: "First name, last name, and email are required.",
//       });
//     }

//     await conn.beginTransaction();

//     // 🔥 CREATE MEMBER
//     const [result] = await conn.query(
//       `
//       INSERT INTO tbl_members (
//         member_no, first_name, last_name, full_name, email, phone,
//         status, membership_status, is_active,
//         open_balance, total_paid, dependents_count, household_member_count,
//         notes, created_at, updated_at
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 1, ?, NOW(), NOW())
//       `,
//       [
//         "TEMP",
//         first_name,
//         last_name,
//         full_name,
//         email,
//         phone,
//         status,
//         membership_status,
//         is_active,
//         notes,
//       ]
//     );

//     const memberId = result.insertId;
//     const memberNo = buildMemberNo(memberId);

//     await conn.query(
//       `UPDATE tbl_members SET member_no=? WHERE id=?`,
//       [memberNo, memberId]
//     );

//     // ============================================================
//     // 🔥 PAYMENT + LEDGER (CRITICAL)
//     // ============================================================

//     if (payment && payment.amount > 0) {
//       const paymentNumber = `PAY-${Date.now()}`;

//       const [payResult] = await conn.query(
//         `
//         INSERT INTO tbl_finance_payments
//         (payment_number, member_id, amount, payment_type, sub_category, method, status, payment_date)
//         VALUES (?, ?, ?, 'membership_dues', 'registration', ?, 'paid', NOW())
//         `,
//         [
//           paymentNumber,
//           memberId,
//           payment.amount,
//           payment.method || "cash",
//         ]
//       );

//       // 🔥 UPDATE MEMBER FINANCE
//       await conn.query(
//         `
//         UPDATE tbl_members
//         SET total_paid = total_paid + ?, last_payment_at = NOW()
//         WHERE id = ?
//         `,
//         [payment.amount, memberId]
//       );

//       // 🔥 LEDGER
//       await conn.query(
//         `
//         INSERT INTO tbl_finance_ledger
//         (member_id, type, amount, description, created_at)
//         VALUES (?, 'credit', ?, 'Membership Registration Payment', NOW())
//         `,
//         [memberId, payment.amount]
//       );
//     }

//     // 🔥 AUDIT
//     await writeAuditLog({
//       actorId: req.user?.id,
//       action: "FINANCE_MEMBER_REGISTERED",
//       entity: "member",
//       entityId: memberId,
//       meta: { email, memberNo },
//       ipAddress: req.ip,
//     });

//     await conn.commit();

//     return res.status(201).json({
//       ok: true,
//       id: memberId,
//       member_no: memberNo,
//       message: "Member + payment created successfully.",
//     });
//   } catch (err) {
//     await conn.rollback();
//     console.error(err);
//     return res.status(500).json({ error: "Failed to create member." });
//   } finally {
//     conn.release();
//   }
// });

// router.get(
//   "/members",
//   authRequired,
//   isFinanceAllowed,
//   async (req, res) => {
//     try {
//       const q = clean(req.query.q || req.query.search || "", 120);
//       const page = Math.max(1, Number(req.query.page || 1));
//       const limit = Math.max(
//         1,
//         Math.min(100, Number(req.query.limit || req.query.pageSize || 10))
//       );

//       const offset = (page - 1) * limit;

//       const where = [];
//       const params = [];

//       if (q) {
//         where.push(`
//           (
//             m.full_name LIKE ?
//             OR m.email LIKE ?
//             OR m.member_no LIKE ?
//           )
//         `);

//         params.push(`%${q}%`, `%${q}%`, `%${q}%`);
//       }

//       if (req.query.status) {
//         where.push(`m.membership_status = ?`);
//         params.push(req.query.status);
//       }

//       if (req.query.active === "1") {
//         where.push(`m.is_active = 1`);
//       }

//       if (req.query.active === "0") {
//         where.push(`m.is_active = 0`);
//       }

//       buildHouseholdWhere(
//         req.query.householdType,
//         where,
//         params
//       );

//       const whereSql = where.length
//         ? `WHERE ${where.join(" AND ")}`
//         : "";

//       const [[countRow]] = await pool.query(
//         `
//         SELECT COUNT(*) AS total
//         FROM tbl_members m
//         ${whereSql}
//         `,
//         params
//       );

//       const [rows] = await pool.query(
//         `
//         SELECT
//           m.id,
//           m.member_no,
//           m.full_name,
//           m.email,
//           m.phone,
//           m.membership_status,
//           m.status,
//           m.is_active,
//           m.open_balance,
//           m.total_paid,
//           m.created_at
//         FROM tbl_members m
//         ${whereSql}
//         ORDER BY m.id DESC
//         LIMIT ?
//         OFFSET ?
//         `,
//         [...params, limit, offset]
//       );

//       return res.json({
//         ok: true,
//         rows,
//         meta: {
//           total: Number(countRow.total || 0),
//           page,
//           limit,
//           totalPages: Math.ceil(
//             Number(countRow.total || 0) / limit
//           ),
//         },
//       });
//     } catch (err) {
//       console.error("GET /finance/members error:", err);

//       return res.status(500).json({
//         error: "Failed to load members.",
//       });
//     }
//   }
// );
// router.post("/members", authRequired, isFinanceAllowed, async (req, res) => {
//   const conn = await pool.getConnection();

//   try {
//     const first_name = clean(req.body.first_name, 100);
//     const last_name = clean(req.body.last_name, 100);
//     const full_name =
//       clean(req.body.full_name, 180) || `${first_name} ${last_name}`.trim();
//     const email = clean(req.body.email, 190).toLowerCase();
//     const phone = nullable(req.body.phone, 40);

//     const address_line1 = nullable(req.body.address_line1, 200);
//     const address_line2 = nullable(req.body.address_line2, 200);
//     const city = nullable(req.body.city, 100);
//     const state = nullable(req.body.state, 80);
//     const zip = nullable(req.body.zip, 20);

//     const membership_status = clean(req.body.membership_status || "active", 50);
//     const status = clean(req.body.status || "active", 50);
//     const is_active = toBool01(req.body.is_active, 1);

//     const open_balance = toMoney(req.body.open_balance, 0);
//     const total_paid = toMoney(req.body.total_paid, 0);
//     const notes = nullable(req.body.notes, 5000);

//     if (!first_name || !last_name || !email) {
//       return res.status(400).json({
//         error: "First name, last name, and email are required.",
//       });
//     }

//     await conn.beginTransaction();

//     const [dupRows] = await conn.query(
//       `
//       SELECT id
//       FROM tbl_members
//       WHERE LOWER(email) = LOWER(?)
//       LIMIT 1
//       `,
//       [email]
//     );

//     if (dupRows.length) {
//       await conn.rollback();
//       return res.status(409).json({ error: "Member email already exists." });
//     }

//     const [result] = await conn.query(
//       `
//       INSERT INTO tbl_members (
//         member_no,
//         first_name,
//         last_name,
//         full_name,
//         email,
//         phone,
//         address_line1,
//         address_line2,
//         city,
//         state,
//         zip,
//         member_type,
//         registration_fee_status,
//         status,
//         membership_status,
//         is_active,
//         open_balance,
//         total_paid,
//         dependents_count,
//         household_member_count,
//         notes,
//         created_at,
//         updated_at
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'existing', 'waived', ?, ?, ?, ?, ?, 0, 1, ?, NOW(), NOW())
//       `,
//       [
//         "TEMP",
//         first_name,
//         last_name,
//         full_name,
//         email,
//         phone,
//         address_line1,
//         address_line2,
//         city,
//         state,
//         zip,
//         status,
//         membership_status,
//         is_active,
//         open_balance,
//         total_paid,
//         notes,
//       ]
//     );

//     const memberId = result.insertId;
//     const memberNo = buildMemberNo(memberId);

//     await conn.query(
//       `
//       UPDATE tbl_members
//       SET member_no = ?
//       WHERE id = ?
//       `,
//       [memberNo, memberId]
//     );

//     await conn.commit();

//     return res.status(201).json({
//       ok: true,
//       id: memberId,
//       member_no: memberNo,
//       message: "Member created successfully.",
//     });
//   } catch (err) {
//     try {
//       await conn.rollback();
//     } catch {}
//     console.error("POST /finance/members error:", err);
//     return res.status(500).json({ error: "Failed to create member." });
//   } finally {
//     conn.release();
//   }
// });

// router.put("/members/:id", authRequired, isFinanceAllowed, async (req, res) => {
//   try {
//     const id = toId(req.params.id);
//     if (!id) return res.status(400).json({ error: "Invalid member id." });

//     const first_name = clean(req.body.first_name, 100);
//     const last_name = clean(req.body.last_name, 100);
//     const full_name =
//       clean(req.body.full_name, 180) || `${first_name} ${last_name}`.trim();
//     const email = clean(req.body.email, 190).toLowerCase();
//     const phone = nullable(req.body.phone, 40);

//     const address_line1 = nullable(req.body.address_line1, 200);
//     const address_line2 = nullable(req.body.address_line2, 200);
//     const city = nullable(req.body.city, 100);
//     const state = nullable(req.body.state, 80);
//     const zip = nullable(req.body.zip, 20);

//     const membership_status = clean(req.body.membership_status || "active", 50);
//     const status = clean(req.body.status || "active", 50);
//     const is_active = toBool01(req.body.is_active, 1);

//     const open_balance = toMoney(req.body.open_balance, 0);
//     const total_paid = toMoney(req.body.total_paid, 0);
//     const notes = nullable(req.body.notes, 5000);

//     await pool.query(
//       `
//       UPDATE tbl_members
//       SET
//         first_name = ?,
//         last_name = ?,
//         full_name = ?,
//         email = ?,
//         phone = ?,
//         address_line1 = ?,
//         address_line2 = ?,
//         city = ?,
//         state = ?,
//         zip = ?,
//         status = ?,
//         membership_status = ?,
//         is_active = ?,
//         open_balance = ?,
//         total_paid = ?,
//         notes = ?,
//         updated_at = NOW()
//       WHERE id = ?
//       `,
//       [
//         first_name,
//         last_name,
//         full_name,
//         email,
//         phone,
//         address_line1,
//         address_line2,
//         city,
//         state,
//         zip,
//         status,
//         membership_status,
//         is_active,
//         open_balance,
//         total_paid,
//         notes,
//         id,
//       ]
//     );

//     return res.json({
//       ok: true,
//       message: "Member updated successfully.",
//     });
//   } catch (err) {
//     console.error("PUT /finance/members/:id error:", err);
//     return res.status(500).json({ error: "Failed to update member." });
//   }
// });

// router.patch(
//   "/members/:id/deactivate",
//   authRequired,
//   requireRole("admin"),
//   async (req, res) => {
//     try {
//       const id = toId(req.params.id);
//       if (!id) return res.status(400).json({ error: "Invalid member id." });

//       await pool.query(
//         `
//         UPDATE tbl_members
//         SET
//           is_active = 0,
//           status = 'inactive',
//           membership_status = 'inactive',
//           updated_at = NOW()
//         WHERE id = ?
//         `,
//         [id]
//       );

//       return res.json({
//         ok: true,
//         message: "Member deactivated successfully.",
//       });
//     } catch (err) {
//       console.error("PATCH /finance/members/:id/deactivate error:", err);
//       return res.status(500).json({ error: "Failed to deactivate member." });
//     }
//   }
// );

// module.exports = router;

// backend/routes/financeMembers.js
"use strict";

const express =
  require("express");

const bcrypt =
  require("bcryptjs");

const crypto =
  require("crypto");

const pool =
  require("../db");

const {

  authRequired,

  requireRole,

} = require("../middleware/auth");
const {
  registerFinanceMember,
  createFinanceStripeRegistrationCheckout,
} = require("../services/financeRegistrationService");
const {

  insertExistingColumns,

  findOne,

  findMany,

  updateExistingColumns,

} = require("../utils/dbHelpers");

const {

  clean,

  nullable,

  mysqlNow,

} = require("../utils/financeHelpers");

const {

  createUnifiedPayment,

} = require(
  "../services/domains/payments/unifiedPaymentService"
);

const {

  createLedgerEntry,

} = require(
  "../services/domains/ledger/ledgerService"
);

const {

  createActivity,

} = require(
  "../services/domains/activity/activityFeedService"
);

const {

  sendEmail,

} = require(
  "../services/domains/notifications/notificationService"
);

const router =
  express.Router();

/* =========================================================
   HELPERS
========================================================= */

function randomPassword() {

  return crypto
    .randomBytes(6)
    .toString("hex");
}

function memberNumber() {

  return `HT-${Date.now()}`;
}

/* =========================================================
   LIST MEMBERS (ENTERPRISE)
========================================================= */

router.get(
  "/members",

  authRequired,

  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const page =
        Math.max(
          1,
          Number(req.query.page || 1)
        );

      const limit =
        Math.max(
          1,
          Math.min(
            500,
            Number(
              req.query.limit ||
              req.query.pageSize ||
              10
            )
          )
        );

      const offset =
        (page - 1) * limit;

      const search =
        clean(
          req.query.search ||
          req.query.q ||
          ""
        );

      const status =
        clean(
          req.query.status || ""
        );

      const where = [];

      const params = [];

      /* =========================================
         SEARCH
      ========================================= */

      if (search) {

        where.push(`
          (
            m.member_no LIKE ?
            OR m.full_name LIKE ?
            OR m.email LIKE ?
            OR m.phone LIKE ?
          )
        `);

        const like =
          `%${search}%`;

        params.push(
          like,
          like,
          like,
          like
        );
      }

      /* =========================================
         STATUS
      ========================================= */

      if (status) {

        where.push(`
          m.status = ?
        `);

        params.push(status);
      }

      const whereSql =
        where.length
          ? `WHERE ${where.join(" AND ")}`
          : "";

      /* =========================================
         TOTAL COUNT
      ========================================= */

      const totalRow =
        await findOne(
          pool,
          `
          SELECT COUNT(*) AS total
          FROM tbl_members m
          ${whereSql}
          `,
          params
        );

      /* =========================================
         MEMBERS
      ========================================= */

      const rows =
        await findMany(

          pool,

          `
          SELECT

            m.*,

            COALESCE(
              SUM(
                CASE
                  WHEN p.status = 'paid'
                  THEN p.amount
                  ELSE 0
                END
              ),
              0
            ) AS total_paid,

            COALESCE(
              (
                SELECT
                  SUM(
                    COALESCE(i.balance_due, 0)
                  )
                FROM tbl_finance_invoices i
                WHERE i.member_id = m.id
                  AND i.status NOT IN (
                    'paid',
                    'cancelled'
                  )
              ),
              0
            ) AS open_balance,

            (
              SELECT COUNT(*)
              FROM tbl_member_dependents d
              WHERE d.member_id = m.id
            ) AS dependents_count,

            CASE
              WHEN EXISTS (
                SELECT 1
                FROM tbl_finance_invoices i
                WHERE i.member_id = m.id
                  AND i.balance_due > 0
              )
              THEN 'due'

              WHEN EXISTS (
                SELECT 1
                FROM tbl_finance_payments p2
                WHERE p2.member_id = m.id
                  AND p2.status = 'paid'
              )
              THEN 'current'

              ELSE 'pending'
            END AS payment_status

          FROM tbl_members m

          LEFT JOIN tbl_finance_payments p
            ON p.member_id = m.id

          ${whereSql}

          GROUP BY m.id

          ORDER BY m.created_at DESC

          LIMIT ?
          OFFSET ?
          `,

          [
            ...params,
            limit,
            offset,
          ]
        );

      return res.json({

        ok: true,

        rows,

        pagination: {

          page,

          limit,

          total:
            Number(
              totalRow?.total || 0
            ),

          totalPages:
            Math.ceil(
              Number(
                totalRow?.total || 0
              ) / limit
            ),
        },
      });

    } catch (err) {

      console.error(
        "finance members list error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load members.",
      });
    }
  }
);
/* =========================================================
   GET MEMBER
========================================================= */

router.get(
  "/members/:id",

  authRequired,

  async (req, res) => {

    try {

      const member =
        await findOne(

          pool,

          `
          SELECT *

          FROM tbl_members

          WHERE id = ?

          LIMIT 1
          `,

          [req.params.id]
        );

      if (!member) {

        return res.status(404).json({

          error:
            "Member not found.",
        });
      }

      return res.json({

        ok: true,

        member,
      });

    } catch (err) {

      console.error(
        "finance member get error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to load member.",
      });
    }
  }
);



router.post(
  "/register-new-member",
  authRequired,
  requireRole("finance", "admin", "super_admin"),
  async (req, res) => {
    try {
      const useStripe =
        String(req.body.payment_method || req.body.method || "")
          .toLowerCase() === "stripe_checkout";

      const payload = {
        ...req.body,
        created_by: req.user?.id,
      };

      const result = useStripe
        ? await createFinanceStripeRegistrationCheckout(payload)
        : await registerFinanceMember(payload);

      return res.json(result);
    } catch (err) {
      console.error("register member error:", err);

      return res.status(400).json({
        error: err.message || "Failed to register member.",
      });
    }
  }
);

/* =========================================================
   UPDATE MEMBER
========================================================= */

router.put(
  "/members/:id",

  authRequired,

  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      await updateExistingColumns(

        pool,

        "tbl_members",

        {

          full_name:
            req.body.full_name,

          baptismal_name:
            req.body.baptismal_name,

          email:
            req.body.email,

          phone:
            req.body.phone,

          address:
            req.body.address,

          membership_status:
            req.body.membership_status,

          updated_at:
            mysqlNow(),
        },

        "id = ?",

        [req.params.id]
      );

      return res.json({

        ok: true,
      });

    } catch (err) {

      console.error(
        "update member error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to update member.",
      });
    }
  }
);

/* =========================================================
   DELETE MEMBER
========================================================= */

router.delete(
  "/members/:id",

  authRequired,

  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),

  async (req, res) => {

    try {

      const [result] =
        await pool.query(
          `
          DELETE FROM tbl_members

          WHERE id = ?
          `,
          [req.params.id]
        );

      return res.json({

        ok: true,

        affectedRows:
          result.affectedRows,
      });

    } catch (err) {

      console.error(
        "delete member error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to delete member.",
      });
    }
  }
);

module.exports =
  router;