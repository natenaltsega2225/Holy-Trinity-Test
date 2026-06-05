// backend/routes/financeCheckout.js

"use strict";

const express = require("express");
const Stripe = require("stripe");

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/* =========================================================
   HELPERS
========================================================= */

function safeString(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : fallback;
}

function boolString(value) {
  return value === true || value === "true" ? "true" : "false";
}

function frontendUrl() {
  return String(process.env.FRONTEND_URL || "http://localhost:5173").replace(
    /\/+$/,
    ""
  );
}

function stripeMethod(value) {
  return value === "stripe_ach" ? ["us_bank_account"] : ["card"];
}

/* =========================================================
   BUILD STRIPE METADATA
========================================================= */

function buildStripeMetadata(payload = {}, totalAmount = 0) {
  const membershipAmount = safeNumber(
    payload.membership_amount || payload.amount_paid || payload.amount,
    0
  );

  const registrationFee = safeNumber(payload.registration_fee, 0);
  const processingFee = safeNumber(payload.processing_fee, 0);
  const subtotalAmount = safeNumber(
    payload.subtotal_amount || membershipAmount + registrationFee,
    0
  );

  return {
    source: "finance_registration",
    created_from: "finance_registration",

    category: safeString(payload.category || "membership"),
    payment_type: safeString(
      payload.payment_type || payload.category || "membership"
    ),

    member_id: safeString(payload.member_id),
    member_no: safeString(payload.member_no),

    first_name: safeString(payload.first_name, 80),
    last_name: safeString(payload.last_name, 80),
  first_name: safeString(
  payload.first_name,
  80
),

last_name: safeString(
  payload.last_name,
  80
),

full_name: safeString(
  payload.full_name ||
    `${payload.first_name || ""} ${payload.last_name || ""}`.trim(),
  120
),

email: safeString(
  payload.email,
  120
),

phone: safeString(
  payload.phone,
  40
),
    plan_id: safeString(payload.plan_id),
    dues_plan_id: safeString(payload.dues_plan_id || payload.plan_id),
    plan_name: safeString(payload.plan_name, 160),
    duration_months: safeString(payload.duration_months),
    months_paid: safeString(payload.months_paid || payload.duration_months),

    coverage_year: safeString(payload.coverage_year),
    coverage_start_month: safeString(payload.coverage_start_month, 40),
    coverage_end_month: safeString(payload.coverage_end_month, 40),
    coverage_label: safeString(payload.coverage_label, 160),

    amount: String(totalAmount),
    total_amount: String(totalAmount),
    membership_amount: String(membershipAmount),
    base_amount: String(membershipAmount),
    subtotal_amount: String(subtotalAmount),
    registration_fee: String(registrationFee),
    processing_fee: String(processingFee),

    payment_method: safeString(payload.payment_method || "stripe_card"),
    method: safeString(payload.method || payload.payment_method || "stripe_card"),
    provider: "stripe",

    send_receipt_email: boolString(payload.send_receipt_email),
    send_welcome_email: boolString(payload.send_welcome_email),
    create_invoice: boolString(payload.create_invoice),
    create_ledger_entry: boolString(payload.create_ledger_entry),
    create_member_after_payment: boolString(payload.create_member_after_payment),
  };
}

/* =========================================================
   CREATE REGISTRATION CHECKOUT
========================================================= */

router.post("/create-registration-checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        ok: false,
        error: "Stripe secret key is not configured.",
      });
    }

    const payload = req.body || {};

    console.log("CHECKOUT PAYLOAD:", payload);

    const email = safeString(payload.email, 160);

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Customer email required.",
      });
    }

    const totalAmount = safeNumber(
      payload.total_amount ||
        payload.subtotal_amount ||
        payload.amount_paid ||
        payload.amount,
      0
    );

    if (totalAmount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Invalid payment amount.",
      });
    }

    const category = safeString(payload.category || "membership");
    const paymentMethod = safeString(payload.payment_method || "stripe_card");

    const metadata = buildStripeMetadata(payload, totalAmount);

    console.log("STRIPE METADATA:", metadata);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      customer_email: email,

      payment_method_types: stripeMethod(paymentMethod),

      success_url:
        payload.success_url ||
        `${frontendUrl()}/dash/finance/members?registration=success&session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        payload.cancel_url ||
        `${frontendUrl()}/dash/finance/members?registration=cancelled`,

      metadata,

      payment_intent_data: {
        metadata,
        receipt_email: email,
      },

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(totalAmount * 100),
            product_data: {
              name:
                safeString(payload.plan_name, 120) ||
                safeString(payload.program_title, 120) ||
                safeString(payload.program_name, 120) ||
                "Church Payment",

              description:
                category === "membership"
                  ? `Membership Registration (${payload.plan_name || ""})`
                  : "Church Payment",
            },
          },
        },
      ],
    });

    return res.json({
      ok: true,
      session_id: session.id,
      checkout_url: session.url,
      stripe_url: session.url,
      amount: totalAmount,
      metadata,
    });
  } catch (err) {
    console.error("CHECKOUT SESSION ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: err.message || "Unable to create checkout.",
    });
  }
});

module.exports = router;