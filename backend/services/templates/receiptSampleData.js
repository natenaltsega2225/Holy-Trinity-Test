

// backend\services\templates\receiptSampleData.js
"use strict";

/*
=========================================================
 ENTERPRISE RECEIPT SAMPLE DATA
---------------------------------------------------------
 Backend-only receipt template system

 Supports:
 - Membership receipts
 - Donation receipts
 - School receipts
 - Trip receipts
 - Manual finance receipts
 - Stripe receipts
 - Coverage month rendering
 - Ledger-ready receipt metadata
=========================================================
*/

/* =========================================================
   CHURCH INFO
========================================================= */

const churchInfo = {

  amharicName:
    "ቅድስት ሥላሴ ቤተ ክርስቲያን",

  englishName:
    "Holy Trinity Ethiopian Orthodox Church",

  phone:
    "615-674-7405",

  address:
    "2558 Couchville Pike, Nashville, TN 37217",

  city:
    "Nashville",

  state:
    "TN",

  zip:
    "37217",

  country:
    "USA",

  website:
    "https://hamsalomi.org",

  email:
    "info@hamsalomi.org",
};

/* =========================================================
   DONATION CATEGORY LABELS
========================================================= */

const CATEGORY_LABELS = {

  plate_collection:
    "መባ — Plate Collection",

  candle_sale:
    "ሻማ — Candle Sale",

  general_donation:
    "ስጦታ — General Donation",

  tithe:
    "አስራት — Tithe",

  vows:
    "ስዕለት — Vows",

  baptism:
    "ክርስትና — Baptism",

  wedding_engagement:
    "ጋብቻ / ቀለበት — Wedding / Engagement",

  memorial_service:
    "ፍታት — Memorial Service",

  pledge:
    "ቃል የተገባ — Pledge",

  building_fund:
    "የቤተክርስቲያን ማሰሪያ — Building Fund",

  charity_fund:
    "በጎ አድራጎት — Charity Fund",

  auction:
    "ጨረታ — Auction",

  other_fund:
    "ሌላ — Other Fund",

  sunday_cash_collection:
    "የእሁድ ስብስብ — Sunday Collection",
};

/* =========================================================
   HELPERS
========================================================= */

function moneyWords(amount) {

  const n =
    Number(amount || 0);

  return `${n.toLocaleString(
    "en-US"
  )} dollars only`;
}

function buildCoverageMonths(
  startDate,
  endDate
) {

  if (
    !startDate ||
    !endDate
  ) {
    return [];
  }

  const start =
    new Date(startDate);

  const end =
    new Date(endDate);

  if (
    Number.isNaN(
      start.getTime()
    ) ||

    Number.isNaN(
      end.getTime()
    )
  ) {
    return [];
  }

  const rows = [];

  const current =
    new Date(
      start.getFullYear(),
      start.getMonth(),
      1
    );

  const last =
    new Date(
      end.getFullYear(),
      end.getMonth(),
      1
    );

  while (
    current <= last
  ) {

    rows.push({

      label:
        current.toLocaleDateString(
          "en-US",
          {
            month:
              "long",

            year:
              "numeric",
          }
        ),

      checked: true,

      status:
        "Paid",
    });

    current.setMonth(
      current.getMonth() +
        1
    );
  }

  return rows;
}

/* =========================================================
   BASE RECEIPT
========================================================= */

function baseReceipt(
  overrides = {}
) {

  return {

    serialNo:
      "5600",

    receiptNo:
      "RCPT-000000",

    titleAmharic:
      "የገንዘብ መቀበያ ደረሰኝ",

    titleEnglish:
      "Cash Receipt",

    paidBy:
      "",

    memberType:
      "member",

    membershipId:
      "",

    date:
      new Date().toISOString(),

    method:
      "Card",

    paymentSource:
      "Stripe",

    receivedBy:
      "Finance Office",

    accountant:
      "Church Accountant",

    total:
      0,

    totalInWords:
      "",

    notes:
      "",

    rows:
      [],

    meta:
      {},

    ...overrides,
  };
}

/* =========================================================
   MEMBERSHIP RECEIPT
========================================================= */

const sampleMembershipReceipt = {

  church:
    churchInfo,

  receipt:
    baseReceipt({

      serialNo:
        "5609",

      receiptNo:
        "RCPT-2026-000999",

      titleAmharic:
        "የአባልነት ክፍያ ደረሰኝ",

      titleEnglish:
        "Membership Payment Receipt",

      paidBy:
        "Sample Member",

      memberType:
        "member",

      membershipId:
        "HT-00123",

      date:
        "2026-06-01",

      method:
        "VISA •••• 4242",

      total:
        300,

      totalInWords:
        moneyWords(300),

      rows: [
        {
          code:
            "01",

          type:
            "Membership Dues / የአባልነት ክፍያ",

          amount:
            300,

          remark:
            "3 Month Membership Plan",
        },
      ],

      meta: {

        payment_number:
          "PAY-2026-000999",

        invoice_number:
          "INV-2026-000999",

        receipt_number:
          "RCPT-2026-000999",

        plan_name:
          "Quarterly Membership",

        duration_months:
          3,

        months_paid:
          3,

        period_start:
          "2026-05-01",

        period_end:
          "2026-07-31",

        coverage_label:
          "May 2026 - July 2026",

        coverageMonths:
          buildCoverageMonths(
            "2026-05-01",
            "2026-07-31"
          ),

        card_brand:
          "visa",

        card_last4:
          "4242",

        stripe_payment_intent_id:
          "pi_123456789",
      },
    }),
};

/* =========================================================
   DONATION RECEIPT
========================================================= */

const sampleDonationReceipt = {

  church:
    churchInfo,

  receipt:
    baseReceipt({

      serialNo:
        "5610",

      receiptNo:
        "RCPT-2026-000200",

      titleAmharic:
        "የስጦታ ደረሰኝ",

      titleEnglish:
        "Donation Receipt",

      paidBy:
        "Guest Donor",

      memberType:
        "non_member",

      method:
        "Mastercard •••• 4444",

      total:
        75,

      totalInWords:
        moneyWords(75),

      rows: [
        {
          code:
            "11",

          type:
            CATEGORY_LABELS.general_donation,

          amount:
            75,

          remark:
            "General Church Donation",
        },
      ],

      meta: {

        payment_number:
          "PAY-2026-000200",

        invoice_number:
          "INV-2026-000200",

        donation_category:
          "general_donation",

        category_label:
          CATEGORY_LABELS.general_donation,

        card_brand:
          "mastercard",

        card_last4:
          "4444",
      },
    }),
};

/* =========================================================
   SCHOOL RECEIPT
========================================================= */

const sampleSchoolReceipt = {

  church:
    churchInfo,

  receipt:
    baseReceipt({

      serialNo:
        "5607",

      receiptNo:
        "RCPT-2026-000147",

      titleAmharic:
        "የህፃናት ትምህርት ክፍያ ደረሰኝ",

      titleEnglish:
        "Kids School Program Receipt",

      paidBy:
        "Meseret Adem",

      memberType:
        "member",

      membershipId:
        "HTEOTC-000482",

      total:
        150,

      totalInWords:
        moneyWords(150),

      rows: [
        {
          code:
            "21",

          type:
            "Kids School Program / የህፃናት ትምህርት",

          amount:
            150,

          remark:
            "Program Registration",
        },
      ],

      meta: {

        payment_number:
          "PAY-2026-000147",

        invoice_number:
          "INV-2026-000147",

        program_name:
          "Sunday School",

        participants:
          1,

        price_per_person:
          150,
      },
    }),
};

/* =========================================================
   TRIP RECEIPT
========================================================= */

const sampleTripReceipt = {

  church:
    churchInfo,

  receipt:
    baseReceipt({

      serialNo:
        "5608",

      receiptNo:
        "RCPT-2026-000148",

      titleAmharic:
        "የጉዞ ክፍያ ደረሰኝ",

      titleEnglish:
        "Trip Program Receipt",

      paidBy:
        "Nigusea Dessie",

      memberType:
        "member",

      membershipId:
        "HTEOTC-000483",

      method:
        "Zelle",

      paymentSource:
        "Manual",

      total:
        250,

      totalInWords:
        moneyWords(250),

      rows: [
        {
          code:
            "31",

          type:
            "Trip Program / የጉዞ ፕሮግራም",

          amount:
            250,

          remark:
            "Church Retreat Fee",
        },
      ],

      meta: {

        payment_number:
          "PAY-2026-000148",

        invoice_number:
          "INV-2026-000148",

        program_name:
          "Church Retreat",

        participants:
          1,

        price_per_person:
          250,
      },
    }),
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  churchInfo,

  CATEGORY_LABELS,

  moneyWords,

  buildCoverageMonths,

  baseReceipt,

  sampleMembershipReceipt,

  sampleDonationReceipt,

  sampleSchoolReceipt,

  sampleTripReceipt,
};