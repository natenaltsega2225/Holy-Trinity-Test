// backend/services/domains/payments/stripeCheckoutService.js
"use strict";

const Stripe =
  require("stripe");

const stripe =
  new Stripe(
    process.env.STRIPE_SECRET_KEY
  );

/* =========================================================
   HELPERS
========================================================= */

const FRONTEND_URL =

  process.env.FRONTEND_URL ||

  "http://localhost:5173";

function money(
  value
) {

  return Math.round(
    Number(value || 0) * 100
  );
}

function normalizeCategory(
  value
) {

  const allowed = [

    "membership",

    "donation",

    "school",

    "trip",

    "pledge",
  ];

  const category =
    String(
      value || ""
    ).toLowerCase();

  return allowed.includes(
    category
  )
    ? category
    : "donation";
}

function buildDescription(
  payload = {}
) {

  switch (
    payload.category
  ) {

    case "membership":

      return `
Membership Dues
${payload.sub_category || ""}
      `.trim();

    case "donation":

      return `
Donation
${payload.sub_category || ""}
      `.trim();

    case "school":

      return `
Kids School Program
${payload.sub_category || ""}
      `.trim();

    case "trip":

      return `
Trip Program
${payload.sub_category || ""}
      `.trim();

    case "pledge":

      return `
Pledge Payment
${payload.sub_category || ""}
      `.trim();

    default:

      return "Payment";
  }
}

/* =========================================================
   CREATE CHECKOUT SESSION
========================================================= */

async function createStripeCheckoutSession(
  payload = {}
) {

  const amount =
    Number(
      payload.amount || 0
    );

  if (
    amount <= 0
  ) {

    throw new Error(
      "Invalid payment amount."
    );
  }

  const category =
    normalizeCategory(
      payload.category
    );

  const quantity =
    Math.max(
      1,
      Number(
        payload.quantity || 1
      )
    );

  const fullName =

    payload.full_name ||

    payload.user?.full_name ||

    "Guest";

  const email =

    payload.email ||

    payload.user?.email ||

    "";

  /* =====================================
     METADATA
  ===================================== */

  const metadata = {

    category,

    sub_category:
      String(
        payload.sub_category || ""
      ),

    member_id:
      String(
        payload.member_id || ""
      ),

    user_id:
      String(
        payload.user?.id || ""
      ),

    months_paid:
      String(
        payload.months_paid || 1
      ),

    quantity:
      String(quantity),

    full_name:
      fullName,

    email,
  };

  /* =====================================
     SESSION
  ===================================== */

  const session =
    await stripe.checkout.sessions.create({

      mode:
        "payment",

      payment_method_types: [

        "card",
      ],

      customer_email:
        email || undefined,

      metadata,

      line_items: [

        {

          quantity,

          price_data: {

            currency:
              "usd",

            unit_amount:
              money(amount),

            product_data: {

              name:
                buildDescription(
                  payload
                ),

              description:
                `
                ${category}
                payment
                `.trim(),
            },
          },
        },
      ],

      success_url:
        `
        ${FRONTEND_URL}
        /payment-success
        ?session_id={CHECKOUT_SESSION_ID}
        `.replace(/\s+/g, ""),

      cancel_url:
        `
        ${FRONTEND_URL}
        /payment-cancelled
        `.replace(/\s+/g, ""),
    });

  return session;
}

/* =========================================================
   RETRIEVE SESSION
========================================================= */

async function retrieveCheckoutSession(
  sessionId
) {

  return stripe.checkout.sessions.retrieve(
    sessionId,
    {
      expand: [
        "payment_intent",
      ],
    }
  );
}

/* =========================================================
   CREATE REFUND
========================================================= */

async function createRefund(
  paymentIntentId,
  amount = null
) {

  const payload = {

    payment_intent:
      paymentIntentId,
  };

  if (
    amount !== null
  ) {

    payload.amount =
      money(amount);
  }

  return stripe.refunds.create(
    payload
  );
}

/* =========================================================
   STRIPE CUSTOMER
========================================================= */

async function createCustomer(
  payload = {}
) {

  return stripe.customers.create({

    name:
      payload.full_name,

    email:
      payload.email,

    phone:
      payload.phone || undefined,
  });
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createStripeCheckoutSession,

  retrieveCheckoutSession,

  createRefund,

  createCustomer,
};