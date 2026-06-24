//backend\controllers\inPersonPaymentController.js
"use strict";

const Stripe = require("stripe");

const pool = require("../db");

const {
  clean,
  money,
  mysqlNow,
} = require("../utils/financeHelpers");

const {
  processSuccessfulPayment,
  sendReceiptForPayment,
} = require("../services/paymentService");

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

/* =========================================================
   HELPERS
========================================================= */

function cents(value) {

  return Math.round(
    money(value) * 100
  );
}

function frontendUrl() {

  return String(
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function normalizeMethod(
  value
) {

  const v = clean(
    value,
    40
  ).toLowerCase();

  if (
    [
      "cash",
      "check",
      "zelle",
      "card",
    ].includes(v)
  ) {
    return v;
  }

  return "cash";
}

function normalizePaymentType(
  value
) {

  const v = clean(
    value,
    80
  ).toLowerCase();

  if (
    [
      "membership",
      "dues",
    ].includes(v)
  ) {
    return "membership";
  }

  if (
    [
      "school",
      "kids",
    ].includes(v)
  ) {
    return "school";
  }

  if (
    [
      "trip",
    ].includes(v)
  ) {
    return "trip";
  }

  return "membership";
}

/* =========================================================
   MANUAL PAYMENT
========================================================= */

async function createManualInPersonPayment(
  req,
  res
) {

  const conn =
    await pool.getConnection();

  try {

    await conn.beginTransaction();

    const memberId =
      Number(
        req.body.member_id || 0
      );

    if (!memberId) {

      return res.status(400).json({

        error:
          "Member is required.",
      });
    }

    const amount =
      money(
        req.body.amount
      );

    if (amount <= 0) {

      return res.status(400).json({

        error:
          "Invalid amount.",
      });
    }

    const paymentType =
      normalizePaymentType(
        req.body.payment_type
      );

    const method =
      normalizeMethod(
        req.body.method
      );

    const paymentResult =
      await processSuccessfulPayment(
        conn,
        {

          member_id:
            memberId,

          amount,

          payment_type:
            paymentType,

          category:
            paymentType,

          sub_category:
            clean(
              req.body.sub_category,
              120
            ),

          method,

          provider:
            "manual",

          reference_no:
            clean(
              req.body.reference_no,
              120
            ),

          note:
            clean(
              req.body.note,
              1000
            ),

          plan_name:
            clean(
              req.body.plan_name,
              120
            ),

          months_paid:
            Number(
              req.body.months_paid || 1
            ),

          related_entity_id:
            Number(
              req.body.related_entity_id || 0
            ) || null,

          related_entity_type:
            clean(
              req.body.related_entity_type,
              80
            ),

          registration_id:
            Number(
              req.body.registration_id || 0
            ) || null,

          paid_at:
            mysqlNow(),

          status:
            "paid",
        }
      );

    await conn.commit();

    sendReceiptForPayment(
      paymentResult
    ).catch(
      console.error
    );

    return res.json({

      ok: true,

      payment:
        paymentResult,
    });

  } catch (err) {

    try {

      await conn.rollback();

    } catch {}

    console.error(
      "createManualInPersonPayment error:",
      err
    );

    return res.status(500).json({

      error:
        err.message ||

        "Failed to create payment.",
    });

  } finally {

    conn.release();
  }
}

/* =========================================================
   STRIPE PAYMENT
========================================================= */

async function createStripeInPersonPayment(
  req,
  res
) {

  try {

    const memberId =
      Number(
        req.body.member_id || 0
      );

    if (!memberId) {

      return res.status(400).json({

        error:
          "Member is required.",
      });
    }

    const amount =
      money(
        req.body.amount
      );

    if (amount <= 0) {

      return res.status(400).json({

        error:
          "Invalid amount.",
      });
    }

    const paymentType =
      normalizePaymentType(
        req.body.payment_type
      );

    const successUrl =
      `${frontendUrl()}/payment-success?session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      `${frontendUrl()}/payment-cancel`;

    const metadata = {

      payment_type:
        paymentType,

      category:
        paymentType,

      member_id:
        String(memberId),

      sub_category:
        clean(
          req.body.sub_category,
          120
        ),

      plan_name:
        clean(
          req.body.plan_name,
          120
        ),

      months_paid:
        String(
          Number(
            req.body.months_paid || 1
          )
        ),

      related_entity_id:
        String(
          Number(
            req.body.related_entity_id || 0
          ) || ""
        ),

      related_entity_type:
        clean(
          req.body.related_entity_type,
          80
        ),

      registration_id:
        String(
          Number(
            req.body.registration_id || 0
          ) || ""
        ),

      provider:
        "stripe",

      method:
        "card",

      finance_checkout:
        "1",
    };

    const session =
      await stripe.checkout.sessions.create({

        mode:
          "payment",

        success_url:
          successUrl,

        cancel_url:
          cancelUrl,

        payment_method_types: [
          "card",
        ],

        metadata,

        payment_intent_data: {
          metadata,
        },

        line_items: [
          {

            quantity: 1,

            price_data: {

              currency:
                "usd",

              unit_amount:
                cents(amount),

              product_data: {

                name:
                  `In-Person ${paymentType} Payment`,
              },
            },
          },
        ],
      });

    return res.json({

      ok: true,

      url:
        session.url,

      session_id:
        session.id,
    });

  } catch (err) {

    console.error(
      "createStripeInPersonPayment error:",
      err
    );

    return res.status(500).json({

      error:
        err.message ||

        "Failed to create Stripe session.",
    });
  }
}

module.exports = {

  createManualInPersonPayment,

  createStripeInPersonPayment,
};