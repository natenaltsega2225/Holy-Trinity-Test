// backend/services/domains/programs/programRegistrationService.js
"use strict";

const pool = require("../../../db");

const REG_TABLE = "tbl_event_program_registrations";
const EVENT_TABLE = "tbl_news_events";
const PARTICIPANT_TABLE = "tbl_event_program_registration_participants";
const PAYMENT_TABLE = "tbl_finance_payments";
const RECEIPT_TABLE = "tbl_finance_receipts";
const INVOICE_TABLE = "tbl_finance_invoices";

const REGISTERABLE_CATEGORIES = ["kids", "trip"];

const columnCache = new Map();
const tableExistsCache = new Map();

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

function toQuantity(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, 500);
}

function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Number(n.toFixed(2));
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

function now() {
  return new Date();
}

function normalizeCategory(value) {
  const category = clean(value, 40).toLowerCase();

  if (category === "school") return "kids";
  if (category === "kid") return "kids";
  if (category === "kids") return "kids";
  if (category === "school_program") return "kids";
  if (category === "trip") return "trip";
  if (category === "trip_program") return "trip";

  return "";
}

function publicCategory(value) {
  const category = normalizeCategory(value);

  if (category === "kids") return "school";

  return category;
}

function normalizeRegistrationStatus(value) {
  const status = clean(value, 40).toLowerCase();

  if (["paid", "failed", "cancelled", "pending"].includes(status)) {
    return status;
  }

  return "pending";
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

function parseJsonObject(value) {
  if (!value) return {};

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && clean(value)) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function stringifyJson(value) {
  if (value === undefined || value === null) return null;

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function buildPaymentWorkflow(payload = {}) {
  const method = clean(
    payload.preferred_payment_method ||
      payload.payment_method ||
      payload.method,
    40
  ).toLowerCase();

  const isManual = ["cash", "check", "zelle"].includes(method);

  return {
    payment_method: method || null,
    preferred_payment_method: method || null,
    finance_followup_required:
      toBool(payload.finance_followup_required, false) ||
      isManual,
    create_invoice: toBool(payload.create_invoice, false),
    create_payment_link: toBool(payload.create_payment_link, false),
    send_invoice_email: toBool(payload.send_invoice_email, false),
    send_invoice_to_finance_admin:
      toBool(payload.send_invoice_to_finance_admin, false) ||
      isManual,
    create_receipt: toBool(payload.create_receipt, false),
    mark_paid: toBool(payload.mark_paid, false),
  };
}

/* -------------------------------------------------------------------------- */
/* Schema helpers                                                             */
/* -------------------------------------------------------------------------- */

async function tableExists(conn, tableName) {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName);
  }

  const [rows] = await conn.query(
    "SHOW TABLES LIKE ?",
    [tableName]
  );

  const exists = rows.length > 0;
  tableExistsCache.set(tableName, exists);

  return exists;
}

async function getColumns(conn, tableName) {
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName);
  }

  const [rows] = await conn.query(
    `SHOW COLUMNS FROM ${tableName}`
  );

  const columns = new Set(
    rows.map((row) => row.Field)
  );

  columnCache.set(tableName, columns);

  return columns;
}

async function insertExistingColumns(conn, tableName, payload) {
  const columns = await getColumns(conn, tableName);
  const row = {};

  for (const [key, value] of Object.entries(payload)) {
    if (columns.has(key)) {
      row[key] = value;
    }
  }

  if (!Object.keys(row).length) {
    throw new Error(
      `No valid columns found for insert into ${tableName}.`
    );
  }

  const [result] = await conn.query(
    `INSERT INTO ${tableName} SET ?`,
    row
  );

  return result.insertId;
}

async function updateExistingColumns(
  conn,
  tableName,
  payload,
  whereSql,
  params = []
) {
  const columns = await getColumns(conn, tableName);
  const row = {};

  for (const [key, value] of Object.entries(payload)) {
    if (columns.has(key)) {
      row[key] = value;
    }
  }

  if (!Object.keys(row).length) {
    return {
      affectedRows: 0,
      skipped: true,
    };
  }

  const [result] = await conn.query(
    `UPDATE ${tableName} SET ? WHERE ${whereSql}`,
    [row, ...params]
  );

  return result;
}

async function withConnection(dbOrConn, options, fn) {
  const useOwnConnection =
    dbOrConn &&
    typeof dbOrConn.getConnection === "function";

  const useTransaction = Boolean(options?.transaction);

  const conn = useOwnConnection
    ? await dbOrConn.getConnection()
    : dbOrConn;

  try {
    if (useOwnConnection && useTransaction) {
      await conn.beginTransaction();
    }

    const result = await fn(conn);

    if (useOwnConnection && useTransaction) {
      await conn.commit();
    }

    return result;
  } catch (err) {
    if (useOwnConnection && useTransaction) {
      await conn.rollback();
    }

    throw err;
  } finally {
    if (useOwnConnection && conn?.release) {
      conn.release();
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Participant normalization                                                   */
/* -------------------------------------------------------------------------- */

function normalizeParticipant(raw = {}, category, index = 0) {
  const firstName =
    clean(raw.first_name || raw.firstName, 120) || null;

  const lastName =
    clean(raw.last_name || raw.lastName, 120) || null;

  const fullName =
    clean(
      raw.full_name ||
        raw.fullName ||
        raw.student_name ||
        raw.studentName ||
        raw.participant_name ||
        raw.participantName ||
        `${firstName || ""} ${lastName || ""}`,
      180
    ) || null;

  return {
    participant_type:
      category === "kids" ? "student" : "participant",

    full_name: fullName,
    student_name: category === "kids" ? fullName : null,
    participant_name: category === "trip" ? fullName : null,

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

    email:
      clean(raw.email, 190).toLowerCase() || null,

    phone:
      clean(raw.phone, 80) || null,

    emergency_contact_name:
      clean(raw.emergency_contact_name || raw.emergencyContactName, 180) ||
      null,

    emergency_contact_phone:
      clean(raw.emergency_contact_phone || raw.emergencyContactPhone, 80) ||
      null,

    allergies:
      clean(raw.allergies, 1000) || null,

    medical_notes:
      clean(raw.medical_notes || raw.medicalNotes, 1000) || null,

    dietary_notes:
      clean(raw.dietary_notes || raw.dietaryNotes, 1000) || null,

    notes:
      clean(raw.notes, 1000) || null,

    sort_order:
      Number(raw.sort_order || index + 1),
  };
}

function normalizeParticipants(value, category, quantity) {
  const rows = parseJsonArray(value);

  if (!rows.length) {
    throw new Error(
      category === "kids"
        ? "At least one student must be registered."
        : "At least one participant must be registered."
    );
  }

  if (rows.length !== quantity) {
    throw new Error(
      category === "kids"
        ? "Student count must match the selected quantity."
        : "Participant count must match the selected quantity."
    );
  }

  const normalized = rows.map((row, index) =>
    normalizeParticipant(row, category, index)
  );

  for (const participant of normalized) {
    if (!participant.full_name) {
      throw new Error(
        category === "kids"
          ? "Each student must have a name."
          : "Each participant must have a name."
      );
    }
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Event / capacity                                                           */
/* -------------------------------------------------------------------------- */

async function getRegisterableEvent(conn, eventId) {
  const [[event]] = await conn.query(
    `
    SELECT
      id,
      category,
      title,
      subtitle,
      start_date,
      end_date,
      location,
      capacity,
      registration_enabled,
      is_published,
      price_per_person
    FROM ${EVENT_TABLE}
    WHERE id = ?
    LIMIT 1
    `,
    [eventId]
  );

  return event || null;
}

async function validateRegisterableEvent(_conn, event, expectedCategory) {
  if (!event) {
    throw new Error("Program not found.");
  }

  const eventCategory = normalizeCategory(event.category);

  if (!REGISTERABLE_CATEGORIES.includes(eventCategory)) {
    throw new Error("This event is not registerable.");
  }

  if (
    expectedCategory &&
    normalizeCategory(expectedCategory) &&
    eventCategory !== normalizeCategory(expectedCategory)
  ) {
    throw new Error("Program category does not match registration request.");
  }

  if (!Number(event.is_published)) {
    throw new Error("Program is not published.");
  }

  if (!Number(event.registration_enabled)) {
    throw new Error("Program registration is closed.");
  }

  return eventCategory;
}

async function validateCapacity(conn, eventId, quantity) {
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

    FROM ${EVENT_TABLE} e

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
      capacity: null,
      used,
      remaining: null,
    };
  }

  const remaining = Math.max(capacity - used, 0);

  if (quantity > remaining) {
    throw new Error("Not enough seats are available.");
  }

  return {
    capacity,
    used,
    remaining,
  };
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                    */
/* -------------------------------------------------------------------------- */

function buildRegistrationMetadata(payload, event, category, participants) {
  const workflow = buildPaymentWorkflow(payload);

  return {
    ...parseJsonObject(payload.metadata),
    ...parseJsonObject(payload.metadata_json),

    program: {
      id: event.id,
      category,
      public_category: publicCategory(category),
      title: event.title,
      start_date: event.start_date || null,
      end_date: event.end_date || null,
      location: event.location || null,
    },

    pricing: {
      pricing_source: payload.pricing_source || null,
      pricing_model: payload.pricing_model || null,
      pricing_tier_id: payload.pricing_tier_id || null,
      pricing_tier_label: payload.pricing_tier_label || null,
      price_type: payload.price_type || null,
      price_per_person: toMoney(payload.price_per_person),
      total_amount: toMoney(payload.total_amount),
    },

    invoice: {
      invoice_id: toId(payload.invoice_id),
      invoice_number: clean(payload.invoice_number, 120) || null,
      payment_link_url: clean(payload.payment_link_url, 1000) || null,
      public_invoice_url: clean(payload.public_invoice_url, 1000) || null,
      invoice_status: clean(payload.invoice_status, 40) || null,
    },

    payment: {
      payment_id: toId(payload.payment_id),
      payment_method: workflow.payment_method,
      preferred_payment_method: workflow.preferred_payment_method,
      payment_status: clean(payload.payment_status, 40) || "pending",
      stripe_checkout_session_id:
        clean(payload.stripe_checkout_session_id, 255) || null,
      stripe_payment_intent_id:
        clean(payload.stripe_payment_intent_id, 255) || null,
    },

    workflow,

    participants,
    participant_count: participants.length,
    public_category: publicCategory(category),
  };
}

async function mergeRegistrationMetadata(conn, registrationId, patch = {}) {
  const columns = await getColumns(conn, REG_TABLE);

  if (!columns.has("metadata_json")) {
    return {
      skipped: true,
      reason: "metadata_json column does not exist.",
    };
  }

  const [[row]] = await conn.query(
    `
    SELECT metadata_json
    FROM ${REG_TABLE}
    WHERE id = ?
    LIMIT 1
    `,
    [registrationId]
  );

  const current = parseJsonObject(row?.metadata_json);
  const next = {
    ...current,
    ...patch,
  };

  await updateExistingColumns(
    conn,
    REG_TABLE,
    {
      metadata_json: JSON.stringify(next),
      updated_at: now(),
    },
    "id = ?",
    [registrationId]
  );

  return {
    skipped: false,
    metadata: next,
  };
}

/* -------------------------------------------------------------------------- */
/* Participant persistence                                                     */
/* -------------------------------------------------------------------------- */

async function replaceParticipants(conn, registrationId, payload = {}) {
  const exists = await tableExists(conn, PARTICIPANT_TABLE);

  if (!exists) {
    return {
      inserted: 0,
      skipped: true,
      reason: "Participant table does not exist.",
    };
  }

  await conn.query(
    `DELETE FROM ${PARTICIPANT_TABLE} WHERE registration_id = ?`,
    [registrationId]
  );

  let inserted = 0;

  for (const participant of payload.participants || []) {
    await insertExistingColumns(conn, PARTICIPANT_TABLE, {
      registration_id: registrationId,
      news_event_id: payload.news_event_id,
      program_id: payload.news_event_id,
      category: payload.category,

      participant_type: participant.participant_type,
      full_name: participant.full_name,
      student_name: participant.student_name,
      participant_name: participant.participant_name,

      first_name: participant.first_name,
      last_name: participant.last_name,
      grade: participant.grade,
      age: participant.age,
      date_of_birth: participant.date_of_birth,

      email: participant.email,
      phone: participant.phone,

      emergency_contact_name:
        participant.emergency_contact_name,
      emergency_contact_phone:
        participant.emergency_contact_phone,

      allergies: participant.allergies,
      medical_notes: participant.medical_notes,
      dietary_notes: participant.dietary_notes,
      notes: participant.notes,

      status: "pending",
      sort_order: participant.sort_order,

      created_at: now(),
      updated_at: now(),
    });

    inserted += 1;
  }

  return {
    inserted,
    skipped: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Create pending registration                                                 */
/* -------------------------------------------------------------------------- */

async function createPendingRegistration(connOrPool, payload = {}) {
  return withConnection(
    connOrPool,
    { transaction: false },
    async (conn) => {
      const eventId = toId(
        payload.news_event_id ||
          payload.program_id ||
          payload.event_id
      );

      if (!eventId) {
        throw new Error("Program id is required.");
      }

      const event = await getRegisterableEvent(conn, eventId);

      const category = await validateRegisterableEvent(
        conn,
        event,
        payload.category
      );

      const quantity = toQuantity(payload.quantity, 1);

      const participants = normalizeParticipants(
        payload.participants,
        category,
        quantity
      );

      await validateCapacity(conn, eventId, quantity);

      const pricePerPerson = toMoney(
        payload.price_per_person ||
          event.price_per_person ||
          0
      );

      const totalAmount = toMoney(
        payload.total_amount ||
          pricePerPerson * quantity
      );

      if (totalAmount <= 0) {
        throw new Error("Registration amount must be greater than zero.");
      }

      const fullName = clean(
        payload.full_name ||
          payload.payer_name ||
          payload.parent_name,
        180
      );

      const email = clean(
        payload.email ||
          payload.payer_email ||
          payload.parent_email,
        190
      ).toLowerCase();

      const phone = clean(
        payload.phone ||
          payload.payer_phone ||
          payload.parent_phone,
        80
      );

      if (!fullName) {
        throw new Error("Registrant full name is required.");
      }

      if (!email) {
        throw new Error("Registrant email is required.");
      }

      const workflow = buildPaymentWorkflow(payload);
      const metadata = buildRegistrationMetadata(
        {
          ...payload,
          price_per_person: pricePerPerson,
          total_amount: totalAmount,
        },
        event,
        category,
        participants
      );

      const registrationId = await insertExistingColumns(
        conn,
        REG_TABLE,
        {
          news_event_id: eventId,
          program_id: eventId,
          event_id: eventId,
          category,

          member_id:
            toId(payload.member_id) ||
            null,

          full_name: fullName,
          payer_name: fullName,
          parent_name: fullName,

          email,
          payer_email: email,
          parent_email: email,

          phone: phone || null,
          payer_phone: phone || null,
          parent_phone: phone || null,

          quantity,

          participants_json:
            JSON.stringify(participants),

          price_per_person:
            pricePerPerson,

          total_amount:
            totalAmount,

          status:
            normalizeRegistrationStatus(payload.status),

          payment_status:
            clean(payload.payment_status, 40) || "pending",

          invoice_status:
            clean(payload.invoice_status, 40) ||
            (payload.invoice_id ? "issued" : "pending"),

          preferred_payment_method:
            workflow.preferred_payment_method,

          payment_method:
            workflow.payment_method,

          finance_followup_required:
            workflow.finance_followup_required ? 1 : 0,

          payment_id:
            toId(payload.payment_id) ||
            null,

          invoice_id:
            toId(payload.invoice_id) ||
            null,

          invoice_number:
            clean(payload.invoice_number, 120) ||
            null,

          payment_link_url:
            clean(payload.payment_link_url, 1000) ||
            null,

          public_invoice_url:
            clean(payload.public_invoice_url, 1000) ||
            null,

          stripe_checkout_session_id:
            clean(payload.stripe_checkout_session_id, 255) ||
            null,

          stripe_payment_intent_id:
            clean(payload.stripe_payment_intent_id, 255) ||
            null,

          pricing_tier_id:
            toId(payload.pricing_tier_id) ||
            null,

          pricing_tier_label:
            clean(payload.pricing_tier_label, 120) ||
            null,

          metadata_json:
            stringifyJson(metadata),

          notes:
            clean(payload.notes, 1000) ||
            null,

          created_by:
            toId(payload.created_by) ||
            toId(payload.created_by_user_id) ||
            null,

          updated_by:
            toId(payload.updated_by) ||
            toId(payload.created_by) ||
            null,

          created_at: now(),
          updated_at: now(),
        }
      );

      const participantResult = await replaceParticipants(
        conn,
        registrationId,
        {
          news_event_id: eventId,
          category,
          participants,
        }
      );

      const registration = await getRegistrationById(
        conn,
        registrationId
      );

      return {
        ok: true,
        registration_id: registrationId,
        news_event_id: eventId,
        program_id: eventId,
        category,
        public_category: publicCategory(category),
        quantity,
        price_per_person: pricePerPerson,
        total_amount: totalAmount,
        participants,
        participant_result: participantResult,
        status: "pending",
        workflow,
        registration,
      };
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Invoice / payment-link attachment                                           */
/* -------------------------------------------------------------------------- */

async function attachInvoiceToRegistration(connOrPool, payload = {}) {
  return withConnection(
    connOrPool,
    { transaction: false },
    async (conn) => {
      const registrationId = toId(
        payload.registration_id ||
          payload.id
      );

      if (!registrationId) {
        throw new Error("registration_id is required.");
      }

      await updateExistingColumns(
        conn,
        REG_TABLE,
        {
          invoice_id:
            toId(payload.invoice_id) ||
            null,

          invoice_number:
            clean(payload.invoice_number, 120) ||
            null,

          invoice_status:
            clean(payload.invoice_status, 40) ||
            "issued",

          payment_link_url:
            clean(payload.payment_link_url, 1000) ||
            null,

          public_invoice_url:
            clean(payload.public_invoice_url, 1000) ||
            null,

          finance_followup_required:
            toBool(payload.finance_followup_required, false) ? 1 : undefined,

          updated_at: now(),
        },
        "id = ?",
        [registrationId]
      );

      await mergeRegistrationMetadata(
        conn,
        registrationId,
        {
          invoice: {
            invoice_id: toId(payload.invoice_id),
            invoice_number: clean(payload.invoice_number, 120) || null,
            invoice_status:
              clean(payload.invoice_status, 40) || "issued",
            payment_link_url:
              clean(payload.payment_link_url, 1000) || null,
            public_invoice_url:
              clean(payload.public_invoice_url, 1000) || null,
            attached_at: new Date().toISOString(),
          },
        }
      );

      return getRegistrationById(conn, registrationId);
    }
  );
}

async function attachPaymentLinkToRegistration(connOrPool, payload = {}) {
  return attachInvoiceToRegistration(
    connOrPool,
    {
      ...payload,
      invoice_status:
        payload.invoice_status ||
        "sent",
    }
  );
}

async function markRegistrationInvoiceSent(connOrPool, payload = {}) {
  return withConnection(
    connOrPool,
    { transaction: false },
    async (conn) => {
      const registrationId = toId(
        payload.registration_id ||
          payload.id
      );

      if (!registrationId) {
        throw new Error("registration_id is required.");
      }

      await updateExistingColumns(
        conn,
        REG_TABLE,
        {
          invoice_status: "sent",
          invoice_sent_at: now(),
          last_invoice_email_sent_at: now(),
          updated_at: now(),
        },
        "id = ?",
        [registrationId]
      );

      await mergeRegistrationMetadata(
        conn,
        registrationId,
        {
          invoice_email: {
            status: "sent",
            emailed_to: clean(payload.emailed_to || payload.email, 190) || null,
            sent_at: new Date().toISOString(),
          },
        }
      );

      return getRegistrationById(conn, registrationId);
    }
  );
}

async function markRegistrationManualFollowupRequired(connOrPool, payload = {}) {
  return withConnection(
    connOrPool,
    { transaction: false },
    async (conn) => {
      const registrationId = toId(
        payload.registration_id ||
          payload.id
      );

      if (!registrationId) {
        throw new Error("registration_id is required.");
      }

      const method = clean(
        payload.preferred_payment_method ||
          payload.payment_method ||
          payload.method,
        40
      ).toLowerCase();

      await updateExistingColumns(
        conn,
        REG_TABLE,
        {
          status: "pending",
          payment_status: "pending",
          invoice_status:
            clean(payload.invoice_status, 40) ||
            "sent",

          preferred_payment_method:
            method || null,

          payment_method:
            method || null,

          finance_followup_required: 1,
          updated_at: now(),
        },
        "id = ?",
        [registrationId]
      );

      await mergeRegistrationMetadata(
        conn,
        registrationId,
        {
          manual_payment_followup: {
            required: true,
            preferred_payment_method: method || null,
            note:
              clean(payload.note || payload.notes, 500) ||
              "Finance must collect and post this manual payment.",
            updated_at: new Date().toISOString(),
          },
        }
      );

      return getRegistrationById(conn, registrationId);
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Load registrations                                                          */
/* -------------------------------------------------------------------------- */

async function getRegistrationById(connOrPool, registrationId) {
  return withConnection(
    connOrPool,
    { transaction: false },
    async (conn) => {
      const id = toId(registrationId);

      if (!id) return null;

      const regColumns = await getColumns(conn, REG_TABLE);
      const hasInvoiceTable = await tableExists(conn, INVOICE_TABLE);

      const invoiceJoin =
        hasInvoiceTable && regColumns.has("invoice_id")
          ? `
            LEFT JOIN ${INVOICE_TABLE} i
              ON i.id = r.invoice_id
          `
          : "";

      const invoiceSelect =
        hasInvoiceTable && regColumns.has("invoice_id")
          ? `
            i.invoice_number AS linked_invoice_number,
            i.status AS linked_invoice_status,
            i.total_amount AS linked_invoice_total_amount,
          `
          : `
            NULL AS linked_invoice_number,
            NULL AS linked_invoice_status,
            NULL AS linked_invoice_total_amount,
          `;

      const [[row]] = await conn.query(
        `
        SELECT
          r.*,

          e.title AS program_title,
          e.start_date AS program_start_date,
          e.end_date AS program_end_date,
          e.location AS program_location,

          ${invoiceSelect}

          p.payment_number,
          p.status AS payment_record_status,

          rc.receipt_number

        FROM ${REG_TABLE} r

        INNER JOIN ${EVENT_TABLE} e
          ON e.id = r.news_event_id

        LEFT JOIN ${PAYMENT_TABLE} p
          ON p.id = r.payment_id

        LEFT JOIN ${RECEIPT_TABLE} rc
          ON rc.payment_id = p.id

        ${invoiceJoin}

        WHERE r.id = ?
        LIMIT 1
        `,
        [id]
      );

      if (!row) return null;

      row.public_category = publicCategory(row.category);
      row.participants = parseJsonArray(row.participants_json);
      row.metadata = parseJsonObject(row.metadata_json);

      row.invoice_number =
        row.invoice_number ||
        row.linked_invoice_number ||
        row.metadata?.invoice?.invoice_number ||
        null;

      row.invoice_status =
        row.invoice_status ||
        row.linked_invoice_status ||
        row.metadata?.invoice?.invoice_status ||
        null;

      row.payment_link_url =
        row.payment_link_url ||
        row.metadata?.invoice?.payment_link_url ||
        null;

      row.public_invoice_url =
        row.public_invoice_url ||
        row.metadata?.invoice?.public_invoice_url ||
        null;

      return row;
    }
  );
}

async function listRegistrations(connOrPool, filters = {}) {
  return withConnection(
    connOrPool,
    { transaction: false },
    async (conn) => {
      const regColumns = await getColumns(conn, REG_TABLE);
      const hasInvoiceTable = await tableExists(conn, INVOICE_TABLE);

      const where = [];
      const params = [];

      const category = normalizeCategory(filters.category);

      if (category) {
        where.push("r.category = ?");
        params.push(category);
      }

      if (filters.status && filters.status !== "all") {
        where.push("r.status = ?");
        params.push(clean(filters.status, 40));
      }

      if (
        filters.payment_status &&
        filters.payment_status !== "all" &&
        regColumns.has("payment_status")
      ) {
        where.push("r.payment_status = ?");
        params.push(clean(filters.payment_status, 40));
      }

      if (
        filters.invoice_status &&
        filters.invoice_status !== "all" &&
        regColumns.has("invoice_status")
      ) {
        where.push("r.invoice_status = ?");
        params.push(clean(filters.invoice_status, 40));
      }

      if (filters.news_event_id || filters.program_id || filters.event_id) {
        where.push("r.news_event_id = ?");
        params.push(
          toId(
            filters.news_event_id ||
              filters.program_id ||
              filters.event_id
          )
        );
      }

      if (filters.member_id) {
        where.push("r.member_id = ?");
        params.push(toId(filters.member_id));
      }

      if (filters.date_from || filters.from || filters.start_date) {
        where.push("DATE(r.created_at) >= ?");
        params.push(filters.date_from || filters.from || filters.start_date);
      }

      if (filters.date_to || filters.to || filters.end_date) {
        where.push("DATE(r.created_at) <= ?");
        params.push(filters.date_to || filters.to || filters.end_date);
      }

      if (filters.search || filters.q) {
        const like = `%${clean(filters.search || filters.q, 120)}%`;

        const searchable = [
          "r.full_name LIKE ?",
          "r.email LIKE ?",
          "r.phone LIKE ?",
          "e.title LIKE ?",
        ];

        params.push(like, like, like, like);

        if (regColumns.has("invoice_number")) {
          searchable.push("r.invoice_number LIKE ?");
          params.push(like);
        }

        where.push(`(${searchable.join(" OR ")})`);
      }

      const limit = Math.min(
        Math.max(Number(filters.limit || filters.pageSize || 100), 1),
        500
      );

      const page = Math.max(Number(filters.page || 1), 1);
      const offset =
        filters.offset !== undefined
          ? Math.max(Number(filters.offset || 0), 0)
          : (page - 1) * limit;

      params.push(limit, offset);

      const invoiceJoin =
        hasInvoiceTable && regColumns.has("invoice_id")
          ? `
            LEFT JOIN ${INVOICE_TABLE} i
              ON i.id = r.invoice_id
          `
          : "";

      const invoiceSelect =
        hasInvoiceTable && regColumns.has("invoice_id")
          ? `
            i.invoice_number AS linked_invoice_number,
            i.status AS linked_invoice_status,
            i.total_amount AS linked_invoice_total_amount,
          `
          : `
            NULL AS linked_invoice_number,
            NULL AS linked_invoice_status,
            NULL AS linked_invoice_total_amount,
          `;

      const [rows] = await conn.query(
        `
        SELECT
          r.*,

          e.title AS program_title,
          e.start_date AS program_start_date,
          e.end_date AS program_end_date,
          e.location AS program_location,

          ${invoiceSelect}

          p.payment_number,
          p.status AS payment_record_status,

          rc.receipt_number

        FROM ${REG_TABLE} r

        INNER JOIN ${EVENT_TABLE} e
          ON e.id = r.news_event_id

        LEFT JOIN ${PAYMENT_TABLE} p
          ON p.id = r.payment_id

        LEFT JOIN ${RECEIPT_TABLE} rc
          ON rc.payment_id = p.id

        ${invoiceJoin}

        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}

        ORDER BY
          r.created_at DESC,
          r.id DESC

        LIMIT ?
        OFFSET ?
        `,
        params
      );

      return rows.map((row) => {
        const metadata = parseJsonObject(row.metadata_json);

        return {
          ...row,
          public_category: publicCategory(row.category),
          participants: parseJsonArray(row.participants_json),
          metadata,

          invoice_number:
            row.invoice_number ||
            row.linked_invoice_number ||
            metadata?.invoice?.invoice_number ||
            null,

          invoice_status:
            row.invoice_status ||
            row.linked_invoice_status ||
            metadata?.invoice?.invoice_status ||
            null,

          payment_link_url:
            row.payment_link_url ||
            metadata?.invoice?.payment_link_url ||
            null,

          public_invoice_url:
            row.public_invoice_url ||
            metadata?.invoice?.public_invoice_url ||
            null,
        };
      });
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Status updates                                                              */
/* -------------------------------------------------------------------------- */

async function markRegistrationPaid(connOrPool, payload = {}) {
  return withConnection(
    connOrPool,
    { transaction: true },
    async (conn) => {
      const registrationId = toId(
        payload.registration_id ||
          payload.id
      );

      if (!registrationId) {
        throw new Error("registration_id is required.");
      }

      const registration = await getRegistrationById(
        conn,
        registrationId
      );

      if (!registration) {
        throw new Error("Registration not found.");
      }

      if (registration.status === "paid") {
        return {
          ok: true,
          already_paid: true,
          registration,
        };
      }

      await updateExistingColumns(
        conn,
        REG_TABLE,
        {
          status: "paid",

          payment_status: "paid",
          invoice_status: "paid",

          payment_id:
            toId(payload.payment_id) ||
            registration.payment_id ||
            null,

          invoice_id:
            toId(payload.invoice_id) ||
            registration.invoice_id ||
            null,

          stripe_payment_intent_id:
            clean(payload.stripe_payment_intent_id, 255) ||
            registration.stripe_payment_intent_id ||
            null,

          stripe_checkout_session_id:
            clean(payload.stripe_checkout_session_id, 255) ||
            registration.stripe_checkout_session_id ||
            null,

          paid_at: now(),
          updated_at: now(),
        },
        "id = ?",
        [registrationId]
      );

      if (await tableExists(conn, PARTICIPANT_TABLE)) {
        await updateExistingColumns(
          conn,
          PARTICIPANT_TABLE,
          {
            status: "registered",
            updated_at: now(),
          },
          "registration_id = ?",
          [registrationId]
        );
      }

      await mergeRegistrationMetadata(
        conn,
        registrationId,
        {
          payment: {
            payment_id:
              toId(payload.payment_id) ||
              registration.payment_id ||
              null,
            payment_status: "paid",
            paid_at: new Date().toISOString(),
          },
        }
      );

      const updated = await getRegistrationById(
        conn,
        registrationId
      );

      return {
        ok: true,
        registration_id: registrationId,
        registration: updated,
      };
    }
  );
}

async function markRegistrationFailed(
  connOrPool,
  registrationIdOrPayload,
  reason = ""
) {
  return withConnection(
    connOrPool,
    { transaction: true },
    async (conn) => {
      const payload =
        typeof registrationIdOrPayload === "object"
          ? registrationIdOrPayload
          : {
              registration_id: registrationIdOrPayload,
              reason,
            };

      const registrationId = toId(
        payload.registration_id ||
          payload.id
      );

      if (!registrationId) {
        throw new Error("registration_id is required.");
      }

      const failureReason =
        clean(payload.reason || payload.failure_reason || reason, 500) ||
        "Registration payment failed or expired.";

      await updateExistingColumns(
        conn,
        REG_TABLE,
        {
          status:
            normalizeRegistrationStatus(payload.status || "cancelled"),

          payment_status:
            clean(payload.payment_status, 40) ||
            "failed",

          failure_reason:
            failureReason,

          failed_at: now(),
          updated_at: now(),
        },
        "id = ? AND status <> 'paid'",
        [registrationId]
      );

      if (await tableExists(conn, PARTICIPANT_TABLE)) {
        await updateExistingColumns(
          conn,
          PARTICIPANT_TABLE,
          {
            status: "cancelled",
            updated_at: now(),
          },
          "registration_id = ?",
          [registrationId]
        );
      }

      await mergeRegistrationMetadata(
        conn,
        registrationId,
        {
          failure: {
            reason: failureReason,
            failed_at: new Date().toISOString(),
          },
        }
      );

      const updated = await getRegistrationById(
        conn,
        registrationId
      );

      return {
        ok: true,
        registration_id: registrationId,
        registration: updated,
      };
    }
  );
}

async function markRegistrationCancelled(
  connOrPool,
  registrationId,
  reason = ""
) {
  return markRegistrationFailed(
    connOrPool,
    {
      registration_id: registrationId,
      status: "cancelled",
      payment_status: "cancelled",
      reason:
        reason ||
        "Registration cancelled.",
    }
  );
}

async function attachStripeCheckoutSession(
  connOrPool,
  registrationId,
  sessionId
) {
  return withConnection(
    connOrPool,
    { transaction: false },
    async (conn) => {
      await updateExistingColumns(
        conn,
        REG_TABLE,
        {
          stripe_checkout_session_id:
            clean(sessionId, 255),

          payment_status: "pending",
          updated_at: now(),
        },
        "id = ?",
        [registrationId]
      );

      await mergeRegistrationMetadata(
        conn,
        registrationId,
        {
          stripe: {
            checkout_session_id: clean(sessionId, 255),
            attached_at: new Date().toISOString(),
          },
        }
      );

      return getRegistrationById(
        conn,
        registrationId
      );
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Summaries                                                                   */
/* -------------------------------------------------------------------------- */

async function getProgramRegistrationSummary(connOrPool, filters = {}) {
  return withConnection(
    connOrPool,
    { transaction: false },
    async (conn) => {
      const where = [];
      const params = [];

      const category = normalizeCategory(filters.category);

      if (category) {
        where.push("r.category = ?");
        params.push(category);
      }

      if (filters.news_event_id || filters.program_id || filters.event_id) {
        where.push("r.news_event_id = ?");
        params.push(
          toId(
            filters.news_event_id ||
              filters.program_id ||
              filters.event_id
          )
        );
      }

      const [[row]] = await conn.query(
        `
        SELECT
          COUNT(*) AS total_registrations,

          COALESCE(SUM(r.quantity), 0) AS total_participants,

          COALESCE(
            SUM(
              CASE WHEN r.status = 'paid'
              THEN r.quantity
              ELSE 0
              END
            ),
            0
          ) AS paid_participants,

          COALESCE(
            SUM(
              CASE WHEN r.status = 'pending'
              THEN r.quantity
              ELSE 0
              END
            ),
            0
          ) AS pending_participants,

          COALESCE(
            SUM(
              CASE WHEN r.status = 'paid'
              THEN r.total_amount
              ELSE 0
              END
            ),
            0
          ) AS paid_amount,

          COALESCE(SUM(r.total_amount), 0) AS total_amount

        FROM ${REG_TABLE} r

        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        `,
        params
      );

      return {
        total_registrations: Number(row?.total_registrations || 0),
        total_participants: Number(row?.total_participants || 0),
        paid_participants: Number(row?.paid_participants || 0),
        pending_participants: Number(row?.pending_participants || 0),
        paid_amount: Number(row?.paid_amount || 0),
        total_amount: Number(row?.total_amount || 0),
      };
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Expiration                                                                  */
/* -------------------------------------------------------------------------- */

async function expirePendingRegistrations(connOrPool, options = {}) {
  return withConnection(
    connOrPool,
    { transaction: true },
    async (conn) => {
      const regColumns = await getColumns(conn, REG_TABLE);

      if (!regColumns.has("stripe_checkout_session_id")) {
        return {
          ok: true,
          expired: 0,
          skipped: true,
          reason:
            "stripe_checkout_session_id column does not exist.",
        };
      }

      const minutes = Math.max(
        Number(options.minutes || 60),
        5
      );

      const [rows] = await conn.query(
        `
        SELECT id
        FROM ${REG_TABLE}
        WHERE status = 'pending'
          AND stripe_checkout_session_id IS NOT NULL
          AND stripe_checkout_session_id <> ''
          AND created_at IS NOT NULL
          AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
        LIMIT ?
        `,
        [
          minutes,
          Math.min(Number(options.limit || 250), 1000),
        ]
      );

      let expired = 0;

      for (const row of rows) {
        await markRegistrationFailed(
          conn,
          {
            registration_id: row.id,
            status: "cancelled",
            payment_status: "expired",
            reason: "Pending Stripe checkout registration expired.",
          }
        );

        expired += 1;
      }

      return {
        ok: true,
        expired,
      };
    }
  );
}

module.exports = {
  normalizeCategory,
  publicCategory,

  normalizeParticipant,
  normalizeParticipants,

  getRegisterableEvent,
  validateRegisterableEvent,
  validateCapacity,

  createPendingRegistration,

  attachInvoiceToRegistration,
  attachPaymentLinkToRegistration,
  markRegistrationInvoiceSent,
  markRegistrationManualFollowupRequired,

  getRegistrationById,
  listRegistrations,

  markRegistrationPaid,
  markRegistrationFailed,
  markRegistrationCancelled,
  attachStripeCheckoutSession,

  getProgramRegistrationSummary,
  expirePendingRegistrations,
};