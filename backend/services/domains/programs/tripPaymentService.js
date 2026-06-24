// backend/services/domains/programs/tripPaymentService.js
"use strict";

const pool = require("../../../db");

const {
  clean,
} = require("../../../utils/financeHelpers");

const TRIP_CATEGORY = "trip";
const EVENTS_TABLE = "tbl_news_events";
const REG_TABLE = "tbl_event_program_registrations";

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

function normalizeParticipant(raw = {}, index = 0) {
  const firstName =
    clean(raw.first_name || raw.firstName, 120) || null;

  const lastName =
    clean(raw.last_name || raw.lastName, 120) || null;

  const participantName =
    clean(
      raw.participant_name ||
        raw.participantName ||
        raw.full_name ||
        raw.fullName ||
        raw.student_name ||
        raw.studentName ||
        `${firstName || ""} ${lastName || ""}`,
      180
    ) || null;

  return {
    participant_name: participantName,
    first_name: firstName,
    last_name: lastName,
    age:
      raw.age !== undefined &&
      raw.age !== null &&
      raw.age !== ""
        ? Number(raw.age)
        : null,
    date_of_birth:
      clean(raw.date_of_birth || raw.dob, 40) || null,
    email: clean(raw.email, 190).toLowerCase() || null,
    phone: clean(raw.phone, 80) || null,
    emergency_contact_name:
      clean(raw.emergency_contact_name || raw.emergencyContactName, 180) ||
      null,
    emergency_contact_phone:
      clean(raw.emergency_contact_phone || raw.emergencyContactPhone, 80) ||
      null,
    dietary_notes:
      clean(raw.dietary_notes || raw.dietaryNotes, 1000) || null,
    medical_notes:
      clean(raw.medical_notes || raw.medicalNotes, 1000) || null,
    notes: clean(raw.notes, 1000) || null,
    sort_order: index + 1,
  };
}

function validateParticipants(participants, quantity) {
  const rows = parseParticipants(participants);

  if (!rows.length) {
    throw new Error(
      "At least one participant must be added to the trip registration form."
    );
  }

  if (rows.length !== quantity) {
    throw new Error(
      "Participant count must match the selected quantity."
    );
  }

  const normalized = rows.map(normalizeParticipant);

  for (const participant of normalized) {
    if (!participant.participant_name) {
      throw new Error("Each participant must have a name.");
    }
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Program loading                                                            */
/* -------------------------------------------------------------------------- */

async function getTripProgram(conn, eventId) {
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
    [eventId, TRIP_CATEGORY]
  );

  return event || null;
}

/*
  Compatibility export only.
  Trip programs do not use tier pricing.
*/
async function getTripPricingTiers() {
  return [];
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

async function validateTripProgram(_conn, event) {
  if (!event) {
    throw new Error("Trip not found.");
  }

  if (event.category !== TRIP_CATEGORY) {
    throw new Error("This event is not a trip.");
  }

  if (!Number(event.is_published)) {
    throw new Error("Trip is not published.");
  }

  if (!Number(event.registration_enabled)) {
    throw new Error("Trip registration is closed.");
  }

  if (toMoney(event.price_per_person) <= 0) {
    throw new Error("Trip regular price is not configured.");
  }

  return true;
}

async function validateTripCapacity(conn, eventId, quantity) {
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
    throw new Error("Not enough trip seats are available.");
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

async function calculateTripPrice(_conn, event, quantity) {
  const unitAmount = toMoney(event.price_per_person);

  if (unitAmount <= 0) {
    throw new Error("Trip regular price is not configured.");
  }

  const totalAmount = unitAmount * quantity;

  return {
    pricing_source: "price_per_person",
    pricing_tier_id: null,
    pricing_tier_label: null,
    price_type: "per_person",
    quantity,
    unit_amount: unitAmount,
    total_amount: Number(totalAmount.toFixed(2)),
    tiers: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Payment payload                                                            */
/* -------------------------------------------------------------------------- */

function buildMetadata(payload = {}) {
  return {
    program_category: TRIP_CATEGORY,
    pricing_source: "price_per_person",
    price_type: "per_person",
    participant_count: payload.quantity || 0,
    participants: payload.participants || [],
    payer_name: payload.payer_name || null,
    payer_email: payload.payer_email || null,
    payer_phone: payload.payer_phone || null,
  };
}

async function buildTripPaymentPayload(payload = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const eventId = toId(
      payload.news_event_id ||
        payload.program_id ||
        payload.event_id
    );

    if (!eventId) {
      throw new Error("Trip id is required.");
    }

    const rawParticipants = parseParticipants(payload.participants);

    const quantity = toQuantity(
      payload.quantity || rawParticipants.length,
      1
    );

    const participants = validateParticipants(
      rawParticipants,
      quantity
    );

    const event = await getTripProgram(conn, eventId);

    await validateTripProgram(conn, event);

    const capacity = await validateTripCapacity(
      conn,
      eventId,
      quantity
    );

    const pricing = await calculateTripPrice(
      conn,
      event,
      quantity
    );

    const payerName = clean(
      payload.full_name ||
        payload.payer_name ||
        payload.parent_name,
      180
    );

    const payerEmail = clean(
      payload.email ||
        payload.payer_email ||
        payload.parent_email,
      190
    ).toLowerCase();

    const payerPhone = clean(
      payload.phone ||
        payload.payer_phone ||
        payload.parent_phone,
      80
    );

    if (!payerName) {
      throw new Error("Payer name is required.");
    }

    if (!payerEmail) {
      throw new Error("Payer email is required.");
    }

    const metadata = buildMetadata({
      quantity,
      participants,
      payer_name: payerName,
      payer_email: payerEmail,
      payer_phone: payerPhone || null,
    });

    const registration = await createPendingProgramRegistration(
      conn,
      {
        news_event_id: event.id,
        category: TRIP_CATEGORY,

        member_id:
          payload.member_id ||
          null,

        full_name: payerName,
        email: payerEmail,
        phone: payerPhone || null,

        quantity,
        participants,

        notes:
          clean(payload.notes, 1000) ||
          null,

        price_per_person:
          pricing.unit_amount,

        total_amount:
          pricing.total_amount,

        pricing_tier_id: null,
        pricing_tier_label: null,

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
        category: "trip",
        raw_category: TRIP_CATEGORY,
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        location: event.location,
      },

      capacity,

      pricing: {
        pricing_source: pricing.pricing_source,
        pricing_tier_id: null,
        pricing_tier_label: null,
        price_type: pricing.price_type,
        quantity,
        unit_amount: pricing.unit_amount,
        total_amount: pricing.total_amount,
      },

      participants,

      payment_payload: {
        payment_type: "trip",
        category: "trip",
        sub_category: clean(event.title, 160),

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

        participants,

        pricing_source:
          pricing.pricing_source,

        pricing_tier_id: null,
        pricing_tier_label: null,

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
  getTripProgram,
  getTripPricingTiers,

  validateTripProgram,
  validateTripCapacity,

  calculateTripPrice,
  buildTripPaymentPayload,

  normalizeParticipant,
  validateParticipants,
};