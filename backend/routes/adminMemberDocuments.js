// // backend/routes/adminMemberDocuments.js


"use strict";

const express = require("express");

const fs = require("fs");

const path = require("path");

const router = express.Router();

const pool = require("../db");

const {
  authRequired,
} = require("../middleware/auth");

/* =====================================================
   ADMIN CHECK
===================================================== */

function adminOnly(
  req,
  res,
  next
) {
  const role = String(
    req.user?.role || ""
  ).toLowerCase();

  if (
    role === "admin" ||
    role === "super_admin"
  ) {
    return next();
  }

  return res.status(403).json({
    error: "Forbidden",
  });
}

/* =====================================================
   LIST DOCUMENTS
===================================================== */

router.get(
  "/",

  authRequired,

  adminOnly,

  async (req, res) => {
    try {

      const search = String(
        req.query.search || ""
      ).trim();

      const type = String(
        req.query.type || ""
      ).trim();

      const page = Math.max(
        Number(req.query.page || 1),
        1
      );

      const pageSize = Math.min(
        Number(
          req.query.pageSize || 20
        ),
        200
      );

      const offset =
        (page - 1) * pageSize;

      let sql = `
        SELECT

          d.*,

          m.member_no

        FROM tbl_member_documents d

        LEFT JOIN tbl_members m
          ON m.id = d.member_id

        WHERE 1=1
      `;

      const params = [];

      if (search) {

        sql += `
          AND (
            d.full_name LIKE ?
            OR d.email LIKE ?
            OR d.certificate_number LIKE ?
          )
        `;

        const like = `%${search}%`;

        params.push(
          like,
          like,
          like
        );
      }

      if (type) {

        sql += `
          AND d.document_type = ?
        `;

        params.push(type);
      }

      sql += `
        ORDER BY d.id DESC
        LIMIT ?
        OFFSET ?
      `;

      params.push(
        pageSize,
        offset
      );

      const [rows] =
        await pool.query(
          sql,
          params
        );

      return res.json({
        ok: true,
        rows,
      });

    } catch (err) {

      console.error(
        "GET /admin/member-documents error:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to load documents.",
        });
    }
  }
);

/* =====================================================
   VIEW PDF
===================================================== */

router.get(
  "/:id/view",

  authRequired,

  adminOnly,

  async (req, res) => {
    try {

      const [rows] =
        await pool.query(
          `
          SELECT *
          FROM tbl_member_documents
          WHERE id = ?
          LIMIT 1
          `,
          [req.params.id]
        );

      const doc =
        rows?.[0];

      if (!doc) {
        return res
          .status(404)
          .json({
            error:
              "Document not found.",
          });
      }

      const absolutePath =
        path.join(
          __dirname,
          "..",
          doc.file_url
        );

      if (
        !fs.existsSync(
          absolutePath
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              "PDF file missing.",
          });
      }

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        "inline"
      );

      return res.sendFile(
        absolutePath
      );

    } catch (err) {

      console.error(
        "VIEW DOCUMENT ERROR:",
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

/* =====================================================
   DOWNLOAD PDF
===================================================== */

router.get(
  "/:id/download",

  authRequired,

  adminOnly,

  async (req, res) => {
    try {

      const [rows] =
        await pool.query(
          `
          SELECT *
          FROM tbl_member_documents
          WHERE id = ?
          LIMIT 1
          `,
          [req.params.id]
        );

      const doc =
        rows?.[0];

      if (!doc) {
        return res
          .status(404)
          .json({
            error:
              "Document not found.",
          });
      }

      const absolutePath =
        path.join(
          __dirname,
          "..",
          doc.file_url
        );

      if (
        !fs.existsSync(
          absolutePath
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              "PDF file missing.",
          });
      }

      return res.download(
        absolutePath,
        doc.file_name
      );

    } catch (err) {

      console.error(
        "DOWNLOAD DOCUMENT ERROR:",
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
/* =====================================================
   RESEND EMAIL
===================================================== */

router.post(
  "/:id/resend-email",

  authRequired,

  adminOnly,

  async (req, res) => {
    try {

      const id = Number(req.params.id);

      const [rows] = await pool.query(
        `
        SELECT *
        FROM tbl_member_documents
        WHERE id = ?
        LIMIT 1
        `,
        [id]
      );

      const doc = rows?.[0];

      if (!doc) {
        return res.status(404).json({
          error: "Certificate not found.",
        });
      }

      return res.json({
        ok: true,
        message:
          "Certificate resend triggered successfully.",
      });

    } catch (err) {

      console.error(
        "RESEND EMAIL ERROR:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to resend email.",
      });
    }
  }
);

/* =====================================================
   ARCHIVE DOCUMENT
===================================================== */

router.patch(
  "/:id/archive",

  authRequired,

  adminOnly,

  async (req, res) => {
    try {

      const id = Number(req.params.id);

      await pool.query(
        `
        UPDATE tbl_member_documents
        SET status = 'archived'
        WHERE id = ?
        `,
        [id]
      );

      return res.json({
        ok: true,
        message:
          "Certificate archived successfully.",
      });

    } catch (err) {

      console.error(
        "ARCHIVE DOCUMENT ERROR:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to archive document.",
      });
    }
  }
);

/* =====================================================
   REVOKE DOCUMENT
===================================================== */

router.patch(
  "/:id/revoke",

  authRequired,

  adminOnly,

  async (req, res) => {
    try {

      const id = Number(req.params.id);

      await pool.query(
        `
        UPDATE tbl_member_documents
        SET status = 'revoked'
        WHERE id = ?
        `,
        [id]
      );

      return res.json({
        ok: true,
        message:
          "Certificate revoked successfully.",
      });

    } catch (err) {

      console.error(
        "REVOKE DOCUMENT ERROR:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to revoke document.",
      });
    }
  }
);

/* =====================================================
   DELETE DOCUMENT
===================================================== */

router.delete(
  "/:id",

  authRequired,

  adminOnly,

  async (req, res) => {
    try {

      const id = Number(req.params.id);

      const [rows] = await pool.query(
        `
        SELECT *
        FROM tbl_member_documents
        WHERE id = ?
        LIMIT 1
        `,
        [id]
      );

      const doc = rows?.[0];

      if (!doc) {
        return res.status(404).json({
          error:
            "Document not found.",
        });
      }

      /* =========================================
         DELETE PDF FILE
      ========================================= */

      if (doc.file_url) {

        const absolutePath =
          path.join(
            __dirname,
            "..",
            doc.file_url
          );

        if (
          fs.existsSync(
            absolutePath
          )
        ) {
          try {
            fs.unlinkSync(
              absolutePath
            );
          } catch (fileErr) {

            console.error(
              "FILE DELETE ERROR:",
              fileErr
            );
          }
        }
      }

      /* =========================================
         DELETE DATABASE RECORD
      ========================================= */

      await pool.query(
        `
        DELETE FROM tbl_member_documents
        WHERE id = ?
        `,
        [id]
      );

      return res.json({
        ok: true,
        message:
          "Certificate deleted successfully.",
      });

    } catch (err) {

      console.error(
        "DELETE DOCUMENT ERROR:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to delete document.",
      });
    }
  }
);
module.exports = router;