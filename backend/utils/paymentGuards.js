// backend/utils/paymentGuards.js
"use strict";

const pool =
  require("../db");

/* =========================================================
   PAYMENT EXISTS
========================================================= */

async function paymentExists({

  stripePaymentIntentId,

  stripeCheckoutSessionId,

  paymentNumber,
}) {

  const conditions = [];
  const params = [];

  if (stripePaymentIntentId) {

    conditions.push(
      "stripe_payment_intent_id = ?"
    );

    params.push(
      stripePaymentIntentId
    );
  }

  if (stripeCheckoutSessionId) {

    conditions.push(
      "stripe_checkout_session_id = ?"
    );

    params.push(
      stripeCheckoutSessionId
    );
  }

  if (paymentNumber) {

    conditions.push(
      "payment_number = ?"
    );

    params.push(
      paymentNumber
    );
  }

  if (!conditions.length) {

    return false;
  }

  const [[row]] =
    await pool.query(
      `
      SELECT id

      FROM tbl_finance_payments

      WHERE ${conditions.join(" OR ")}

      LIMIT 1
      `,
      params
    );

  return !!row;
}

/* =========================================================
   RECEIPT EXISTS
========================================================= */

async function receiptExists({

  paymentId,

  receiptNumber,
}) {

  const conditions = [];
  const params = [];

  if (paymentId) {

    conditions.push(
      "payment_id = ?"
    );

    params.push(
      paymentId
    );
  }

  if (receiptNumber) {

    conditions.push(
      "receipt_number = ?"
    );

    params.push(
      receiptNumber
    );
  }

  if (!conditions.length) {

    return false;
  }

  const [[row]] =
    await pool.query(
      `
      SELECT id

      FROM tbl_finance_receipts

      WHERE ${conditions.join(" OR ")}

      LIMIT 1
      `,
      params
    );

  return !!row;
}

/* =========================================================
   INVOICE EXISTS
========================================================= */

async function invoiceExists({

  invoiceNumber,

  paymentId,
}) {

  const conditions = [];
  const params = [];

  if (invoiceNumber) {

    conditions.push(
      "invoice_number = ?"
    );

    params.push(
      invoiceNumber
    );
  }

  if (paymentId) {

    conditions.push(
      "payment_id = ?"
    );

    params.push(
      paymentId
    );
  }

  if (!conditions.length) {

    return false;
  }

  const [[row]] =
    await pool.query(
      `
      SELECT id

      FROM tbl_finance_invoices

      WHERE ${conditions.join(" OR ")}

      LIMIT 1
      `,
      params
    );

  return !!row;
}

/* =========================================================
   STRIPE EVENT EXISTS
========================================================= */

async function stripeEventProcessed(
  eventId
) {

  if (!eventId) {

    return false;
  }

  try {

    const [[row]] =
      await pool.query(
        `
        SELECT id

        FROM tbl_stripe_webhook_events

        WHERE stripe_event_id = ?

        LIMIT 1
        `,
        [eventId]
      );

    return !!row;

  } catch {

    /*
    table optional during rollout
    */

    return false;
  }
}

/* =========================================================
   STORE STRIPE EVENT
========================================================= */

async function storeStripeEvent({

  eventId,

  eventType,

  payload,
}) {

  if (!eventId) {

    return null;
  }

  try {

    const [result] =
      await pool.query(
        `
        INSERT INTO
        tbl_stripe_webhook_events (

          stripe_event_id,

          event_type,

          payload_json,

          processed_at,

          created_at

        ) VALUES (

          ?, ?, ?, NOW(), NOW()
        )
        `,
        [

          eventId,

          eventType,

          JSON.stringify(
            payload || {}
          ),
        ]
      );

    return result.insertId;

  } catch (err) {

    /*
    duplicate insert protection
    */

    if (
      err.code ===
      "ER_DUP_ENTRY"
    ) {

      return null;
    }

    throw err;
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  paymentExists,

  receiptExists,

  invoiceExists,

  stripeEventProcessed,

  storeStripeEvent,
};