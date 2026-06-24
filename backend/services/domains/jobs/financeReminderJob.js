//backend\services\domains\jobs\financeReminderJob.js
"use strict";

const pool = require("../../../db");
const financeNotifications = require(
  "../../../routes/financeNotifications"
);
const financeReminderScheduleService = require("../finance/financeReminderScheduleService");
const publicInvoices =
  require("../../../routes/publicInvoices");
function nowSql() {
  return new Date()
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function clean(value, max = 255) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function money(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// function buildInvoicePaymentUrl(invoice) {
//   if (!invoice?.invoice_number) {
//     return null;
//   }

//   const token =
//     publicInvoices.createInvoiceToken(
//       {
//         id: invoice.invoice_id,
//         invoice_number:
//           invoice.invoice_number,
//       },
//       ["view", "pay"]
//     );

//   const baseUrl =
//     process.env.PUBLIC_APP_URL ||
//     process.env.APP_URL ||
//     "https://holytrinitynashville.org";

//   return `${baseUrl}/api/public/invoices/${encodeURIComponent(
//     invoice.invoice_number
//   )}/checkout?token=${encodeURIComponent(
//     token
//   )}`;
// }

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function todayDateOnly() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeDate(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a, b) {
  return Math.floor((normalizeDate(a) - normalizeDate(b)) / 86400000);
}

function normalizeFrequency(value) {
  const v = String(value || "").toLowerCase();
  return ["weekly", "biweekly", "monthly"].includes(v) ? v : "monthly";
}

function shouldRunSchedule(schedule) {
  const today = todayDateOnly();
  const start = normalizeDate(schedule.start_date);

  if (today < start) return false;

  if (schedule.end_date && today > normalizeDate(schedule.end_date)) {
    return false;
  }

  const diff = daysBetween(today, start);

  switch (normalizeFrequency(schedule.frequency)) {
    case "weekly":
      return diff % 7 === 0;
    case "biweekly":
      return diff % 14 === 0;
    case "monthly":
      return today.getDate() === start.getDate();
    default:
      return false;
  }
}

function nextRunDate(schedule, fromDate = new Date()) {
  const frequency = normalizeFrequency(schedule.frequency);
  const next = normalizeDate(fromDate);

  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "biweekly") next.setDate(next.getDate() + 14);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);

  return next.toISOString().slice(0, 10);
}

async function alreadyRanToday(scheduleId) {
  const [rows] = await pool.query(
    `
    SELECT id
    FROM tbl_finance_reminder_schedule_runs
    WHERE schedule_id = ?
      AND DATE(run_date) = CURDATE()
      AND status IN ('completed','success')
    LIMIT 1
    `,
    [scheduleId]
  );

  return rows.length > 0;
}

async function logRun(scheduleId, payload = {}) {
  await pool.query(
    `
    INSERT INTO tbl_finance_reminder_schedule_runs
    (
      schedule_id,
      run_date,
      recipients,
      emails_sent,
      emails_failed,
      status,
      notes
    )
    VALUES (?, NOW(), ?, ?, ?, ?, ?)
    `,
    [
      scheduleId,
      Number(payload.recipients || 0),
      Number(payload.emails_sent || 0),
      Number(payload.emails_failed || 0),
      clean(payload.status || "completed", 40),
      payload.notes || null,
    ]
  );

  try {
    await pool.query(
      `
      UPDATE tbl_finance_reminder_schedules
      SET
        last_run_at = NOW(),
        next_run_at = ?,
        total_runs = COALESCE(total_runs, 0) + 1,
        total_emails_sent = COALESCE(total_emails_sent, 0) + ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        payload.next_run_at || null,
        Number(payload.emails_sent || 0),
        scheduleId,
      ]
    );
  } catch (_err) {
    await pool.query(
      `
      UPDATE tbl_finance_reminder_schedules
      SET updated_at = NOW()
      WHERE id = ?
      `,
      [scheduleId]
    );
  }
}

function buildHtmlEmail({
  subject,
  message,
  recipientName,
  invoices = [],
}) {
  const safeSubject = clean(
    subject || "Pledge Reminder",
    255
  );

  const safeMessage = String(
    message || ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/\n/g, "<br />");

  const rows = invoices
    .map((invoice) => {
      const paymentUrl =
        invoice.payment_url || "";

      return `
        <tr>
          <td style="padding:12px;border:1px solid #dbe4ee;">
            ${
              clean(
                invoice.invoice_number ||
                invoice.invoice_id
              )
            }
          </td>

          <td style="padding:12px;border:1px solid #dbe4ee;">
            ${money(
              invoice.balance_due
            )}
          </td>

          <td style="padding:12px;border:1px solid #dbe4ee;">
            ${
              dateOnly(
                invoice.due_date
              ) || "--"
            }
          </td>

          <td
            style="
              padding:12px;
              border:1px solid #dbe4ee;
              text-align:center;
              white-space:nowrap;
            "
          >
            ${
              paymentUrl
                ? `
                  <a
                    href="${paymentUrl}"
                    target="_blank"
                    style="
                      display:inline-block;
                      background:#16a34a;
                      color:#ffffff;
                      text-decoration:none;
                      padding:8px 14px;
                      border-radius:6px;
                      font-size:13px;
                      font-weight:700;
                    "
                  >
                    Pay Now
                  </a>
                `
                : `
                  <span
                    style="
                      color:#94a3b8;
                      font-size:12px;
                    "
                  >
                    N/A
                  </span>
                `
            }
          </td>
        </tr>
      `;
    })
    .join("");

  const firstPaymentUrl =
    Array.isArray(invoices) &&
    invoices.length
      ? invoices[0].payment_url || ""
      : "";

  const totalOutstanding =
    Array.isArray(invoices)
      ? invoices.reduce(
          (sum, invoice) =>
            sum +
            Number(
              invoice.balance_due || 0
            ),
          0
        )
      : 0;

  const invoiceCount =
    Array.isArray(invoices)
      ? invoices.length
      : 0;

  
return `
<div
  style="
    font-family:Arial,Helvetica,sans-serif;
    color:#102033;
    max-width:900px;
    margin:auto;
    background:#ffffff;
  "
>
  <div
    style="
      padding:36px;
    "
  >
    <h2
      style="
        margin-top:0;
        color:#102033;
      "
    >
      ${safeSubject}
    </h2>

    <p>
      Dear
      <strong>
        ${clean(
          recipientName || "Friend"
        )}
      </strong>,
    </p>

    <div
      style="
        font-size:15px;
        line-height:1.8;
        color:#334155;
        margin-bottom:24px;
      "
    >
      ${safeMessage}
    </div>

    <div
      style="
        display:flex;
        gap:12px;
        margin-bottom:24px;
      "
    >
      <div
        style="
          flex:1;
          background:#f8fafc;
          border:1px solid #dbeafe;
          border-radius:8px;
          padding:16px;
        "
      >
        <div
          style="
            color:#64748b;
            font-size:12px;
          "
        >
          Outstanding Invoices
        </div>

        <div
          style="
            font-size:24px;
            font-weight:700;
            margin-top:4px;
          "
        >
          ${invoiceCount}
        </div>
      </div>

      <div
        style="
          flex:1;
          background:#f8fafc;
          border:1px solid #dbeafe;
          border-radius:8px;
          padding:16px;
        "
      >
        <div
          style="
            color:#64748b;
            font-size:12px;
          "
        >
          Total Outstanding
        </div>

        <div
          style="
            font-size:24px;
            font-weight:700;
            margin-top:4px;
            color:#dc2626;
          "
        >
          ${money(totalOutstanding)}
        </div>
      </div>
    </div>

    <h3
      style="
        margin:28px 0 12px;
      "
    >
      Outstanding Pledge Invoice(s)
    </h3>

    <table
      style="
        width:100%;
        border-collapse:collapse;
      "
    >
      <thead>
        <tr>
          <th
            style="
              padding:12px;
              border:1px solid #dbe4ee;
              text-align:left;
              background:#f8fafc;
            "
          >
            Invoice
          </th>

          <th
            style="
              padding:12px;
              border:1px solid #dbe4ee;
              text-align:left;
              background:#f8fafc;
            "
          >
            Balance
          </th>

          <th
            style="
              padding:12px;
              border:1px solid #dbe4ee;
              text-align:left;
              background:#f8fafc;
            "
          >
            Due Date
          </th>

          <th
            style="
              padding:12px;
              border:1px solid #dbe4ee;
              text-align:center;
              background:#f8fafc;
              width:140px;
            "
          >
            Payment
          </th>
        </tr>
      </thead>

      <tbody>
        ${rows}
      </tbody>
    </table>

    ${
      firstPaymentUrl
        ? `
        <div
          style="
            margin-top:28px;
            padding:24px;
            background:#eff6ff;
            border:1px solid #bfdbfe;
            border-radius:10px;
            text-align:center;
          "
        >
          <h3
            style="
              margin-top:0;
              color:#1e3a8a;
            "
          >
            Ready To Make A Payment?
          </h3>

          <p
            style="
              color:#475569;
              margin-bottom:20px;
            "
          >
            Use the secure payment portal
            to pay your outstanding pledge
            balance online.
          </p>

          <a
            href="${firstPaymentUrl}"
            target="_blank"
            style="
              display:inline-block;
              background:#16a34a;
              color:#ffffff;
              text-decoration:none;
              padding:14px 30px;
              border-radius:8px;
              font-size:16px;
              font-weight:700;
            "
          >
            Make Payment
          </a>
        </div>
      `
        : ""
    }

    <p
      style="
        margin-top:24px;
        color:#64748b;
        font-size:13px;
        line-height:1.7;
      "
    >
      This reminder was generated automatically by the Holy Trinity Finance Department.
      If you have already made a payment recently, please disregard this message.
    </p>

  </div>
</div>
`;
  
}

async function getOpenPledgeRecipients() {
  const [rows] = await pool.query(
    `
    SELECT
  i.id AS invoice_id,
  i.invoice_number,
  i.member_id,
  m.full_name AS member_name,
  i.full_name_snapshot,
  m.email AS member_email,
  i.email_snapshot,
  i.balance_due,
  i.due_date

    FROM tbl_finance_invoices i

    LEFT JOIN tbl_members m
      ON m.id = i.member_id

    WHERE
      LOWER(COALESCE(i.category,'')) = 'pledge'
      AND COALESCE(i.balance_due,0) > 0

      AND LOWER(
        COALESCE(
          i.status,
          'open'
        )
      ) NOT IN
      (
        'paid',
        'cancelled',
        'canceled',
        'closed'
      )

      AND LOWER(
        COALESCE(
          i.invoice_status,
          'open'
        )
      ) NOT IN
      (
        'paid',
        'cancelled',
        'canceled',
        'closed'
      )

    ORDER BY
      i.due_date ASC,
      i.id ASC
    `
  );

  const grouped = new Map();

  for (const row of rows) {
  const email = clean(
    row.member_email ||
      row.email_snapshot,
    190
  ).toLowerCase();

  if (!email) continue;

  if (!grouped.has(email)) {
    grouped.set(email, {
      recipient_type: row.member_id
        ? "member"
        : "external_pledge",

      recipient_id:
        row.member_id || null,

      recipient_name: clean(
        row.member_name ||
          row.full_name_snapshot ||
          "Friend",
        180
      ),

      recipient_email: email,

      invoices: [],
    });
  }

  const urls =
    publicInvoices.buildPublicInvoiceUrls(
      {
        id: row.invoice_id,
        invoice_number:
          row.invoice_number,
      },
      null
    );

  grouped.get(email).invoices.push({
    invoice_id: row.invoice_id,

    invoice_number:
      row.invoice_number,

    balance_due: Number(
      row.balance_due || 0
    ),

    due_date:
      row.due_date,

    payment_url:
      urls?.checkout_url || null,

    view_url:
      urls?.view_url || null,

    pdf_url:
      urls?.pdf_url || null,
  });
}

return Array.from(
  grouped.values()
);

  
}


async function insertNotification({
  schedule,
  recipient,
  subject,
  message,
}) {
  const notificationNumber =
    `NTF-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

  const invoiceSummary =
    Array.isArray(recipient.invoices)
      ? recipient.invoices
          .map(
            (invoice) =>
              `Invoice Number: ${
                invoice.invoice_number ||
                invoice.invoice_id
              }
Outstanding Balance: ${money(
                invoice.balance_due
              )}
Due Date: ${
                dateOnly(
                  invoice.due_date
                ) || "--"
              }`
          )
          .join("\n\n")
      : "";

  const finalMessage = invoiceSummary
    ? `${message}\n\n${invoiceSummary}`
    : message;

  const htmlBody = buildHtmlEmail({
    subject,
    message,
    recipientName:
      recipient.recipient_name,
    invoices:
      recipient.invoices || [],
  });

  const [result] = await pool.query(
    `
    INSERT INTO tbl_finance_notifications
    (
      notification_number,
      channel,
      notification_type,
      audience,
      recipient_type,
      recipient_id,
      recipient_name,
      recipient_email,
      subject,
      message,
      html_body,
      related_entity,
      related_id,
      related_number,
      status,
      attempts,
      created_by,
      created_at,
      updated_at
    )
    VALUES
    (
      ?,
      'email',
      'pledge_reminder',
      'pledge_promises',
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      'invoice',
      ?,
      ?,
      'queued',
      0,
      ?,
      NOW(),
      NOW()
    )
    `,
    [
      notificationNumber,

      recipient.recipient_type,
      recipient.recipient_id,
      recipient.recipient_name,
      recipient.recipient_email,

      subject,
      finalMessage,
      htmlBody,

      recipient.invoices?.[0]
        ?.invoice_id || null,

      recipient.invoices?.[0]
        ?.invoice_number || null,

      schedule.created_by || null,
    ]
  );

  return result.insertId;
}

async function executeSchedule(
  schedule,
  options = {}
) {
  const force = Boolean(
    options.force
  );

  if (!force) {
    if (
      !shouldRunSchedule(schedule)
    ) {
      return {
        skipped: true,
        reason: "not_due",
      };
    }

    if (
      await alreadyRanToday(
        schedule.id
      )
    ) {
      return {
        skipped: true,
        reason:
          "already_ran_today",
      };
    }
  }

  const subject = clean(
    schedule.email_subject ||
      "Pledge Reminder",
    255
  );

  const message = clean(
    schedule.email_template ||
      "This is a reminder regarding your outstanding pledge balance.",
    10000
  );

  const recipients =
    await getOpenPledgeRecipients();

  if (!recipients.length) {
    await logRun(
      schedule.id,
      {
        recipients: 0,
        emails_sent: 0,
        emails_failed: 0,
        status: "completed",
        notes:
          "No recipients with open pledges found.",
        next_run_at:
          nextRunDate(
            schedule
          ),
      }
    );

    return {
      skipped: false,
      schedule_id:
        schedule.id,
      recipients: 0,
      sent: 0,
      failed: 0,
    };
  }

  let sent = 0;
  let failed = 0;

  const fakeReq = {
    user: {
      id:
        schedule.created_by ||
        null,
      role: "finance",
    },
    headers: {},
    socket: {},
  };

  for (const recipient of recipients) {
    try {
      const notificationId =
        await insertNotification(
          {
            schedule,
            recipient,
            subject,
            message,
          }
        );

      await financeNotifications.sendQueuedNotification(
        fakeReq,
        notificationId
      );

      sent++;
    } catch (err) {
      failed++;

      console.error(
        `Reminder delivery failed for ${recipient.recipient_email}`,
        err
      );
    }
  }

  await logRun(
    schedule.id,
    {
      recipients:
        recipients.length,
      emails_sent: sent,
      emails_failed:
        failed,
      status:
        failed > 0
          ? "partial"
          : "completed",
      notes: force
        ? "Run manually by finance user."
        : "Executed automatically by scheduler.",
      next_run_at:
        nextRunDate(
          schedule
        ),
    }
  );

  try {
    await pool.query(
      `
      UPDATE tbl_finance_reminder_schedules
      SET
        last_run_at = NOW(),
        next_run_at = ?,
        total_runs =
          COALESCE(total_runs,0)+1,
        total_emails_sent =
          COALESCE(total_emails_sent,0)+?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        nextRunDate(
          schedule
        ),
        sent,
        schedule.id,
      ]
    );
  } catch (err) {
    console.error(
      "Failed updating schedule statistics",
      err
    );
  }

  return {
    skipped: false,
    schedule_id:
      schedule.id,
    recipients:
      recipients.length,
    sent,
    failed,
  };
}

async function runFinanceReminderSchedules(options = {}) {
  const schedules = await financeReminderScheduleService.getDueSchedules();

  const summary = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const schedule of schedules) {
    try {
      const result = await executeSchedule(schedule, options);

      if (result.skipped) {
        summary.skipped++;
      } else {
        summary.processed++;
        summary.sent += Number(result.sent || 0);
      }

      summary.details.push({
        schedule_id: schedule.id,
        schedule_name: schedule.schedule_name,
        ...result,
      });
    } catch (err) {
      summary.failed++;

      await logRun(schedule.id, {
        status: "failed",
        emails_failed: 1,
        notes: err.message,
        next_run_at: nextRunDate(schedule),
      });

      console.error("Finance reminder schedule failed:", schedule.id, err);
    }
  }

  return summary;
}

async function runFinanceReminderScheduleById(scheduleId, options = {}) {
  const schedule =
    await financeReminderScheduleService.getScheduleById(scheduleId);

  if (!schedule) {
    const err = new Error("Reminder schedule not found.");
    err.status = 404;
    throw err;
  }

  if (!Number(schedule.active)) {
    const err = new Error("Reminder schedule is paused.");
    err.status = 400;
    throw err;
  }

  return executeSchedule(schedule, {
    force: true,
    ...options,
  });
}

module.exports = {
  runFinanceReminderSchedules,
  runFinanceReminderScheduleById,
  executeSchedule,
  shouldRunSchedule,
  
};