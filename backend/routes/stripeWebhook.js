

// backend/routes/stripeWebhook.js
"use strict";

const express = require("express");
const Stripe = require("stripe");
const pool = require("../db");

const {
  retrieveCardSummary,
  processSuccessfulPayment,
  sessionToPayload,
} = require("../services/paymentService");

const {
  sendMemberWelcomeEmail,
  sendInvoiceEmail,
} = require("../services/emailService");

const {
  sendReceiptEmail,
} = require(
  "../services/domains/receipts/receiptEmailService"
);
function optionalRequire(path, fallback = {}) {
  try {
    return require(path);
  } catch (err) {
    console.warn(`Optional module missing: ${path}`);
    return fallback;
  }
}

const {
  generateReceiptPdfBuffer = async () => null,
} = optionalRequire("../services/domains/receipts/receiptPdfService.js");

const {
  generateInvoicePdfBuffer = async () => null,
} = optionalRequire("../services/domains/invoices/invoicePdfService.js");

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

/* =========================================================
   STRIPE WEBHOOK ENTRY
   Mounted at: /api/stripe/webhook
========================================================= */

router.post(
  "/",
  express.raw({
    type: "application/json",
  }),
  async (req, res) => {
  console.log(
  "BODY IS BUFFER:",
  Buffer.isBuffer(req.body)
);

console.log(
  "CONTENT TYPE:",
  req.headers["content-type"]
);

console.log(
  "SIGNATURE EXISTS:",
  !!req.headers["stripe-signature"]
);

console.log(
  "WEBHOOK SECRET EXISTS:",
  !!endpointSecret
);

    if (!stripe) {
      return res.status(500).json({
        ok: false,
        error: "Stripe is not configured.",
      });
    }

    let event;

    try {
      const signature = req.headers["stripe-signature"];

      if (!endpointSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is missing.");
      }

      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        endpointSecret
      );

      console.log("✅ Stripe event received:", event.type);
    } catch (err) {
      console.error("❌ Stripe webhook signature failed:", err.message);

      return res.status(400).send(
        `Webhook Error: ${err.message}`
      );
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
          await handleCheckoutCompleted(event);
          break;

        case "payment_intent.succeeded":
  console.log(
    "Ignoring payment_intent.succeeded"
  );
  break;

        case "payment_intent.processing":
          await handlePaymentProcessing(event);
          break;

        case "payment_intent.payment_failed":
          await handlePaymentFailed(event);
          break;

        case "invoice.paid":
          await handleInvoicePaid(event);
          break;

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event);
          break;

        case "charge.refunded":
          await handleChargeRefunded(event);
          break;

        default:
          console.log("Stripe webhook ignored:", event.type);
      }

      return res.json({
        received: true,
      });
    } catch (err) {
     console.error("❌ STRIPE WEBHOOK ERROR");
console.error(err);
console.error(err?.message);
console.error(err?.stack);

if (err?.sqlMessage) {
  console.error("SQL:", err.sqlMessage);
}

      return res.status(500).json({
        ok: false,
        error: "Webhook processing failed.",
      });
    }
  }
);

/* =========================================================
   CHECKOUT COMPLETED
========================================================= */

async function handleCheckoutCompleted(event) {

  const sessionObject =
    event.data.object;

  const session =
    await stripe.checkout.sessions.retrieve(
      sessionObject.id,
      {
        expand: [
          "payment_intent",
          "customer",
          "subscription",
        ],
      }
    );

  const paymentIntentId =
    getPaymentIntentId(session);

  if (
    !paymentIntentId &&
    session.payment_status !== "paid"
  ) {

    console.log(
      "Checkout not paid yet, ignored:",
      session.id
    );

    return;
  }

  /* =========================================
     DUPLICATE CHECK
  ========================================= */

  const duplicate =
    await findExistingStripePayment({

      stripe_event_id:
        event.id,

      stripe_checkout_session_id:
        session.id,

      stripe_payment_intent_id:
        paymentIntentId,
    });

  if (duplicate) {

    console.log(
      "Stripe duplicate checkout ignored:",
      session.id
    );

    return;
  }

  /* =========================================
     LOAD PAYMENT INTENT
  ========================================= */

  let stripeCard = {};

  if (paymentIntentId) {

    try {

      const paymentIntent =
        await stripe.paymentIntents.retrieve(
          paymentIntentId,
          {
            expand: [
              "charges.data.payment_method_details",
            ],
          }
        );

      const charge =
        paymentIntent?.charges?.data?.[0];

      const card =
        charge?.payment_method_details?.card;

      if (card) {

        stripeCard = {

          card_last4:
            card.last4 || null,

          card_brand:
            card.brand || null,

          card_exp_month:
            card.exp_month || null,

          card_exp_year:
            card.exp_year || null,
        };
      }

    } catch (err) {

      console.error(
        "Unable to retrieve Stripe card details:",
        err.message
      );
    }
  }

  /* =========================================
     LEGACY CARD SUMMARY
  ========================================= */

  const cardSummary =
    await retrieveCardSummary(
      paymentIntentId
    );

  /* =========================================
     BUILD PAYLOAD
  ========================================= */

  const payload =
    enrichStripePayload(

      sessionToPayload(
        session,
        event,
        {
          ...cardSummary,
          ...stripeCard,
        }
      ),

      {
        source: session,
        event,
        paymentIntentId,
      }
    );

  /* =========================================
     PROCESS TRANSACTION
  ========================================= */

  await runPaymentTransaction({

    event,

    payload: {

      ...payload,

      ...stripeCard,

      username:
        session.metadata?.username ||
        payload.username ||
        null,

      temporary_password:
        session.metadata?.temporary_password ||
        payload.temporary_password ||
        null,

      send_welcome_email:
        session.metadata?.send_welcome_email ===
        "true",

      status: "paid",

      provider: "stripe",

      reconciliation_status:
        "pending",

      send_receipt_email: true,

      paid_at: mysqlNow(),
    },

    activity: {

      title:
        "Stripe Checkout Completed",

      message:
        `Stripe checkout payment processed: ${session.id}`,
    },
  });

  console.log(
    "Stripe checkout processed:",
    session.id
  );
}


/* =========================================================
   PAYMENT INTENT SUCCEEDED
========================================================= */

async function handlePaymentIntentSucceeded(
  event
) {

  const paymentIntent =
    event.data.object;

  const metadata =
    paymentIntent.metadata || {};

  /* =========================================
     DUPLICATE CHECK
  ========================================= */

  const duplicate =
    await findExistingStripePayment({

      stripe_event_id:
        event.id,

      stripe_payment_intent_id:
        paymentIntent.id,
    });

  if (duplicate) {

    console.log(
      "Stripe payment_intent duplicate ignored:",
      paymentIntent.id
    );

    return;
  }

  /* =========================================
     DIRECT PAYMENT ONLY
  ========================================= */

  if (
    metadata.process_direct_payment !==
    "true"
  ) {

    await createStripeActivitySafe({

      event_id:
        event.id,

      event_type:
        event.type,

      title:
        "Stripe PaymentIntent Succeeded",

      message:
        `PaymentIntent logged only: ${paymentIntent.id}`,

      member_id:
        Number(
          metadata.member_id || 0
        ) || null,
    });

    return;
  }

  /* =========================================
     LOAD STRIPE CARD DETAILS
  ========================================= */

  let stripeCard = {};

  try {

    const fullIntent =
      await stripe.paymentIntents.retrieve(
        paymentIntent.id,
        {
          expand: [
            "charges.data.payment_method_details",
          ],
        }
      );

    const charge =
      fullIntent?.charges?.data?.[0];

    const card =
      charge?.payment_method_details?.card;

    if (card) {

      stripeCard = {

        card_last4:
          card.last4 || null,

        card_brand:
          card.brand || null,

        card_exp_month:
          card.exp_month || null,

        card_exp_year:
          card.exp_year || null,
      };
    }

  } catch (err) {

    console.error(
      "Stripe card retrieve failed:",
      err.message
    );
  }

  /* =========================================
     LEGACY SUMMARY
  ========================================= */

  const cardSummary =
    await retrieveCardSummary(
      paymentIntent.id
    );

  /* =========================================
     BUILD PAYLOAD
  ========================================= */

  const payload =
    enrichStripePayload(

      {

        stripe_event_id:
          event.id,

        stripe_payment_intent_id:
          paymentIntent.id,

        ...cardSummary,

        ...stripeCard,

        payment_type:
          metadata.payment_type ||
          metadata.category ||
          "donation",

        category:
          metadata.category ||
          metadata.payment_type ||
          "donation",

        sub_category:
          metadata.sub_category ||
          metadata.donation_category ||
          metadata.plan_name ||
          metadata.program_name ||
          metadata.program_title ||
          null,

        donation_category:
          metadata.donation_category ||
          null,

        donation_category_label:
          donationLabel(
            metadata.donation_category
          ),

        user_id:
          Number(
            metadata.user_id || 0
          ) || null,

        member_id:
          Number(
            metadata.member_id || 0
          ) || null,

        member_no:
          metadata.member_no || null,

        full_name:
          metadata.full_name ||
          cardSummary.cardholder_name ||
          "",

        email:
          metadata.email || "",

        phone:
          metadata.phone || "",

        amount:
          Number(
            paymentIntent.amount_received ||
            paymentIntent.amount ||
            0
          ) / 100,

        plan_id:
          Number(
            metadata.plan_id ||
            metadata.dues_plan_id ||
            0
          ) || null,

        dues_plan_id:
          Number(
            metadata.dues_plan_id ||
            metadata.plan_id ||
            0
          ) || null,

        plan_name:
          metadata.plan_name ||
          null,

        months_paid:
          Number(
            metadata.months_paid ||
            metadata.duration_months ||
            0
          ) || 0,

        coverage_year:
          Number(
            metadata.coverage_year ||
            0
          ) || null,

        coverage_start_month:
          metadata.coverage_start_month ||
          null,

        coverage_end_month:
          metadata.coverage_end_month ||
          null,

        coverage_label:
          metadata.coverage_label ||
          null,

        method:
          detectStripeMethod(
            paymentIntent
          ),

        provider:
          "stripe",

        status:
          "paid",

        reconciliation_status:
          "pending",

        send_receipt_email:
          true,

        paid_at:
          mysqlNow(),
      },

      {
        source:
          paymentIntent,

        event,

        paymentIntentId:
          paymentIntent.id,
      }
    );

  /* =========================================
     PROCESS
  ========================================= */

  await runPaymentTransaction({

    event,

    payload,

    activity: {

      title:
        "Stripe PaymentIntent Succeeded",

      message:
        `Direct Stripe payment processed: ${paymentIntent.id}`,
    },
  });

  console.log(
    "Stripe direct payment processed:",
    paymentIntent.id
  );
}
/* =========================================================
   PAYMENT PROCESSING — ACH
========================================================= */

async function handlePaymentProcessing(event) {
  const paymentIntent = event.data.object;
  const metadata = paymentIntent.metadata || {};

  await createStripeActivitySafe({
    event_id: event.id,
    event_type: event.type,
    member_id: Number(metadata.member_id || 0) || null,
    title: "Stripe Payment Processing",
    message: `Stripe payment is processing: ${paymentIntent.id}`,
    severity: "info",
  });

  console.log("Stripe payment processing:", paymentIntent.id);
}

/* =========================================================
   STRIPE INVOICE PAID - SUBSCRIPTION RENEWAL
========================================================= */

async function handleInvoicePaid(event) {
  const invoice = event.data.object;
  const metadata = invoice.metadata || {};

  if (!metadata.process_membership_invoice && !metadata.member_id) {
    await createStripeActivitySafe({
      event_id: event.id,
      event_type: event.type,
      title: "Stripe Invoice Paid",
      message: `Stripe invoice paid logged only: ${invoice.id}`,
      member_id: Number(metadata.member_id || 0) || null,
    });

    return;
  }

  const paymentIntentId =
    typeof invoice.payment_intent === "string"
      ? invoice.payment_intent
      : invoice.payment_intent?.id || null;

  const duplicate = await findExistingStripePayment({
    stripe_event_id: event.id,
    stripe_payment_intent_id: paymentIntentId,
  });

  if (duplicate) {
    console.log("Stripe invoice duplicate ignored:", invoice.id);
    return;
  }

  const card = await retrieveCardSummary(paymentIntentId);

  const payload = enrichStripePayload(
    {
      stripe_event_id: event.id,
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id:
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id || null,

      stripe_subscription_id:
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id || null,

      ...card,

      payment_type: metadata.payment_type || "membership",
      category: metadata.category || "membership",

      member_id: Number(metadata.member_id || 0) || null,
      member_no: metadata.member_no || null,

      full_name:
        metadata.full_name || invoice.customer_name || card.cardholder_name || "",
      email: metadata.email || invoice.customer_email || "",
      phone: metadata.phone || "",

      amount: Number(invoice.amount_paid || 0) / 100,

      base_amount: Number(metadata.base_amount || 0) || null,
      membership_amount: Number(metadata.membership_amount || 0) || null,
      registration_fee: Number(metadata.registration_fee || 0) || 0,
      processing_fee: Number(metadata.processing_fee || 0) || 0,
      subtotal_amount: Number(metadata.subtotal_amount || 0) || null,

      plan_id: Number(metadata.plan_id || metadata.dues_plan_id || 0) || null,
      dues_plan_id:
        Number(metadata.dues_plan_id || metadata.plan_id || 0) || null,
      plan_name: metadata.plan_name || "Recurring Membership",

      duration_months:
        Number(metadata.duration_months || metadata.months_paid || 1) || 1,
      months_paid:
        Number(metadata.months_paid || metadata.duration_months || 1) || 1,
      coverage_year: Number(metadata.coverage_year || 0) || null,
      coverage_start_month: metadata.coverage_start_month || null,
      coverage_end_month: metadata.coverage_end_month || null,
      coverage_label: metadata.coverage_label || null,

      method: detectStripeMethod(invoice),
      provider: "stripe",
      status: "paid",
      reconciliation_status: "pending",
      send_receipt_email: true,
      paid_at: mysqlNow(),
    },
    {
      source: invoice,
      event,
      paymentIntentId,
    }
  );

  await runPaymentTransaction({
    event,
    payload,
    activity: {
      title: "Stripe Subscription Invoice Paid",
      message: `Recurring membership invoice processed: ${invoice.id}`,
    },
  });

  console.log("Stripe invoice paid processed:", invoice.id);
}

/* =========================================================
   FAILED EVENTS
========================================================= */

async function handlePaymentFailed(event) {
  const paymentIntent = event.data.object;

  await createStripeActivitySafe({
    event_id: event.id,
    event_type: event.type,
    member_id: Number(paymentIntent.metadata?.member_id || 0) || null,
    title: "Stripe Payment Failed",
    message:
      paymentIntent.last_payment_error?.message ||
      `Payment failed: ${paymentIntent.id}`,
    severity: "error",
  });

  console.error("Stripe payment failed:", paymentIntent.id);
}

async function handleInvoicePaymentFailed(event) {
  const invoice = event.data.object;

  await createStripeActivitySafe({
    event_id: event.id,
    event_type: event.type,
    member_id: Number(invoice.metadata?.member_id || 0) || null,
    title: "Stripe Invoice Payment Failed",
    message: `Subscription invoice payment failed: ${invoice.id}`,
    severity: "error",
  });

  console.error("Stripe invoice payment failed:", invoice.id);
}

/* =========================================================
   REFUND / DISPUTE / SUBSCRIPTION
========================================================= */

async function handleChargeRefunded(event) {
  const charge = event.data.object;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await markPaymentRefunded(conn, charge);

    await createStripeActivity(conn, {
      event_id: event.id,
      event_type: event.type,
      title: "Stripe Charge Refunded",
      message: `Stripe charge refunded: ${charge.id}`,
      severity: "warning",
    });

    await conn.commit();

    console.log("Stripe refund recorded:", charge.id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function handleDisputeCreated(event) {
  const dispute = event.data.object;

  await createStripeActivitySafe({
    event_id: event.id,
    event_type: event.type,
    title: "Stripe Dispute Created",
    message: `Stripe dispute created: ${dispute.id}`,
    severity: "error",
  });
}

async function handleSubscriptionDeleted(event) {
  const subscription = event.data.object;

  await createStripeActivitySafe({
    event_id: event.id,
    event_type: event.type,
    member_id: Number(subscription.metadata?.member_id || 0) || null,
    title: "Stripe Subscription Cancelled",
    message: `Subscription cancelled: ${subscription.id}`,
    severity: "warning",
  });
}

/* =========================================================
   PAYMENT TRANSACTION
========================================================= */

async function runPaymentTransaction({
  event,
  payload,
  activity,
}) {

  const conn =
    await pool.getConnection();

  try {

    await conn.beginTransaction();

    /* =========================================
       PROCESS PAYMENT
    ========================================= */

    const result =
      await processSuccessfulPayment(
        conn,
        payload
      );

    /* =========================================
       ACTIVITY FEED
    ========================================= */

    await createStripeActivity(
      conn,
      {
        event_id:
          event.id,

        event_type:
          event.type,

        payment_number:
          result?.payment
            ?.payment_number,

        member_id:
          payload.member_id ||
          null,

        title:
          activity.title,

        message:
          activity.message,

        severity:
          "success",
      }
    );

    /* =========================================
       COMMIT FIRST
    ========================================= */

    await conn.commit();

    /* =========================================
       WELCOME EMAIL
    ========================================= */
if (
  payload.send_welcome_email &&
  result?.member?.email
) {

  try {

    await sendMemberWelcomeEmail({

  /* old emailService style */
  to:
    result.member.email,

  fullName:
    result.member.full_name,

  memberNo:
    result.member.member_no,

  temporaryPassword:
    result.generated_temp_password,

  planName:
    result.payment?.plan_name,

  coverageLabel:
    result.payment?.coverage_label,

  loginUrl:
    `${process.env.FRONTEND_URL}/login`,

  resetUrl:
    `${process.env.FRONTEND_URL}/reset-password`,

  /* memberWelcomeService/template style */
  email:
    result.member.email,

  full_name:
    result.member.full_name,

  member_no:
    result.member.member_no,

  username:
    result.generated_username ||
    result.user?.username ||
    result.payment?.generated_username,

  temporary_password:
    result.generated_temp_password ||
    result.payment?.generated_temp_password,

  plan_name:
    result.payment?.plan_name,

  coverage_label:
    result.payment?.coverage_label,

  login_url:
    `${process.env.FRONTEND_URL}/login`,

  reset_link:
    `${process.env.FRONTEND_URL}/reset-password`,
});
    console.log(
      "✅ Welcome email sent:",
      result.member.email
    );

  } catch (err) {

    console.error(
      "❌ Welcome email failed:",
      err.message
    );
  }
}
    /* =========================================
       RECEIPT EMAIL
    ========================================= */

    if (
      payload.send_receipt_email &&
      payload.email &&
      result?.receipt?.id
    ) {

      try {

        await sendReceiptEmail(

          result.receipt.id,

          {
            email:
              payload.email,
          }
        );

      console.log(
  "✅ Receipt email sent:",
  result.member?.email ||
  payload.email
);

      } catch (err) {

        console.error(
          "❌ Receipt email failed:",
          err.message
        );
      }
    }

    /* =========================================
       INVOICE EMAIL
    ========================================= */

 if (
  result?.invoice?.id &&
  (
    result?.member?.email ||
    payload.email
  )
) {

  try {

    await sendInvoiceEmail({

      to:

        result.member?.email ||

        payload.email ||

        null,

      fullName:

        result.member?.full_name ||

        payload.full_name ||

        null,

      invoiceNumber:
        result.invoice?.invoice_number,

      amount:
        result.payment?.amount ||

        payload.amount ||
        0,
    });

    console.log(
      "✅ Invoice email sent:",
      result.member?.email ||
      payload.email
    );

  } catch (err) {

    console.error(
      "❌ Invoice email failed:",
      err.message
    );
  }
}
    /* =========================================
       SUCCESS
    ========================================= */

    console.log(
      "✅ Stripe transaction completed:",
      result?.payment
        ?.payment_number
    );

    return result;

  } catch (err) {

    await conn.rollback();

    console.error(
      "❌ Stripe transaction failed:",
      err
    );

    throw err;

  } finally {

    conn.release();
  }
}


/* =========================================================
   DB HELPERS
========================================================= */

async function recordStripeEvent(event) {
  try {
    await pool.query(
      `
      INSERT INTO tbl_stripe_events
        (
          event_id,
          event_type,
          payload_json,
          processed_at,
          created_at
        )
      VALUES (?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        processed_at = NOW(),
        updated_at = NOW()
      `,
      [event.id, event.type, JSON.stringify(event)]
    );
  } catch {
    // Optional table.
  }
}

async function findExistingStripePayment({
  stripe_event_id,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
}) {
  const conditions = [];
  const params = [];

  if (stripe_event_id) {
    conditions.push("stripe_event_id = ?");
    params.push(stripe_event_id);
  }

  if (stripe_checkout_session_id) {
    conditions.push("stripe_checkout_session_id = ?");
    params.push(stripe_checkout_session_id);
  }

  if (stripe_payment_intent_id) {
    conditions.push("stripe_payment_intent_id = ?");
    params.push(stripe_payment_intent_id);
  }

  if (!conditions.length) return null;

  const [rows] = await pool.query(
    `
    SELECT id, payment_number
    FROM tbl_finance_payments
    WHERE ${conditions.join(" OR ")}
    LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

async function markPaymentRefunded(conn, charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id || null;

  const refundedAmount = Number(charge.amount_refunded || 0) / 100;

  await conn
    .query(
      `
      UPDATE tbl_finance_payments
      SET
        status = 'refunded',
        payment_status = 'refunded',
        refunded_amount = ?,
        refund_amount = ?,
        stripe_refund_id = ?,
        reconciliation_status = 'refund_pending',
        updated_at = NOW()
      WHERE stripe_charge_id = ?
         OR stripe_payment_intent_id = ?
      `,
      [
        refundedAmount,
        refundedAmount,
        charge.refunds?.data?.[0]?.id || null,
        charge.id,
        paymentIntentId,
      ]
    )
    .catch((err) => {
      console.error("markPaymentRefunded update failed:", err.message);
    });
}

async function createStripeActivitySafe(payload) {
  const conn = await pool.getConnection();

  try {
    await createStripeActivity(conn, payload);
  } finally {
    conn.release();
  }
}

async function createStripeActivity(conn, payload) {
  const tableNames = [
    "tbl_activity_feed",
    "tbl_member_activity",
    "tbl_finance_activity",
    "tbl_finance_notifications",
  ];

  for (const table of tableNames) {
    try {
      await conn.query(
        `
        INSERT INTO ${table}
          (
            activity_type,
            severity,
            title,
            message,
            member_id,
            reference_no,
            created_at
          )
        VALUES (?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          "stripe",
          payload.severity || "success",
          payload.title,
          payload.message,
          payload.member_id || null,
          payload.event_id || null,
        ]
      );

      return;
    } catch {
      // Optional table.
    }
  }
}

/* =========================================================
   HELPERS
========================================================= */

function mysqlNow() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function getPaymentIntentId(session) {
  if (!session?.payment_intent) return null;

  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent.id || null;
}

function detectStripeMethod(object = {}) {
  const metadata = object.metadata || {};

  if (metadata.method === "ach" || metadata.payment_method === "ach") {
    return "ach";
  }

  const types = object.payment_method_types || object.payment_method_options || [];

  if (Array.isArray(types) && types.includes("us_bank_account")) {
    return "ach";
  }

  if (object.payment_method_types?.includes?.("us_bank_account")) {
    return "ach";
  }

  return "card";
}

function parseJson(value, fallback = []) {
  try {
    if (!value) return fallback;
    if (Array.isArray(value)) return value;

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function donationLabel(value) {
  const key = String(value || "").toLowerCase();

  const map = {
    plate_collection: "መባ — Plate Collection",
    candle_sale: "ሻማ — Candle Sale",
    general_donation: "ስጦታ — General Donation",
    tithe: "አስራት — Tithe",
    vows: "ስዕለት — Vows",
    baptism: "ክርስትና — Baptism",
    wedding_engagement: "ጋብቻ — Wedding / Engagement",
    memorial_service: "ፍታት — Memorial Service",
    pledge: "ቃል የተገባ — Pledge",
    building_fund: "ማሰሪያ — Building Fund",
    charity_fund: "በጎ አድራጎት — Charity Fund",
    auction: "ጨረታ — Auction",
    other_fund: "ሌላ — Other Fund",
  };

  return map[key] || value || null;
}

function buildCoverageMonths(
  year,
  startMonth,
  months
) {

  const count =
    Math.max(
      1,
      Number(months || 1)
    );

  let startYear =
    Number(year || 0);

  let startMonthNumber =
    null;

  /* =====================================
     SUPPORT YYYY-MM FORMAT
  ===================================== */

  if (
    typeof startMonth === "string" &&
    startMonth.includes("-")
  ) {

    const parts =
      startMonth.split("-");

    startYear =
      Number(parts[0]);

    startMonthNumber =
      Number(parts[1]);

  } else {

    startMonthNumber =
      Number(startMonth);
  }

  if (
    !startYear ||
    !startMonthNumber
  ) {

    const now = new Date();

    startYear =
      now.getFullYear();

    startMonthNumber =
      now.getMonth() + 1;
  }

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const labels = [];

  for (
    let i = 0;
    i < count;
    i += 1
  ) {

    const rawMonth =
      startMonthNumber + i;

    const yearOffset =
      Math.floor(
        (rawMonth - 1) / 12
      );

    const monthIndex =
      (rawMonth - 1) % 12;

    labels.push({

      year:
        startYear + yearOffset,

      month_number:
        monthIndex + 1,

      month:
        monthNames[monthIndex],

      label:
        `${monthNames[monthIndex]} ${startYear + yearOffset}`,
    });
  }

  return labels;
}
function enrichStripePayload(payload = {}, context = {}) {
  const source = context.source || {};
  const metadata = source.metadata || payload.metadata || {};

  const method = detectStripeMethod(source);

  const coverageYear =
    Number(payload.coverage_year || metadata.coverage_year || 0) || null;

  const coverageStartMonth =
    payload.coverage_start_month || metadata.coverage_start_month || null;

  const monthsPaid =
    Number(payload.months_paid || metadata.months_paid || payload.duration_months || 0) || 0;

  const paidMonths =
    coverageYear && coverageStartMonth && monthsPaid
      ? buildCoverageMonths(coverageYear, Number(coverageStartMonth), monthsPaid)
      : [];

  const donationCategory =
    payload.donation_category || metadata.donation_category || null;

  return {
    ...payload,

    method,
    provider: "stripe",

    stripe_event_id: context.event?.id || payload.stripe_event_id || null,
    stripe_payment_intent_id:
      context.paymentIntentId || payload.stripe_payment_intent_id || null,

    donation_category: donationCategory,
    donation_category_label:
      payload.donation_category_label || donationLabel(donationCategory),

    registration_fee:
      Number(payload.registration_fee || metadata.registration_fee || 0) || 0,

    processing_fee:
      Number(payload.processing_fee || metadata.processing_fee || 0) || 0,

    base_amount:
      Number(payload.base_amount || metadata.base_amount || 0) || null,

    membership_amount:
      Number(payload.membership_amount || metadata.membership_amount || 0) ||
      null,

    subtotal_amount:
      Number(payload.subtotal_amount || metadata.subtotal_amount || 0) ||
      null,

    paid_months_json:
      paidMonths.length ? JSON.stringify(paidMonths) : null,

    coverage_months_json:
      payload.coverage_months_json ||
      metadata.coverage_months_json ||
      (paidMonths.length ? JSON.stringify(paidMonths) : null),

    reconciliation_status:
      payload.reconciliation_status || "pending",
  };
}

module.exports = router;