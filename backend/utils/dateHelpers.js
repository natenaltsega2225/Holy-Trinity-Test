//backend\utils\dateHelpers.js
"use strict";

/*
=========================================================
 ENTERPRISE DATE HELPERS
---------------------------------------------------------
 Centralized finance + membership date utilities
=========================================================
*/

/* =========================================================
   HELPERS
========================================================= */

function toDate(value) {

  if (!value) {
    return null;
  }

  const d =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(d.getTime())
    ? null
    : d;
}

function cloneDate(date) {

  return new Date(
    date.getTime()
  );
}

function pad(value) {

  return String(value)
    .padStart(2, "0");
}

/* =========================================================
   MYSQL DATETIME
========================================================= */

function mysqlDateTime(
  value = new Date()
) {

  const d =
    toDate(value);

  if (!d) {
    return null;
  }

  return (
    `${d.getFullYear()}-` +
    `${pad(d.getMonth() + 1)}-` +
    `${pad(d.getDate())} ` +
    `${pad(d.getHours())}:` +
    `${pad(d.getMinutes())}:` +
    `${pad(d.getSeconds())}`
  );
}

/* =========================================================
   MYSQL DATE
========================================================= */

function mysqlDate(
  value = new Date()
) {

  const d =
    toDate(value);

  if (!d) {
    return null;
  }

  return (
    `${d.getFullYear()}-` +
    `${pad(d.getMonth() + 1)}-` +
    `${pad(d.getDate())}`
  );
}

/* =========================================================
   ADD MONTHS
========================================================= */

function addMonths(
  date,
  months
) {

  const d =
    cloneDate(
      toDate(date)
    );

  d.setMonth(
    d.getMonth() + Number(months || 0)
  );

  return d;
}

/* =========================================================
   ADD DAYS
========================================================= */

function addDays(
  date,
  days
) {

  const d =
    cloneDate(
      toDate(date)
    );

  d.setDate(
    d.getDate() + Number(days || 0)
  );

  return d;
}

/* =========================================================
   START OF MONTH
========================================================= */

function startOfMonth(
  date = new Date()
) {

  const d =
    cloneDate(
      toDate(date)
    );

  d.setDate(1);

  d.setHours(
    0,
    0,
    0,
    0
  );

  return d;
}

/* =========================================================
   END OF MONTH
========================================================= */

function endOfMonth(
  date = new Date()
) {

  const d =
    cloneDate(
      toDate(date)
    );

  d.setMonth(
    d.getMonth() + 1
  );

  d.setDate(0);

  d.setHours(
    23,
    59,
    59,
    999
  );

  return d;
}

/* =========================================================
   MEMBERSHIP COVERAGE
========================================================= */

function calculateCoverage({

  startDate = new Date(),

  monthsPaid = 1,
}) {

  const coverageStart =
    startOfMonth(startDate);

  const coverageEnd =
    endOfMonth(
      addMonths(
        coverageStart,
        monthsPaid - 1
      )
    );

  return {

    coverage_start:
      mysqlDate(
        coverageStart
      ),

    coverage_end:
      mysqlDate(
        coverageEnd
      ),

    coverage_label:
      buildCoverageLabel(
        coverageStart,
        coverageEnd
      ),
  };
}

/* =========================================================
   COVERAGE LABEL
========================================================= */

function buildCoverageLabel(
  startDate,
  endDate
) {

  const start =
    toDate(startDate);

  const end =
    toDate(endDate);

  if (!start || !end) {
    return null;
  }

  const options = {
    year: "numeric",
    month: "short",
  };

  const startLabel =
    start.toLocaleDateString(
      "en-US",
      options
    );

  const endLabel =
    end.toLocaleDateString(
      "en-US",
      options
    );

  return startLabel === endLabel

    ? startLabel

    : `${startLabel} - ${endLabel}`;
}

/* =========================================================
   DAYS BETWEEN
========================================================= */

function daysBetween(
  startDate,
  endDate
) {

  const start =
    toDate(startDate);

  const end =
    toDate(endDate);

  if (!start || !end) {
    return 0;
  }

  const ms =
    end.getTime() -
    start.getTime();

  return Math.floor(
    ms / (1000 * 60 * 60 * 24)
  );
}

/* =========================================================
   IS EXPIRED
========================================================= */

function isExpired(
  endDate
) {

  const end =
    toDate(endDate);

  if (!end) {
    return false;
  }

  return end.getTime() <
    Date.now();
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  toDate,

  mysqlDateTime,
  mysqlDate,

  addMonths,
  addDays,

  startOfMonth,
  endOfMonth,

  calculateCoverage,
  buildCoverageLabel,

  daysBetween,

  isExpired,
};