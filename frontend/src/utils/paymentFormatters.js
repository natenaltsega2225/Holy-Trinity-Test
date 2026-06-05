// src/utils/paymentFormatters.js
// frontend/src/utils/paymentFormatters.js

/* =========================================================
   CATEGORY LABELS
========================================================= */

export const CATEGORY_LABELS = {

  /* ================= DONATIONS ================= */

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

  /* ================= CORE ================= */

  membership:
    "Membership Dues",

  donation:
    "Donation",

  school:
    "Kids School",

  trip:
    "Trip Program",

  manual:
    "Manual Entry",

  invoice:
    "Invoice",

  receipt:
    "Receipt",

  dues:
    "Membership Dues",

  membership_dues:
    "Membership Dues",
};

/* =========================================================
   MONEY
========================================================= */

export function money(
  value
) {

  return `$${Number(
    value || 0
  ).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

/* =========================================================
   DATE
========================================================= */

export function formatDate(
  value
) {

  if (!value) {
    return "--";
  }

  const d =
    new Date(value);

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
      month: "short",
      day: "2-digit",
      year: "numeric",
    }
  );
}

/* =========================================================
   TEXT HELPERS
========================================================= */

export function pretty(
  value
) {

  if (!value) {
    return "--";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (c) => c.toUpperCase()
    );
}

/* =========================================================
   CATEGORY LABEL
========================================================= */

export function categoryLabel(
  value
) {

  if (!value) {
    return "--";
  }

  const key = String(
    value
  )
    .trim()
    .toLowerCase();

  return (
    CATEGORY_LABELS[
      key
    ] || pretty(key)
  );
}

/* =========================================================
   PAYMENT SOURCE
========================================================= */

export function paymentSource(
  value
) {

  if (!value) {
    return "--";
  }

  return pretty(value);
}

/* =========================================================
   CARD DISPLAY
========================================================= */

export function cardDisplay(
  row = {}
) {

  if (
    !row.card_last4
  ) {

    return "--";
  }

  return `${String(
    row.card_brand ||
      "CARD"
  ).toUpperCase()} •••• ${row.card_last4}`;
}

/* =========================================================
   COVERAGE DISPLAY
========================================================= */

export function coverageDisplay(
  row = {}
) {

  if (
    row.coverage_label
  ) {

    return row.coverage_label;
  }

  const start =
    row.coverage_start ||
    row.period_start;

  const end =
    row.coverage_end ||
    row.period_end;

  if (
    !start ||
    !end
  ) {

    return "--";
  }

  const s =
    new Date(start);

  const e =
    new Date(end);

  if (
    Number.isNaN(
      s.getTime()
    ) ||
    Number.isNaN(
      e.getTime()
    )
  ) {

    return "--";
  }

  const fmt = (d) =>
    d.toLocaleDateString(
      "en-US",
      {
        month: "short",
        year: "numeric",
      }
    );

  return `${fmt(s)} - ${fmt(e)}`;
}

/* =========================================================
   BUILD COVERAGE MONTHS
========================================================= */

export function buildCoverageMonths(
  row = {}
) {

  const start =
    row.coverage_start ||
    row.period_start;

  const end =
    row.coverage_end ||
    row.period_end;

  if (
    !start ||
    !end
  ) {

    return [];
  }

  const s =
    new Date(start);

  const e =
    new Date(end);

  if (
    Number.isNaN(
      s.getTime()
    ) ||
    Number.isNaN(
      e.getTime()
    )
  ) {

    return [];
  }

  const months = [];

  const current =
    new Date(
      s.getFullYear(),
      s.getMonth(),
      1
    );

  const last =
    new Date(
      e.getFullYear(),
      e.getMonth(),
      1
    );

  while (
    current <= last
  ) {

    months.push(
      current.toLocaleDateString(
        "en-US",
        {
          month: "short",
          year: "numeric",
        }
      )
    );

    current.setMonth(
      current.getMonth() +
        1
    );
  }

  return months;
}