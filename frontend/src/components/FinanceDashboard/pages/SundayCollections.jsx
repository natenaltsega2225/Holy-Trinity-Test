// frontend/src/components/FinanceDashboard/pages/SundayCollections.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Plus,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";

import api from "../../api";
import FinanceManualEntriesTabs from "../components/FinanceManualEntriesTabs.jsx";
import "../../../styles/finance-enterprise.css";
import FinanceActionMenu from "../components/FinanceActionMenu"
const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "deposited", label: "Deposited" },
  { value: "posted", label: "Posted" },
  { value: "void", label: "Void" },
];

function clean(value) {
  return String(value ?? "").trim();
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
  return text.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
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

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && clean(value) !== "") return value;
  }
  return fallback;
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.rows,
    payload?.data,
    payload?.items,
    payload?.collections,
    payload?.results,
    payload?.data?.rows,
    payload?.data?.collections,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function statusTone(status) {
  const value = clean(status).toLowerCase();

  if (["verified", "deposited", "posted", "completed"].includes(value)) {
    return "success";
  }

  if (["void", "cancelled", "failed"].includes(value)) {
    return "danger";
  }

  if (["draft", "pending", "received"].includes(value)) {
    return "warning";
  }

  return "neutral";
}

function StatusBadge({ status }) {
  return (
    <span className={`finance-status-badge ${statusTone(status)}`}>
      {pretty(status)}
    </span>
  );
}

function collectionId(row) {
  return firstValue(row, ["id", "collection_id", "batch_id"], "");
}

function serviceDate(row) {
  return firstValue(row, ["service_date", "collection_date", "received_date", "created_at"], "");
}

function cashTotal(row) {
  return numberValue(firstValue(row, ["cash_total", "cash_amount"], 0));
}

function checkTotal(row) {
  return numberValue(firstValue(row, ["check_total", "checks_total", "check_amount"], 0));
}

function zelleTotal(row) {
  return numberValue(firstValue(row, ["zelle_total", "zelle_amount"], 0));
}

function cardTotal(row) {
  return numberValue(firstValue(row, ["card_total", "stripe_total", "online_total"], 0));
}

function grandTotal(row) {
  const stored = firstValue(row, ["grand_total", "total_amount", "amount"], "");
  if (clean(stored) !== "") return numberValue(stored);
  return cashTotal(row) + checkTotal(row) + zelleTotal(row) + cardTotal(row);
}

function status(row) {
  return firstValue(row, ["deposit_status", "status", "collection_status"], "pending");
}

function recordedBy(row) {
  return firstValue(row, ["recorded_by_name", "created_by_name", "added_by", "staff_name"], "--");
}

function reference(row) {
  return firstValue(row, ["reference_no", "batch_number", "collection_number"], "--");
}

function exportCsv(rows) {
  const headers = [
    "Service Date",
    "Reference",
    "Cash",
    "Check",
    "Zelle",
    "Card/Online",
    "Grand Total",
    "Status",
    "Recorded By",
  ];

  const lines = rows.map((row) =>
    [
      formatDate(serviceDate(row)),
      reference(row),
      cashTotal(row).toFixed(2),
      checkTotal(row).toFixed(2),
      zelleTotal(row).toFixed(2),
      cardTotal(row).toFixed(2),
      grandTotal(row).toFixed(2),
      pretty(status(row)),
      recordedBy(row),
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
  a.download = `sunday-collections-${new Date().toISOString().slice(0, 10)}.csv`;
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

function SundayCollectionModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    service_date: new Date().toISOString().slice(0, 10),
    service_name: "Sunday Divine Liturgy",
    cash_total: "",
    check_total: "",
    zelle_total: "",
    card_total: "",
    reference_no: "",
    notes: "",
    create_ledger_entry: true,
    status: "verified",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total =
    numberValue(form.cash_total) +
    numberValue(form.check_total) +
    numberValue(form.zelle_total) +
    numberValue(form.card_total);

  function setValue(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function close() {
    if (saving) return;
    setError("");
    onClose?.();
  }

  async function submit(event) {
    event.preventDefault();

    setError("");

    if (!form.service_date) {
      setError("Service date is required.");
      return;
    }

    if (total <= 0) {
      setError("Enter at least one collection amount.");
      return;
    }

    const payload = {
      service_date: form.service_date,
      collection_date: form.service_date,
      service_name: clean(form.service_name) || "Sunday Divine Liturgy",

      cash_total: numberValue(form.cash_total),
      check_total: numberValue(form.check_total),
      zelle_total: numberValue(form.zelle_total),
      card_total: numberValue(form.card_total),
      online_total: numberValue(form.card_total),
      grand_total: total,
      total_amount: total,

      category: "sunday_cash_collection",
      payment_type: "sunday_collection",
      reference_no: clean(form.reference_no) || null,
      notes: clean(form.notes) || null,

      status: form.status,
      deposit_status: form.status,

      create_ledger_entry: Boolean(form.create_ledger_entry),
      update_ledger: Boolean(form.create_ledger_entry),
      source: "finance_sunday_collections",
    };

    setSaving(true);

    try {
      await postFirst(
        ["/finance/sunday-collections", "/finance/manual-entries/sunday-collections"],
        payload
      );

      onSaved?.();
      close();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save Sunday collection."
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
            <p className="finance-eyebrow">Sunday Collection</p>
            <h2>Record Weekly Collection</h2>
            <span>
              Capture weekly cash, check, Zelle, and online totals for deposit
              and ledger reconciliation.
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
            Service Date *
            <input
              type="date"
              value={form.service_date}
              onChange={(event) => setValue("service_date", event.target.value)}
              required
            />
          </label>

          <label>
            Service Name
            <input
              value={form.service_name}
              onChange={(event) => setValue("service_name", event.target.value)}
              placeholder="Sunday Divine Liturgy"
            />
          </label>

          <label>
            Reference / Batch #
            <input
              value={form.reference_no}
              onChange={(event) => setValue("reference_no", event.target.value)}
              placeholder="Optional batch reference"
            />
          </label>

          <label>
            Cash Total
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cash_total}
              onChange={(event) => setValue("cash_total", event.target.value)}
              placeholder="0.00"
            />
          </label>

          <label>
            Check Total
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.check_total}
              onChange={(event) => setValue("check_total", event.target.value)}
              placeholder="0.00"
            />
          </label>

          <label>
            Zelle Total
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.zelle_total}
              onChange={(event) => setValue("zelle_total", event.target.value)}
              placeholder="0.00"
            />
          </label>

          <label>
            Card / Online Total
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.card_total}
              onChange={(event) => setValue("card_total", event.target.value)}
              placeholder="0.00"
            />
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(event) => setValue("status", event.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="deposited">Deposited</option>
              <option value="posted">Posted</option>
            </select>
          </label>

          <div className="finance-calculated-box">
            <span>Grand Total</span>
            <strong>{money(total)}</strong>
          </div>
        </div>

        <label className="finance-field-full">
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => setValue("notes", event.target.value)}
            rows={3}
            placeholder="Deposit notes, teller count, or reconciliation note"
          />
        </label>

        <div className="finance-check-grid">
          <label>
            <input
              type="checkbox"
              checked={form.create_ledger_entry}
              onChange={(event) =>
                setValue("create_ledger_entry", event.target.checked)
              }
            />
            Create ledger entry
          </label>
        </div>

        <div className="finance-modal-actions">
          <button type="button" className="finance-btn ghost" onClick={close}>
            Cancel
          </button>

          <button type="submit" className="finance-btn primary" disabled={saving}>
            {saving ? "Saving..." : "Save Collection"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SundayCollections() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
      const payload = await getFirst(
        ["/finance/sunday-collections", "/finance/manual-entries/sunday-collections"],
        {
          params: {
            q: search,
            search,
            status: statusFilter,
            from,
            to,
            startDate: from,
            endDate: to,
            page: 1,
            limit: 100,
            pageSize: 100,
          },
        }
      );

      setRows(normalizeRows(payload));
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load Sunday collections."
      );
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, from, to]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const q = clean(search).toLowerCase();

    return rows.filter((row) => {
      const rowStatus = clean(status(row)).toLowerCase();

      if (statusFilter && rowStatus !== statusFilter) return false;

      if (!q) return true;

      return [
        reference(row),
        serviceDate(row),
        firstValue(row, ["service_name"], ""),
        recordedBy(row),
        rowStatus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter]);

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        records: acc.records + 1,
        cash: acc.cash + cashTotal(row),
        check: acc.check + checkTotal(row),
        zelle: acc.zelle + zelleTotal(row),
        card: acc.card + cardTotal(row),
        total: acc.total + grandTotal(row),
      }),
      {
        records: 0,
        cash: 0,
        check: 0,
        zelle: 0,
        card: 0,
        total: 0,
      }
    );
  }, [filteredRows]);

  async function updateStatus(row, nextStatus) {
    const id = collectionId(row);

    if (!id) return;

    setActionLoading(`${id}:${nextStatus}`);
    setError("");
    setSuccess("");

    try {
      await patchFirst(
        [
          `/finance/sunday-collections/${id}/status`,
          `/finance/manual-entries/sunday-collections/${id}/status`,
        ],
        {
          status: nextStatus,
          deposit_status: nextStatus,
        }
      );

      setSuccess(`Sunday collection marked ${pretty(nextStatus)}.`);
      await loadRows();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update Sunday collection."
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
          <h1>Sunday Collections</h1>
          <span>
            Review weekly collection totals, deposit verification, and ledger
            posting across cash, check, Zelle, and online payments.
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
            Record Collection
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
          <small>Visible collections</small>
        </div>

        <div className="finance-summary-card">
          <span>Cash</span>
          <strong>{money(summary.cash)}</strong>
          <small>Cash counted</small>
        </div>

        <div className="finance-summary-card">
          <span>Check</span>
          <strong>{money(summary.check)}</strong>
          <small>Check totals</small>
        </div>

        <div className="finance-summary-card">
          <span>Zelle</span>
          <strong>{money(summary.zelle)}</strong>
          <small>Zelle transfers</small>
        </div>

        <div className="finance-summary-card">
          <span>Grand Total</span>
          <strong>{money(summary.total)}</strong>
          <small>All methods</small>
        </div>
      </div>

      <div className="finance-panel">
        <div className="finance-toolbar">
          <label className="finance-search-field">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search service date, batch, staff, or status..."
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
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
                <th>Service Date</th>
                <th>Reference</th>
                <th>Cash</th>
                <th>Check</th>
                <th>Zelle</th>
                <th>Card / Online</th>
                <th>Grand Total</th>
                <th>Recorded By</th>
                <th>Status</th>
                <th className="finance-actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="finance-empty-cell">
                    Loading Sunday collections...
                  </td>
                </tr>
              ) : null}

              {!loading && !filteredRows.length ? (
                <tr>
                  <td colSpan="10" className="finance-empty-cell">
                    No Sunday collections found.
                  </td>
                </tr>
              ) : null}

              {!loading &&
                filteredRows.map((row, index) => {
                  const id = collectionId(row) || index;
                  const current = clean(status(row)).toLowerCase();

                  return (
  <tr key={`${id}-${reference(row)}`}>
    <td>{formatDate(serviceDate(row))}</td>
    <td>{reference(row)}</td>
    <td>{money(cashTotal(row))}</td>
    <td>{money(checkTotal(row))}</td>
    <td>{money(zelleTotal(row))}</td>
    <td>{money(cardTotal(row))}</td>
    <td>
      <strong>{money(grandTotal(row))}</strong>
    </td>
    <td>{recordedBy(row)}</td>
    <td>
      <StatusBadge status={status(row)} />
    </td>
    <td className="finance-action-cell">
      <FinanceActionMenu
        row={row}
        actions={[
          {
            key: "verify",
            label: "Verify",
            onClick: () => updateStatus(row, "verified"),
            visible: ["draft", "pending"].includes(current),
            disabled: Boolean(actionLoading),
          },
          {
            key: "deposit",
            label: "Deposit",
            onClick: () => updateStatus(row, "deposited"),
            visible: ["verified"].includes(current),
            disabled: Boolean(actionLoading),
          },
          {
            key: "post",
            label: "Post",
            onClick: () => updateStatus(row, "posted"),
            visible: ["deposited"].includes(current),
            disabled: Boolean(actionLoading),
          },
          {
            key: "void",
            label: "Void",
            tone: "danger",
            onClick: () => updateStatus(row, "void"),
            visible: !["posted", "void"].includes(current),
            disabled: Boolean(actionLoading),
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

      <SundayCollectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadRows}
      />
    </div>
  );
}