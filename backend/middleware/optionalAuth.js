// backend/middleware/optionalAuth.js
"use strict";

const jwt = require("jsonwebtoken");

const {
  getJwtSecret,
} = require("./auth");

/* =========================================================
   OPTIONAL AUTH
---------------------------------------------------------
 Allows BOTH:
 - guest users
 - authenticated users

 If token exists:
   req.user = decoded user

 If token missing/invalid:
   req.user = null

 NEVER blocks request.
========================================================= */

function optionalAuth(
  req,
  _res,
  next
) {

  try {

    const header =
      req.headers.authorization || "";

    const token =
      header.startsWith("Bearer ")
        ? header.slice(7)
        : null;

    if (!token) {

      req.user = null;

      return next();
    }

    const payload =
      jwt.verify(
        token,
        getJwtSecret()
      );

    req.user = {

      id:
        payload.id,

      member_id:
        payload.member_id || null,

      email:
        payload.email,

      role:
        payload.role,

      username:
        payload.username,
    };

    return next();

  } catch {

    /*
    IMPORTANT:
    never block request
    */

    req.user = null;

    return next();
  }
}

module.exports = {
  optionalAuth,
};