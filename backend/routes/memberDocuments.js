

// // backend/routes/memberDocuments.js

// "use strict";

// const express = require("express");
// const path = require("path");
// const fs = require("fs");

// const router = express.Router();
// const pool = require("../db");
// const {
//   authRequired,
// } = require("../middleware/auth");

// /* =========================================================
//    HELPERS
// ========================================================= */

// function safe(value = "") {

//   return String(
//     value ?? ""
//   ).trim();
// }

// function resolveFilePath(
//   fileUrl = ""
// ) {

//   const clean =
//     safe(fileUrl);

//   if (!clean) {
//     return null;
//   }

//   return path.join(
//     __dirname,
//     "..",
//     clean.replace(
//       /^\/+/,
//       ""
//     )
//   );
// }

// /* =========================================================
//    GET MEMBER DOCUMENTS
// ========================================================= */

// router.get(

//   "/",

//   authRequired,

//   async (req, res) => {

//     try {

//       const userId =
//         req.user?.id;

//       if (!userId) {

//         return res
//           .status(401)
//           .json({

//             error:
//               "Unauthorized access.",
//           });
//       }

//       /* ================================================
//          GET REAL MEMBER ID
//       ================================================= */

//       const [userRows] =
//         await pool.query(
//           `
//           SELECT
//             member_id
//           FROM tbl_users
//           WHERE id = ?
//           LIMIT 1
//           `,
//           [userId]
//         );

//       const user =
//         userRows?.[0];

//       if (
//         !user ||
//         !user.member_id
//       ) {

//         return res.json({

//           success: true,

//           items: [],
//         });
//       }

//       const memberId =
//         user.member_id;

//       const search =
//         safe(
//           req.query.search
//         );

//       /* ================================================
//          QUERY
//       ================================================= */

//       let sql = `
//         SELECT

//           id,

//           member_id,

//           applicant_type,

//           full_name,

//           recipient_name,

//           email,

//           external_email,

//           document_type,

//           category,

//           status,

//           certificate_number,

//           file_url,

//           file_name,

//           mime_type,

//           uploaded_at,

//           created_at

//         FROM tbl_member_documents

//         WHERE

//           member_id = ?

//           AND status = 'active'
//       `;

//       const params = [
//         memberId,
//       ];

//       /* ================================================
//          SEARCH
//       ================================================= */

//       if (search) {

//         sql += `
//           AND (

//             full_name LIKE ?

//             OR recipient_name LIKE ?

//             OR certificate_number LIKE ?

//             OR document_type LIKE ?

//           )
//         `;

//         const q =
//           `%${search}%`;

//         params.push(
//           q,
//           q,
//           q,
//           q
//         );
//       }

//       /* ================================================
//          SORT
//       ================================================= */

//       sql += `
//         ORDER BY

//           created_at DESC
//       `;

//       const [rows] =
//         await pool.query(
//           sql,
//           params
//         );

//       return res.json({

//         success: true,

//         items:
//           rows || [],
//       });

//     } catch (err) {

//       console.error(
//         "GET /member/documents error:",
//         err
//       );

//       return res
//         .status(500)
//         .json({

//           error:
//             "Failed to load member documents.",
//         });
//     }
//   }
// );
// /* =========================================================
//    VIEW DOCUMENT
// ========================================================= */

// router.get(
//   "/:id/view",

//   authRequired,

//   async (req, res) => {

//     try {

//       const userId =
//         req.user?.id;

//       const documentId =
//         req.params.id;

//       /* =================================================
//          GET MEMBER ID FROM USER
//       ================================================= */

//       const [userRows] =
//         await pool.query(
//           `
//           SELECT
//             member_id
//           FROM tbl_users
//           WHERE id = ?
//           LIMIT 1
//           `,
//           [userId]
//         );

//       const memberId =
//         userRows?.[0]?.member_id;

//       if (!memberId) {

//         return res
//           .status(404)
//           .json({

//             error:
//               "Member account not linked.",
//           });
//       }

//       /* =================================================
//          FIND DOCUMENT
//       ================================================= */

//       const [rows] =
//         await pool.query(
//           `
//           SELECT *

//           FROM tbl_member_documents

//           WHERE

//             id = ?

//             AND member_id = ?

//             AND status = 'active'

//           LIMIT 1
//           `,
//           [
//             documentId,
//             memberId,
//           ]
//         );

//       const document =
//         rows?.[0];

//       if (!document) {

//         return res
//           .status(404)
//           .json({

//             error:
//               "Document not found or access denied.",
//           });
//       }

//       /* =================================================
//          FILE
//       ================================================= */

//       const absolutePath =
//         resolveFilePath(
//           document.file_url
//         );

//       if (

//         !absolutePath ||

//         !fs.existsSync(
//           absolutePath
//         )

//       ) {

//         return res
//           .status(404)
//           .json({

//             error:
//               "Certificate file not found.",
//           });
//       }

//       /* =================================================
//          STREAM PDF
//       ================================================= */

//       res.setHeader(
//         "Content-Type",
//         "application/pdf"
//       );

//       res.setHeader(
//         "Content-Disposition",
//         `inline; filename="${path.basename(
//           absolutePath
//         )}"`
//       );

//       return fs
//         .createReadStream(
//           absolutePath
//         )
//         .pipe(res);

//     } catch (err) {

//       console.error(
//         "GET /member/documents/:id/view error:",
//         err
//       );

//       return res
//         .status(500)
//         .json({

//           error:
//             "Failed to open document.",
//         });
//     }
//   }
// );

// /* =========================================================
//    DOWNLOAD DOCUMENT
// ========================================================= */

// router.get(
//   "/:id/download",

//   authRequired,

//   async (req, res) => {

//     try {

//       const userId =
//         req.user?.id;

//       const documentId =
//         req.params.id;

//       /* =================================================
//          GET MEMBER ID FROM USER
//       ================================================= */

//       const [userRows] =
//         await pool.query(
//           `
//           SELECT
//             member_id
//           FROM tbl_users
//           WHERE id = ?
//           LIMIT 1
//           `,
//           [userId]
//         );

//       const memberId =
//         userRows?.[0]?.member_id;

//       if (!memberId) {

//         return res
//           .status(404)
//           .json({

//             error:
//               "Member account not linked.",
//           });
//       }

//       /* =================================================
//          FIND DOCUMENT
//       ================================================= */

//       const [rows] =
//         await pool.query(
//           `
//           SELECT *

//           FROM tbl_member_documents

//           WHERE

//             id = ?

//             AND member_id = ?

//             AND status = 'active'

//           LIMIT 1
//           `,
//           [
//             documentId,
//             memberId,
//           ]
//         );

//       const document =
//         rows?.[0];

//       if (!document) {

//         return res
//           .status(404)
//           .json({

//             error:
//               "Document not found or access denied.",
//           });
//       }

//       /* =================================================
//          FILE
//       ================================================= */

//       const absolutePath =
//         resolveFilePath(
//           document.file_url
//         );

//       if (

//         !absolutePath ||

//         !fs.existsSync(
//           absolutePath
//         )

//       ) {

//         return res
//           .status(404)
//           .json({

//             error:
//               "Certificate file not found.",
//           });
//       }

//       /* =================================================
//          DOWNLOAD
//       ================================================= */

//       return res.download(
//         absolutePath
//       );

//     } catch (err) {

//       console.error(
//         "GET /member/documents/:id/download error:",
//         err
//       );

//       return res
//         .status(500)
//         .json({

//           error:
//             "Failed to download document.",
//         });
//     }
//   }
// );

// module.exports = router;

// backend/routes/memberDocuments.js
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

const pool = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

const PROJECT_ROOT = path.resolve(__dirname, "..");
const STORAGE_ROOTS = [
  PROJECT_ROOT,
  process.env.MEMBER_DOCUMENT_STORAGE_ROOT,
  process.env.UPLOAD_ROOT,
  process.env.UPLOAD_DIR,
]
  .filter(Boolean)
  .map((value) => path.resolve(value));

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function boolFlag(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function safeFileName(value, fallback = "document") {
  const raw = clean(value, fallback);
  return raw.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || fallback;
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(clean(value));
}

function mimeTypeFor(fileName, explicitType) {
  const explicit = clean(explicitType);
  if (explicit) return explicit;

  const ext = path.extname(clean(fileName)).toLowerCase();

  const map = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  return map[ext] || "application/octet-stream";
}

function contentDisposition(mode, fileName) {
  const safe = safeFileName(fileName);
  return `${mode}; filename="${safe.replace(/"/g, "")}"`;
}

function publicUrl(req, pathname) {
  const base =
    process.env.BACKEND_PUBLIC_URL ||
    process.env.APP_URL ||
    `${req.protocol}://${req.get("host")}`;

  return `${String(base).replace(/\/+$/, "")}${pathname}`;
}

function documentId(row) {
  return row.id || row.document_id || row.member_document_id;
}

function documentTitle(row) {
  return (
    clean(row.title) ||
    clean(row.document_title) ||
    clean(row.name) ||
    clean(row.file_name) ||
    clean(row.original_name) ||
    "Member Document"
  );
}

function documentFileName(row) {
  return safeFileName(
    row.file_name ||
      row.original_name ||
      row.original_filename ||
      path.basename(clean(row.file_url || row.file_path || row.storage_path || "")) ||
      `${documentTitle(row)}.pdf`,
    "document.pdf"
  );
}

function documentPathValue(row) {
  return clean(
    row.file_path ||
      row.storage_path ||
      row.local_path ||
      row.file_url ||
      row.document_url ||
      row.url
  );
}

function normalizeDocument(row, req) {
  const id = documentId(row);

  return {
    ...row,
    id,
    document_id: id,
    title: documentTitle(row),
    file_name: documentFileName(row),
    document_type: row.document_type || row.category || "document",
    status: row.status || "active",
    uploaded_at: row.uploaded_at || row.created_at || null,
    view_url: `/api/member/documents/${encodeURIComponent(id)}/view`,
    download_url: `/api/member/documents/${encodeURIComponent(id)}/download`,
    absolute_view_url: publicUrl(req, `/api/member/documents/${encodeURIComponent(id)}/view`),
    absolute_download_url: publicUrl(
      req,
      `/api/member/documents/${encodeURIComponent(id)}/download`
    ),
  };
}

function resolveLocalFile(row) {
  const raw = documentPathValue(row);
  if (!raw || isRemoteUrl(raw)) return null;

  const withoutLeadingSlash = raw.replace(/^\/+/, "");
  const candidates = [];

  if (path.isAbsolute(raw)) {
    candidates.push(path.resolve(raw));
  } else {
    for (const root of STORAGE_ROOTS) {
      candidates.push(path.resolve(root, withoutLeadingSlash));
      candidates.push(path.resolve(root, raw));
    }
  }

  const unique = [...new Set(candidates)];

  for (const candidate of unique) {
    const allowed = STORAGE_ROOTS.some((root) => {
      const rel = path.relative(root, candidate);
      return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
    });

    if (allowed && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

async function resolveCurrentMemberId(req) {
  const direct =
    req.user?.member_id ||
    req.user?.memberId ||
    req.user?.member?.id ||
    req.user?.profile?.member_id;

  if (direct) return direct;

  const userId = req.user?.id || req.user?.user_id;
  if (!userId) return null;

  try {
    const [rows] = await pool.query(
      `
      SELECT member_id
      FROM tbl_users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (rows?.[0]?.member_id) return rows[0].member_id;
  } catch {
    // Some deployments do not store member_id on tbl_users.
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT id
      FROM tbl_members
      WHERE user_id = ? OR auth_user_id = ?
      LIMIT 1
      `,
      [userId, userId]
    );

    if (rows?.[0]?.id) return rows[0].id;
  } catch {
    // Optional fallback only.
  }

  return null;
}

async function findMemberDocument(req, id) {
  const memberId = await resolveCurrentMemberId(req);
  if (!memberId) {
    const err = new Error("Member profile was not found for this account.");
    err.status = 404;
    throw err;
  }

  const [rows] = await pool.query(
    `
    SELECT d.*
    FROM tbl_member_documents d
    WHERE d.id = ?
      AND d.member_id = ?
      AND (
        d.status IS NULL
        OR LOWER(d.status) NOT IN ('deleted', 'archived', 'revoked')
      )
    LIMIT 1
    `,
    [id, memberId]
  );

  if (!rows.length) {
    const err = new Error("Document not found.");
    err.status = 404;
    throw err;
  }

  return rows[0];
}

async function writeAudit(req, payload = {}) {
  try {
    await pool.query(
      `
      INSERT INTO tbl_audit_logs
        (actor_id, action, entity_type, entity_id, description, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      `,
      [
        req.user?.id || null,
        payload.action || "member_document.access",
        payload.entity_type || "member_document",
        payload.entity_id || null,
        payload.description || null,
      ]
    );
  } catch {
    // Audit is best-effort because older schemas vary.
  }
}

function streamDocument(req, res, row, mode) {
  const fileName = documentFileName(row);
  const remote = documentPathValue(row);

  if (isRemoteUrl(remote)) {
    return res.redirect(remote);
  }

  const localPath = resolveLocalFile(row);

  if (!localPath) {
    return res.status(404).json({
      ok: false,
      error: "Document file was not found on the server.",
    });
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", mimeTypeFor(localPath, row.mime_type || row.content_type));
  res.setHeader("Content-Disposition", contentDisposition(mode, fileName));

  return fs.createReadStream(localPath).pipe(res);
}

function buildMailer() {
  try {
    const nodemailer = require("nodemailer");

    const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || process.env.MAIL_HOST;
    const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || process.env.MAIL_PORT || 587);
    const user =
      process.env.SMTP_USER ||
      process.env.EMAIL_USER ||
      process.env.MAIL_USER ||
      process.env.GMAIL_USER;
    const pass =
      process.env.SMTP_PASS ||
      process.env.EMAIL_PASS ||
      process.env.MAIL_PASS ||
      process.env.GMAIL_PASS;

    if (!host || !user || !pass) return null;

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  } catch {
    return null;
  }
}

async function sendDocumentEmail(req, row) {
  const email =
    clean(row.email) ||
    clean(row.member_email) ||
    clean(row.recipient_email) ||
    clean(req.user?.email);

  if (!email) {
    const err = new Error("No email address is available for this document.");
    err.status = 400;
    throw err;
  }

  const transporter = buildMailer();

  if (!transporter) {
    const err = new Error("Email transporter is not configured.");
    err.status = 501;
    throw err;
  }

  const fileName = documentFileName(row);
  const localPath = resolveLocalFile(row);
  const normalized = normalizeDocument(row, req);

  const attachments = localPath
    ? [
        {
          filename: fileName,
          path: localPath,
          contentType: mimeTypeFor(fileName, row.mime_type || row.content_type),
        },
      ]
    : [];

  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    process.env.SMTP_USER ||
    process.env.EMAIL_USER;

  await transporter.sendMail({
    from,
    to: email,
    subject: `Holy Trinity Document - ${normalized.title}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
        <h2 style="margin:0 0 12px">Holy Trinity EOTC</h2>
        <p>Your document is available.</p>
        <p><strong>${normalized.title}</strong></p>
        <p>
          <a href="${normalized.absolute_view_url}">View document</a>
          &nbsp;|&nbsp;
          <a href="${normalized.absolute_download_url}">Download document</a>
        </p>
        <p style="color:#64748b;font-size:13px">
          You may need to sign in to your member dashboard before opening the link.
        </p>
      </div>
    `,
    attachments,
  });

  return email;
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

async function listDocuments(req, res) {
  try {
    const memberId = await resolveCurrentMemberId(req);

    if (!memberId) {
      return res.status(404).json({
        ok: false,
        error: "Member profile was not found for this account.",
        rows: [],
        items: [],
      });
    }

    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(250, Math.max(1, toInt(req.query.limit || req.query.pageSize, 100)));
    const offset = (page - 1) * limit;
    const search = clean(req.query.q || req.query.search);
    const status = clean(req.query.status).toLowerCase();

    const where = ["d.member_id = ?"];
    const params = [memberId];

    if (status && status !== "all") {
      where.push("LOWER(COALESCE(d.status, 'active')) = ?");
      params.push(status);
    } else {
      where.push(`
        (
          d.status IS NULL
          OR LOWER(d.status) NOT IN ('deleted', 'archived', 'revoked')
        )
      `);
    }

    if (search) {
      const like = `%${search}%`;
      where.push(`
        (
          d.title LIKE ?
          OR d.document_type LIKE ?
          OR d.category LIKE ?
          OR d.file_name LIKE ?
          OR d.description LIKE ?
        )
      `);
      params.push(like, like, like, like, like);
    }

    const whereSql = where.join(" AND ");

    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_member_documents d
      WHERE ${whereSql}
      `,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT d.*
      FROM tbl_member_documents d
      WHERE ${whereSql}
      ORDER BY
        COALESCE(d.uploaded_at, d.created_at, d.updated_at) DESC,
        d.id DESC
      LIMIT ?
      OFFSET ?
      `,
      [...params, limit, offset]
    );

    const items = rows.map((row) => normalizeDocument(row, req));
    const total = Number(countRows?.[0]?.total || items.length);

    return res.json({
      ok: true,
      success: true,
      rows: items,
      items,
      data: items,
      total,
      meta: {
        page,
        limit,
        total,
        page_count: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("GET /member/documents error:", err);
    return res.status(500).json({
      ok: false,
      error: "Unable to load member documents.",
    });
  }
}

router.get("/", authRequired, listDocuments);
router.get("/list", authRequired, listDocuments);

router.get("/:id/view", authRequired, async (req, res) => {
  try {
    const row = await findMemberDocument(req, req.params.id);
    await writeAudit(req, {
      action: "member_document.view",
      entity_id: documentId(row),
      description: `Member viewed document ${documentTitle(row)}`,
    });

    return streamDocument(req, res, row, "inline");
  } catch (err) {
    console.error("GET /member/documents/:id/view error:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Unable to open document.",
    });
  }
});

router.get("/:id/download", authRequired, async (req, res) => {
  try {
    const row = await findMemberDocument(req, req.params.id);
    await writeAudit(req, {
      action: "member_document.download",
      entity_id: documentId(row),
      description: `Member downloaded document ${documentTitle(row)}`,
    });

    return streamDocument(req, res, row, "attachment");
  } catch (err) {
    console.error("GET /member/documents/:id/download error:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Unable to download document.",
    });
  }
});

async function emailDocumentCopy(req, res) {
  try {
    const row = await findMemberDocument(req, req.params.id);
    const email = await sendDocumentEmail(req, row);

    await writeAudit(req, {
      action: "member_document.email_sent",
      entity_id: documentId(row),
      description: `Member document email sent to ${email}`,
    });

    return res.json({
      ok: true,
      success: true,
      message: "Document email sent.",
      email,
    });
  } catch (err) {
    console.error("POST /member/documents/:id/email error:", err);
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || "Unable to send document email.",
    });
  }
}

router.post("/:id/email", authRequired, emailDocumentCopy);
router.post("/:id/resend-email", authRequired, emailDocumentCopy);

module.exports = router;