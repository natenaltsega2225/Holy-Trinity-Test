// backend/services/financeRegistrationService.js
"use strict";

const crypto = require("crypto");
const argon2 = require("argon2");
const Stripe = require("stripe");

const pool = require("../db");

const {
  insertExistingColumns,
  updateExistingColumns,
  findOne,
} = require("../utils/dbHelpers");

const {
  sendMemberWelcomeEmail,
} = require("./memberWelcomeService");

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const STRIPE_METADATA_LIMIT = 45;

const MONTHS = [
  null,
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/* -------------------------------------------------------------------------- */
/* Basic Helpers                                                              */
/* -------------------------------------------------------------------------- */

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function mysqlNow() {
  return new Date();
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function toId(result) {
  return Number(result?.insertId || result || 0);
}

function normalizeEmail(value) {
  return clean(value, 190).toLowerCase().replace(/\s+/g, "");
}

function frontendUrl() {
  return String(
    process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function loginUrl() {
  return `${frontendUrl()}/login`;
}

function cents(value) {
  return Math.max(50, Math.round(money(value) * 100));
}

function safeMeta(value, max = 450) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, max);
}

function normalizeMethod(value) {
  const method = clean(value, 40).toLowerCase();

  if (["card", "stripe", "stripe_card", "credit_card", "debit_card"].includes(method)) {
    return "card";
  }

  if (["ach", "stripe_ach", "us_bank_account", "bank", "bank_account"].includes(method)) {
    return "ach";
  }

  if (method === "cash") return "cash";
  if (["check", "cheque"].includes(method)) return "check";
  if (method === "zelle") return "zelle";

  return "cash";
}

function isStripeMethod(method) {
  return ["card", "ach"].includes(normalizeMethod(method));
}

function stripePaymentMethods(method) {
  return normalizeMethod(method) === "ach"
    ? ["us_bank_account"]
    : ["card"];
}

function processingFee(amount) {
  const base = money(amount);

  if (base <= 0) return 0;

  const gross = (base + 0.3) / (1 - 0.029);
  return money(gross - base);
}

function compactStripeMetadata(source = {}) {
  const metadata = {};

  for (const [key, value] of Object.entries(source)) {
    if (Object.keys(metadata).length >= STRIPE_METADATA_LIMIT) break;
    if (!key || value === undefined || value === null || value === "") continue;

    metadata[String(key).slice(0, 40)] = safeMeta(value, 450);
  }

  return metadata;
}

function splitName(value) {
  const fullName = clean(value, 255);
  const parts = fullName.split(/\s+/).filter(Boolean);

  return {
    fullName: fullName || "Member User",
    firstName: parts[0] || "Member",
    lastName: parts.slice(1).join(" ") || "User",
  };
}

function temporaryPassword() {
  return crypto.randomBytes(12).toString("base64url");
}

function temporaryMemberNo() {
  return `TMP-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}



// function memberNumberConfig() {
//   const prefix = clean(process.env.MEMBER_NUMBER_PREFIX || "M", 12) || "M";
//   const width = Number(process.env.MEMBER_NUMBER_WIDTH || 5);

//   const safeWidth = Number.isInteger(width) && width > 0 ? width : 5;

//   return {
//     prefix,
//     width: safeWidth,
//     maxSequence: Math.pow(10, safeWidth) - 1,
//   };
// }

function memberNumberConfig() {
  const prefix = "CM";

  return {
    prefix,
    width: 5,
    maxSequence: 99999,
  };
}
function buildMemberNoFromSequence(sequence) {
  const { prefix, width } = memberNumberConfig();
  const n = Math.max(1, Number(sequence || 1));

  return `${prefix}-${String(n).padStart(width, "0")}`;
}

function buildMemberNoFromId(memberId) {
  return `CM-${String(Number(memberId || 0)).padStart(5, "0")}`;
}
function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function nextMemberNumberSequence(conn) {
  const [rows] = await conn.query(
    `
    SELECT next_number
    FROM member_sequences
    WHERE id = 1
    FOR UPDATE
    `
  );

  // const sequence = Number(rows[0].next_number);
if (!rows.length) {
  throw new Error(
    "member_sequences record missing."
  );
}

const sequence = Number(rows[0].next_number);
  await conn.query(
    `
    UPDATE member_sequences
    SET next_number = next_number + 1
    WHERE id = 1
    `
  );

  return sequence;
}
async function memberNumberAvailable(conn, memberNo, memberId) {
  const existing = await findOne(
    conn,
    `
    SELECT id
    FROM tbl_members
    WHERE member_no = ?
      AND id <> ?
    LIMIT 1
    `,
    [memberNo, memberId]
  );

  return !existing;
}


// async function assignMemberNumber(conn, memberId) {
//   const baseId = Number(memberId || 0);

//   if (!baseId) {
//     throw new Error("Member ID is required before assigning member number.");
//   }

//   for (let offset = 0; offset < 100; offset += 1) {
//     const candidate = buildMemberNoFromId(baseId + offset);

//     const [[existing]] = await conn.query(
//       `
//       SELECT id
//       FROM tbl_members
//       WHERE member_no = ?
//         AND id <> ?
//       LIMIT 1
//       `,
//       [candidate, baseId]
//     );

//     if (!existing) {
//       return candidate;
//     }
//   }

//   throw new Error(`Unable to assign a unique member number for member ${baseId}.`);
// }
async function assignMemberNumber(conn, memberId) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const sequence = await nextMemberNumberSequence(conn);
    const candidate = buildMemberNoFromSequence(sequence);

    const available = await memberNumberAvailable(
      conn,
      candidate,
      memberId
    );

    if (available) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to assign a unique member number. Please verify member_sequences."
  );
}
function currentYear(value) {
  const n = Number(value || 0);

  if (Number.isInteger(n) && n >= 2000 && n <= 2100) {
    return n;
  }

  return new Date().getFullYear();
}

function monthNumber(value) {
  const n = Number(value || 0);

  if (Number.isInteger(n) && n >= 1 && n <= 12) {
    return n;
  }

  return new Date().getMonth() + 1;
}

function addMonths(year, month, offset) {
  const date = new Date(Number(year), Number(month) - 1 + offset, 1);

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

function mysqlDateFromYearMonth(year, month) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
function mysqlLastDateFromYearMonth(year, month) {
  const end = new Date(Number(year), Number(month), 0);

  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(
    end.getDate()
  ).padStart(2, "0")}`;
}
function quoteIdent(value) {
  const ident = String(value || "");

  if (!/^[A-Za-z0-9_]+$/.test(ident)) {
    throw new Error("Unsafe SQL identifier.");
  }

  return `\`${ident}\``;
}

/* -------------------------------------------------------------------------- */
/* Schema Helpers                                                             */
/* -------------------------------------------------------------------------- */

async function tableExists(conn, tableName) {
  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function getTableColumns(conn, tableName) {
  if (!(await tableExists(conn, tableName))) return new Set();

  const [rows] = await conn.query(`SHOW COLUMNS FROM ${quoteIdent(tableName)}`);
  return new Set(rows.map((row) => row.Field));
}
function subscriptionStatusForPayment(payload = {}) {
  const method = String(payload.payment_method || "").toLowerCase();
  const provider = String(payload.payment_provider || "").toLowerCase();

  if (
    provider === "stripe" ||
    method === "card" ||
    method === "ach"
  ) {
    return "pending_payment";
  }

  if (
    method === "cash" ||
    method === "check" ||
    method === "zelle"
  ) {
    return "active";
  }

  return "pending";
}

/* -------------------------------------------------------------------------- */
/* Plan Helpers                                                               */
/* -------------------------------------------------------------------------- */

function normalizeDuration(plan = {}, payload = {}) {
  const raw =
    payload.duration_months ||
    payload.months_paid ||
    payload.interval_months ||
    plan.duration_months ||
    plan.interval_months ||
    plan.coverage_months ||
    plan.months ||
    1;

  const duration = Number(raw);

  return [1, 3, 6, 12].includes(duration) ? duration : 1;
}

function normalizePlanName(plan = {}) {
  return clean(
    plan.plan_name ||
      plan.name ||
      plan.title ||
      "Membership Plan",
    180
  ) || "Membership Plan";
}

function isRecurringPlan(plan = {}, payload = {}) {
  const duration = normalizeDuration(plan, payload);

  if (duration !== 1) return false;

  if (
    payload.auto_renew === true ||
    payload.auto_payment_enabled === true ||
    payload.recurring === true
  ) {
    return true;
  }

  const mode = clean(
    plan.payment_mode ||
      plan.billing_model ||
      plan.subscription_type ||
      "",
    80
  ).toLowerCase();

  if (
    mode.includes("recurring") ||
    mode.includes("subscription") ||
    mode.includes("month_to_month")
  ) {
    return true;
  }

  return plan.is_recurring === 1 || plan.allow_auto_renew === 1;
}

function normalizePlan(row = {}, source = "finance_dues_plans") {
  if (!row) return null;

  const duration = normalizeDuration(row);

  return {
    ...row,
    source_table: source,
    id: Number(row.id),
    plan_name: normalizePlanName(row),
    amount: money(
      row.amount ??
        row.price ??
        row.dues_amount ??
        row.monthly_amount ??
        row.minimum_amount ??
        0
    ),
    monthly_amount: money(
      row.monthly_amount ??
        row.amount_per_month ??
        row.dues_amount ??
        row.amount ??
        0
    ),
    registration_fee: money(
      row.registration_fee ??
        row.signup_fee ??
        row.first_time_fee ??
        row.first_time_registration_fee ??
        0
    ),
    duration_months: duration,
    interval_months: duration,
  };
}

async function getPlanFromTable(conn, tableName, planId) {
  if (!planId || !(await tableExists(conn, tableName))) return null;

  const columns = await getTableColumns(conn, tableName);

  const activeClause = columns.has("is_active")
    ? "AND COALESCE(is_active, 1) = 1"
    : "";

  return findOne(
    conn,
    `
    SELECT *
    FROM ${quoteIdent(tableName)}
    WHERE id = ?
    ${activeClause}
    LIMIT 1
    `,
    [planId]
  );
}

async function getDefaultPlanFromTable(conn, tableName) {
  if (!(await tableExists(conn, tableName))) return null;

  const columns = await getTableColumns(conn, tableName);

  const activeClause = columns.has("is_active")
    ? "WHERE COALESCE(is_active, 1) = 1"
    : "";

  const orderParts = [];

  if (columns.has("is_default")) {
    orderParts.push("COALESCE(is_default, 0) DESC");
  }

  if (columns.has("sort_order")) {
    orderParts.push("sort_order ASC");
  }

  orderParts.push("id ASC");

  return findOne(
    conn,
    `
    SELECT *
    FROM ${quoteIdent(tableName)}
    ${activeClause}
    ORDER BY ${orderParts.join(", ")}
    LIMIT 1
    `,
    []
  );
}

async function getPlan(conn, payload = {}) {
  const duesPlanId =
    payload.dues_plan_id ||
    payload.finance_dues_plan_id ||
    null;

  const membershipPlanId =
    payload.membership_plan_id ||
    payload.plan_id ||
    null;

  if (duesPlanId) {
    const plan = await getPlanFromTable(conn, "tbl_finance_dues_plans", duesPlanId);
    if (plan) return normalizePlan(plan, "finance_dues_plans");
  }

  if (membershipPlanId) {
    const membershipPlan = await getPlanFromTable(
      conn,
      "tbl_membership_plans",
      membershipPlanId
    );

    if (membershipPlan) {
      return normalizePlan(membershipPlan, "membership_plans");
    }

    const duesPlan = await getPlanFromTable(
      conn,
      "tbl_finance_dues_plans",
      membershipPlanId
    );

    if (duesPlan) {
      return normalizePlan(duesPlan, "finance_dues_plans");
    }
  }

  const defaultDuesPlan = await getDefaultPlanFromTable(
    conn,
    "tbl_finance_dues_plans"
  );

  if (defaultDuesPlan) {
    return normalizePlan(defaultDuesPlan, "finance_dues_plans");
  }

  throw new Error("Active membership plan is required.");
}

/* -------------------------------------------------------------------------- */
/* Coverage / Totals                                                          */
/* -------------------------------------------------------------------------- */

// function startYearMonthFromPayload(payload = {}) {
//   const explicitDate =
//     payload.coverage_start_date ||
//     payload.membership_start_date ||
//     payload.start_date ||
//     payload.join_date ||
//     payload.joined_at ||
//     null;

//   if (explicitDate) {
//     const parsed = new Date(explicitDate);

//     if (!Number.isNaN(parsed.getTime())) {
//       return {
//         year: parsed.getFullYear(),
//         month: parsed.getMonth() + 1,
//       };
//     }
//   }

//   return {
//     year: currentYear(payload.coverage_year || payload.start_year),
//     month: monthNumber(
//       payload.coverage_start_month ||
//         payload.start_month ||
//         payload.month
//     ),
//   };
// }
function startYearMonthFromPayload(payload = {}) {
  const now = new Date();

  /* --------------------------------------------------
     1. Explicit coverage date wins
  -------------------------------------------------- */

  const explicitCoverageDate =
    payload.coverage_start_date ||
    payload.membership_start_date ||
    payload.start_date ||
    null;

  if (explicitCoverageDate) {
    const parsed = new Date(explicitCoverageDate);

    if (
      !Number.isNaN(parsed.getTime()) &&
      parsed.getFullYear() >= 2000 &&
      parsed.getFullYear() <= 2100
    ) {
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
      };
    }
  }

  /* --------------------------------------------------
     2. Coverage year only
     NEVER use birth year or join year
  -------------------------------------------------- */

  const coverageYear = Number(
    payload.coverage_year || 0
  );

  const coverageMonth = Number(
    payload.coverage_start_month ||
    payload.start_month ||
    payload.month ||
    0
  );

  const year =
    coverageYear >= 2000 &&
    coverageYear <= 2100
      ? coverageYear
      : now.getFullYear();

  const month =
    coverageMonth >= 1 &&
    coverageMonth <= 12
      ? coverageMonth
      : now.getMonth() + 1;

  return {
    year,
    month,
  };
}


function buildCoverage(payload = {}, plan = {}) {
  const duration = normalizeDuration(plan, payload);
  const start = startYearMonthFromPayload(payload);

  const months = [];

  for (let i = 0; i < duration; i += 1) {
    months.push(addMonths(start.year, start.month, i));
  }

  const first = months[0];
  const last = months[months.length - 1];

  const label =
    first.year === last.year
      ? `${MONTHS[first.month]} - ${MONTHS[last.month]} ${first.year}`
      : `${MONTHS[first.month]} ${first.year} - ${MONTHS[last.month]} ${last.year}`;

  return {
    duration_months: duration,
    coverage_year: first.year,
    coverage_start_month: first.month,
    coverage_end_year: last.year,
    coverage_end_month: last.month,
    coverage_start_date: mysqlDateFromYearMonth(first.year, first.month),
   coverage_end_date: mysqlLastDateFromYearMonth(last.year, last.month),
    coverage_label: label,
    coverage_months: months,
    coverage_months_json: JSON.stringify(months),
  };
}
function planAmountForDuration(plan = {}, duration = 1) {
  const planDuration = normalizeDuration(plan);
  const planAmount = money(plan.amount);
  const monthlyAmount = money(plan.monthly_amount || planAmount / Math.max(planDuration, 1));

  if (planDuration === duration) {
    return planAmount;
  }

  return money(monthlyAmount * duration);
}

function buildTotals(payload = {}, plan = {}, coverage = {}) {
  const registrationFee = money(
    payload.registration_fee ??
      payload.first_time_registration_fee ??
      plan.registration_fee ??
      0
  );

  const explicitMembership = money(
    payload.membership_amount ??
      payload.dues_amount ??
      payload.membership_total ??
      0
  );

  const explicitTotal = money(
    payload.total_amount ??
      payload.payment_amount ??
      payload.amount ??
      0
  );

  let membershipAmount = explicitMembership;

  if (membershipAmount <= 0 && explicitTotal > registrationFee) {
    membershipAmount = money(explicitTotal - registrationFee);
  }

  if (membershipAmount <= 0) {
    membershipAmount = planAmountForDuration(
      plan,
      coverage.duration_months || normalizeDuration(plan, payload)
    );
  }

  if (membershipAmount <= 0) {
    throw new Error("Membership payment amount must be greater than zero.");
  }

  const subtotal = money(membershipAmount + registrationFee);

  const includeProcessingFee =
    payload.cover_processing_fee === true ||
    payload.include_processing_fee === true ||
    payload.cover_processing_fee === 1 ||
    payload.include_processing_fee === 1;

  const fee =
    includeProcessingFee && isStripeMethod(payload.payment_method || payload.method)
      ? processingFee(subtotal)
      : 0;

  return {
    membership_amount: membershipAmount,
    registration_fee: registrationFee,
    processing_fee: fee,
    subtotal_amount: subtotal,
    total_amount: money(subtotal + fee),
  };
}

/* -------------------------------------------------------------------------- */
/* Duplicate / Reference Guards                                               */
/* -------------------------------------------------------------------------- */

async function ensureMemberCanBeCreated(conn, payload = {}) {
  const email = normalizeEmail(payload.email);
  const fullName = clean(payload.full_name, 255);

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  if (!email) {
    throw new Error("Email is required.");
  }

  const existingUser = await findOne(
    conn,
    `
    SELECT id
    FROM tbl_users
    WHERE LOWER(email) = ?
    LIMIT 1
    `,
    [email]
  );

  if (existingUser) {
    throw new Error("A user account already exists for this email.");
  }

  const existingMember = await findOne(
    conn,
    `
    SELECT id, member_no
    FROM tbl_members
    WHERE LOWER(email) = ?
    LIMIT 1
    `,
    [email]
  );

  if (existingMember) {
    throw new Error("A member already exists for this email.");
  }
}

function manualReference(payload = {}) {
  return clean(
    payload.reference_no ||
      payload.reference_number ||
      payload.check_number ||
      payload.zelle_reference ||
      payload.transaction_reference,
    255
  ) || null;
}

async function assertManualReferenceValid(conn, method, payload = {}) {
  const normalized = normalizeMethod(method);
  const reference = manualReference(payload);

  if (["check", "zelle"].includes(normalized) && !reference) {
    throw new Error(
      normalized === "check"
        ? "Check number or reference number is required."
        : "Zelle confirmation/reference number is required."
    );
  }

  if (!reference || !(await tableExists(conn, "tbl_finance_payments"))) {
    return;
  }

  const columns = await getTableColumns(conn, "tbl_finance_payments");

  const referenceColumns = [
    "reference_no",
    "reference_number",
    "transaction_reference",
    "check_number",
    "zelle_reference",
  ].filter((column) => columns.has(column));

  if (!referenceColumns.length) return;

  const where = referenceColumns
    .map((column) => `${quoteIdent(column)} = ?`)
    .join(" OR ");

  const params = referenceColumns.map(() => reference);

  let sql = `
    SELECT id
    FROM tbl_finance_payments
    WHERE (${where})
  `;

  if (columns.has("payment_method")) {
    sql += " AND payment_method = ?";
    params.push(normalized);
  }

  sql += " LIMIT 1";

  const existing = await findOne(conn, sql, params);

  if (existing) {
    throw new Error("A payment with this reference number already exists.");
  }
}

/* -------------------------------------------------------------------------- */
/* Member / User Creation                                                     */
/* -------------------------------------------------------------------------- */

async function uniqueUsername(conn, preferred) {
  const root =
    clean(preferred || `member${Date.now()}`, 70)
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "") || `member${Date.now()}`;

  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? root : `${root}${i}`;

    const existing = await findOne(
      conn,
      `
      SELECT id
      FROM tbl_users
      WHERE username = ?
      LIMIT 1
      `,
      [candidate]
    );

    if (!existing) return candidate;
  }

  return `${root}${Date.now()}`;
}
function usernameSeedFromName(payload = {}, fallback = "") {
  const fullName = clean(payload.full_name || payload.fullName || "", 180);
  const parts = fullName.split(/\s+/).filter(Boolean);

  const firstName = clean(payload.first_name || payload.firstName || parts[0] || "", 80);
  const lastName = clean(
    payload.last_name || payload.lastName || parts.slice(1).join(" ") || "",
    120
  );

  const initial = firstName.charAt(0).toLowerCase().replace(/[^a-z0-9]/g, "");
  const last = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");

  return initial && last
    ? `${initial}${last}`
    : clean(fallback, 80).toLowerCase().replace(/[^a-z0-9._-]/g, "");
}
async function createMemberAndUser(conn, payload = {}, options = {}) {
  await ensureMemberCanBeCreated(conn, payload);

  const email = normalizeEmail(payload.email);
  const rawPassword = temporaryPassword();

  const passwordHash = await argon2.hash(rawPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const pendingMemberNo = temporaryMemberNo();
  const { fullName, firstName, lastName } = splitName(payload.full_name);

  const status = options.pendingPayment ? "pending_payment" : "active";

  const memberResult = await insertExistingColumns(conn, "tbl_members", {
    member_no: pendingMemberNo,

    first_name: firstName,
    last_name: lastName,
    full_name: fullName,

    email,
    phone: clean(payload.phone, 80) || null,

    address_line_1:
      clean(payload.address_line_1 || payload.address1 || payload.street, 255) || null,
    address_line_2:
      clean(payload.address_line_2 || payload.address2, 255) || null,
    address: clean(payload.address, 1000) || null,
    city: clean(payload.city, 120) || null,
    state: clean(payload.state, 120) || null,
    zip_code: clean(payload.zip_code || payload.zip, 40) || null,
    country: clean(payload.country || "USA", 80),

    gender: clean(payload.gender, 50) || null,
    marital_status: clean(payload.marital_status, 50) || null,
    household_role: clean(payload.household_role, 100) || null,

    status,
    membership_status: status,

    joined_at: mysqlNow(),
    membership_start_date: options.coverage?.coverage_start_date || null,
    membership_end_date: options.coverage?.coverage_end_date || null,

    created_by: payload.created_by || null,
    updated_by: payload.created_by || null,
    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });

  const memberId = toId(memberResult);
  const memberNo = await assignMemberNumber(conn, memberId);
  const username = await uniqueUsername(
    conn,
    payload.username ||
      usernameSeedFromName(
        {
          ...payload,
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
        },
        memberNo
      )
  );

  const userResult = await insertExistingColumns(conn, "tbl_users", {
    member_id: memberId,

    first_name: firstName,
    last_name: lastName,
    full_name: fullName,

    username,
    email,
    phone: clean(payload.phone, 80) || null,

    password: passwordHash,
    password_hash: passwordHash,
    password_algo: "argon2id",

    role: "member",
    is_active: options.pendingPayment ? 0 : 1,
    account_status: status,
    status,
    must_change_password: 1,
    password_reset_required: 1,
    email_verified: 1,

    created_by: payload.created_by || null,
    updated_by: payload.created_by || null,
    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });

  const userId = toId(userResult);

  await updateExistingColumns(
  conn,
  "tbl_members",
  {
    user_id: userId,
    member_no: memberNo,
    updated_at: mysqlNow(),
  },
  "id = ?",
  [memberId]
);
  return {
    member_id: memberId,
    user_id: userId,
    member_no: memberNo,
    username,
    temporary_password: rawPassword,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: clean(payload.phone, 80) || null,
  };
}

async function createDependents(conn, memberId, dependents = []) {
  if (!Array.isArray(dependents) || !dependents.length) return [];

  const created = [];

  for (const dependent of dependents) {
    const { fullName, firstName, lastName } = splitName(dependent.full_name);

    const result = await insertExistingColumns(conn, "tbl_member_dependents", {
      member_id: memberId,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      relationship: clean(dependent.relationship, 100) || null,
      birth_date: dependent.birth_date || dependent.dob || null,
      gender: clean(dependent.gender, 50) || null,
      email: normalizeEmail(dependent.email || ""),
      phone: clean(dependent.phone, 80) || null,
      notes: clean(dependent.notes, 500) || null,
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    });

    created.push({
      id: toId(result),
      full_name: fullName,
    });
  }

  return created;
}

async function activateRegisteredMember(conn, member, coverage, payload = {}) {
  await updateExistingColumns(
    conn,
    "tbl_members",
    {
      status: "active",
      membership_status: "active",
      membership_start_date: coverage.coverage_start_date,
      membership_end_date: coverage.coverage_end_date,
      updated_by: payload.created_by || null,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [member.member_id]
  );

  await updateExistingColumns(
    conn,
    "tbl_users",
    {
      account_status: "active",
      status: "active",
      is_active: 1,
      updated_by: payload.created_by || null,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [member.user_id]
  );
}

/* -------------------------------------------------------------------------- */
/* Subscription                                                               */
/* -------------------------------------------------------------------------- */

async function upsertDuesSubscription(
  conn,
  member,
  plan,
  coverage,
  totals,
  payload = {},
  status = "active"
) {
  if (!(await tableExists(conn, "tbl_finance_dues_subscriptions"))) {
    return null;
  }

  const existing = await findOne(
    conn,
    `
    SELECT id
    FROM tbl_finance_dues_subscriptions
    WHERE member_id = ?
      AND status IN ('active', 'pending', 'pending_payment')
    ORDER BY id DESC
    LIMIT 1
    `,
    [member.member_id]
  );

  const data = {
    member_id: member.member_id,
    dues_plan_id: plan.source_table === "finance_dues_plans" ? plan.id : null,
    membership_plan_id: plan.source_table === "membership_plans" ? plan.id : null,
    plan_name: plan.plan_name,

    current_amount: totals.membership_amount,
    amount: totals.membership_amount,
    total_amount: totals.total_amount,

    start_date: coverage.coverage_start_date,
    end_date: coverage.coverage_end_date,
    membership_start_date: coverage.coverage_start_date,
    membership_end_date: coverage.coverage_end_date,

    coverage_year: coverage.coverage_year,
    coverage_start_month: coverage.coverage_start_month,
    coverage_end_year: coverage.coverage_end_year,
    coverage_end_month: coverage.coverage_end_month,
    coverage_label: coverage.coverage_label,
    coverage_months_json: coverage.coverage_months_json,

    months_paid: coverage.duration_months,
    duration_months: coverage.duration_months,
    months_remaining: 0,

    auto_renew: isRecurringPlan(plan, payload) ? 1 : 0,
    auto_payment_enabled: isRecurringPlan(plan, payload) ? 1 : 0,
    next_renewal_date: coverage.coverage_end_date,

    status,
    created_by: payload.created_by || null,
    updated_by: payload.created_by || null,
    updated_at: mysqlNow(),
  };

  if (existing) {
    await updateExistingColumns(
      conn,
      "tbl_finance_dues_subscriptions",
      data,
      "id = ?",
      [existing.id]
    );

    return existing.id;
  }

  const result = await insertExistingColumns(conn, "tbl_finance_dues_subscriptions", {
    ...data,
    created_at: mysqlNow(),
  });

  return toId(result);
}

/* -------------------------------------------------------------------------- */
/* Payment                                                                    */
/* -------------------------------------------------------------------------- */

function buildPaymentPayload(payload, member, plan, totals, coverage) {
  const method = normalizeMethod(payload.payment_method || payload.method);
  const reference = manualReference(payload);

  return {
    member_id: member.member_id,
    member_no: member.member_no,
    user_id: member.user_id,

    full_name: member.full_name,
    full_name_snapshot: member.full_name,
    email: member.email,
    email_snapshot: member.email,
    phone: member.phone,
    phone_snapshot: member.phone,
    payer_type: "member",

    payment_type: "membership",
    category: "membership",
    sub_category: "membership_registration",
    donation_category: "membership",
    description: `New member registration and membership dues: ${coverage.coverage_label}`,

    amount: totals.total_amount,
    total_amount: totals.total_amount,
    payment_amount: totals.total_amount,
    base_amount: totals.membership_amount,
    membership_amount: totals.membership_amount,
    registration_fee: totals.registration_fee,
    processing_fee: totals.processing_fee,
    subtotal_amount: totals.subtotal_amount,

    plan_id: plan.id,
    dues_plan_id: plan.source_table === "finance_dues_plans" ? plan.id : null,
    membership_plan_id: plan.source_table === "membership_plans" ? plan.id : null,
    plan_name: plan.plan_name,

    months_paid: coverage.duration_months,
    duration_months: coverage.duration_months,
    coverage_year: coverage.coverage_year,
    coverage_start_month: coverage.coverage_start_month,
    coverage_end_year: coverage.coverage_end_year,
    coverage_end_month: coverage.coverage_end_month,
    coverage_label: coverage.coverage_label,
    coverage_months_json: coverage.coverage_months_json,

    payment_method: method,
    method,
    provider: "manual",
    payment_provider: "manual",
    status: "paid",
    payment_status: "paid",

    reference_no: reference,
    reference_number: reference,
    check_number: payload.check_number || null,
    zelle_reference: payload.zelle_reference || null,

    manual_entry: 1,
    is_manual_entry: 1,
    recorded_by: payload.created_by || null,
    created_by: payload.created_by || null,
    finance_created_by: payload.created_by || null,

    notes:
      clean(payload.notes, 1000) ||
      `Finance new member registration: ${coverage.coverage_label}`,

        send_receipt_email: false,
    send_invoice_email: false,
    send_welcome_email: false,

    defer_receipt_email: true,
    defer_invoice_email: true,
    defer_welcome_email: true,

    line_items: [
      ...(totals.registration_fee > 0
        ? [
            {
              code: "REG",
              item_type: "registration_fee",
              item_name: "Registration Fee",
              description: "First-time member registration fee",
              quantity: 1,
              unit_price: totals.registration_fee,
              amount: totals.registration_fee,
            },
          ]
        : []),
      {
        code: "MEM",
        item_type: "membership",
        item_name: "Membership Dues",
        description: `${plan.plan_name} - ${coverage.coverage_label}`,
        quantity: coverage.duration_months,
        unit_price: money(totals.membership_amount / coverage.duration_months),
        amount: totals.membership_amount,
      },
      ...(totals.processing_fee > 0
        ? [
            {
              code: "FEE",
              item_type: "processing_fee",
              item_name: "Processing Fee",
              description: "Payment processing fee",
              quantity: 1,
              unit_price: totals.processing_fee,
              amount: totals.processing_fee,
            },
          ]
        : []),
    ],
  };
}

async function createRegistrationPayment(conn, paymentPayload) {
  const paymentService = require("./paymentService");

  if (typeof paymentService.processSuccessfulPayment === "function") {
    return paymentService.processSuccessfulPayment(conn, paymentPayload);
  }

  if (typeof paymentService.createPayment === "function") {
    return paymentService.createPayment(paymentPayload);
  }

  if (typeof paymentService.completePayment === "function") {
    return paymentService.completePayment(paymentPayload);
  }

  throw new Error("Payment service does not expose a payment creation function.");
}
async function sendPaymentEmailsIfAvailable(payment) {
  const paymentService = require("./paymentService");

  if (typeof paymentService.sendPaymentEmails !== "function") {
    return {
      success: false,
      skipped: true,
      error: "sendPaymentEmails is not available.",
    };
  }

  return paymentService.sendPaymentEmails(payment);
}

/* -------------------------------------------------------------------------- */
/* Stripe Checkout                                                            */
/* -------------------------------------------------------------------------- */

function buildStripeMetadata(payload, member, plan, totals, coverage) {
  return compactStripeMetadata({
    category: "membership",
    payment_type: "membership",
    checkout_type: "finance_new_member_registration",

    source: "finance_registration",
    process_direct_payment: "true",
    process_membership_invoice: "true",
    activate_member_after_payment: "true",

    send_receipt_email: "true",
    send_invoice_email: "true",
    send_welcome_email: "true",

    member_id: member.member_id,
    member_no: member.member_no,
    user_id: member.user_id,

    full_name: member.full_name,
    email: member.email,
    phone: member.phone,

    plan_id: plan.id,
    dues_plan_id: plan.source_table === "finance_dues_plans" ? plan.id : "",
    membership_plan_id: plan.source_table === "membership_plans" ? plan.id : "",
    plan_name: plan.plan_name,

    sub_category: "membership_registration",
    donation_category: "membership",

    duration_months: coverage.duration_months,
    months_paid: coverage.duration_months,
    coverage_year: coverage.coverage_year,
    coverage_start_month: coverage.coverage_start_month,
    coverage_end_year: coverage.coverage_end_year,
    coverage_end_month: coverage.coverage_end_month,
    coverage_label: coverage.coverage_label,

    amount: totals.total_amount,
    total_amount: totals.total_amount,
    membership_amount: totals.membership_amount,
    registration_fee: totals.registration_fee,
    processing_fee: totals.processing_fee,

    method: normalizeMethod(payload.payment_method || payload.method),
    payment_method: normalizeMethod(payload.payment_method || payload.method),
    provider: "stripe",

    finance_created_by: payload.created_by || "",
    created_by: payload.created_by || "",
  });
}

function buildStripeLineItems(plan, totals, coverage, recurring) {
  const items = [];

  if (totals.registration_fee > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: cents(totals.registration_fee),
        product_data: {
          name: "First-Time Registration Fee",
          description: "New member registration fee",
        },
      },
    });
  }

  items.push({
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: cents(totals.membership_amount),
      recurring: recurring
        ? {
            interval: "month",
            interval_count: 1,
          }
        : undefined,
      product_data: {
        name: plan.plan_name,
        description: `Membership coverage: ${coverage.coverage_label}`,
      },
    },
  });

  if (totals.processing_fee > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: cents(totals.processing_fee),
        product_data: {
          name: "Processing Fee",
          description: "Payment processing fee",
        },
      },
    });
  }

  return items;
}

async function createStripeCheckoutSession({
  payload,
  member,
  plan,
  totals,
  coverage,
}) {
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  const method = normalizeMethod(payload.payment_method || payload.method);
  const recurring = isRecurringPlan(plan, payload);
  const metadata = buildStripeMetadata(payload, member, plan, totals, coverage);

  const sessionPayload = {
    mode: recurring ? "subscription" : "payment",
    payment_method_types: stripePaymentMethods(method),
    customer_email: member.email,
    client_reference_id: String(member.member_id),

    success_url:
      payload.success_url ||
      `${frontendUrl()}/dash/finance/members?registration=success&session_id={CHECKOUT_SESSION_ID}`,

    cancel_url:
      payload.cancel_url ||
      `${frontendUrl()}/dash/finance/members?registration=cancelled`,

    line_items: buildStripeLineItems(plan, totals, coverage, recurring),
    metadata,
  };

  if (recurring) {
    sessionPayload.subscription_data = {
      metadata,
    };
  } else {
    sessionPayload.payment_intent_data = {
      metadata,
    };
  }

  return stripe.checkout.sessions.create(sessionPayload);
}

/* -------------------------------------------------------------------------- */
/* Audit / Email                                                              */
/* -------------------------------------------------------------------------- */

async function recordAudit(conn, payload = {}) {
  if (!(await tableExists(conn, "tbl_audit_logs"))) return null;

  return insertExistingColumns(conn, "tbl_audit_logs", {
    user_id: payload.user_id || payload.created_by || null,
    actor_user_id: payload.user_id || payload.created_by || null,
    member_id: payload.member_id || null,

    action: payload.action,
    event_type: payload.action,
    entity_type: payload.entity_type || "member_registration",
    resource_type: payload.entity_type || "member_registration",
    entity_id: payload.entity_id || payload.member_id || null,
    resource_id: payload.entity_id || payload.member_id || null,

    details: payload.details ? JSON.stringify(payload.details) : null,
    details_json: payload.details ? JSON.stringify(payload.details) : null,
    metadata_json: payload.details ? JSON.stringify(payload.details) : null,

    ip_address: payload.ip_address || null,
    user_agent: payload.user_agent || null,

    created_at: mysqlNow(),
  });
}

async function sendWelcomeAfterPayment(member, payment, plan, coverage, totals, options = {}) {
  if (!member?.email) {
    return {
      success: false,
      skipped: true,
      error: "No member email provided.",
    };
  }

  return sendMemberWelcomeEmail({
    email: member.email,
    full_name: member.full_name,
    member_no: member.member_no,
    username: member.username,
    temporary_password: member.temporary_password,

    plan_name: plan.plan_name,
    coverage_label: coverage.coverage_label,
    coverage_year: coverage.coverage_year,
    coverage_start_month: coverage.coverage_start_month,
    coverage_end_month: coverage.coverage_end_month,
    duration_months: coverage.duration_months,

    membership_amount: totals.membership_amount,
    registration_fee: totals.registration_fee,
    processing_fee: totals.processing_fee,
    total_amount: totals.total_amount,

    invoice_number:
      payment?.invoice?.invoice_number ||
      payment?.invoice_number ||
      null,

    receipt_number:
      payment?.receipt?.receipt_number ||
      payment?.receipt_number ||
      null,

    payment_number:
      payment?.payment?.payment_number ||
      payment?.payment_number ||
      null,

    payment_pending: options.paymentPending ? 1 : 0,
    checkout_url: options.checkoutUrl || null,
    login_url: loginUrl(),
  });
}
function queueBackgroundTask(label, task) {
  const run = async () => {
    try {
      await task();
    } catch (err) {
      console.error(`${label} failed:`, err);
    }
  };

  if (typeof setImmediate === "function") {
    setImmediate(run);
  } else {
    setTimeout(run, 0);
  }
}





function pickId(...values) {
  for (const value of values) {
    const n = Number(value || 0);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function queueRegistrationNotifications({ member, payment, plan, coverage, totals }) {
  queueBackgroundTask("finance registration notifications", async () => {
    const paymentId = pickId(
      payment?.payment?.id,
      payment?.payment_id,
      payment?.id
    );

    const invoiceId = pickId(
      payment?.invoice?.id,
      payment?.invoice_id,
      payment?.payment?.invoice_id
    );

    const receiptId = pickId(
      payment?.receipt?.id,
      payment?.receipt_id,
      payment?.payment?.receipt_id
    );

    let invoiceEmail = { success: false, skipped: true };
    let receiptEmail = { success: false, skipped: true };

    try {
      const invoiceEmailService = require("./domains/invoices/invoiceEmailService");

      if (invoiceId && typeof invoiceEmailService.sendInvoiceEmail === "function") {
        invoiceEmail = await invoiceEmailService.sendInvoiceEmail(invoiceId, {
          email: member.email,
          attachPdf: true,
          source: "finance_registration_manual",
        });
      } else if (
        paymentId &&
        typeof invoiceEmailService.sendInvoiceEmailByPayment === "function"
      ) {
        invoiceEmail = await invoiceEmailService.sendInvoiceEmailByPayment(paymentId, {
          email: member.email,
          attachPdf: true,
          source: "finance_registration_manual",
        });
      }
    } catch (err) {
      invoiceEmail = { success: false, error: err.message };
      console.error("finance registration invoice email failed:", err);
    }

    try {
      const receiptEmailService = require("./domains/receipts/receiptEmailService");

      if (receiptId && typeof receiptEmailService.sendReceiptEmail === "function") {
        receiptEmail = await receiptEmailService.sendReceiptEmail(receiptId, {
          email: member.email,
          attach_pdf: true,
          source: "finance_registration_manual",
        });
      } else if (
        paymentId &&
        typeof receiptEmailService.sendReceiptEmailByPayment === "function"
      ) {
        receiptEmail = await receiptEmailService.sendReceiptEmailByPayment(paymentId, {
          email: member.email,
          attach_pdf: true,
          source: "finance_registration_manual",
        });
      }
    } catch (err) {
      receiptEmail = { success: false, error: err.message };
      console.error("finance registration receipt email failed:", err);
    }

    let welcome = { success: false, skipped: true };

    try {
      welcome = await sendWelcomeAfterPayment(member, payment, plan, coverage, totals);
    } catch (err) {
      welcome = { success: false, error: err.message };
      console.error("finance registration welcome email failed:", err);
    }

    console.log("Finance registration notifications completed:", {
      member_id: member.member_id,
      member_no: member.member_no,
      payment_id: paymentId,
      invoice_id: invoiceId,
      receipt_id: receiptId,
      invoice_email: invoiceEmail?.success === true,
      receipt_email: receiptEmail?.success === true,
      welcome_email: welcome?.success === true,
    });
  });

  return { queued: true, status: "queued" };
}
/* -------------------------------------------------------------------------- */
/* Main Registration                                                          */
/* -------------------------------------------------------------------------- */

async function registerFinanceMember(payload = {}) {
  const conn = await pool.getConnection();
  let committed = false;

  try {
    await conn.beginTransaction();

    const method = normalizeMethod(payload.payment_method || payload.method);
    const pendingPayment = isStripeMethod(method);
const plan = await getPlan(conn, payload);

console.log("REGISTER PAYLOAD");
console.log({
  coverage_year: payload.coverage_year,
  start_year: payload.start_year,
  coverage_start_month: payload.coverage_start_month,
  membership_start_date: payload.membership_start_date,
  birth_date: payload.birth_date,
});

const coverage = buildCoverage(payload, plan);

console.log("GENERATED COVERAGE");
console.log(coverage);
    const totals = buildTotals(payload, plan, coverage);

    if (!pendingPayment) {
      await assertManualReferenceValid(conn, method, payload);
    }

    const member = await createMemberAndUser(conn, payload, {
      pendingPayment,
      coverage,
    });

    const dependents = await createDependents(
      conn,
      member.member_id,
      payload.dependents
    );

    await recordAudit(conn, {
      user_id: payload.created_by || null,
      created_by: payload.created_by || null,
      member_id: member.member_id,
      entity_id: member.member_id,
      action: "finance_member_registered",
      ip_address: payload.ip_address || null,
      user_agent: payload.user_agent || null,
      details: {
        member_no: member.member_no,
        full_name: member.full_name,
        email: member.email,
        plan_name: plan.plan_name,
        coverage_label: coverage.coverage_label,
        payment_method: method,
        pending_payment: pendingPayment,
      },
    }).catch(() => null);

    if (pendingPayment) {
      await upsertDuesSubscription(
        conn,
        member,
        plan,
        coverage,
        totals,
        payload,
        "pending_payment"
      );

      const checkout = await createStripeCheckoutSession({
        payload,
        member,
        plan,
        totals,
        coverage,
      });

      await updateExistingColumns(
        conn,
        "tbl_members",
        {
          stripe_checkout_session_id: checkout.id,
          updated_at: mysqlNow(),
        },
        "id = ?",
        [member.member_id]
      ).catch(() => null);

      await conn.commit();
      committed = true;

      return {
        ok: true,
        success: true,
        status: "pending_payment",
        payment_status: "pending",

        member_id: member.member_id,
        user_id: member.user_id,
        member_no: member.member_no,
        username: member.username,
        full_name: member.full_name,
        email: member.email,
        login_url: loginUrl(),
        requires_password_change: true,

        dependents,
        plan,
        coverage,
        totals,

        checkout_url: checkout.url,
        stripe_url: checkout.url,
        session_id: checkout.id,

        message:
          "Member created as pending payment. Redirect to Stripe to complete registration payment.",
      };
    }

    const payment = await createRegistrationPayment(
      conn,
      buildPaymentPayload(payload, member, plan, totals, coverage)
    );

    await activateRegisteredMember(conn, member, coverage, payload);

    await upsertDuesSubscription(
      conn,
      member,
      plan,
      coverage,
      totals,
      payload,
      "active"
    );

    await recordAudit(conn, {
      user_id: payload.created_by || null,
      created_by: payload.created_by || null,
      member_id: member.member_id,
      entity_id: member.member_id,
      action: "finance_member_registration_paid",
      ip_address: payload.ip_address || null,
      user_agent: payload.user_agent || null,
      details: {
        member_no: member.member_no,
        payment_method: method,
        total_amount: totals.total_amount,
        coverage_label: coverage.coverage_label,
        payment_number:
          payment?.payment?.payment_number ||
          payment?.payment_number ||
          null,
        invoice_number:
          payment?.invoice?.invoice_number ||
          payment?.invoice_number ||
          null,
        receipt_number:
          payment?.receipt?.receipt_number ||
          payment?.receipt_number ||
          null,
      },
    }).catch(() => null);

    await conn.commit();
    committed = true;

    const notifications = queueRegistrationNotifications({
      member,
      payment,
      plan,
      coverage,
      totals,
    });

    return {
      ok: true,
      success: true,
      status: "paid",
      payment_status: "paid",

      member_id: member.member_id,
      user_id: member.user_id,
      member_no: member.member_no,
      username: member.username,
      full_name: member.full_name,
      email: member.email,
      login_url: loginUrl(),
      requires_password_change: true,

      dependents,
      plan,
      coverage,
      totals,
      payment,

      payment_emails: notifications,
      welcome: notifications,
      notifications,

      message:
        "Member registration payment recorded. Invoice, receipt, and welcome emails are queued.",
    };
  } catch (err) {
    if (!committed) {
      await conn.rollback().catch((rollbackErr) => {
        console.error("registerFinanceMember rollback failed:", rollbackErr);
      });
    }

    console.error("registerFinanceMember error:", err);
    throw err;
  } finally {
    conn.release();
  }
}


async function createFinanceStripeRegistrationCheckout(payload = {}) {
  return registerFinanceMember({
    ...payload,
    payment_method: payload.payment_method || payload.method || "card",
    provider: "stripe",
    cover_processing_fee:
      payload.cover_processing_fee !== undefined
        ? payload.cover_processing_fee
        : true,
  });
}

module.exports = {
  registerFinanceMember,
  createFinanceStripeRegistrationCheckout,

  createMemberAndUser,
  createStripeCheckoutSession,

  buildCoverage,
  buildTotals,
  buildPaymentPayload,
  assignMemberNumber,
   buildMemberNoFromId,
};