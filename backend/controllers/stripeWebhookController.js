"use strict";

const Stripe = require("stripe");

const pool = require("../db");

const {
  completePayment,
  sessionToPayload,
} = require("../services/paymentService");

const {
  markRegistrationPaid,
  markRegistrationFailed,
} = require(
  "../services/domains/programs/programRegistrationService"
);

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

/* =========================================================
   WEBHOOK CONTROLLER
========================================================= */

async function stripeWebhookController(
  req,
  res
) {

  let event = null;

  try {

    const signature =
      req.headers[
        "stripe-signature"
      ];

    event =
      stripe.webhooks.constructEvent(

        req.body,

        signature,

        process.env
          .STRIPE_WEBHOOK_SECRET
      );

  } catch (err) {

    console.error(
      "Stripe webhook signature error:",
      err
    );

    return res.status(400).send(
      `Webhook Error: ${err.message}`
    );
  }

  try {

    switch (event.type) {

      /* =====================================
         CHECKOUT COMPLETED
      ===================================== */

      case "checkout.session.completed": {

        const session =
          event.data.object;

        const payload =
          sessionToPayload(
            session,
            event
          );

        const result =
          await completePayment(
            payload
          );

        /* =================================
           PROGRAM REGISTRATION
        ================================= */

        if (
          (
            payload.payment_type ===
              "school" ||

            payload.payment_type ===
              "trip"
          ) &&

          payload.registration_id
        ) {

          try {

            await pool.query(
              "START TRANSACTION"
            );

            await markRegistrationPaid(
              pool,
              {

                registration_id:
                  payload.registration_id,

                payment_id:
                  result.payment_id,

                stripe_payment_intent_id:
                  payload.stripe_payment_intent_id,

                stripe_checkout_session_id:
                  payload.stripe_checkout_session_id,
              }
            );

            await pool.query(
              "COMMIT"
            );

          } catch (err) {

            await pool.query(
              "ROLLBACK"
            );

            console.error(
              "Program registration update failed:",
              err
            );
          }
        }

        break;
      }

      /* =====================================
         PAYMENT FAILED
      ===================================== */

      case "checkout.session.expired": {

        const session =
          event.data.object;

        const registrationId =
          session.metadata
            ?.registration_id;

        if (registrationId) {

          try {

            await markRegistrationFailed(
              pool,
              registrationId,
              "Stripe session expired."
            );

          } catch (err) {

            console.error(
              "Failed marking registration expired:",
              err
            );
          }
        }

        break;
      }

      /* =====================================
         PAYMENT INTENT FAILED
      ===================================== */

      case "payment_intent.payment_failed": {

        console.error(
          "Stripe payment failed:",
          event.data.object?.last_payment_error
        );

        break;
      }

      default:
        break;
    }

    return res.json({
      received: true,
    });

  } catch (err) {

    console.error(
      "Stripe webhook processing error:",
      err
    );

    return res.status(500).json({

      error:
        err.message ||

        "Webhook processing failed.",
    });
  }
}

module.exports = {
  stripeWebhookController,
};