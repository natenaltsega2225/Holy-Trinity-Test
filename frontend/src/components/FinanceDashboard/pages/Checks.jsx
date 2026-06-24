// frontend/src/components/FinanceDashboard/pages/Checks.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Landmark,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  Undo2,
  X,
} from "lucide-react";

import api from "../../api";
import FinanceManualEntriesTabs from "../components/FinanceManualEntriesTabs";
import "../../../styles/finance-enterprise.css";
import FinanceActionMenu from "../components/FinanceActionMenu"
const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "received", label: "Received" },
  { value: "deposited", label: "Deposited" },
  { value: "cleared", label: "Cleared" },
  { value: "returned", label: "Returned" },
  { value: "void", label: "Void" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "membership", label: "Membership Dues" },
  { value: "donation", label: "Donation" },
  { value: "pledge", label: "Pledge Payment" },
  { value: "school", label: "School Program" },
  { value: "trip", label: "Trip Program" },
  { value: "general_collection", label: "General Collection" },
  { value: "special_fund_collection", label: "Special Fund Collection" },
];

const DONATION_CATEGORIES = [
  { value: "general_donation", label: "ስጦታ — General Donation" },
  { value: "plate_collection", label: "መባ — Plate Collection" },
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

  if (["cleared", "paid", "posted", "completed"].includes(status)) {
    return "success";
  }

  if (["received", "deposited", "pending", "processing"].includes(status)) {
    return "warning";
  }

  if (["returned", "failed", "void", "cancelled"].includes(status)) {
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
  if (Array.isArray(data?.checks)) return data.checks;
  if (Array.isArray(data?.check_entries)) return data.check_entries;
  if (Array.isArray(data?.entries)) return data.entries;
  if (Array.isArray(data?.payments)) return data.payments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;

  return [];
}

function entryId(row = {}) {
  return firstValue(row, ["id", "entry_id", "payment_id"], "");
}

function paymentNumber(row = {}) {
  return firstValue(row, ["payment_number", "payment_no"], "--");
}

function receiptNumber(row = {}) {
  return firstValue(row, ["receipt_number", "receipt_no"], "--");
}

function invoiceNumber(row = {}) {
  return firstValue(row, ["invoice_number", "invoice_no"], "--");
}

function checkNumber(row = {}) {
  return firstValue(row, ["check_number", "check_no", "reference_no"], "--");
}

function bankName(row = {}) {
  return firstValue(row, ["bank_name", "bank", "financial_institution"], "--");
}

function payerName(row = {}) {
  return firstValue(
    row,
    ["full_name_snapshot", "full_name", "payer_name", "donor_name", "member_name", "name"],
    "Guest Donor"
  );
}

function payerEmail(row = {}) {
  return firstValue(row, ["email_snapshot", "email", "payer_email", "donor_email"], "--");
}

function memberNo(row = {}) {
  return firstValue(row, ["member_no", "member_number"], "--");
}

function amount(row = {}) {
  return numberValue(firstValue(row, ["amount", "total_amount", "payment_amount"], 0));
}

function category(row = {}) {
  return firstValue(row, ["category", "payment_category", "payment_type"], "--");
}

function donationCategory(row = {}) {
  return firstValue(row, ["donation_category", "sub_category", "fund"], "--");
}

function checkStatus(row = {}) {
  return firstValue(row, ["check_status", "status", "payment_status"], "received");
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
  throw lastError || new Error("Check entries endpoint is not available.");
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

  throw lastError || new Error("Check entry endpoint is not available.");
}

async function patchFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints.filter(Boolean)) {
    try {
      return await api.patch(endpoint, payload);
    } catch (err) {
      lastError = err;
      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) throw err;
    }
  }

  throw lastError || new Error("Check status endpoint is not available.");
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
    "Payer",
    "Member ID",
    "Email",
    "Check #",
    "Bank",
    "Category",
    "Donation Category",
    "Amount",
    "Status",
    "Deposited At",
    "Cleared At",
    "Added By",
  ];

  const csvRows = rows.map((row) => [
    formatDate(firstValue(row, ["received_at", "paid_at", "created_at"], "")),
    paymentNumber(row),
    receiptNumber(row),
    invoiceNumber(row),
    payerName(row),
    memberNo(row),
    payerEmail(row),
    checkNumber(row),
    bankName(row),
    pretty(category(row)),
    pretty(donationCategory(row)),
    amount(row),
    checkStatus(row),
    formatDate(firstValue(row, ["deposited_at"], "")),
    formatDate(firstValue(row, ["cleared_at"], "")),
    addedBy(row),
  ]);

  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers, ...csvRows].map((line) => line.map(escape).join(",")).join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `check-entries-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function CheckEntryModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    payer_type: "member",
    member_no: "",
    full_name: "",
    email: "",
    phone: "",
    category: "donation",
    donation_category: "general_donation",
    amount: "",
    check_number: "",
    bank_name: "",
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
      payer_type: "member",
      member_no: "",
      full_name: "",
      email: "",
      phone: "",
      category: "donation",
      donation_category: "general_donation",
      amount: "",
      check_number: "",
      bank_name: "",
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
    if (numberValue(form.amount) <= 0) return "Check amount is required.";
    if (!clean(form.check_number)) return "Check number is required.";
    if (!clean(form.full_name)) return "Payer name is required.";

    if (form.payer_type === "member" && !clean(form.member_no)) {
      return "Member ID is required for member check entry.";
    }

    if ((form.send_receipt_email || form.send_invoice_email) && !clean(form.email)) {
      return "Email is required when sending receipt or invoice.";
    }

    return "";
  }

  function buildPayload() {
    return {
      payer_type: form.payer_type,
      donor_type: form.payer_type,

      member_no: clean(form.member_no) || null,

      full_name: clean(form.full_name),
      payer_name: clean(form.full_name),
      donor_name: clean(form.full_name),

      email: clean(form.email) || null,
      payer_email: clean(form.email) || null,
      donor_email: clean(form.email) || null,
      phone: clean(form.phone) || null,

      category: form.category,
      payment_type: form.category,
      sub_category:
        form.category === "donation" ? form.donation_category : form.category,
      donation_category:
        form.category === "donation" ? form.donation_category : null,

      amount: numberValue(form.amount),
      total_amount: numberValue(form.amount),
      payment_amount: numberValue(form.amount),

      method: "check",
      payment_method: "check",
      provider: "check",

      check_number: clean(form.check_number),
      check_no: clean(form.check_number),
      bank_name: clean(form.bank_name) || null,

      reference_no: clean(form.check_number),
      transaction_reference: clean(form.check_number),

      received_date: form.received_date || null,
      received_at: form.received_date || null,
      paid_at: form.received_date || null,

      check_status: "received",
      status: "received",
      payment_status: "received",

      notes: clean(form.notes) || null,
      memo: clean(form.notes) || null,

      manual_entry: true,
      manual_payment: true,
      manual_entry_type: "check",
      source: "finance_check_entries",

      generate_receipt: true,
      send_receipt_email: Boolean(form.send_receipt_email),
      create_invoice: Boolean(form.create_invoice),
      generate_invoice: Boolean(form.create_invoice),
      send_invoice_email: Boolean(form.send_invoice_email),
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
      const res = await postFirst(
        ["/finance/checks", "/finance/payments", "/finance/manual-entries"],
        buildPayload()
      );

      onSaved?.(res?.data || {});
      onClose?.();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to record check entry."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-check-entry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="check-entry-title"
      >
        <form onSubmit={submit}>
          <div className="finance-modal-header">
            <div className="finance-modal-title-row">
              <span className="finance-modal-icon">
                <FileCheck2 size={20} />
              </span>

              <div>
                <h2 id="check-entry-title">Record Check Payment</h2>
                <p>
                  Record check payments with receipt, invoice, ledger, deposit,
                  clearance, and audit tracking.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="finance-icon-button"
              onClick={onClose}
              aria-label="Close check entry modal"
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
                  <span>Check Number *</span>
                  <input
                    value={form.check_number}
                    onChange={(event) => update("check_number", event.target.value)}
                    required
                  />
                </label>

                <label className="finance-field">
                  <span>Bank Name</span>
                  <input
                    value={form.bank_name}
                    onChange={(event) => update("bank_name", event.target.value)}
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
                  Record Check
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Checks() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
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

      params.set("method", "check");
      params.set("payment_method", "check");
      params.set("limit", "100");
      params.set("pageSize", "100");

      if (search) params.set("q", search);
      if (selectedStatus) params.set("status", selectedStatus);
      if (selectedCategory) params.set("category", selectedCategory);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const query = params.toString();

      const data = await getFirst(
        [
          `/finance/checks?${query}`,
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
          "Failed to load check entries."
      );
    } finally {
      setLoading(false);
    }
  }, [search, selectedStatus, selectedCategory, from, to]);

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
        checkNumber(row),
        bankName(row),
        category(row),
        donationCategory(row),
        addedBy(row),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || text.includes(q);
      const matchesStatus =
        !selectedStatus || String(checkStatus(row)).toLowerCase() === selectedStatus;
      const matchesCategory =
        !selectedCategory ||
        String(category(row)).toLowerCase() === selectedCategory ||
        String(donationCategory(row)).toLowerCase() === selectedCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [rows, search, selectedStatus, selectedCategory]);

  const summary = useMemo(() => {
    const countStatus = (value) =>
      filteredRows.filter((row) => String(checkStatus(row)).toLowerCase() === value).length;

    return {
      records: filteredRows.length,
      total: filteredRows.reduce((sum, row) => sum + amount(row), 0),
      received: countStatus("received"),
      deposited: countStatus("deposited"),
      cleared: countStatus("cleared"),
      returned: countStatus("returned"),
    };
  }, [filteredRows]);

  async function updateStatus(row, nextStatus) {
    const id = entryId(row);

    setActionLoading(`${nextStatus}-${id}`);
    setError("");
    setSuccessText("");

    try {
      await patchFirst(
        [
          id ? `/finance/checks/${id}/status` : null,
          id ? `/finance/payments/${id}/status` : null,
          id ? `/finance/manual-entries/${id}/status` : null,
        ],
        {
          status: nextStatus,
          check_status: nextStatus,
          deposited_at: nextStatus === "deposited" ? new Date().toISOString() : undefined,
          cleared_at: nextStatus === "cleared" ? new Date().toISOString() : undefined,
          returned_at: nextStatus === "returned" ? new Date().toISOString() : undefined,
        }
      );

      setSuccessText(`Check marked ${pretty(nextStatus)}.`);
      await loadRows();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update check status."
      );
    } finally {
      setActionLoading("");
    }
  }

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
    <div className="finance-page finance-check-entries-page">
      <div className="finance-page-header">
        <div>
          <p className="finance-eyebrow">Manual Collection</p>
          <h1>Check Entries</h1>
          <p className="finance-page-subtitle">
            Track check payments from receipt through deposit, clearance, return,
            invoice, receipt, ledger, and audit reporting.
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
            Record Check
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
          <small>Visible check entries</small>
        </div>

        <div className="finance-summary-card">
          <span>Total Checks</span>
          <strong>{money(summary.total)}</strong>
          <small>Current filtered total</small>
        </div>

        <div className="finance-summary-card">
          <span>Received</span>
          <strong>{summary.received.toLocaleString()}</strong>
          <small>Awaiting deposit</small>
        </div>

        <div className="finance-summary-card">
          <span>Deposited</span>
          <strong>{summary.deposited.toLocaleString()}</strong>
          <small>Awaiting clearance</small>
        </div>

        <div className="finance-summary-card">
          <span>Cleared</span>
          <strong>{summary.cleared.toLocaleString()}</strong>
          <small>Completed checks</small>
        </div>
      </div>

      <section className="finance-panel">
        <div className="finance-toolbar finance-toolbar-wrap">
          <label className="finance-search-field">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search payer, member ID, check #, bank, payment #, receipt #, invoice #..."
            />
          </label>

          <select
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
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
          <table className="finance-table finance-check-table">
            <thead>
              <tr>
                <th>Received</th>
                <th>Payment #</th>
                <th>Check #</th>
                <th>Bank</th>
                <th>Payer</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Deposited</th>
                <th>Cleared</th>
                <th>Invoice #</th>
                <th>Receipt #</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13}>
                    <div className="finance-table-loading">
                      <RefreshCcw size={17} className="finance-spin" />
                      Loading check entries...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !filteredRows.length ? (
                <tr>
                  <td colSpan={13}>
                    <div className="finance-empty-state">No check entries found.</div>
                  </td>
                </tr>
              ) : null}

              {!loading
                ? filteredRows.map((row) => {
                    const id = entryId(row);
                    const status = String(checkStatus(row)).toLowerCase();

                   return (
  <tr key={id || paymentNumber(row)}>
    <td>
      {formatDate(firstValue(row, ["received_at", "paid_at", "created_at"], ""))}
    </td>

    <td>{paymentNumber(row)}</td>
    <td>{checkNumber(row)}</td>
    <td>{bankName(row)}</td>

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

    <td>{money(amount(row))}</td>
    <td>{formatDate(firstValue(row, ["deposited_at"], ""))}</td>
    <td>{formatDate(firstValue(row, ["cleared_at"], ""))}</td>
    <td>{invoiceNumber(row)}</td>
    <td>{receiptNumber(row)}</td>

    <td>
      <StatusBadge value={status} />
    </td>

    <td className="finance-action-cell">
      <FinanceActionMenu
        row={row}
        actions={[
          {
            key: "deposit",
            label: "Deposit",
            icon: Landmark,
            onClick: () => updateStatus(row, "deposited"),
            visible: status === "received",
            disabled: actionLoading === `deposited-${id}`,
          },
          {
            key: "clear",
            label: "Clear",
            icon: FileCheck2,
            onClick: () => updateStatus(row, "cleared"),
            visible: status === "deposited",
            disabled: actionLoading === `cleared-${id}`,
          },
          {
            key: "return",
            label: "Return",
            icon: Undo2,
            tone: "danger",
            onClick: () => updateStatus(row, "returned"),
            visible: ["received", "deposited"].includes(status),
            disabled: actionLoading === `returned-${id}`,
          },
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

      <CheckEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          setSuccessText("Check entry recorded successfully.");
          await loadRows();
        }}
      />
    </div>
  );
}