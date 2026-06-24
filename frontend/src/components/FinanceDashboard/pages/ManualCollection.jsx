// frontend/src/components/FinanceDashboard/pages/ManualCollection.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Download,
  FileCheck2,
  FileText,
  Landmark,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  Send,
  WalletCards,
  X,
} from "lucide-react";

import api from "../../api";
import FinanceManualEntriesTabs from "../components/FinanceManualEntriesTabs";
import "../../../styles/finance-enterprise.css";
import FinanceActionMenu from "../components/FinanceActionMenu"
const METHOD_OPTIONS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "check", label: "Check", icon: FileCheck2 },
  { value: "zelle", label: "Zelle", icon: Send },
];

const CATEGORY_OPTIONS = [
  { value: "membership", label: "Membership Dues" },
  { value: "donation", label: "Donation" },
  { value: "pledge", label: "Pledge Payment" },
  { value: "school", label: "School Program" },
  { value: "trip", label: "Trip Program" },
  { value: "sunday_cash_collection", label: "Sunday Collection" },
  { value: "general_collection", label: "General Collection" },
  { value: "special_fund_collection", label: "Special Fund Collection" },
  { value: "event_fund_collection", label: "Event Fund Collection" },
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

  if (["paid", "posted", "completed", "cleared", "received"].includes(status)) {
    return "success";
  }

  if (["pending", "deposited", "processing", "open"].includes(status)) {
    return "warning";
  }

  if (["failed", "returned", "void", "cancelled"].includes(status)) {
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
  if (Array.isArray(data?.payments)) return data.payments;
  if (Array.isArray(data?.entries)) return data.entries;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;

  return [];
}

function entryId(row = {}) {
  return firstValue(row, ["id", "payment_id", "entry_id"], "");
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

function memberId(row = {}) {
  return firstValue(row, ["member_id"], "");
}

function memberNo(row = {}) {
  return firstValue(row, ["member_no", "member_number"], "--");
}

function payerName(row = {}) {
  return firstValue(
    row,
    ["full_name_snapshot", "payer_name", "member_name", "donor_name", "full_name", "name"],
    "Guest Donor"
  );
}

function payerEmail(row = {}) {
  return firstValue(row, ["email_snapshot", "payer_email", "email", "donor_email"], "--");
}

function amount(row = {}) {
  return numberValue(firstValue(row, ["amount", "total_amount", "payment_amount"], 0));
}

function method(row = {}) {
  return firstValue(row, ["method", "payment_method"], "--");
}

function category(row = {}) {
  return firstValue(row, ["category", "payment_category", "payment_type"], "--");
}

function reference(row = {}) {
  return firstValue(
    row,
    ["reference_no", "reference_number", "transaction_reference", "check_number", "zelle_reference"],
    "--"
  );
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
      if (![404, 405].includes(status)) {
        throw err;
      }
    }
  }

  if (fallback !== null) return fallback;
  throw lastError || new Error("Manual collection endpoint is not available.");
}

async function postFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints.filter(Boolean)) {
    try {
      return await api.post(endpoint, payload);
    } catch (err) {
      lastError = err;

      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) {
        throw err;
      }
    }
  }

  throw lastError || new Error("Manual payment endpoint is not available.");
}

async function patchFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints.filter(Boolean)) {
    try {
      return await api.patch(endpoint, payload);
    } catch (err) {
      lastError = err;

      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) {
        throw err;
      }
    }
  }

  throw lastError || new Error("Manual entry status endpoint is not available.");
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
      if (![404, 405].includes(status)) {
        throw err;
      }
    }
  }

  throw lastError || new Error("PDF is not available.");
}

function openBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function ManualEntryModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    payer_type: "member",
    member_id: "",
    member_no: "",
    full_name: "",
    email: "",
    phone: "",
    method: "cash",
    category: "donation",
    donation_category: "general_donation",
    amount: "",
    reference_no: "",
    check_number: "",
    bank_name: "",
    zelle_reference: "",
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
      member_id: "",
      member_no: "",
      full_name: "",
      email: "",
      phone: "",
      method: "cash",
      category: "donation",
      donation_category: "general_donation",
      amount: "",
      reference_no: "",
      check_number: "",
      bank_name: "",
      zelle_reference: "",
      received_date: new Date().toISOString().slice(0, 10),
      notes: "",
      send_receipt_email: true,
      create_invoice: true,
      send_invoice_email: false,
      create_ledger_entry: true,
    });

    setError("");
    setSaving(false);
  }, [open]);

  if (!open) return null;

  function update(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validationError() {
    if (numberValue(form.amount) <= 0) return "Amount is required.";
    if (!clean(form.full_name)) return "Payer name is required.";
    if (form.payer_type === "member" && !clean(form.member_no) && !clean(form.member_id)) {
      return "Member ID or member number is required.";
    }
    if ((form.send_receipt_email || form.send_invoice_email) && !clean(form.email)) {
      return "Email is required when sending receipt or invoice.";
    }
    if (form.method === "check" && !clean(form.check_number)) {
      return "Check number is required.";
    }
    if (form.method === "zelle" && !clean(form.zelle_reference)) {
      return "Zelle reference is required.";
    }
    return "";
  }

  function buildPayload() {
    const ref =
      form.method === "check"
        ? clean(form.check_number)
        : form.method === "zelle"
          ? clean(form.zelle_reference)
          : clean(form.reference_no);

    return {
      payer_type: form.payer_type,
      donor_type: form.payer_type,

      member_id: clean(form.member_id) || null,
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

      method: form.method,
      payment_method: form.method,
      provider: form.method,
      reference_no: ref || null,
      transaction_reference: ref || null,

      check_number: form.method === "check" ? clean(form.check_number) : null,
      bank_name: form.method === "check" ? clean(form.bank_name) || null : null,
      zelle_reference:
        form.method === "zelle" ? clean(form.zelle_reference) : null,

      received_date: form.received_date || null,
      received_at: form.received_date || null,
      paid_at: form.received_date || null,

      notes: clean(form.notes) || null,
      memo: clean(form.notes) || null,

      status: "paid",
      payment_status: "paid",

      source: "finance_manual_collection",
      manual_entry: true,
      manual_entry_type: form.method,
      manual_payment: true,

      generate_receipt: true,
      send_receipt_email: Boolean(form.send_receipt_email),
      create_invoice: Boolean(form.create_invoice),
      generate_invoice: Boolean(form.create_invoice),
      send_invoice_email: Boolean(form.send_invoice_email),
      create_ledger_entry: Boolean(form.create_ledger_entry),
      update_ledger: Boolean(form.create_ledger_entry),
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const message = validationError();

    if (message) {
      setError(message);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = buildPayload();

      const endpoints = [
        "/finance/payments",
        "/finance/manual-entries",
        form.method === "cash" ? "/finance/cash" : null,
        form.method === "check" ? "/finance/checks" : null,
        form.method === "zelle" ? "/finance/zelle" : null,
      ];

      const res = await postFirst(endpoints, payload);

      onSaved?.(res?.data || {});
      onClose?.();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to record manual payment."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-manual-entry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-entry-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="finance-modal-header">
            <div className="finance-modal-title-row">
              <span className="finance-modal-icon">
                <WalletCards size={20} />
              </span>

              <div>
                <h2 id="manual-entry-title">Record Manual Payment</h2>
                <p>
                  Record cash, check, or Zelle payments and generate receipt,
                  invoice, ledger, and audit records.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="finance-icon-button"
              onClick={onClose}
              aria-label="Close manual payment modal"
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
                  <span>Member ID / No.</span>
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
                  <span>Payment Method *</span>
                  <select
                    value={form.method}
                    onChange={(event) => update("method", event.target.value)}
                    required
                  >
                    {METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="finance-field">
                  <span>Category *</span>
                  <select
                    value={form.category}
                    onChange={(event) => update("category", event.target.value)}
                    required
                  >
                    {CATEGORY_OPTIONS.map((option) => (
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

                {form.method === "check" ? (
                  <>
                    <label className="finance-field">
                      <span>Check Number *</span>
                      <input
                        value={form.check_number}
                        onChange={(event) =>
                          update("check_number", event.target.value)
                        }
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
                  </>
                ) : null}

                {form.method === "zelle" ? (
                  <label className="finance-field">
                    <span>Zelle Reference *</span>
                    <input
                      value={form.zelle_reference}
                      onChange={(event) =>
                        update("zelle_reference", event.target.value)
                      }
                      required
                    />
                  </label>
                ) : null}

                {form.method === "cash" ? (
                  <label className="finance-field">
                    <span>Reference</span>
                    <input
                      value={form.reference_no}
                      onChange={(event) => update("reference_no", event.target.value)}
                      placeholder="Optional cash batch or note"
                    />
                  </label>
                ) : null}

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
                  <span>Generate and email receipt PDF</span>
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
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ManualCollection() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");

  const loadManualEntries = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      params.set("source", "manual");
      params.set("manual", "1");
      params.set("limit", "100");
      params.set("pageSize", "100");

      if (search) params.set("q", search);
      if (methodFilter) params.set("method", methodFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const query = params.toString();

      const data = await getFirst(
        [
          `/finance/payments?${query}`,
          `/finance/manual-entries?${query}`,
          `/finance/cash?${query}`,
        ],
        { rows: [] }
      );

      setRows(normalizeRows(data));
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load manual collection entries."
      );
    } finally {
      setLoading(false);
    }
  }, [search, methodFilter, categoryFilter, from, to]);

  useEffect(() => {
    loadManualEntries();
  }, [loadManualEntries]);

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
        method(row),
        reference(row),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || text.includes(q);
      const matchesMethod =
        !methodFilter || String(method(row)).toLowerCase() === methodFilter;
      const matchesCategory =
        !categoryFilter ||
        String(category(row)).toLowerCase() === categoryFilter ||
        String(firstValue(row, ["sub_category"], "")).toLowerCase() === categoryFilter;

      return matchesSearch && matchesMethod && matchesCategory;
    });
  }, [rows, search, methodFilter, categoryFilter]);

  const summary = useMemo(() => {
    const cash = filteredRows
      .filter((row) => String(method(row)).toLowerCase() === "cash")
      .reduce((sum, row) => sum + amount(row), 0);

    const check = filteredRows
      .filter((row) => String(method(row)).toLowerCase() === "check")
      .reduce((sum, row) => sum + amount(row), 0);

    const zelle = filteredRows
      .filter((row) => String(method(row)).toLowerCase() === "zelle")
      .reduce((sum, row) => sum + amount(row), 0);

    return {
      records: filteredRows.length,
      total: filteredRows.reduce((sum, row) => sum + amount(row), 0),
      cash,
      check,
      zelle,
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

  async function updateCheckStatus(row, nextStatus) {
    const id = entryId(row);

    setActionLoading(`${nextStatus}-${id}`);
    setError("");
    setSuccessText("");

    try {
      await patchFirst(
        [
          `/finance/checks/${id}/status`,
          `/finance/payments/${id}/status`,
          `/finance/manual-entries/${id}/status`,
        ],
        {
          status: nextStatus,
          check_status: nextStatus,
        }
      );

      setSuccessText(`Check marked ${pretty(nextStatus)}.`);
      await loadManualEntries();
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

  return (
    <div className="finance-page finance-manual-collection-page">
      <div className="finance-page-header">
        <div>
          <p className="finance-eyebrow">Manual Collection</p>
          <h1>Cash, Check & Zelle</h1>
          <p className="finance-page-subtitle">
            Record manual payments, generate invoices and receipts, post ledger entries,
            manage check status, and track Sunday or grouped collections.
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={loadManualEntries}
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? "finance-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={16} />
            Record Payment
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
          <small>Visible manual entries</small>
        </div>

        <div className="finance-summary-card">
          <span>Total</span>
          <strong>{money(summary.total)}</strong>
          <small>Cash + Check + Zelle</small>
        </div>

        <div className="finance-summary-card">
          <span>Cash</span>
          <strong>{money(summary.cash)}</strong>
          <small>Physical cash entries</small>
        </div>

        <div className="finance-summary-card">
          <span>Check</span>
          <strong>{money(summary.check)}</strong>
          <small>Check entries</small>
        </div>

        <div className="finance-summary-card">
          <span>Zelle</span>
          <strong>{money(summary.zelle)}</strong>
          <small>Verified transfers</small>
        </div>
      </div>

      <section className="finance-panel">

        <div className="finance-toolbar finance-toolbar-wrap">
          <label className="finance-search-field">
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search payer, member ID, payment #, receipt #, invoice #, reference..."
            />
          </label>

          <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}>
            <option value="">All Methods</option>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="zelle">Zelle</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
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
          <table className="finance-table finance-manual-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payment #</th>
                <th>Member / Payer</th>
                <th>Category</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Invoice #</th>
                <th>Receipt #</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11}>
                    <div className="finance-table-loading">
                      <RefreshCcw size={17} className="finance-spin" />
                      Loading manual collection...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !filteredRows.length ? (
                <tr>
                  <td colSpan={11}>
                    <div className="finance-empty-state">No manual entries found.</div>
                  </td>
                </tr>
              ) : null}

              {!loading
                ? filteredRows.map((row) => {
                    const id = entryId(row);
                    const rowMethod = String(method(row)).toLowerCase();
                    const rowStatus = String(firstValue(row, ["status"], "")).toLowerCase();

                    return (
  <tr key={id || paymentNumber(row)}>
    <td>{formatDate(firstValue(row, ["paid_at", "received_at", "created_at"], ""))}</td>

    <td>{paymentNumber(row)}</td>

    <td>
      <strong>{payerName(row)}</strong>
      <small className="finance-muted-block">{memberNo(row)}</small>
    </td>

    <td>{pretty(category(row))}</td>
    <td>{pretty(method(row))}</td>
    <td>{reference(row)}</td>
    <td>{money(amount(row))}</td>
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
            key: "profile",
            label: "Profile",
            icon: CreditCard,
            onClick: () =>
              navigate(`/dash/finance/members/${memberId(row)}/overview`),
            visible: Boolean(memberId(row)),
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
          {
            key: "deposit",
            label: "Deposit",
            icon: Landmark,
            onClick: () => updateCheckStatus(row, "deposited"),
            visible: rowMethod === "check" && rowStatus === "received",
            disabled: actionLoading === `deposited-${id}`,
          },
          {
            key: "clear",
            label: "Clear",
            icon: FileCheck2,
            onClick: () => updateCheckStatus(row, "cleared"),
            visible: rowMethod === "check" && rowStatus === "deposited",
            disabled: actionLoading === `cleared-${id}`,
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

      <ManualEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          setSuccessText("Manual payment recorded successfully.");
          await loadManualEntries();
        }}
      />
    </div>
  );
}