// backend/routes/school.js
"use strict";

const express = require("express");
const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

const SCHOOL_CATEGORY = "kids";
const EVENTS_TABLE = "tbl_news_events";
const REG_TABLE = "tbl_event_program_registrations";
const PRICE_TABLE = "tbl_program_pricing_tiers";

const ADMIN_ROLES = [
  "admin",
  "super_admin",
  "finance",
  "instructor",
];

let pricingTableExistsCache = null;

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

function actorId(req) {
  return (
    req.user?.id ||
    req.user?.user_id ||
    null
  );
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

function normalizeStudent(raw = {}, index = 0) {
  const firstName = clean(raw.first_name || raw.firstName, 120);
  const lastName = clean(raw.last_name || raw.lastName, 120);

  const studentName =
    clean(
      raw.student_name ||
        raw.studentName ||
        raw.full_name ||
        raw.fullName ||
        `${firstName} ${lastName}`,
      180
    ) || null;

  return {
    student_name: studentName,
    full_name: studentName,
    first_name: firstName || null,
    last_name: lastName || null,
    grade: clean(raw.grade, 80) || null,
    age:
      raw.age !== undefined &&
      raw.age !== null &&
      raw.age !== ""
        ? Number(raw.age)
        : null,
    date_of_birth:
      clean(raw.date_of_birth || raw.dob, 40) || null,
    allergies: clean(raw.allergies, 1000) || null,
    medical_notes:
      clean(raw.medical_notes || raw.medicalNotes, 1000) || null,
    emergency_contact_name:
      clean(raw.emergency_contact_name || raw.emergencyContactName, 180) ||
      null,
    emergency_contact_phone:
      clean(raw.emergency_contact_phone || raw.emergencyContactPhone, 80) ||
      null,
    notes: clean(raw.notes, 1000) || null,
    sort_order: index + 1,
  };
}

function validateStudents(participants, quantity) {
  if (!Array.isArray(participants) || !participants.length) {
    throw new Error(
      "At least one student must be added to the school registration form."
    );
  }

  if (participants.length !== quantity) {
    throw new Error(
      "Student count must match the selected quantity."
    );
  }

  const students = participants.map(normalizeStudent);

  for (const student of students) {
    if (!student.student_name) {
      throw new Error("Each student must have a name.");
    }
  }

  return students;
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

  const fallbackPrice = Number(row.price_per_person || 0);

  return {
    id: row.id,
    news_event_id: row.id,

    category: "school",
    raw_category: SCHOOL_CATEGORY,
    public_category: "school",

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

    price_per_person: fallbackPrice,
    fallback_price_per_student: fallbackPrice,
    price: fallbackPrice,
    amount: fallbackPrice,

    pricing_model: "tier_or_fallback",

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
/* Pricing Tiers                                                              */
/* -------------------------------------------------------------------------- */

async function hasPricingTable(conn = pool) {
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

async function requirePricingTable(conn) {
  const exists = await hasPricingTable(conn);

  if (!exists) {
    throw new Error(
      "tbl_program_pricing_tiers does not exist. Run the program pricing schema migration first."
    );
  }
}

function normalizeTier(raw = {}, index = 0) {
  const minQuantity = toQuantity(
    raw.min_quantity ||
      raw.minQuantity ||
      raw.quantity,
    1
  );

  const maxQuantity = toQuantity(
    raw.max_quantity ||
      raw.maxQuantity ||
      raw.quantity ||
      minQuantity,
    minQuantity
  );

  if (maxQuantity < minQuantity) {
    throw new Error(
      "Pricing tier max quantity cannot be less than min quantity."
    );
  }

  const amount = toMoney(raw.amount);

  if (amount <= 0) {
    throw new Error(
      "Pricing tier amount must be greater than zero."
    );
  }

  const priceType =
    clean(raw.price_type || raw.priceType, 30).toLowerCase() ||
    "total";

  if (!["total", "per_person"].includes(priceType)) {
    throw new Error(
      "Pricing tier price_type must be total or per_person."
    );
  }

  return {
    tier_label:
      clean(raw.tier_label || raw.label, 120) ||
      (minQuantity === maxQuantity
        ? `${minQuantity} Student${minQuantity === 1 ? "" : "s"}`
        : `${minQuantity}-${maxQuantity} Students`),
    min_quantity: minQuantity,
    max_quantity: maxQuantity,
    amount,
    price_type: priceType,
    is_active: toBool(raw.is_active, true) ? 1 : 0,
    sort_order: Number(raw.sort_order ?? index),
  };
}

function normalizeTierRow(row = {}) {
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

function validateTierRanges(tiers = []) {
  const active = tiers
    .filter((tier) => Number(tier.is_active) === 1)
    .sort((a, b) => {
      if (a.min_quantity !== b.min_quantity) {
        return a.min_quantity - b.min_quantity;
      }

      return a.max_quantity - b.max_quantity;
    });

  for (let i = 1; i < active.length; i += 1) {
    const previous = active[i - 1];
    const current = active[i];

    if (current.min_quantity <= previous.max_quantity) {
      throw new Error("School pricing tiers cannot overlap.");
    }
  }
}

async function getPricingTiers(conn, programId, options = {}) {
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
      programId,
      SCHOOL_CATEGORY,
    ]
  );

  return rows.map(normalizeTierRow);
}

function calculateSchoolPrice(program, tiers, quantity) {
  const activeTiers = tiers
    .filter((tier) => tier.is_active !== false)
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
    };
  }

  if (activeTiers.length) {
    throw new Error(
      "School pricing is not configured for the selected number of students."
    );
  }

  const basePrice = toMoney(program.price_per_person);

  if (basePrice <= 0) {
    throw new Error(
      "School program pricing is not configured."
    );
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
    [
      id,
      SCHOOL_CATEGORY,
    ]
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

  const params = [SCHOOL_CATEGORY];

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

async function attachPricing(conn, rows, options = {}) {
  const output = [];

  for (const row of rows) {
    const pricingTiers = await getPricingTiers(
      conn,
      row.id,
      options
    );

    output.push({
      ...row,
      pricing_tiers: pricingTiers,
      has_pricing_tiers:
        pricingTiers.some((tier) => tier.is_active !== false),
    });
  }

  return output;
}

async function validateCapacity(program, quantity) {
  if (!program) {
    throw new Error("School program not found.");
  }

  if (!program.registration_enabled || !program.is_published) {
    throw new Error("School registration is not open.");
  }

  if (
    program.remaining_capacity !== null &&
    quantity > program.remaining_capacity
  ) {
    throw new Error("Not enough seats are available.");
  }
}

/* -------------------------------------------------------------------------- */
/* Public Routes                                                              */
/* -------------------------------------------------------------------------- */

router.get("/programs", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const rows = await listPrograms(conn, req.query);
    const items = await attachPricing(conn, rows);

    return res.json({
      ok: true,
      rows: items,
      items,
    });
  } catch (err) {
    console.error("GET /school/programs error:", err);

    return publicError(
      res,
      500,
      "Failed to load school programs."
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
      return publicError(res, 400, "Invalid school program id.");
    }

    const program = await getProgram(conn, id, {
      publicOnly: true,
    });

    if (!program) {
      return publicError(res, 404, "School program not found.");
    }

    const [item] = await attachPricing(conn, [program]);

    return res.json({
      ok: true,
      program: item,
      item,
    });
  } catch (err) {
    console.error("GET /school/programs/:id error:", err);

    return publicError(
      res,
      500,
      "Failed to load school program."
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
      return publicError(res, 400, "Invalid school program id.");
    }

    const program = await getProgram(conn, id, {
      publicOnly: true,
    });

    if (!program) {
      return publicError(res, 404, "School program not found.");
    }

    const pricingTiers = await getPricingTiers(conn, id);

    return res.json({
      ok: true,
      program_id: id,
      pricing_model: "tier_or_fallback",
      base_price_per_student: program.price_per_person,
      fallback_price_per_student: program.price_per_person,
      pricing_tiers: pricingTiers,
    });
  } catch (err) {
    console.error("GET /school/programs/:id/pricing error:", err);

    return publicError(
      res,
      500,
      "Failed to load school pricing."
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
      return publicError(res, 400, "School program id is required.");
    }

    const rawParticipants = parseParticipants(
      req.body.students ||
        req.body.participants
    );

    const quantity = toQuantity(
      req.body.quantity || rawParticipants.length,
      1
    );

    const students = validateStudents(
      rawParticipants,
      quantity
    );

    const program = await getProgram(conn, programId, {
      publicOnly: true,
    });

    if (!program) {
      return publicError(res, 404, "School program not found.");
    }

    await validateCapacity(program, quantity);

    const tiers = await getPricingTiers(conn, programId);
    const pricing = calculateSchoolPrice(program, tiers, quantity);

    return res.json({
      ok: true,
      program: {
        ...program,
        pricing_tiers: tiers,
      },
      quantity,
      students,
      participants: students,
      pricing,
      total_amount: pricing.total_amount,
    });
  } catch (err) {
    console.error("POST /school/quote error:", err);

    return publicError(
      res,
      400,
      err.message || "Unable to calculate school registration."
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

      const items = await attachPricing(conn, rows, {
        includeInactive: true,
      });

      return res.json({
        ok: true,
        rows: items,
        items,
      });
    } catch (err) {
      console.error("GET /school/admin/programs error:", err);

      return publicError(
        res,
        500,
        "Failed to load admin school programs."
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
        return publicError(res, 400, "Invalid school program id.");
      }

      await requirePricingTable(conn);

      const program = await getProgram(conn, id, {
        publicOnly: false,
      });

      if (!program) {
        return publicError(res, 404, "School program not found.");
      }

      const pricingTiers = await getPricingTiers(conn, id, {
        includeInactive: true,
      });

      return res.json({
        ok: true,
        program,
        pricing_model: "tier_or_fallback",
        fallback_price_per_student: program.price_per_person,
        pricing_tiers: pricingTiers,
      });
    } catch (err) {
      console.error("GET /school/admin/programs/:id/pricing error:", err);

      return publicError(
        res,
        500,
        err.message || "Failed to load school pricing."
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
        return publicError(res, 400, "Invalid school program id.");
      }

      const rawTiers = Array.isArray(req.body.tiers)
        ? req.body.tiers
        : Array.isArray(req.body.pricing_tiers)
          ? req.body.pricing_tiers
          : [];

      const fallbackPrice =
        req.body.price_per_person !== undefined
          ? toMoney(req.body.price_per_person)
          : req.body.fallback_price_per_student !== undefined
            ? toMoney(req.body.fallback_price_per_student)
            : null;

      if (!rawTiers.length && (!fallbackPrice || fallbackPrice <= 0)) {
        return publicError(
          res,
          400,
          "At least one school pricing tier or fallback price is required."
        );
      }

      const tiers = rawTiers
        .filter((tier) => {
          return (
            clean(tier?.amount) ||
            clean(tier?.min_quantity) ||
            clean(tier?.quantity)
          );
        })
        .map(normalizeTier);

      validateTierRanges(tiers);

      await requirePricingTable(conn);

      await conn.beginTransaction();

      const program = await getProgram(conn, id, {
        publicOnly: false,
      });

      if (!program) {
        await conn.rollback();

        return publicError(
          res,
          404,
          "School program not found."
        );
      }

      await conn.query(
        `
        UPDATE ${PRICE_TABLE}
        SET
          is_active = 0,
          updated_by = ?,
          updated_at = NOW()
        WHERE news_event_id = ?
          AND category = ?
        `,
        [
          actorId(req),
          id,
          SCHOOL_CATEGORY,
        ]
      );

      for (const tier of tiers) {
        await conn.query(
          `
          INSERT INTO ${PRICE_TABLE}
          (
            news_event_id,
            category,
            tier_label,
            min_quantity,
            max_quantity,
            amount,
            price_type,
            is_active,
            sort_order,
            created_by,
            updated_by,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          `,
          [
            id,
            SCHOOL_CATEGORY,
            tier.tier_label,
            tier.min_quantity,
            tier.max_quantity,
            tier.amount,
            tier.price_type,
            tier.is_active,
            tier.sort_order,
            actorId(req),
            actorId(req),
          ]
        );
      }

      if (fallbackPrice !== null) {
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
            fallbackPrice,
            id,
            SCHOOL_CATEGORY,
          ]
        );
      }

      await conn.commit();

      const updatedProgram = await getProgram(conn, id, {
        publicOnly: false,
      });

      const pricingTiers = await getPricingTiers(conn, id, {
        includeInactive: true,
      });

      return res.json({
        ok: true,
        program: {
          ...updatedProgram,
          pricing_tiers: pricingTiers,
        },
        pricing_model: "tier_or_fallback",
        fallback_price_per_student:
          updatedProgram.price_per_person,
        pricing_tiers: pricingTiers,
      });
    } catch (err) {
      await conn.rollback();

      console.error("PUT /school/admin/programs/:id/pricing error:", err);

      return publicError(
        res,
        500,
        err.message || "Failed to update school pricing."
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
        return publicError(res, 400, "Invalid school program id.");
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
          SCHOOL_CATEGORY,
        ]
      );

      const program = await getProgram(conn, id, {
        publicOnly: false,
      });

      const [item] = await attachPricing(conn, [program], {
        includeInactive: true,
      });

      return res.json({
        ok: true,
        program: item,
      });
    } catch (err) {
      console.error("PATCH /school/admin/programs/:id/registration error:", err);

      return publicError(
        res,
        500,
        "Failed to update school registration settings."
      );
    } finally {
      conn.release();
    }
  }
);

module.exports = router;