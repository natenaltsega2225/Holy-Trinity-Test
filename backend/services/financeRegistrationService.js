// backend/services/financeRegistrationService.js

"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Stripe = require("stripe");

const pool = require("../db");

const {
  insertExistingColumns,
  updateExistingColumns,
  findOne,
} = require("../utils/dbHelpers");

const {
  clean,
  money,
  mysqlNow,
} = require("../utils/financeHelpers");

const emailService = require("./emailService");

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/* =========================================================
   HELPERS
========================================================= */

function tempPassword() {
  return crypto.randomBytes(6).toString("hex");
}

async function generateMemberNumber(conn) {
  const [[row]] = await conn.query(`
    SELECT id
    FROM tbl_members
    ORDER BY id DESC
    LIMIT 1
  `);

  const nextId = Number(row?.id || 0) + 1;

  return `M-${String(nextId).padStart(4, "0")}`;
}
function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function frontendUrl() {
  return String(
    process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function processingFee(amount) {
  const n = Number(amount || 0);
  if (n <= 0) return 0;

  return Number(((n * 0.029 + 0.3) / (1 - 0.029)).toFixed(2));
}

function isStripeMethod(method) {
  return ["card", "ach", "stripe", "stripe_card", "stripe_ach"].includes(
    String(method || "").toLowerCase()
  );
}

function normalizeMethod(method) {
  const m = String(method || "").toLowerCase();

  if (["card", "stripe", "stripe_card"].includes(m)) return "card";
  if (["ach", "stripe_ach", "bank", "bank_transfer"].includes(m)) return "ach";
  if (["check", "cash", "zelle", "bank_deposit", "manual"].includes(m)) {
    return m;
  }

  return "cash";
}

function stripePaymentMethods(method) {
  return normalizeMethod(method) === "ach" ? ["us_bank_account"] : ["card"];
}

function usernameFromNameOrEmail(fullName, email) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    const first = parts[0].toLowerCase();
    const lastInitial = parts[parts.length - 1][0].toLowerCase();
    return `${lastInitial}${first}`;
  }

  return String(email || "").split("@")[0].toLowerCase();
}

function splitName(fullName) {
  const cleaned = clean(fullName, 255);
  const parts = cleaned.split(/\s+/).filter(Boolean);

  return {
    fullName: cleaned || "Member User",
    firstName: parts[0] || "Member",
    lastName: parts.slice(1).join(" ") || "User",
  };
}

function safeMeta(value, max = 450) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function monthNumber(value) {
  const n = Number(value || 0);
  if (Number.isFinite(n) && n >= 1 && n <= 12) return n;
  return new Date().getMonth() + 1;
}

function currentYear(value) {
  const n = Number(value || 0);
  if (Number.isFinite(n) && n >= 2000 && n <= 2100) return n;
  return new Date().getFullYear();
}

/* =========================================================
   DB HELPERS
========================================================= */

async function uniqueUsername(conn, base) {
  const root = clean(base || `member${Date.now()}`, 70)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

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

async function getPlan(conn, planId) {
  if (!planId) return null;

  return findOne(
    conn,
    `
    SELECT *
    FROM tbl_finance_dues_plans
    WHERE id = ?
      AND is_active = 1
    LIMIT 1
    `,
    [planId]
  );
}

async function ensureEmailAvailable(conn, email) {
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
    throw new Error("Email already exists.");
  }

  const existingMember = await findOne(
    conn,
    `
    SELECT id
    FROM tbl_members
    WHERE LOWER(email) = ?
    LIMIT 1
    `,
    [email]
  );

  if (existingMember) {
    throw new Error("A member with this email already exists.");
  }
}

/* =========================================================
   CREATE MEMBER + USER
========================================================= */

async function createMemberAndUser(conn, payload = {}) {
  const email = clean(payload.email, 190).toLowerCase();

  if (!email) throw new Error("Email is required.");

  await ensureEmailAvailable(conn, email);

  const password = tempPassword();
  const passwordHash = await bcrypt.hash(password, 10);

 const mNo = await generateMemberNumber(conn);

  const { fullName, firstName, lastName } = splitName(payload.full_name);

  const memberId = await insertExistingColumns(conn, "tbl_members", {
    member_no: mNo,

    first_name: firstName,
    last_name: lastName,
    full_name: fullName,

    email,
    phone: payload.phone || null,

    address_line_1:
      payload.address_line_1 || payload.address1 || payload.street || null,
    address_line_2: payload.address_line_2 || payload.address2 || null,
    city: payload.city || null,
    state: payload.state || null,
    zip_code: payload.zip_code || payload.zip || null,
    country: payload.country || "USA",

    gender: payload.gender || null,
    marital_status: payload.marital_status || null,
    household_role: payload.household_role || null,

   status: payload.initial_status || "draft",
membership_status:
  payload.initial_membership_status ||
  "draft",
    joined_at: mysqlNow(),

    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });

  const username = await uniqueUsername(
    conn,
    usernameFromNameOrEmail(fullName, email)
  );

  const userId = await insertExistingColumns(conn, "tbl_users", {
    member_id: memberId,

    first_name: firstName,
    last_name: lastName,
    full_name: fullName,

    username,
    email,
    phone: payload.phone || null,

    password_hash: passwordHash,

    role: "member",
    is_active: 1,
    must_change_password: 1,

    created_at: mysqlNow(),
    updated_at: mysqlNow(),
  });

  await updateExistingColumns(
    conn,
    "tbl_members",
    {
      user_id: userId,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [memberId]
  ).catch(() => {});

  return {

  member_id: memberId,

  user_id: userId,

  member_no: mNo,

  generated_username: username,

  generated_temp_password: password,

  full_name: fullName,

  email,

  phone: payload.phone || null,
};
}

/* =========================================================
   EMAIL
========================================================= */

async function sendWelcome({
  email,
  fullName,
  memberNo,
  username,
  temporaryPassword,
  receiptNumber,
  loginUrl,
  paymentPending = false,
}) {
  if (!emailService?.sendMail || !email) return;

  await emailService.sendMail({
    to: email,
    subject: "Welcome to Holy Trinity Ethiopian Orthodox Church",
    html: `
      <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:30px;">
        <div style="max-width:720px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
          <h2 style="margin-top:0;color:#0f172a;">Welcome ${fullName}</h2>

          <p>Your Holy Trinity member account has been created by the finance team.</p>

          ${
            paymentPending
              ? `<p style="padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;color:#9a3412;">
                   Your membership payment is pending. Your account will be fully activated after payment confirmation.
                 </p>`
              : ""
          }

          <table cellpadding="8" style="border-collapse:collapse;width:100%;">
            <tr><td><strong>Member ID</strong></td><td>${memberNo}</td></tr>
            <tr><td><strong>Username</strong></td><td>${username}</td></tr>
            <tr><td><strong>Temporary Password</strong></td><td>${temporaryPassword}</td></tr>
            ${
              receiptNumber
                ? `<tr><td><strong>Receipt</strong></td><td>${receiptNumber}</td></tr>`
                : ""
            }
            <tr><td><strong>Login Link</strong></td><td><a href="${loginUrl}">${loginUrl}</a></td></tr>
          </table>

          <p style="color:#64748b;margin-top:20px;">
            Please login with your temporary password and change it on first login.
          </p>
        </div>
      </div>
    `,
  });
}

/* =========================================================
   PAYMENT PAYLOAD
========================================================= */

function buildPaymentPayload(payload, member, plan, totals) {
  const duration = Number(plan.duration_months || payload.months_paid || 1);

  return {
    member_id: member.member_id,
    member_no: member.member_no,
    user_id: member.user_id,

    full_name: member.full_name || payload.full_name,
    email: member.email || payload.email,
    phone: payload.phone,

    payment_type: "membership",
    category: "membership",
    sub_category: plan.plan_name,

    amount: totals.totalAmount,
    base_amount: totals.planAmount,
    membership_amount: totals.planAmount,
    registration_fee: totals.registrationFee,
    processing_fee: totals.processingFee,
    subtotal_amount: totals.subtotal,

    plan_id: plan.id,
    dues_plan_id: plan.id,
    plan_name: plan.plan_name,

    months_paid: duration,
    duration_months: duration,

    coverage_year: currentYear(payload.coverage_year),
    coverage_start_month: monthNumber(payload.coverage_start_month),

    method: normalizeMethod(payload.payment_method || payload.method),
    provider: isStripeMethod(payload.payment_method || payload.method)
      ? "stripe"
      : payload.provider || "manual",

    status: "paid",

    reference_no: payload.reference_no || null,
    notes: payload.notes || "Finance new member registration",

    created_by: payload.created_by,
    finance_created_by: payload.created_by,

    send_receipt_email: true,
  };
}

function buildTotals(payload, plan) {
  const planAmount = money(
    payload.membership_amount || payload.amount || plan.minimum_amount
  );

  const registrationFee = money(
    plan.registration_fee || payload.registration_fee || 0
  );

  const subtotal = money(planAmount + registrationFee);

  const processing =
    payload.cover_processing_fee ||
    payload.include_processing_fee ||
    isStripeMethod(payload.payment_method || payload.method)
      ? processingFee(subtotal)
      : 0;

  const totalAmount = money(subtotal + processing);

  return {
    planAmount,
    registrationFee,
    processingFee: processing,
    subtotal,
    totalAmount,
  };
}

/* =========================================================
   REGISTER FINANCE MEMBER
========================================================= */

async function registerFinanceMember(payload = {}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    if (!payload.full_name) throw new Error("Full name is required.");
    if (!payload.email) throw new Error("Email is required.");

    const plan = await getPlan(conn, payload.plan_id || payload.dues_plan_id);

    if (!plan) {
      throw new Error("Membership plan is required.");
    }

    const member = await createMemberAndUser(conn, payload);
    const totals = buildTotals(payload, plan);
    const method = normalizeMethod(payload.payment_method || payload.method);

    let payment = null;
    let checkout = null;

    if (isStripeMethod(method)) {
      if (!stripe) throw new Error("Stripe is not configured.");

      checkout = await createStripeCheckoutSession({
        payload,
        member,
        plan,
        totals,
        method,
      });

      await conn.commit();

      await sendWelcome({
        email: member.email,
        fullName: member.full_name,
        memberNo: member.member_no,
        username: member.username,
        temporaryPassword: member.temporary_password,
        receiptNumber: "",
        loginUrl: `${frontendUrl()}/login`,
        paymentPending: true,
      }).catch(console.error);

      return {
        ok: true,
        status: "pending_payment",
        payment_status: "pending",
        ...member,
        checkout_url: checkout.url,
        stripe_url: checkout.url,
        session_id: checkout.id,
        message: "Member created. Redirect to Stripe to complete payment.",
      };
    }

    const {
      processSuccessfulPayment,
    } = require("./paymentService");

    payment = await processSuccessfulPayment(
      conn,
      buildPaymentPayload(payload, member, plan, totals)
    );

    await conn.commit();

    await sendWelcome({
      email: member.email,
      fullName: member.full_name,
      memberNo: member.member_no,
      username: member.username,
      temporaryPassword: member.temporary_password,
      receiptNumber:
        payment?.receipt?.receipt_number || payment?.receipt_number || "",
      loginUrl: `${frontendUrl()}/login`,
      paymentPending: false,
    }).catch(console.error);

    return {
      ok: true,
      status: "paid",
      ...member,
      payment,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* =========================================================
   STRIPE CHECKOUT SESSION
========================================================= */

async function createStripeCheckoutSession({
  payload,
  member,
  plan,
  totals,
  method,
}) {
  const duration = Number(plan.duration_months || payload.months_paid || 1);
  const coverageYear = currentYear(payload.coverage_year);
  const coverageStartMonth = monthNumber(payload.coverage_start_month);

  const lineItems = [];

  if (totals.registrationFee > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: cents(totals.registrationFee),
        product_data: {
          name: "First-Time Registration Fee",
        },
      },
    });
  }

  lineItems.push({
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: cents(totals.planAmount),
      product_data: {
        name: plan.plan_name,
      },
    },
  });

  if (totals.processingFee > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: cents(totals.processingFee),
        product_data: {
          name: "Processing Fee",
        },
      },
    });
  }

  const metadata = {
    category: "membership",
    payment_type: "membership",
    type: "membership",

    checkout_type: "finance_new_member_registration",
    source: "finance",
    created_from: "finance",

    process_direct_payment: "true",

    member_id: String(member.member_id),
    member_no: safeMeta(member.member_no),
    user_id: String(member.user_id),

    username: safeMeta(member.username, 120),
    temporary_password: safeMeta(member.temporary_password, 120),

    send_welcome_email: "true",
    send_receipt_email: "true",

    full_name: safeMeta(member.full_name || payload.full_name, 180),
    email: safeMeta(member.email || payload.email, 190),
    phone: safeMeta(payload.phone || "", 50),

    plan_id: String(plan.id),
    dues_plan_id: String(plan.id),
    plan_name: safeMeta(plan.plan_name, 180),
    sub_category: safeMeta(plan.plan_name, 180),

    duration_months: String(duration),
    months_paid: String(duration),

    coverage_year: String(coverageYear),
    coverage_start_month: String(coverageStartMonth),

    amount: String(totals.totalAmount),
    total_amount: String(totals.totalAmount),
    base_amount: String(totals.planAmount),
    membership_amount: String(totals.planAmount),
    registration_fee: String(totals.registrationFee),
    processing_fee: String(totals.processingFee),
    subtotal_amount: String(totals.subtotal),

    method,
    payment_method: method,
    provider: "stripe",

    finance_created_by: String(payload.created_by || ""),
  };
  const session =
  await stripe.checkout.sessions.create({

    mode: "payment",

    payment_method_types:
      stripePaymentMethods(method),

    customer_email:
      member.email || payload.email,

    success_url:
      payload.success_url ||
      `${frontendUrl()}/dash/finance/members?registration=success&session_id={CHECKOUT_SESSION_ID}`,

    cancel_url:
      payload.cancel_url ||
      `${frontendUrl()}/dash/finance/members?registration=cancelled`,

    line_items:
      lineItems,

    metadata: {

      ...metadata,

      username:
        generatedUsername ||

        createdMember?.generated_username ||

        null,

      temporary_password:
        generatedPassword ||

        createdMember?.generated_temp_password ||

        null,

      member_no:

        createdMember?.member_no ||

        createdMember?.generated_member_no ||

        createdMember?.memberNo ||

        null,

      coverage_label:
        coverageLabel ||

        payload.coverage_label ||

        null,
    },

    payment_intent_data: {

      metadata: {

        ...metadata,

        username:
          generatedUsername ||

          createdMember?.generated_username ||

          null,

        temporary_password:
          generatedPassword ||

          createdMember?.generated_temp_password ||

          null,

        member_no:

          createdMember?.member_no ||

          createdMember?.generated_member_no ||

          createdMember?.memberNo ||

          null,

        coverage_label:
          coverageLabel ||

          payload.coverage_label ||

          null,
      },
    },
  });

  return session;
}

/* =========================================================
   LEGACY DIRECT STRIPE ENTRYPOINT
========================================================= */

async function createFinanceStripeRegistrationCheckout(payload = {}) {
  return registerFinanceMember({
    ...payload,
    payment_method: payload.payment_method || "card",
    cover_processing_fee: true,
  });
}

module.exports = {
  registerFinanceMember,
  createFinanceStripeRegistrationCheckout,
};