// frontend/src/components/FinanceDashboard/components/FinanceReceiptPreview.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  Printer,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const MONTHS = [
  { value: 1, short: "Jan" },
  { value: 2, short: "Feb" },
  { value: 3, short: "Mar" },
  { value: 4, short: "Apr" },
  { value: 5, short: "May" },
  { value: 6, short: "Jun" },
  { value: 7, short: "Jul" },
  { value: 8, short: "Aug" },
  { value: 9, short: "Sep" },
  { value: 10, short: "Oct" },
  { value: 11, short: "Nov" },
  { value: 12, short: "Dec" },
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

function formatDateTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseJsonMaybe(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;

  try {
    return JSON.parse(value) || fallback;
  } catch (_err) {
    return fallback;
  }
}

function statusTone(value) {
  const status = String(value || "").toLowerCase();

  if (["issued", "sent", "paid", "completed", "delivered"].includes(status)) {
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
    ["email_snapshot", "payer_email", "member_email", "donor_email", "guest_email", "email"],
    "--"
  );
}

function memberNo(row = {}) {
  return firstValue(row, ["member_no", "member_number", "membership_id"], "--");
}

function payerType(row = {}) {
  return firstValue(row, ["payer_type", "donor_type", "member_type"], row.member_id ? "member" : "guest");
}

function receiptAmount(row = {}) {
  return numberValue(firstValue(row, ["amount", "receipt_amount", "total_amount", "payment_amount"], 0));
}

function paymentMethod(row = {}) {
  return firstValue(row, ["payment_method", "method"], "--");
}

function referenceNo(row = {}) {
  return firstValue(
    row,
    [
      "reference_no",
      "reference_number",
      "transaction_reference",
      "stripe_payment_intent_id",
      "stripe_charge_id",
      "check_number",
      "zelle_reference",
    ],
    "--"
  );
}

function category(row = {}) {
  return firstValue(
    row,
    ["category", "payment_category", "finance_category", "donation_category", "payment_type"],
    "--"
  );
}

function donationCategory(row = {}) {
  return firstValue(
    row,
    ["donation_category_label", "donation_category", "fund_name", "fund", "sub_category"],
    "--"
  );
}

function planName(row = {}) {
  return firstValue(row, ["plan_name", "membership_plan", "dues_plan_name"], "");
}

function coverageLabel(row = {}) {
  return firstValue(row, ["coverage_label", "membership_coverage_label", "coverage_description"], "");
}

function programName(row = {}) {
  return firstValue(row, ["program_name", "school_program_name", "trip_name", "trip_program_name"], "--");
}

function pledgeCampaign(row = {}) {
  return firstValue(row, ["campaign_name", "pledge_campaign", "campaign"], "--");
}

function coverageMonths(row = {}) {
  const explicit = parseJsonMaybe(
    firstValue(row, ["coverage_months_json", "coverage_months", "membership_months", "months"], ""),
    []
  )
    .map((item) => Number(item))
    .filter(Boolean);

  if (explicit.length) return explicit;

  const start = numberValue(firstValue(row, ["coverage_start_month", "start_month"], 0));
  const end = numberValue(firstValue(row, ["coverage_end_month", "end_month"], 0));

  if (start && end && start <= end) {
    return MONTHS.filter((month) => month.value >= start && month.value <= end).map(
      (month) => month.value
    );
  }

  return [];
}

function allocationRows(row = {}) {
  const items = Array.isArray(row.items)
    ? row.items
    : parseJsonMaybe(firstValue(row, ["items_json", "line_items_json"], ""), []);

  if (items.length) {
    return items.map((item, index) => ({
      code: firstValue(item, ["code"], String(index + 1).padStart(2, "0")),
      type: firstValue(item, ["item_type", "type", "label", "item_name"], category(row)),
      description: firstValue(
        item,
        ["description", "detail", "coverage", "program_name", "campaign_name", "item_name"],
        "--"
      ),
      amount: numberValue(firstValue(item, ["amount", "total_amount", "total_price"], 0)),
      remark: firstValue(item, ["remark", "notes", "reference_no"], "--"),
    }));
  }

  const key = String(category(row)).toLowerCase();

  if (key.includes("membership")) {
    return [
      {
        code: "01",
        type: "Membership",
        description: [planName(row), coverageLabel(row)].filter(Boolean).join(" | ") || "Membership dues",
        amount: receiptAmount(row),
        remark: referenceNo(row),
      },
    ];
  }

  if (key.includes("donation")) {
    return [
      {
        code: "04",
        type: "Donation",
        description:
          donationCategory(row) !== "--"
            ? `Donation category: ${donationCategory(row)}`
            : "Donation",
        amount: receiptAmount(row),
        remark: referenceNo(row),
      },
    ];
  }

  if (key.includes("pledge")) {
    return [
      {
        code: "10",
        type: "Pledge",
        description:
          pledgeCampaign(row) !== "--" ? `Campaign: ${pledgeCampaign(row)}` : "Pledge payment",
        amount: receiptAmount(row),
        remark: referenceNo(row),
      },
    ];
  }

  if (key.includes("school")) {
    return [
      {
        code: "20",
        type: "School",
        description: programName(row) !== "--" ? `Program: ${programName(row)}` : "School program",
        amount: receiptAmount(row),
        remark: referenceNo(row),
      },
    ];
  }

  if (key.includes("trip")) {
    return [
      {
        code: "21",
        type: "Trip",
        description: programName(row) !== "--" ? `Trip: ${programName(row)}` : "Trip program",
        amount: receiptAmount(row),
        remark: referenceNo(row),
      },
    ];
  }

  return [
    {
      code: "99",
      type: pretty(category(row)),
      description: pretty(category(row)),
      amount: receiptAmount(row),
      remark: referenceNo(row),
    },
  ];
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
  throw lastError || new Error("Receipt not found.");
}

async function fetchPdf(row) {
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
      const res = await api.get(endpoint, { responseType: "blob" });

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

  throw lastError || new Error("Receipt PDF is not available.");
}

function openBlob(blob, print = false) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");

  if (print) {
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

function normalizeReceipt(data, fallback) {
  return data?.receipt || data?.row || data?.data?.receipt || data?.data || fallback || null;
}

export default function FinanceReceiptPreview({
  open = false,
  embedded = false,
  receipt = null,
  receiptId: receiptIdProp = null,
  receiptNumber: receiptNumberProp = "",
  onClose,
  onEmail,
}) {
  const [currentReceipt, setCurrentReceipt] = useState(receipt || null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const effectiveId = receiptIdProp || receiptId(receipt || {});
  const effectiveNumber = receiptNumberProp || receiptNumber(receipt || {});

  const rows = useMemo(() => allocationRows(currentReceipt || {}), [currentReceipt]);
  const months = useMemo(() => coverageMonths(currentReceipt || {}), [currentReceipt]);
  const total = useMemo(() => rows.reduce((sum, row) => sum + numberValue(row.amount), 0), [rows]);

  useEffect(() => {
    if (!open && !embedded) return;

    setCurrentReceipt(receipt || null);
    setError("");

    async function load() {
      const endpoints = [
        effectiveId ? `/finance/receipts/${effectiveId}` : null,
        effectiveId ? `/receipts/${effectiveId}` : null,
        effectiveNumber && effectiveNumber !== "--"
          ? `/finance/receipts/number/${encodeURIComponent(effectiveNumber)}`
          : null,
        effectiveNumber && effectiveNumber !== "--"
          ? `/receipts/number/${encodeURIComponent(effectiveNumber)}`
          : null,
      ].filter(Boolean);

      if (!endpoints.length) return;

      setLoading(true);

      try {
        const data = await getFirst(endpoints, receipt || {});
        setCurrentReceipt(normalizeReceipt(data, receipt || {}));
      } catch (err) {
        setError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load receipt preview."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open, embedded, effectiveId, effectiveNumber, receipt]);

  if (!open && !embedded) return null;

  async function viewPdf() {
    setActionLoading("view");
    setError("");

    try {
      openBlob(await fetchPdf(currentReceipt || {}), false);
    } catch (err) {
      setError(err?.message || "Failed to open PDF.");
    } finally {
      setActionLoading("");
    }
  }

  async function downloadPdf() {
    setActionLoading("download");
    setError("");

    try {
      downloadBlob(await fetchPdf(currentReceipt || {}), `${receiptNumber(currentReceipt || {})}.pdf`);
    } catch (err) {
      setError(err?.message || "Failed to download PDF.");
    } finally {
      setActionLoading("");
    }
  }

  async function printPdf() {
    setActionLoading("print");
    setError("");

    try {
      openBlob(await fetchPdf(currentReceipt || {}), true);
    } catch (err) {
      setError(err?.message || "Failed to print PDF.");
    } finally {
      setActionLoading("");
    }
  }

  const data = currentReceipt || {};
  const body = (
    <div className="finance-receipt-preview">
      {error ? (
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="finance-loading-panel">
          <RefreshCcw size={18} className="finance-spin" />
          Loading receipt preview...
        </div>
      ) : null}

      <div className="finance-document-preview">
        <div className="finance-document-header">
          <div>
            <p className="finance-eyebrow">Official Receipt</p>
            <h2>{receiptNumber(data)}</h2>
            <span>Holy Trinity Finance & Membership Platform</span>
          </div>

          <StatusBadge value={firstValue(data, ["status"], "issued")} />
        </div>

        <section className="finance-panel">
          <div className="finance-section-head">
            <UserRound size={17} />
            <h3>Payer Information</h3>
          </div>

          <div className="finance-detail-grid">
            <div>
              <span>Paid By</span>
              <strong>{payerName(data)}</strong>
            </div>

            <div>
              <span>Donor Type</span>
              <strong>{pretty(payerType(data))}</strong>
            </div>

            <div>
              <span>Member ID</span>
              <strong>{memberNo(data)}</strong>
            </div>

            <div>
              <span>Email</span>
              <strong>{payerEmail(data)}</strong>
            </div>

            <div>
              <span>Payment #</span>
              <strong>{paymentNumber(data)}</strong>
            </div>

            <div>
              <span>Invoice #</span>
              <strong>{invoiceNumber(data)}</strong>
            </div>
          </div>
        </section>

        {months.length || coverageLabel(data) ? (
          <section className="finance-panel">
            <div className="finance-section-head">
              <CalendarDays size={17} />
              <h3>Membership Plan & Coverage</h3>
            </div>

            <div className="finance-coverage-summary">
              <div>
                <span>Plan</span>
                <strong>{planName(data) || "Membership"}</strong>
              </div>

              <div>
                <span>Coverage</span>
                <strong>{coverageLabel(data) || "--"}</strong>
              </div>

              <div>
                <span>Months</span>
                <strong>
                  {firstValue(data, ["months_paid", "coverage_month_count"], months.length)}
                </strong>
              </div>
            </div>

            <div className="finance-month-grid">
              {MONTHS.map((month) => {
                const covered = months.includes(month.value);

                return (
                  <span
                    key={month.value}
                    className={`finance-month-pill ${covered ? "covered" : ""}`}
                  >
                    {covered ? "X " : ""}
                    {month.short}
                  </span>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="finance-panel">
          <div className="finance-section-head">
            <WalletCards size={17} />
            <h3>Payment Allocation</h3>
          </div>

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Membership / Donation / School / Trip / Pledge</th>
                  <th>Amount</th>
                  <th>Remark</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.code}-${index}`}>
                    <td>{row.code}</td>
                    <td>{pretty(row.type)}</td>
                    <td>{row.description}</td>
                    <td>{money(row.amount)}</td>
                    <td>{row.remark || "--"}</td>
                  </tr>
                ))}

                <tr className="finance-table-total-row">
                  <td colSpan={3}>Total</td>
                  <td>{money(total)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="finance-panel">
          <div className="finance-section-head">
            <ShieldCheck size={17} />
            <h3>Receipt Details</h3>
          </div>

          <div className="finance-detail-grid">
            <div>
              <span>Category</span>
              <strong>{pretty(category(data))}</strong>
            </div>

            <div>
              <span>Donation Category</span>
              <strong>{donationCategory(data)}</strong>
            </div>

            <div>
              <span>Program</span>
              <strong>{programName(data)}</strong>
            </div>

            <div>
              <span>Pledge Campaign</span>
              <strong>{pledgeCampaign(data)}</strong>
            </div>

            <div>
              <span>Payment Method</span>
              <strong>{pretty(paymentMethod(data))}</strong>
            </div>

            <div>
              <span>Reference #</span>
              <strong>{referenceNo(data)}</strong>
            </div>

            <div>
              <span>Issued Date</span>
              <strong>
                {formatDate(firstValue(data, ["issued_at", "receipt_date", "created_at"], ""))}
              </strong>
            </div>

            <div>
              <span>Email Status</span>
              <StatusBadge value={firstValue(data, ["email_status"], "not_sent")} />
            </div>

            <div>
              <span>Created</span>
              <strong>{formatDateTime(firstValue(data, ["created_at"], ""))}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-receipt-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-preview-title"
      >
        <div className="finance-modal-header">
          <div className="finance-modal-title-row">
            <span className="finance-modal-icon">
              <Receipt size={20} />
            </span>

            <div>
              <h2 id="receipt-preview-title">Receipt Preview</h2>
              <p>{receiptNumber(data)}</p>
            </div>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={onClose}
            aria-label="Close receipt preview"
          >
            <X size={18} />
          </button>
        </div>

        <div className="finance-modal-actions">
          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={viewPdf}
            disabled={actionLoading === "view"}
          >
            <FileText size={16} />
            View PDF
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={downloadPdf}
            disabled={actionLoading === "download"}
          >
            <Download size={16} />
            Download
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={printPdf}
            disabled={actionLoading === "print"}
          >
            <Printer size={16} />
            Print
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={() => onEmail?.(data)}
          >
            <Mail size={16} />
            Email
          </button>
        </div>

        <div className="finance-modal-body">{body}</div>
      </div>
    </div>
  );
}