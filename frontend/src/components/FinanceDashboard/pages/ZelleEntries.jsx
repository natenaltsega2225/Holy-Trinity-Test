// frontend/src/components/FinanceDashboard/pages/ZelleEntries.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  Send,
  WalletCards,
  X,
} from "lucide-react";

import api from "../../api";
import FinanceManualEntriesTabs from "../components/FinanceManualEntriesTabs.jsx";
import "../../../styles/finance-enterprise.css";
import FinanceActionMenu from "../components/FinanceActionMenu"
const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "received", label: "Received" },
  { value: "verified", label: "Verified" },
  { value: "paid", label: "Paid" },
  { value: "posted", label: "Posted" },
  { value: "failed", label: "Failed" },
  { value: "void", label: "Void" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "membership", label: "Membership" },
  { value: "donation", label: "Donation" },
  { value: "pledge", label: "Pledge" },
  { value: "school", label: "School" },
  { value: "trip", label: "Trip" },
  { value: "general_collection", label: "General Collection" },
  { value: "special_fund_collection", label: "Special Fund Collection" },
];

const DONATION_CATEGORIES = [
  { value: "", label: "Select Donation Category" },
  { value: "plate_collection", label: "መባ - Plate Collection" },
  { value: "candle_sale", label: "ሻማ - Candle Sale" },
  { value: "general_donation", label: "ስጦታ - General Donation" },
  { value: "tithe", label: "አስራት - Tithe" },
  { value: "vows", label: "ስዕለት - Vows" },
  { value: "building_fund", label: "የቤተክርስቲያን ማሰሪያ - Building Fund" },
  { value: "charity_fund", label: "በጎ አድራጎት - Charity Fund" },
  { value: "auction", label: "ጨረታ - Auction" },
  { value: "other_fund", label: "ሌላ - Other Fund" },
];

function clean(value) {
  return String(value ?? "").trim();
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];

    if (value !== undefined && value !== null && clean(value) !== "") {
      return value;
    }
  }

  return fallback;
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function pretty(value) {
  const text = clean(value);

  if (!text) return "--";

  return text
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "--";

  const raw = clean(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[2]}/${match[3]}/${match[1]}`;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return raw;

  return d.toLocaleDateString("en-US");
}

function statusTone(status) {
  const value = clean(status).toLowerCase();

  if (["paid", "verified", "posted", "completed", "succeeded"].includes(value)) {
    return "success";
  }

  if (["failed", "void", "cancelled", "rejected"].includes(value)) {
    return "danger";
  }

  if (["pending", "received", "processing"].includes(value)) {
    return "warning";
  }

  return "neutral";
}

function StatusBadge({ status }) {
  const value = clean(status) || "--";

  return (
    <span className={`finance-status-badge ${statusTone(value)}`}>
      {pretty(value)}
    </span>
  );
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.rows,
    payload?.data,
    payload?.items,
    payload?.entries,
    payload?.payments,
    payload?.results,
    payload?.data?.rows,
    payload?.data?.entries,
    payload?.data?.payments,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function entryId(row) {
  return firstValue(row, ["id", "entry_id", "payment_id"], "");
}

function paymentNumber(row) {
  return firstValue(row, ["payment_number", "payment_no"], "--");
}

function invoiceNumber(row) {
  return firstValue(row, ["invoice_number", "invoice_no"], "");
}

function receiptNumber(row) {
  return firstValue(row, ["receipt_number", "receipt_no"], "");
}

function zelleReference(row) {
  return firstValue(
    row,
    [
      "zelle_reference",
      "reference_no",
      "reference_number",
      "transaction_reference",
      "external_reference",
    ],
    "--"
  );
}

function payerName(row) {
  return firstValue(
    row,
    [
      "full_name_snapshot",
      "full_name",
      "payer_name",
      "donor_name",
      "member_name",
      "guest_name",
    ],
    "Guest Donor"
  );
}

function payerEmail(row) {
  return firstValue(
    row,
    ["email_snapshot", "email", "payer_email", "donor_email", "member_email"],
    ""
  );
}

function memberNo(row) {
  return firstValue(row, ["member_no", "member_number"], "--");
}

function amount(row) {
  return numberValue(
    firstValue(row, ["amount", "payment_amount", "total_amount"], 0)
  );
}

function category(row) {
  return clean(
    firstValue(
      row,
      ["category", "payment_type", "finance_category", "entry_category"],
      "donation"
    )
  ).toLowerCase();
}

function donationCategory(row) {
  return firstValue(
    row,
    ["donation_category_label", "donation_category", "fund_name", "fund"],
    ""
  );
}

function zelleStatus(row) {
  return firstValue(
    row,
    ["zelle_status", "status", "payment_status", "entry_status"],
    "received"
  );
}

function addedBy(row) {
  return firstValue(
    row,
    ["added_by", "recorded_by_name", "created_by_name", "staff_name"],
    "--"
  );
}

function isZelleRow(row) {
  const method = clean(
    firstValue(row, ["method", "payment_method", "provider", "manual_entry_type"], "")
  ).toLowerCase();

  return (
    method.includes("zelle") ||
    clean(row?.zelle_reference) !== "" ||
    clean(row?.zelle_reference_no) !== ""
  );
}

function getRowDate(row) {
  return firstValue(
    row,
    ["received_at", "paid_at", "payment_date", "created_at", "date"],
    ""
  );
}

function exportCsv(rows) {
  const headers = [
    "Date",
    "Payment #",
    "Zelle Reference",
    "Payer",
    "Member #",
    "Email",
    "Category",
    "Donation Category",
    "Amount",
    "Invoice #",
    "Receipt #",
    "Status",
    "Added By",
  ];

  const lines = rows.map((row) =>
    [
      formatDate(getRowDate(row)),
      paymentNumber(row),
      zelleReference(row),
      payerName(row),
      memberNo(row),
      payerEmail(row),
      pretty(category(row)),
      donationCategory(row),
      amount(row).toFixed(2),
      invoiceNumber(row),
      receiptNumber(row),
      pretty(zelleStatus(row)),
      addedBy(row),
    ]
      .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
      .join(",")
  );

  const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `zelle-entries-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

async function getFirst(endpoints, config = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint, config);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

async function postFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.post(endpoint, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

async function patchFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.patch(endpoint, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

async function fetchPdf(endpoints) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint, { responseType: "blob" });
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

function openBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function ZelleEntryModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    payer_type: "member",
    member_no: "",
    full_name: "",
    email: "",
    phone: "",
    category: "donation",
    donation_category: "general_donation",
    amount: "",
    zelle_reference: "",
    received_date: new Date().toISOString().slice(0, 10),
    notes: "",
    create_invoice: true,
    send_invoice_email: true,
    send_receipt_email: true,
    create_ledger_entry: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setValue = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const close = () => {
    if (saving) return;
    setError("");
    onClose?.();
  };

  async function submit(event) {
    event.preventDefault();

    setError("");

    const paymentAmount = numberValue(form.amount);

    if (paymentAmount <= 0) {
      setError("Enter a valid Zelle payment amount.");
      return;
    }

    if (!clean(form.zelle_reference)) {
      setError("Zelle reference is required.");
      return;
    }

    if (!clean(form.full_name)) {
      setError("Payer name is required.");
      return;
    }

    if (form.payer_type === "member" && !clean(form.member_no)) {
      setError("Member number is required for member Zelle payments.");
      return;
    }

    if (
      (form.send_receipt_email || form.send_invoice_email) &&
      !clean(form.email)
    ) {
      setError("Email is required when sending invoice or receipt email.");
      return;
    }

    const payload = {
      payer_type: form.payer_type,
      donor_type: form.payer_type,
      member_no: clean(form.member_no) || null,

      full_name: clean(form.full_name),
      payer_name: clean(form.full_name),
      donor_name: clean(form.full_name),
      email: clean(form.email) || null,
      payer_email: clean(form.email) || null,
      phone: clean(form.phone) || null,

      category: form.category,
      payment_type: form.category,
      sub_category:
        form.category === "donation"
          ? form.donation_category || "general_donation"
          : form.category,
      donation_category:
        form.category === "donation" ? form.donation_category : null,

      amount: paymentAmount,
      payment_amount: paymentAmount,
      total_amount: paymentAmount,

      method: "zelle",
      payment_method: "zelle",
      provider: "zelle",
      zelle_reference: clean(form.zelle_reference),
      reference_no: clean(form.zelle_reference),
      transaction_reference: clean(form.zelle_reference),

      received_date: form.received_date || null,
      received_at: form.received_date || null,
      paid_at: form.received_date || null,

      status: "paid",
      payment_status: "paid",
      zelle_status: "verified",

      notes: clean(form.notes) || null,

      manual_entry: true,
      manual_payment: true,
      manual_entry_type: "zelle",
      source: "finance_zelle_entries",

      generate_receipt: true,
      create_receipt: true,
      send_receipt_email: Boolean(form.send_receipt_email),

      create_invoice: Boolean(form.create_invoice),
      generate_invoice: Boolean(form.create_invoice),
      send_invoice_email: Boolean(form.create_invoice && form.send_invoice_email),

      create_ledger_entry: Boolean(form.create_ledger_entry),
      update_ledger: Boolean(form.create_ledger_entry),
    };

    setSaving(true);

    try {
      await postFirst(
        ["/finance/zelle", "/finance/payments", "/finance/manual-entries"],
        payload
      );

      onSaved?.();
      close();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save Zelle payment."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <form className="finance-modal finance-modal-wide" onSubmit={submit}>
        <div className="finance-modal-head">
          <div>
            <p className="finance-eyebrow">Manual Zelle Payment</p>
            <h2>Record Zelle Entry</h2>
            <span>
              Create payment, invoice, receipt, email, and ledger records from
              one finance workflow.
            </span>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={close}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="finance-alert danger">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}

        <div className="finance-form-grid three">
          <label>
            Payer Type
            <select
              value={form.payer_type}
              onChange={(event) => setValue("payer_type", event.target.value)}
            >
              <option value="member">Member</option>
              <option value="guest">Guest / Non-Member</option>
            </select>
          </label>

          <label>
            Member #
            <input
              value={form.member_no}
              onChange={(event) => setValue("member_no", event.target.value)}
              placeholder="M-00085"
              disabled={form.payer_type !== "member"}
            />
          </label>

          <label>
            Full Name *
            <input
              value={form.full_name}
              onChange={(event) => setValue("full_name", event.target.value)}
              placeholder="Payer full name"
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setValue("email", event.target.value)}
              placeholder="payer@email.com"
            />
          </label>

          <label>
            Phone
            <input
              value={form.phone}
              onChange={(event) => setValue("phone", event.target.value)}
              placeholder="(615) 000-0000"
            />
          </label>

          <label>
            Amount *
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => setValue("amount", event.target.value)}
              placeholder="0.00"
              required
            />
          </label>

          <label>
            Category *
            <select
              value={form.category}
              onChange={(event) => setValue("category", event.target.value)}
            >
              {CATEGORY_OPTIONS.filter((option) => option.value).map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>

          {form.category === "donation" ? (
            <label>
              Donation Category
              <select
                value={form.donation_category}
                onChange={(event) =>
                  setValue("donation_category", event.target.value)
                }
              >
                {DONATION_CATEGORIES.map((option) => (
                  <option key={option.value || "blank"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            Zelle Reference *
            <input
              value={form.zelle_reference}
              onChange={(event) =>
                setValue("zelle_reference", event.target.value)
              }
              placeholder="Zelle confirmation / bank reference"
              required
            />
          </label>

          <label>
            Received Date
            <input
              type="date"
              value={form.received_date}
              onChange={(event) => setValue("received_date", event.target.value)}
            />
          </label>
        </div>

        <label className="finance-field-full">
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => setValue("notes", event.target.value)}
            placeholder="Optional internal note"
            rows={3}
          />
        </label>

        <div className="finance-check-grid">
          <label>
            <input
              type="checkbox"
              checked={form.create_invoice}
              onChange={(event) =>
                setValue("create_invoice", event.target.checked)
              }
            />
            Create invoice
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.send_invoice_email}
              onChange={(event) =>
                setValue("send_invoice_email", event.target.checked)
              }
            />
            Email invoice
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.send_receipt_email}
              onChange={(event) =>
                setValue("send_receipt_email", event.target.checked)
              }
            />
            Email receipt
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.create_ledger_entry}
              onChange={(event) =>
                setValue("create_ledger_entry", event.target.checked)
              }
            />
            Post ledger entry
          </label>
        </div>

        <div className="finance-modal-actions">
          <button type="button" className="finance-btn ghost" onClick={close}>
            Cancel
          </button>

          <button type="submit" className="finance-btn primary" disabled={saving}>
            {saving ? "Saving..." : "Record Zelle Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ZelleEntries() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        q: search,
        search,
        status,
        category: categoryFilter,
        method: "zelle",
        payment_method: "zelle",
        from,
        to,
        startDate: from,
        endDate: to,
        page: 1,
        limit: 100,
        pageSize: 100,
      };

      const payload = await getFirst(
        ["/finance/zelle", "/finance/payments", "/finance/manual-entries"],
        { params }
      );

      setRows(normalizeRows(payload).filter(isZelleRow));
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load Zelle entries."
      );
    } finally {
      setLoading(false);
    }
  }, [search, status, categoryFilter, from, to]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const q = clean(search).toLowerCase();

    return rows.filter((row) => {
      const rowStatus = clean(zelleStatus(row)).toLowerCase();
      const rowCategory = category(row);

      if (status && rowStatus !== status) return false;
      if (categoryFilter && rowCategory !== categoryFilter) return false;

      if (!q) return true;

      const haystack = [
        paymentNumber(row),
        zelleReference(row),
        payerName(row),
        payerEmail(row),
        memberNo(row),
        rowCategory,
        donationCategory(row),
        receiptNumber(row),
        invoiceNumber(row),
        addedBy(row),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, search, status, categoryFilter]);

  const summary = useMemo(() => {
    const total = filteredRows.reduce((sum, row) => sum + amount(row), 0);

    const paid = filteredRows.filter((row) =>
      ["paid", "verified", "posted", "completed", "succeeded"].includes(
        clean(zelleStatus(row)).toLowerCase()
      )
    ).length;

    const pending = filteredRows.filter((row) =>
      ["pending", "received", "processing"].includes(
        clean(zelleStatus(row)).toLowerCase()
      )
    ).length;

    const failed = filteredRows.filter((row) =>
      ["failed", "void", "cancelled", "rejected"].includes(
        clean(zelleStatus(row)).toLowerCase()
      )
    ).length;

    const receipts = filteredRows.filter((row) => clean(receiptNumber(row))).length;

    return {
      records: filteredRows.length,
      total,
      paid,
      pending,
      failed,
      receipts,
    };
  }, [filteredRows]);

  async function updateStatus(row, nextStatus) {
    const id = entryId(row);

    if (!id) return;

    setActionLoading(`${id}:${nextStatus}`);
    setError("");
    setSuccess("");

    try {
      await patchFirst(
        [
          `/finance/zelle/${id}/status`,
          `/finance/payments/${id}/status`,
          `/finance/manual-entries/${id}/status`,
        ],
        {
          status: nextStatus,
          zelle_status: nextStatus,
          payment_status: nextStatus === "failed" ? "failed" : "paid",
        }
      );

      setSuccess(`Zelle entry marked ${pretty(nextStatus)}.`);
      await loadRows();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update Zelle status."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function downloadReceipt(row) {
    const receiptNo = receiptNumber(row);
    const id = entryId(row);

    if (!receiptNo && !id) return;

    setActionLoading(`${id}:receipt`);

    try {
      const blob = await fetchPdf([
        `/finance/receipts/${receiptNo}/pdf`,
        `/finance/receipts/${id}/pdf`,
        `/receipts/${receiptNo}/pdf`,
      ]);

      openBlob(blob, `${receiptNo || `receipt-${id}`}.pdf`);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to download receipt PDF."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function downloadInvoice(row) {
    const invoiceNo = invoiceNumber(row);
    const id = firstValue(row, ["invoice_id", "id"], "");

    if (!invoiceNo && !id) return;

    setActionLoading(`${entryId(row)}:invoice`);

    try {
      const blob = await fetchPdf([
        `/finance/invoices/${invoiceNo}/pdf`,
        `/finance/invoices/${id}/pdf`,
        `/invoices/${invoiceNo}/pdf`,
      ]);

      openBlob(blob, `${invoiceNo || `invoice-${id}`}.pdf`);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to download invoice PDF."
      );
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="finance-page">
      <div className="finance-page-header">
        <div>
          <p className="finance-eyebrow">Manual Collection</p>
          <h1>Zelle Entries</h1>
          <span>
            Record, verify, reconcile, invoice, receipt, and audit Zelle
            payments for members and non-members.
          </span>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn ghost"
            onClick={loadRows}
            disabled={loading}
          >
            <RefreshCcw size={16} />
            Refresh
          </button>

          <button
            type="button"
            className="finance-btn ghost"
            onClick={() => exportCsv(filteredRows)}
            disabled={!filteredRows.length}
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={16} />
            Record Zelle
          </button>
        </div>
      </div>

      <FinanceManualEntriesTabs />

      {error ? (
        <div className="finance-alert danger">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="finance-alert success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      ) : null}

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <span>Records</span>
          <strong>{summary.records}</strong>
          <small>Current Zelle entries</small>
        </div>

        <div className="finance-summary-card">
          <span>Total Amount</span>
          <strong>{money(summary.total)}</strong>
          <small>Visible Zelle total</small>
        </div>

        <div className="finance-summary-card">
          <span>Verified / Paid</span>
          <strong>{summary.paid}</strong>
          <small>Ready for reconciliation</small>
        </div>

        <div className="finance-summary-card">
          <span>Pending</span>
          <strong>{summary.pending}</strong>
          <small>Needs verification</small>
        </div>

        <div className="finance-summary-card">
          <span>Receipts</span>
          <strong>{summary.receipts}</strong>
          <small>Generated receipts</small>
        </div>
      </div>

      <div className="finance-panel">
        <div className="finance-toolbar">
          <label className="finance-search-field">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search payer, reference, email, payment, invoice, receipt..."
            />
          </label>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
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
          />

          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>

        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payment #</th>
                <th>Zelle Ref</th>
                <th>Payer</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Added By</th>
                <th>Invoice #</th>
                <th>Receipt #</th>
                <th>Status</th>
                <th className="finance-actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" className="finance-empty-cell">
                    Loading Zelle entries...
                  </td>
                </tr>
              ) : null}

              {!loading && !filteredRows.length ? (
                <tr>
                  <td colSpan="11" className="finance-empty-cell">
                    No Zelle entries found.
                  </td>
                </tr>
              ) : null}

              {!loading &&
                filteredRows.map((row, index) => {
                  const id = entryId(row) || index;
                  const currentStatus = clean(zelleStatus(row)).toLowerCase();
                  const canVerify = ["pending", "received", "processing"].includes(
                    currentStatus
                  );
                  const canPost = ["verified", "paid"].includes(currentStatus);
                  const canFail = ["pending", "received", "processing"].includes(
                    currentStatus
                  );

                  return (

                    <tr key={`${id}-${paymentNumber(row)}`}>
                      <td>{formatDate(getRowDate(row))}</td>
                      <td>{paymentNumber(row)}</td>
                      <td>{zelleReference(row)}</td>
                      <td>
                        <strong>{payerName(row)}</strong>
                        <small>{memberNo(row)}</small>
                        <small>{payerEmail(row) || "--"}</small>
                      </td>
                      <td>
                        <strong>{pretty(category(row))}</strong>
                        <small>
                          {category(row) === "donation"
                            ? pretty(donationCategory(row))
                            : "--"}
                        </small>
                      </td>
                      <td>
                        <strong>{money(amount(row))}</strong>
                      </td>
                      <td>{addedBy(row)}</td>
                      <td>{invoiceNumber(row) || "--"}</td>
                      <td>{receiptNumber(row) || "--"}</td>
                      <td>
                        <StatusBadge status={zelleStatus(row)} />
                      </td>

<td className="finance-action-cell">
  <FinanceActionMenu
    row={row}
    actions={[
      {
        key: "verify",
        label: "Verify",
        icon: CheckCircle2,
        onClick: () => updateStatus(row, "verified"),
        visible: canVerify,
        disabled: Boolean(actionLoading),
      },
      {
        key: "post",
        label: "Post",
        icon: WalletCards,
        onClick: () => updateStatus(row, "posted"),
        visible: canPost,
        disabled: Boolean(actionLoading),
      },
      {
        key: "fail",
        label: "Fail",
        icon: X,
        tone: "danger",
        onClick: () => updateStatus(row, "failed"),
        visible: canFail,
        disabled: Boolean(actionLoading),
      },
      {
        key: "receipt",
        label: "Receipt",
        icon: Receipt,
        onClick: () => downloadReceipt(row),
        visible: Boolean(receiptNumber(row)),
        disabled: Boolean(actionLoading),
      },
      {
        key: "invoice",
        label: "Invoice",
        icon: FileText,
        onClick: () => downloadInvoice(row),
        visible: Boolean(invoiceNumber(row)),
        disabled: Boolean(actionLoading),
      },
      {
        key: "email",
        label: "Email",
        icon: Send,
        disabled: true,
        visible: Boolean(payerEmail(row)),
      },
    ]}
  />
</td>


                    </tr>

                  );

                })}
            </tbody>
          </table>
        </div>
      </div>

      <ZelleEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadRows}
      />
    </div>
  );
}