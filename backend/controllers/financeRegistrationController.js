"use strict";

const Stripe = require("stripe");

const {
  registerFinanceMember,
} = require(
  "../services/financeRegistrationService"
);

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

/* =========================================================
   HELPERS
========================================================= */

function clean(
  value,
  max = 500
) {

  return String(
    value ?? ""
  )
    .trim()
    .slice(0, max);
}

function money(value) {

  const n =
    Number(value || 0);

  return Number.isFinite(n)
    ? Number(
        n.toFixed(2)
      )
    : 0;
}

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

/* =========================================================
   REGISTER MEMBER (MANUAL)
========================================================= */

async function registerMemberManual(
  req,
  res
) {

  try {

    const fullName =
      clean(
        req.body.full_name,
        180
      );

    const email =
      clean(
        req.body.email,
        190
      );

    const phone =
      clean(
        req.body.phone,
        50
      );

    if (!fullName) {

      return res.status(400).json({

        error:
          "Full name is required.",
      });
    }

    if (!email) {

      return res.status(400).json({

        error:
          "Email is required.",
      });
    }

    const amount =
      money(
        req.body.amount
      );

    if (amount <= 0) {

      return res.status(400).json({

        error:
          "Invalid payment amount.",
      });
    }

    const result =
      await registerFinanceMember({

        full_name:
          fullName,

        email,

        phone,

        address:
          clean(
            req.body.address,
            500
          ),

        amount,

        method:
          clean(
            req.body.method ||
            "cash",
            40
          ),

        provider:
          clean(
            req.body.provider ||
            "manual",
            40
          ),

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
            req.body.plan_name ||
            "Monthly",
            120
          ),

        months_paid:
          Number(
            req.body.months_paid || 1
          ),
      });

    return res.json({

      ok: true,

      message:
        "Member registered successfully.",

      ...result,
    });

  } catch (err) {

    console.error(
      "registerMemberManual error:",
      err
    );

    return res.status(500).json({

      error:
        err.message ||

        "Failed to register member.",
    });
  }
}

/* =========================================================
   REGISTER MEMBER (CARD)
========================================================= */

async function registerMemberStripe(
  req,
  res
) {

  try {

    const fullName =
      clean(
        req.body.full_name,
        180
      );

    const email =
      clean(
        req.body.email,
        190
      );

    if (!fullName) {

      return res.status(400).json({

        error:
          "Full name is required.",
      });
    }

    if (!email) {

      return res.status(400).json({

        error:
          "Email is required.",
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

    const successUrl =
      `${frontendUrl()}/payment-success?session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      `${frontendUrl()}/payment-cancel`;

    const metadata = {

      payment_type:
        "membership",

      category:
        "membership",

      sub_category:
        clean(
          req.body.plan_name ||
          "Membership",
          120
        ),

      plan_name:
        clean(
          req.body.plan_name ||
          "Membership",
          120
        ),

      full_name:
        fullName,

      email,

      phone:
        clean(
          req.body.phone,
          50
        ),

      address:
        clean(
          req.body.address,
          500
        ),

      months_paid:
        String(
          Number(
            req.body.months_paid || 1
          )
        ),

      created_by_finance:
        "1",

      provider:
        "stripe",

      method:
        "card",
    };

    const session =
      await stripe.checkout.sessions.create({

        mode:
          "payment",

        success_url:
          successUrl,

        cancel_url:
          cancelUrl,

        customer_email:
          email,

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
                  `Membership Registration - ${metadata.plan_name}`,

                description:
                  `Member: ${fullName}`,
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
      "registerMemberStripe error:",
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

  registerMemberManual,

  registerMemberStripe,
};