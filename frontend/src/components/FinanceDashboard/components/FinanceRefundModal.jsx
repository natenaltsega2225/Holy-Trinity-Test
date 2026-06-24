import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  FileText,
  Mail,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

export const REFUND_REASON_OPTIONS = [
  { value: "donor_request", label: "Donor Request" },
  { value: "duplicate_payment", label: "Duplicate Payment" },
  { value: "wrong_amount", label: "Wrong Amount" },
  { value: "wrong_member", label: "Wrong Member / Donor" },
  { value: "cancelled_event", label: "Cancelled School / Trip / Program" },
  { value: "pledge_correction", label: "Pledge Correction" },
  { value: "membership_correction", label: "Membership Correction" },
  { value: "chargeback", label: "Chargeback / Dispute" },
  { value: "finance_correction", label: "Finance Correction" },
  { value: "other", label: "Other" },
];

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numberValue(value));
}

function clean(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function firstValue(source, keys, fallback = "") {
  if (!source) return fallback;

  for (const key of keys) {
    const value = source[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function pretty(value) {
  return clean(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function responseData(response) {
  return response?.data || response || {};
}

async function postFirst(paths, payload) {
  let lastError = null;

  for (const path of uniq(paths)) {
    try {
      const response = await api.post(path, payload);
      return {
        endpoint: path,
        data: responseData(response),
      };
    } catch (err) {
      lastError = err;

      const status = err?.response?.status;

      if (status === 404 || status === 405) {
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Refund endpoint is not available.");
}

function buildIdempotencyKey(paymentNumber, paymentId) {
  const seed = paymentNumber || paymentId || "payment";
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `refund-${seed}-${Date.now()}-${rand}`;
}

export default function FinanceRefundModal({
  open = false,
  payment = null,
  invoice = null,
  receipt = null,
  maxAmount = null,
  onClose,
  onRefunded,
}) {
  const [refundType, setRefundType] = useState("full");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("donor_request");
  const [notes, setNotes] = useState("");

  const [sendRefundEmail, setSendRefundEmail] = useState(true);
  const [sendReceiptEmail, setSendReceiptEmail] = useState(false);
  const [voidInvoice, setVoidInvoice] = useState(false);
  const [voidReceipt, setVoidReceipt] = useState(false);
  const [reverseLedger, setReverseLedger] = useState(true);
  const [reverseMembershipCoverage, setReverseMembershipCoverage] = useState(false);
  const [reversePledgePayment, setReversePledgePayment] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const context = useMemo(() => {
    const paymentId = firstValue(payment, ["id", "payment_id"], "");
    const invoiceId = firstValue(invoice, ["id", "invoice_id"], firstValue(payment, ["invoice_id"], ""));
    const receiptId = firstValue(receipt, ["id", "receipt_id"], firstValue(payment, ["receipt_id"], ""));

    const paymentNumber = firstValue(
      payment,
      ["payment_number", "payment_no", "transaction_number"],
      "--"
    );

    const invoiceNumber = firstValue(
      invoice,
      ["invoice_number", "invoice_no", "number"],
      firstValue(payment, ["invoice_number", "invoice_no"], "--")
    );

    const receiptNumber = firstValue(
      receipt,
      ["receipt_number", "receipt_no", "number"],
      firstValue(payment, ["receipt_number", "receipt_no"], "--")
    );

    const originalAmount = numberValue(
      firstValue(
        payment,
        ["amount", "payment_amount", "total_amount"],
        firstValue(invoice, ["total_amount", "amount"], 0)
      )
    );

    const alreadyRefunded = numberValue(
      firstValue(payment, ["refunded_amount", "refund_amount", "total_refunded"], 0)
    );

    const candidateMax = numberValue(maxAmount);
    const refundableAmount =
      candidateMax > 0
        ? candidateMax
        : Math.max(originalAmount - alreadyRefunded, 0);

    const category = firstValue(
      payment,
      ["category", "payment_type", "finance_category"],
      firstValue(invoice, ["category", "invoice_type"], "finance")
    );

    return {
      paymentId,
      invoiceId,
      receiptId,
      paymentNumber,
      invoiceNumber,
      receiptNumber,
      originalAmount,
      alreadyRefunded,
      refundableAmount,
      status: firstValue(payment, ["status", "payment_status"], "--"),
      method: firstValue(payment, ["method", "payment_method"], "--"),
      provider: firstValue(payment, ["provider", "gateway"], "--"),
      reference: firstValue(
        payment,
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
      ),
      category,
      payerName: firstValue(
        payment,
        ["full_name_snapshot", "payer_name", "member_name", "donor_name", "full_name"],
        firstValue(invoice, ["full_name_snapshot", "bill_to", "payer_name"], "Guest Donor")
      ),
      payerEmail: firstValue(
        payment,
        ["email_snapshot", "payer_email", "donor_email", "email"],
        firstValue(invoice, ["email_snapshot", "recipient_email", "email"], "")
      ),
      memberNo: firstValue(
        payment,
        ["member_no", "member_number"],
        firstValue(invoice, ["member_no", "member_number"], "--")
      ),
    };
  }, [payment, invoice, receipt, maxAmount]);

  const refundAmount = numberValue(amountText);

  const isProviderRefund = ["card", "ach", "stripe", "us_bank_account"].some((part) =>
    `${context.method} ${context.provider}`.toLowerCase().includes(part)
  );

  const isPaid = ["paid", "completed", "posted", "succeeded"].includes(
    normalizeStatus(context.status)
  );

  const validationError = useMemo(() => {
    if (!context.paymentId && !context.paymentNumber) {
      return "Payment record is required before a refund can be processed.";
    }

    if (!isPaid) {
      return "Only paid or completed payments can be refunded.";
    }

    if (context.refundableAmount <= 0) {
      return "This payment has no refundable balance.";
    }

    if (refundAmount <= 0) {
      return "Refund amount must be greater than zero.";
    }

    if (refundAmount > context.refundableAmount) {
      return `Refund amount cannot exceed ${money(context.refundableAmount)}.`;
    }

    if (!reason) {
      return "Refund reason is required.";
    }

    if (
      ["other", "finance_correction", "wrong_member", "wrong_amount"].includes(reason) &&
      !notes.trim()
    ) {
      return "Notes are required for correction, wrong member, wrong amount, or other refunds.";
    }

    return "";
  }, [context, refundAmount, reason, notes, isPaid]);

  useEffect(() => {
    if (!open) return;

    setRefundType("full");
    setAmountText(context.refundableAmount ? String(context.refundableAmount.toFixed(2)) : "");
    setReason("donor_request");
    setNotes("");
    setSendRefundEmail(true);
    setSendReceiptEmail(false);
    setVoidInvoice(false);
    setVoidReceipt(false);
    setReverseLedger(true);
    setReverseMembershipCoverage(false);
    setReversePledgePayment(false);
    setSubmitting(false);
    setError("");
    setSuccess("");
  }, [open, context.refundableAmount]);

  useEffect(() => {
    if (refundType === "full") {
      setAmountText(context.refundableAmount ? String(context.refundableAmount.toFixed(2)) : "");
    }
  }, [refundType, context.refundableAmount]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      payment_id: context.paymentId || null,
      payment_number: context.paymentNumber !== "--" ? context.paymentNumber : null,

      invoice_id: context.invoiceId || null,
      invoice_number: context.invoiceNumber !== "--" ? context.invoiceNumber : null,

      receipt_id: context.receiptId || null,
      receipt_number: context.receiptNumber !== "--" ? context.receiptNumber : null,

      amount: refundAmount,
      refund_amount: refundAmount,
      refund_type: refundType,
      reason,
      reason_code: reason,
      notes: notes.trim() || null,

      payment_method: context.method,
      method: context.method,
      provider: context.provider,
      reference_no: context.reference !== "--" ? context.reference : null,

      category: context.category,
      full_name_snapshot: context.payerName,
      email_snapshot: context.payerEmail || null,
      member_no: context.memberNo !== "--" ? context.memberNo : null,

      send_refund_email: sendRefundEmail,
      send_receipt_email: sendReceiptEmail,

      void_invoice: voidInvoice,
      void_receipt: voidReceipt,

      reverse_ledger: reverseLedger,
      create_ledger_entry: reverseLedger,

      reverse_membership_coverage: reverseMembershipCoverage,
      reverse_pledge_payment: reversePledgePayment,

      source: "finance_refund_modal",
      idempotency_key: buildIdempotencyKey(context.paymentNumber, context.paymentId),
    };

    const endpoints = [
      context.paymentId ? `/finance/payments/${context.paymentId}/refund` : "",
      context.paymentId ? `/finance/refunds/payment/${context.paymentId}` : "",
      context.paymentId ? `/payments/${context.paymentId}/refund` : "",
      "/finance/refunds",
    ];

    try {
      setSubmitting(true);

      const result = await postFirst(endpoints, payload);

      setSuccess("Refund processed successfully.");

      onRefunded?.({
        ...result.data,
        endpoint: result.endpoint,
        payload,
      });

      window.setTimeout(() => {
        onClose?.();
      }, 700);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to process refund."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Process refund"
      >
        <div className="finance-modal-head">
          <div>
            <span className="finance-kicker">Refund Center</span>
            <h2>Process Refund</h2>
            <p>
              Reverse a paid transaction, update finance records, and keep the audit
              trail complete.
            </p>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={onClose}
            aria-label="Close refund modal"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="finance-alert danger">
            <AlertTriangle size={17} />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="finance-alert success">
            <CheckCircle2 size={17} />
            <span>{success}</span>
          </div>
        ) : null}

        <div className="finance-summary-grid compact">
          <div className="finance-summary-card">
            <span>Payment #</span>
            <strong>{context.paymentNumber}</strong>
          </div>

          <div className="finance-summary-card">
            <span>Original Payment</span>
            <strong>{money(context.originalAmount)}</strong>
          </div>

          <div className="finance-summary-card">
            <span>Refundable</span>
            <strong>{money(context.refundableAmount)}</strong>
          </div>

          <div className="finance-summary-card">
            <span>Method</span>
            <strong>{pretty(context.method)}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="finance-section">
            <div className="finance-section-title">
              <CreditCard size={18} />
              <h3>Payment Context</h3>
            </div>

            <div className="finance-detail-grid">
              <div>
                <span>Payer / Donor</span>
                <strong>{context.payerName}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{context.payerEmail || "--"}</strong>
              </div>

              <div>
                <span>Member ID</span>
                <strong>{context.memberNo}</strong>
              </div>

              <div>
                <span>Category</span>
                <strong>{pretty(context.category)}</strong>
              </div>

              <div>
                <span>Invoice #</span>
                <strong>{context.invoiceNumber}</strong>
              </div>

              <div>
                <span>Receipt #</span>
                <strong>{context.receiptNumber}</strong>
              </div>

              <div>
                <span>Reference</span>
                <strong>{context.reference}</strong>
              </div>

              <div>
                <span>Provider</span>
                <strong>{pretty(context.provider)}</strong>
              </div>
            </div>
          </div>

          <div className="finance-section">
            <div className="finance-section-title">
              <RefreshCcw size={18} />
              <h3>Refund Details</h3>
            </div>

            <div className="finance-form-grid three">
              <label>
                Refund Type
                <select
                  value={refundType}
                  onChange={(event) => setRefundType(event.target.value)}
                  disabled={submitting}
                >
                  <option value="full">Full Refund</option>
                  <option value="partial">Partial Refund</option>
                </select>
              </label>

              <label>
                Refund Amount
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amountText}
                  onChange={(event) => {
                    setRefundType("partial");
                    setAmountText(event.target.value);
                  }}
                  disabled={submitting}
                />
              </label>

              <label>
                Reason
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={submitting}
                >
                  {REFUND_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="finance-field-full">
                Notes / Audit Explanation
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Enter the finance reason, approval note, or donor request details..."
                  disabled={submitting}
                />
              </label>
            </div>
          </div>

          <div className="finance-section">
            <div className="finance-section-title">
              <ShieldCheck size={18} />
              <h3>Finance Controls</h3>
            </div>

            <div className="finance-check-grid">
              <label>
                <input
                  type="checkbox"
                  checked={sendRefundEmail}
                  onChange={(event) => setSendRefundEmail(event.target.checked)}
                  disabled={submitting}
                />
                <span>
                  <Mail size={15} />
                  Send refund email
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={sendReceiptEmail}
                  onChange={(event) => setSendReceiptEmail(event.target.checked)}
                  disabled={submitting}
                />
                <span>
                  <Receipt size={15} />
                  Send refund receipt
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={voidInvoice}
                  onChange={(event) => setVoidInvoice(event.target.checked)}
                  disabled={submitting}
                />
                <span>
                  <FileText size={15} />
                  Void or update invoice
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={voidReceipt}
                  onChange={(event) => setVoidReceipt(event.target.checked)}
                  disabled={submitting}
                />
                <span>
                  <Receipt size={15} />
                  Mark receipt adjusted
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={reverseLedger}
                  onChange={(event) => setReverseLedger(event.target.checked)}
                  disabled={submitting}
                />
                <span>
                  <ShieldCheck size={15} />
                  Create ledger reversal
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={reverseMembershipCoverage}
                  onChange={(event) =>
                    setReverseMembershipCoverage(event.target.checked)
                  }
                  disabled={submitting}
                />
                <span>Reverse membership coverage when applicable</span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={reversePledgePayment}
                  onChange={(event) => setReversePledgePayment(event.target.checked)}
                  disabled={submitting}
                />
                <span>Reverse pledge paid balance when applicable</span>
              </label>
            </div>
          </div>

          <div className="finance-audit-empty">
            {isProviderRefund
              ? "Card and ACH refunds will be sent to the payment provider when the backend supports provider refunds. Manual methods create finance reversal records for cash, check, or Zelle."
              : "Manual refunds should be physically returned by finance staff, then recorded here for ledger, receipt, invoice, and audit accuracy."}
          </div>

          <div className="finance-modal-actions">
            <button
              type="button"
              className="finance-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="finance-btn danger"
              disabled={submitting || Boolean(validationError)}
              title={validationError || "Process refund"}
            >
              {submitting ? "Processing..." : `Process ${money(refundAmount)} Refund`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}