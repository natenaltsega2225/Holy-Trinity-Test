//backend\controllers\financeInvoicesController.js
"use strict";

const pool =
  require("../db");

/* =========================================================
   HELPERS
========================================================= */

function clean(
  value
) {

  return String(
    value ?? ""
  ).trim();
}

function toInt(
  value,
  fallback = 1
) {

  const n =
    Number(value);

  return Number.isFinite(n) &&
    n > 0

    ? Math.trunc(n)

    : fallback;
}

/* =========================================================
   LIST INVOICES
========================================================= */

async function listInvoices(
  req,
  res
) {

  try {

    const page =
      toInt(
        req.query.page,
        1
      );

    const limit =
      Math.min(
        100,
        toInt(
          req.query.limit,
          25
        )
      );

    const offset =
      (page - 1) * limit;

    const search =
      clean(
        req.query.search
      );

    const status =
      clean(
        req.query.status
      );

    const category =
      clean(
        req.query.category
      );

    /* =====================================
       WHERE
    ===================================== */

    const where = [];
    const params = [];

    if (search) {

      where.push(`
        (
          i.invoice_number LIKE ?
          OR i.full_name_snapshot LIKE ?
          OR i.email_snapshot LIKE ?
          OR p.payment_number LIKE ?
          OR r.receipt_number LIKE ?
        )
      `);

      const q =
        `%${search}%`;

      params.push(
        q,
        q,
        q,
        q,
        q
      );
    }

    if (
      status &&
      status !== "all"
    ) {

      where.push(
        "i.status = ?"
      );

      params.push(
        status
      );
    }

    if (
      category &&
      category !== "all"
    ) {

      where.push(
        "(i.category = ? OR i.invoice_type = ?)"
      );

      params.push(
        category,
        category
      );
    }

    const whereSql =
      where.length

        ? `WHERE ${where.join(" AND ")}`

        : "";

    /* =====================================
       COUNT
    ===================================== */

    const [[countRow]] =
      await pool.query(
        `
        SELECT COUNT(*) AS total

        FROM tbl_finance_invoices i

        LEFT JOIN tbl_finance_payments p
          ON p.id = i.payment_id

        LEFT JOIN tbl_finance_receipts r
          ON r.invoice_id = i.id

        ${whereSql}
        `,
        params
      );

    /* =====================================
       ROWS
    ===================================== */

    const [rows] =
      await pool.query(
        `
        SELECT

          i.id,
          i.invoice_number,

          i.member_id,
          i.member_no,

          i.full_name_snapshot,
          i.email_snapshot,
          i.phone_snapshot,

          i.invoice_type,
          i.category,
          i.sub_category,

          i.description,

          i.amount,
          i.total_amount,

          i.amount_paid,
          i.balance_due,

          i.status,

          i.invoice_date,
          i.due_date,
          i.paid_at,

          i.period_label,

          p.payment_number,

          p.method AS payment_method,
          p.provider AS payment_source,

          r.receipt_number,
          r.email_status,

          i.created_at

        FROM tbl_finance_invoices i

        LEFT JOIN tbl_finance_payments p
          ON p.id = i.payment_id

        LEFT JOIN tbl_finance_receipts r
          ON r.invoice_id = i.id

        ${whereSql}

        ORDER BY
          COALESCE(
            i.invoice_date,
            i.created_at
          ) DESC,
          i.id DESC

        LIMIT ?
        OFFSET ?
        `,
        [
          ...params,

          limit,
          offset,
        ]
      );

    /* =====================================
       SUMMARY
    ===================================== */

    const [[summary]] =
      await pool.query(
        `
        SELECT

          COUNT(*) AS invoices,

          COALESCE(
            SUM(total_amount),
            0
          ) AS totalAmount,

          COALESCE(
            SUM(amount_paid),
            0
          ) AS paidAmount,

          COALESCE(
            SUM(balance_due),
            0
          ) AS balanceDue

        FROM tbl_finance_invoices i

        ${whereSql}
        `,
        params
      );

    return res.json({

      ok: true,

      rows,

      pagination: {

        page,
        limit,

        total:
          Number(
            countRow.total || 0
          ),

        pages:
          Math.ceil(
            Number(
              countRow.total || 0
            ) / limit
          ),
      },

      summary,
    });

  } catch (err) {

    console.error(
      "listInvoices error:",
      err
    );

    return res.status(500).json({

      ok: false,

      error:
        "Failed to load invoices.",
    });
  }
}

/* =========================================================
   GET INVOICE
========================================================= */

async function getInvoice(
  req,
  res
) {

  try {

    const [[invoice]] =
      await pool.query(
        `
        SELECT

          i.*,

          p.payment_number,
          p.payment_type,

          p.method AS payment_method,
          p.provider AS payment_source,

          r.receipt_number,
          r.email_status

        FROM tbl_finance_invoices i

        LEFT JOIN tbl_finance_payments p
          ON p.id = i.payment_id

        LEFT JOIN tbl_finance_receipts r
          ON r.invoice_id = i.id

        WHERE i.id = ?

        LIMIT 1
        `,
        [req.params.id]
      );

    if (!invoice) {

      return res.status(404).json({

        ok: false,

        error:
          "Invoice not found.",
      });
    }

    const [items] =
      await pool.query(
        `
        SELECT *

        FROM tbl_finance_invoice_items

        WHERE invoice_id = ?

        ORDER BY id ASC
        `,
        [req.params.id]
      );

    return res.json({

      ok: true,

      invoice,

      items,
    });

  } catch (err) {

    console.error(
      "getInvoice error:",
      err
    );

    return res.status(500).json({

      ok: false,

      error:
        "Failed to load invoice.",
    });
  }
}

module.exports = {

  listInvoices,

  getInvoice,
};