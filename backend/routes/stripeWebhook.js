
// backend/routes/stripeWebhook.js
"use strict";

const express = require("express");

const {
  stripeWebhookController,
} = require("../controllers/stripeWebhookController");

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Important                                                                  */
/* -------------------------------------------------------------------------- */
/*
  Stripe webhooks must receive the exact raw request body.

  Requirements:
  1. Do not protect this route with authRequired.
  2. Mount this router before express.json() in server.js.
  3. Stripe dashboard endpoint should point to:
     POST /api/stripe/webhook
*/

const stripeRawBody = express.raw({
  type: [
    "application/json",
    "application/*+json",
  ],
  limit: process.env.STRIPE_WEBHOOK_BODY_LIMIT || "2mb",
});

/* -------------------------------------------------------------------------- */
/* Security Headers                                                           */
/* -------------------------------------------------------------------------- */

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", (_req, res) => {
  return res.json({
    ok: true,
    module: "stripeWebhook",
    version: "enterprise",
    endpoint: "/api/stripe/webhook",
    aliases: [
      "/api/stripe/webhook/stripe",
      "/api/stripe/webhook/events",
    ],
    raw_body_required: true,
    auth_required: false,
    stripe_configured: Boolean(process.env.STRIPE_SECRET_KEY),
    webhook_secret_configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    supported_events: [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
      "invoice.paid",
      "payment_intent.payment_failed",
    ],
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Webhook Endpoints                                                          */
/* -------------------------------------------------------------------------- */

router.post(
  "/",
  stripeRawBody,
  stripeWebhookController
);

router.post(
  "/stripe",
  stripeRawBody,
  stripeWebhookController
);

router.post(
  "/events",
  stripeRawBody,
  stripeWebhookController
);

/* -------------------------------------------------------------------------- */
/* Method Guard                                                               */
/* -------------------------------------------------------------------------- */

function methodNotAllowed(_req, res) {
  return res.status(405).json({
    ok: false,
    error: "Method Not Allowed",
    allowed_methods: ["POST"],
  });
}

router.all("/", methodNotAllowed);
router.all("/stripe", methodNotAllowed);
router.all("/events", methodNotAllowed);

/* -------------------------------------------------------------------------- */
/* Route Error Handler                                                        */
/* -------------------------------------------------------------------------- */

router.use((err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error("Stripe webhook route error:", err);

  return res.status(400).json({
    ok: false,
    error:
      err.message ||
      "Invalid Stripe webhook request.",
  });
});

module.exports = router;