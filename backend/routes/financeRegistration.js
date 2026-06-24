// backend/routes/financeRegistration.js
"use strict";

const express = require("express");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const {
  registerMember,
  registerMemberManual,
  registerMemberStripe,
  registrationControllerHealth,
} = require("../controllers/financeRegistrationController");

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

router.use(authRequired);

router.use(
  requireRole(
    "finance",
    "admin",
    "super_admin"
  )
);

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

router.get("/health/check", registrationControllerHealth);

/* -------------------------------------------------------------------------- */
/* Unified Finance Registration                                               */
/* -------------------------------------------------------------------------- */
/*
  POST /api/finance/registration

  Supports:
  - card
  - ach
  - cash
  - check
  - zelle

  Controller decides whether to create a manual paid registration
  or a Stripe pending-payment checkout.
*/

router.post("/", registerMember);

/* -------------------------------------------------------------------------- */
/* Manual Registration                                                        */
/* -------------------------------------------------------------------------- */
/*
  POST /api/finance/registration/manual

  Supports:
  - cash
  - check
  - zelle
*/

router.post("/manual", registerMemberManual);

/* -------------------------------------------------------------------------- */
/* Stripe Registration                                                        */
/* -------------------------------------------------------------------------- */
/*
  POST /api/finance/registration/stripe

  Supports:
  - card
  - ach
*/

router.post("/stripe", registerMemberStripe);

/* -------------------------------------------------------------------------- */
/* Compatibility Aliases                                                      */
/* -------------------------------------------------------------------------- */

function forceMethod(method, handler) {
  return (req, res, next) => {
    req.body = {
      ...(req.body || {}),
      payment_method: method,
      method,
    };

    return handler(req, res, next);
  };
}

router.post("/cash", forceMethod("cash", registerMemberManual));
router.post("/check", forceMethod("check", registerMemberManual));
router.post("/zelle", forceMethod("zelle", registerMemberManual));

router.post("/card", forceMethod("card", registerMemberStripe));
router.post("/ach", forceMethod("ach", registerMemberStripe));

/* -------------------------------------------------------------------------- */
/* Method Guard                                                               */
/* -------------------------------------------------------------------------- */

router.all("*", (_req, res) => {
  return res.status(405).json({
    ok: false,
    error: "Method Not Allowed",
  });
});

module.exports = router;