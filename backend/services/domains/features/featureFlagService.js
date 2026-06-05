// backend/services/domains/features/featureFlagService.js
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
   DEFAULT FEATURES
========================================================= */

const DEFAULT_FEATURES = {

  donations: true,

  reconciliation: true,

  volunteers: true,

  events: true,

  school_programs: true,

  trip_registrations: true,

  analytics_dashboard: true,

  audit_logs: true,

  ai_insights: false,

  ocr_documents: false,

  multi_tenant: false,

  public_api: false,
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeBoolean(
  value
) {

  return !!value;
}

/* =========================================================
   GET FEATURE
========================================================= */

async function getFeatureFlag(

  featureKey,

  organizationId = null
) {

  const row =
    await findOne(

      pool,

      `
      SELECT *

      FROM tbl_feature_flags

      WHERE feature_key = ?
        AND (
          organization_id <=> ?
        )

      LIMIT 1
      `,

      [

        featureKey,

        organizationId,
      ]
    );

  if (row) {

    return {

      ...row,

      enabled:
        !!row.enabled,
    };
  }

  return {

    feature_key:
      featureKey,

    enabled:
      !!DEFAULT_FEATURES[
        featureKey
      ],
  };
}

/* =========================================================
   IS FEATURE ENABLED
========================================================= */

async function isFeatureEnabled(

  featureKey,

  organizationId = null
) {

  const feature =
    await getFeatureFlag(

      featureKey,

      organizationId
    );

  return !!feature.enabled;
}

/* =========================================================
   SET FEATURE
========================================================= */

async function setFeatureFlag(
  payload = {}
) {

  const existing =
    await getFeatureFlag(

      payload.feature_key,

      payload.organization_id
    );

  /* =====================================
     UPDATE
  ===================================== */

  if (existing?.id) {

    await updateExistingColumns(

      pool,

      "tbl_feature_flags",

      {

        enabled:
          normalizeBoolean(
            payload.enabled
          )
            ? 1
            : 0,

        description:
          payload.description,

        updated_by:
          payload.updated_by,

        updated_at:
          mysqlNow(),
      },

      "id = ?",

      [existing.id]
    );

    return getFeatureFlag(

      payload.feature_key,

      payload.organization_id
    );
  }

  /* =====================================
     CREATE
  ===================================== */

  return insertExistingColumns(

    pool,

    "tbl_feature_flags",

    {

      organization_id:
        payload.organization_id || null,

      feature_key:
        clean(
          payload.feature_key,
          120
        ),

      enabled:
        normalizeBoolean(
          payload.enabled
        )
          ? 1
          : 0,

      description:
        nullable(
          payload.description,
          1000
        ),

      created_by:
        payload.created_by || null,

      updated_by:
        payload.updated_by || null,

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   ENABLE FEATURE
========================================================= */

async function enableFeature(

  featureKey,

  organizationId = null
) {

  return setFeatureFlag({

    feature_key:
      featureKey,

    organization_id:
      organizationId,

    enabled: true,
  });
}

/* =========================================================
   DISABLE FEATURE
========================================================= */

async function disableFeature(

  featureKey,

  organizationId = null
) {

  return setFeatureFlag({

    feature_key:
      featureKey,

    organization_id:
      organizationId,

    enabled: false,
  });
}

/* =========================================================
   LIST FEATURES
========================================================= */

async function listFeatureFlags(
  filters = {}
) {

  const where = [];
  const params = [];

  if (
    filters.organization_id !==
    undefined
  ) {

    where.push(
      "organization_id <=> ?"
    );

    params.push(
      filters.organization_id
    );
  }

  const whereSql =
    where.length

      ? `WHERE ${where.join(" AND ")}`

      : "";

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_feature_flags

    ${whereSql}

    ORDER BY
      feature_key ASC
    `,

    params
  );
}

/* =========================================================
   FEATURE OBJECT
========================================================= */

async function getFeatureObject(
  organizationId = null
) {

  const rows =
    await listFeatureFlags({

      organization_id:
        organizationId,
    });

  const result = {

    ...DEFAULT_FEATURES,
  };

  for (const row of rows) {

    result[
      row.feature_key
    ] = !!row.enabled;
  }

  return result;
}

/* =========================================================
   FEATURE MIDDLEWARE
========================================================= */

function requireFeature(
  featureKey
) {

  return async (
    req,
    res,
    next
  ) => {

    try {

      const organizationId =
        req.tenant?.id || null;

      const enabled =
        await isFeatureEnabled(

          featureKey,

          organizationId
        );

      if (!enabled) {

        return res.status(403).json({

          error:
            "Feature disabled.",

          feature:
            featureKey,
        });
      }

      return next();

    } catch (err) {

      console.error(
        "requireFeature error:",
        err
      );

      return res.status(500).json({

        error:
          "Feature check failed.",
      });
    }
  };
}

/* =========================================================
   SEED DEFAULTS
========================================================= */

async function seedDefaultFeatures() {

  for (const [

    key,

    enabled,

  ] of Object.entries(
    DEFAULT_FEATURES
  )) {

    const existing =
      await getFeatureFlag(
        key
      );

    if (!existing?.id) {

      await setFeatureFlag({

        feature_key:
          key,

        enabled,
      });
    }
  }

  return {

    success: true,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  DEFAULT_FEATURES,

  getFeatureFlag,

  isFeatureEnabled,

  setFeatureFlag,

  enableFeature,

  disableFeature,

  listFeatureFlags,

  getFeatureObject,

  requireFeature,

  seedDefaultFeatures,
};