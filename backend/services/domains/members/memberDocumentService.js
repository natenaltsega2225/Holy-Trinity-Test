// backend/services/domains/members/memberDocumentService.js
"use strict";

const fs =
  require("fs");

const path =
  require("path");

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

function normalizeStatus(
  status
) {

  const allowed = [

    "pending",

    "approved",

    "rejected",

    "expired",
  ];

  const value =
    String(
      status || "pending"
    ).toLowerCase();

  return allowed.includes(
    value
  )
    ? value
    : "pending";
}

/* =========================================================
   CREATE DOCUMENT
========================================================= */

async function createMemberDocument(
  payload = {}
) {

  return insertExistingColumns(

    pool,

    "tbl_member_documents",

    {

      member_id:
        payload.member_id,

      user_id:
        payload.user_id || null,

      document_type:
        clean(
          payload.document_type,
          120
        ),

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

      file_name:
        nullable(
          payload.file_name,
          255
        ),

      original_name:
        nullable(
          payload.original_name,
          255
        ),

      mime_type:
        nullable(
          payload.mime_type,
          120
        ),

      file_size:
        payload.file_size || null,

      file_url:
        nullable(
          normalizePath(
            payload.file_url
          ),
          500
        ),

      status:
        normalizeStatus(
          payload.status
        ),

      expires_at:
        payload.expires_at || null,

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
   UPDATE DOCUMENT STATUS
========================================================= */

async function updateDocumentStatus(

  documentId,

  payload = {}
) {

  return updateExistingColumns(

    pool,

    "tbl_member_documents",

    {

      status:
        normalizeStatus(
          payload.status
        ),

      rejection_reason:
        payload.rejection_reason,

      approved_by:
        payload.approved_by,

      approved_at:
        payload.approved_at
          ? payload.approved_at
          : (
              payload.status === "approved"
            )

            ? mysqlNow()

            : undefined,

      updated_at:
        mysqlNow(),
    },

    "id = ?",

    [documentId]
  );
}

/* =========================================================
   GET DOCUMENT
========================================================= */

async function getMemberDocument(
  documentId
) {

  return findOne(

    pool,

    `
    SELECT *

    FROM tbl_member_documents

    WHERE id = ?

    LIMIT 1
    `,

    [documentId]
  );
}

/* =========================================================
   LIST MEMBER DOCUMENTS
========================================================= */

async function listMemberDocuments(
  memberId
) {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_member_documents

    WHERE member_id = ?

    ORDER BY
      created_at DESC,
      id DESC
    `,

    [memberId]
  );
}

/* =========================================================
   LIST PENDING DOCUMENTS
========================================================= */

async function listPendingDocuments() {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_member_documents

    WHERE status = 'pending'

    ORDER BY
      created_at ASC
    `,

    []
  );
}

/* =========================================================
   EXPIRED DOCUMENTS
========================================================= */

async function listExpiredDocuments() {

  return findMany(

    pool,

    `
    SELECT *

    FROM tbl_member_documents

    WHERE expires_at IS NOT NULL
      AND expires_at < NOW()

    ORDER BY expires_at ASC
    `,

    []
  );
}

/* =========================================================
   VALIDATE ACCESS
========================================================= */

async function validateDocumentAccess({

  document_id,

  user_id,

  role,
}) {

  const doc =
    await getMemberDocument(
      document_id
    );

  if (!doc) {

    return {

      allowed: false,

      reason:
        "Document not found.",
    };
  }

  if (

    [
      "admin",
      "finance",
      "super_admin",
    ].includes(role)

  ) {

    return {

      allowed: true,

      document: doc,
    };
  }

  if (
    Number(doc.user_id) ===
    Number(user_id)
  ) {

    return {

      allowed: true,

      document: doc,
    };
  }

  return {

    allowed: false,

    reason:
      "Access denied.",
  };
}

/* =========================================================
   SAFE DELETE FILE
========================================================= */

async function safeDeleteDocumentFile(
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
      "safeDeleteDocumentFile error:",
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

  createMemberDocument,

  updateDocumentStatus,

  getMemberDocument,

  listMemberDocuments,

  listPendingDocuments,

  listExpiredDocuments,

  validateDocumentAccess,

  safeDeleteDocumentFile,
};