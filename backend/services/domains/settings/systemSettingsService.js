// backend/services/domains/settings/systemSettingsService.js
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

function safeJsonParse(
  value
) {

  try {

    return JSON.parse(
      value
    );

  } catch {

    return value;
  }
}

function normalizeValue(
  value
) {

  if (
    value === undefined
  ) {

    return null;
  }

  if (
    typeof value === "object"
  ) {

    return JSON.stringify(
      value
    );
  }

  return String(value);
}

/* =========================================================
   GET SETTING
========================================================= */

async function getSetting(

  section,

  key,

  organizationId = null
) {

  const row =
    await findOne(

      pool,

      `
      SELECT *

      FROM tbl_system_settings

      WHERE section = ?
        AND setting_key = ?
        AND (
          organization_id <=> ?
        )

      LIMIT 1
      `,

      [

        section,

        key,

        organizationId,
      ]
    );

  if (!row) {

    return null;
  }

  return {

    ...row,

    parsed_value:
      safeJsonParse(
        row.setting_value
      ),
  };
}

/* =========================================================
   SET SETTING
========================================================= */

async function setSetting(
  payload = {}
) {

  const existing =
    await getSetting(

      payload.section,

      payload.setting_key,

      payload.organization_id
    );

  /* =====================================
     UPDATE
  ===================================== */

  if (existing) {

    await updateExistingColumns(

      pool,

      "tbl_system_settings",

      {

        setting_value:
          normalizeValue(
            payload.setting_value
          ),

        value_type:
          payload.value_type ||

          existing.value_type,

        is_public:
          payload.is_public,

        updated_by:
          payload.updated_by,

        updated_at:
          mysqlNow(),
      },

      "id = ?",

      [existing.id]
    );

    return getSetting(

      payload.section,

      payload.setting_key,

      payload.organization_id
    );
  }

  /* =====================================
     CREATE
  ===================================== */

  const result =
    await insertExistingColumns(

      pool,

      "tbl_system_settings",

      {

        organization_id:
          payload.organization_id || null,

        section:
          clean(
            payload.section,
            120
          ),

        setting_key:
          clean(
            payload.setting_key,
            120
          ),

        setting_value:
          normalizeValue(
            payload.setting_value
          ),

        value_type:
          clean(
            payload.value_type ||
            "string",
            50
          ),

        is_public:
          payload.is_public
            ? 1
            : 0,

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

  return result;
}

/* =========================================================
   LIST SETTINGS
========================================================= */

async function listSettings(
  filters = {}
) {

  const where = [];
  const params = [];

  if (
    filters.section
  ) {

    where.push(
      "section = ?"
    );

    params.push(
      filters.section
    );
  }

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

  if (
    filters.is_public !==
    undefined
  ) {

    where.push(
      "is_public = ?"
    );

    params.push(
      filters.is_public
        ? 1
        : 0
    );
  }

  const whereSql =
    where.length

      ? `WHERE ${where.join(" AND ")}`

      : "";

  const rows =
    await findMany(

      pool,

      `
      SELECT *

      FROM tbl_system_settings

      ${whereSql}

      ORDER BY
        section ASC,
        setting_key ASC
      `,

      params
    );

  return rows.map((row) => ({

    ...row,

    parsed_value:
      safeJsonParse(
        row.setting_value
      ),
  }));
}

/* =========================================================
   PUBLIC SETTINGS
========================================================= */

async function getPublicSettings(
  organizationId = null
) {

  return listSettings({

    is_public: true,

    organization_id:
      organizationId,
  });
}

/* =========================================================
   SECTION SETTINGS
========================================================= */

async function getSectionSettings(

  section,

  organizationId = null
) {

  return listSettings({

    section,

    organization_id:
      organizationId,
  });
}

/* =========================================================
   DELETE SETTING
========================================================= */

async function deleteSetting(
  settingId
) {

  const [result] =
    await pool.query(
      `
      DELETE FROM tbl_system_settings

      WHERE id = ?
      `,
      [settingId]
    );

  return {

    success: true,

    affectedRows:
      result.affectedRows || 0,
  };
}

/* =========================================================
   SETTINGS OBJECT
========================================================= */

async function getSettingsObject(
  filters = {}
) {

  const rows =
    await listSettings(
      filters
    );

  const result = {};

  for (const row of rows) {

    if (
      !result[row.section]
    ) {

      result[
        row.section
      ] = {};
    }

    result[
      row.section
    ][
      row.setting_key
    ] =
      row.parsed_value;
  }

  return result;
}

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

async function seedDefaultSettings() {

  const defaults = [

    {
      section:
        "general",

      setting_key:
        "churchName",

      setting_value:
        "Holy Trinity Ethiopian Orthodox Church",

      is_public: 1,
    },

    {
      section:
        "branding",

      setting_key:
        "primaryColor",

      setting_value:
        "#1d4ed8",

      is_public: 1,
    },

    {
      section:
        "finance",

      setting_key:
        "currency",

      setting_value:
        "USD",

      is_public: 0,
    },

    {
      section:
        "notifications",

      setting_key:
        "emailEnabled",

      setting_value:
        true,

      value_type:
        "boolean",

      is_public: 0,
    },
  ];

  for (const setting of defaults) {

    const existing =
      await getSetting(

        setting.section,

        setting.setting_key
      );

    if (!existing) {

      await setSetting(setting);
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

  getSetting,

  setSetting,

  listSettings,

  getPublicSettings,

  getSectionSettings,

  deleteSetting,

  getSettingsObject,

  seedDefaultSettings,
};