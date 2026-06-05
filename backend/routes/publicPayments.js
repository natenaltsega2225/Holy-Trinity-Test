"use strict";

const express =
  require("express");

const Stripe =
  require("stripe");

const pool =
  require("../db");

const router =
  express.Router();

const stripe =
  new Stripe(
    process.env.STRIPE_SECRET_KEY
  );

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

function isEmail(
  value
) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(
      clean(value)
    );
}

function normalizeType(
  value
) {

  const v =
    clean(value)
      .toLowerCase();

  if (
    [
      "donation",
    ].includes(v)
  ) {
    return "donation";
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

  return v;
}

/* =========================================================
   PUBLIC CHECKOUT
========================================================= */

router.post(
  "/checkout",

  async (req, res) => {

    try {

      const {

        full_name,

        email,

        phone,

        payment_type,

        sub_category,

        amount,

        quantity,

        related_entity_id,

        registration_id,
      } = req.body || {};

      /* =====================================
         VALIDATION
      ===================================== */

      if (
        !full_name
      ) {

        return res.status(400).json({

          error:
            "Full name is required.",
        });
      }

      if (
        !email ||
        !isEmail(email)
      ) {

        return res.status(400).json({

          error:
            "Valid email is required.",
        });
      }

      if (
        !amount ||
        Number(amount) <= 0
      ) {

        return res.status(400).json({

          error:
            "Invalid amount.",
        });
      }

      const type =
        normalizeType(
          payment_type
        );

      if (
        ![
          "donation",
          "school",
          "trip",
        ].includes(type)
      ) {

        return res.status(400).json({

          error:
            "Invalid payment type.",
        });
      }

      /* =====================================
         STRIPE SESSION
      ===================================== */

      const session =
        await stripe.checkout.sessions.create({

          mode:
            "payment",

          payment_method_types: [
            "card",
          ],

          customer_email:
            email,

          success_url:
            `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,

          cancel_url:
            `${process.env.FRONTEND_URL}/payment-cancelled`,

          metadata: {

            full_name:
              clean(full_name),

            email:
              clean(email),

            phone:
              clean(phone),

            payment_type:
              type,

            category:
              type,

            sub_category:
              clean(
                sub_category
              ),

            quantity:
              String(
                quantity || 1
              ),

            related_entity_id:
              String(
                related_entity_id || ""
              ),

            registration_id:
              String(
                registration_id || ""
              ),
          },

          line_items: [

            {
              quantity:
                1,

              price_data: {

                currency:
                  "usd",

                unit_amount:
                  Math.round(
                    Number(amount) * 100
                  ),

                product_data: {

                  name:
                    `${type.toUpperCase()} PAYMENT`,

                  description:
                    sub_category ||
                    type,
                },
              },
            },
          ],
        });

      return res.json({

        ok: true,

        checkout_url:
          session.url,

        session_id:
          session.id,
      });

    } catch (err) {

      console.error(
        "POST /public-payments/checkout error:",
        err
      );

      return res.status(500).json({

        error:
          "Failed to create checkout session.",
      });
    }
  }
);

module.exports =
  router;