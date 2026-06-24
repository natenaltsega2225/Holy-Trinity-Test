"use strict";

const express = require("express");

const pool = require("../db");

const {
  authRequired,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

const FINANCE_ROLES = ["finance", "admin", "super_admin"];

const DEFAULT_CATEGORIES = [
  { key: "utilities", label: "Utilities", active: 1 },
  { key: "maintenance", label: "Maintenance", active: 1 },
  { key: "supplies", label: "Supplies", active: 1 },
  { key: "charity", label: "Charity", active: 1 },
  { key: "clergy", label: "Clergy Support", active: 1 },
  { key: "program", label: "Program Expense", active: 1 },
  { key: "reimbursement", label: "Individual Reimbursement", active: 1 },
  { key: "vendor", label: "Vendor Payment", active: 1 },
  { key: "other", label: "Other", active: 1 },
];

const columnCache = new Map();

function loadEmailSender() {
  const candidates = [
    "../services/emailService",
    "../services/mailService",
    "../services/mailer",
    "../utils/email",
    "../utils/mailer",
    "../config/mailer",
  ];

  for (const path of candidates) {
    try {
      const mod = require(path);

      if (typeof mod === "function") {
        return (message) => mod(message);
      }

      for (const name of ["sendEmail", "sendMail", "send", "mail"]) {
        if (typeof mod?.[name] === "function") {
          return (message) => mod[name](message);
        }
      }

      if (typeof mod?.transporter?.sendMail === "function") {
        return (message) => mod.transporter.sendMail(message);
      }
    } catch (_err) {}
  }

  return null;
}

const sendEmail = loadEmailSender();

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function slug(value) {
  return clean(value, 120)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "other";
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function intValue(value, fallback = null) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function boolFlag(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "y", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

async function tableColumns(table) {
  if (columnCache.has(table)) return columnCache.get(table);

  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
    const columns = new Set(rows.map((row) => row.Field));
    columnCache.set(table, columns);
    return columns;
  } catch (_err) {
    const columns = new Set();
    columnCache.set(table, columns);
    return columns;
  }
}

function pickExisting(columns, aliases) {
  return aliases.find((name) => columns.has(name)) || null;
}

function sqlId(name) {
  return `\`${String(name).replaceAll("`", "``")}\``;
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tbl_finance_expense_categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      category_key VARCHAR(120) NOT NULL,
      label VARCHAR(180) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_expense_category_key (category_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tbl_finance_expenses (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      expense_number VARCHAR(80) NOT NULL,
      expense_type VARCHAR(40) NOT NULL DEFAULT 'vendor',
      category VARCHAR(120) NOT NULL DEFAULT 'other',
      category_label VARCHAR(180) NULL,
      vendor_name VARCHAR(180) NULL,
      vendor_email VARCHAR(190) NULL,
      vendor_phone VARCHAR(60) NULL,
      payee_first_name VARCHAR(120) NULL,
      payee_last_name VARCHAR(120) NULL,
      payee_full_name VARCHAR(240) NULL,
      payee_email VARCHAR(190) NULL,
      payee_phone VARCHAR(60) NULL,
      payee_address VARCHAR(255) NULL,
      payee_city VARCHAR(120) NULL,
      payee_state VARCHAR(80) NULL,
      payee_zip VARCHAR(30) NULL,
      description TEXT NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      payment_method VARCHAR(40) NULL,
      reference_no VARCHAR(160) NULL,
      invoice_no VARCHAR(160) NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      approval_status VARCHAR(40) NOT NULL DEFAULT 'pending',
      expense_date DATE NULL,
      due_date DATE NULL,
      paid_at DATETIME NULL,
      notes TEXT NULL,
      metadata_json JSON NULL,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_expense_number (expense_number),
      KEY idx_finance_expenses_status (status),
      KEY idx_finance_expenses_category (category),
      KEY idx_finance_expenses_date (expense_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  columnCache.delete("tbl_finance_expenses");
  columnCache.delete("tbl_finance_expense_categories");
}

async function seedDefaultCategories() {
  await ensureTables();

  for (const category of DEFAULT_CATEGORIES) {
    await pool.query(
      `
      INSERT INTO tbl_finance_expense_categories
        (category_key, label, is_active)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        label = VALUES(label),
        is_active = GREATEST(is_active, VALUES(is_active))
      `,
      [category.key, category.label, category.active]
    );
  }
}

async function listCategories(_req, res) {
  try {
    await seedDefaultCategories();

    const [rows] = await pool.query(`
      SELECT
        id,
        category_key AS value,
        category_key AS category_key,
        label,
        is_active
      FROM tbl_finance_expense_categories
      WHERE is_active = 1
      ORDER BY label ASC
    `);

    return res.json({
      ok: true,
      categories: rows,
      rows,
    });
  } catch (err) {
    console.error("expense category list failed:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load expense categories.",
    });
  }
}

async function createCategory(req, res) {
  try {
    await ensureTables();

    const label = clean(req.body?.label || req.body?.name, 180);
    const key = slug(req.body?.key || label);

    if (!label) {
      return res.status(400).json({
        ok: false,
        error: "Category label is required.",
      });
    }

    const actorId = req.user?.id || req.user?.user_id || null;

    await pool.query(
      `
      INSERT INTO tbl_finance_expense_categories
        (category_key, label, is_active, created_by)
      VALUES (?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE
        label = VALUES(label),
        is_active = 1,
        updated_at = NOW()
      `,
      [key, label, actorId]
    );

    return res.json({
      ok: true,
      category: {
        value: key,
        category_key: key,
        label,
        is_active: 1,
      },
    });
  } catch (err) {
    console.error("expense category create failed:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to create expense category.",
    });
  }
}

function buildExpensePayload(req, reimbursementMode = false) {
  const body = req.body || {};
  const expenseType = clean(
    body.expense_type || body.type || (reimbursementMode ? "reimbursement" : "vendor"),
    40
  ).toLowerCase();

  const firstName = clean(body.payee_first_name || body.first_name, 120);
  const lastName = clean(body.payee_last_name || body.last_name, 120);
  const payeeFullName =
    clean(body.payee_full_name || body.full_name, 240) ||
    clean(`${firstName} ${lastName}`, 240);

  const categoryValue = slug(body.category || body.category_key || expenseType);
  const categoryLabel =
    clean(body.category_label || body.category_name, 180) ||
    DEFAULT_CATEGORIES.find((item) => item.key === categoryValue)?.label ||
    clean(body.category || "Other", 180);

  const amount = money(body.amount || body.total_amount);

  if (amount <= 0) {
    const err = new Error("Expense amount must be greater than zero.");
    err.status = 400;
    throw err;
  }

  if (expenseType === "reimbursement" && !payeeFullName) {
    const err = new Error("Reimbursement requires the individual's full name.");
    err.status = 400;
    throw err;
  }

  if (expenseType !== "reimbursement" && !clean(body.vendor_name, 180)) {
    const err = new Error("Vendor name is required for vendor expenses.");
    err.status = 400;
    throw err;
  }

  const status = clean(body.status || body.approval_status || "pending", 40);

  return {
    expense_number:
      clean(body.expense_number, 80) ||
      `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    expense_type: expenseType,
    category: categoryValue,
    category_label: categoryLabel,
    vendor_name: clean(body.vendor_name, 180),
    vendor_email: clean(body.vendor_email, 190).toLowerCase(),
    vendor_phone: clean(body.vendor_phone, 60),
    payee_first_name: firstName,
    payee_last_name: lastName,
    payee_full_name: payeeFullName,
    payee_email: clean(body.payee_email || body.email, 190).toLowerCase(),
    payee_phone: clean(body.payee_phone || body.phone, 60),
    payee_address: clean(body.payee_address || body.address, 255),
    payee_city: clean(body.payee_city || body.city, 120),
    payee_state: clean(body.payee_state || body.state, 80),
    payee_zip: clean(body.payee_zip || body.zip, 30),
    description: clean(body.description || body.memo, 5000),
    amount,
    payment_method: clean(body.payment_method || body.method, 40).toLowerCase(),
    reference_no: clean(body.reference_no || body.reference, 160),
    invoice_no: clean(body.invoice_no || body.vendor_invoice_no, 160),
    status,
    approval_status: clean(body.approval_status || status, 40),
    expense_date: clean(body.expense_date || body.date, 10) || null,
    due_date: clean(body.due_date, 10) || null,
    paid_at: status === "paid" ? nowSql() : null,
    notes: clean(body.notes, 5000),
    metadata_json: JSON.stringify({
      reimbursement_details: body.reimbursement_details || null,
      vendor_details: body.vendor_details || null,
      original_payload: body,
    }),
  };
}

async function insertExisting(conn, table, payload) {
  const columns = await tableColumns(table);
  const keys = Object.keys(payload).filter((key) => columns.has(key));

  if (!keys.length) {
    throw new Error(`No writable columns found for ${table}.`);
  }

  const sql = `
    INSERT INTO ${sqlId(table)}
      (${keys.map(sqlId).join(", ")})
    VALUES
      (${keys.map(() => "?").join(", ")})
  `;

  const [result] = await conn.query(sql, keys.map((key) => payload[key]));
  return result.insertId;
}

async function writeExpenseAudit(req, payload = {}) {
  try {
    await insertExisting(pool, "tbl_audit_logs", {
      actor_id: req.user?.id || req.user?.user_id || null,
      actor_role: req.user?.role || req.user?.user_role || null,
      actor_email: req.user?.email || null,
      user_id: req.user?.id || req.user?.user_id || null,
      user_email: req.user?.email || null,
      action: clean(payload.action || "expense.updated", 120),
      entity: clean(payload.entity || "expense", 120),
      entity_type: clean(payload.entity_type || "expense", 120),
      entity_id: payload.entity_id || null,
      reference_no: clean(payload.reference_no, 160),
      status: clean(payload.status || "success", 40),
      severity: clean(payload.severity || "info", 40),
      description: clean(payload.description, 1000),
      message: clean(payload.description, 1000),
      ip_address: clean(
        req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        80
      ),
      user_agent: clean(req.headers["user-agent"], 500),
      metadata_json: payload.metadata ? JSON.stringify(payload.metadata) : null,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      created_at: nowSql(),
    });
  } catch (err) {
    console.error("expense audit failed:", err.message);
  }
}

function reimbursementEmailHtml(expense) {
  const name = clean(expense.payee_full_name || expense.vendor_name || "Recipient", 180);
  const amount = money(expense.amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#102033">
      <div style="max-width:720px;margin:0 auto;padding:28px">
        <div style="background:#0f4a73;color:white;padding:22px 26px;border-radius:10px 10px 0 0">
          <h1 style="margin:0;font-size:24px">Holy Trinity EOTC</h1>
          <p style="margin:6px 0 0;font-size:14px">Finance & Membership Platform</p>
        </div>
        <div style="background:white;border:1px solid #d9e3ef;border-top:0;padding:28px;border-radius:0 0 10px 10px">
          <h2 style="margin:0 0 14px;font-size:22px;color:#102033">Reimbursement Confirmation</h2>
          <p>Dear ${name},</p>
          <p>Your reimbursement has been recorded by the Holy Trinity finance team.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:18px">
            <tr>
              <td style="padding:10px;border:1px solid #d9e3ef;background:#f8fafc">Expense #</td>
              <td style="padding:10px;border:1px solid #d9e3ef;font-weight:700">${clean(expense.expense_number, 80)}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #d9e3ef;background:#f8fafc">Amount</td>
              <td style="padding:10px;border:1px solid #d9e3ef;font-weight:700">${amount}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #d9e3ef;background:#f8fafc">Payment Method</td>
              <td style="padding:10px;border:1px solid #d9e3ef">${clean(expense.payment_method || "--", 80)}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #d9e3ef;background:#f8fafc">Reference</td>
              <td style="padding:10px;border:1px solid #d9e3ef">${clean(expense.reference_no || "--", 160)}</td>
            </tr>
          </table>
          <p style="margin-top:24px;color:#607089;font-size:13px">
            This message was sent by Holy Trinity Finance & Membership Platform.
          </p>
        </div>
      </div>
    </div>
  `;
}

async function sendReimbursementEmail(req, expense) {
  if (!sendEmail) return;

  const recipient = clean(expense.payee_email || expense.vendor_email, 190);
  if (!recipient) return;

  try {
    await sendEmail({
      to: recipient,
      subject: `Holy Trinity Reimbursement ${expense.expense_number}`,
      text: `Your reimbursement of $${money(expense.amount).toFixed(2)} has been recorded.`,
      html: reimbursementEmailHtml(expense),
    });

    await writeExpenseAudit(req, {
      action: "reimbursement.email_sent",
      entity: "expense",
      entity_id: expense.id,
      reference_no: expense.expense_number,
      status: "success",
      description: `Reimbursement confirmation sent to ${recipient}.`,
    });
  } catch (err) {
    await writeExpenseAudit(req, {
      action: "reimbursement.email_failed",
      entity: "expense",
      entity_id: expense.id,
      reference_no: expense.expense_number,
      status: "failure",
      severity: "warning",
      description: `Reimbursement confirmation failed for ${recipient}: ${err.message}`,
    });
  }
}

async function updateExisting(conn, table, id, payload) {
  const columns = await tableColumns(table);
  const keys = Object.keys(payload).filter((key) => columns.has(key));

  if (!keys.length) return;

  await conn.query(
    `
    UPDATE ${sqlId(table)}
    SET ${keys.map((key) => `${sqlId(key)} = ?`).join(", ")}
    WHERE id = ?
    `,
    [...keys.map((key) => payload[key]), id]
  );
}

function mapExpenseRow(row = {}) {
  const payee =
    row.payee_full_name ||
    clean(`${row.payee_first_name || ""} ${row.payee_last_name || ""}`, 240) ||
    row.vendor_name ||
    "--";

  return {
    ...row,
    payee_name: payee,
    vendor_or_payee: row.vendor_name || payee,
    category_label: row.category_label || row.category || "Other",
    payment_method: row.payment_method || row.method || "--",
    approval_status: row.approval_status || row.status || "pending",
  };
}

async function listExpenses(req, res) {
  try {
    await ensureTables();

    const query = req.query || {};
    const columns = await tableColumns("tbl_finance_expenses");
    const where = [];
    const params = [];

    const search = clean(query.q || query.search, 120);
    if (search) {
      const searchable = [
        "expense_number",
        "vendor_name",
        "payee_full_name",
        "payee_email",
        "vendor_email",
        "description",
        "reference_no",
        "invoice_no",
      ].filter((name) => columns.has(name));

      if (searchable.length) {
        where.push(
          `(${searchable.map((name) => `${sqlId(name)} LIKE ?`).join(" OR ")})`
        );
        params.push(...searchable.map(() => `%${search}%`));
      }
    }

    const statusColumn = pickExisting(columns, ["status", "approval_status"]);
    if (statusColumn && query.status) {
      where.push(`${sqlId(statusColumn)} = ?`);
      params.push(clean(query.status, 40));
    }

    if (columns.has("category") && query.category) {
      where.push("category = ?");
      params.push(slug(query.category));
    }

    const method = clean(query.payment_method || query.method, 40).toLowerCase();
    if (columns.has("payment_method") && method) {
      where.push("payment_method = ?");
      params.push(method);
    }

    const dateColumn = pickExisting(columns, ["expense_date", "created_at"]);
    const from = clean(query.from || query.startDate || query.date_from, 10);
    const to = clean(query.to || query.endDate || query.date_to, 10);

    if (dateColumn && from) {
      where.push(`DATE(${sqlId(dateColumn)}) >= ?`);
      params.push(from);
    }

    if (dateColumn && to) {
      where.push(`DATE(${sqlId(dateColumn)}) <= ?`);
      params.push(to);
    }

    const limit = Math.min(Math.max(intValue(query.limit || query.pageSize, 100), 1), 250);
    const page = Math.max(intValue(query.page, 1), 1);
    const offset = (page - 1) * limit;

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_expenses
      ${whereSql}
      ORDER BY COALESCE(expense_date, created_at) DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const mapped = rows.map(mapExpenseRow);
    const totalAmount = mapped.reduce((sum, row) => sum + money(row.amount), 0);

    return res.json({
      ok: true,
      rows: mapped,
      expenses: mapped,
      data: mapped,
      page,
      pageSize: limit,
      summary: {
        records: mapped.length,
        total_amount: Number(totalAmount.toFixed(2)),
        pending_amount: Number(
          mapped
            .filter((row) => String(row.status).toLowerCase() === "pending")
            .reduce((sum, row) => sum + money(row.amount), 0)
            .toFixed(2)
        ),
        paid_amount: Number(
          mapped
            .filter((row) => String(row.status).toLowerCase() === "paid")
            .reduce((sum, row) => sum + money(row.amount), 0)
            .toFixed(2)
        ),
      },
    });
  } catch (err) {
    console.error("expense list failed:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load expenses.",
    });
  }
}

async function createExpense(req, res, reimbursementMode = false) {
  const conn = await pool.getConnection();

  try {
    await ensureTables();
    await conn.beginTransaction();

    const payload = buildExpensePayload(req, reimbursementMode);
    payload.created_by = req.user?.id || req.user?.user_id || null;
    payload.updated_by = payload.created_by;

    if (payload.category && payload.category_label) {
      await conn.query(
        `
        INSERT INTO tbl_finance_expense_categories
          (category_key, label, is_active, created_by)
        VALUES (?, ?, 1, ?)
        ON DUPLICATE KEY UPDATE
          label = VALUES(label),
          is_active = 1,
          updated_at = NOW()
        `,
        [payload.category, payload.category_label, payload.created_by]
      );
    }

    const id = await insertExisting(conn, "tbl_finance_expenses", payload);

    await conn.commit();

    const createdExpense = {
      id,
      ...payload,
    };

    await writeExpenseAudit(req, {
      action:
        payload.expense_type === "reimbursement"
          ? "reimbursement.created"
          : "expense.created",
      entity: "expense",
      entity_id: id,
      reference_no: payload.expense_number,
      status: "success",
      description:
        payload.expense_type === "reimbursement"
          ? `Reimbursement created for ${payload.payee_full_name}.`
          : `Expense created for ${payload.vendor_name}.`,
      metadata: {
        amount: payload.amount,
        category: payload.category,
        expense_type: payload.expense_type,
      },
    });

    if (
      payload.expense_type === "reimbursement" &&
      String(payload.status).toLowerCase() === "paid"
    ) {
      await sendReimbursementEmail(req, createdExpense);
    }

    return res.status(201).json({
      ok: true,
      message:
        payload.expense_type === "reimbursement"
          ? "Reimbursement created successfully."
          : "Expense created successfully.",
      id,
      expense: createdExpense,
    });
  } catch (err) {
    await conn.rollback();
    console.error("expense create failed:", err);

    return res.status(err.status || 500).json({
      ok: false,
      error: err.status ? err.message : "Failed to create expense.",
    });
  } finally {
    conn.release();
  }
}

async function updateExpense(req, res) {
  const id = intValue(req.params.id, 0);

  if (!id) {
    return res.status(400).json({
      ok: false,
      error: "Valid expense id is required.",
    });
  }

  const conn = await pool.getConnection();

  try {
    await ensureTables();
    await conn.beginTransaction();

    const body = req.body || {};
    const patch = {};

    for (const key of [
      "status",
      "approval_status",
      "payment_method",
      "reference_no",
      "notes",
      "due_date",
      "expense_date",
      "description",
      "category",
      "category_label",
    ]) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    if (body.status === "paid") {
      patch.paid_at = nowSql();
    }

    patch.updated_by = req.user?.id || req.user?.user_id || null;

    await updateExisting(conn, "tbl_finance_expenses", id, patch);
    await conn.commit();

    const [rows] = await pool.query(
      `
      SELECT *
      FROM tbl_finance_expenses
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    const expense = rows[0] || { id, ...patch };

    await writeExpenseAudit(req, {
      action:
        String(patch.status || body.status || "").toLowerCase() === "paid"
          ? "expense.marked_paid"
          : "expense.updated",
      entity: "expense",
      entity_id: id,
      reference_no: expense.expense_number,
      status: "success",
      description: `Expense ${expense.expense_number || id} updated.`,
      metadata: {
        patch,
      },
    });

    if (
      String(expense.expense_type || "").toLowerCase() === "reimbursement" &&
      String(patch.status || expense.status || "").toLowerCase() === "paid"
    ) {
      await sendReimbursementEmail(req, expense);
    }

    return res.json({
      ok: true,
      message: "Expense updated successfully.",
      id,
    });
  } catch (err) {
    await conn.rollback();
    console.error("expense update failed:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to update expense.",
    });
  } finally {
    conn.release();
  }
}

router.use(authRequired);
router.use(requireRole(...FINANCE_ROLES));

router.get(["/", "/expenses", "/reimbursements"], listExpenses);
router.post(["/", "/expenses"], (req, res) => createExpense(req, res, false));
router.post("/reimbursements", (req, res) => createExpense(req, res, true));
router.patch(["/:id", "/expenses/:id", "/reimbursements/:id"], updateExpense);
router.post(["/:id/status", "/expenses/:id/status", "/reimbursements/:id/status"], updateExpense);

router.get(
  ["/categories", "/expenses/categories", "/expense-categories"],
  listCategories
);

router.post(
  ["/categories", "/expenses/categories", "/expense-categories"],
  createCategory
);

router.get("/health/check", (_req, res) => {
  res.json({
    ok: true,
    module: "financeExpenses",
    version: "enterprise",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
