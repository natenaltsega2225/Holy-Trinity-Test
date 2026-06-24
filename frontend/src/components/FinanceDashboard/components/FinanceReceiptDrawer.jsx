// frontend/src/components/FinanceDashboard/components/FinanceReceiptDrawer.jsx

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
  Send,
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

function formatDateTime(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return String(value);
  }

  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

function parseJsonMaybe(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return parsed || fallback;
  } catch (_err) {
    return fallback;
  }
}

function receiptId(row = {}) {
  return firstValue(row, ["id", "receipt_id"], "");
}

function receiptNumber(row = {}) {
  return firstValue(row, ["receipt_number", "receipt_no", "number"], "--");
}

function paymentNumber(row = {}) {
  return firstValue(row, ["payment_number", "payment_no", "transaction_number"], "--");
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

function payerPhone(row = {}) {
  return firstValue(
    row,
    ["phone_snapshot", "payer_phone", "member_phone", "donor_phone", "guest_phone", "phone"],
    "--"
  );
}

function memberNo(row = {}) {
  return firstValue(row, ["member_no", "member_number", "membership_id"], "--");
}

function payerType(row = {}) {
  return firstValue(row, ["payer_type", "donor_type", "member_type"], row.member_id ? "member" : "guest");
}

function amount(row = {}) {
  return numberValue(firstValue(row, ["amount", "receipt_amount", "total_amount", "payment_amount"], 0));
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
      "check_no",
      "zelle_reference",
    ],
    "--"
  );
}

function programName(row = {}) {
  return firstValue(
    row,
    ["program_name", "school_program_name", "trip_name", "trip_program_name"],
    "--"
  );
}

function campaignName(row = {}) {
  return firstValue(row, ["campaign_name", "pledge_campaign", "campaign"], "--");
}

function planName(row = {}) {
  return firstValue(row, ["plan_name", "membership_plan", "dues_plan_name"], "");
}

function coverageLabel(row = {}) {
  return firstValue(
    row,
    ["coverage_label", "membership_coverage_label", "coverage_description"],
    ""
  );
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
  const items = parseJsonMaybe(firstValue(row, ["items_json", "line_items_json"], ""), []);
  const directItems = Array.isArray(row.items) ? row.items : items;

  if (directItems.length) {
    return directItems.map((item, index) => ({
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
  let code = "99";
  let type = pretty(key);
  let description = "--";

  if (key.includes("membership")) {
    code = "01";
    type = "Membership";
    description = [planName(row), coverageLabel(row)].filter(Boolean).join(" | ") || "Membership dues";
  } else if (key.includes("donation")) {
    code = "04";
    type = "Donation";
    description = donationCategory(row) !== "--" ? `Donation category: ${donationCategory(row)}` : "Donation";
  } else if (key.includes("pledge")) {
    code = "10";
    type = "Pledge";
    description = campaignName(row) !== "--" ? `Campaign: ${campaignName(row)}` : "Pledge payment";
  } else if (key.includes("school")) {
    code = "20";
    type = "School";
    description = programName(row) !== "--" ? `Program: ${programName(row)}` : "School program";
  } else if (key.includes("trip")) {
    code = "21";
    type = "Trip";
    description = programName(row) !== "--" ? `Trip: ${programName(row)}` : "Trip program";
  }

  return [
    {
      code,
      type,
      description,
      amount: amount(row),
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

  throw lastError || new Error("Requested receipt was not found.");
}

async function postFirst(endpoints, payload = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
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

  throw lastError || new Error("No receipt endpoint is available.");
}

async function patchFirst(endpoints, payload = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
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

  throw lastError || new Error("No receipt endpoint is available.");
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
        // Opening PDF is still useful if direct printing is blocked.
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

function normalizeReceiptData(data, fallback) {
  return data?.receipt || data?.row || data?.data?.receipt || data?.data || fallback || null;
}

export default function FinanceReceiptDrawer({
  open = false,
  receipt = null,
  receiptId: receiptIdProp = null,
  receiptNumber: receiptNumberProp = "",
  onClose,
  onUpdated,
}) {
  const [currentReceipt, setCurrentReceipt] = useState(receipt || null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");

  const effectiveId = receiptIdProp || receiptId(receipt || {});
  const effectiveNumber = receiptNumberProp || receiptNumber(receipt || {});

  const rows = useMemo(() => allocationRows(currentReceipt || {}), [currentReceipt]);
  const months = useMemo(() => coverageMonths(currentReceipt || {}), [currentReceipt]);

  async function loadReceipt() {
    if (!open) return;

    setLoading(true);
    setError("");

    try {
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

      if (!endpoints.length) {
        setCurrentReceipt(receipt || null);
        return;
      }

      const data = await getFirst(endpoints, receipt || {});
      setCurrentReceipt(normalizeReceiptData(data, receipt || {}));
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load receipt."
      );
      setCurrentReceipt(receipt || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    setCurrentReceipt(receipt || null);
    setError("");
    setSuccessText("");
    setActionLoading("");
    loadReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, effectiveId, effectiveNumber]);

  if (!open) return null;

  async function handleViewPdf() {
    setActionLoading("view");
    setError("");

    try {
      const blob = await fetchPdf(currentReceipt || {});
      openBlob(blob, false);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to open receipt PDF."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function handleDownloadPdf() {
    setActionLoading("download");
    setError("");

    try {
      const blob = await fetchPdf(currentReceipt || {});
      downloadBlob(blob, `${receiptNumber(currentReceipt || {})}.pdf`);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to download receipt PDF."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function handlePrintPdf() {
    setActionLoading("print");
    setError("");

    try {
      const blob = await fetchPdf(currentReceipt || {});
      openBlob(blob, true);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to print receipt."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function handleResend() {
    const id = receiptId(currentReceipt || {});
    const number = receiptNumber(currentReceipt || {});

    setActionLoading("resend");
    setError("");
    setSuccessText("");

    try {
      const res = await postFirst(
        [
          id ? `/finance/receipts/${id}/resend` : null,
          id ? `/finance/receipts/${id}/email` : null,
          id ? `/finance/receipts/${id}/resend-email` : null,
          number && number !== "--" ? `/finance/receipts/${encodeURIComponent(number)}/resend` : null,
        ].filter(Boolean),
        {
          receipt_id: id || null,
          receipt_number: number !== "--" ? number : null,
          email: payerEmail(currentReceipt || {}) !== "--" ? payerEmail(currentReceipt || {}) : null,
          send_receipt_email: true,
          attach_pdf: true,
        }
      );

      setSuccessText("Receipt email was sent.");
      onUpdated?.(res?.data || {});
      await loadReceipt();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to resend receipt."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function handleMarkSent() {
    const id = receiptId(currentReceipt || {});
    const number = receiptNumber(currentReceipt || {});

    setActionLoading("mark-sent");
    setError("");
    setSuccessText("");

    try {
      const res = await patchFirst(
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
          status: firstValue(currentReceipt || {}, ["status"], "issued"),
          sent_at: new Date().toISOString(),
        }
      );

      setSuccessText("Receipt was marked sent.");
      onUpdated?.(res?.data || {});
      await loadReceipt();
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

  const data = currentReceipt || {};
  const isMembership = String(category(data)).toLowerCase().includes("membership");

  return (
    <div className="finance-drawer-backdrop" role="presentation">
      <aside
        className="finance-drawer finance-receipt-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-drawer-title"
      >
        <div className="finance-drawer-header">
          <div className="finance-drawer-title-row">
            <span className="finance-drawer-icon">
              <Receipt size={20} />
            </span>

            <div>
              <h2 id="receipt-drawer-title">Receipt Details</h2>
              <p>{receiptNumber(data)}</p>
            </div>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={onClose}
            aria-label="Close receipt drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="finance-drawer-actions">
          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={loadReceipt}
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? "finance-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={handleViewPdf}
            disabled={actionLoading === "view"}
          >
            <FileText size={16} />
            View PDF
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={handleDownloadPdf}
            disabled={actionLoading === "download"}
          >
            <Download size={16} />
            Download
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={handlePrintPdf}
            disabled={actionLoading === "print"}
          >
            <Printer size={16} />
            Print
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={handleResend}
            disabled={actionLoading === "resend"}
          >
            <Send size={16} />
            Resend
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={handleMarkSent}
            disabled={actionLoading === "mark-sent"}
          >
            <Mail size={16} />
            Mark Sent
          </button>
        </div>

        <div className="finance-drawer-body">
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

          {loading ? (
            <div className="finance-loading-panel">
              <RefreshCcw size={18} className="finance-spin" />
              Loading receipt...
            </div>
          ) : null}

          <section className="finance-panel">
            <div className="finance-section-head">
              <UserRound size={17} />
              <h3>Payer / Donor</h3>
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
                <span>Phone</span>
                <strong>{payerPhone(data)}</strong>
              </div>

              <div>
                <span>Receipt Status</span>
                <StatusBadge value={firstValue(data, ["status"], "issued")} />
              </div>
            </div>
          </section>

          <section className="finance-panel">
            <div className="finance-section-head">
              <Receipt size={17} />
              <h3>Receipt Summary</h3>
            </div>

            <div className="finance-detail-grid">
              <div>
                <span>Receipt #</span>
                <strong>{receiptNumber(data)}</strong>
              </div>

              <div>
                <span>Payment #</span>
                <strong>{paymentNumber(data)}</strong>
              </div>

              <div>
                <span>Invoice #</span>
                <strong>{invoiceNumber(data)}</strong>
              </div>

              <div>
                <span>Amount</span>
                <strong>{money(amount(data))}</strong>
              </div>

              <div>
                <span>Issued Date</span>
                <strong>
                  {formatDate(firstValue(data, ["issued_at", "receipt_date", "created_at"], ""))}
                </strong>
              </div>

              <div>
                <span>Email Status</span>
                <StatusBadge
                  value={firstValue(data, ["email_status", "receipt_email_status"], "not_sent")}
                />
              </div>
            </div>
          </section>

          {isMembership || coverageLabel(data) || months.length ? (
            <section className="finance-panel">
              <div className="finance-section-head">
                <CalendarDays size={17} />
                <h3>Membership Plan & Coverage</h3>
              </div>

              <div className="finance-coverage-summary">
                <div>
                  <span>Membership Plan</span>
                  <strong>{planName(data) || "Membership"}</strong>
                </div>

                <div>
                  <span>Coverage Period</span>
                  <strong>{coverageLabel(data) || "--"}</strong>
                </div>

                <div>
                  <span>Months</span>
                  <strong>
                    {firstValue(data, ["months_paid", "coverage_month_count"], months.length || "--")}
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
                    <th>Category / Coverage / Program</th>
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
                    <td>{money(rows.reduce((sum, row) => sum + numberValue(row.amount), 0))}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="finance-panel">
            <div className="finance-section-head">
              <ShieldCheck size={17} />
              <h3>Enterprise Details</h3>
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
                <span>School / Trip Program</span>
                <strong>{programName(data)}</strong>
              </div>

              <div>
                <span>Pledge Campaign</span>
                <strong>{campaignName(data)}</strong>
              </div>

              <div>
                <span>Payment Method</span>
                <strong>{pretty(paymentMethod(data))}</strong>
              </div>

              <div>
                <span>Reference</span>
                <strong>{referenceNo(data)}</strong>
              </div>

              <div>
                <span>Card / ACH</span>
                <strong>
                  {[
                    firstValue(data, ["card_brand", "brand"], ""),
                    firstValue(data, ["card_last4", "last4"], "")
                      ? `**** ${firstValue(data, ["card_last4", "last4"], "")}`
                      : "",
                    firstValue(data, ["bank_name"], ""),
                  ]
                    .filter(Boolean)
                    .join(" ") || "--"}
                </strong>
              </div>

              <div>
                <span>Recorded By</span>
                <strong>
                  {firstValue(
                    data,
                    ["recorded_by_name", "created_by_name", "staff_name", "received_by_name"],
                    "--"
                  )}
                </strong>
              </div>

              <div>
                <span>Created</span>
                <strong>{formatDateTime(firstValue(data, ["created_at"], ""))}</strong>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}