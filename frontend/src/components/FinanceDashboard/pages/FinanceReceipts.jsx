// frontend/src/components/FinanceDashboard/pages/FinanceReceipts.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Mail,
  Printer,
  Receipt,
  RefreshCcw,
  Search,
  Send,
} from "lucide-react";

import api from "../../api";
import FinanceReceiptDrawer from "../components/FinanceReceiptDrawer";
import FinanceReceiptEmailModal from "../components/FinanceReceiptEmailModal";
import FinanceReceiptPreview from "../components/FinanceReceiptPreview";
import "../../../styles/finance-enterprise.css";
import FinanceActionMenu from "../components/FinanceActionMenu"
const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "issued", label: "Issued" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
  { value: "cancelled", label: "Cancelled" },
];

const EMAIL_STATUS_OPTIONS = [
  { value: "", label: "All Email Status" },
  { value: "sent", label: "Sent" },
  { value: "queued", label: "Queued" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "not_sent", label: "Not Sent" },
];

const METHOD_OPTIONS = [
  { value: "", label: "All Methods" },
  { value: "card", label: "Card" },
  { value: "ach", label: "ACH" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "membership", label: "Membership" },
  { value: "donation", label: "Donation" },
  { value: "pledge", label: "Pledge" },
  { value: "school", label: "School" },
  { value: "trip", label: "Trip" },
  { value: "manual", label: "Manual Payment" },
];

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
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusTone(value) {
  const status = String(value || "").toLowerCase();

  if (["issued", "sent", "paid", "completed", "success", "delivered"].includes(status)) {
    return "success";
  }

  if (["queued", "pending", "processing", "not_sent"].includes(status)) {
    return "warning";
  }

  if (["failed", "void", "cancelled", "error"].includes(status)) {
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
  if (Array.isArray(data?.receipts)) return data.receipts;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  if (Array.isArray(data?.data?.receipts)) return data.data.receipts;
  return [];
}

function normalizeMeta(data, fallbackLimit) {
  const meta =
    data?.pagination ||
    data?.meta ||
    data?.data?.pagination ||
    data?.data?.meta ||
    {};

  return {
    page: Number(meta.page || data?.page || 1),
    limit: Number(meta.limit || meta.pageSize || fallbackLimit),
    total: Number(meta.total || data?.total || data?.count || 0),
    totalPages: Number(meta.totalPages || meta.total_pages || 1),
  };
}

function receiptId(row = {}) {
  return firstValue(row, ["id", "receipt_id"], "");
}

function receiptNumber(row = {}) {
  return firstValue(row, ["receipt_number", "receipt_no", "number"], "--");
}

function paymentNumber(row = {}) {
  return firstValue(row, ["payment_number", "payment_no"], "--");
}

function invoiceNumber(row = {}) {
  return firstValue(row, ["invoice_number", "invoice_no"], "--");
}

function payerName(row = {}) {
  return firstValue(
    row,
    [
      "full_name_snapshot",
      "payer_name",
      "member_name",
      "donor_name",
      "guest_name",
      "full_name",
      "name",
    ],
    "Guest Donor"
  );
}

function payerEmail(row = {}) {
  return firstValue(
    row,
    [
      "email_snapshot",
      "payer_email",
      "member_email",
      "donor_email",
      "guest_email",
      "email",
    ],
    "--"
  );
}

function memberNo(row = {}) {
  return firstValue(row, ["member_no", "member_number", "membership_id"], "Guest");
}

function receiptAmount(row = {}) {
  return numberValue(
    firstValue(row, ["amount", "receipt_amount", "total_amount", "payment_amount"], 0)
  );
}

function paymentMethod(row = {}) {
  return firstValue(row, ["payment_method", "method"], "--");
}

function category(row = {}) {
  return firstValue(
    row,
    ["category", "payment_category", "finance_category", "donation_category", "payment_type"],
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
      if (![404, 405].includes(status)) throw err;
    }
  }

  if (fallback !== null) return fallback;
  throw lastError || new Error("Requested resource was not found.");
}

async function patchFirst(endpoints, payload = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      return await api.patch(endpoint, payload);
    } catch (err) {
      lastError = err;
      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) throw err;
    }
  }

  throw lastError || new Error("No endpoint is available.");
}

async function fetchReceiptPdf(row) {
  const id = receiptId(row);
  const number = receiptNumber(row);

  const endpoints = [
    id ? `/finance/receipts/${id}/pdf` : null,
    id ? `/receipts/${id}/pdf` : null,
    number && number !== "--" ? `/finance/receipts/${encodeURIComponent(number)}/pdf` : null,
    number && number !== "--" ? `/receipts/${encodeURIComponent(number)}/pdf` : null,
  ].filter(Boolean);

  let lastError = null;

  for (const endpoint of endpoints) {
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

  throw lastError || new Error("Receipt PDF is not available.");
}

function openBlob(blob, shouldPrint = false) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");

  if (shouldPrint) {
    window.setTimeout(() => {
      try {
        win?.focus();
        win?.print();
      } catch (_err) {
        // Browser may block direct print.
      }
    }, 700);
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function FinanceReceipts() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [method, setMethod] = useState("");
  const [receiptCategory, setReceiptCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");

  const loadReceipts = useCallback(
    async (nextPage = meta.page) => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();

        params.set("q", search);
        params.set("search", search);
        params.set("page", String(nextPage));
        params.set("limit", String(meta.limit));
        params.set("pageSize", String(meta.limit));

        if (status) params.set("status", status);
        if (emailStatus) params.set("email_status", emailStatus);
        if (method) params.set("method", method);
        if (receiptCategory) params.set("category", receiptCategory);
        if (from) params.set("from", from);
        if (to) params.set("to", to);

        const data = await getFirst(
          [
            `/finance/receipts?${params.toString()}`,
            `/receipts?${params.toString()}`,
          ],
          { rows: [] }
        );

        setRows(normalizeRows(data));
        setMeta(normalizeMeta(data, meta.limit));
      } catch (err) {
        setError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load receipts."
        );
      } finally {
        setLoading(false);
      }
    },
    [search, status, emailStatus, method, receiptCategory, from, to, meta.page, meta.limit]
  );

  useEffect(() => {
    loadReceipts(1);
  }, [search, status, emailStatus, method, receiptCategory, from, to]);

  const summary = useMemo(() => {
    const visibleAmount = rows.reduce((sum, row) => sum + receiptAmount(row), 0);

    const sent = rows.filter((row) =>
      ["sent", "delivered"].includes(
        String(firstValue(row, ["email_status", "receipt_email_status"], "")).toLowerCase()
      )
    ).length;

    const failed = rows.filter(
      (row) =>
        String(firstValue(row, ["email_status", "receipt_email_status"], "")).toLowerCase() ===
        "failed"
    ).length;

    const issued = rows.filter((row) =>
      ["issued", "paid", "sent"].includes(String(firstValue(row, ["status"], "")).toLowerCase())
    ).length;

    return {
      records: meta.total || rows.length,
      visibleAmount,
      sent,
      failed,
      issued,
    };
  }, [rows, meta.total]);

  function changePage(nextPage) {
    const safePage = Math.min(Math.max(1, nextPage), Math.max(1, meta.totalPages || 1));
    setMeta((current) => ({ ...current, page: safePage }));
    loadReceipts(safePage);
  }

  function openDrawer(row) {
    setSelectedReceipt(row);
    setDrawerOpen(true);
  }

  function openPreview(row) {
    setSelectedReceipt(row);
    setPreviewOpen(true);
  }

  function openEmail(row) {
    setSelectedReceipt(row);
    setEmailOpen(true);
  }

  async function handleViewPdf(row) {
    const key = `view-${receiptId(row) || receiptNumber(row)}`;
    setActionLoading(key);
    setError("");

    try {
      openBlob(await fetchReceiptPdf(row), false);
    } catch (err) {
      setError(err?.message || "Failed to open receipt PDF.");
    } finally {
      setActionLoading("");
    }
  }

  async function handleDownloadPdf(row) {
    const key = `download-${receiptId(row) || receiptNumber(row)}`;
    setActionLoading(key);
    setError("");

    try {
      downloadBlob(await fetchReceiptPdf(row), `${receiptNumber(row)}.pdf`);
    } catch (err) {
      setError(err?.message || "Failed to download receipt PDF.");
    } finally {
      setActionLoading("");
    }
  }

  async function handlePrint(row) {
    const key = `print-${receiptId(row) || receiptNumber(row)}`;
    setActionLoading(key);
    setError("");

    try {
      openBlob(await fetchReceiptPdf(row), true);
    } catch (err) {
      setError(err?.message || "Failed to print receipt.");
    } finally {
      setActionLoading("");
    }
  }

  async function handleMarkSent(row) {
    const id = receiptId(row);
    const number = receiptNumber(row);
    const key = `mark-sent-${id || number}`;

    setActionLoading(key);
    setError("");
    setSuccessText("");

    try {
      await patchFirst(
        [
          id ? `/finance/receipts/${id}/mark-sent` : null,
          id ? `/finance/receipts/${id}/status` : null,
          number && number !== "--"
            ? `/finance/receipts/${encodeURIComponent(number)}/mark-sent`
            : null,
        ].filter(Boolean),
        {
          receipt_id: id || null,
          receipt_number: number !== "--" ? number : null,
          email_status: "sent",
          status: firstValue(row, ["status"], "issued"),
          sent_at: new Date().toISOString(),
        }
      );

      setSuccessText(`Receipt ${number} was marked sent.`);
      await loadReceipts(meta.page);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to mark receipt sent."
      );
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="finance-page finance-receipts-page">
      <div className="finance-page-header">
        <div>
          <p className="finance-eyebrow">Receipt Center</p>
          <h1>Finance Receipts</h1>
          <p className="finance-page-subtitle">
            View, download, print, email, resend, and audit receipts for member and
            guest donor payments.
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={() => loadReceipts(meta.page)}
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? "finance-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

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
          <small>Total matched receipts</small>
        </div>

        <div className="finance-summary-card">
          <span>Visible Total</span>
          <strong>{money(summary.visibleAmount)}</strong>
          <small>Current page amount</small>
        </div>

        <div className="finance-summary-card">
          <span>Issued</span>
          <strong>{summary.issued.toLocaleString()}</strong>
          <small>Visible issued receipts</small>
        </div>

        <div className="finance-summary-card">
          <span>Email Sent</span>
          <strong>{summary.sent.toLocaleString()}</strong>
          <small>Visible sent emails</small>
        </div>

        <div className="finance-summary-card">
          <span>Email Failed</span>
          <strong>{summary.failed.toLocaleString()}</strong>
          <small>Needs follow-up</small>
        </div>
      </div>

      <section className="finance-panel">
        <div className="finance-toolbar finance-toolbar-wrap">
          <label className="finance-search-field">
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search receipt #, payment #, invoice #, name, email, reference..."
            />
          </label>

          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select value={emailStatus} onChange={(event) => setEmailStatus(event.target.value)}>
            {EMAIL_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            {METHOD_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={receiptCategory}
            onChange={(event) => setReceiptCategory(event.target.value)}
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
          <table className="finance-table finance-receipts-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt #</th>
                <th>Payment #</th>
                <th>Invoice #</th>
                <th>Member / Donor</th>
                <th>Email</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12}>
                    <div className="finance-table-loading">
                      <RefreshCcw size={17} className="finance-spin" />
                      Loading receipts...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !rows.length ? (
                <tr>
                  <td colSpan={12}>
                    <div className="finance-empty-state">No receipts found.</div>
                  </td>
                </tr>
              ) : null}

              {!loading
                ? rows.map((row) => {
                    const id = receiptId(row);
                    const number = receiptNumber(row);
                    const key = id || number;

  return (
  <tr key={key}>
    <td>
      {formatDate(
        firstValue(row, ["receipt_date", "issued_at", "created_at", "date"], "")
      )}
    </td>

    <td>
      <button
        type="button"
        className="finance-link-button"
        onClick={() => openDrawer(row)}
      >
        {number}
      </button>
    </td>

    <td>{paymentNumber(row)}</td>
    <td>{invoiceNumber(row)}</td>

    <td>
      <strong>{payerName(row)}</strong>
      <small className="finance-muted-block">{memberNo(row)}</small>
    </td>

    <td>{payerEmail(row)}</td>
    <td>{pretty(category(row))}</td>
    <td>{money(receiptAmount(row))}</td>
    <td>{pretty(paymentMethod(row))}</td>

    <td>
      <StatusBadge value={firstValue(row, ["status"], "issued")} />
    </td>

    <td>
      <StatusBadge
        value={firstValue(
          row,
          ["email_status", "receipt_email_status"],
          "not_sent"
        )}
      />
    </td>

    <td className="finance-action-cell">
      <FinanceActionMenu
        row={row}
        actions={[
          {
            key: "view",
            label: "View",
            onClick: () => openDrawer(row),
          },
          {
            key: "preview",
            label: "Preview",
            onClick: () => openPreview(row),
          },

         {
  key: "viewPdf",
  label: "PDF",
  symbol: "□",
  onClick: () => handleViewPdf(row),
  disabled: actionLoading === `view-${key}`,
},
          {
            key: "download",
            label: "Download",
            onClick: () => handleDownloadPdf(row),
            disabled: actionLoading === `download-${key}`,
          },
          {
            key: "print",
            label: "Print",
            onClick: () => handlePrint(row),
            disabled: actionLoading === `print-${key}`,
          },
          {
            key: "email",
            label: "Email",
            onClick: () => openEmail(row),
          },
          {
            key: "markSent",
            label: "Mark Sent",
            onClick: () => handleMarkSent(row),
            disabled: actionLoading === `mark-sent-${key}`,
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

        <div className="finance-pagination-bar">
          <span>
            Page {meta.page} of {Math.max(1, meta.totalPages || 1)}
            {meta.total ? ` · ${meta.total.toLocaleString()} records` : ""}
          </span>

          <div>
            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={() => changePage(meta.page - 1)}
              disabled={loading || meta.page <= 1}
            >
              Previous
            </button>

            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={() => changePage(meta.page + 1)}
              disabled={loading || meta.page >= Math.max(1, meta.totalPages || 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <FinanceReceiptDrawer
        open={drawerOpen}
        receipt={selectedReceipt}
        onClose={() => setDrawerOpen(false)}
        onUpdated={() => loadReceipts(meta.page)}
      />

      <FinanceReceiptPreview
        open={previewOpen}
        receipt={selectedReceipt}
        onClose={() => setPreviewOpen(false)}
        onEmail={(receipt) => {
          setSelectedReceipt(receipt);
          setPreviewOpen(false);
          setEmailOpen(true);
        }}
      />

      <FinanceReceiptEmailModal
        open={emailOpen}
        receipt={selectedReceipt}
        onClose={() => setEmailOpen(false)}
        onSent={() => loadReceipts(meta.page)}
        onUpdated={() => loadReceipts(meta.page)}
      />
    </div>
  );
}