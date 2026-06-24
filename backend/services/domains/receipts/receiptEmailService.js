// backend/services/domains/receipts/receiptEmailService.js
"use strict";

const fs = require("fs/promises");
const pool = require("../../../db");

let emailService = {};
let receiptPdfService = {};

try {
  emailService = require("../../emailService");
} catch {
  emailService = {};
}

try {
  receiptPdfService = require("./receiptPdfService");
} catch {
  receiptPdfService = {};
}

const RECEIPT_TRACKING_TABLE = "tbl_finance_receipt_email_tracking";
const columnCache = new Map();

const APP_NAME =
  process.env.APP_NAME ||
  "Holy Trinity Ethiopian Orthodox Church";

const DEFAULT_FROM =
  process.env.MAIL_FROM ||
  process.env.EMAIL_FROM ||
  process.env.SMTP_FROM ||
  undefined;

function clean(value, max = 255) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeKey(value) {
  return clean(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function sqlId(value) {
  if (!/^[A-Za-z0-9_]+$/.test(String(value || ""))) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }

  return `\`${value}\``;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function pretty(value) {
  return clean(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(value) {
  return clean(value, 8000)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstValue(source, keys, fallback = "") {
  for (const key of keys) {
    if (
      source &&
      source[key] !== undefined &&
      source[key] !== null &&
      source[key] !== ""
    ) {
      return source[key];
    }
  }

  return fallback;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function tableExists(tableName) {
  try {
    const [rows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function tableColumns(tableName) {
  if (columnCache.has(tableName)) return columnCache.get(tableName);

  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM ${sqlId(tableName)}`);
    const cols = new Set(rows.map((row) => row.Field));
    columnCache.set(tableName, cols);
    return cols;
  } catch {
    const cols = new Set();
    columnCache.set(tableName, cols);
    return cols;
  }
}

async function selectExisting(alias, tableName, columns) {
  const cols = await tableColumns(tableName);

  return columns
    .filter((col) => cols.has(col))
    .map((col) => `${alias}.${sqlId(col)} AS ${sqlId(`${alias}_${col}`)}`);
}

function participantNames(row = {}) {
  return parseJsonArray(
    firstValue(row, [
      "participants_json",
      "p_participants_json",
      "i_participants_json",
      "student_names_json",
      "registrants_json",
      "children_json",
    ])
  )
    .map((item) =>
      typeof item === "string"
        ? clean(item, 120)
        : clean(
            firstValue(item, [
              "full_name",
              "student_name",
              "participant_name",
              "child_name",
              "name",
            ]),
            120
          )
    )
    .filter(Boolean);
}

function paymentTypeKey(row = {}) {
  const raw = firstValue(row, [
    "payment_type",
    "p_payment_type",
    "invoice_type",
    "i_invoice_type",
    "category",
    "p_category",
    "i_category",
    "donation_category",
    "p_donation_category",
    "i_donation_category",
  ]);

  const key = normalizeKey(raw);

  if (key.includes("member")) return "membership";
  if (key.includes("pledge")) return "pledge";
  if (key.includes("school") || key.includes("kids")) return "school";
  if (key.includes("trip")) return "trip";

  if (
    key.includes("donation") ||
    key.includes("tithe") ||
    key.includes("vow") ||
    key.includes("plate") ||
    key.includes("candle") ||
    key.includes("fund") ||
    key.includes("auction")
  ) {
    return "donation";
  }

  return key || "payment";
}

function paymentTypeLabel(row = {}) {
  const type = paymentTypeKey(row);

  if (type === "membership") return "Membership Payment";
  if (type === "pledge") return "Pledge Payment";
  if (type === "school") return "School Program Payment";
  if (type === "trip") return "Trip Payment";
  if (type === "donation") return "Donation Payment";

  return "Finance Payment";
}

function categoryLine(row = {}) {
  const type = paymentTypeKey(row);

  if (type === "membership") {
    return [
      firstValue(row, ["plan_name", "p_plan_name", "i_plan_name"], "Membership Plan"),
      firstValue(row, ["coverage_label", "p_coverage_label", "i_coverage_label"]),
    ]
      .filter(Boolean)
      .join(" - ");
  }

  if (type === "pledge") {
    return firstValue(
      row,
      ["campaign_name", "p_campaign_name", "i_campaign_name", "pledge_campaign"],
      "Pledge"
    );
  }

  if (type === "school" || type === "trip") {
    return [
      firstValue(row, ["program_name", "p_program_name", "i_program_name", "program_title"]),
      firstValue(row, ["pricing_tier_label", "p_pricing_tier_label", "i_pricing_tier_label"]),
    ]
      .filter(Boolean)
      .join(" - ");
  }

  return firstValue(
    row,
    [
      "donation_category_label",
      "p_donation_category_label",
      "i_donation_category_label",
      "donation_category",
      "p_donation_category",
      "i_donation_category",
      "sub_category",
      "description",
    ],
    "Donation"
  );
}

function buildMethodLabel(row = {}) {
  const method = normalizeKey(
    firstValue(row, ["payment_method", "p_payment_method", "method"])
  );

  if (method === "card") {
    return [
      firstValue(row, ["card_brand", "p_card_brand"], "Card"),
      firstValue(row, ["card_last4", "p_card_last4"])
        ? `**** ${firstValue(row, ["card_last4", "p_card_last4"])}`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (["ach", "bank", "bank_transfer", "us_bank_account"].includes(method)) {
    const last4 = firstValue(row, ["bank_last4", "p_bank_last4"]);
    return last4 ? `ACH / Bank **** ${last4}` : "ACH / Bank";
  }

  if (method === "check") return "Check";
  if (method === "cash") return "Cash";
  if (method === "zelle") return "Zelle";

  return pretty(method || "Payment");
}

function normalizeReceiptRow(row = {}) {
  row.payment_number =
    row.payment_number ||
    row.p_payment_number ||
    null;

  row.invoice_number =
    row.invoice_number ||
    row.i_invoice_number ||
    null;

  row.member_no =
    row.member_no ||
    row.p_member_no ||
    row.i_member_no ||
    row.m_member_no ||
    null;

  row.full_name_snapshot = firstValue(
    row,
    [
      "payer_name",
      "donor_name",
      "guest_name",
      "customer_name",
      "p_full_name_snapshot",
      "i_full_name_snapshot",
      "full_name_snapshot",
      "m_full_name",
      "member_full_name",
    ],
    "Friend"
  );

  row.email_snapshot = firstValue(
    row,
    [
      "payer_email",
      "donor_email",
      "guest_email",
      "customer_email",
      "p_email_snapshot",
      "i_email_snapshot",
      "email_snapshot",
      "m_email",
      "member_email",
    ],
    null
  );

  row.phone_snapshot = firstValue(
    row,
    [
      "payer_phone",
      "donor_phone",
      "guest_phone",
      "customer_phone",
      "p_phone_snapshot",
      "i_phone_snapshot",
      "phone_snapshot",
      "m_phone",
      "member_phone",
    ],
    null
  );

  row.reference_no =
    row.reference_no ||
    row.p_reference_no ||
    row.p_transaction_reference ||
    row.transaction_reference ||
    row.stripe_payment_intent_id ||
    row.p_stripe_payment_intent_id ||
    null;

  row.payment_method =
    row.payment_method ||
    row.p_payment_method ||
    row.method ||
    null;

  row.amount =
    row.amount ||
    row.receipt_amount ||
    row.p_amount ||
    row.total_amount ||
    0;

  row.card_brand = row.card_brand || row.p_card_brand || null;
  row.card_last4 = row.card_last4 || row.p_card_last4 || null;
  row.bank_last4 = row.bank_last4 || row.p_bank_last4 || null;

  return row;
}

async function getReceiptForEmail(receiptId) {
  const pSelect = await selectExisting("p", "tbl_finance_payments", [
    "payment_number",
    "invoice_id",
    "amount",
    "payment_type",
    "category",
    "sub_category",
    "donation_category",
    "donation_category_label",
    "payment_method",
    "method",
    "reference_no",
    "transaction_reference",
    "stripe_payment_intent_id",
    "card_brand",
    "card_last4",
    "bank_last4",
    "bank_name",
    "full_name_snapshot",
    "email_snapshot",
    "phone_snapshot",
    "member_no",
    "payer_type",
    "plan_name",
    "coverage_label",
    "coverage_from",
    "coverage_to",
    "coverage_start_date",
    "coverage_end_date",
    "coverage_months_json",
    "months_paid",
    "program_name",
    "program_title",
    "program_category",
    "participants_json",
    "participant_count",
    "pricing_tier_label",
    "campaign_name",
    "pledge_number",
    "pledged_amount",
    "pledge_amount",
    "paid_amount",
    "remaining_balance",
    "pledge_remaining_amount",
  ]);

  const iSelect = await selectExisting("i", "tbl_finance_invoices", [
    "invoice_number",
    "full_name_snapshot",
    "email_snapshot",
    "phone_snapshot",
    "member_no",
    "payer_type",
    "invoice_type",
    "category",
    "donation_category",
    "donation_category_label",
    "plan_name",
    "coverage_label",
    "coverage_from",
    "coverage_to",
    "coverage_start_date",
    "coverage_end_date",
    "coverage_months_json",
    "months_paid",
    "program_name",
    "program_title",
    "program_category",
    "participants_json",
    "participant_count",
    "pricing_tier_label",
    "campaign_name",
    "pledge_number",
    "balance_due",
    "remaining_amount",
  ]);

  const mSelect = await selectExisting("m", "tbl_members", [
    "member_no",
    "full_name",
    "email",
    "phone",
  ]);

  const extraSelect = [...pSelect, ...iSelect, ...mSelect];

  const [[row]] = await pool.query(
    `
    SELECT
      r.*
      ${extraSelect.length ? `, ${extraSelect.join(", ")}` : ""}

    FROM tbl_finance_receipts r

    LEFT JOIN tbl_finance_payments p
      ON p.id = r.payment_id

    LEFT JOIN tbl_finance_invoices i
      ON i.id = COALESCE(r.invoice_id, p.invoice_id)

    LEFT JOIN tbl_members m
      ON m.id = r.member_id

    WHERE r.id = ?
    LIMIT 1
    `,
    [receiptId]
  );

  return row ? normalizeReceiptRow(row) : null;
}

async function insertTracking(payload = {}) {
  if (!(await tableExists(RECEIPT_TRACKING_TABLE))) return null;

  const cols = await tableColumns(RECEIPT_TRACKING_TABLE);

  const data = {
    receipt_id: payload.receipt_id || null,
    receipt_number: payload.receipt_number || null,
    payment_id: payload.payment_id || null,
    payment_number: payload.payment_number || null,
    recipient_email: payload.email || null,
    status: payload.status || "sent",
    subject: payload.subject || null,
    error_message: payload.error_message || null,
    sent_at: payload.sent_at || null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const keys = Object.keys(data).filter((key) => cols.has(key));
  if (!keys.length) return null;

  try {
    const [result] = await pool.query(
      `
      INSERT INTO ${sqlId(RECEIPT_TRACKING_TABLE)}
      (${keys.map(sqlId).join(", ")})
      VALUES (${keys.map(() => "?").join(", ")})
      `,
      keys.map((key) => data[key])
    );

    return result.insertId;
  } catch (err) {
    console.error("receipt email tracking failed:", err.message);
    return null;
  }
}

async function updateReceiptEmailStatus(receiptId, status, errorMessage = null) {
  const cols = await tableColumns("tbl_finance_receipts");

  const data = {
    email_status: status,
    receipt_email_status: status,
    email_sent_at: status === "sent" ? new Date() : null,
    last_email_sent_at: status === "sent" ? new Date() : null,
    email_error: errorMessage,
    updated_at: new Date(),
  };

  const keys = Object.keys(data).filter((key) => cols.has(key));
  if (!keys.length) return null;

  try {
    await pool.query(
      `
      UPDATE tbl_finance_receipts
      SET ${keys.map((key) => `${sqlId(key)} = ?`).join(", ")}
      WHERE id = ?
      `,
      [...keys.map((key) => data[key]), receiptId]
    );
  } catch (err) {
    console.error("receipt email status update failed:", err.message);
  }

  return true;
}

function buildReceiptSubject(row = {}) {
  return `${APP_NAME} Receipt ${row.receipt_number || ""}`.trim();
}

function buildReceiptText(row = {}) {
  const participants = participantNames(row);
  const coverage = firstValue(row, [
    "coverage_label",
    "p_coverage_label",
    "i_coverage_label",
  ]);

  return [
    `${APP_NAME} Receipt`,
    "",
    `Dear ${row.full_name_snapshot || "Friend"},`,
    "",
    "Thank you. Your payment has been received and recorded.",
    "A PDF copy of your official receipt is attached to this email.",
    "",
    `Receipt #: ${row.receipt_number || "--"}`,
    `Payment #: ${row.payment_number || "--"}`,
    `Invoice #: ${row.invoice_number || "--"}`,
    `Type: ${paymentTypeLabel(row)}`,
    `Category: ${categoryLine(row)}`,
    `Amount: ${money(row.amount || row.total_amount)}`,
    `Method: ${buildMethodLabel(row)}`,
    row.reference_no ? `Reference: ${row.reference_no}` : "",
    coverage ? `Coverage: ${coverage}` : "",
    participants.length ? `Participants: ${participants.join(", ")}` : "",
    "",
    APP_NAME,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildReceiptHtml(row = {}) {
  const participants = participantNames(row);
  const coverage = firstValue(row, [
    "coverage_label",
    "p_coverage_label",
    "i_coverage_label",
  ]);

  const detailRows = [
    ["Receipt #", row.receipt_number || "--"],
    ["Payment #", row.payment_number || "--"],
    ["Invoice #", row.invoice_number || "--"],
    ["Type", paymentTypeLabel(row)],
    ["Category", categoryLine(row)],
    coverage ? ["Coverage", coverage] : null,
    participants.length ? ["Participants", participants.join(", ")] : null,
    ["Method", buildMethodLabel(row)],
    row.reference_no ? ["Reference", row.reference_no] : null,
  ].filter(Boolean);

  return `
  <div style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:720px;margin:0 auto;padding:28px 16px;">
      <div style="background:#0b3d66;color:#ffffff;border-radius:10px 10px 0 0;padding:28px;">
        <h1 style="margin:0;font-size:24px;line-height:1.25;">${escapeHtml(APP_NAME)}</h1>
        <p style="margin:8px 0 0;color:#dbeafe;">Official Finance Receipt</p>
      </div>

      <div style="background:#ffffff;border:1px solid #d8e2ee;border-top:0;border-radius:0 0 10px 10px;padding:28px;">
        <h2 style="margin:0 0 12px;font-size:22px;">Payment Received</h2>

        <p style="margin:0 0 20px;color:#334155;line-height:1.55;">
          Dear ${escapeHtml(row.full_name_snapshot || "Friend")}, thank you.
          Your payment has been received and recorded by the Holy Trinity Finance Office.
          A PDF copy of your official receipt is attached to this email.
        </p>

        <div style="border:1px solid #d8e2ee;border-radius:8px;padding:16px;background:#f8fbff;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            ${detailRows
              .map(
                ([label, value]) => `
                <tr>
                  <td style="padding:8px 0;color:#64748b;">${escapeHtml(label)}</td>
                  <td style="padding:8px 0;text-align:right;font-weight:700;color:#0f172a;">
                    ${escapeHtml(value)}
                  </td>
                </tr>`
              )
              .join("")}
            <tr>
              <td style="padding:12px 0 0;color:#64748b;border-top:1px solid #d8e2ee;">Amount</td>
              <td style="padding:12px 0 0;text-align:right;font-weight:800;color:#047857;border-top:1px solid #d8e2ee;font-size:18px;">
                ${escapeHtml(money(row.amount || row.total_amount))}
              </td>
            </tr>
          </table>
        </div>

        <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.5;">
          Please keep the attached PDF receipt for your records.
        </p>
      </div>

      <div style="text-align:center;color:#64748b;font-size:12px;margin-top:16px;">
        ${escapeHtml(APP_NAME)}
      </div>
    </div>
  </div>
  `;
}

async function buildAttachments(row, options = {}) {
  if (options.attach_pdf === false || options.attachPdf === false) return [];

  try {
    let buffer = null;
    let pdfMeta = null;

    if (typeof receiptPdfService.generateReceiptPdfBuffer === "function") {
      buffer = await receiptPdfService.generateReceiptPdfBuffer(row);
    } else if (typeof receiptPdfService.generateReceiptPdf === "function") {
      pdfMeta = await receiptPdfService.generateReceiptPdf(row);

      buffer =
        Buffer.isBuffer(pdfMeta)
          ? pdfMeta
          : pdfMeta?.buffer ||
            pdfMeta?.data ||
            (pdfMeta?.file_path ? await fs.readFile(pdfMeta.file_path) : null);
    }

    if (!buffer) return [];

    return [
      {
        filename: `${clean(row.receipt_number || "receipt", 120)}.pdf`,
        content: buffer,
        contentType: "application/pdf",
      },
    ];
  } catch (err) {
    console.error("receipt PDF attachment failed:", err.message);
    return [];
  }
}

async function sendMail(payload) {
  if (typeof emailService.sendEmail === "function") {
    return emailService.sendEmail(payload);
  }

  if (typeof emailService.sendMail === "function") {
    return emailService.sendMail(payload);
  }

  if (emailService.transporter?.sendMail) {
    return emailService.transporter.sendMail(payload);
  }

  throw new Error("No email sender is configured.");
}

function resolveReceiptId(input) {
  if (typeof input === "object" && input !== null) {
    return input.receipt_id || input.receiptId || input.id;
  }

  return input;
}

async function sendReceiptEmail(receiptIdOrPayload, options = {}) {
  const receiptId = resolveReceiptId(receiptIdOrPayload);
  const optionBag =
    typeof receiptIdOrPayload === "object" && receiptIdOrPayload !== null
      ? { ...receiptIdOrPayload, ...options }
      : options;

  const row = await getReceiptForEmail(receiptId);

  if (!row) {
    throw new Error("Receipt not found.");
  }

  const to =
    clean(optionBag.email || optionBag.to, 190) ||
    row.email_snapshot;

  if (!to) {
    throw new Error("Receipt recipient email is required.");
  }

  const subject =
    clean(optionBag.subject, 255) ||
    buildReceiptSubject(row);

  const attachments =
    Array.isArray(optionBag.attachments)
      ? [...optionBag.attachments]
      : await buildAttachments(row, optionBag);

  try {
    const result = await sendMail({
      from: optionBag.from || DEFAULT_FROM,
      to,
      cc: optionBag.cc || undefined,
      bcc: optionBag.bcc || undefined,
      replyTo: optionBag.replyTo || process.env.FINANCE_REPLY_TO || undefined,
      subject,
      html: optionBag.html || buildReceiptHtml(row),
      text: optionBag.text || buildReceiptText(row),
      attachments,

      raw: true,
      layout: false,
      template: false,
      skipDefaultLayout: true,
      suppressDefaultLayout: true,
      suppressDefaultHeader: true,
      suppressDefaultFooter: true,
    });

    await insertTracking({
      receipt_id: row.id,
      receipt_number: row.receipt_number,
      payment_id: row.payment_id,
      payment_number: row.payment_number,
      email: to,
      status: "sent",
      subject,
      sent_at: new Date(),
    });

    await updateReceiptEmailStatus(row.id, "sent");

    return {
      success: true,
      to,
      subject,
      receipt_id: row.id,
      receipt_number: row.receipt_number,
      attached_pdf: attachments.some((item) => item.contentType === "application/pdf"),
      result,
    };
  } catch (err) {
    await insertTracking({
      receipt_id: row.id,
      receipt_number: row.receipt_number,
      payment_id: row.payment_id,
      payment_number: row.payment_number,
      email: to,
      status: "failed",
      subject,
      error_message: err.message,
    });

    await updateReceiptEmailStatus(row.id, "failed", err.message);

    throw err;
  }
}

async function resendReceiptEmail(receiptId, options = {}) {
  return sendReceiptEmail(receiptId, {
    ...options,
    resend: true,
  });
}

async function sendReceiptEmailByPayment(paymentId, options = {}) {
  const [[row]] = await pool.query(
    `
    SELECT id
    FROM tbl_finance_receipts
    WHERE payment_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [paymentId]
  );

  if (!row) {
    throw new Error("Receipt not found for payment.");
  }

  return sendReceiptEmail(row.id, options);
}

module.exports = {
  getReceiptForEmail,

  buildReceiptSubject,
  buildReceiptText,
  buildReceiptHtml,
  buildAttachments,

  sendReceiptEmail,
  resendReceiptEmail,
  sendReceiptEmailByPayment,
};