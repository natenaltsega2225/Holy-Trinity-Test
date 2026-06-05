// backend/services/domains/rbac/rolePermissionService.js
"use strict";

const pool =
  require("../../../db");

const {

  insertExistingColumns,

  findMany,

  findOne,

} = require(
  "../../../utils/dbHelpers"
);

const {

  clean,

  mysqlNow,

} = require(
  "../../../utils/financeHelpers"
);

/* =========================================================
   DEFAULT ROLE MAP
========================================================= */

const DEFAULT_ROLE_PERMISSIONS = {

  super_admin: [

    "*",
  ],

  admin: [

    "dashboard.view",

    "members.view",
    "members.create",
    "members.edit",

    "events.view",
    "events.create",
    "events.edit",

    "forms.view",
    "forms.manage",

    "volunteers.view",
    "volunteers.manage",

    "reports.view",
    "reports.export",

    "settings.manage",
  ],

  finance: [

    "dashboard.view",

    "payments.view",
    "payments.create",
    "payments.edit",

    "invoices.view",
    "invoices.create",
    "invoices.edit",

    "receipts.view",

    "reconciliation.view",
    "reconciliation.manage",

    "reports.view",
    "reports.export",
  ],

  reconciliation: [

    "dashboard.view",

    "reconciliation.view",
    "reconciliation.manage",

    "reports.view",
  ],

  member: [

    "dashboard.view",

    "payments.view_own",

    "receipts.view_own",

    "invoices.view_own",

    "forms.submit",

    "events.register",

    "volunteer.join",
  ],
};

/* =========================================================
   HELPERS
========================================================= */

function normalizePermission(
  permission
) {

  return clean(
    String(
      permission || ""
    )
      .trim()
      .toLowerCase(),
    120
  );
}

/* =========================================================
   GET ROLE PERMISSIONS
========================================================= */

async function getRolePermissions(
  role
) {

  const roleName =
    String(
      role || ""
    ).trim();

  /* =====================================
     SUPER ADMIN
  ===================================== */

  if (
    roleName === "super_admin"
  ) {

    return ["*"];
  }

  /* =====================================
     DATABASE PERMISSIONS
  ===================================== */

  const rows =
    await findMany(

      pool,

      `
      SELECT permission_key

      FROM tbl_role_permissions

      WHERE role_name = ?
      `,

      [roleName]
    );

  if (rows.length) {

    return rows.map((r) =>
      normalizePermission(
        r.permission_key
      )
    );
  }

  /* =====================================
     DEFAULT MAP
  ===================================== */

  return (
    DEFAULT_ROLE_PERMISSIONS[
      roleName
    ] || []
  );
}

/* =========================================================
   USER PERMISSIONS
========================================================= */

async function getUserPermissions(
  user
) {

  if (!user) {

    return [];
  }

  return getRolePermissions(
    user.role
  );
}

/* =========================================================
   HAS PERMISSION
========================================================= */

async function hasPermission(

  user,

  permission
) {

  if (!user) {

    return false;
  }

  const permissions =
    await getUserPermissions(
      user
    );

  const normalized =
    normalizePermission(
      permission
    );

  if (
    permissions.includes("*")
  ) {

    return true;
  }

  return permissions.includes(
    normalized
  );
}

/* =========================================================
   REQUIRE PERMISSION
========================================================= */

function requirePermission(
  permission
) {

  return async (
    req,
    res,
    next
  ) => {

    try {

      const allowed =
        await hasPermission(

          req.user,

          permission
        );

      if (!allowed) {

        return res.status(403).json({

          error:
            "Permission denied.",

          permission,
        });
      }

      return next();

    } catch (err) {

      console.error(
        "requirePermission error:",
        err
      );

      return res.status(500).json({

        error:
          "Permission check failed.",
      });
    }
  };
}

/* =========================================================
   CREATE ROLE PERMISSION
========================================================= */

async function createRolePermission(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_role_permissions",

    {

      role_name:
        clean(
          payload.role_name,
          80
        ),

      permission_key:
        normalizePermission(
          payload.permission_key
        ),

      created_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   LIST ALL ROLE PERMISSIONS
========================================================= */

async function listRolePermissions() {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_role_permissions

    ORDER BY
      role_name ASC,
      permission_key ASC
    `,

    []
  );
}

/* =========================================================
   CHECK MULTIPLE
========================================================= */

async function hasAnyPermission(

  user,

  permissions = []
) {

  for (const permission of permissions) {

    const allowed =
      await hasPermission(
        user,
        permission
      );

    if (allowed) {

      return true;
    }
  }

  return false;
}

/* =========================================================
   CHECK ALL
========================================================= */

async function hasAllPermissions(

  user,

  permissions = []
) {

  for (const permission of permissions) {

    const allowed =
      await hasPermission(
        user,
        permission
      );

    if (!allowed) {

      return false;
    }
  }

  return true;
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  DEFAULT_ROLE_PERMISSIONS,

  getRolePermissions,

  getUserPermissions,

  hasPermission,

  hasAnyPermission,

  hasAllPermissions,

  requirePermission,

  createRolePermission,

  listRolePermissions,
};