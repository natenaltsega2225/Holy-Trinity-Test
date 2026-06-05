// //backend\routes\formSubmission.js


"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

/* ----------------------------------
 * Upload setup
 * ---------------------------------- */
const uploadDir = path.join(process.cwd(), "uploads", "forms");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);

    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only PDF, JPG, PNG, and WEBP files are allowed."));
    }

    cb(null, true);
  },
});

/* ----------------------------------
 * Auth helpers
 * ---------------------------------- */
function getJwtSecret() {
  return process.env.JWT_SECRET || "dev_secret";
}

function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded || null;
    return next();
  } catch (_err) {
    req.user = null;
    return next();
  }
}

function isAdminAllowed(req, res, next) {
  return requireRole("admin", "finance")(req, res, next);
}

/* ----------------------------------
 * Basic helpers
 * ---------------------------------- */
function clean(v, max = 5000) {
  return String(v ?? "").trim().slice(0, max);
}

function parseJsonSafe(v) {
  try {
    return JSON.parse(v || "{}");
  } catch {
    return {};
  }
}

function normalizePhone(v) {
  return String(v ?? "").replace(/\D/g, "").slice(0, 11);
}

function hasNumbers(v) {
  return /\d/.test(String(v ?? ""));
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v, 190));
}

function isPhone(v) {
  const digits = normalizePhone(v);
  if (!/^\d{7,11}$/.test(digits)) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

function isPositiveAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function toMysqlDate(value) {
  const raw = clean(value, 40);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toMysqlTime(value) {
  const raw = clean(value, 20);
  if (!raw) return null;

  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);

  return null;
}

function isValidDate(value) {
  return Boolean(toMysqlDate(value));
}

function isValidTime(value) {
  return Boolean(toMysqlTime(value));
}

function getMeta(formKey) {
  const map = {
    prayer: { form_name: "Prayer Request", category: "spiritual" },
    confession: {
      form_name: "Confession Appointment Request Form",
      category: "spiritual",
    },
    baptism: { form_name: "Baptism Registration Form", category: "spiritual" },
    wedding: {
      form_name: "Engagement / Wedding Registration Form",
      category: "spiritual",
    },
    memorial: {
      form_name: "Memorial / Funeral Service Request Form",
      category: "spiritual",
    },
    houseBlessing: {
      form_name: "House Blessing Request Form",
      category: "spiritual",
    },

    facility: { form_name: "Facility Use Request", category: "service" },
    volunteer: { form_name: "Volunteer Sign-Up", category: "service" },
    choir: { form_name: "Choir Registration", category: "service" },
    teacher: {
      form_name: "Sunday School Teacher / Assistant",
      category: "service",
    },

    kids: { form_name: "Kids Program Registration", category: "programs" },
    youth: { form_name: "Youth Trip / Outing", category: "programs" },

    lost: { form_name: "Lost & Found", category: "incident" },
    incident: { form_name: "Incident Report", category: "incident" },

    reimbursement: {
      form_name: "Reimbursement Request",
      category: "finance",
    },
  };

  return map[formKey] || {
    form_name: "Church Form Submission",
    category: "general",
  };
}

async function resolveMemberByEmail(conn, email) {
  const safeEmail = clean(email, 190).toLowerCase();
  if (!safeEmail) return null;

  const [rows] = await conn.query(
    `
    SELECT id, email
    FROM tbl_members
    WHERE LOWER(email) = ?
    LIMIT 1
    `,
    [safeEmail]
  );

  return rows[0] || null;
}

/* ----------------------------------
 * Validation
 * ---------------------------------- */
function validateGeneric(payload) {
  const errors = [];

  if (!clean(payload.fullName, 180)) {
    errors.push("Full Name is required.");
  } else if (hasNumbers(payload.fullName)) {
    errors.push("Full Name must not contain numbers.");
  }

  if (clean(payload.baptismalName, 180) && hasNumbers(payload.baptismalName)) {
    errors.push("Baptismal Name must not contain numbers.");
  }

  if (!clean(payload.email, 190)) {
    errors.push("Email is required.");
  } else if (!isEmail(payload.email)) {
    errors.push("Email must be valid.");
  }

  const phone = normalizePhone(payload.phone);
  if (!phone) {
    errors.push("Phone Number is required.");
  } else if (!isPhone(phone)) {
    errors.push(
      "Phone Number must be 7 to 11 digits and cannot be repeated digits."
    );
  }

  if (!clean(payload.preferredDate, 30)) {
    errors.push("Preferred Date is required.");
  }

  if (!clean(payload.preferredTime, 30)) {
    errors.push("Preferred Time is required.");
  }

  return errors;
}

function validatePrayer(payload) {
  const errors = [];

  if (!clean(payload.fullName, 180)) {
    errors.push("Full Name is required.");
  } else if (hasNumbers(payload.fullName)) {
    errors.push("Full Name must not contain numbers.");
  }

  if (clean(payload.baptismalName, 180) && hasNumbers(payload.baptismalName)) {
    errors.push("Baptismal Name must not contain numbers.");
  }

  if (
    clean(payload.personsBaptismalName, 180) &&
    hasNumbers(payload.personsBaptismalName)
  ) {
    errors.push("Person’s Name must not contain numbers.");
  }

  if (!clean(payload.email, 190)) {
    errors.push("Email is required.");
  } else if (!isEmail(payload.email)) {
    errors.push("Email must be valid.");
  }

  if (clean(payload.phone, 30) && !isPhone(payload.phone)) {
    errors.push(
      "Phone Number must be 7 to 11 digits and cannot be repeated digits."
    );
  }

  if (!clean(payload.prayerRequestType, 120)) {
    errors.push("Prayer Request Type is required.");
  }

  if (!clean(payload.message, 4000)) {
    errors.push("Message / Request is required.");
  }

  return errors;
}

function validateConfession(payload) {
  const errors = [];

  if (!clean(payload.fullName, 180)) {
    errors.push("Full Name is required.");
  } else if (hasNumbers(payload.fullName)) {
    errors.push("Full Name must not contain numbers.");
  }

  if (clean(payload.baptismalName, 180) && hasNumbers(payload.baptismalName)) {
    errors.push("Baptismal Name must not contain numbers.");
  }

  if (!clean(payload.phone, 30)) {
    errors.push("Phone Number is required.");
  } else if (!isPhone(payload.phone)) {
    errors.push("Phone Number must be valid.");
  }

  if (!clean(payload.email, 190)) {
    errors.push("Email Address is required.");
  } else if (!isEmail(payload.email)) {
    errors.push("Email must be valid.");
  }

  if (!clean(payload.churchMember, 20)) {
    errors.push("Church Member is required.");
  }

  if (!clean(payload.preferredDate, 30)) {
    errors.push("Preferred Date is required.");
  }

  if (!clean(payload.preferredTime, 30)) {
    errors.push("Preferred Time is required.");
  }

  if (!clean(payload.firstConfession, 20)) {
    errors.push("First confession selection is required.");
  }

  return errors;
}

function validateBaptism(payload) {
  const errors = [];

  if (!clean(payload.childFullName, 180)) {
    errors.push("Child’s Full Name is required.");
  } else if (hasNumbers(payload.childFullName)) {
    errors.push("Child’s Full Name must not contain numbers.");
  }

  if (!clean(payload.childGender, 20)) errors.push("Gender is required.");
  if (!clean(payload.childDateOfBirth, 30)) {
    errors.push("Child Date of Birth is required.");
  }
  if (!clean(payload.childPlaceOfBirth, 180)) {
    errors.push("Place of Birth is required.");
  }

  if (!clean(payload.fatherFullName, 180)) {
    errors.push("Father Full Name is required.");
  } else if (hasNumbers(payload.fatherFullName)) {
    errors.push("Father Full Name must not contain numbers.");
  }

  if (
    clean(payload.fatherBaptismalName, 180) &&
    hasNumbers(payload.fatherBaptismalName)
  ) {
    errors.push("Father Baptismal Name must not contain numbers.");
  }

  if (!clean(payload.fatherPhone, 30)) {
    errors.push("Father Phone Number is required.");
  } else if (!isPhone(payload.fatherPhone)) {
    errors.push("Father Phone Number must be valid.");
  }

  if (!clean(payload.fatherEmail, 190)) {
    errors.push("Father Email Address is required.");
  } else if (!isEmail(payload.fatherEmail)) {
    errors.push("Father Email must be valid.");
  }

  if (!clean(payload.fatherMembershipStatus, 40)) {
    errors.push("Father membership status is required.");
  }

  if (!clean(payload.motherFullName, 180)) {
    errors.push("Mother Full Name is required.");
  } else if (hasNumbers(payload.motherFullName)) {
    errors.push("Mother Full Name must not contain numbers.");
  }

  if (
    clean(payload.motherBaptismalName, 180) &&
    hasNumbers(payload.motherBaptismalName)
  ) {
    errors.push("Mother Baptismal Name must not contain numbers.");
  }

  if (!clean(payload.motherPhone, 30)) {
    errors.push("Mother Phone Number is required.");
  } else if (!isPhone(payload.motherPhone)) {
    errors.push("Mother Phone Number must be valid.");
  }

  if (!clean(payload.motherEmail, 190)) {
    errors.push("Mother Email Address is required.");
  } else if (!isEmail(payload.motherEmail)) {
    errors.push("Mother Email must be valid.");
  }

  if (!clean(payload.motherMembershipStatus, 40)) {
    errors.push("Mother membership status is required.");
  }

  if (!clean(payload.preferredBaptismDate, 30)) {
    errors.push("Preferred Baptism Date is required.");
  }

  if (clean(payload.includeGodparent, 20) === "Yes") {
    if (!clean(payload.godparentRole, 40)) {
      errors.push("Godfather / Godmother selection is required.");
    }

    if (!clean(payload.godparentFullName, 180)) {
      errors.push("Godparent Full Name is required.");
    } else if (hasNumbers(payload.godparentFullName)) {
      errors.push("Godparent Full Name must not contain numbers.");
    }

    if (
      clean(payload.godparentBaptismalName, 180) &&
      hasNumbers(payload.godparentBaptismalName)
    ) {
      errors.push("Godparent Baptismal Name must not contain numbers.");
    }

    if (!clean(payload.godparentPhone, 30)) {
      errors.push("Godparent Phone Number is required.");
    } else if (!isPhone(payload.godparentPhone)) {
      errors.push("Godparent Phone Number must be valid.");
    }

    if (!clean(payload.godparentEmail, 190)) {
      errors.push("Godparent Email Address is required.");
    } else if (!isEmail(payload.godparentEmail)) {
      errors.push("Godparent Email must be valid.");
    }

    if (!clean(payload.godparentOrthodox, 20)) {
      errors.push("Orthodox Christian selection is required.");
    }

    if (!clean(payload.godparentChurch, 180)) {
      errors.push("Church they belong to is required.");
    }
  }

  return errors;
}

function validateWedding(payload) {
  const errors = [];

  if (!clean(payload.groomFullName, 180)) {
    errors.push("Groom Full Name is required.");
  } else if (hasNumbers(payload.groomFullName)) {
    errors.push("Groom Full Name must not contain numbers.");
  }

  if (
    clean(payload.groomBaptismalName, 180) &&
    hasNumbers(payload.groomBaptismalName)
  ) {
    errors.push("Groom Baptismal Name must not contain numbers.");
  }

  if (!clean(payload.groomDateOfBirth, 30)) {
    errors.push("Groom Date of Birth is required.");
  }

  if (!clean(payload.groomPhone, 30)) {
    errors.push("Groom Phone Number is required.");
  } else if (!isPhone(payload.groomPhone)) {
    errors.push("Groom Phone Number must be valid.");
  }

  if (!clean(payload.groomEmail, 190)) {
    errors.push("Groom Email Address is required.");
  } else if (!isEmail(payload.groomEmail)) {
    errors.push("Groom Email must be valid.");
  }

  if (!clean(payload.groomOrthodox, 20)) {
    errors.push("Groom Orthodox Christian is required.");
  }

  if (!clean(payload.groomMembershipStatus, 40)) {
    errors.push("Groom membership status is required.");
  }

  if (!clean(payload.brideFullName, 180)) {
    errors.push("Bride Full Name is required.");
  } else if (hasNumbers(payload.brideFullName)) {
    errors.push("Bride Full Name must not contain numbers.");
  }

  if (
    clean(payload.brideBaptismalName, 180) &&
    hasNumbers(payload.brideBaptismalName)
  ) {
    errors.push("Bride Baptismal Name must not contain numbers.");
  }

  if (!clean(payload.brideDateOfBirth, 30)) {
    errors.push("Bride Date of Birth is required.");
  }

  if (!clean(payload.bridePhone, 30)) {
    errors.push("Bride Phone Number is required.");
  } else if (!isPhone(payload.bridePhone)) {
    errors.push("Bride Phone Number must be valid.");
  }

  if (!clean(payload.brideEmail, 190)) {
    errors.push("Bride Email Address is required.");
  } else if (!isEmail(payload.brideEmail)) {
    errors.push("Bride Email must be valid.");
  }

  if (!clean(payload.brideOrthodox, 20)) {
    errors.push("Bride Orthodox Christian is required.");
  }

  if (!clean(payload.brideMembershipStatus, 40)) {
    errors.push("Bride membership status is required.");
  }

  if (!clean(payload.groomBaptized, 20)) {
    errors.push("Groom Baptized is required.");
  }

  if (!clean(payload.brideBaptized, 20)) {
    errors.push("Bride Baptized is required.");
  }

  if (!clean(payload.requestedWeddingDate, 30)) {
    errors.push("Requested Wedding Date is required.");
  }

  if (!clean(payload.weddingLocation, 120)) {
    errors.push("Wedding Location is required.");
  }

  if (!clean(payload.completedCounseling, 20)) {
    errors.push("Premarital counseling status is required.");
  }

  return errors;
}

function validateMemorial(payload) {
  const errors = [];

  if (!clean(payload.deceasedFullName, 180)) {
    errors.push("Full Name of Deceased is required.");
  } else if (hasNumbers(payload.deceasedFullName)) {
    errors.push("Full Name of Deceased must not contain numbers.");
  }

  if (
    clean(payload.deceasedBaptismalName, 180) &&
    hasNumbers(payload.deceasedBaptismalName)
  ) {
    errors.push("Deceased Baptismal Name must not contain numbers.");
  }

  if (!clean(payload.dateOfBirth, 30)) {
    errors.push("Date of Birth is required.");
  }

  if (!clean(payload.dateOfPassing, 30)) {
    errors.push("Date of Passing is required.");
  }

  if (!clean(payload.placeOfPassing, 180)) {
    errors.push("Place of Passing is required.");
  }

  if (!clean(payload.contactPersonName, 180)) {
    errors.push("Contact Person Name is required.");
  } else if (hasNumbers(payload.contactPersonName)) {
    errors.push("Contact Person Name must not contain numbers.");
  }

  if (!clean(payload.relationshipToDeceased, 120)) {
    errors.push("Relationship to Deceased is required.");
  }

  if (!clean(payload.phone, 30)) {
    errors.push("Phone Number is required.");
  } else if (!isPhone(payload.phone)) {
    errors.push("Phone Number must be valid.");
  }

  if (!clean(payload.email, 190)) {
    errors.push("Email Address is required.");
  } else if (!isEmail(payload.email)) {
    errors.push("Email must be valid.");
  }

  if (!clean(payload.requestedServiceType, 180)) {
    errors.push("Requested Service Type is required.");
  }

  if (!clean(payload.preferredDate, 30)) {
    errors.push("Preferred Date is required.");
  }

  if (!clean(payload.preferredTime, 30)) {
    errors.push("Preferred Time is required.");
  }

  if (
    clean(payload.memorialDonation, 50) &&
    !Number.isFinite(Number(payload.memorialDonation))
  ) {
    errors.push("Memorial donation must be a valid number.");
  }

  return errors;
}

function validateHouseBlessing(payload) {
  const errors = [];

  if (!clean(payload.headOfHouseholdName, 180)) {
    errors.push("Head of Household Name is required.");
  } else if (hasNumbers(payload.headOfHouseholdName)) {
    errors.push("Head of Household Name must not contain numbers.");
  }

  if (
    clean(payload.familyBaptismalName, 180) &&
    hasNumbers(payload.familyBaptismalName)
  ) {
    errors.push("Family Baptismal Name must not contain numbers.");
  }

  if (!clean(payload.phone, 30)) {
    errors.push("Phone Number is required.");
  } else if (!isPhone(payload.phone)) {
    errors.push("Phone Number must be valid.");
  }

  if (!clean(payload.email, 190)) {
    errors.push("Email Address is required.");
  } else if (!isEmail(payload.email)) {
    errors.push("Email must be valid.");
  }

  if (!clean(payload.streetAddress, 255)) {
    errors.push("Street Address is required.");
  }

  if (!clean(payload.city, 120)) {
    errors.push("City is required.");
  }

  if (!clean(payload.state, 120)) {
    errors.push("State is required.");
  }

  if (!clean(payload.zipCode, 40)) {
    errors.push("Zip Code is required.");
  }

  if (!clean(payload.preferredBlessingDate, 30)) {
    errors.push("Preferred Blessing Date is required.");
  }

  if (!clean(payload.preferredTime, 30)) {
    errors.push("Preferred Time is required.");
  }

  return errors;
}

function validateReimbursement(payload, file) {
  const errors = [];

  if (!clean(payload.fullName, 180)) {
    errors.push("Full Name is required.");
  } else if (hasNumbers(payload.fullName)) {
    errors.push("Full Name must not contain numbers.");
  }

  if (!clean(payload.email, 190)) {
    errors.push("Email is required.");
  } else if (!isEmail(payload.email)) {
    errors.push("Email must be valid.");
  }

  const phone = normalizePhone(payload.phone);
  if (!phone) {
    errors.push("Phone Number is required.");
  } else if (!isPhone(phone)) {
    errors.push("Phone Number must be valid.");
  }

  if (!clean(payload.purchaseDate, 30)) {
    errors.push("Date of Purchase is required.");
  }

  if (!clean(payload.itemCategory, 120)) {
    errors.push("Item Category is required.");
  }

  if (!isPositiveAmount(payload.totalAmount)) {
    errors.push("Total Amount must be a positive number.");
  }

  if (!clean(payload.itemDescription, 4000)) {
    errors.push("Item Description is required.");
  }

  if (!clean(payload.reimbursementMethod, 60)) {
    errors.push("Preferred Reimbursement Method is required.");
  }

  if (!file) {
    errors.push("Receipt / invoice attachment is required.");
  }

  return errors;
}

function validateForm(formKey, payload, file) {
  switch (formKey) {
    case "prayer":
      return validatePrayer(payload);
    case "confession":
      return validateConfession(payload);
    case "baptism":
      return validateBaptism(payload);
    case "wedding":
      return validateWedding(payload);
    case "memorial":
      return validateMemorial(payload);
    case "houseBlessing":
      return validateHouseBlessing(payload);
    case "reimbursement":
      return validateReimbursement(payload, file);
    default:
      return validateGeneric(payload);
  }
}

/* ----------------------------------
 * Top-level mapping
 * ---------------------------------- */
function pickTopLevelFields(formKey, payload) {
  switch (formKey) {
    case "prayer":
      return {
        submittedBy: clean(payload.fullName, 180) || null,
        baptismalName: clean(payload.baptismalName, 180) || null,
        email: clean(payload.email, 190) || null,
        phone: normalizePhone(payload.phone) || null,
        preferredDate: null,
        preferredTime: null,
      };

    case "confession":
      return {
        submittedBy: clean(payload.fullName, 180) || null,
        baptismalName: clean(payload.baptismalName, 180) || null,
        email: clean(payload.email, 190) || null,
        phone: normalizePhone(payload.phone) || null,
        preferredDate: toMysqlDate(payload.preferredDate),
        preferredTime: toMysqlTime(payload.preferredTime),
      };

    case "baptism":
      return {
        submittedBy:
          clean(
            payload.fatherFullName ||
              payload.motherFullName ||
              payload.childFullName,
            180
          ) || null,
        baptismalName:
          clean(
            payload.fatherBaptismalName || payload.motherBaptismalName,
            180
          ) || null,
        email:
          clean(payload.fatherEmail || payload.motherEmail, 190) || null,
        phone:
          normalizePhone(payload.fatherPhone || payload.motherPhone) || null,
        preferredDate: toMysqlDate(payload.preferredBaptismDate),
        preferredTime: null,
      };

    case "wedding":
      return {
        submittedBy: clean(payload.groomFullName, 180) || null,
        baptismalName: clean(payload.groomBaptismalName, 180) || null,
        email: clean(payload.groomEmail, 190) || null,
        phone: normalizePhone(payload.groomPhone) || null,
        preferredDate: toMysqlDate(payload.requestedWeddingDate),
        preferredTime: null,
      };

    case "memorial":
      return {
        submittedBy: clean(payload.contactPersonName, 180) || null,
        baptismalName: clean(payload.deceasedBaptismalName, 180) || null,
        email: clean(payload.email, 190) || null,
        phone: normalizePhone(payload.phone) || null,
        preferredDate: toMysqlDate(payload.preferredDate),
        preferredTime: toMysqlTime(payload.preferredTime),
      };

    case "houseBlessing":
      return {
        submittedBy: clean(payload.headOfHouseholdName, 180) || null,
        baptismalName: clean(payload.familyBaptismalName, 180) || null,
        email: clean(payload.email, 190) || null,
        phone: normalizePhone(payload.phone) || null,
        preferredDate: toMysqlDate(payload.preferredBlessingDate),
        preferredTime: toMysqlTime(payload.preferredTime),
      };

    case "reimbursement":
      return {
        submittedBy: clean(payload.fullName, 180) || null,
        baptismalName: null,
        email: clean(payload.email, 190) || null,
        phone: normalizePhone(payload.phone) || null,
        preferredDate: toMysqlDate(payload.purchaseDate),
        preferredTime: null,
      };

    default:
      return {
        submittedBy: clean(payload.fullName, 180) || null,
        baptismalName: clean(payload.baptismalName, 180) || null,
        email: clean(payload.email, 190) || null,
        phone: normalizePhone(payload.phone) || null,
        preferredDate: toMysqlDate(payload.preferredDate),
        preferredTime: toMysqlTime(payload.preferredTime),
      };
  }
}

/* ----------------------------------
 * Public submit
 * ---------------------------------- */
router.post(
  "/submit",
  optionalAuth,
  upload.single("attachment"),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const formKey = clean(req.body.form_key, 80);
      const payload =
        typeof req.body.payload_json === "string"
          ? parseJsonSafe(req.body.payload_json)
          : req.body.payload_json || {};

      const meta = getMeta(formKey);
      const errors = validateForm(formKey, payload, req.file);

      if (errors.length) {
        conn.release();
        return res.status(400).json({
          ok: false,
          message: "Validation failed.",
          errors,
        });
      }

      let memberId =
        Number(req.user?.member_id || req.user?.memberId || req.user?.id || 0) ||
        null;

      if (!memberId && payload.email) {
        const matchedMember = await resolveMemberByEmail(conn, payload.email);
        memberId = Number(matchedMember?.id || 0) || null;
      }

      const top = pickTopLevelFields(formKey, payload);

      const attachmentUrl = req.file
        ? `/uploads/forms/${req.file.filename}`
        : null;
      const attachmentName = req.file
        ? clean(req.file.originalname, 255)
        : null;
      const attachmentSize = req.file
        ? Number(req.file.size || 0)
        : null;

      const ipAddress =
        req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
        req.ip ||
        null;

      const userAgent = clean(req.headers["user-agent"], 255) || null;

      await conn.beginTransaction();

      const [submissionResult] = await conn.query(
        `
        INSERT INTO tbl_form_submissions
        (
          form_key,
          form_name,
          category,
          user_id,
          submitted_by,
          baptismal_name,
          email,
          phone,
          status,
          priority,
          preferred_date,
          preferred_time,
          payload_json,
          attachment_url,
          attachment_name,
          attachment_size,
          ip_address,
          user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'normal', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          formKey,
          meta.form_name,
          meta.category,
          memberId,
          top.submittedBy,
          top.baptismalName,
          top.email,
          top.phone,
          top.preferredDate,
          top.preferredTime,
          JSON.stringify({
            ...payload,
            phone: top.phone,
          }),
          attachmentUrl,
          attachmentName,
          attachmentSize,
          ipAddress,
          userAgent,
        ]
      );

      await conn.commit();
      conn.release();

      return res.status(201).json({
        ok: true,
        message: "Form submitted successfully.",
        submissionId: Number(submissionResult.insertId),
        linkedToMember: Boolean(memberId),
      });
    } catch (error) {
      await conn.rollback();
      conn.release();
      console.error("POST /api/forms/submit error:", error);
      return res.status(500).json({
        ok: false,
        message: "Failed to submit form.",
      });
    }
  }
);

/* ----------------------------------
 * Admin list helpers
 * ---------------------------------- */
function buildListWhere(query) {
  const where = ["fs.is_deleted = 0"];
  const params = [];

  const search = clean(query.search || "", 120);
  const category = clean(query.category || "", 80).toLowerCase();
  const status = clean(query.status || "", 40).toLowerCase();

  if (search) {
    const like = `%${search}%`;
    where.push(`
      (
        COALESCE(fs.form_name, '') LIKE ?
        OR COALESCE(fs.form_key, '') LIKE ?
        OR COALESCE(fs.category, '') LIKE ?
        OR COALESCE(fs.submitted_by, '') LIKE ?
        OR COALESCE(fs.email, '') LIKE ?
        OR COALESCE(fs.phone, '') LIKE ?
        OR COALESCE(fs.admin_notes, '') LIKE ?
        OR COALESCE(fs.admin_explanation, '') LIKE ?
      )
    `);
    params.push(like, like, like, like, like, like, like, like);
  }

  if (category) {
    where.push("LOWER(fs.category) = ?");
    params.push(category);
  }

  if (status) {
    where.push("LOWER(fs.status) = ?");
    params.push(status);
  }

  return {
    whereSql: `WHERE ${where.join(" AND ")}`,
    params,
  };
}

/* ----------------------------------
 * Admin routes
 * ---------------------------------- */
router.get("/admin/submissions", authRequired, isAdminAllowed, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const pageSize = Math.min(
      Math.max(Number(req.query.pageSize || 10), 1),
      100
    );
    const offset = (page - 1) * pageSize;

    const { whereSql, params } = buildListWhere(req.query);

    const [[countRow]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_form_submissions fs
      ${whereSql}
      `,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT
        fs.id,
        fs.form_key,
        fs.form_name,
        fs.category,
        fs.user_id,
        fs.submitted_by,
        fs.email,
        fs.phone,
        fs.status,
        fs.preferred_date,
        fs.preferred_time,
        fs.admin_notes,
        fs.admin_explanation,
        fs.scheduled_date,
        fs.scheduled_time,
        fs.attachment_url,
        fs.attachment_name,
        fs.created_at,
        fs.updated_at
      FROM tbl_form_submissions fs
      ${whereSql}
      ORDER BY fs.created_at DESC, fs.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const total = Number(countRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return res.json({
      ok: true,
      rows,
      total,
      page,
      limit: pageSize,
      totalPages,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("GET /api/forms/admin/submissions error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to load submissions.",
    });
  }
});

router.get(
  "/admin/submissions/:id",
  authRequired,
  isAdminAllowed,
  async (req, res) => {
    try {
      const id = Number(req.params.id || 0);

      const [rows] = await pool.query(
        `
        SELECT *
        FROM tbl_form_submissions
        WHERE id = ? AND is_deleted = 0
        LIMIT 1
        `,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          ok: false,
          message: "Submission not found.",
        });
      }

      const row = rows[0];
      row.payload_json =
        typeof row.payload_json === "string"
          ? parseJsonSafe(row.payload_json)
          : row.payload_json;

      return res.json({ ok: true, row });
    } catch (error) {
      console.error("GET /api/forms/admin/submissions/:id error:", error);
      return res.status(500).json({
        ok: false,
        message: "Failed to load submission detail.",
      });
    }
  }
);

router.patch(
  "/admin/submissions/:id",
  authRequired,
  isAdminAllowed,
  async (req, res) => {
    try {
      const id = Number(req.params.id || 0);

      const submittedBy = clean(req.body.submitted_by, 180) || null;
      const email = clean(req.body.email, 190) || null;
      const phone = normalizePhone(req.body.phone) || null;
      const status = clean(req.body.status, 40).toLowerCase() || "pending";
      const notes = clean(req.body.notes, 4000) || null;
      const adminNotes = clean(req.body.admin_notes, 4000) || null;
      const adminExplanation =
        clean(req.body.admin_explanation, 4000) || null;
      const scheduledDate = toMysqlDate(req.body.scheduled_date);
      const scheduledTime = toMysqlTime(req.body.scheduled_time);

      const allowed = [
        "pending",
        "in_review",
        "approved",
        "rejected",
        "scheduled",
        "completed",
        "cancelled",
      ];

      if (!allowed.includes(status)) {
        return res.status(400).json({
          ok: false,
          message: "Invalid status.",
        });
      }

      if (email && !isEmail(email)) {
        return res.status(400).json({
          ok: false,
          message: "Email must be valid.",
        });
      }

      if (phone && !isPhone(phone)) {
        return res.status(400).json({
          ok: false,
          message:
            "Phone Number must be 7 to 11 digits and cannot be repeated digits.",
        });
      }

      if (
        clean(req.body.scheduled_date, 40) &&
        !isValidDate(req.body.scheduled_date)
      ) {
        return res.status(400).json({
          ok: false,
          message: "Scheduled date must be valid.",
        });
      }

      if (
        clean(req.body.scheduled_time, 20) &&
        !isValidTime(req.body.scheduled_time)
      ) {
        return res.status(400).json({
          ok: false,
          message: "Scheduled time must be valid.",
        });
      }

      if (status === "scheduled" && !scheduledDate) {
        return res.status(400).json({
          ok: false,
          message: "Scheduled date is required when status is scheduled.",
        });
      }

      let userId = null;
      if (email) {
        const matchedMember = await resolveMemberByEmail(pool, email);
        userId = Number(matchedMember?.id || 0) || null;
      }

      const [result] = await pool.query(
        `
        UPDATE tbl_form_submissions
        SET
          user_id = COALESCE(?, user_id),
          submitted_by = ?,
          email = ?,
          phone = ?,
          status = ?,
          notes = ?,
          admin_notes = ?,
          admin_explanation = ?,
          scheduled_date = ?,
          scheduled_time = ?,
          reviewed_by = ?,
          reviewed_at = NOW()
        WHERE id = ? AND is_deleted = 0
        `,
        [
          userId,
          submittedBy,
          email,
          phone,
          status,
          notes,
          adminNotes,
          adminExplanation,
          scheduledDate,
          scheduledTime,
          Number(req.user?.id || 0) || null,
          id,
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          ok: false,
          message: "Submission not found.",
        });
      }

      return res.json({
        ok: true,
        message: "Submission updated successfully.",
      });
    } catch (error) {
      console.error("PATCH /api/forms/admin/submissions/:id error:", error);
      return res.status(500).json({
        ok: false,
        message: "Failed to update submission.",
      });
    }
  }
);

router.patch(
  "/admin/submissions/:id/status",
  authRequired,
  isAdminAllowed,
  async (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      const status = clean(req.body.status, 40).toLowerCase();

      const allowed = [
        "pending",
        "in_review",
        "approved",
        "rejected",
        "scheduled",
        "completed",
        "cancelled",
      ];

      if (!allowed.includes(status)) {
        return res.status(400).json({
          ok: false,
          message: "Invalid status.",
        });
      }

      const [result] = await pool.query(
        `
        UPDATE tbl_form_submissions
        SET status = ?, reviewed_by = ?, reviewed_at = NOW()
        WHERE id = ? AND is_deleted = 0
        `,
        [status, Number(req.user?.id || 0) || null, id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          ok: false,
          message: "Submission not found.",
        });
      }

      return res.json({
        ok: true,
        message: "Status updated successfully.",
      });
    } catch (error) {
      console.error("PATCH /api/forms/admin/submissions/:id/status error:", error);
      return res.status(500).json({
        ok: false,
        message: "Failed to update status.",
      });
    }
  }
);

router.delete(
  "/admin/submissions/:id",
  authRequired,
  isAdminAllowed,
  async (req, res) => {
    try {
      const id = Number(req.params.id || 0);

      const [result] = await pool.query(
        `
        UPDATE tbl_form_submissions
        SET is_deleted = 1
        WHERE id = ? AND is_deleted = 0
        `,
        [id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          ok: false,
          message: "Submission not found.",
        });
      }

      return res.json({
        ok: true,
        message: "Submission deleted successfully.",
      });
    } catch (error) {
      console.error("DELETE /api/forms/admin/submissions/:id error:", error);
      return res.status(500).json({
        ok: false,
        message: "Failed to delete submission.",
      });
    }
  }
);

/* ----------------------------------
 * Member requests
 * ---------------------------------- */
router.get("/member/my-requests", authRequired, async (req, res) => {
  try {
    const memberId =
      Number(req.user?.member_id || req.user?.memberId || req.user?.id || 0) ||
      0;

    if (!memberId) {
      return res.status(400).json({
        ok: false,
        message: "Member account is required.",
      });
    }

    const search = clean(req.query.search, 120);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const offset = (page - 1) * limit;

    const [memberRows] = await pool.query(
      `
      SELECT id, email
      FROM tbl_members
      WHERE id = ?
      LIMIT 1
      `,
      [memberId]
    );

    const memberEmail = clean(memberRows?.[0]?.email, 190).toLowerCase() || "";

    if (memberEmail) {
      await pool.query(
        `
        UPDATE tbl_form_submissions
        SET user_id = ?
        WHERE is_deleted = 0
          AND user_id IS NULL
          AND LOWER(email) = ?
        `,
        [memberId, memberEmail]
      );
    }

    const where = ["fs.is_deleted = 0", "(fs.user_id = ?"];
    const params = [memberId];

    if (memberEmail) {
      where[1] += " OR LOWER(fs.email) = ?";
      params.push(memberEmail);
    }

    where[1] += ")";

    if (search) {
      const like = `%${search}%`;
      where.push(`
        (
          COALESCE(fs.form_name, '') LIKE ?
          OR COALESCE(fs.form_key, '') LIKE ?
          OR COALESCE(fs.status, '') LIKE ?
          OR COALESCE(fs.admin_notes, '') LIKE ?
          OR COALESCE(fs.admin_explanation, '') LIKE ?
        )
      `);
      params.push(like, like, like, like, like);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;

    const [[countRow]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_form_submissions fs
      ${whereSql}
      `,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT
        fs.id,
        fs.form_key,
        fs.form_name,
        fs.category,
        fs.status,
        fs.submitted_by,
        fs.email,
        fs.phone,
        fs.notes,
        fs.admin_notes,
        fs.admin_explanation,
        fs.scheduled_date,
        fs.scheduled_time,
        fs.preferred_date,
        fs.preferred_time,
        fs.attachment_url,
        fs.created_at,
        fs.updated_at
      FROM tbl_form_submissions fs
      ${whereSql}
      ORDER BY fs.created_at DESC, fs.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const total = Number(countRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.json({
      ok: true,
      rows,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error("GET /api/forms/member/my-requests error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to load member requests.",
    });
  }
});

module.exports = router;