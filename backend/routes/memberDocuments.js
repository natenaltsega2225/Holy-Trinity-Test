

// backend/routes/memberDocuments.js

"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const pool = require("../db");
const {
  authRequired,
} = require("../middleware/auth");

/* =========================================================
   HELPERS
========================================================= */

function safe(value = "") {

  return String(
    value ?? ""
  ).trim();
}

function resolveFilePath(
  fileUrl = ""
) {

  const clean =
    safe(fileUrl);

  if (!clean) {
    return null;
  }

  return path.join(
    __dirname,
    "..",
    clean.replace(
      /^\/+/,
      ""
    )
  );
}

/* =========================================================
   GET MEMBER DOCUMENTS
========================================================= */

router.get(

  "/",

  authRequired,

  async (req, res) => {

    try {

      const userId =
        req.user?.id;

      if (!userId) {

        return res
          .status(401)
          .json({

            error:
              "Unauthorized access.",
          });
      }

      /* ================================================
         GET REAL MEMBER ID
      ================================================= */

      const [userRows] =
        await pool.query(
          `
          SELECT
            member_id
          FROM tbl_users
          WHERE id = ?
          LIMIT 1
          `,
          [userId]
        );

      const user =
        userRows?.[0];

      if (
        !user ||
        !user.member_id
      ) {

        return res.json({

          success: true,

          items: [],
        });
      }

      const memberId =
        user.member_id;

      const search =
        safe(
          req.query.search
        );

      /* ================================================
         QUERY
      ================================================= */

      let sql = `
        SELECT

          id,

          member_id,

          applicant_type,

          full_name,

          recipient_name,

          email,

          external_email,

          document_type,

          category,

          status,

          certificate_number,

          file_url,

          file_name,

          mime_type,

          uploaded_at,

          created_at

        FROM tbl_member_documents

        WHERE

          member_id = ?

          AND status = 'active'
      `;

      const params = [
        memberId,
      ];

      /* ================================================
         SEARCH
      ================================================= */

      if (search) {

        sql += `
          AND (

            full_name LIKE ?

            OR recipient_name LIKE ?

            OR certificate_number LIKE ?

            OR document_type LIKE ?

          )
        `;

        const q =
          `%${search}%`;

        params.push(
          q,
          q,
          q,
          q
        );
      }

      /* ================================================
         SORT
      ================================================= */

      sql += `
        ORDER BY

          created_at DESC
      `;

      const [rows] =
        await pool.query(
          sql,
          params
        );

      return res.json({

        success: true,

        items:
          rows || [],
      });

    } catch (err) {

      console.error(
        "GET /member/documents error:",
        err
      );

      return res
        .status(500)
        .json({

          error:
            "Failed to load member documents.",
        });
    }
  }
);
/* =========================================================
   VIEW DOCUMENT
========================================================= */

router.get(
  "/:id/view",

  authRequired,

  async (req, res) => {

    try {

      const userId =
        req.user?.id;

      const documentId =
        req.params.id;

      /* =================================================
         GET MEMBER ID FROM USER
      ================================================= */

      const [userRows] =
        await pool.query(
          `
          SELECT
            member_id
          FROM tbl_users
          WHERE id = ?
          LIMIT 1
          `,
          [userId]
        );

      const memberId =
        userRows?.[0]?.member_id;

      if (!memberId) {

        return res
          .status(404)
          .json({

            error:
              "Member account not linked.",
          });
      }

      /* =================================================
         FIND DOCUMENT
      ================================================= */

      const [rows] =
        await pool.query(
          `
          SELECT *

          FROM tbl_member_documents

          WHERE

            id = ?

            AND member_id = ?

            AND status = 'active'

          LIMIT 1
          `,
          [
            documentId,
            memberId,
          ]
        );

      const document =
        rows?.[0];

      if (!document) {

        return res
          .status(404)
          .json({

            error:
              "Document not found or access denied.",
          });
      }

      /* =================================================
         FILE
      ================================================= */

      const absolutePath =
        resolveFilePath(
          document.file_url
        );

      if (

        !absolutePath ||

        !fs.existsSync(
          absolutePath
        )

      ) {

        return res
          .status(404)
          .json({

            error:
              "Certificate file not found.",
          });
      }

      /* =================================================
         STREAM PDF
      ================================================= */

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename="${path.basename(
          absolutePath
        )}"`
      );

      return fs
        .createReadStream(
          absolutePath
        )
        .pipe(res);

    } catch (err) {

      console.error(
        "GET /member/documents/:id/view error:",
        err
      );

      return res
        .status(500)
        .json({

          error:
            "Failed to open document.",
        });
    }
  }
);

/* =========================================================
   DOWNLOAD DOCUMENT
========================================================= */

router.get(
  "/:id/download",

  authRequired,

  async (req, res) => {

    try {

      const userId =
        req.user?.id;

      const documentId =
        req.params.id;

      /* =================================================
         GET MEMBER ID FROM USER
      ================================================= */

      const [userRows] =
        await pool.query(
          `
          SELECT
            member_id
          FROM tbl_users
          WHERE id = ?
          LIMIT 1
          `,
          [userId]
        );

      const memberId =
        userRows?.[0]?.member_id;

      if (!memberId) {

        return res
          .status(404)
          .json({

            error:
              "Member account not linked.",
          });
      }

      /* =================================================
         FIND DOCUMENT
      ================================================= */

      const [rows] =
        await pool.query(
          `
          SELECT *

          FROM tbl_member_documents

          WHERE

            id = ?

            AND member_id = ?

            AND status = 'active'

          LIMIT 1
          `,
          [
            documentId,
            memberId,
          ]
        );

      const document =
        rows?.[0];

      if (!document) {

        return res
          .status(404)
          .json({

            error:
              "Document not found or access denied.",
          });
      }

      /* =================================================
         FILE
      ================================================= */

      const absolutePath =
        resolveFilePath(
          document.file_url
        );

      if (

        !absolutePath ||

        !fs.existsSync(
          absolutePath
        )

      ) {

        return res
          .status(404)
          .json({

            error:
              "Certificate file not found.",
          });
      }

      /* =================================================
         DOWNLOAD
      ================================================= */

      return res.download(
        absolutePath
      );

    } catch (err) {

      console.error(
        "GET /member/documents/:id/download error:",
        err
      );

      return res
        .status(500)
        .json({

          error:
            "Failed to download document.",
        });
    }
  }
);

module.exports = router;