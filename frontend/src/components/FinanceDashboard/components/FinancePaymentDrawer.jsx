// frontend/src/components/FinanceDashboard/components/FinancePaymentDrawer.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Mail,
  Receipt,
  RefreshCcw,
  Send,
  ShieldCheck,
  User,
  Wallet,
  X,
} from "lucide-react";

import api from "../../api";

import FinanceBadge from "../../Shared/FinanceBadge";
import CoverageDisplay from "../../Shared/CoverageDisplay";
import FinancePaymentAuditTimeline from "./FinancePaymentAuditTimeline";

import {
  cardDisplay,
  categoryLabel,
  formatDate,
  money,
  paymentSource,
  pretty,
} from "../../../utils/paymentFormatters";

import "../../../styles/finance-enterprise.css";

function statusTone(status) {
  const value = String(status || "").toLowerCase();

  if (["paid", "completed", "posted", "success", "succeeded", "sent"].includes(value)) {
    return "success";
  }

  if (["pending", "processing", "queued", "open", "partial"].includes(value)) {
    return "warning";
  }

  if (["failed", "cancelled", "canceled", "refunded", "void"].includes(value)) {
    return "danger";
  }

  return "primary";
}

function firstValue(row = {}, keys = [], fallback = "--") {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return fallback;
}

function DetailItem({ label, value, wide = false }) {
  return (
    <div className={`finance-detail-item${wide ? " wide" : ""}`}>
      <span>{label}</span>
      <strong>{value || "--"}</strong>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, variant = "secondary" }) {
  return (
    <button
      type="button"
      className={`finance-btn finance-btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function normalizePayment(data, fallback) {
  return (
    data?.payment ||
    data?.row ||
    data?.data ||
    data?.record ||
    fallback ||
    null
  );
}

function normalizeAuditRows(row = {}) {
  const possible =
    row.audit ||
    row.audit_rows ||
    row.auditTrail ||
    row.timeline ||
    row.events ||
    [];

  return Array.isArray(possible) ? possible : [];
}

function paymentId(row = {}) {
  return firstValue(row, ["id", "payment_id"], "");
}

function receiptId(row = {}) {
  return firstValue(row, ["receipt_id", "finance_receipt_id"], "");
}

function invoiceId(row = {}) {
  return firstValue(row, ["invoice_id", "finance_invoice_id"], "");
}

function receiptNumber(row = {}) {
  return firstValue(row, ["receipt_number", "receipt_no"], "");
}

function invoiceNumber(row = {}) {
  return firstValue(row, ["invoice_number", "invoice_no"], "");
}

export default function FinancePaymentDrawer({ open, payment, onClose }) {
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const row = paymentData || payment;

  useEffect(() => {
    if (!open || !paymentId(payment)) return;

    loadPayment();
  }, [open, payment?.id, payment?.payment_id]);

  async function loadPayment() {
    try {
      setLoading(true);
      setError("");

      const id = paymentId(payment);

      const { data } = await api.get(`/finance/payments/${id}`).catch(async () => {
        return api.get(`/payments/${id}`);
      });

      const nextPayment = normalizePayment(data, payment);

      setPaymentData(nextPayment);
      setAuditRows(normalizeAuditRows(data) || normalizeAuditRows(nextPayment));
    } catch (err) {
      console.error("Payment drawer load failed:", err);
      setPaymentData(payment || null);
      setAuditRows(normalizeAuditRows(payment));
      setError(err?.response?.data?.error || "Unable to load full payment details.");
    } finally {
      setLoading(false);
    }
  }

  const financialSummary = useMemo(() => {
    const amount = Number(firstValue(row, ["amount", "total_amount"], 0));
    const refunded = Number(firstValue(row, ["refunded_amount", "refund_amount"], 0));
    const fee = Number(firstValue(row, ["processing_fee", "stripe_fee", "fee_amount"], 0));

    return {
      amount,
      refunded,
      fee,
      net: Math.max(amount - refunded - fee, 0),
    };
  }, [row]);

  async function handleResendReceipt() {
    try {
      setSending(true);
      setError("");

      const id = paymentId(row);

      if (!id) {
        setError("Payment not found.");
        return;
      }

      await api.post(`/receipts/payment/${id}/resend`).catch(() =>
        api.post(`/finance/receipts/payment/${id}/resend`)
      );

      await loadPayment();
    } catch (err) {
      console.error("Receipt resend failed:", err);
      setError(err?.response?.data?.error || "Failed to resend receipt.");
    } finally {
      setSending(false);
    }
  }

  function openReceiptPdf() {
    const id = receiptId(row);
    const number = receiptNumber(row);

    if (id) {
      window.open(`/api/receipts/${id}/pdf`, "_blank", "noopener,noreferrer");
      return;
    }

    if (number) {
      window.open(`/api/receipts/number/${number}/pdf`, "_blank", "noopener,noreferrer");
    }
  }

  function openInvoicePdf() {
    const id = invoiceId(row);
    const number = invoiceNumber(row);

    if (id) {
      window.open(`/api/invoices/${id}/pdf`, "_blank", "noopener,noreferrer");
      return;
    }

    if (number) {
      window.open(`/api/invoices/number/${number}/pdf`, "_blank", "noopener,noreferrer");
    }
  }

  if (!open) return null;

  return (
    <div className="finance-drawer-overlay">
      <aside className="finance-drawer finance-drawer-xl" aria-label="Payment details">
        <div className="finance-drawer-header">
          <div>
            <div className="finance-drawer-eyebrow">FINANCE PAYMENT</div>
            <h2>{firstValue(row, ["payment_number"], "Payment")}</h2>
            <p>
              Payment, payer, invoice, receipt, membership coverage,
              reconciliation, and audit visibility.
            </p>
          </div>

          <button
            type="button"
            className="finance-drawer-close"
            onClick={onClose}
            aria-label="Close payment details"
          >
            <X size={18} strokeWidth={2.1} />
          </button>
        </div>

        <div className="finance-toolbar">
          <ActionButton onClick={openReceiptPdf} variant="primary" disabled={!receiptId(row) && !receiptNumber(row)}>
            <Receipt size={16} strokeWidth={2.1} />
            Receipt PDF
          </ActionButton>

          <ActionButton onClick={openInvoicePdf} disabled={!invoiceId(row) && !invoiceNumber(row)}>
            <FileText size={16} strokeWidth={2.1} />
            Invoice PDF
          </ActionButton>

          <ActionButton onClick={handleResendReceipt} disabled={sending || !paymentId(row)}>
            <Send size={16} strokeWidth={2.1} />
            {sending ? "Sending..." : "Resend Receipt"}
          </ActionButton>
        </div>

        {error ? (
          <div className="finance-alert error">
            <AlertTriangle size={16} strokeWidth={2.1} />
            {error}
          </div>
        ) : null}

        {loading ? <div className="finance-loading-card">Loading payment...</div> : null}

        {!loading && row ? (
          <div className="finance-drawer-body">
            <div className="finance-summary-grid">
              <div className="finance-summary-card featured">
                <span>Payment Amount</span>
                <h3>{money(financialSummary.amount)}</h3>
                <small>Gross payment total</small>
              </div>

              <div className="finance-summary-card">
                <span>Processing Fee</span>
                <h3>{money(financialSummary.fee)}</h3>
                <small>Card / ACH fee when available</small>
              </div>

              <div className="finance-summary-card">
                <span>Net Amount</span>
                <h3>{money(financialSummary.net)}</h3>
                <small>Estimated treasury impact</small>
              </div>

              <div className="finance-summary-card">
                <span>Status</span>
                <h3>
                  <FinanceBadge
                    label={pretty(firstValue(row, ["status", "payment_status"], "paid"))}
                    type={statusTone(firstValue(row, ["status", "payment_status"], "paid"))}
                  />
                </h3>
                <small>Payment lifecycle</small>
              </div>
            </div>

            <div className="finance-detail-grid">
              <div className="finance-detail-column">
                <section className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      <CreditCard size={18} strokeWidth={2.1} />
                      Payment Details
                    </h3>
                  </div>

                  <div className="finance-detail-list">
                    <DetailItem label="Payment #" value={firstValue(row, ["payment_number"])} />
                    <DetailItem
                      label="Category"
                      value={categoryLabel(firstValue(row, ["category", "payment_type"], ""))}
                    />
                    <DetailItem
                      label="Details"
                      value={firstValue(row, [
                        "sub_category",
                        "plan_name",
                        "program_name",
                        "program_title",
                        "description",
                        "donation_category",
                      ])}
                    />
                    <DetailItem label="Method" value={pretty(firstValue(row, ["payment_method", "method"], ""))} />
                    <DetailItem label="Provider" value={paymentSource(firstValue(row, ["provider"], ""))} />
                    <DetailItem label="Reference #" value={firstValue(row, ["reference_no", "reference_number"])} />
                    <DetailItem
                      label="Stripe Payment"
                      value={firstValue(row, ["stripe_payment_intent_id", "stripe_payment_intent"])}
                    />
                    <DetailItem label="Stripe Charge" value={firstValue(row, ["stripe_charge_id", "charge_id"])} />
                    <DetailItem label="Created" value={formatDate(firstValue(row, ["created_at"], ""))} />
                    <DetailItem
                      label="Paid Date"
                      value={formatDate(firstValue(row, ["payment_date", "paid_at", "received_at"], ""))}
                    />
                  </div>
                </section>

                <section className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      <Calendar size={18} strokeWidth={2.1} />
                      Membership Coverage
                    </h3>
                  </div>

                  <CoverageDisplay row={row} showMonths large />
                </section>

                <section className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      <RefreshCcw size={18} strokeWidth={2.1} />
                      Reconciliation
                    </h3>
                  </div>

                  <div className="finance-detail-list">
                    <DetailItem
                      label="Status"
                      value={
                        <FinanceBadge
                          label={pretty(firstValue(row, ["reconciliation_status"], "pending"))}
                          type={
                            String(firstValue(row, ["reconciliation_status"], "")).toLowerCase() === "matched"
                              ? "success"
                              : "warning"
                          }
                        />
                      }
                    />
                    <DetailItem label="Batch" value={firstValue(row, ["reconciliation_batch", "batch_number"])} />
                    <DetailItem label="Matched At" value={formatDate(firstValue(row, ["reconciled_at"], ""))} />
                  </div>
                </section>
              </div>

              <div className="finance-detail-column">
                <section className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      <User size={18} strokeWidth={2.1} />
                      Member / Payer
                    </h3>
                  </div>

                  <div className="finance-detail-list">
                    <DetailItem
                      label="Full Name"
                      value={firstValue(row, [
                        "full_name_snapshot",
                        "full_name",
                        "payer_name",
                        "guest_name",
                        "donor_name",
                      ])}
                    />
                    <DetailItem label="Member #" value={firstValue(row, ["member_no", "member_number"])} />
                    <DetailItem
                      label="Email"
                      value={firstValue(row, ["email_snapshot", "email", "payer_email", "guest_email"])}
                    />
                    <DetailItem
                      label="Phone"
                      value={firstValue(row, ["phone_snapshot", "phone", "payer_phone", "guest_phone"])}
                    />
                  </div>
                </section>

                <section className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      <Receipt size={18} strokeWidth={2.1} />
                      Receipt / Invoice
                    </h3>
                  </div>

                  <div className="finance-detail-list">
                    <DetailItem label="Receipt #" value={receiptNumber(row)} />
                    <DetailItem label="Invoice #" value={invoiceNumber(row)} />
                    <DetailItem
                      label="Receipt Email"
                      value={
                        <FinanceBadge
                          label={pretty(firstValue(row, ["email_status", "receipt_email_status"], "pending"))}
                          type={statusTone(firstValue(row, ["email_status", "receipt_email_status"], "pending"))}
                        />
                      }
                    />
                    <DetailItem label="Emailed At" value={formatDate(firstValue(row, ["emailed_at", "sent_at"], ""))} />
                    <DetailItem label="Email Error" value={firstValue(row, ["email_error", "email_last_error"])} wide />
                  </div>
                </section>

                <section className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      <Wallet size={18} strokeWidth={2.1} />
                      Card / ACH Information
                    </h3>
                  </div>

                  <div className="finance-detail-list">
                    <DetailItem label="Display" value={cardDisplay(row)} />
                    <DetailItem label="Brand" value={firstValue(row, ["card_brand", "bank_name"])} />
                    <DetailItem label="Last 4" value={firstValue(row, ["card_last4", "bank_last4"])} />
                    <DetailItem
                      label="Expiry"
                      value={firstValue(row, ["card_expiry"], row?.card_exp_month && row?.card_exp_year ? `${row.card_exp_month}/${row.card_exp_year}` : "--")}
                    />
                  </div>
                </section>

                <section className="finance-card">
                  <FinancePaymentAuditTimeline rows={auditRows} />
                </section>

                {firstValue(row, ["notes"], "") ? (
                  <section className="finance-card">
                    <div className="finance-card-header">
                      <h3>
                        <BadgeDollarSign size={18} strokeWidth={2.1} />
                        Notes
                      </h3>
                    </div>

                    <div className="finance-notes-box">{row.notes}</div>
                  </section>
                ) : null}
              </div>
            </div>

            <div className="finance-drawer-footer">
              <ActionButton onClick={onClose}>Close</ActionButton>

              <ActionButton onClick={openReceiptPdf} variant="primary" disabled={!receiptId(row) && !receiptNumber(row)}>
                <Download size={16} strokeWidth={2.1} />
                Receipt PDF
              </ActionButton>

              <ActionButton onClick={handleResendReceipt} disabled={sending || !paymentId(row)}>
                <Mail size={16} strokeWidth={2.1} />
                Email Receipt
              </ActionButton>

              <ActionButton onClick={loadPayment} disabled={loading}>
                <CheckCircle2 size={16} strokeWidth={2.1} />
                Refresh
              </ActionButton>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}