// backend/services/domains/programs/schoolPaymentService.js
"use strict";

const pool = require("../../../db");

const {
  clean,
} = require("../../../utils/financeHelpers");

const SCHOOL_CATEGORY = "kids";
const PUBLIC_CATEGORY = "school";
const PRICE_TABLE = "tbl_program_pricing_tiers";
const EVENTS_TABLE = "tbl_news_events";
const REG_TABLE = "tbl_event_program_registrations";

let pricingTableExistsCache = null;

/* -------------------------------------------------------------------------- */
/* Lazy service loading                                                       */
/* -------------------------------------------------------------------------- */

function getProgramRegistrationService() {
  const service = require("./programRegistrationService");

  if (typeof service.createPendingRegistration !== "function") {
    throw new Error(
      "programRegistrationService.createPendingRegistration is not available."
    );
  }

  return service;
}

async function createPendingProgramRegistration(conn, payload) {
  const {
    createPendingRegistration,
  } = getProgramRegistrationService();

  return createPendingRegistration(conn, payload);
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toQuantity(value, fallback = 1) {
  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) {
    return fallback;
  }

  return Math.min(n, 500);
}

function toMoney(value) {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }

  return Number(n.toFixed(2));
}

function parseParticipants(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string" && clean(value)) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeStudent(raw = {}, index = 0) {
  const firstName =
    clean(raw.first_name || raw.firstName, 120) || null;

  const lastName =
    clean(raw.last_name || raw.lastName, 120) || null;

  const studentName =
    clean(
      raw.student_name ||
        raw.studentName ||
        raw.full_name ||
        raw.fullName ||
        `${firstName || ""} ${lastName || ""}`,
      180
    ) || null;

  return {
    student_name: studentName,
    full_name: studentName,
    first_name: firstName,
    last_name: lastName,

    grade:
      clean(raw.grade, 80) || null,

    age:
      raw.age !== undefined &&
      raw.age !== null &&
      raw.age !== ""
        ? Number(raw.age)
        : null,

    date_of_birth:
      clean(raw.date_of_birth || raw.dob, 40) || null,

    allergies:
      clean(raw.allergies, 1000) || null,

    medical_notes:
      clean(raw.medical_notes || raw.medicalNotes, 1000) || null,

    emergency_contact_name:
      clean(raw.emergency_contact_name || raw.emergencyContactName, 180) ||
      null,

    emergency_contact_phone:
      clean(raw.emergency_contact_phone || raw.emergencyContactPhone, 80) ||
      null,

    notes:
      clean(raw.notes, 1000) || null,

    sort_order:
      index + 1,
  };
}

function validateStudents(participants, quantity) {
  const rows = parseParticipants(participants);

  if (!rows.length) {
    throw new Error(
      "At least one student must be added to the school registration form."
    );
  }

  if (rows.length !== quantity) {
    throw new Error(
      "Student count must match the selected quantity."
    );
  }

  const students = rows.map(normalizeStudent);

  for (const student of students) {
    if (!student.student_name) {
      throw new Error("Each student must have a name.");
    }
  }

  return students;
}

function normalizeTier(row = {}) {
  return {
    id: row.id,
    tier_label: row.tier_label,
    label: row.tier_label,
    min_quantity: Number(row.min_quantity || 0),
    max_quantity: Number(row.max_quantity || 0),
    amount: Number(row.amount || 0),
    price_type: row.price_type || "total",
    is_active: Number(row.is_active || 0) === 1,
    sort_order: Number(row.sort_order || 0),
  };
}

async function hasPricingTable(conn) {
  if (pricingTableExistsCache !== null) {
    return pricingTableExistsCache;
  }

  const [rows] = await conn.query(
    "SHOW TABLES LIKE ?",
    [PRICE_TABLE]
  );

  pricingTableExistsCache = rows.length > 0;

  return pricingTableExistsCache;
}

/* -------------------------------------------------------------------------- */
/* Program loading                                                            */
/* -------------------------------------------------------------------------- */

async function getSchoolProgram(conn, eventId) {
  const [[event]] = await conn.query(
    `
    SELECT
      e.id,
      e.category,
      e.title,
      e.subtitle,
      e.summary,
      e.start_date,
      e.end_date,
      e.time_text,
      e.location,
      e.audience,
      e.capacity,
      e.registration_enabled,
      e.is_published,
      e.price_per_person,
      e.registration_notes,

      COALESCE(
        (
          SELECT SUM(r.quantity)
          FROM ${REG_TABLE} r
          WHERE r.news_event_id = e.id
            AND r.status IN ('pending', 'paid')
        ),
        0
      ) AS registered_quantity

    FROM ${EVENTS_TABLE} e

    WHERE e.id = ?
      AND e.category = ?

    LIMIT 1
    `,
    [
      eventId,
      SCHOOL_CATEGORY,
    ]
  );

  return event || null;
}

async function getSchoolPricingTiers(conn, eventId, options = {}) {
  const exists = await hasPricingTable(conn);

  if (!exists) {
    return [];
  }

  const includeInactive = Boolean(options.includeInactive);

  const [rows] = await conn.query(
    `
    SELECT
      id,
      tier_label,
      min_quantity,
      max_quantity,
      amount,
      price_type,
      is_active,
      sort_order
    FROM ${PRICE_TABLE}
    WHERE news_event_id = ?
      AND category = ?
      ${includeInactive ? "" : "AND is_active = 1"}
    ORDER BY
      sort_order ASC,
      min_quantity ASC,
      max_quantity ASC,
      id ASC
    `,
    [
      eventId,
      SCHOOL_CATEGORY,
    ]
  );

  return rows.map(normalizeTier);
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

async function validateSchoolProgram(conn, event) {
  if (!event) {
    throw new Error("School program not found.");
  }

  if (event.category !== SCHOOL_CATEGORY) {
    throw new Error("This event is not a school program.");
  }

  if (!Number(event.is_published)) {
    throw new Error("School program is not published.");
  }

  if (!Number(event.registration_enabled)) {
    throw new Error("School registration is closed.");
  }

  const tiers = await getSchoolPricingTiers(conn, event.id);

  if (!tiers.length && toMoney(event.price_per_person) <= 0) {
    throw new Error("School program pricing is not configured.");
  }

  return true;
}

async function validateSchoolCapacity(conn, eventId, quantity) {
  const [[row]] = await conn.query(
    `
    SELECT
      e.capacity,

      COALESCE(
        SUM(
          CASE
            WHEN r.status IN ('pending', 'paid')
            THEN r.quantity
            ELSE 0
          END
        ),
        0
      ) AS used

    FROM ${EVENTS_TABLE} e

    LEFT JOIN ${REG_TABLE} r
      ON r.news_event_id = e.id

    WHERE e.id = ?

    GROUP BY e.id

    LIMIT 1
    `,
    [eventId]
  );

  const capacity = Number(row?.capacity || 0);
  const used = Number(row?.used || 0);

  if (!capacity) {
    return {
      ok: true,
      capacity: null,
      used,
      remaining: null,
    };
  }

  const remaining = Math.max(capacity - used, 0);

  if (quantity > remaining) {
    throw new Error("Not enough school seats are available.");
  }

  return {
    ok: true,
    capacity,
    used,
    remaining,
  };
}

/* -------------------------------------------------------------------------- */
/* Pricing                                                                    */
/* -------------------------------------------------------------------------- */

async function calculateSchoolPrice(conn, event, quantity) {
  const tiers = await getSchoolPricingTiers(conn, event.id);

  const activeTiers = tiers
    .filter((tier) => tier.is_active)
    .sort((a, b) => {
      if (a.min_quantity !== b.min_quantity) {
        return a.min_quantity - b.min_quantity;
      }

      return a.max_quantity - b.max_quantity;
    });

  const matchedTier = activeTiers.find(
    (tier) =>
      quantity >= Number(tier.min_quantity || 0) &&
      quantity <= Number(tier.max_quantity || 0)
  );

  if (matchedTier) {
    const tierAmount = toMoney(matchedTier.amount);

    const totalAmount =
      matchedTier.price_type === "per_person"
        ? tierAmount * quantity
        : tierAmount;

    return {
      pricing_source: "tier",
      pricing_model: "tier",
      pricing_tier_id: matchedTier.id,
      pricing_tier_label: matchedTier.tier_label,
      price_type: matchedTier.price_type,
      quantity,
      unit_amount: Number((totalAmount / quantity).toFixed(2)),
      total_amount: Number(totalAmount.toFixed(2)),
      tier: matchedTier,
      tiers: activeTiers,
    };
  }

  if (activeTiers.length) {
    throw new Error(
      "School pricing is not configured for the selected number of students."
    );
  }

  const basePrice = toMoney(event.price_per_person);

  if (basePrice <= 0) {
    throw new Error("School program pricing is not configured.");
  }

  const totalAmount = basePrice * quantity;

  return {
    pricing_source: "price_per_person",
    pricing_model: "fallback_per_student",
    pricing_tier_id: null,
    pricing_tier_label: null,
    price_type: "per_person",
    quantity,
    unit_amount: basePrice,
    total_amount: Number(totalAmount.toFixed(2)),
    tier: null,
    tiers: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Payment payload                                                            */
/* -------------------------------------------------------------------------- */

function buildMetadata(payload = {}) {
  return {
    program_category: SCHOOL_CATEGORY,
    public_category: PUBLIC_CATEGORY,
    pricing_source: payload.pricing_source || null,
    pricing_model: payload.pricing_model || null,
    pricing_tier_id: payload.pricing_tier_id || null,
    pricing_tier_label: payload.pricing_tier_label || null,
    price_type: payload.price_type || null,
    student_count: payload.quantity || 0,
    students: payload.students || [],
    parent_name: payload.parent_name || null,
    parent_email: payload.parent_email || null,
    parent_phone: payload.parent_phone || null,
  };
}

async function buildSchoolPaymentPayload(payload = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const eventId = toId(
      payload.news_event_id ||
        payload.program_id ||
        payload.event_id
    );

    if (!eventId) {
      throw new Error("School program id is required.");
    }

    const rawStudents = parseParticipants(
      payload.students ||
        payload.participants
    );

    const quantity = toQuantity(
      payload.quantity || rawStudents.length,
      1
    );

    const students = validateStudents(
      rawStudents,
      quantity
    );

    const event = await getSchoolProgram(
      conn,
      eventId
    );

    await validateSchoolProgram(
      conn,
      event
    );

    const capacity = await validateSchoolCapacity(
      conn,
      eventId,
      quantity
    );

    const pricing = await calculateSchoolPrice(
      conn,
      event,
      quantity
    );

    const payerName = clean(
      payload.full_name ||
        payload.parent_name ||
        payload.payer_name,
      180
    );

    const payerEmail = clean(
      payload.email ||
        payload.parent_email ||
        payload.payer_email,
      190
    ).toLowerCase();

    const payerPhone = clean(
      payload.phone ||
        payload.parent_phone ||
        payload.payer_phone,
      80
    );

    if (!payerName) {
      throw new Error("Parent or payer name is required.");
    }

    if (!payerEmail) {
      throw new Error("Parent or payer email is required.");
    }

    const metadata = buildMetadata({
      ...pricing,
      quantity,
      students,
      parent_name: payerName,
      parent_email: payerEmail,
      parent_phone: payerPhone || null,
    });

    const registration = await createPendingProgramRegistration(
      conn,
      {
        news_event_id: event.id,
        category: SCHOOL_CATEGORY,

        member_id:
          payload.member_id ||
          null,

        full_name: payerName,
        email: payerEmail,
        phone: payerPhone || null,

        quantity,
        participants: students,

        notes:
          clean(payload.notes, 1000) ||
          null,

        price_per_person:
          pricing.unit_amount,

        total_amount:
          pricing.total_amount,

        pricing_tier_id:
          pricing.pricing_tier_id,

        pricing_tier_label:
          pricing.pricing_tier_label,

        metadata_json:
          JSON.stringify(metadata),
      }
    );

    await conn.commit();

    return {
      ok: true,

      registration_id:
        registration.registration_id,

      program: {
        id: event.id,
        category: PUBLIC_CATEGORY,
        raw_category: SCHOOL_CATEGORY,
        title: event.title,
        program_name: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        location: event.location,
      },

      capacity,

      pricing: {
        pricing_source: pricing.pricing_source,
        pricing_model: pricing.pricing_model,
        pricing_tier_id: pricing.pricing_tier_id,
        pricing_tier_label: pricing.pricing_tier_label,
        price_type: pricing.price_type,
        quantity,
        unit_amount: pricing.unit_amount,
        total_amount: pricing.total_amount,
      },

      students,
      participants: students,

      payment_payload: {
        payment_type: PUBLIC_CATEGORY,
        category: PUBLIC_CATEGORY,
        raw_category: SCHOOL_CATEGORY,

        sub_category:
          clean(event.title, 160),

        amount:
          pricing.total_amount,

        quantity,

        member_id:
          payload.member_id ||
          null,

        full_name:
          payerName,

        email:
          payerEmail,

        phone:
          payerPhone || null,

        related_entity_id:
          event.id,

        related_entity_type:
          "news_event",

        registration_id:
          registration.registration_id,

        news_event_id:
          event.id,

        program_name:
          event.title,

        participants:
          students,

        students,

        pricing_source:
          pricing.pricing_source,

        pricing_model:
          pricing.pricing_model,

        pricing_tier_id:
          pricing.pricing_tier_id,

        pricing_tier_label:
          pricing.pricing_tier_label,

        metadata,
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

module.exports = {
  getSchoolProgram,
  getSchoolPricingTiers,

  validateSchoolProgram,
  validateSchoolCapacity,

  calculateSchoolPrice,
  buildSchoolPaymentPayload,

  normalizeStudent,
  validateStudents,
};