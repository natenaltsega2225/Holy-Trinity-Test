// backend/services/domains/media/mediaService.js
"use strict";

const path =
  require("path");

const fs =
  require("fs");

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

function normalizePath(
  filePath
) {

  return String(
    filePath || ""
  ).replace(/\\/g, "/");
}

function fileExists(
  filePath
) {

  try {

    return fs.existsSync(
      filePath
    );

  } catch {

    return false;
  }
}

function buildPublicUrl(
  filePath
) {

  if (!filePath) {
    return null;
  }

  return normalizePath(
    filePath
  );
}

/* =========================================================
   CREATE ALBUM
========================================================= */

async function createAlbum(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_media_albums",

    {

      title:
        clean(
          payload.title,
          255
        ),

      description:
        nullable(
          payload.description,
          2000
        ),

      cover_image_url:
        nullable(
          payload.cover_image_url,
          500
        ),

      is_published:
        payload.is_published
          ? 1
          : 0,

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
   UPDATE ALBUM
========================================================= */

async function updateAlbum(

  albumId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_media_albums",

    {

      title:
        payload.title,

      description:
        payload.description,

      cover_image_url:
        payload.cover_image_url,

      is_published:
        payload.is_published,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [albumId]
  );
}

/* =========================================================
   GET ALBUM
========================================================= */

async function getAlbum(
  albumId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_media_albums

    WHERE id = ?

    LIMIT 1
    `,

    [albumId]
  );
}

/* =========================================================
   LIST ALBUMS
========================================================= */

async function listAlbums(
  filters = {}
) {

  const params = [];
  const where = [];

  if (
    filters.is_published !== undefined
  ) {

    where.push(
      "a.is_published = ?"
    );

    params.push(
      filters.is_published
        ? 1
        : 0
    );
  }

  const whereSql =
    where.length

      ? `WHERE ${where.join(" AND ")}`

      : "";

  return findMany(

    pool,

    `
    SELECT

      a.*,

      COUNT(p.id) AS photo_count

    FROM tbl_media_albums a

    LEFT JOIN tbl_media_photos p
      ON p.album_id = a.id

    ${whereSql}

    GROUP BY a.id

    ORDER BY
      a.created_at DESC
    `,

    params
  );
}

/* =========================================================
   ADD PHOTO
========================================================= */

async function addPhoto(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_media_photos",

    {

      album_id:
        payload.album_id,

      image_url:
        clean(
          buildPublicUrl(
            payload.image_url
          ),
          500
        ),

      thumbnail_url:
        nullable(
          buildPublicUrl(
            payload.thumbnail_url
          ),
          500
        ),

      caption:
        nullable(
          payload.caption,
          1000
        ),

      sort_order:
        Number(
          payload.sort_order || 0
        ),

      is_published:
        payload.is_published
          ? 1
          : 0,

      uploaded_by:
        payload.uploaded_by || null,

      created_at:
        mysqlNow(),

      updated_at:
        mysqlNow(),
    }
  );
}

/* =========================================================
   LIST PHOTOS
========================================================= */

async function listPhotos(
  albumId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_media_photos

    WHERE album_id = ?

    ORDER BY
      sort_order ASC,
      id ASC
    `,

    [albumId]
  );
}

/* =========================================================
   CREATE RESOURCE
========================================================= */

async function createResource(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_resources",

    {

      title:
        clean(
          payload.title,
          255
        ),

      description:
        nullable(
          payload.description,
          2000
        ),

      category:
        nullable(
          payload.category,
          120
        ),

      file_url:
        nullable(
          buildPublicUrl(
            payload.file_url
          ),
          500
        ),

      thumbnail_url:
        nullable(
          buildPublicUrl(
            payload.thumbnail_url
          ),
          500
        ),

      mime_type:
        nullable(
          payload.mime_type,
          120
        ),

      file_size:
        payload.file_size || null,

      is_published:
        payload.is_published
          ? 1
          : 0,

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
   LIST RESOURCES
========================================================= */

async function listResources(
  filters = {}
) {

  const params = [];
  const where = [];

  if (
    filters.category
  ) {

    where.push(
      "category = ?"
    );

    params.push(
      filters.category
    );
  }

  if (
    filters.is_published !== undefined
  ) {

    where.push(
      "is_published = ?"
    );

    params.push(
      filters.is_published
        ? 1
        : 0
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

    FROM tbl_resources

    ${whereSql}

    ORDER BY
      created_at DESC
    `,

    params
  );
}

/* =========================================================
   DELETE FILE SAFE
========================================================= */

async function safeDeleteFile(
  filePath
) {

  try {

    if (
      filePath &&
      fileExists(filePath)
    ) {

      await fs.promises.unlink(
        filePath
      );
    }

    return {

      success: true,
    };

  } catch (err) {

    console.error(
      "safeDeleteFile error:",
      err
    );

    return {

      success: false,

      error:
        err.message,
    };
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  normalizePath,

  buildPublicUrl,

  createAlbum,

  updateAlbum,

  getAlbum,

  listAlbums,

  addPhoto,

  listPhotos,

  createResource,

  listResources,

  safeDeleteFile,
};