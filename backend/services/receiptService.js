//backend\services\receiptService.js
"use strict";

/*
=========================================================
 ENTERPRISE RECEIPT SERVICE
---------------------------------------------------------
 Centralized receipt domain service

 Owns:
 - receipt loading
 - receipt emailing
 - receipt PDF generation
 - resend logic
 - receipt normalization
=========================================================
*/

const pool =
  require("../db");

const {

  generateReceiptPdfBuffer,

} = require(
  "./pdfService"
);

const {

  sendReceiptEmail,

} = require(
  "./emailService"
);

/* =========================================================
   HELPERS
========================================================= */

function clean(
  value,
  fallback = null
) {

  const v =
    String(
      value ?? ""
    ).trim();

  return v || fallback;
}

function normalizeReceipt(
  row = {}
) {

  return {

    id:
      row.id,

    receipt_number:
      row.receipt_number,

    invoice_number:
      row.invoice_number,

    payment_number:
      row.payment_number,

    amount:
      Number(
        row.amount || 0
      ),

    issued_at:
      row.issued_at,

    category:
      row.category,

    sub_category:
      row.sub_category,

    payment_method:
      row.payment_method,

    payment_source:
      row.payment_source,

    full_name:
      row.full_name,

    email:
      row.email,

    months_paid:
      row.months_paid,

    coverage_start:
      row.coverage_start,

    coverage_end:
      row.coverage_end,

    coverage_label:
      row.coverage_label,

    card_brand:
      row.card_brand,

    card_last4:
      row.card_last4,

    card_exp_month:
      row.card_exp_month,

    card_exp_year:
      row.card_exp_year,

    email_status:
      row.email_status,
  };
}

/* =========================================================
   LOAD RECEIPT
========================================================= */

async function loadReceipt(
  receiptId
) {

  const [[row]] =
    await pool.query(
      `
      SELECT

        r.id,
        r.receipt_number,
        r.amount,
        r.issued_at,
        r.email_status,

        i.invoice_number,
        i.period_label,

        p.payment_number,

        p.payment_type AS category,
        p.sub_category,

        p.method AS payment_method,
        p.provider AS payment_source,

        p.card_brand,
        p.card_last4,
        p.card_exp_month,
        p.card_exp_year,

        p.months_paid,

        p.coverage_start,
        p.coverage_end,
        p.coverage_label,

        COALESCE(
          m.full_name,
          p.full_name_snapshot
        ) AS full_name,

        COALESCE(
          u.email,
          p.email_snapshot
        ) AS email

      FROM tbl_finance_receipts r

      INNER JOIN tbl_finance_payments p
        ON p.id = r.payment_id

      LEFT JOIN tbl_finance_invoices i
        ON i.id = r.invoice_id

      LEFT JOIN tbl_members m
        ON m.id = p.member_id

      LEFT JOIN tbl_users u
        ON u.member_id = m.id

      WHERE r.id = ?

      LIMIT 1
      `,
      [receiptId]
    );

  if (!row) {

    return null;
  }

  return normalizeReceipt(
    row
  );
}

/* =========================================================
   UPDATE EMAIL STATUS
========================================================= */

async function updateReceiptEmailStatus({

  receipt_number,

  email_status,

  emailed_to,

  email_error,
}) {

  await pool.query(
    `
    UPDATE tbl_finance_receipts

    SET

      email_status = ?,

      emailed_at = CASE
        WHEN ? = 'sent'
        THEN NOW()
        ELSE emailed_at
      END,

      emailed_to = ?,

      email_error = ?,

      updated_at = NOW()

    WHERE receipt_number = ?
    `,
    [

      email_status,

      email_status,

      emailed_to,

      email_error,

      receipt_number,
    ]
  );
}
/* =========================================================
   SEND RECEIPT
========================================================= */

async function sendReceipt(
  receiptId
) {

  try {

    const receipt =
      await loadReceiptById(
        receiptId
      );

    if (!receipt) {

      throw new Error(
        "Receipt not found."
      );
    }

    const recipient =
      clean(
        receipt.email_snapshot ||
        receipt.emailed_to
      );

    if (!recipient) {

      throw new Error(
        "Receipt email address missing."
      );
    }

    /* =====================================
       PDF
    ===================================== */

    const pdfBuffer =
      await generateReceiptPdfBuffer(
        receipt
      );

    /* =====================================
       EMAIL
    ===================================== */

    const result =
      await sendReceiptEmail({

        to:
          recipient,

        pdfBuffer,

        receiptNo:
          receipt.receipt_number,

        paidBy:
          receipt.full_name_snapshot,

        amount:
          receipt.amount,

        category:
          receipt.payment_type,

        method:
          receipt.method,
      });

    /* =====================================
       UPDATE STATUS
    ===================================== */

    await updateReceiptEmailStatus({

      receiptId:
        receipt.id,

      status:
        result.success
          ? "sent"
          : "failed",

      email:
        recipient,

      error:
        result.success
          ? null
          : result.error,
    });

    return {

      success:
        result.success,

      receipt,

      result,
    };

  } catch (err) {

    console.error(
      "sendReceipt error:",
      err
    );

    try {

      await updateReceiptEmailStatus({

        receiptId,

        status:
          "failed",

        error:
          err.message,
      });

    } catch (updateErr) {

      console.error(
        "updateReceiptEmailStatus failed:",
        updateErr
      );
    }

    return {

      success: false,

      error:
        err.message,
    };
  }
}

/* =========================================================
   LOAD MEMBER RECEIPT
========================================================= */

async function loadMemberReceipt({

  receiptId,

  memberId,
}) {

  const [[row]] =
    await pool.query(
      `
      SELECT

        r.*,

        p.payment_number,
        p.payment_type,
        p.sub_category,

        p.member_id,

        p.full_name_snapshot,
        p.email_snapshot,

        i.invoice_number

      FROM tbl_finance_receipts r

      INNER JOIN tbl_finance_payments p
        ON p.id = r.payment_id

      LEFT JOIN tbl_finance_invoices i
        ON i.id = r.invoice_id

      WHERE r.id = ?
        AND p.member_id = ?

      LIMIT 1
      `,
      [
        receiptId,
        memberId,
      ]
    );

  return row || null;
}
/* =========================================================
   RESEND RECEIPT
========================================================= */

async function resendReceipt(
  receiptId
) {

  return sendReceipt(
    receiptId
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  loadReceipt,

  sendReceipt,
loadMemberReceipt,
  resendReceipt,

  updateReceiptEmailStatus,
};