
// backend\services\templates\receiptTemplates.js
"use strict";

/*
=========================================================
 ENTERPRISE RECEIPT TEMPLATE SYSTEM
---------------------------------------------------------
 Supports:
 - Membership receipts
 - Donation receipts
 - School receipts
 - Trip receipts
 - Manual finance receipts
 - Stripe receipts
 - Coverage rendering
 - Invoice linkage
 - Card metadata
 - Enterprise PDF/email rendering
=========================================================
*/

const {

  sampleMembershipReceipt,

  sampleDonationReceipt,

  sampleSchoolReceipt,

  sampleTripReceipt,

  churchInfo,

  CATEGORY_LABELS,

  buildCoverageMonths,

} = require(
  "./receiptSampleData"
);

/* =====================================================
   HELPERS
===================================================== */

function clean(
  value,
  fallback = "--"
) {

  const v =
    String(
      value ?? ""
    ).trim();

  return v || fallback;
}

function money(
  value
) {

  const n =
    Number(value || 0);

  return `$${n.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function formatDate(
  value
) {

  if (!value) {
    return "--";
  }

  const d =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return "--";
  }

  return d.toLocaleDateString(
    "en-US",
    {
      month:
        "2-digit",

      day:
        "2-digit",

      year:
        "numeric",
    }
  );
}

function pretty(
  value
) {

  if (!value) {
    return "--";
  }

  return String(value)
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (m) =>
        m.toUpperCase()
    );
}

function numberToWords(
  value
) {

  const num =
    Number(value || 0);

  if (!num) {
    return "Zero dollars only";
  }

  return `${money(num)} only`;
}

/* =====================================================
   CATEGORY
===================================================== */

function normalizeCategory(
  value
) {

  const v =
    clean(
      value,
      "other"
    ).toLowerCase();

  if (
    [
      "membership",
      "dues",
      "member_dues",
      "membership_dues",
      "registration_fee",
    ].includes(v)
  ) {
    return "membership";
  }

  if (
    [
      "school",
      "kids",
      "kids_school",
      "school_program",
    ].includes(v)
  ) {
    return "school";
  }

  if (
    [
      "trip",
      "travel",
    ].includes(v)
  ) {
    return "trip";
  }

  if (
    [
      "donation",
      "giving",
      "tithe",
    ].includes(v)
  ) {
    return "donation";
  }

  return v;
}

function normalizeDonationCategory(
  value
) {

  const v =
    clean(
      value,
      "general_donation"
    )
      .toLowerCase()
      .replace(
        /\s+/g,
        "_"
      );

  return {

    value: v,

    label:
      CATEGORY_LABELS[v] ||
      pretty(v),
  };
}

/* =====================================================
   COVERAGE
===================================================== */

function buildCoverageLabel(
  row
) {

  if (
    row.coverage_label
  ) {
    return row.coverage_label;
  }

  if (
    row.period_label
  ) {
    return row.period_label;
  }

  if (
    row.coverage_start &&
    row.coverage_end
  ) {

    return `${formatDate(
      row.coverage_start
    )} → ${formatDate(
      row.coverage_end
    )}`;
  }

  return "--";
}

function buildCardLabel(
  row
) {

  if (
    !row.card_brand ||
    !row.card_last4
  ) {
    return "--";
  }

  return `${String(
    row.card_brand
  ).toUpperCase()} •••• ${
    row.card_last4
  }`;
}

/* =====================================================
   ROW BUILDERS
===================================================== */

function membershipRows(
  row
) {

  return [
    {

      code:
        "01",

      type:
        "Membership Dues / የአባልነት ክፍያ",

      amount:
        Number(
          row.amount || 0
        ),

      remark:
        row.plan_name ||
        row.sub_category ||
        "Membership Plan",

      coverage_months:
        buildCoverageMonths(
          row.coverage_start,
          row.coverage_end
        ),

      coverage_label:
        buildCoverageLabel(
          row
        ),

      months_paid:
        Number(
          row.months_paid || 1
        ),
    },
  ];
}

function donationRows(
  row
) {

  const donation =
    normalizeDonationCategory(
      row.sub_category ||
      row.donation_category ||
      row.category
    );

  return [
    {

      code:
        "11",

      type:
        "Donation / ስጦታ",

      amount:
        Number(
          row.amount || 0
        ),

      remark:
        donation.label,

      donation_category:
        donation.label,
    },
  ];
}

function schoolRows(
  row
) {

  return [
    {

      code:
        "21",

      type:
        "Kids School Program / የህፃናት ትምህርት",

      amount:
        Number(
          row.amount || 0
        ),

      remark:
        row.program_name ||
        row.sub_category ||
        "School Program",

      participants:
        Number(
          row.quantity || 1
        ),
    },
  ];
}

function tripRows(
  row
) {

  return [
    {

      code:
        "31",

      type:
        "Trip Program / የጉዞ ፕሮግራም",

      amount:
        Number(
          row.amount || 0
        ),

      remark:
        row.program_name ||
        row.sub_category ||
        "Trip Program",

      participants:
        Number(
          row.quantity || 1
        ),
    },
  ];
}

/* =====================================================
   META
===================================================== */

function buildMeta(
  row
) {

  const category =
    normalizeCategory(
      row.category ||
      row.payment_type
    );

  const meta = {

    payment_number:
      row.payment_number ||
      "--",

    invoice_number:
      row.invoice_number ||
      "--",

    receipt_number:
      row.receipt_number ||
      "--",

    payment_method:
      pretty(
        row.payment_method ||
        row.method
      ),

    payment_source:
      pretty(
        row.payment_source ||
        row.provider
      ),

    card:
      buildCardLabel(
        row
      ),

    email:
      row.email ||
      row.email_snapshot ||
      "--",

    phone:
      row.phone ||
      row.phone_snapshot ||
      "--",

    created_at:
      formatDate(
        row.paid_at ||
        row.created_at
      ),
  };

  if (
    category ===
    "membership"
  ) {

    meta.plan_name =
      row.plan_name ||
      row.sub_category ||
      "--";

    meta.months_paid =
      Number(
        row.months_paid || 1
      );

    meta.coverage_label =
      buildCoverageLabel(
        row
      );

    meta.coverage_months =
      buildCoverageMonths(
        row.coverage_start,
        row.coverage_end
      );

    meta.coverage_start =
      formatDate(
        row.coverage_start
      );

    meta.coverage_end =
      formatDate(
        row.coverage_end
      );
  }

  if (
    category ===
    "donation"
  ) {

    meta.donation_category =
      normalizeDonationCategory(
        row.sub_category ||
        row.donation_category
      ).label;
  }

  if (
    category ===
      "school" ||

    category ===
      "trip"
  ) {

    meta.program_name =
      row.program_name ||
      row.sub_category ||
      "--";

    meta.participants =
      Number(
        row.quantity || 1
      );
  }

  return meta;
}

/* =====================================================
   MAIN RECEIPT BUILDER
===================================================== */

function buildReceipt(
  row = {}
) {

  const category =
    normalizeCategory(
      row.category ||
      row.payment_type
    );

  let template =
    sampleMembershipReceipt;

  if (
    category ===
    "donation"
  ) {
    template =
      sampleDonationReceipt;
  }

  if (
    category ===
    "school"
  ) {
    template =
      sampleSchoolReceipt;
  }

  if (
    category ===
    "trip"
  ) {
    template =
      sampleTripReceipt;
  }

  let rows = [];

  if (
    category ===
    "membership"
  ) {
    rows =
      membershipRows(row);
  }

  if (
    category ===
    "donation"
  ) {
    rows =
      donationRows(row);
  }

  if (
    category ===
    "school"
  ) {
    rows =
      schoolRows(row);
  }

  if (
    category ===
    "trip"
  ) {
    rows =
      tripRows(row);
  }

  return {

    church:
      churchInfo,

    receipt: {

      ...template.receipt,

      serialNo:
        row.id ||
        template.receipt.serialNo,

      receiptNo:
        row.receipt_number ||
        template.receipt.receiptNo,

      invoiceNo:
        row.invoice_number ||
        "--",

      paymentNo:
        row.payment_number ||
        "--",

      titleAmharic:
        template.receipt.titleAmharic,

      titleEnglish:
        template.receipt.titleEnglish,

      paidBy:
        row.full_name ||
        row.full_name_snapshot ||
        row.member_name ||
        template.receipt.paidBy,

      memberType:
        row.member_id
          ? "member"
          : "non_member",

      membershipId:
        row.member_no ||
        row.membership_no ||
        template.receipt.membershipId,

      date:
        row.paid_at ||
        row.created_at ||
        new Date(),

      method:
        pretty(
          row.payment_method ||
          row.method
        ),

      paymentSource:
        pretty(
          row.payment_source ||
          row.provider
        ),

      receivedBy:
        row.received_by ||
        "Finance Office",

      accountant:
        row.accountant ||
        "Church Accountant",

      total:
        Number(
          row.amount || 0
        ),

      totalInWords:
        numberToWords(
          row.amount
        ),

      notes:
        row.description ||
        row.notes ||
        "",

      rows,

      meta:
        buildMeta(row),
    },
  };
}

/* =====================================================
   EXPORTS
===================================================== */

module.exports = {

  buildReceipt,

  buildCoverageMonths,

  buildCoverageLabel,

  normalizeCategory,

  normalizeDonationCategory,
};