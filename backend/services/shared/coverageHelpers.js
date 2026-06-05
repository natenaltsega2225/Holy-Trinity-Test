// backend/services/shared/coverageHelpers.js
"use strict";

/*
=========================================================
 ENTERPRISE MEMBERSHIP COVERAGE HELPERS
---------------------------------------------------------
 Shared coverage normalization layer

 Used by:
 - receipts
 - invoices
 - membership dues
 - dashboards
 - reconciliation
 - overdue calculations
 - payment engine
=========================================================
*/

/* =========================================================
   MONTHS
========================================================= */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* =========================================================
   CLEAN
========================================================= */

function clean(value, fallback = "") {
  const v = String(value ?? "").trim();

  return v || fallback;
}

/* =========================================================
   SAFE JSON
========================================================= */

function safeJson(value, fallback = []) {
  try {
    if (!value) return fallback;

    if (Array.isArray(value)) {
      return value;
    }

    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/* =========================================================
   MONTH INDEX
========================================================= */

function monthIndex(month) {
  const normalized =
    clean(month)
      .toLowerCase();

  return MONTHS.findIndex(
    (m) =>
      m.toLowerCase() === normalized
  );
}

/* =========================================================
   NORMALIZE MONTH
========================================================= */

function normalizeMonth(month) {
  const idx = monthIndex(month);

  if (idx < 0) {
    return MONTHS[0];
  }

  return MONTHS[idx];
}

/* =========================================================
   BUILD COVERAGE MONTHS
========================================================= */

function buildCoverageMonths({
  coverage_year,
  coverage_start_month,
  months_paid = 1,
} = {}) {
  const year =
    Number(coverage_year) ||
    new Date().getFullYear();

  const totalMonths =
    Math.max(
      1,
      Number(months_paid || 1)
    );

  const startIndex =
    monthIndex(
      coverage_start_month
    ) >= 0
      ? monthIndex(
          coverage_start_month
        )
      : new Date().getMonth();

  const rows = [];

  for (
    let i = 0;
    i < totalMonths;
    i++
  ) {
    const idx =
      (startIndex + i) % 12;

    const yearOffset =
      Math.floor(
        (startIndex + i) / 12
      );

    rows.push({
      month: MONTHS[idx],
      year:
        year + yearOffset,
      label: `${MONTHS[idx]} ${
        year + yearOffset
      }`,
    });
  }

  return rows;
}

/* =========================================================
   BUILD COVERAGE LABEL
========================================================= */

function buildCoverageLabel({
  coverage_year,
  coverage_start_month,
  months_paid,
} = {}) {
  const rows =
    buildCoverageMonths({
      coverage_year,
      coverage_start_month,
      months_paid,
    });

  if (!rows.length) {
    return "--";
  }

  if (rows.length === 1) {
    return rows[0].label;
  }

  return `${rows[0].label} - ${
    rows[rows.length - 1].label
  }`;
}

/* =========================================================
   BUILD COVERAGE PAYLOAD
========================================================= */

function buildCoveragePayload({
  coverage_year,
  coverage_start_month,
  months_paid,
  coverage_months_json,
} = {}) {
  let months =
    safeJson(
      coverage_months_json,
      []
    );

  if (!months.length) {
    months =
      buildCoverageMonths({
        coverage_year,
        coverage_start_month,
        months_paid,
      });
  }

  return {
    coverage_year:
      Number(coverage_year) ||
      new Date().getFullYear(),

    coverage_start_month:
      normalizeMonth(
        coverage_start_month ||
          MONTHS[
            new Date().getMonth()
          ]
      ),

    months_paid:
      Number(months_paid || 1),

    coverage_months: months,

    coverage_months_json:
      JSON.stringify(months),

    coverage_label:
      buildCoverageLabel({
        coverage_year,
        coverage_start_month,
        months_paid,
      }),
  };
}

/* =========================================================
   DISPLAY COVERAGE
========================================================= */

function coverageDisplay(row = {}) {
  if (row.coverage_label) {
    return row.coverage_label;
  }

  if (
    row.coverage_start &&
    row.coverage_end
  ) {
    return `${row.coverage_start} - ${row.coverage_end}`;
  }

  const payload =
    buildCoveragePayload({
      coverage_year:
        row.coverage_year,

      coverage_start_month:
        row.coverage_start_month,

      months_paid:
        row.months_paid,

      coverage_months_json:
        row.coverage_months_json,
    });

  return payload.coverage_label;
}

/* =========================================================
   BUILD COVERAGE CHIPS
========================================================= */

function buildCoverageChips(row = {}) {
  const payload =
    buildCoveragePayload({
      coverage_year:
        row.coverage_year,

      coverage_start_month:
        row.coverage_start_month,

      months_paid:
        row.months_paid,

      coverage_months_json:
        row.coverage_months_json,
    });

  return payload.coverage_months.map(
    (m) => ({
      label: m.label,
      month: m.month,
      year: m.year,
    })
  );
}

/* =========================================================
   CHECK MONTH PAID
========================================================= */

function isMonthCovered({
  month,
  year,
  coverage_months_json,
} = {}) {
  const rows =
    safeJson(
      coverage_months_json,
      []
    );

  return rows.some(
    (r) =>
      String(r.month) ===
        String(month) &&
      Number(r.year) ===
        Number(year)
  );
}

/* =========================================================
   NEXT COVERAGE MONTH
========================================================= */

function nextCoverageMonth(row = {}) {
  const rows =
    safeJson(
      row.coverage_months_json,
      []
    );

  if (!rows.length) {
    return null;
  }

  const last =
    rows[rows.length - 1];

  let idx =
    monthIndex(last.month);

  idx += 1;

  let year =
    Number(last.year);

  if (idx >= 12) {
    idx = 0;
    year += 1;
  }

  return {
    month: MONTHS[idx],
    year,
    label: `${MONTHS[idx]} ${year}`,
  };
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  MONTHS,

  normalizeMonth,

  buildCoverageMonths,
  buildCoverageLabel,
  buildCoveragePayload,

  buildCoverageChips,
  coverageDisplay,

  isMonthCovered,
  nextCoverageMonth,
};