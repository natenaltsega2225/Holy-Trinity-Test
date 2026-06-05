// backend/services/domains/tenant/tenantOrganizationService.js
"use strict";

const pool =
  require("../../../db");

const {

  insertExistingColumns,

  updateExistingColumns,

  findOne,

  findMany,

} = require(
  "../../../utils/dbHelpers"
);

const {

  clean,

  nullable,

  mysqlNow,

} = require(
  "../../../utils/financeHelpers"
);

/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(
  status
) {

  const allowed = [

    "active",

    "inactive",

    "suspended",
  ];

  const value =
    String(
      status || "active"
    ).toLowerCase();

  return allowed.includes(
    value
  )
    ? value
    : "active";
}

/* =========================================================
   CREATE ORGANIZATION
========================================================= */

async function createOrganization(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_organizations",

    {

      organization_name:
        clean(
          payload.organization_name,
          255
        ),

      organization_code:
        clean(
          payload.organization_code,
          80
        ),

      email:
        nullable(
          payload.email,
          180
        ),

      phone:
        nullable(
          payload.phone,
          80
        ),

      website:
        nullable(
          payload.website,
          255
        ),

      address:
        nullable(
          payload.address,
          500
        ),

      city:
        nullable(
          payload.city,
          120
        ),

      state:
        nullable(
          payload.state,
          120
        ),

      country:
        nullable(
          payload.country,
          120
        ),

      logo_url:
        nullable(
          payload.logo_url,
          500
        ),

      primary_color:
        nullable(
          payload.primary_color,
          40
        ),

      secondary_color:
        nullable(
          payload.secondary_color,
          40
        ),

      timezone:
        nullable(
          payload.timezone,
          80
        ),

      currency_code:
        nullable(
          payload.currency_code,
          10
        ),

      stripe_publishable_key:
        nullable(
          payload.stripe_publishable_key,
          255
        ),

      stripe_secret_key:
        nullable(
          payload.stripe_secret_key,
          255
        ),

      status:
        normalizeStatus(
          payload.status
        ),

      created_by:
        payload.created_by || null,

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   UPDATE ORGANIZATION
========================================================= */

async function updateOrganization(

  organizationId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_organizations",

    {

      organization_name:
        payload.organization_name,

      email:
        payload.email,

      phone:
        payload.phone,

      website:
        payload.website,

      address:
        payload.address,

      city:
        payload.city,

      state:
        payload.state,

      country:
        payload.country,

      logo_url:
        payload.logo_url,

      primary_color:
        payload.primary_color,

      secondary_color:
        payload.secondary_color,

      timezone:
        payload.timezone,

      currency_code:
        payload.currency_code,

      status:
        payload.status
          ? normalizeStatus(
              payload.status
            )
          : undefined,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [organizationId]
  );
}

/* =========================================================
   GET ORGANIZATION
========================================================= */

async function getOrganization(
  organizationId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_organizations

    WHERE id = ?

    LIMIT 1
    `,

    [organizationId]
  );
}

/* =========================================================
   FIND BY CODE
========================================================= */

async function getOrganizationByCode(
  code
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_organizations

    WHERE organization_code = ?

    LIMIT 1
    `,

    [code]
  );
}

/* =========================================================
   LIST ORGANIZATIONS
========================================================= */

async function listOrganizations() {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_organizations

    ORDER BY
      organization_name ASC
    `,

    []
  );
}

/* =========================================================
   TENANT SETTINGS
========================================================= */

async function getTenantSettings(
  organizationId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_organization_settings

    WHERE organization_id = ?
    `,

    [organizationId]
  );
}

/* =========================================================
   CREATE TENANT SETTING
========================================================= */

async function createTenantSetting(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_organization_settings",

    {

      organization_id:
        payload.organization_id,

      setting_key:
        clean(
          payload.setting_key,
          120
        ),

      setting_value:
        nullable(
          payload.setting_value,
          10000
        ),

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   RESOLVE TENANT
========================================================= */

async function resolveTenantFromRequest(
  req
) {

  /* =====================================
     SUBDOMAIN
  ===================================== */

  const host =
    String(
      req.headers.host || ""
    )
      .split(":")[0]
      .toLowerCase();

  const subdomain =
    host.split(".")[0];

  if (
    subdomain &&
    subdomain !== "www" &&
    subdomain !== "localhost"
  ) {

    const organization =
      await getOrganizationByCode(
        subdomain
      );

    if (organization) {

      return organization;
    }
  }

  /* =====================================
     HEADER
  ===================================== */

  const tenantCode =
    req.headers[
      "x-tenant-code"
    ];

  if (tenantCode) {

    return getOrganizationByCode(
      tenantCode
    );
  }

  return null;
}

/* =========================================================
   TENANT MIDDLEWARE
========================================================= */

async function tenantMiddleware(
  req,
  _res,
  next
) {

  try {

    const tenant =
      await resolveTenantFromRequest(
        req
      );

    req.tenant =
      tenant || null;

    return next();

  } catch (err) {

    console.error(
      "tenantMiddleware error:",
      err
    );

    return next();
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  createOrganization,

  updateOrganization,

  getOrganization,

  getOrganizationByCode,

  listOrganizations,

  getTenantSettings,

  createTenantSetting,

  resolveTenantFromRequest,

  tenantMiddleware,
};