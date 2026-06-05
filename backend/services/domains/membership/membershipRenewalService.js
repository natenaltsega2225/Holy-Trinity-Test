// backend/services/domains/membership/membershipRenewalService.js
"use strict";

const pool = require("../../../db");

const {
  updateExistingColumns,
  findMany,
} = require("../../../utils/dbHelpers");

const {
  mysqlNow,
  mysqlDate,
  addDays,
  isExpired,
} = require("../../../utils/dateHelpers");

async function findExpiringMemberships(daysAhead = 30) {
  const endDate = mysqlDate(addDays(new Date(), daysAhead));

  const [rows] = await pool.query(
    `
    SELECT
      m.id AS member_id,
      m.member_no,
      m.full_name,
      m.email,
      m.phone,
      m.membership_status,
      m.membership_end_date,

      s.id AS subscription_id,
      s.dues_plan_id,
      s.plan_name,
      s.current_amount AS amount,
      s.start_date,
      s.end_date,
      s.coverage_start_month,
      s.coverage_end_month,
      s.coverage_label,
      s.months_paid,
      s.months_remaining,
      s.next_renewal_date,
      s.auto_renew,
      s.auto_payment_enabled,
      s.status AS subscription_status

    FROM tbl_members m

    LEFT JOIN tbl_finance_dues_subscriptions s
      ON s.member_id = m.id
      AND s.status = 'active'

    WHERE m.membership_end_date IS NOT NULL
      AND DATE(m.membership_end_date) <= ?
      AND m.membership_status = 'active'

    ORDER BY m.membership_end_date ASC
    `,
    [endDate]
  );

  return rows;
}

async function findExpiredMemberships() {
  const [rows] = await pool.query(
    `
    SELECT
      id AS member_id,
      member_no,
      full_name,
      email,
      phone,
      membership_end_date,
      membership_status
    FROM tbl_members
    WHERE membership_end_date IS NOT NULL
      AND DATE(membership_end_date) < CURDATE()
      AND membership_status = 'active'
    ORDER BY membership_end_date ASC
    `
  );

  return rows;
}

async function markMemberExpired(conn, memberId) {
  return updateExistingColumns(
    conn,
    "tbl_members",
    {
      membership_status: "inactive",
      status: "inactive",
      is_active: 0,
      updated_at: mysqlNow(),
    },
    "id = ?",
    [memberId]
  );
}

async function processExpiredMemberships() {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const expired = await findMany(
      conn,
      `
      SELECT id
      FROM tbl_members
      WHERE membership_end_date IS NOT NULL
        AND DATE(membership_end_date) < CURDATE()
        AND membership_status = 'active'
      `,
      []
    );

    for (const member of expired) {
      await markMemberExpired(conn, member.id);
    }

    await conn.commit();

    return {
      success: true,
      processed: expired.length,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function buildRenewalNotice(member = {}) {
  return {
    member_id: member.member_id,
    member_no: member.member_no,
    full_name: member.full_name,
    email: member.email,
    phone: member.phone,

    membership_end_date:
      member.membership_end_date ||
      member.end_date ||
      null,

    plan_name:
      member.plan_name ||
      "Membership Plan",

    amount:
      Number(member.amount || 0),

    coverage_label:
      member.coverage_label || null,

    coverage_start_month:
      member.coverage_start_month || null,

    coverage_end_month:
      member.coverage_end_month || null,

    next_renewal_date:
      member.next_renewal_date ||
      member.membership_end_date ||
      member.end_date ||
      null,

    auto_renew:
      Number(member.auto_renew || 0) === 1,

    auto_payment_enabled:
      Number(member.auto_payment_enabled || 0) === 1,

    expired:
      isExpired(
        member.membership_end_date ||
        member.end_date
      ),
  };
}

module.exports = {
  findExpiringMemberships,
  findExpiredMemberships,
  markMemberExpired,
  processExpiredMemberships,
  buildRenewalNotice,
};