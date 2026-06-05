//backend\routes\financeRegistration.js

"use strict";

const express = require("express");

const {
  authRequired,
  requireRole,
} = require(
  "../middleware/auth"
);

const {

  registerMemberManual,

  registerMemberStripe,

} = require(
  "../controllers/financeRegistrationController"
);

const router =
  express.Router();

/* =========================================================
   SECURITY
========================================================= */

router.use(
  authRequired
);

router.use(

  requireRole(
    "finance",
    "admin",
    "super_admin"
  )
);

/* =========================================================
   MANUAL MEMBER REGISTRATION
========================================================= */

router.post(
  "/manual",
  registerMemberManual
);

/* =========================================================
   STRIPE MEMBER REGISTRATION
========================================================= */

router.post(
  "/stripe",
  registerMemberStripe
);

module.exports =
  router;