// backend/services/domains/donations/donationService.js
"use strict";

const {
  insertExistingColumns,
  updateExistingColumns,
  findOne,
  findMany,
} = require("../../../utils/dbHelpers");

const {
  clean,
  nullable,
  money,
  mysqlNow,
  normalizeDonationCategory,
  donationCategoryLabel,
} = require("../../../utils/financeHelpers");

/* =========================================================
   CATEGORY MAP
========================================================= */

const DONATION_CATEGORY_META = {
  plate_collection: {
    amharic: "መባ",
    english: "Plate Collection",
  },

  candle_sale: {
    amharic: "ሻማ",
    english: "Candle Sale",
  },

  general_donation: {
    amharic: "ስጦታ",
    english: "General Donation",
  },

  tithe: {
    amharic: "አስራት",
    english: "Tithe",
  },

  vows: {
    amharic: "ስዕለት",
    english: "Vows",
  },

  baptism: {
    amharic: "ክርስትና",
    english: "Baptism",
  },

  wedding_engagement: {
    amharic: "ጋብቻ",
    english: "Wedding",
  },

  memorial_service: {
    amharic: "ፍታት",
    english: "Memorial",
  },

  pledge: {
    amharic: "ቃል ኪዳን",
    english: "Pledge",
  },

  building_fund: {
    amharic: "የህንፃ ፈንድ",
    english: "Building Fund",
  },

  charity_fund: {
    amharic: "የቸርነት ፈንድ",
    english: "Charity Fund",
  },

  auction: {
    amharic: "ጨረታ",
    english: "Auction",
  },

  other_fund: {
    amharic: "ሌላ",
    english: "Other",
  },
};

/* =========================================================
   CATEGORY HELPERS
========================================================= */

function donationCategoryDisplay(category) {
  const key = normalizeDonationCategory(category);

  const item = DONATION_CATEGORY_META[key];

  if (!item) {
    return donationCategoryLabel(key);
  }

  return `${item.amharic} — ${item.english}`;
}

function buildDonationTitle(payload = {}) {
  const display = donationCategoryDisplay(
    payload.donation_category || payload.sub_category
  );

  return `${display} Donation`;
}

/* =========================================================
   CREATE DONATION DETAIL
========================================================= */

async function createDonationDetail(conn, payload = {}) {
  const category = normalizeDonationCategory(
    payload.donation_category || payload.sub_category
  );

  const amount = money(payload.amount);

  const donationId = await insertExistingColumns(
    conn,
    "tbl_finance_donation_details",
    {
      payment_id: payload.payment_id,
      receipt_id: payload.receipt_id || null,
      invoice_id: payload.invoice_id || null,

      member_id: payload.member_id || null,
      user_id: payload.user_id || null,

      payment_number: payload.payment_number || null,
      receipt_number: payload.receipt_number || null,
      invoice_number: payload.invoice_number || null,

      donor_name: clean(
        payload.donor_name ||
          payload.full_name ||
          payload.full_name_snapshot ||
          "Anonymous Donor"
      ),

      donor_email: nullable(
        payload.donor_email ||
          payload.email ||
          payload.email_snapshot
      ),

      donor_phone: nullable(
        payload.donor_phone ||
          payload.phone ||
          payload.phone_snapshot
      ),

      donation_category: category,

      donation_label:
        payload.donation_label ||
        donationCategoryDisplay(category),

      donation_title:
        payload.donation_title ||
        buildDonationTitle(payload),

      amount,
      currency: payload.currency || "USD",

      method:
        payload.method ||
        payload.payment_method ||
        "card",

      provider:
        payload.provider ||
        payload.payment_provider ||
        "stripe",

      is_anonymous:
        payload.is_anonymous ? 1 : 0,

      dedication_name: nullable(
        payload.dedication_name
      ),

      memorial_name: nullable(
        payload.memorial_name
      ),

      tribute_type: nullable(
        payload.tribute_type
      ),

      campaign_name: nullable(
        payload.campaign_name
      ),

      fund_name: nullable(
        payload.fund_name
      ),

      church_event_name: nullable(
        payload.church_event_name
      ),

      reference_no:
        payload.reference_no ||
        payload.transaction_reference ||
        null,

      transaction_reference:
        payload.transaction_reference || null,

      payment_date:
        payload.payment_date ||
        payload.paid_at ||
        mysqlNow(),

      notes: nullable(
        payload.notes,
        3000
      ),

      created_by:
        payload.created_by || null,

      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    }
  );

  return {
    id: donationId,
    donation_category: category,
    donation_category_label:
      donationCategoryDisplay(category),
    amount,
  };
}

/* =========================================================
   UPDATE DONATION DETAIL
========================================================= */

async function updateDonationDetail(
  conn,
  donationId,
  payload = {}
) {
  const category = payload.donation_category
    ? normalizeDonationCategory(payload.donation_category)
    : undefined;

  return updateExistingColumns(
    conn,
    "tbl_finance_donation_details",
    {
      donation_category: category,

      donation_label: category
        ? donationCategoryDisplay(category)
        : payload.donation_label,

      donor_name: payload.donor_name,
      donor_email: payload.donor_email,
      donor_phone: payload.donor_phone,

      is_anonymous:
        payload.is_anonymous,

      dedication_name:
        payload.dedication_name,

      memorial_name:
        payload.memorial_name,

      tribute_type:
        payload.tribute_type,

      campaign_name:
        payload.campaign_name,

      fund_name:
        payload.fund_name,

      church_event_name:
        payload.church_event_name,

      notes: payload.notes,

      updated_at: mysqlNow(),
    },
    "id = ?",
    [donationId]
  );
}

/* =========================================================
   GET DONATION DETAIL
========================================================= */

async function getDonationDetail(conn, paymentId) {
  return findOne(
    conn,
    `
    SELECT *
    FROM tbl_finance_donation_details
    WHERE payment_id = ?
    LIMIT 1
    `,
    [paymentId]
  );
}

/* =========================================================
   LIST DONATIONS
========================================================= */

async function listDonations(conn, filters = {}) {
  const params = [];
  const where = [];

  if (filters.category) {
    where.push("d.donation_category = ?");

    params.push(
      normalizeDonationCategory(filters.category)
    );
  }

  if (filters.member_id) {
    where.push("d.member_id = ?");
    params.push(filters.member_id);
  }

  if (filters.payment_id) {
    where.push("d.payment_id = ?");
    params.push(filters.payment_id);
  }

  if (filters.is_anonymous !== undefined) {
    where.push("d.is_anonymous = ?");
    params.push(filters.is_anonymous ? 1 : 0);
  }

  if (filters.date_from) {
    where.push("DATE(d.payment_date) >= DATE(?)");
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push("DATE(d.payment_date) <= DATE(?)");
    params.push(filters.date_to);
  }

  if (filters.search) {
    const q = `%${clean(filters.search)}%`;

    where.push(`
      (
        d.donor_name LIKE ?
        OR d.donor_email LIKE ?
        OR d.donor_phone LIKE ?
        OR d.donation_category LIKE ?
        OR d.donation_label LIKE ?
        OR d.payment_number LIKE ?
        OR r.receipt_number LIKE ?
      )
    `);

    params.push(q, q, q, q, q, q, q);
  }

  const whereSql = where.length
    ? `WHERE ${where.join(" AND ")}`
    : "";

  return findMany(
    conn,
    `
    SELECT
      d.*,

      p.payment_number,
      p.payment_status,
      p.status,

      r.receipt_number,
      r.email_status,

      i.invoice_number

    FROM tbl_finance_donation_details d

    LEFT JOIN tbl_finance_payments p
      ON p.id = d.payment_id

    LEFT JOIN tbl_finance_receipts r
      ON r.payment_id = p.id

    LEFT JOIN tbl_finance_invoices i
      ON i.payment_id = p.id

    ${whereSql}

    ORDER BY d.payment_date DESC, d.id DESC
    `,
    params
  );
}

/* =========================================================
   DONOR HISTORY
========================================================= */

async function getDonorHistory(conn, memberId) {
  return listDonations(conn, {
    member_id: memberId,
  });
}

/* =========================================================
   DONATION STATS
========================================================= */

async function getDonationStats(conn, filters = {}) {
  const params = [];
  const where = [];

  if (filters.date_from) {
    where.push("DATE(payment_date) >= DATE(?)");
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push("DATE(payment_date) <= DATE(?)");
    params.push(filters.date_to);
  }

  const whereSql = where.length
    ? `WHERE ${where.join(" AND ")}`
    : "";

  const summary = await findOne(
    conn,
    `
    SELECT
      COUNT(*) AS total_donations,
      COUNT(DISTINCT member_id) AS unique_members,
      COALESCE(SUM(amount), 0) AS total_amount,
      COALESCE(AVG(amount), 0) AS average_amount
    FROM tbl_finance_donation_details
    ${whereSql}
    `,
    params
  );

  const categories = await findMany(
    conn,
    `
    SELECT
      donation_category,
      COUNT(*) AS total_count,
      COALESCE(SUM(amount), 0) AS total_amount
    FROM tbl_finance_donation_details
    ${whereSql}
    GROUP BY donation_category
    ORDER BY total_amount DESC
    `,
    params
  );

  return {
    summary: {
      total_donations: Number(summary?.total_donations || 0),
      unique_members: Number(summary?.unique_members || 0),
      total_amount: Number(summary?.total_amount || 0),
      average_amount: Number(summary?.average_amount || 0),
    },

    categories: categories.map((c) => ({
      ...c,
      donation_category_label:
        donationCategoryDisplay(c.donation_category),
      total_count: Number(c.total_count || 0),
      total_amount: Number(c.total_amount || 0),
    })),
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  DONATION_CATEGORY_META,

  donationCategoryDisplay,
  buildDonationTitle,

  createDonationDetail,
  updateDonationDetail,

  getDonationDetail,
  listDonations,
  getDonorHistory,

  getDonationStats,
};