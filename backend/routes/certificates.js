// backend/routes/certificates.js

"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const pool = require("../db");

const {
  authRequired,
} = require("../middleware/auth");

const {
  createCertificatePdf,
} = require("../services/certificatePdfService");

const {
  sendCertificateEmail,
} = require("../services/emailService");

/* =========================================================
   HELPERS
========================================================= */

function safe(value = "") {
  return String(value ?? "").trim();
}

function slug(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildCertificateNumber(type) {
  const prefix = String(type || "CERT")
    .replace("_certificate", "")
    .substring(0, 4)
    .toUpperCase();

  return `${prefix}-${Date.now()}`;
}

function ensureUploadsDirectory() {
  const dir = path.join(
    __dirname,
    "..",
    "uploads",
    "certificates"
  );

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true,
    });
  }

  return dir;
}

/* =========================================================
   VALIDATION
========================================================= */

function validatePayload(type, payload) {
  const errors = [];

  const applicantType = safe(
    payload.applicantType
  );

  if (
    applicantType !== "member" &&
    applicantType !== "non_member"
  ) {
    errors.push(
      "Applicant type is required."
    );
  }

  if (
    applicantType === "member" &&
    !safe(payload.member_id)
  ) {
    errors.push("Member is required.");
  }

  if (
    applicantType === "non_member" &&
    !safe(payload.recipientName)
  ) {
    errors.push(
      "Recipient name is required."
    );
  }

  if (!safe(payload.priestName)) {
    errors.push(
      "Priest name is required."
    );
  }

  /* =====================================================
     MARRIAGE / ENGAGEMENT
  ===================================================== */

  if (
    type ===
      "marriage_certificate" ||
    type ===
      "engagement_certificate"
  ) {
    if (!safe(payload.husbandName)) {
      errors.push(
        "Husband name is required."
      );
    }

    if (!safe(payload.wifeName)) {
      errors.push(
        "Wife name is required."
      );
    }
  }

  /* =====================================================
     BAPTISM
  ===================================================== */

  if (
    type ===
    "baptism_certificate"
  ) {
    if (
      !safe(payload.christianName)
    ) {
      errors.push(
        "Christian name is required."
      );
    }
  }

  return errors;
}

/* =========================================================
   GET MEMBER (SMART LOOKUP)
========================================================= */

async function getMember(memberId) {

  if (!memberId) {
    return null;
  }

  /* =====================================================
     1. TRY DIRECT MEMBER ID
  ===================================================== */

  const [memberRows] = await pool.query(
    `
    SELECT

      m.id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone,
      m.status,
      m.membership_status,
      m.is_active,

      u.id AS user_id,
      u.role,
      u.is_active AS user_active

    FROM tbl_members m

    LEFT JOIN tbl_users u
      ON u.member_id = m.id

    WHERE m.id = ?

    LIMIT 1
    `,
    [memberId]
  );

  if (memberRows?.length) {
    return memberRows[0];
  }

  /* =====================================================
     2. TRY USER ID -> MEMBER ID
  ===================================================== */

  const [userRows] = await pool.query(
    `
    SELECT

      m.id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone,
      m.status,
      m.membership_status,
      m.is_active,

      u.id AS user_id,
      u.role,
      u.is_active AS user_active

    FROM tbl_users u

    INNER JOIN tbl_members m
      ON m.id = u.member_id

    WHERE u.id = ?

    LIMIT 1
    `,
    [memberId]
  );

  if (userRows?.length) {
    return userRows[0];
  }

  return null;
}
/* =========================================================
   INSERT DOCUMENT
========================================================= */

async function insertDocument({
  memberId,
  documentType,
  fileUrl,
  fileName,
  fullName,
  certificateNumber,
  createdBy,
  payload,
  applicantType,
  email,
}) {
  const [result] =
    await pool.query(
      `
      INSERT INTO tbl_member_documents (

        member_id,

        applicant_type,

        full_name,

        email,

        external_email,

        document_type,

        certificate_number,

        payload_json,

        file_url,

        file_name,

        mime_type,

        uploaded_by

      )

      VALUES (

        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?

      )
      `,
      [
        memberId || null,

        applicantType ||
          "member",

        fullName ||
          "Recipient",

        email || null,

        email || null,

        documentType,

        certificateNumber,

        JSON.stringify(
          payload || {}
        ),

        fileUrl,

        fileName,

        "application/pdf",

        createdBy || null,
      ]
    );

  return result.insertId;
}

/* =========================================================
   ADMIN ACCESS CHECK
========================================================= */

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

/* =========================================================
   GENERATE CERTIFICATE
========================================================= */

router.post(
  "/generate",

  authRequired,

  adminOnly,

  async (req, res) => {
    try {
      const payload =
        req.body || {};

      const type = safe(
        payload.type
      );

      if (!type) {
        return res.status(400).json({
          error:
            "Certificate type is required.",
        });
      }

      /* =================================================
         VALIDATION
      ================================================= */

      const errors =
        validatePayload(
          type,
          payload
        );

      if (errors.length) {
        return res.status(400).json({
          error: errors[0],
          errors,
        });
      }

      /* =================================================
         MEMBER
      ================================================= */

      let member = null;

      if (
        payload.applicantType ===
        "member"
      ) {
        member =
          await getMember(
            payload.member_id
          );

        if (!member) {
          return res.status(404).json({
            error:
              "Member not found.",
          });
        }
      }

      /* =================================================
         CERTIFICATE NUMBER
      ================================================= */

      const certificateNumber =
        payload.certificateNumber ||
        buildCertificateNumber(
          type
        );

      /* =================================================
         FILES
      ================================================= */

      const uploadsDir =
        ensureUploadsDirectory();

      const displayName =
        safe(
          payload.recipientName
        ) ||
        safe(
          payload.husbandName
        ) ||
        safe(
          member?.full_name
        ) ||
        "certificate";

      const fileName = `${slug(
        type
      )}-${slug(
        displayName
      )}-${Date.now()}.pdf`;

      const absolutePath =
        path.join(
          uploadsDir,
          fileName
        );

      const fileUrl =
        `/uploads/certificates/${fileName}`;

      /* =================================================
         MERGED PAYLOAD
      ================================================= */

      const mergedPayload = {
        ...payload,

        certificateNumber,

        churchName:
          payload.churchName ||
          "Holy Trinity Ethiopian Orthodox Tewahedo Church",

        location:
          payload.location ||
          "Nashville, Tennessee",

        recipientName:
          payload.recipientName ||
          member?.full_name ||
          payload.husbandName ||
          "Recipient",

        administratorName:
          payload.administratorName ||
          req.user?.username ||
          "Church Administration",
      };

      /* =================================================
         GENERATE PDF
      ================================================= */

      await createCertificatePdf({
        outputPath:
          absolutePath,

        type,

        payload:
          mergedPayload,

        member,
      });

      /* =================================================
         VERIFY FILE
      ================================================= */

      if (
        !fs.existsSync(
          absolutePath
        )
      ) {
        throw new Error(
          "Certificate PDF generation failed."
        );
      }

      /* =================================================
         INSERT DOCUMENT
      ================================================= */

      const documentId =
        await insertDocument({
          memberId:
            member?.id,

          documentType:
            type,

          fileUrl,

          fileName,

          fullName:
            mergedPayload.recipientName,

          certificateNumber,

          createdBy:
            req.user?.id,

          payload:
            mergedPayload,

          applicantType:
            payload.applicantType,

          email:
            payload.externalEmail ||
            member?.email ||
            null,
        });

      /* =================================================
         SEND EMAIL
      ================================================= */

      try {
        const recipientEmail =
          payload.externalEmail ||
          member?.email ||
          null;

        if (recipientEmail) {
          await sendCertificateEmail(
            {
              to:
                recipientEmail,

              pdfPath:
                absolutePath,

              recipientName:
                mergedPayload.recipientName,

              certificateNumber,

              type,

              churchName:
                mergedPayload.churchName,

              priestName:
                mergedPayload.priestName,

              administratorName:
                mergedPayload.administratorName,
            }
          );

          console.log(
            "✅ Certificate email delivered:",
            recipientEmail
          );
        } else {
          console.log(
            "⚠ No email available for certificate."
          );
        }
      } catch (emailErr) {
        console.error(
          "❌ Certificate email failed:",
          emailErr.message
        );
      }

      /* =================================================
         SUCCESS
      ================================================= */

      console.log(
        "✅ CERTIFICATE GENERATED:",
        {
          id: documentId,

          applicantType:
            payload.applicantType,

          member_id:
            payload.member_id,

          file: fileUrl,
        }
      );

      return res.json({
        success: true,

        message:
          "Certificate generated successfully.",

        document: {
          id: documentId,

          document_type:
            type,

          file_url:
            fileUrl,

          certificate_number:
            certificateNumber,

          recipient_name:
            mergedPayload.recipientName,
        },
      });
    } catch (err) {
      console.error(
        "POST /certificates/generate error:",
        err
      );

      return res.status(500).json({
        error:
          "Failed to generate certificate.",

        details:
          err.message,
      });
    }
  }
);

/* =========================================================
   CERTIFICATE TYPES
========================================================= */

router.get(
  "/types",

  authRequired,

  async (_req, res) => {
    return res.json({
      success: true,

      items: [
        {
          value:
            "baptism_certificate",

          label:
            "Baptism Certificate",
        },

        {
          value:
            "engagement_certificate",

          label:
            "Engagement Certificate",
        },

        {
          value:
            "marriage_certificate",

          label:
            "Marriage Certificate",
        },

        {
          value:
            "volunteer_certificate",

          label:
            "Volunteer Certificate",
        },

        {
          value:
            "participation_certificate",

          label:
            "Participation Certificate",
        },

        {
          value:
            "recognition_certificate",

          label:
            "Recognition Certificate",
        },
      ],
    });
  }
);

module.exports = router;