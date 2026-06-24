// frontend/src/components/FinanceDashboard/pages/CashEntries.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import api from "../../api";
import FinanceManualEntriesTabs from "../components/FinanceManualEntriesTabs";
import "../../../styles/finance-enterprise.css";
import FinanceActionMenu from "../components/FinanceActionMenu"
const CASH_MODES = [
  { value: "", label: "All Cash Types" },
  { value: "individual", label: "Individual" },
  { value: "collection", label: "Grouped Collection" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "individual", label: "Individual" },
  { value: "general_collection", label: "General Collection" },
  { value: "sunday_cash_collection", label: "Sunday Cash Collection" },
  { value: "special_fund_collection", label: "Special Fund Collection" },
  { value: "event_fund_collection", label: "Event Fund Collection" },
  { value: "pledge_fund_collection", label: "Pledge Fund Collection" },
  { value: "membership", label: "Membership Dues" },
  { value: "donation", label: "Donation" },
  { value: "pledge", label: "Pledge Payment" },
  { value: "school", label: "School Program" },
  { value: "trip", label: "Trip Program" },
];

const DONATION_CATEGORIES = [
  { value: "general_donation", label: "ስጦታ — General Donation" },
  { value: "plate_collection", label: "መባ — Plate Collection" },
  { value: "candle_sale", label: "ሻማ — Candle Sale" },
  { value: "tithe", label: "አስራት — Tithe" },
  { value: "vows", label: "ስዕለት — Vows" },
  { value: "building_fund", label: "የቤተክርስቲያን ማሰሪያ — Building Fund" },
  { value: "charity_fund", label: "በጎ አድራጎት — Charity Fund" },
  { value: "other_fund", label: "ሌላ — Other Fund" },
];

function clean(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return `$${numberValue(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function firstValue(source = {}, keys = [], fallback = "") {
  for (const key of keys) {
    const value = source?.[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusTone(value) {
  const status = String(value || "").toLowerCase();

  if (["paid", "posted", "completed", "received", "deposited"].includes(status)) {
    return "success";
  }

  if (["pending", "open", "processing"].includes(status)) {
    return "warning";
  }

  if (["failed", "void", "cancelled", "reversed"].includes(status)) {
    return "danger";
  }

  return "neutral";
}

function StatusBadge({ value }) {
  return (
    <span className={`finance-status-badge ${statusTone(value)}`}>
      {pretty(value)}
    </span>
  );
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.cash_entries)) return data.cash_entries;
  if (Array.isArray(data?.entries)) return data.entries;
  if (Array.isArray(data?.payments)) return data.payments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;

  return [];
}

function entryId(row = {}) {
  return firstValue(row, ["id", "entry_id", "payment_id"], "");
}

function cashMode(row = {}) {
  return firstValue(row, ["cash_mode", "entry_type", "mode"], "individual");
}

function category(row = {}) {
  return firstValue(row, ["category", "payment_category", "payment_type"], "--");
}

function donationCategory(row = {}) {
  return firstValue(row, ["donation_category", "sub_category", "fund"], "--");
}

function payerName(row = {}) {
  return firstValue(
    row,
    ["full_name_snapshot", "full_name", "payer_name", "donor_name", "member_name", "name"],
    cashMode(row) === "collection" ? "Grouped Collection" : "Guest Donor"
  );
}

function payerEmail(row = {}) {
  return firstValue(row, ["email_snapshot", "email", "payer_email", "donor_email"], "--");
}

function memberNo(row = {}) {
  return firstValue(row, ["member_no", "member_number"], "--");
}

function paymentNumber(row = {}) {
  return firstValue(row, ["payment_number", "payment_no"], "--");
}

function invoiceNumber(row = {}) {
  return firstValue(row, ["invoice_number", "invoice_no"], "--");
}

function receiptNumber(row = {}) {
  return firstValue(row, ["receipt_number", "receipt_no"], "--");
}

function referenceNo(row = {}) {
  return firstValue(row, ["reference_no", "reference_number", "transaction_reference"], "--");
}

function amount(row = {}) {
  return numberValue(firstValue(row, ["amount", "total_amount", "payment_amount"], 0));
}

function addedBy(row = {}) {
  return firstValue(row, ["added_by", "created_by_name", "recorded_by_name", "staff_name"], "--");
}

async function getFirst(endpoints, fallback = null) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const res = await api.get(endpoint);
      return res.data;
    } catch (err) {
      lastError = err;
      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) throw err;
    }
  }

  if (fallback !== null) return fallback;
  throw lastError || new Error("Cash entries endpoint is not available.");
}

async function postFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints.filter(Boolean)) {
    try {
      return await api.post(endpoint, payload);
    } catch (err) {
      lastError = err;
      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) throw err;
    }
  }

  throw lastError || new Error("Cash entry endpoint is not available.");
}

async function fetchPdf(endpoints) {
  let lastError = null;

  for (const endpoint of endpoints.filter(Boolean)) {
    try {
      const res = await api.get(endpoint, {
        responseType: "blob",
      });

      return new Blob([res.data], {
        type: res.headers?.["content-type"] || "application/pdf",
      });
    } catch (err) {
      lastError = err;
      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) throw err;
    }
  }

  throw lastError || new Error("PDF is not available.");
}

function openBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function exportCsv(rows) {
  const headers = [
    "Date",
    "Payment #",
    "Receipt #",
    "Invoice #",
    "Cash Type",
    "Payer",
    "Member ID",
    "Email",
    "Category",
    "Donation Category",
    "Reference",
    "Amount",
    "Added By",
    "Status",
  ];

  const csvRows = rows.map((row) => [
    formatDate(firstValue(row, ["received_at", "paid_at", "created_at"], "")),
    paymentNumber(row),
    receiptNumber(row),
    invoiceNumber(row),
    pretty(cashMode(row)),
    payerName(row),
    memberNo(row),
    payerEmail(row),
    pretty(category(row)),
    pretty(donationCategory(row)),
    referenceNo(row),
    amount(row),
    addedBy(row),
    firstValue(row, ["status"], "paid"),
  ]);

  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers, ...csvRows].map((line) => line.map(escape).join(",")).join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `cash-entries-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function CashEntryModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    cash_mode: "individual",
    payer_type: "member",
    member_no: "",
    full_name: "",
    email: "",
    phone: "",
    category: "donation",
    donation_category: "general_donation",
    amount: "",
    reference_no: "",
    received_date: new Date().toISOString().slice(0, 10),
    notes: "",
    send_receipt_email: true,
    create_invoice: true,
    send_invoice_email: false,
    create_ledger_entry: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setForm({
      cash_mode: "individual",
      payer_type: "member",
      member_no: "",
      full_name: "",
      email: "",
      phone: "",
      category: "donation",
      donation_category: "general_donation",
      amount: "",
      reference_no: "",
      received_date: new Date().toISOString().slice(0, 10),
      notes: "",
      send_receipt_email: true,
      create_invoice: true,
      send_invoice_email: false,
      create_ledger_entry: true,
    });

    setSaving(false);
    setError("");
  }, [open]);

  if (!open) return null;

  function update(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validate() {
    if (numberValue(form.amount) <= 0) return "Cash amount is required.";

    if (form.cash_mode === "individual" && !clean(form.full_name)) {
      return "Payer name is required for individual cash entry.";
    }

    if (
      form.cash_mode === "individual" &&
      form.payer_type === "member" &&
      !clean(form.member_no)
    ) {
      return "Member ID is required for member cash entry.";
    }

    if (
      form.cash_mode === "individual" &&
      (form.send_receipt_email || form.send_invoice_email) &&
      !clean(form.email)
    ) {
      return "Email is required when sending receipt or invoice.";
    }

    return "";
  }

  function buildPayload() {
    const grouped = form.cash_mode === "collection";

    return {
      cash_mode: form.cash_mode,
      entry_type: form.cash_mode,

      payer_type: grouped ? "collection" : form.payer_type,
      donor_type: grouped ? "collection" : form.payer_type,

      member_no: grouped ? null : clean(form.member_no) || null,

      full_name: grouped
        ? pretty(form.category)
        : clean(form.full_name),
      payer_name: grouped
        ? pretty(form.category)
        : clean(form.full_name),
      donor_name: grouped
        ? pretty(form.category)
        : clean(form.full_name),

      email: grouped ? null : clean(form.email) || null,
      payer_email: grouped ? null : clean(form.email) || null,
      donor_email: grouped ? null : clean(form.email) || null,
      phone: grouped ? null : clean(form.phone) || null,

      category: form.category,
      payment_type: form.category,
      sub_category:
        form.category === "donation" ? form.donation_category : form.category,
      donation_category:
        form.category === "donation" ? form.donation_category : null,

      amount: numberValue(form.amount),
      total_amount: numberValue(form.amount),
      payment_amount: numberValue(form.amount),

      method: "cash",
      payment_method: "cash",
      provider: "cash",
      reference_no: clean(form.reference_no) || null,
      transaction_reference: clean(form.reference_no) || null,

      received_date: form.received_date || null,
      received_at: form.received_date || null,
      paid_at: form.received_date || null,

      notes: clean(form.notes) || null,
      memo: clean(form.notes) || null,

      status: "paid",
      payment_status: "paid",

      manual_entry: true,
      manual_payment: true,
      manual_entry_type: "cash",
      source: "finance_cash_entries",

      generate_receipt: true,
      send_receipt_email: grouped ? false : Boolean(form.send_receipt_email),
      create_invoice: Boolean(form.create_invoice),
      generate_invoice: Boolean(form.create_invoice),
      send_invoice_email: grouped ? false : Boolean(form.send_invoice_email),
      create_ledger_entry: Boolean(form.create_ledger_entry),
      update_ledger: Boolean(form.create_ledger_entry),
    };
  }

  async function submit(event) {
    event.preventDefault();

    const message = validate();

    if (message) {
      setError(message);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = buildPayload();

      const res = await postFirst(
        ["/finance/cash", "/finance/payments", "/finance/manual-entries"],
        payload
      );

      onSaved?.(res?.data || {});
      onClose?.();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to record cash entry."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-cash-entry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-entry-title"
      >
        <form onSubmit={submit}>
          <div className="finance-modal-header">
            <div className="finance-modal-title-row">
              <span className="finance-modal-icon">
                <Banknote size={20} />
              </span>

              <div>
                <h2 id="cash-entry-title">Record Cash Entry</h2>
                <p>
                  Record individual cash or grouped collection totals with receipt,
                  invoice, ledger, and audit-ready tracking.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="finance-icon-button"
              onClick={onClose}
              aria-label="Close cash entry modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="finance-modal-body">
            {error ? (
              <div className="finance-alert finance-alert-danger">
                <AlertTriangle size={17} />
                <span>{error}</span>
              </div>
            ) : null}

            <section className="finance-panel">
              <div className="finance-form-grid">
                <label className="finance-field">
                  <span>Cash Type</span>
                  <select
                    value={form.cash_mode}
                    onChange={(event) => update("cash_mode", event.target.value)}
                  >
                    <option value="individual">Individual</option>
                    <option value="collection">Grouped Collection</option>
                  </select>
                </label>

                {form.cash_mode === "individual" ? (
                  <>
                    <label className="finance-field">
                      <span>Payer Type</span>
                      <select
                        value={form.payer_type}
                        onChange={(event) => update("payer_type", event.target.value)}
                      >
                        <option value="member">Member</option>
                        <option value="guest">Non-Member / Guest</option>
                      </select>
                    </label>

                    <label className="finance-field">
                      <span>Member ID</span>
                      <input
                        value={form.member_no}
                        onChange={(event) => update("member_no", event.target.value)}
                        placeholder="Example: M-00081"
                      />
                    </label>

                    <label className="finance-field">
                      <span>Full Name *</span>
                      <input
                        value={form.full_name}
                        onChange={(event) => update("full_name", event.target.value)}
                        required
                      />
                    </label>

                    <label className="finance-field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => update("email", event.target.value)}
                      />
                    </label>

                    <label className="finance-field">
                      <span>Phone</span>
                      <input
                        value={form.phone}
                        onChange={(event) => update("phone", event.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                <label className="finance-field">
                  <span>Category *</span>
                  <select
                    value={form.category}
                    onChange={(event) => update("category", event.target.value)}
                    required
                  >
                    {CATEGORY_OPTIONS.filter((option) => option.value).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {form.category === "donation" ? (
                  <label className="finance-field">
                    <span>Donation Category</span>
                    <select
                      value={form.donation_category}
                      onChange={(event) =>
                        update("donation_category", event.target.value)
                      }
                    >
                      {DONATION_CATEGORIES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="finance-field">
                  <span>Amount *</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => update("amount", event.target.value)}
                    required
                  />
                </label>

                <label className="finance-field">
                  <span>Received Date</span>
                  <input
                    type="date"
                    value={form.received_date}
                    onChange={(event) => update("received_date", event.target.value)}
                  />
                </label>

                <label className="finance-field">
                  <span>Reference</span>
                  <input
                    value={form.reference_no}
                    onChange={(event) => update("reference_no", event.target.value)}
                    placeholder="Optional batch/reference"
                  />
                </label>

                <label className="finance-field finance-field-full">
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) => update("notes", event.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="finance-panel">
              <div className="finance-checkbox-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={form.send_receipt_email}
                    onChange={(event) =>
                      update("send_receipt_email", event.target.checked)
                    }
                    disabled={form.cash_mode === "collection"}
                  />
                  <span>Email receipt PDF</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={form.create_invoice}
                    onChange={(event) => update("create_invoice", event.target.checked)}
                  />
                  <span>Create invoice record</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={form.send_invoice_email}
                    onChange={(event) =>
                      update("send_invoice_email", event.target.checked)
                    }
                    disabled={form.cash_mode === "collection"}
                  />
                  <span>Email invoice copy</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={form.create_ledger_entry}
                    onChange={(event) =>
                      update("create_ledger_entry", event.target.checked)
                    }
                  />
                  <span>Post ledger and audit trail</span>
                </label>
              </div>
            </section>
          </div>

          <div className="finance-modal-footer">
            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button type="submit" className="finance-btn finance-btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <RefreshCcw size={16} className="finance-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Receipt size={16} />
                  Record Cash
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CashEntries() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      params.set("method", "cash");
      params.set("payment_method", "cash");
      params.set("limit", "100");
      params.set("pageSize", "100");

      if (search) params.set("q", search);
      if (mode) params.set("cash_mode", mode);
      if (selectedCategory) params.set("category", selectedCategory);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const query = params.toString();

      const data = await getFirst(
        [
          `/finance/cash?${query}`,
          `/finance/payments?${query}`,
          `/finance/manual-entries?${query}`,
        ],
        { rows: [] }
      );

      setRows(normalizeRows(data));
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load cash entries."
      );
    } finally {
      setLoading(false);
    }
  }, [search, mode, selectedCategory, from, to]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const q = clean(search).toLowerCase();

    return rows.filter((row) => {
      const text = [
        paymentNumber(row),
        receiptNumber(row),
        invoiceNumber(row),
        payerName(row),
        payerEmail(row),
        memberNo(row),
        category(row),
        donationCategory(row),
        referenceNo(row),
        addedBy(row),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || text.includes(q);
      const matchesMode = !mode || String(cashMode(row)).toLowerCase() === mode;
      const matchesCategory =
        !selectedCategory ||
        String(category(row)).toLowerCase() === selectedCategory ||
        String(donationCategory(row)).toLowerCase() === selectedCategory;

      return matchesSearch && matchesMode && matchesCategory;
    });
  }, [rows, search, mode, selectedCategory]);

  const summary = useMemo(() => {
    const individualRows = filteredRows.filter(
      (row) => String(cashMode(row)).toLowerCase() !== "collection"
    );
    const collectionRows = filteredRows.filter(
      (row) => String(cashMode(row)).toLowerCase() === "collection"
    );

    return {
      records: filteredRows.length,
      total: filteredRows.reduce((sum, row) => sum + amount(row), 0),
      individual: individualRows.reduce((sum, row) => sum + amount(row), 0),
      collection: collectionRows.reduce((sum, row) => sum + amount(row), 0),
      receipts: filteredRows.filter((row) => receiptNumber(row) !== "--").length,
    };
  }, [filteredRows]);

  async function openReceiptPdf(row) {
    const id = firstValue(row, ["receipt_id"], "");
    const number = receiptNumber(row);

    setActionLoading(`receipt-${entryId(row)}`);
    setError("");

    try {
      const blob = await fetchPdf([
        id ? `/finance/receipts/${id}/pdf` : null,
        id ? `/receipts/${id}/pdf` : null,
        number && number !== "--" ? `/finance/receipts/${encodeURIComponent(number)}/pdf` : null,
      ]);

      openBlob(blob);
    } catch (err) {
      setError(err?.message || "Failed to open receipt PDF.");
    } finally {
      setActionLoading("");
    }
  }

  async function openInvoicePdf(row) {
    const id = firstValue(row, ["invoice_id"], "");
    const number = invoiceNumber(row);

    setActionLoading(`invoice-${entryId(row)}`);
    setError("");

    try {
      const blob = await fetchPdf([
        id ? `/finance/invoices/${id}/pdf` : null,
        id ? `/invoices/${id}/pdf` : null,
        number && number !== "--" ? `/finance/invoices/${encodeURIComponent(number)}/pdf` : null,
      ]);

      openBlob(blob);
    } catch (err) {
      setError(err?.message || "Failed to open invoice PDF.");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="finance-page finance-cash-entries-page">
      <div className="finance-page-header">
        <div>
          <p className="finance-eyebrow">Manual Collection</p>
          <h1>Cash Collection</h1>
          <p className="finance-page-subtitle">
            Track individual cash payments and grouped church cash collections with
            receipt, invoice, ledger, and audit visibility.
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={loadRows}
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? "finance-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={() => exportCsv(filteredRows)}
            disabled={!filteredRows.length}
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={16} />
            Record Cash
          </button>
        </div>
      </div>

      <FinanceManualEntriesTabs />

      {error ? (
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {successText ? (
        <div className="finance-alert finance-alert-success">
          <CheckCircle2 size={17} />
          <span>{successText}</span>
        </div>
      ) : null}

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <span>Records</span>
          <strong>{summary.records.toLocaleString()}</strong>
          <small>Visible cash entries</small>
        </div>

        <div className="finance-summary-card">
          <span>Total Cash</span>
          <strong>{money(summary.total)}</strong>
          <small>Current filtered total</small>
        </div>

        <div className="finance-summary-card">
          <span>Individual</span>
          <strong>{money(summary.individual)}</strong>
          <small>Individual cash payments</small>
        </div>

        <div className="finance-summary-card">
          <span>Collections</span>
          <strong>{money(summary.collection)}</strong>
          <small>Grouped collection totals</small>
        </div>

        <div className="finance-summary-card">
          <span>Receipts</span>
          <strong>{summary.receipts.toLocaleString()}</strong>
          <small>Generated receipts</small>
        </div>
      </div>

      <section className="finance-panel">
        <div className="finance-toolbar finance-toolbar-wrap">
          <label className="finance-search-field">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, member ID, payment #, receipt #, invoice #, category, reference..."
            />
          </label>

          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            {CASH_MODES.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            aria-label="From date"
          />

          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-label="To date"
          />
        </div>

        <div className="finance-table-wrap">
          <table className="finance-table finance-cash-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payment #</th>
                <th>Cash Type</th>
                <th>Payer / Collection</th>
                <th>Category</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Added By</th>
                <th>Invoice #</th>
                <th>Receipt #</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12}>
                    <div className="finance-table-loading">
                      <RefreshCcw size={17} className="finance-spin" />
                      Loading cash entries...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !filteredRows.length ? (
                <tr>
                  <td colSpan={12}>
                    <div className="finance-empty-state">No cash entries found.</div>
                  </td>
                </tr>
              ) : null}

              {!loading
                ? filteredRows.map((row) => {
                    const id = entryId(row);

                    return (
  <tr key={id || paymentNumber(row)}>
    <td>
      {formatDate(firstValue(row, ["received_at", "paid_at", "created_at"], ""))}
    </td>

    <td>{paymentNumber(row)}</td>
    <td>{pretty(cashMode(row))}</td>

    <td>
      <strong>{payerName(row)}</strong>
      <small className="finance-muted-block">
        {memberNo(row)} · {payerEmail(row)}
      </small>
    </td>

    <td>
      {pretty(category(row))}
      {donationCategory(row) !== "--" ? (
        <small className="finance-muted-block">
          {pretty(donationCategory(row))}
        </small>
      ) : null}
    </td>

    <td>{referenceNo(row)}</td>
    <td>{money(amount(row))}</td>
    <td>{addedBy(row)}</td>
    <td>{invoiceNumber(row)}</td>
    <td>{receiptNumber(row)}</td>

    <td>
      <StatusBadge value={firstValue(row, ["status"], "paid")} />
    </td>

    <td className="finance-action-cell">
      <FinanceActionMenu
        row={row}
        actions={[
          {
            key: "receipt",
            label: "Receipt",
            icon: Receipt,
            onClick: () => openReceiptPdf(row),
            visible: receiptNumber(row) !== "--",
            disabled: actionLoading === `receipt-${id}`,
          },
          {
            key: "invoice",
            label: "Invoice",
            icon: FileText,
            onClick: () => openInvoicePdf(row),
            visible: invoiceNumber(row) !== "--",
            disabled: actionLoading === `invoice-${id}`,
          },
        ]}
      />
    </td>
  </tr>
);
                  })
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <CashEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          setSuccessText("Cash entry recorded successfully.");
          await loadRows();
        }}
      />
    </div>
  );
}