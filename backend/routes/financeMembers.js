
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

function monthName(month) {
  return [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][Number(month)] || String(month);
}

function formatCoverageLabel(
  year,
  startMonth,
  endMonth
) {
  if (!year || !startMonth || !endMonth) {
    return "";
  }

  return `${monthName(startMonth)} ${year} - ${monthName(endMonth)} ${year}`;
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
          SELECT
  m.*,
  u.id AS user_id,
  u.username,
  u.account_status,
  u.must_change_password,
  u.password_reset_required,
  u.welcome_email_status
FROM tbl_members m
LEFT JOIN tbl_users u
  ON u.id = m.user_id
WHERE m.id = ?
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

/* =========================================================
   MEMBER COVERAGE
========================================================= */

router.get(
  "/members/:id/coverage",
  authRequired,
  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),
  async (req, res) => {
    try {
      const memberId = Number(req.params.id);

      if (!memberId) {
        return res.status(400).json({
          ok: false,
          error: "Invalid member id.",
        });
      }

      const year = Number(
        req.query.year ||
        new Date().getFullYear()
      );

      const [rows] = await pool.query(
        `
        SELECT
          c.payment_id,

          MAX(c.payment_number) AS payment_number,

          MIN(c.month_number) AS start_month,

          MAX(c.month_number) AS end_month,

          COUNT(*) AS months_paid,

          SUM(c.amount) AS amount,

          MAX(c.coverage_year) AS coverage_year,

          MAX(p.plan_name) AS plan_name,

          MAX(p.coverage_start_month) AS coverage_start_month,

          MAX(p.coverage_end_month) AS coverage_end_month,

          MAX(p.paid_at) AS paid_at,

          MAX(m.next_due_at) AS next_due_at

        FROM tbl_member_membership_coverage c

        LEFT JOIN tbl_finance_payments p
          ON p.id = c.payment_id

        LEFT JOIN tbl_members m
          ON m.id = c.member_id

        WHERE c.member_id = ?
          AND c.coverage_year = ?
          AND LOWER(COALESCE(c.status,'')) IN (
            'paid',
            'completed',
            'posted'
          )

        GROUP BY c.payment_id

        ORDER BY
          MIN(c.month_number) ASC,
          c.payment_id ASC
        `,
        [memberId, year]
      );

      const paidMonths = [
        ...new Set(
          rows.flatMap((row) => {
            const start =
              Number(row.start_month || 0);

            const end =
              Number(row.end_month || 0);

            if (
              start < 1 ||
              start > 12 ||
              end < 1 ||
              end > 12 ||
              end < start
            ) {
              return [];
            }

            return Array.from(
              { length: end - start + 1 },
              (_, index) =>
                start + index
            );
          })
        ),
      ].sort((a, b) => a - b);

      const totalAmount =
        rows.reduce(
          (sum, row) =>
            sum +
            Number(row.amount || 0),
          0
        );

      const totalMonths =
        paidMonths.length;

      const startMonth =
        paidMonths[0] || null;

      const endMonth =
        paidMonths[
          paidMonths.length - 1
        ] || null;

      const nextMonth =
        endMonth === 12
          ? 1
          : endMonth + 1;

      const nextYear =
        endMonth === 12
          ? year + 1
          : year;

      const nextDueAt =
        startMonth && endMonth
          ? `${nextYear}-${String(
              nextMonth
            ).padStart(2, "0")}-01`
          : null;

      const coveragePercent =
        Math.round(
          (paidMonths.length / 12) *
            100
        );

      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const paidThrough =
        endMonth
          ? `${monthNames[endMonth - 1]} ${year}`
          : null;

      let renewalStatus =
        "current";

      if (
        paidMonths.length === 0
      ) {
        renewalStatus =
          "overdue";
      } else if (
        paidMonths.length <= 2
      ) {
        renewalStatus =
          "expiring";
      }

      const planName =
        rows[
          rows.length - 1
        ]?.plan_name ||
        rows[0]?.plan_name ||
        "Membership";

      const coverage =
        rows.length > 0
          ? {
              coverage_year: year,

              plan_name: planName,

              coverage_start_month:
                startMonth,

              coverage_end_month:
                endMonth,

              start_month:
                startMonth,

              end_month:
                endMonth,

              months_paid:
                totalMonths,

              amount: Number(
                totalAmount.toFixed(2)
              ),

              paid_months:
                paidMonths,

              coverage_months:
                paidMonths,

              coverage_months_json:
                JSON.stringify(
                  paidMonths
                ),

              coverage_percent:
                coveragePercent,

              paid_through:
                paidThrough,

              renewal_status:
                renewalStatus,

              next_due_at:
                nextDueAt,

              coverage_label:
                formatCoverageLabel(
                  year,
                  startMonth,
                  endMonth
                ),
            }
          : null;

      const formatted =
        rows.map((row) => ({
          ...row,

          coverage_start_month:
            Number(
              row.start_month || 0
            ),

          coverage_end_month:
            Number(
              row.end_month || 0
            ),

          months_paid:
            Number(
              row.months_paid || 0
            ),

          amount:
            Number(
              row.amount || 0
            ),

          plan_name:
            row.plan_name ||
            "Membership",

          coverage_label:
            formatCoverageLabel(
              row.coverage_year ||
                year,
              row.start_month,
              row.end_month
            ),
        }));

      return res.json({
        ok: true,
        year,
        coverage,
        rows: formatted,
      });
    } catch (err) {
      console.error(
        "coverage error:",
        err
      );

      return res.status(500).json({
        ok: false,
        error:
          "Failed to load coverage.",
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

// router.put(
//   "/members/:id",

//   authRequired,

//   requireRole(
//     "finance",
//     "admin",
//     "super_admin"
//   ),

//   async (req, res) => {

//     try {

//       await updateExistingColumns(

//         pool,

//         "tbl_members",

//         {

//           full_name:
//             req.body.full_name,

//           baptismal_name:
//             req.body.baptismal_name,

//           email:
//             req.body.email,

//           phone:
//             req.body.phone,

//           address:
//             req.body.address,

//           membership_status:
//             req.body.membership_status,

//           updated_at:
//             mysqlNow(),
//         },

//         "id = ?",

//         [req.params.id]
//       );

//       return res.json({

//         ok: true,
//       });

//     } catch (err) {

//       console.error(
//         "update member error:",
//         err
//       );

//       return res.status(500).json({

//         error:
//           "Failed to update member.",
//       });
//     }
//   }
// );
async function updateMemberHandler(
  req,
  res
) {
  try {

 await updateExistingColumns(
  pool,
  "tbl_members",
  {
    first_name: req.body.first_name,
    last_name: req.body.last_name,

    full_name:
      req.body.full_name ||
      `${req.body.first_name || ""} ${req.body.last_name || ""}`.trim(),

    email: req.body.email,
    phone: req.body.phone,
    gender: req.body.gender,

    address_line1: req.body.address,

    city: req.body.city,
    state: req.body.state,
    zip: req.body.zip,

    household_role:
      req.body.household_type,

    membership_status:
      req.body.membership_status,

    updated_at: mysqlNow(),
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

router.put(
  "/members/:id",
  authRequired,
  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),
  updateMemberHandler
);

router.patch(
  "/members/:id",
  authRequired,
  requireRole(
    "finance",
    "admin",
    "super_admin"
  ),
  updateMemberHandler
);
/* =========================================================
   PATCH MEMBER
========================================================= */

// router.patch(
//   "/members/:id",

//   authRequired,

//   requireRole(
//     "finance",
//     "admin",
//     "super_admin"
//   ),

//   async (req, res) => {
//     try {

//       await updateExistingColumns(
//         pool,

//         "tbl_members",

//         {
//           full_name:
//             req.body.full_name,

//           baptismal_name:
//             req.body.baptismal_name,

//           email:
//             req.body.email,

//           phone:
//             req.body.phone,

//           address:
//             req.body.address,

//           membership_status:
//             req.body.membership_status,

//           updated_at:
//             mysqlNow(),
//         },

//         "id = ?",

//         [req.params.id]
//       );

//       return res.json({
//         ok: true,
//       });

//     } catch (err) {

//       console.error(
//         "patch member error:",
//         err
//       );

//       return res.status(500).json({
//         error:
//           "Failed to update member.",
//       });
//     }
//   }
// );

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