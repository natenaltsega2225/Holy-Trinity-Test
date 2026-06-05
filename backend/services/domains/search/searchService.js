// backend/services/domains/search/searchService.js
"use strict";

const pool =
  require("../../../db");

/* =========================================================
   HELPERS
========================================================= */

function buildLike(
  value
) {

  return `%${String(
    value || ""
  ).trim()}%`;
}

function normalizeLimit(
  value,
  fallback = 20
) {

  return Math.min(

    100,

    Math.max(
      1,
      Number(value || fallback)
    )
  );
}

/* =========================================================
   MEMBER SEARCH
========================================================= */

async function searchMembers(

  query,

  limit = 20
) {

  const q =
    buildLike(query);

  const [rows] =
    await pool.query(
      `
      SELECT

        id,

        member_no,

        full_name,

        baptismal_name,

        phone,

        email,

        membership_status,

        'member' AS result_type

      FROM tbl_members

      WHERE

        full_name LIKE ?
        OR baptismal_name LIKE ?
        OR email LIKE ?
        OR phone LIKE ?
        OR member_no LIKE ?

      ORDER BY full_name ASC

      LIMIT ?
      `,
      [
        q,
        q,
        q,
        q,
        q,
        normalizeLimit(limit),
      ]
    );

  return rows;
}

/* =========================================================
   PAYMENT SEARCH
========================================================= */

async function searchPayments(

  query,

  limit = 20
) {

  const q =
    buildLike(query);

  const [rows] =
    await pool.query(
      `
      SELECT

        id,

        payment_number,

        category,

        sub_category,

        full_name_snapshot,

        amount,

        status,

        paid_at,

        'payment' AS result_type

      FROM tbl_finance_payments

      WHERE

        payment_number LIKE ?
        OR full_name_snapshot LIKE ?
        OR category LIKE ?
        OR sub_category LIKE ?

      ORDER BY paid_at DESC

      LIMIT ?
      `,
      [
        q,
        q,
        q,
        q,
        normalizeLimit(limit),
      ]
    );

  return rows;
}

/* =========================================================
   INVOICE SEARCH
========================================================= */

async function searchInvoices(

  query,

  limit = 20
) {

  const q =
    buildLike(query);

  const [rows] =
    await pool.query(
      `
      SELECT

        id,

        invoice_number,

        full_name_snapshot,

        invoice_type,

        total_amount,

        balance_due,

        status,

        issue_date,

        'invoice' AS result_type

      FROM tbl_finance_invoices

      WHERE

        invoice_number LIKE ?
        OR full_name_snapshot LIKE ?
        OR invoice_type LIKE ?

      ORDER BY issue_date DESC

      LIMIT ?
      `,
      [
        q,
        q,
        q,
        normalizeLimit(limit),
      ]
    );

  return rows;
}

/* =========================================================
   RECEIPT SEARCH
========================================================= */

async function searchReceipts(

  query,

  limit = 20
) {

  const q =
    buildLike(query);

  const [rows] =
    await pool.query(
      `
      SELECT

        r.id,

        r.receipt_number,

        r.email_status,

        r.created_at,

        p.payment_number,

        p.full_name_snapshot,

        p.amount,

        'receipt' AS result_type

      FROM tbl_finance_receipts r

      LEFT JOIN tbl_finance_payments p
        ON p.id = r.payment_id

      WHERE

        r.receipt_number LIKE ?
        OR p.payment_number LIKE ?
        OR p.full_name_snapshot LIKE ?

      ORDER BY r.created_at DESC

      LIMIT ?
      `,
      [
        q,
        q,
        q,
        normalizeLimit(limit),
      ]
    );

  return rows;
}

/* =========================================================
   EVENT SEARCH
========================================================= */

async function searchEvents(

  query,

  limit = 20
) {

  const q =
    buildLike(query);

  const [rows] =
    await pool.query(
      `
      SELECT

        id,

        category,

        title,

        location,

        start_date,

        end_date,

        is_published,

        'event' AS result_type

      FROM tbl_news_events

      WHERE

        title LIKE ?
        OR category LIKE ?
        OR location LIKE ?

      ORDER BY start_date DESC

      LIMIT ?
      `,
      [
        q,
        q,
        q,
        normalizeLimit(limit),
      ]
    );

  return rows;
}

/* =========================================================
   VOLUNTEER SEARCH
========================================================= */

async function searchVolunteers(

  query,

  limit = 20
) {

  const q =
    buildLike(query);

  const [rows] =
    await pool.query(
      `
      SELECT

        id,

        full_name,

        email,

        phone,

        status,

        created_at,

        'volunteer' AS result_type

      FROM tbl_volunteer_applications

      WHERE

        full_name LIKE ?
        OR email LIKE ?
        OR phone LIKE ?

      ORDER BY created_at DESC

      LIMIT ?
      `,
      [
        q,
        q,
        q,
        normalizeLimit(limit),
      ]
    );

  return rows;
}

/* =========================================================
   GLOBAL SEARCH
========================================================= */

async function globalSearch(
  payload = {}
) {

  const query =
    payload.query || "";

  const limit =
    normalizeLimit(
      payload.limit,
      10
    );

  const [

    members,

    payments,

    invoices,

    receipts,

    events,

    volunteers,

  ] = await Promise.all([

    searchMembers(
      query,
      limit
    ),

    searchPayments(
      query,
      limit
    ),

    searchInvoices(
      query,
      limit
    ),

    searchReceipts(
      query,
      limit
    ),

    searchEvents(
      query,
      limit
    ),

    searchVolunteers(
      query,
      limit
    ),
  ]);

  return {

    members,

    payments,

    invoices,

    receipts,

    events,

    volunteers,

    total:

      members.length +
      payments.length +
      invoices.length +
      receipts.length +
      events.length +
      volunteers.length,
  };
}

/* =========================================================
   MODULE SEARCH
========================================================= */

async function searchByModule(
  module,
  query,
  limit = 20
) {

  switch (
    String(module || "")
      .toLowerCase()
  ) {

    case "members":

      return searchMembers(
        query,
        limit
      );

    case "payments":

      return searchPayments(
        query,
        limit
      );

    case "invoices":

      return searchInvoices(
        query,
        limit
      );

    case "receipts":

      return searchReceipts(
        query,
        limit
      );

    case "events":

      return searchEvents(
        query,
        limit
      );

    case "volunteers":

      return searchVolunteers(
        query,
        limit
      );

    default:

      return [];
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  searchMembers,

  searchPayments,

  searchInvoices,

  searchReceipts,

  searchEvents,

  searchVolunteers,

  globalSearch,

  searchByModule,
};