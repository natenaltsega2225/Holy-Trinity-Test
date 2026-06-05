// // backend/services/domains/membership/subscriptionService.js

// "use strict";

// const {
//   insertExistingColumns,
//   updateExistingColumns,
//   findOne,
// } = require("../../../utils/dbHelpers");

// const {
//   money,
//   mysqlNow,
// } = require("../../../utils/financeHelpers");

// function dateOnly(value) {
//   if (!value) return null;

//   const d = value instanceof Date ? value : new Date(value);
//   if (Number.isNaN(d.getTime())) return null;

//   const yyyy = d.getFullYear();
//   const mm = String(d.getMonth() + 1).padStart(2, "0");
//   const dd = String(d.getDate()).padStart(2, "0");

//   return `${yyyy}-${mm}-${dd}`;
// }

// function addMonths(value, months) {
//   const base = value ? new Date(value) : new Date();
//   if (Number.isNaN(base.getTime())) return new Date();

//   return new Date(
//     base.getFullYear(),
//     base.getMonth() + Number(months || 1),
//     0
//   );
// }

// function normalizeMonths(payload = {}) {
//   return Math.max(
//     1,
//     Number(
//       payload.months ||
//         payload.months_paid ||
//         payload.duration_months ||
//         payload.interval_count ||
//         1
//     )
//   );
// }

// function planDurationLabel(months) {
//   const n = Math.max(1, Number(months || 1));
//   return n === 1 ? "1 Month" : `${n} Months`;
// }

// function prettyCoverageLabel(startDate, endDate) {
//   if (!startDate || !endDate) return null;

//   const start = new Date(startDate);
//   const end = new Date(endDate);

//   if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
//     return null;
//   }

//   const fmt = (d) =>
//     d.toLocaleDateString("en-US", {
//       month: "long",
//       year: "numeric",
//     });

//   return `${fmt(start)} - ${fmt(end)}`;
// }

// async function findCurrentSubscription(conn, memberId) {
//   if (!memberId) return null;

//   return findOne(
//     conn,
//     `
//     SELECT *
//     FROM tbl_finance_dues_subscriptions
//     WHERE member_id = ?
//     ORDER BY id DESC
//     LIMIT 1
//     `,
//     [memberId]
//   );
// }

// async function activateMember(conn, memberId) {
//   if (!memberId) return;

//   await updateExistingColumns(
//     conn,
//     "tbl_members",
//     {
//       status: "active",
//       membership_status: "active",
//       is_active: 1,
//       updated_at: mysqlNow(),
//     },
//     "id = ?",
//     [memberId]
//   );

//   await conn
//     .query(
//       `
//       UPDATE tbl_users
//       SET
//         is_active = 1,
//         updated_at = NOW()
//       WHERE member_id = ?
//       `,
//       [memberId]
//     )
//     .catch(() => {});
// }

// async function findNextUnpaidMonth(conn, memberId) {
//   const now = new Date();

//   if (!memberId) {
//     return {
//       year: now.getFullYear(),
//       month: now.getMonth() + 1,
//     };
//   }

//   const [rows] = await conn.query(
//     `
//     SELECT
//       coverage_year,
//       month_number
//     FROM tbl_member_membership_coverage
//     WHERE member_id = ?
//       AND status IN ('paid', 'completed', 'posted')
//     ORDER BY coverage_year ASC, month_number ASC
//     `,
//     [memberId]
//   );

//   if (!rows.length) {
//     return {
//       year: now.getFullYear(),
//       month: now.getMonth() + 1,
//     };
//   }

//   const latest = rows[rows.length - 1];

//   let year = Number(latest.coverage_year);
//   let month = Number(latest.month_number) + 1;

//   if (month > 12) {
//     month = 1;
//     year += 1;
//   }

//   return { year, month };
// }

// async function resolveCoverageDates(conn, payload = {}) {
//   const months = normalizeMonths(payload);

//   const next = await findNextUnpaidMonth(
//     conn,
//     payload.member_id
//   );

//   const startDate = new Date(
//     Number(next.year),
//     Number(next.month) - 1,
//     1
//   );

//   const endDate = new Date(
//     startDate.getFullYear(),
//     startDate.getMonth() + months,
//     0
//   );

//   const coverageMonths = [];

//   for (let i = 0; i < months; i += 1) {
//     const d = new Date(
//       startDate.getFullYear(),
//       startDate.getMonth() + i,
//       1
//     );

//     coverageMonths.push(
//       `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
//     );
//   }

//   const coverageLabel = prettyCoverageLabel(startDate, endDate);

//   return {
//     start_date: dateOnly(startDate),
//     end_date: dateOnly(endDate),

//     coverage_start_month: coverageMonths[0],
//     coverage_end_month: coverageMonths[coverageMonths.length - 1],

//     coverage_months: coverageMonths,
//     coverage_months_json: JSON.stringify(coverageMonths),

//     coverage_label: coverageLabel,

//     months_paid: months,
//     months_remaining: 0,

//     coverage_year: startDate.getFullYear(),
//     start_month_number: startDate.getMonth() + 1,
//     end_month_number: endDate.getMonth() + 1,
//   };
// }

// async function upsertMembershipSubscription(conn, payload = {}) {
//   if (!payload.member_id) return null;

//   const existing = await findCurrentSubscription(
//     conn,
//     payload.member_id
//   );

//   const months = normalizeMonths(payload);

//   const dates =
//     payload.resolvedCoverage ||
//     (await resolveCoverageDates(conn, payload));

//   const end = new Date(dates.end_date);
//   const nextRenewalDate = dateOnly(
//     new Date(
//       end.getFullYear(),
//       end.getMonth() + 1,
//       1
//     )
//   );

//   const commonFields = {
//     dues_plan_id:
//       payload.dues_plan_id ||
//       payload.plan_id ||
//       existing?.dues_plan_id ||
//       null,

//     plan_name:
//       payload.plan_name ||
//       existing?.plan_name ||
//       null,

//     plan_duration:
//       payload.plan_duration ||
//       planDurationLabel(months),

//     current_amount: money(
//       payload.amount ||
//         payload.current_amount ||
//         existing?.current_amount ||
//         0
//     ),

//     months_paid: months,
//     months_remaining: Number(dates.months_remaining || 0),

//     interval_unit: "month",
//     interval_count: months,

//     start_date:
//       existing?.start_date ||
//       dates.start_date,

//     end_date: dates.end_date,

//     coverage_start: dates.start_date,
//     coverage_end: dates.end_date,

//     coverage_start_month: dates.coverage_start_month,
//     coverage_end_month: dates.coverage_end_month,
//     coverage_label: dates.coverage_label,

//     next_renewal_date: nextRenewalDate,

//     auto_renew:
//       payload.auto_renew !== undefined
//         ? payload.auto_renew
//           ? 1
//           : 0
//         : Number(existing?.auto_renew || 0),

//     auto_payment_enabled:
//       payload.auto_payment_enabled !== undefined
//         ? payload.auto_payment_enabled
//           ? 1
//           : 0
//         : Number(existing?.auto_payment_enabled || 0),

//     stripe_customer_id:
//       payload.stripe_customer_id ||
//       existing?.stripe_customer_id ||
//       null,

//     stripe_subscription_id:
//       payload.stripe_subscription_id ||
//       existing?.stripe_subscription_id ||
//       null,

//     status: "active",
//     updated_at: mysqlNow(),
//   };

//   if (existing?.id) {
//     await updateExistingColumns(
//       conn,
//       "tbl_finance_dues_subscriptions",
//       commonFields,
//       "id = ?",
//       [existing.id]
//     );

//     return {
//       id: existing.id,
//       member_id: payload.member_id,
//       ...commonFields,
//     };
//   }

//   const id = await insertExistingColumns(
//     conn,
//     "tbl_finance_dues_subscriptions",
//     {
//       member_id: payload.member_id,
//       ...commonFields,
//       created_at: mysqlNow(),
//     }
//   );

//   return {
//     id,
//     member_id: payload.member_id,
//     ...commonFields,
//   };
// }

// async function insertMembershipCoverage(conn, payload = {}) {
//   if (!payload.member_id || !payload.payment_id) return null;

//   const coverage =
//     payload.resolvedCoverage ||
//     (await resolveCoverageDates(conn, payload));

//   const coverageMonths = Array.isArray(coverage.coverage_months)
//     ? coverage.coverage_months
//     : [];

//   if (!coverageMonths.length) return null;

//   const perMonth = money(
//     Number(payload.amount || payload.total_amount || 0) /
//       Math.max(coverageMonths.length, 1)
//   );

//   let inserted = 0;

//   for (const monthKey of coverageMonths) {
//     const [yearRaw, monthRaw] = String(monthKey).split("-").map(Number);

//     const year = Number(yearRaw);
//     const monthNumber = Number(monthRaw);

//     if (!year || !monthNumber) continue;

//     const d = new Date(year, monthNumber - 1, 1);

//     const monthName = d.toLocaleString("en-US", {
//       month: "long",
//     });

//     try {
//       await insertExistingColumns(
//         conn,
//         "tbl_member_membership_coverage",
//         {
//           member_id: payload.member_id,
//           payment_id: payload.payment_id,
//           receipt_id: payload.receipt_id || null,
//           invoice_id: payload.invoice_id || null,
//           subscription_id: payload.subscription_id || null,

//           coverage_year: year,
//           coverage_month: monthKey,
//           coverage_month_name: monthName,
//           month_number: monthNumber,
//           month_name: monthName,
//           coverage_key: monthKey,

//           status: "paid",
//           amount: perMonth,

//           payment_number: payload.payment_number || null,
//           receipt_number: payload.receipt_number || null,
//           invoice_number: payload.invoice_number || null,

//           method:
//             payload.method ||
//             payload.payment_method ||
//             null,

//           provider:
//             payload.provider ||
//             payload.payment_provider ||
//             null,

//           created_by:
//             payload.created_by ||
//             payload.actor_id ||
//             null,

//           created_at: mysqlNow(),
//           updated_at: mysqlNow(),
//         }
//       );

//       inserted += 1;
//     } catch (err) {
//       if (err?.code === "ER_DUP_ENTRY") {
//         console.warn(
//           `Skipping duplicate membership coverage month: member=${payload.member_id}, month=${monthKey}`
//         );
//         continue;
//       }

//       throw err;
//     }

//     await insertExistingColumns(
//       conn,
//       "tbl_membership_payment_months",
//       {
//         payment_id: payload.payment_id,
//         member_id: payload.member_id,
//         receipt_id: payload.receipt_id || null,
//         invoice_id: payload.invoice_id || null,

//         year,
//         month: monthNumber,
//         month_name: monthName,
//         coverage_key: monthKey,

//         amount: perMonth,
//         status: "paid",

//         created_at: mysqlNow(),
//         updated_at: mysqlNow(),
//       }
//     ).catch(() => {});
//   }

//   await conn
//     .query(
//       `
//       UPDATE tbl_members
//       SET
//         membership_start_date = COALESCE(membership_start_date, ?),
//         membership_end_date = ?,
//         membership_status = 'active',
//         status = 'active',
//         is_active = 1,
//         updated_at = NOW()
//       WHERE id = ?
//       `,
//       [
//         coverage.start_date,
//         coverage.end_date,
//         payload.member_id,
//       ]
//     )
//     .catch(() => {});

//   return {
//     success: true,
//     member_id: payload.member_id,
//     payment_id: payload.payment_id,
//     coverage_start_month: coverage.coverage_start_month,
//     coverage_end_month: coverage.coverage_end_month,
//     coverage_label: coverage.coverage_label,
//     months_paid: coverage.months_paid,
//     inserted_months: inserted,
//     coverage_months: coverage.coverage_months,
//     coverage_months_json: coverage.coverage_months_json,
//   };
// }

// async function applyMembershipPayment(conn, payload = {}) {
//   if (!payload.member_id) return null;

//   await activateMember(conn, payload.member_id);

//   const months = normalizeMonths(payload);

//   const resolvedCoverage = await resolveCoverageDates(conn, {
//     ...payload,
//     months,
//     duration_months: months,
//   });

//   const subscription = await upsertMembershipSubscription(conn, {
//     ...payload,
//     months,
//     duration_months: months,
//     resolvedCoverage,
//   });

//   const coverageResult = await insertMembershipCoverage(conn, {
//     ...payload,
//     months,
//     duration_months: months,
//     amount: payload.amount,
//     total_amount: payload.total_amount || payload.amount,
//     subscription_id: subscription?.id || null,
//     resolvedCoverage,
//   });

//   return {
//     ...subscription,
//     coverage: coverageResult,
//   };
// }

// module.exports = {
//   dateOnly,
//   addMonths,
//   normalizeMonths,
//   planDurationLabel,
//   prettyCoverageLabel,

//   findCurrentSubscription,
//   activateMember,

//   findNextUnpaidMonth,
//   resolveCoverageDates,

//   upsertMembershipSubscription,
//   insertMembershipCoverage,
//   applyMembershipPayment,
// };

"use strict";

const {
  insertExistingColumns,
  updateExistingColumns,
  findOne,
} = require("../../../utils/dbHelpers");

const {
  money,
  mysqlNow,
} = require("../../../utils/financeHelpers");

const MONTH_NAMES = [
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

function dateOnly(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function firstDay(year, month) {
  return new Date(Number(year), Number(month) - 1, 1);
}

function lastDay(year, month) {
  return new Date(Number(year), Number(month), 0);
}

function addMonths(value, months) {
  const base = value ? new Date(value) : new Date();

  return new Date(
    base.getFullYear(),
    base.getMonth() + Number(months || 0),
    1
  );
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function normalizeMonths(payload = {}) {
  if (payload.coverage_months_json) {
    try {
      const parsed = JSON.parse(payload.coverage_months_json);
      if (Array.isArray(parsed) && parsed.length) return parsed.length;
    } catch {}
  }

  const start = Number(payload.coverage_start_month || 0);
  const end = Number(payload.coverage_end_month || 0);

  if (start && end && end >= start) {
    return end - start + 1;
  }

  return Math.max(
    1,
    Number(
      payload.months ||
        payload.months_paid ||
        payload.duration_months ||
        payload.interval_count ||
        1
    )
  );
}

function planDurationLabel(months) {
  const n = Math.max(1, Number(months || 1));
  return n === 1 ? "1 Month" : `${n} Months`;
}

function prettyCoverageLabel(startDate, endDate) {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);

  const fmt = (d) =>
    d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

  return `${fmt(start)} - ${fmt(end)}`;
}

async function findCurrentSubscription(conn, memberId) {
  if (!memberId) return null;

  return findOne(
    conn,
    `
    SELECT *
    FROM tbl_finance_dues_subscriptions
    WHERE member_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [memberId]
  );
}

async function activateMember(conn, memberId) {
  if (!memberId) return;

  await updateExistingColumns(
    conn,
    "tbl_members",
    {
      status: "active",
      membership_status: "active",
      is_active: 1,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [memberId]
  );

  await conn
    .query(
      `
      UPDATE tbl_users
      SET is_active = 1, updated_at = NOW()
      WHERE member_id = ?
      `,
      [memberId]
    )
    .catch(() => {});
}

async function findNextUnpaidMonth(conn, memberId) {
  const now = new Date();

  if (!memberId) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }

  const [rows] = await conn.query(
    `
    SELECT coverage_year, month_number
    FROM tbl_member_membership_coverage
    WHERE member_id = ?
      AND status IN ('paid', 'completed', 'posted')
    ORDER BY coverage_year DESC, month_number DESC
    LIMIT 1
    `,
    [memberId]
  );

  if (!rows.length) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }

  let year = Number(rows[0].coverage_year);
  let month = Number(rows[0].month_number) + 1;

  if (month > 12) {
    month = 1;
    year += 1;
  }

  return { year, month };
}

function parseExplicitCoverageMonths(payload = {}) {
  if (!payload.coverage_months_json) return [];

  try {
    const parsed = JSON.parse(payload.coverage_months_json);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => {
        const year = Number(row.year || payload.coverage_year || 0);
        const month = Number(row.month_number || row.monthNumber || 0);

        if (!year || !month || month < 1 || month > 12) return null;

        return monthKey(year, month);
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function resolveCoverageDates(conn, payload = {}) {
  let coverageMonths = parseExplicitCoverageMonths(payload);

  const explicitYear = Number(payload.coverage_year || 0);
  const explicitStart = Number(payload.coverage_start_month || 0);
  const explicitEnd = Number(payload.coverage_end_month || 0);

  if (
    !coverageMonths.length &&
    explicitYear &&
    explicitStart &&
    explicitEnd &&
    explicitEnd >= explicitStart
  ) {
    for (let m = explicitStart; m <= explicitEnd; m += 1) {
      coverageMonths.push(monthKey(explicitYear, m));
    }
  }

  if (!coverageMonths.length) {
    const months = normalizeMonths(payload);
    const next = await findNextUnpaidMonth(conn, payload.member_id);

    for (let i = 0; i < months; i += 1) {
      const d = addMonths(firstDay(next.year, next.month), i);
      coverageMonths.push(monthKey(d.getFullYear(), d.getMonth() + 1));
    }
  }

  const first = coverageMonths[0];
  const last = coverageMonths[coverageMonths.length - 1];

  const [startYear, startMonth] = first.split("-").map(Number);
  const [endYear, endMonth] = last.split("-").map(Number);

  const startDate = firstDay(startYear, startMonth);
  const endDate = lastDay(endYear, endMonth);

  return {
    start_date: dateOnly(startDate),
    end_date: dateOnly(endDate),

    coverage_start_month: first,
    coverage_end_month: last,

    coverage_months: coverageMonths,
    coverage_months_json: JSON.stringify(coverageMonths),

    coverage_label: prettyCoverageLabel(startDate, endDate),

    months_paid: coverageMonths.length,
    months_remaining: 0,

    coverage_year: startYear,
    start_month_number: startMonth,
    end_month_number: endMonth,
  };
}

async function upsertMembershipSubscription(conn, payload = {}) {
  if (!payload.member_id) return null;

  const existing = await findCurrentSubscription(conn, payload.member_id);
  const months = normalizeMonths(payload);

  const dates =
    payload.resolvedCoverage || (await resolveCoverageDates(conn, payload));

  const end = new Date(dates.end_date);

  const nextRenewalDate = dateOnly(
    new Date(end.getFullYear(), end.getMonth() + 1, 1)
  );

  const commonFields = {
    dues_plan_id:
      payload.dues_plan_id || payload.plan_id || existing?.dues_plan_id || null,

    plan_name: payload.plan_name || existing?.plan_name || null,

    plan_duration: payload.plan_duration || planDurationLabel(months),

    current_amount: money(
      payload.amount || payload.current_amount || existing?.current_amount || 0
    ),

    months_paid: Number(dates.months_paid || months),
    months_remaining: Number(dates.months_remaining || 0),

    interval_unit: "month",
    interval_count: Number(dates.months_paid || months),

    start_date: dates.start_date,
    end_date: dates.end_date,

    coverage_start: dates.start_date,
    coverage_end: dates.end_date,

    coverage_start_month: dates.coverage_start_month,
    coverage_end_month: dates.coverage_end_month,
    coverage_label: dates.coverage_label,

    next_renewal_date: nextRenewalDate,

    auto_renew:
      payload.auto_renew !== undefined
        ? payload.auto_renew
          ? 1
          : 0
        : Number(existing?.auto_renew || 0),

    auto_payment_enabled:
      payload.auto_payment_enabled !== undefined
        ? payload.auto_payment_enabled
          ? 1
          : 0
        : Number(existing?.auto_payment_enabled || 0),

    stripe_customer_id:
      payload.stripe_customer_id || existing?.stripe_customer_id || null,

    stripe_subscription_id:
      payload.stripe_subscription_id || existing?.stripe_subscription_id || null,

    status: "active",
    updated_at: mysqlNow(),
  };

  if (existing?.id) {
    await updateExistingColumns(
      conn,
      "tbl_finance_dues_subscriptions",
      commonFields,
      "id = ?",
      [existing.id]
    );

    return {
      id: existing.id,
      member_id: payload.member_id,
      ...commonFields,
    };
  }

  const id = await insertExistingColumns(
    conn,
    "tbl_finance_dues_subscriptions",
    {
      member_id: payload.member_id,
      ...commonFields,
      created_at: mysqlNow(),
    }
  );

  return {
    id,
    member_id: payload.member_id,
    ...commonFields,
  };
}

async function insertMembershipCoverage(conn, payload = {}) {
  if (!payload.member_id || !payload.payment_id) return null;

  const coverage =
    payload.resolvedCoverage || (await resolveCoverageDates(conn, payload));

  const coverageMonths = Array.isArray(coverage.coverage_months)
    ? coverage.coverage_months
    : [];

  if (!coverageMonths.length) return null;

  const perMonth = money(
    Number(payload.amount || payload.total_amount || 0) /
      Math.max(coverageMonths.length, 1)
  );

  let inserted = 0;

  for (const month of coverageMonths) {
    const [year, monthNumber] = String(month).split("-").map(Number);

    if (!year || !monthNumber) continue;

    const monthName = MONTH_NAMES[monthNumber - 1];

    try {
      await insertExistingColumns(conn, "tbl_member_membership_coverage", {
        member_id: payload.member_id,
        payment_id: payload.payment_id,
        receipt_id: payload.receipt_id || null,
        invoice_id: payload.invoice_id || null,
        subscription_id: payload.subscription_id || null,

        coverage_year: year,
        coverage_month: month,
        coverage_month_name: monthName,
        month_number: monthNumber,
        month_name: monthName,
        coverage_key: month,

        status: "paid",
        amount: perMonth,

        payment_number: payload.payment_number || null,
        receipt_number: payload.receipt_number || null,
        invoice_number: payload.invoice_number || null,

        method: payload.method || payload.payment_method || null,
        provider: payload.provider || payload.payment_provider || null,

        created_by: payload.created_by || payload.actor_id || null,
        created_at: mysqlNow(),
        updated_at: mysqlNow(),
      });

      inserted += 1;
    } catch (err) {
      await conn
        .query(
          `
          UPDATE tbl_member_membership_coverage
          SET
            payment_id = ?,
            receipt_id = ?,
            invoice_id = ?,
            subscription_id = ?,
            status = 'paid',
            amount = ?,
            payment_number = ?,
            receipt_number = ?,
            invoice_number = ?,
            method = ?,
            provider = ?,
            updated_at = NOW()
          WHERE member_id = ?
            AND coverage_year = ?
            AND month_number = ?
          `,
          [
            payload.payment_id,
            payload.receipt_id || null,
            payload.invoice_id || null,
            payload.subscription_id || null,
            perMonth,
            payload.payment_number || null,
            payload.receipt_number || null,
            payload.invoice_number || null,
            payload.method || payload.payment_method || null,
            payload.provider || payload.payment_provider || null,
            payload.member_id,
            year,
            monthNumber,
          ]
        )
        .catch(() => {});
    }

    await insertExistingColumns(conn, "tbl_membership_payment_months", {
      payment_id: payload.payment_id,
      member_id: payload.member_id,
      receipt_id: payload.receipt_id || null,
      invoice_id: payload.invoice_id || null,
      year,
      month: monthNumber,
      month_name: monthName,
      coverage_key: month,
      amount: perMonth,
      status: "paid",
      created_at: mysqlNow(),
      updated_at: mysqlNow(),
    }).catch(() => {});
  }

  await conn.query(
    `
    UPDATE tbl_members
    SET
      membership_start_date =
        IF(
          membership_start_date IS NULL
          OR membership_start_date > ?,
          ?,
          membership_start_date
        ),
      membership_end_date =
        IF(
          membership_end_date IS NULL
          OR membership_end_date < ?,
          ?,
          membership_end_date
        ),
      membership_status = 'active',
      status = 'active',
      is_active = 1,
      updated_at = NOW()
    WHERE id = ?
    `,
    [
      coverage.start_date,
      coverage.start_date,
      coverage.end_date,
      coverage.end_date,
      payload.member_id,
    ]
  ).catch(() => {});

  return {
    success: true,
    member_id: payload.member_id,
    payment_id: payload.payment_id,
    coverage_start_month: coverage.coverage_start_month,
    coverage_end_month: coverage.coverage_end_month,
    coverage_label: coverage.coverage_label,
    months_paid: coverage.months_paid,
    inserted_months: inserted,
    coverage_months: coverage.coverage_months,
    coverage_months_json: coverage.coverage_months_json,
  };
}

async function applyMembershipPayment(conn, payload = {}) {
  if (!payload.member_id) return null;

  await activateMember(conn, payload.member_id);

  const resolvedCoverage = await resolveCoverageDates(conn, payload);

  const subscription = await upsertMembershipSubscription(conn, {
    ...payload,
    months: resolvedCoverage.months_paid,
    duration_months: resolvedCoverage.months_paid,
    resolvedCoverage,
  });

  const coverageResult = await insertMembershipCoverage(conn, {
    ...payload,
    months: resolvedCoverage.months_paid,
    duration_months: resolvedCoverage.months_paid,
    amount: payload.amount,
    total_amount: payload.total_amount || payload.amount,
    subscription_id: subscription?.id || null,
    resolvedCoverage,
  });

  return {
    ...subscription,
    coverage: coverageResult,
  };
}

module.exports = {
  dateOnly,
  addMonths,
  normalizeMonths,
  planDurationLabel,
  prettyCoverageLabel,

  findCurrentSubscription,
  activateMember,

  findNextUnpaidMonth,
  resolveCoverageDates,

  upsertMembershipSubscription,
  insertMembershipCoverage,
  applyMembershipPayment,
};