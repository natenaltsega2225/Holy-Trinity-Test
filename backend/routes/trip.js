// backend/routes/trip.js
"use strict";

const express = require("express");
const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

const TRIP_CATEGORY = "trip";
const EVENTS_TABLE = "tbl_news_events";
const REG_TABLE = "tbl_event_program_registrations";

const ADMIN_ROLES = [
  "admin",
  "super_admin",
  "finance",
  "instructor",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") return value;

  return ["1", "true", "yes", "y", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function toMoney(value) {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }

  return Number(n.toFixed(2));
}

function toQuantity(value, fallback = 1) {
  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) {
    return fallback;
  }

  return Math.min(n, 500);
}

function publicError(res, status, message) {
  return res.status(status).json({
    ok: false,
    error: message,
  });
}

function normalizeDate(value) {
  if (!value) return null;

  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return null;
  }
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
  const firstName = clean(raw.first_name || raw.firstName, 120);
  const lastName = clean(raw.last_name || raw.lastName, 120);

  const participantName =
    clean(
      raw.participant_name ||
        raw.participantName ||
        raw.full_name ||
        raw.fullName ||
        raw.student_name ||
        raw.studentName ||
        `${firstName} ${lastName}`,
      180
    ) || null;

  return {
    participant_name: participantName,
    first_name: firstName || null,
    last_name: lastName || null,
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
  if (!Array.isArray(participants) || !participants.length) {
    throw new Error(
      "At least one participant must be added to the trip registration form."
    );
  }

  if (participants.length !== quantity) {
    throw new Error(
      "Participant count must match the selected quantity."
    );
  }

  const normalized = participants.map(normalizeParticipant);

  for (const participant of normalized) {
    if (!participant.participant_name) {
      throw new Error("Each participant must have a name.");
    }
  }

  return normalized;
}

function normalizeProgram(row) {
  if (!row) return null;

  const capacity =
    row.capacity === null ||
    row.capacity === undefined
      ? null
      : Number(row.capacity || 0);

  const registeredQuantity = Number(row.registered_quantity || 0);

  const remainingCapacity =
    capacity && capacity > 0
      ? Math.max(capacity - registeredQuantity, 0)
      : null;

  const price = Number(row.price_per_person || 0);

  return {
    id: row.id,
    news_event_id: row.id,

    category: "trip",
    raw_category: TRIP_CATEGORY,
    public_category: "trip",

    title: row.title,
    program_name: row.title,
    subtitle: row.subtitle,
    summary: row.summary,

    start_date: normalizeDate(row.start_date),
    end_date: normalizeDate(row.end_date),
    time_text: row.time_text,
    location: row.location,
    audience: row.audience,
    flyer_url: row.flyer_url,

    price_per_person: price,
    price,
    amount: price,

    pricing_model: "price_per_person",
    pricing_tiers: [],

    capacity,
    registered_quantity: registeredQuantity,
    remaining_capacity: remainingCapacity,
    sold_out:
      remainingCapacity !== null &&
      remainingCapacity <= 0,

    registration_enabled:
      Number(row.registration_enabled || 0) === 1,

    is_published:
      Number(row.is_published || 0) === 1,

    registration_notes:
      row.registration_notes || null,
  };
}

/* -------------------------------------------------------------------------- */
/* Data Access                                                                */
/* -------------------------------------------------------------------------- */

async function getProgram(conn, id, options = {}) {
  const publicOnly = Boolean(options.publicOnly);

  const [[row]] = await conn.query(
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
      e.flyer_url,
      e.price_per_person,
      e.capacity,
      e.registration_enabled,
      e.is_published,
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
      ${publicOnly ? "AND e.is_published = 1" : ""}

    LIMIT 1
    `,
    [id, TRIP_CATEGORY]
  );

  return normalizeProgram(row);
}

async function listPrograms(conn, query = {}, options = {}) {
  const includePast = toBool(query.include_past, false);
  const includeSoldOut = toBool(query.include_sold_out, true);
  const includeInactive = Boolean(options.admin) && toBool(query.include_inactive, false);
  const includeUnpublished = Boolean(options.admin) && toBool(query.include_unpublished, false);

  const search = clean(query.q || query.search, 120);

  const limit = Math.min(
    Math.max(Number(query.limit || 100), 1),
    200
  );

  const params = [TRIP_CATEGORY];

  const where = [
    "e.category = ?",
  ];

  if (!includeUnpublished) {
    where.push("e.is_published = 1");
  }

  if (!includeInactive) {
    where.push("e.registration_enabled = 1");
  }

  if (!includePast) {
    where.push(
      "(e.start_date IS NULL OR DATE(e.start_date) >= CURDATE())"
    );
  }

  if (search) {
    const like = `%${search}%`;

    where.push(
      `
      (
        e.title LIKE ?
        OR e.subtitle LIKE ?
        OR e.summary LIKE ?
        OR e.location LIKE ?
      )
      `
    );

    params.push(like, like, like, like);
  }

  params.push(limit);

  const [rows] = await conn.query(
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
      e.flyer_url,
      e.price_per_person,
      e.capacity,
      e.registration_enabled,
      e.is_published,
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

    WHERE ${where.join(" AND ")}

    ORDER BY
      CASE WHEN e.start_date IS NULL THEN 1 ELSE 0 END,
      e.start_date ASC,
      e.id DESC

    LIMIT ?
    `,
    params
  );

  const normalized = rows.map(normalizeProgram);

  return includeSoldOut
    ? normalized
    : normalized.filter((row) => !row.sold_out);
}

async function validateCapacity(program, quantity) {
  if (!program) {
    throw new Error("Trip not found.");
  }

  if (!program.registration_enabled || !program.is_published) {
    throw new Error("Trip registration is not open.");
  }

  if (
    program.remaining_capacity !== null &&
    quantity > program.remaining_capacity
  ) {
    throw new Error("Not enough seats are available.");
  }
}

function calculateTripPrice(program, quantity) {
  const unitAmount = toMoney(program.price_per_person);

  if (unitAmount <= 0) {
    throw new Error("Trip regular price is not configured.");
  }

  const totalAmount = unitAmount * quantity;

  return {
    pricing_source: "price_per_person",
    pricing_model: "price_per_person",
    pricing_tier_id: null,
    pricing_tier_label: null,
    price_type: "per_person",
    quantity,
    unit_amount: unitAmount,
    total_amount: Number(totalAmount.toFixed(2)),
  };
}

/* -------------------------------------------------------------------------- */
/* Public Routes                                                              */
/* -------------------------------------------------------------------------- */

router.get("/programs", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const rows = await listPrograms(conn, req.query);

    return res.json({
      ok: true,
      rows,
      items: rows,
    });
  } catch (err) {
    console.error("GET /trip/programs error:", err);

    return publicError(
      res,
      500,
      "Failed to load trips."
    );
  } finally {
    conn.release();
  }
});

router.get("/programs/:id", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const id = toId(req.params.id);

    if (!id) {
      return publicError(res, 400, "Invalid trip id.");
    }

    const program = await getProgram(conn, id, {
      publicOnly: true,
    });

    if (!program) {
      return publicError(res, 404, "Trip not found.");
    }

    return res.json({
      ok: true,
      program,
      item: program,
    });
  } catch (err) {
    console.error("GET /trip/programs/:id error:", err);

    return publicError(
      res,
      500,
      "Failed to load trip."
    );
  } finally {
    conn.release();
  }
});

router.get("/programs/:id/pricing", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const id = toId(req.params.id);

    if (!id) {
      return publicError(res, 400, "Invalid trip id.");
    }

    const program = await getProgram(conn, id, {
      publicOnly: true,
    });

    if (!program) {
      return publicError(res, 404, "Trip not found.");
    }

    return res.json({
      ok: true,
      program_id: id,
      pricing_model: "price_per_person",
      price_per_person: program.price_per_person,
      base_price_per_person: program.price_per_person,
      pricing_tiers: [],
    });
  } catch (err) {
    console.error("GET /trip/programs/:id/pricing error:", err);

    return publicError(
      res,
      500,
      "Failed to load trip pricing."
    );
  } finally {
    conn.release();
  }
});

router.post("/quote", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const programId = toId(
      req.body.news_event_id ||
        req.body.program_id ||
        req.body.event_id
    );

    if (!programId) {
      return publicError(res, 400, "Trip id is required.");
    }

    const rawParticipants = parseParticipants(req.body.participants);

    const quantity = toQuantity(
      req.body.quantity || rawParticipants.length,
      1
    );

    const participants = validateParticipants(
      rawParticipants,
      quantity
    );

    const program = await getProgram(conn, programId, {
      publicOnly: true,
    });

    if (!program) {
      return publicError(res, 404, "Trip not found.");
    }

    await validateCapacity(program, quantity);

    const pricing = calculateTripPrice(program, quantity);

    return res.json({
      ok: true,
      program,
      quantity,
      participants,
      pricing,
      total_amount: pricing.total_amount,
    });
  } catch (err) {
    console.error("POST /trip/quote error:", err);

    return publicError(
      res,
      400,
      err.message || "Unable to calculate trip registration."
    );
  } finally {
    conn.release();
  }
});

/* -------------------------------------------------------------------------- */
/* Admin Routes                                                               */
/* -------------------------------------------------------------------------- */

router.get(
  "/admin/programs",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const rows = await listPrograms(
        conn,
        {
          ...req.query,
          include_inactive:
            req.query.include_inactive ?? "1",
          include_unpublished:
            req.query.include_unpublished ?? "1",
          include_past:
            req.query.include_past ?? "1",
        },
        {
          admin: true,
        }
      );

      return res.json({
        ok: true,
        rows,
        items: rows,
      });
    } catch (err) {
      console.error("GET /trip/admin/programs error:", err);

      return publicError(
        res,
        500,
        "Failed to load admin trip programs."
      );
    } finally {
      conn.release();
    }
  }
);

router.get(
  "/admin/programs/:id/pricing",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const id = toId(req.params.id);

      if (!id) {
        return publicError(res, 400, "Invalid trip id.");
      }

      const program = await getProgram(conn, id, {
        publicOnly: false,
      });

      if (!program) {
        return publicError(res, 404, "Trip not found.");
      }

      return res.json({
        ok: true,
        program,
        pricing_model: "price_per_person",
        price_per_person: program.price_per_person,
        pricing_tiers: [],
      });
    } catch (err) {
      console.error("GET /trip/admin/programs/:id/pricing error:", err);

      return publicError(
        res,
        500,
        "Failed to load trip pricing."
      );
    } finally {
      conn.release();
    }
  }
);

router.put(
  "/admin/programs/:id/pricing",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const id = toId(req.params.id);

      if (!id) {
        return publicError(res, 400, "Invalid trip id.");
      }

      if (
        Array.isArray(req.body.pricing_tiers) &&
        req.body.pricing_tiers.some((tier) => toMoney(tier?.amount) > 0)
      ) {
        return publicError(
          res,
          400,
          "Trip programs use regular price per person. Tier pricing is only for school programs."
        );
      }

      const pricePerPerson = toMoney(
        req.body.price_per_person ||
          req.body.price ||
          req.body.amount
      );

      if (pricePerPerson <= 0) {
        return publicError(
          res,
          400,
          "Trip regular price per person must be greater than zero."
        );
      }

      await conn.query(
        `
        UPDATE ${EVENTS_TABLE}
        SET
          price_per_person = ?,
          updated_at = NOW()
        WHERE id = ?
          AND category = ?
        `,
        [
          pricePerPerson,
          id,
          TRIP_CATEGORY,
        ]
      );

      const program = await getProgram(conn, id, {
        publicOnly: false,
      });

      return res.json({
        ok: true,
        program,
        pricing_model: "price_per_person",
        price_per_person: program.price_per_person,
        pricing_tiers: [],
      });
    } catch (err) {
      console.error("PUT /trip/admin/programs/:id/pricing error:", err);

      return publicError(
        res,
        500,
        "Failed to update trip pricing."
      );
    } finally {
      conn.release();
    }
  }
);

router.patch(
  "/admin/programs/:id/registration",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const id = toId(req.params.id);

      if (!id) {
        return publicError(res, 400, "Invalid trip id.");
      }

      const payload = {};

      if (req.body.registration_enabled !== undefined) {
        payload.registration_enabled = toBool(
          req.body.registration_enabled
        )
          ? 1
          : 0;
      }

      if (req.body.capacity !== undefined) {
        const capacity = Number(req.body.capacity);

        payload.capacity =
          Number.isInteger(capacity) && capacity > 0
            ? capacity
            : null;
      }

      if (req.body.price_per_person !== undefined) {
        payload.price_per_person = toMoney(
          req.body.price_per_person
        );
      }

      if (req.body.registration_notes !== undefined) {
        payload.registration_notes =
          clean(req.body.registration_notes, 2000) || null;
      }

      if (!Object.keys(payload).length) {
        return publicError(
          res,
          400,
          "No registration fields were provided."
        );
      }

      payload.updated_at = new Date();

      await conn.query(
        `
        UPDATE ${EVENTS_TABLE}
        SET ?
        WHERE id = ?
          AND category = ?
        `,
        [
          payload,
          id,
          TRIP_CATEGORY,
        ]
      );

      const program = await getProgram(conn, id, {
        publicOnly: false,
      });

      return res.json({
        ok: true,
        program,
      });
    } catch (err) {
      console.error("PATCH /trip/admin/programs/:id/registration error:", err);

      return publicError(
        res,
        500,
        "Failed to update trip registration settings."
      );
    } finally {
      conn.release();
    }
  }
);

module.exports = router;