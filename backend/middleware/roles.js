
// // // // middleware/roles.js

// "use strict";

// function requireRole(...roles) {
//   const allow = new Set(roles);

//   return (req, res, next) => {
//     const role = req.user?.role;

//     if (role === "super_admin") return next();

//     if (!role || !allow.has(role)) {
//       return res.status(403).json({ error: "Forbidden" });
//     }

//     return next();
//   };
// }

// function isAdmin(req, res, next) {
//   if (["admin", "super_admin"].includes(req.user?.role)) return next();
//   return res.status(403).json({ error: "Admin only" });
// }

// function isFinance(req, res, next) {
//   if (["finance", "admin", "super_admin"].includes(req.user?.role)) return next();
//   return res.status(403).json({ error: "Finance only" });
// }

// function isReconciliation(req, res, next) {
//   if (["reconciliation", "admin", "super_admin"].includes(req.user?.role)) return next();
//   return res.status(403).json({ error: "Reconciliation only" });
// }

// function isSuperAdmin(req, res, next) {
//   if (req.user?.role === "super_admin") return next();
//   return res.status(403).json({ error: "Super admin only" });
// }

// module.exports = {
//   requireRole,
//   isAdmin,
//   isFinance,
//   isReconciliation,
//   isSuperAdmin,
// };

// middleware/roles.js

"use strict";

/*
====================================================
ENTERPRISE ROLE / PERMISSION MIDDLEWARE
====================================================
*/

const ROLE_LEVELS = Object.freeze({
  viewer: 5,
  member: 10,
  membership: 20,
  reconciliation: 30,
  finance: 40,
  it_admin: 70,
  admin: 80,
  super_admin: 100,
});

const SECURITY_POLICIES = Object.freeze({
  MFA_REQUIRED_ROLES: [
    "super_admin",
    "admin",
    "it_admin",
    "finance",
    "mfa.manage",
"audit.manage",
"security.audit",
"user.session.revoke",
  ],

  PRIVILEGED_ROLES: [
    "super_admin",
    "admin",
    "it_admin",
  ],

  SENSITIVE_PERMISSIONS: [
    "roles.manage",
    "users.manage",
    "users.disable",
    "users.reset_password",
    "security.manage",
    "payment.refund",
    "payment.reconcile",
    "reconciliation.approve",
    "settings.manage",
  ],
});

const ROLE_PERMISSIONS = Object.freeze({
  super_admin: ["*"],

  admin: [
    "dashboard.view",
    "reports.view",
    "audit.view",
    "settings.view",
    "settings.manage",
    "users.view",
    "roles.manage",
    "security.view",
  ],

  it_admin: [
    "dashboard.view",
    "users.view",
    "users.manage",
    "users.disable",
    "users.reset_password",
    "roles.manage",
    "audit.view",
    "security.view",
    "security.manage",
  ],

  finance: [
    "dashboard.view",

    "members.view",
    "members.create",
    "members.update",
    "households.manage",

    "finance.view",
    "finance.create",
    "finance.update",

    "invoice.view",
    "invoice.create",
    "invoice.update",
    "invoice.send",

    "payment.view",
    "payment.create",

    "receipt.view",
    "receipt.send",

    "pledge.view",
    "pledge.create",
    "pledge.update",

    "reports.view",
  ],

  reconciliation: [
    "dashboard.view",
    "finance.view",

    "payment.view",
    "payment.reconcile",
    "payment.verify",

    "reconciliation.view",
    "reconciliation.approve",

    "reports.view",
    "audit.view",
  ],

  membership: [
    "dashboard.view",
    "members.view",
    "members.update",
    "documents.view",
    "reports.view",
  ],

  member: [
    "dashboard.view",
    "profile.view",
    "profile.update",
    "invoice.view",
    "payment.create",
  ],

  viewer: [
    "dashboard.view",
    "members.view",
    "reports.view",
  ],
});

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

function getUserRole(req) {
  return normalizeRole(req.user?.role);
}

function isKnownRole(role) {
  return Object.prototype.hasOwnProperty.call(
    ROLE_LEVELS,
    normalizeRole(role)
  );
}

function isSuperAdminRole(role) {
  return normalizeRole(role) === "super_admin";
}

function isPrivilegedRole(role) {
  return SECURITY_POLICIES.PRIVILEGED_ROLES.includes(
    normalizeRole(role)
  );
}

function roleRequiresMfa(role) {
  return SECURITY_POLICIES.MFA_REQUIRED_ROLES.includes(
    normalizeRole(role)
  );
}

function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[normalizeRole(role)] || [];
}

function hasPermission(role, permission) {
  const permissions = getPermissionsForRole(role);

  return (
    permissions.includes("*") ||
    permissions.includes(permission)
  );
}

function hasAnyPermission(role, permissions = []) {
  return permissions.some((permission) =>
    hasPermission(role, permission)
  );
}

function hasAllPermissions(role, permissions = []) {
  return permissions.every((permission) =>
    hasPermission(role, permission)
  );
}

function isSensitivePermission(permission) {
  return SECURITY_POLICIES.SENSITIVE_PERMISSIONS.includes(
    permission
  );
}

function requireAuthenticated(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      error: "Authentication required.",
    });
  }

  const role = getUserRole(req);

  if (!isKnownRole(role)) {
    return res.status(403).json({
      ok: false,
      error: "Invalid or unsupported account role.",
    });
  }

  return next();
}

function requireActiveAccount(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      error: "Authentication required.",
    });
  }

  if (
    Number(req.user.is_active) === 0 ||
    Number(req.user.active) === 0 ||
    req.user.account_status === "disabled" ||
    req.user.account_status === "locked" ||
    req.user.status === "disabled"
  ) {
    return res.status(403).json({
      ok: false,
      error: "Account is not active.",
    });
  }

  if (
    req.user.account_locked_until &&
    new Date(req.user.account_locked_until).getTime() >
      Date.now()
  ) {
    return res.status(423).json({
      ok: false,
      error: "Account is temporarily locked.",
    });
  }

  return next();
}

function requirePasswordCurrent(req, res, next) {
  if (
    Number(req.user?.must_change_password) === 1 ||
    Number(req.user?.password_reset_required) === 1
  ) {
    return res.status(403).json({
      ok: false,
      error: "Password change required.",
      password_change_required: true,
    });
  }

  return next();
}

function requireRole(...roles) {
  const allowed = new Set(roles.map(normalizeRole));

  return (req, res, next) => {
    const role = getUserRole(req);

    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required.",
      });
    }

    if (isSuperAdminRole(role)) {
      return next();
    }

    if (!allowed.has(role)) {
      return res.status(403).json({
        ok: false,
        error: "Forbidden.",
      });
    }

    return next();
  };
}

function requireAnyRole(...roles) {
  return requireRole(...roles);
}

function requireMinimumRole(minimumRole) {
  return (req, res, next) => {
    const role = getUserRole(req);

    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required.",
      });
    }

    if (isSuperAdminRole(role)) {
      return next();
    }

    const userLevel = ROLE_LEVELS[role] || 0;
    const requiredLevel =
      ROLE_LEVELS[normalizeRole(minimumRole)] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        ok: false,
        error: "Insufficient access level.",
      });
    }

    return next();
  };
}

function requirePermission(...permissions) {
  return (req, res, next) => {
    const role = getUserRole(req);

    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required.",
      });
    }

    if (isSuperAdminRole(role)) {
      return next();
    }

    if (!hasAnyPermission(role, permissions)) {
      return res.status(403).json({
        ok: false,
        error:
          "You do not have permission to perform this action.",
      });
    }

    return next();
  };
}

function requireAllPermissions(...permissions) {
  return (req, res, next) => {
    const role = getUserRole(req);

    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required.",
      });
    }

    if (isSuperAdminRole(role)) {
      return next();
    }

    if (!hasAllPermissions(role, permissions)) {
      return res.status(403).json({
        ok: false,
        error:
          "You do not have all required permissions.",
      });
    }

    return next();
  };
}

function requireMfaForSensitiveRoles(req, res, next) {
  const role = getUserRole(req);

  if (
    roleRequiresMfa(role) &&
    req.user?.mfa_enabled &&
    !req.user?.mfa_verified
  ) {
    return res.status(403).json({
      ok: false,
      error: "MFA verification required.",
      mfa_required: true,
    });
  }

  return next();
}

function requireMfaForSensitiveAction(...permissions) {
  return (req, res, next) => {
    const role = getUserRole(req);

    const sensitive =
      roleRequiresMfa(role) ||
      permissions.some(isSensitivePermission);

    if (
      sensitive &&
      req.user?.mfa_enabled &&
      !req.user?.mfa_verified
    ) {
      return res.status(403).json({
        ok: false,
        error:
          "MFA verification required for this action.",
        mfa_required: true,
      });
    }

    return next();
  };
}

function preventSelfApproval({
  actorId,
  createdBy,
  message =
    "Separation of duties violation: user cannot approve their own transaction.",
}) {
  if (
    actorId &&
    createdBy &&
    Number(actorId) === Number(createdBy)
  ) {
    const err = new Error(message);
    err.status = 403;
    throw err;
  }
}

function canManageTargetRole(actorRole, targetRole) {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(targetRole);

  if (actor === "super_admin") return true;

  if (target === "super_admin") return false;

  if (
    actor === "admin" &&
    !["super_admin"].includes(target)
  ) {
    return true;
  }

  if (
    actor === "it_admin" &&
    ["member", "viewer", "membership", "finance", "reconciliation"].includes(target)
  ) {
    return true;
  }

  return false;
}

function requireCanManageTargetRole(getTargetRole) {
  return async (req, res, next) => {
    try {
      const actorRole = getUserRole(req);

      const targetRole =
        typeof getTargetRole === "function"
          ? await getTargetRole(req)
          : getTargetRole;

      if (
        !canManageTargetRole(
          actorRole,
          targetRole
        )
      ) {
        return res.status(403).json({
          ok: false,
          error:
            "You cannot manage this account role.",
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function isAdmin(req, res, next) {
  return requireRole(
    "admin",
    "super_admin"
  )(req, res, next);
}

function isITAdmin(req, res, next) {
  return requireRole(
    "it_admin",
    "admin",
    "super_admin"
  )(req, res, next);
}

function isFinance(req, res, next) {
  return requireRole(
    "finance",
    "admin",
    "super_admin"
  )(req, res, next);
}

function isReconciliation(req, res, next) {
  return requireRole(
    "reconciliation",
    "admin",
    "super_admin"
  )(req, res, next);
}

function isMembership(req, res, next) {
  return requireRole(
    "membership",
    "finance",
    "admin",
    "super_admin"
  )(req, res, next);
}

function isViewer(req, res, next) {
  return requireRole(
    "viewer",
    "member",
    "membership",
    "reconciliation",
    "finance",
    "it_admin",
    "admin",
    "super_admin"
  )(req, res, next);
}

function isSuperAdmin(req, res, next) {
  return requireRole("super_admin")(
    req,
    res,
    next
  );
}

module.exports = {
  ROLE_LEVELS,
  ROLE_PERMISSIONS,
  SECURITY_POLICIES,

  normalizeRole,
  getUserRole,
  isKnownRole,
  isSuperAdminRole,
  isPrivilegedRole,
  roleRequiresMfa,

  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isSensitivePermission,

  requireAuthenticated,
  requireActiveAccount,
  requirePasswordCurrent,
  requireRole,
  requireAnyRole,
  requireMinimumRole,
  requirePermission,
  requireAllPermissions,
  requireMfaForSensitiveRoles,
  requireMfaForSensitiveAction,
  requireCanManageTargetRole,

  preventSelfApproval,
  canManageTargetRole,

  isAdmin,
  isITAdmin,
  isFinance,
  isReconciliation,
  isMembership,
  isViewer,
  isSuperAdmin,
};