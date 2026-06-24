// backend/utils/dateHelpers.js
"use strict";

/* -------------------------------------------------------------------------- */
/* Core                                                                       */
/* -------------------------------------------------------------------------- */

function toDate(value) {
  if (!value) return null;

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function ensureDate(value, fallback = new Date()) {
  return toDate(value) || toDate(fallback) || new Date();
}

function cloneDate(value) {
  return new Date(ensureDate(value).getTime());
}

function pad(value) {
  return String(value).padStart(2, "0");
}

/* -------------------------------------------------------------------------- */
/* MySQL Formats                                                              */
/* -------------------------------------------------------------------------- */

function mysqlDateTime(value = new Date()) {
  const date = ensureDate(value);

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())} ` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}:` +
    `${pad(date.getSeconds())}`
  );
}

function mysqlNow(value = new Date()) {
  return mysqlDateTime(value);
}

function mysqlDate(value = new Date()) {
  const date = ensureDate(value);

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}`
  );
}

function dateOnly(value = new Date()) {
  return mysqlDate(value);
}

/* -------------------------------------------------------------------------- */
/* Date Math                                                                  */
/* -------------------------------------------------------------------------- */

function addMonths(value, months = 0) {
  const source = ensureDate(value);
  const day = source.getDate();

  const target = new Date(source.getTime());
  target.setDate(1);
  target.setMonth(target.getMonth() + Number(months || 0));

  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();

  target.setDate(Math.min(day, lastDay));

  return target;
}

function addDays(value, days = 0) {
  const date = cloneDate(value);
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

function startOfDay(value = new Date()) {
  const date = cloneDate(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = cloneDate(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfMonth(value = new Date()) {
  const date = cloneDate(value);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfMonth(value = new Date()) {
  const date = startOfMonth(value);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfYear(value = new Date()) {
  const date = cloneDate(value);
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfYear(value = new Date()) {
  const date = cloneDate(value);
  date.setMonth(11, 31);
  date.setHours(23, 59, 59, 999);
  return date;
}

/* -------------------------------------------------------------------------- */
/* Membership Coverage                                                        */
/* -------------------------------------------------------------------------- */

function buildCoverageLabel(startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);

  if (!start || !end) return null;

  const options = {
    year: "numeric",
    month: "short",
  };

  const startLabel = start.toLocaleDateString("en-US", options);
  const endLabel = end.toLocaleDateString("en-US", options);

  return startLabel === endLabel
    ? startLabel
    : `${startLabel} - ${endLabel}`;
}

function coverageMonthKeys(startDate, monthsPaid = 1) {
  const start = startOfMonth(startDate);
  const months = Math.max(1, Math.trunc(Number(monthsPaid || 1)));

  return Array.from({ length: months }, (_item, index) => {
    const date = addMonths(start, index);

    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`,
      label: date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),
    };
  });
}

function calculateCoverage({ startDate = new Date(), monthsPaid = 1 } = {}) {
  const months = Math.max(1, Math.trunc(Number(monthsPaid || 1)));
  const coverageStart = startOfMonth(startDate);
  const coverageEnd = endOfMonth(addMonths(coverageStart, months - 1));

  return {
    coverage_start: mysqlDate(coverageStart),
    coverage_end: mysqlDate(coverageEnd),
    coverage_label: buildCoverageLabel(coverageStart, coverageEnd),
    coverage_months: coverageMonthKeys(coverageStart, months),
    months_paid: months,
  };
}

/* -------------------------------------------------------------------------- */
/* Comparisons                                                                */
/* -------------------------------------------------------------------------- */

function daysBetween(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  return Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function isExpired(endDate, referenceDate = new Date()) {
  const end = toDate(endDate);
  if (!end) return false;

  return endOfDay(end).getTime() < startOfDay(referenceDate).getTime();
}

function isSameOrBefore(left, right) {
  const leftDate = toDate(left);
  const rightDate = toDate(right);

  if (!leftDate || !rightDate) return false;

  return leftDate.getTime() <= rightDate.getTime();
}

function isSameOrAfter(left, right) {
  const leftDate = toDate(left);
  const rightDate = toDate(right);

  if (!leftDate || !rightDate) return false;

  return leftDate.getTime() >= rightDate.getTime();
}

module.exports = {
  toDate,
  ensureDate,
  cloneDate,

  mysqlDateTime,
  mysqlNow,
  mysqlDate,
  dateOnly,

  addMonths,
  addDays,

  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,

  calculateCoverage,
  buildCoverageLabel,
  coverageMonthKeys,

  daysBetween,
  isExpired,
  isSameOrBefore,
  isSameOrAfter,
};