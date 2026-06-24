// backend/routes/newsEvents.js
"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

const TABLE = "tbl_news_events";
const PRICE_TABLE = "tbl_program_pricing_tiers";

const ALLOWED_CATEGORIES = [
  "holiday",
  "trip",
  "kids",
  "news",
];

const PROGRAM_CATEGORIES = new Set([
  "trip",
  "kids",
]);

const ADMIN_ROLES = [
  "admin",
  "super_admin",
  "finance",
  "instructor",
];

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];

const MIME_WHITELIST = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const UPLOAD_DIR = path.join(
  __dirname,
  "..",
  "uploads",
  "news-events"
);

fs.mkdirSync(UPLOAD_DIR, {
  recursive: true,
});

const SELECT_FIELDS = `
  id,
  category,
  title,
  subtitle,
  summary,
  body_html,
  start_date,
  end_date,
  time_text,
  location,
  audience,
  flyer_url,
  pdf_url,
  pdf_title,
  holiday_color,
  is_published,
  related_program_id,
  registration_enabled,
  price_per_person,
  capacity,
  registration_notes,
  created_at,
  updated_at
`;

/* -------------------------------------------------------------------------- */
/* Upload                                                                     */
/* -------------------------------------------------------------------------- */

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (_req, file, cb) => {
    const ext = path
      .extname(file.originalname || "")
      .toLowerCase();

    const safeExt = IMAGE_EXTENSIONS.includes(ext)
      ? ext
      : ".jpg";

    cb(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path
      .extname(file.originalname || "")
      .toLowerCase();

    if (
      MIME_WHITELIST.includes(file.mimetype) &&
      IMAGE_EXTENSIONS.includes(ext)
    ) {
      cb(null, true);
      return;
    }

    cb(
      new Error(
        "Only jpg, jpeg, png, and webp image files are allowed."
      )
    );
  },
});

function uploadMiddleware(req, res, next) {
  upload.single("flyer_image")(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        ok: false,
        error:
          error.message ||
          "Image upload failed.",
      });
    }

    return next();
  });
}

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
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "boolean") return value;

  return [
    "1",
    "true",
    "yes",
    "y",
    "on",
  ].includes(
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

function toCapacity(value) {
  if (
    value === undefined ||
    value === null ||
    clean(value) === ""
  ) {
    return null;
  }

  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) {
    return null;
  }

  return n;
}

function normalizeDate(value) {
  const text = clean(value, 40);

  if (!text) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  return text;
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

function isProgramCategory(category) {
  return PROGRAM_CATEGORIES.has(category);
}

function isValidHexColor(value) {
  const text = clean(value);

  if (!text) return true;

  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(text);
}

function isValidImageUrl(value) {
  const text = clean(value);

  if (!text) return true;

  const lower = text.toLowerCase();

  return IMAGE_EXTENSIONS.some((ext) =>
    lower.includes(ext)
  );
}

function validateDateOrder(startDate, endDate) {
  if (!startDate || !endDate) return "";

  if (endDate < startDate) {
    return "End date cannot be earlier than start date.";
  }

  return "";
}

function validateLength(label, value, maxLength) {
  if (clean(value).length > maxLength) {
    return `${label} is too long.`;
  }

  return "";
}

function buildAbsoluteUploadUrl(req, fileName) {
  return `${req.protocol}://${req.get("host")}/uploads/news-events/${fileName}`;
}

function getRelativeUploadPathFromUrl(urlValue) {
  const value = clean(urlValue);

  if (!value) return null;

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname || "";

    if (pathname.startsWith("/uploads/news-events/")) {
      return path.join(__dirname, "..", pathname);
    }

    return null;
  } catch {
    if (value.startsWith("/uploads/news-events/")) {
      return path.join(__dirname, "..", value);
    }

    return null;
  }
}

function removeUploadedFileIfExists(urlValue) {
  const filePath = getRelativeUploadPathFromUrl(urlValue);

  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(
      "Failed to remove uploaded file:",
      error
    );
  }
}

function parseJsonArray(value) {
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






function normalizeTier(raw = {}, index = 0) {
  const minQuantity = Number(
    raw.min_quantity ??
      raw.minQuantity ??
      raw.quantity ??
      1
  );

  const maxQuantity = Number(
    raw.max_quantity ??
      raw.maxQuantity ??
      raw.quantity ??
      minQuantity
  );

  if (!Number.isInteger(minQuantity) || minQuantity <= 0) {
    throw new Error("Pricing tier minimum quantity must be a positive whole number.");
  }

  if (!Number.isInteger(maxQuantity) || maxQuantity < minQuantity) {
    throw new Error("Pricing tier maximum quantity must be greater than or equal to minimum quantity.");
  }

  const amount = toMoney(raw.amount);

  if (amount <= 0) {
    throw new Error("Pricing tier amount must be greater than zero.");
  }

  const priceType = clean(raw.price_type || raw.priceType, 30).toLowerCase() || "total";

  if (!["total", "per_person"].includes(priceType)) {
    throw new Error("Pricing tier price_type must be total or per_person.");
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



function validateTierRanges(tiers = []) {
  const active = tiers
    .filter((tier) => Number(tier.is_active) === 1)
    .sort((a, b) => a.min_quantity - b.min_quantity);

  for (let i = 1; i < active.length; i += 1) {
    const previous = active[i - 1];
    const current = active[i];

    if (current.min_quantity <= previous.max_quantity) {
      throw new Error("School pricing tiers cannot overlap.");
    }
  }
}



function normalizeTierRow(row = {}) {
  return {
    id: row.id,
    tier_label: row.tier_label,
    min_quantity: Number(row.min_quantity || 0),
    max_quantity: Number(row.max_quantity || 0),
    amount: Number(row.amount || 0),
    price_type: row.price_type || "total",
    is_active: Number(row.is_active || 0) === 1,
    sort_order: Number(row.sort_order || 0),
  };
}

async function pricingTableExists(conn = pool) {
  const [rows] = await conn.query(
    "SHOW TABLES LIKE ?",
    [PRICE_TABLE]
  );

  return rows.length > 0;
}

async function getPricingTiers(
  conn,
  eventId,
  options = {}
) {
  if (!(await pricingTableExists(conn))) {
    return [];
  }

  const includeInactive =
    Boolean(options.includeInactive);

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
    ${includeInactive ? "" : "AND is_active = 1"}
    ORDER BY
      sort_order ASC,
      min_quantity ASC,
      max_quantity ASC,
      id ASC
    `,
    [eventId]
  );

  return rows.map(normalizeTierRow);
}




async function syncPricingTiers(conn, eventId, category, rawTiers, userId) {
  if (!(await pricingTableExists(conn))) {
    throw new Error("tbl_program_pricing_tiers does not exist. Run the pricing tiers migration first.");
  }

  if (category !== "kids") {
    await conn.query(
      `
      UPDATE ${PRICE_TABLE}
      SET is_active = 0, updated_by = ?, updated_at = NOW()
      WHERE news_event_id = ?
      `,
      [userId, eventId]
    );

    return {
      skipped: true,
      reason: "Tier pricing is only used for school programs.",
    };
  }

  const tiers = parseJsonArray(rawTiers)
    .filter((tier) => {
      return (
        clean(tier?.amount) ||
        clean(tier?.min_quantity) ||
        clean(tier?.quantity)
      );
    })
    .map(normalizeTier);

  validateTierRanges(tiers);

  await conn.query(
    `
    UPDATE ${PRICE_TABLE}
    SET is_active = 0, updated_by = ?, updated_at = NOW()
    WHERE news_event_id = ?
    `,
    [userId, eventId]
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
      ON DUPLICATE KEY UPDATE
        category = VALUES(category),
        tier_label = VALUES(tier_label),
        amount = VALUES(amount),
        price_type = VALUES(price_type),
        is_active = VALUES(is_active),
        sort_order = VALUES(sort_order),
        updated_by = VALUES(updated_by),
        updated_at = NOW()
      `,
      [
        eventId,
        category,
        tier.tier_label,
        tier.min_quantity,
        tier.max_quantity,
        tier.amount,
        tier.price_type,
        tier.is_active,
        tier.sort_order,
        userId,
        userId,
      ]
    );
  }

  return {
    skipped: false,
    count: tiers.length,
  };
}


/* -------------------------------------------------------------------------- */
/* Payload / validation                                                       */
/* -------------------------------------------------------------------------- */

function validatePayload(body, uploadedFilePresent = false) {
  const category = clean(body.category || "news", 40);
  const title = clean(body.title, 200);
  const summary = clean(body.summary, 20000);
  const timeText = clean(body.time_text, 120);
  const location = clean(body.location, 200);
  const audience = clean(body.audience, 255);
  const flyerUrl = clean(body.flyer_url, 500);
  const holidayColor = clean(body.holiday_color, 20);

  const startDate = normalizeDate(body.start_date);
  const endDate = normalizeDate(body.end_date);

  const isSchool = category === "kids";
  const isTrip = category === "trip";
  const isProgram = isSchool || isTrip;
  const registrationEnabled = toBool(body.registration_enabled, false);
  const pricePerPerson = toMoney(body.price_per_person);
  const rawTiers = parseJsonArray(body.pricing_tiers || body.tiers);

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return "Invalid category. Allowed categories are holiday, trip, kids, and news.";
  }

  if (!title) return "Title is required.";

  if (body.start_date && !startDate) return "Start date must be in YYYY-MM-DD format.";
  if (body.end_date && !endDate) return "End date must be in YYYY-MM-DD format.";

  const dateOrderError = validateDateOrder(startDate, endDate);
  if (dateOrderError) return dateOrderError;

  if (isProgram && !startDate) return "Program requires a start date.";
  if (isProgram && !location) return "Program requires a location.";

  if (isSchool && registrationEnabled) {
    const hasTiers = rawTiers.some((tier) => toMoney(tier?.amount) > 0);

    if (!hasTiers && pricePerPerson <= 0) {
      return "School program requires at least one pricing tier or a fallback price.";
    }

    try {
      const normalized = rawTiers
        .filter((tier) => toMoney(tier?.amount) > 0)
        .map(normalizeTier);

      validateTierRanges(normalized);
    } catch (error) {
      return error.message;
    }
  }

  if (isTrip && registrationEnabled && pricePerPerson <= 0) {
    return "Trip program requires a regular price per person.";
  }

  if (isTrip && rawTiers.some((tier) => toMoney(tier?.amount) > 0)) {
    return "Trip programs use regular price per person. Tier pricing is only for school programs.";
  }

  if (
    isProgram &&
    body.capacity !== undefined &&
    body.capacity !== null &&
    clean(body.capacity) !== "" &&
    !toCapacity(body.capacity)
  ) {
    return "Capacity must be a positive whole number.";
  }

  if (category === "holiday" && !startDate) return "Holiday requires a start date.";
  if (category === "holiday" && !isValidHexColor(holidayColor)) {
    return "Holiday color must be a valid hex color like #4A75E6.";
  }

  if (!uploadedFilePresent && !isValidImageUrl(flyerUrl)) {
    return "Flyer URL must point to a jpg, jpeg, png, or webp image.";
  }

  return (
    validateLength("Title", title, 200) ||
    validateLength("Summary", summary, 20000) ||
    validateLength("Time text", timeText, 120) ||
    validateLength("Location", location, 200) ||
    validateLength("Audience", audience, 255) ||
    validateLength("Flyer URL", flyerUrl, 500) ||
    validateLength("Holiday color", holidayColor, 20)
  );
}



function buildPayload(body, req, uploadedFileName = "") {
  const category = clean(body.category || "news", 40);
  const isProgram = isProgramCategory(category);

  const nextFlyerUrl = uploadedFileName
    ? buildAbsoluteUploadUrl(req, uploadedFileName)
    : clean(body.flyer_url, 500) || null;

  return {
    category,
    title: clean(body.title, 200),
    subtitle: clean(body.subtitle, 255) || null,
    summary: clean(body.summary, 20000) || null,
    body_html: clean(body.body_html, 50000) || null,
    start_date: normalizeDate(body.start_date),
    end_date: normalizeDate(body.end_date),
    time_text: clean(body.time_text, 120) || null,
    location: clean(body.location, 200) || null,
    audience: clean(body.audience, 255) || null,
    flyer_url: nextFlyerUrl,
    pdf_url: clean(body.pdf_url, 500) || null,
    pdf_title: clean(body.pdf_title, 255) || null,
    holiday_color: clean(body.holiday_color, 20) || null,
    is_published: toBool(body.is_published, true) ? 1 : 0,
    related_program_id: toId(body.related_program_id),

    registration_enabled:
      isProgram && toBool(body.registration_enabled, false)
        ? 1
        : 0,

    price_per_person:
      isProgram
        ? toMoney(body.price_per_person)
        : 0,

    capacity:
      isProgram
        ? toCapacity(body.capacity)
        : null,

    registration_notes:
      isProgram
        ? clean(body.registration_notes, 2000) || null
        : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Row formatting                                                             */
/* -------------------------------------------------------------------------- */

function normalizeRow(row) {
  if (!row) return row;

  const registeredQuantity =
    Number(row.registered_quantity || 0);

  const capacity =
    row.capacity === null ||
    row.capacity === undefined
      ? null
      : Number(row.capacity || 0);

  const remainingCapacity =
    capacity && capacity > 0
      ? Math.max(capacity - registeredQuantity, 0)
      : null;

  return {
    ...row,
    start_date: row.start_date
      ? new Date(row.start_date).toISOString().slice(0, 10)
      : null,
    end_date: row.end_date
      ? new Date(row.end_date).toISOString().slice(0, 10)
      : null,
    created_at: row.created_at
      ? new Date(row.created_at).toISOString()
      : null,
    updated_at: row.updated_at
      ? new Date(row.updated_at).toISOString()
      : null,
    is_published: Number(row.is_published || 0),
    registration_enabled:
      Number(row.registration_enabled || 0),
    price_per_person:
      Number(row.price_per_person || 0),
    capacity,
    registered_quantity: registeredQuantity,
    remaining_capacity: remainingCapacity,
    sold_out:
      remainingCapacity !== null &&
      remainingCapacity <= 0,
  };
}

async function attachPricing(conn, rows, options = {}) {
  const output = [];

  for (const row of rows) {
    const normalized = normalizeRow(row);

    normalized.pricing_tiers =
      normalized.category === "kids"
        ? await getPricingTiers(conn, normalized.id, options)
        : [];

    output.push(normalized);
  }

  return output;
}
/* -------------------------------------------------------------------------- */
/* Query builders                                                             */
/* -------------------------------------------------------------------------- */

function buildWhere(query, options = {}) {
  const conditions = [];
  const params = [];

  const category = clean(query.category, 40);

  if (category && category !== "all") {
    conditions.push("e.category = ?");
    params.push(category);
  }

  if (options.publicOnly) {
    conditions.push("e.is_published = 1");
  } else if (
    query.published === "1" ||
    query.published === 1
  ) {
    conditions.push("e.is_published = 1");
  } else if (
    query.published === "0" ||
    query.published === 0
  ) {
    conditions.push("e.is_published = 0");
  }

  if (query.registration_enabled !== undefined) {
    conditions.push("e.registration_enabled = ?");
    params.push(toBool(query.registration_enabled) ? 1 : 0);
  }

  if (query.registerable === "1") {
    conditions.push("e.category IN ('kids', 'trip')");
    conditions.push("e.registration_enabled = 1");
  }

  if (query.upcoming === "1") {
    conditions.push(
      "(e.start_date IS NULL OR DATE(e.start_date) >= CURDATE())"
    );
  }

  const search = clean(query.search || query.q, 120);

  if (search) {
    const like = `%${search}%`;

    conditions.push(
      `
      (
        e.title LIKE ?
        OR e.subtitle LIKE ?
        OR e.summary LIKE ?
        OR e.body_html LIKE ?
        OR e.location LIKE ?
        OR e.audience LIKE ?
        OR e.time_text LIKE ?
      )
      `
    );

    params.push(
      like,
      like,
      like,
      like,
      like,
      like,
      like
    );
  }

  return {
    whereSql: conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "",
    params,
  };
}

function getPaging(query) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(
    100,
    Math.max(1, Number(query.limit || 10))
  );
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
  };
}

async function loadOne(conn, id) {
  const [rows] = await conn.query(
    `
    SELECT
      ${SELECT_FIELDS},

      COALESCE(
        (
          SELECT SUM(r.quantity)
          FROM tbl_event_program_registrations r
          WHERE r.news_event_id = e.id
            AND r.status IN ('pending', 'paid')
        ),
        0
      ) AS registered_quantity

    FROM ${TABLE} e
    WHERE e.id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* Admin list                                                                 */
/* -------------------------------------------------------------------------- */

router.get(
  "/admin/list",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const {
        page,
        limit,
        offset,
      } = getPaging(req.query);

      const {
        whereSql,
        params,
      } = buildWhere(req.query, {
        publicOnly: false,
      });

      const [[countRow]] = await conn.query(
        `
        SELECT COUNT(*) AS total
        FROM ${TABLE} e
        ${whereSql}
        `,
        params
      );

      const [rows] = await conn.query(
        `
        SELECT
          ${SELECT_FIELDS},

          COALESCE(
            (
              SELECT SUM(r.quantity)
              FROM tbl_event_program_registrations r
              WHERE r.news_event_id = e.id
                AND r.status IN ('pending', 'paid')
            ),
            0
          ) AS registered_quantity

        FROM ${TABLE} e
        ${whereSql}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT ?
        OFFSET ?
        `,
        [
          ...params,
          limit,
          offset,
        ]
      );

      const items = await attachPricing(conn, rows, {
        includeInactive: true,
      });

      return res.json({
        ok: true,
        rows: items,
        items,
        page,
        limit,
        total: Number(countRow?.total || 0),
        totalPages: Math.max(
          1,
          Math.ceil(Number(countRow?.total || 0) / limit)
        ),
      });
    } catch (error) {
      console.error("news events admin list error:", error);

      return publicError(
        res,
        500,
        "Failed to load admin news/events."
      );
    } finally {
      conn.release();
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Public list/detail                                                         */
/* -------------------------------------------------------------------------- */

router.get("/", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const {
      page,
      limit,
      offset,
    } = getPaging(req.query);

    const {
      whereSql,
      params,
    } = buildWhere(req.query, {
      publicOnly: true,
    });

    const [[countRow]] = await conn.query(
      `
      SELECT COUNT(*) AS total
      FROM ${TABLE} e
      ${whereSql}
      `,
      params
    );

    const [rows] = await conn.query(
      `
      SELECT
        ${SELECT_FIELDS},

        COALESCE(
          (
            SELECT SUM(r.quantity)
            FROM tbl_event_program_registrations r
            WHERE r.news_event_id = e.id
              AND r.status IN ('pending', 'paid')
          ),
          0
        ) AS registered_quantity

      FROM ${TABLE} e
      ${whereSql}
      ORDER BY
        CASE WHEN e.start_date IS NULL THEN 1 ELSE 0 END,
        e.start_date DESC,
        e.created_at DESC,
        e.id DESC
      LIMIT ?
      OFFSET ?
      `,
      [
        ...params,
        limit,
        offset,
      ]
    );

    const items = await attachPricing(conn, rows);

    return res.json({
      ok: true,
      rows: items,
      items,
      page,
      limit,
      total: Number(countRow?.total || 0),
      totalPages: Math.max(
        1,
        Math.ceil(Number(countRow?.total || 0) / limit)
      ),
    });
  } catch (error) {
    console.error("news events public list error:", error);

    return publicError(
      res,
      500,
      "Failed to load news and events."
    );
  } finally {
    conn.release();
  }
});

router.get("/:id", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const id = toId(req.params.id);

    if (!id) {
      return publicError(res, 400, "Invalid id.");
    }

    const row = await loadOne(conn, id);

    if (!row || Number(row.is_published || 0) !== 1) {
      return publicError(res, 404, "Item not found.");
    }

    const [item] = await attachPricing(conn, [row]);

    return res.json({
      ok: true,
      item,
    });
  } catch (error) {
    console.error("news events public detail error:", error);

    return publicError(
      res,
      500,
      "Failed to load item."
    );
  } finally {
    conn.release();
  }
});

/* -------------------------------------------------------------------------- */
/* Admin detail/create/update/delete                                          */
/* -------------------------------------------------------------------------- */

router.get(
  "/admin/:id",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const id = toId(req.params.id);

      if (!id) {
        return publicError(res, 400, "Invalid id.");
      }

      const row = await loadOne(conn, id);

      if (!row) {
        return publicError(res, 404, "Item not found.");
      }

      const [item] = await attachPricing(conn, [row], {
        includeInactive: true,
      });

      return res.json({
        ok: true,
        item,
      });
    } catch (error) {
      console.error("news events admin detail error:", error);

      return publicError(
        res,
        500,
        "Failed to load admin item."
      );
    } finally {
      conn.release();
    }
  }
);

router.post(
  "/admin",
  authRequired,
  requireRole(...ADMIN_ROLES),
  uploadMiddleware,
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const validationError = validatePayload(
        req.body,
        Boolean(req.file)
      );

      if (validationError) {
        if (req.file?.filename) {
          removeUploadedFileIfExists(
            buildAbsoluteUploadUrl(req, req.file.filename)
          );
        }

        return publicError(res, 400, validationError);
      }

      const payload = buildPayload(
        req.body,
        req,
        req.file?.filename || ""
      );

      payload.created_at = new Date();
      payload.updated_at = new Date();

      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO ${TABLE} SET ?`,
        payload
      );

      const eventId = result.insertId;

      const pricingResult = await syncPricingTiers(
        conn,
        eventId,
        payload.category,
        req.body.pricing_tiers,
        actorId(req)
      );

      await conn.commit();

      const row = await loadOne(conn, eventId);
      const [item] = await attachPricing(conn, [row], {
        includeInactive: true,
      });

      return res.status(201).json({
        ok: true,
        item,
        pricing_result: pricingResult,
      });
    } catch (error) {
      await conn.rollback();

      if (req.file?.filename) {
        removeUploadedFileIfExists(
          buildAbsoluteUploadUrl(req, req.file.filename)
        );
      }

      console.error("news events admin create error:", error);

      return publicError(
        res,
        500,
        error.message || "Failed to create item."
      );
    } finally {
      conn.release();
    }
  }
);

router.put(
  "/admin/:id",
  authRequired,
  requireRole(...ADMIN_ROLES),
  uploadMiddleware,
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const id = toId(req.params.id);

      if (!id) {
        if (req.file?.filename) {
          removeUploadedFileIfExists(
            buildAbsoluteUploadUrl(req, req.file.filename)
          );
        }

        return publicError(res, 400, "Invalid id.");
      }

      const [existingRows] = await conn.query(
        `SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`,
        [id]
      );

      if (!existingRows.length) {
        if (req.file?.filename) {
          removeUploadedFileIfExists(
            buildAbsoluteUploadUrl(req, req.file.filename)
          );
        }

        return publicError(res, 404, "Item not found.");
      }

      const validationError = validatePayload(
        req.body,
        Boolean(req.file)
      );

      if (validationError) {
        if (req.file?.filename) {
          removeUploadedFileIfExists(
            buildAbsoluteUploadUrl(req, req.file.filename)
          );
        }

        return publicError(res, 400, validationError);
      }

      const existing = existingRows[0];
      const removeFlyer = clean(req.body.remove_flyer) === "1";

      let nextFlyerUrl = existing.flyer_url || null;

      if (req.file?.filename) {
        nextFlyerUrl = buildAbsoluteUploadUrl(req, req.file.filename);
      } else if (removeFlyer) {
        nextFlyerUrl = null;
      } else if (clean(req.body.flyer_url)) {
        nextFlyerUrl = clean(req.body.flyer_url, 500);
      }

      const payload = buildPayload(
        req.body,
        req,
        req.file?.filename || ""
      );

      payload.flyer_url = nextFlyerUrl;
      payload.updated_at = new Date();

      await conn.beginTransaction();

      await conn.query(
        `UPDATE ${TABLE} SET ? WHERE id = ?`,
        [
          payload,
          id,
        ]
      );

      const pricingResult = await syncPricingTiers(
        conn,
        id,
        payload.category,
        req.body.pricing_tiers,
        actorId(req)
      );

      await conn.commit();

      if (
        (req.file?.filename || removeFlyer) &&
        existing.flyer_url &&
        existing.flyer_url !== nextFlyerUrl
      ) {
        removeUploadedFileIfExists(existing.flyer_url);
      }

      const row = await loadOne(conn, id);
      const [item] = await attachPricing(conn, [row], {
        includeInactive: true,
      });

      return res.json({
        ok: true,
        item,
        pricing_result: pricingResult,
      });
    } catch (error) {
      await conn.rollback();

      if (req.file?.filename) {
        removeUploadedFileIfExists(
          buildAbsoluteUploadUrl(req, req.file.filename)
        );
      }

      console.error("news events admin update error:", error);

      return publicError(
        res,
        500,
        error.message || "Failed to update item."
      );
    } finally {
      conn.release();
    }
  }
);

router.delete(
  "/admin/:id",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const id = toId(req.params.id);

      if (!id) {
        return publicError(res, 400, "Invalid id.");
      }

      const [existingRows] = await conn.query(
        `SELECT * FROM ${TABLE} WHERE id = ? LIMIT 1`,
        [id]
      );

      if (!existingRows.length) {
        return publicError(res, 404, "Item not found.");
      }

      const existing = existingRows[0];

      await conn.beginTransaction();

      if (await pricingTableExists(conn)) {
        await conn.query(
          `DELETE FROM ${PRICE_TABLE} WHERE news_event_id = ?`,
          [id]
        );
      }

      const [result] = await conn.query(
        `DELETE FROM ${TABLE} WHERE id = ?`,
        [id]
      );

      await conn.commit();

      if (!result.affectedRows) {
        return publicError(res, 404, "Item not found.");
      }

      if (existing.flyer_url) {
        removeUploadedFileIfExists(existing.flyer_url);
      }

      return res.json({
        ok: true,
      });
    } catch (error) {
      await conn.rollback();

      console.error("news events admin delete error:", error);

      return publicError(
        res,
        500,
        "Failed to delete item."
      );
    } finally {
      conn.release();
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Admin program pricing / registration controls                              */
/* -------------------------------------------------------------------------- */

router.put(
  "/admin/:id/pricing",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const id = toId(req.params.id);

      if (!id) {
        return publicError(res, 400, "Invalid id.");
      }

      const row = await loadOne(conn, id);

      if (!row) {
        return publicError(res, 404, "Program not found.");
      }

      if (!isProgramCategory(row.category)) {
        return publicError(
          res,
          400,
          "Pricing tiers are only available for school and trip programs."
        );
      }

      await conn.beginTransaction();

      const pricingResult = await syncPricingTiers(
        conn,
        id,
        row.category,
        req.body.pricing_tiers || req.body.tiers,
        actorId(req)
      );

      if (req.body.price_per_person !== undefined) {
        await conn.query(
          `
          UPDATE ${TABLE}
          SET
            price_per_person = ?,
            updated_at = NOW()
          WHERE id = ?
          `,
          [
            toMoney(req.body.price_per_person),
            id,
          ]
        );
      }

      await conn.commit();

      const updated = await loadOne(conn, id);
      const [item] = await attachPricing(conn, [updated], {
        includeInactive: true,
      });

      return res.json({
        ok: true,
        item,
        pricing_result: pricingResult,
      });
    } catch (error) {
      await conn.rollback();

      console.error("news events admin pricing error:", error);

      return publicError(
        res,
        500,
        error.message || "Failed to update pricing."
      );
    } finally {
      conn.release();
    }
  }
);

router.patch(
  "/admin/:id/registration",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    try {
      const id = toId(req.params.id);

      if (!id) {
        return publicError(res, 400, "Invalid id.");
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
        payload.capacity = toCapacity(req.body.capacity);
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

      await pool.query(
        `
        UPDATE ${TABLE}
        SET ?
        WHERE id = ?
          AND category IN ('kids', 'trip')
        `,
        [
          payload,
          id,
        ]
      );

      const conn = await pool.getConnection();

      try {
        const row = await loadOne(conn, id);
        const [item] = await attachPricing(conn, [row], {
          includeInactive: true,
        });

        return res.json({
          ok: true,
          item,
        });
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error("news events admin registration error:", error);

      return publicError(
        res,
        500,
        "Failed to update registration settings."
      );
    }
  }
);

router.patch(
  "/admin/:id/publish",
  authRequired,
  requireRole(...ADMIN_ROLES),
  async (req, res) => {
    const conn = await pool.getConnection();

    try {
      const id = toId(req.params.id);

      if (!id) {
        return publicError(res, 400, "Invalid id.");
      }

      await conn.query(
        `
        UPDATE ${TABLE}
        SET
          is_published = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          toBool(req.body.is_published, true) ? 1 : 0,
          id,
        ]
      );

      const row = await loadOne(conn, id);
      const [item] = await attachPricing(conn, [row], {
        includeInactive: true,
      });

      return res.json({
        ok: true,
        item,
      });
    } catch (error) {
      console.error("news events publish error:", error);

      return publicError(
        res,
        500,
        "Failed to update publish status."
      );
    } finally {
      conn.release();
    }
  }
);

module.exports = router;