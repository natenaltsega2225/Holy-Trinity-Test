
// // // middleware/roles.js

"use strict";

function requireRole(...roles) {
  const allow = new Set(roles);

  return (req, res, next) => {
    const role = req.user?.role;

    if (role === "super_admin") return next();

    if (!role || !allow.has(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}

function isAdmin(req, res, next) {
  if (["admin", "super_admin"].includes(req.user?.role)) return next();
  return res.status(403).json({ error: "Admin only" });
}

function isFinance(req, res, next) {
  if (["finance", "admin", "super_admin"].includes(req.user?.role)) return next();
  return res.status(403).json({ error: "Finance only" });
}

function isReconciliation(req, res, next) {
  if (["reconciliation", "admin", "super_admin"].includes(req.user?.role)) return next();
  return res.status(403).json({ error: "Reconciliation only" });
}

function isSuperAdmin(req, res, next) {
  if (req.user?.role === "super_admin") return next();
  return res.status(403).json({ error: "Super admin only" });
}

module.exports = {
  requireRole,
  isAdmin,
  isFinance,
  isReconciliation,
  isSuperAdmin,
};