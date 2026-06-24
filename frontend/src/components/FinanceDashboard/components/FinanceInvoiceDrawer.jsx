// frontend/src/components/FinanceDashboard/components/FinanceInvoiceDrawer.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  Calendar,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Mail,
  Receipt,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  User,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import api from "../../api";

import FinanceBadge from "../../Shared/FinanceBadge";
import CoverageDisplay from "../../Shared/CoverageDisplay";
import FinancePaymentAuditTimeline from "./FinancePaymentAuditTimeline";

import {
  categoryLabel,
  formatDate,
  money,
  paymentSource,
  pretty,
} from "../../../utils/paymentFormatters";

import "../../../styles/finance-enterprise.css";

function firstValue(row = {}, keys = [], fallback = "--") {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return fallback;
}

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusTone(status) {
  const value = String(status || "").toLowerCase();

  if (["paid", "completed", "posted", "sent", "delivered"].includes(value)) {
    return "success";
  }

  if (["partial", "pending", "open", "draft", "queued"].includes(value)) {
    return "warning";
  }

  if (["overdue", "failed", "cancelled", "canceled", "void", "refunded"].includes(value)) {
    return "danger";
  }

  return "primary";
}

function invoiceId(row = {}) {
  return firstValue(row, ["id", "invoice_id"], "");
}

function invoiceNumber(row = {}) {
  return firstValue(row, ["invoice_number", "invoice_no"], "");
}

function receiptNumber(row = {}) {
  return firstValue(row, ["receipt_number", "receipt_no"], "");
}

function paymentId(row = {}) {
  return firstValue(row, ["payment_id", "finance_payment_id"], "");
}

function invoiceStatus(row = {}) {
  return String(firstValue(row, ["status", "invoice_status"], "open")).toLowerCase();
}

function financialSummary(row = {}) {
  const total = numberValue(firstValue(row, ["total_amount", "amount", "invoice_amount"], 0));
  const paidRaw = numberValue(firstValue(row, ["paid_amount", "amount_paid", "collected_amount"], 0));
  const paid = total > 0 ? Math.min(Math.max(paidRaw, 0), total) : Math.max(paidRaw, 0);

  const explicitBalance = firstValue(row, ["balance_due", "remaining_amount", "outstanding_amount"], null);
  const computedBalance = Math.max(total - paid, 0);

  const balance =
    explicitBalance === null || explicitBalance === undefined || explicitBalance === ""
      ? computedBalance
      : Math.max(Math.min(numberValue(explicitBalance), computedBalance), 0);

  return {
    total,
    paid,
    balance,
  };
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

function openWindow(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

async function getFirst(paths) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      return await api.get(path);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

async function postFirst(paths, payload = {}) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      return await api.post(path, payload);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

function normalizeInvoice(data, fallback) {
  return data?.invoice || data?.row || data?.data || data?.record || fallback || null;
}

function normalizeAuditRows(row = {}, response = {}) {
  const possible =
    response.audit ||
    response.audit_rows ||
    response.auditTrail ||
    response.timeline ||
    response.events ||
    row.audit ||
    row.audit_rows ||
    row.timeline ||
    row.events ||
    [];

  if (Array.isArray(possible) && possible.length) {
    return possible;
  }

  const derived = [];

  if (row.created_at || row.invoice_date) {
    derived.push({
      event_type: "invoice_created",
      message: `Invoice ${invoiceNumber(row)} was created.`,
      created_at: row.created_at || row.invoice_date,
      actor_name: firstValue(row, ["created_by_name", "staff_name", "created_by"], "System"),
      reference_no: invoiceNumber(row),
    });
  }

  if (row.emailed_at || row.sent_at) {
    derived.push({
      event_type: "invoice_email_sent",
      message: `Invoice email sent to ${firstValue(row, ["emailed_to", "email_snapshot", "email"], "--")}.`,
      created_at: row.emailed_at || row.sent_at,
      actor_name: firstValue(row, ["sent_by_name", "created_by_name"], "System"),
      reference_no: invoiceNumber(row),
    });
  }

  if (row.paid_at) {
    derived.push({
      event_type: "invoice_paid",
      message: "Invoice was marked paid or fully collected.",
      created_at: row.paid_at,
      actor_name: firstValue(row, ["paid_by_name", "created_by_name"], "System"),
      reference_no: firstValue(row, ["payment_number", "reference_no"], invoiceNumber(row)),
    });
  }

  if (["cancelled", "canceled", "void"].includes(invoiceStatus(row))) {
    derived.push({
      event_type: "invoice_cancelled",
      message: "Invoice was cancelled or voided.",
      created_at: row.cancelled_at || row.voided_at || row.updated_at,
      actor_name: firstValue(row, ["cancelled_by_name", "voided_by_name", "updated_by_name"], "System"),
      reference_no: invoiceNumber(row),
    });
  }

  return derived;
}

function paymentLink(row = {}) {
  return firstValue(
    row,
    [
      "payment_link",
      "payment_url",
      "public_payment_link",
      "public_invoice_url",
      "checkout_url",
      "pay_url",
    ],
    ""
  );
}

export default function FinanceInvoiceDrawer({
  open,
  onClose,
  invoice,
  onChanged,
  onEmail,
}) {
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const row = invoiceData || invoice;
  const summary = useMemo(() => financialSummary(row || {}), [row]);

  useEffect(() => {
    if (!open || !invoiceId(invoice)) return;

    loadInvoice();
  }, [open, invoice?.id, invoice?.invoice_id]);

  async function loadInvoice() {
    const id = invoiceId(invoice);

    if (!id) return;

    try {
      setLoading(true);
      setError("");

      const { data } = await getFirst([
        `/invoices/${id}`,
        `/finance/invoices/${id}`,
        `/finance/invoices/${id}/details`,
      ]);

      const nextInvoice = normalizeInvoice(data, invoice);
      setInvoiceData(nextInvoice);
      setAuditRows(normalizeAuditRows(nextInvoice, data));
    } catch (err) {
      console.error("Invoice drawer load failed:", err);
      setInvoiceData(invoice || null);
      setAuditRows(normalizeAuditRows(invoice || {}));
      setError(err?.response?.data?.error || "Unable to load full invoice details.");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(name, action, successMessage) {
    try {
      setBusyAction(name);
      setError("");
      setCopied(false);

      await action();

      if (successMessage) {
        window.alert(successMessage);
      }

      await loadInvoice();
      onChanged?.();
    } catch (err) {
      console.error(`${name} failed:`, err);
      setError(err?.response?.data?.error || err?.message || `Unable to complete ${name}.`);
    } finally {
      setBusyAction("");
    }
  }

  function viewPdf() {
    const id = invoiceId(row);
    const number = invoiceNumber(row);

    if (id) {
      openWindow(`/api/invoices/${id}/pdf`);
      return;
    }

    if (number) {
      openWindow(`/api/invoices/number/${encodeURIComponent(number)}/pdf`);
    }
  }

  function downloadPdf() {
    const id = invoiceId(row);
    const number = invoiceNumber(row);

    if (id) {
      openWindow(`/api/invoices/${id}/download`);
      return;
    }

    if (number) {
      openWindow(`/api/invoices/number/${encodeURIComponent(number)}/download`);
    }
  }

  async function generatePdf() {
    const id = invoiceId(row);

    await runAction(
      "generate_pdf",
      () =>
        postFirst([
          `/invoices/${id}/generate-pdf`,
          `/finance/invoices/${id}/generate-pdf`,
          `/finance/invoices/${id}/pdf`,
        ]),
      null
    );

    viewPdf();
  }

  async function sendEmail() {
    if (onEmail) {
      onEmail(row);
      return;
    }

    const id = invoiceId(row);
    const number = invoiceNumber(row);

    await runAction(
      "send_email",
      () =>
        postFirst(
          [
            id ? `/invoices/${id}/send-email` : null,
            id ? `/finance/invoices/${id}/send` : null,
            id ? `/finance/invoices/${id}/resend` : null,
            number ? `/finance/invoices/${encodeURIComponent(number)}/send` : null,
          ],
          {
            include_pdf: true,
            include_payment_link: summary.balance > 0,
            send_payment_link: summary.balance > 0,
          }
        ),
      "Invoice email sent."
    );
  }

  async function copyPaymentLink() {
    const existing = paymentLink(row);

    if (existing) {
      await navigator.clipboard?.writeText(existing);
      setCopied(true);
      return;
    }

    const id = invoiceId(row);

    await runAction("payment_link", async () => {
      const { data } = await postFirst(
        [
          `/finance/invoices/${id}/payment-link`,
          `/invoices/${id}/payment-link`,
          `/finance/invoices/${id}/public-link`,
        ],
        {
          scope: ["view", "pdf", "download", "pay", "email"],
        }
      );

      const link =
        data?.payment_link ||
        data?.payment_url ||
        data?.public_invoice_url ||
        data?.url;

      if (!link) {
        throw new Error("Payment link was not returned by the backend.");
      }

      await navigator.clipboard?.writeText(link);
      setCopied(true);
    });
  }

  async function markPaid() {
    const id = invoiceId(row);
    const ok = window.confirm("Mark this invoice fully paid?");
    if (!ok) return;

    await runAction(
      "mark_paid",
      () =>
        postFirst(
          [
            `/invoices/${id}/mark-paid`,
            `/finance/invoices/${id}/mark-paid`,
            `/finance/invoices/${id}/paid`,
          ],
          {
            amount: summary.balance || summary.total,
          }
        ),
      "Invoice marked paid."
    );
  }

  async function cancelInvoice() {
    const id = invoiceId(row);
    const ok = window.confirm("Cancel / void this invoice?");
    if (!ok) return;

    await runAction(
      "cancel_invoice",
      () =>
        postFirst(
          [
            `/invoices/${id}/cancel`,
            `/finance/invoices/${id}/cancel`,
            `/finance/invoices/${id}/void`,
          ],
          {
            reason: "Cancelled from Finance Invoice Drawer",
          }
        ),
      "Invoice cancelled."
    );
  }

  async function refundInvoice() {
    const id = invoiceId(row);
    const pid = paymentId(row);

    const ok = window.confirm("Start a refund for this paid invoice?");
    if (!ok) return;

    await runAction(
      "refund_invoice",
      () =>
        postFirst(
          [
            `/finance/invoices/${id}/refund`,
            `/invoices/${id}/refund`,
            pid ? `/finance/payments/${pid}/refund` : null,
          ],
          {
            amount: summary.paid || summary.total,
            reason: "Refund requested from Finance Invoice Drawer",
          }
        ),
      "Refund request submitted."
    );
  }

  function openReceipt() {
    const receipt = receiptNumber(row);

    if (receipt) {
      openWindow(`/dash/finance/receipts/${encodeURIComponent(receipt)}`);
    }
  }

  function openReceiptPdf() {
    const receipt = receiptNumber(row);

    if (receipt) {
      openWindow(`/api/receipts/number/${encodeURIComponent(receipt)}/pdf`);
    }
  }

  if (!open) return null;

  const status = invoiceStatus(row || {});
  const canCollect = summary.balance > 0 && !["paid", "cancelled", "canceled", "void"].includes(status);
  const canRefund = status === "paid" && summary.paid > 0;
  const canCancel = !["paid", "cancelled", "canceled", "void"].includes(status);

  return (
    <div className="finance-drawer-overlay">
      <aside className="finance-drawer finance-drawer-xl" aria-label="Invoice details">
        <div className="finance-drawer-header">
          <div>
            <div className="finance-drawer-eyebrow">FINANCE INVOICE</div>
            <h2>{invoiceNumber(row) || "Invoice"}</h2>
            <p>Invoice, payment link, PDF, email, payment, receipt, refund, and audit details.</p>
          </div>

          <button
            type="button"
            className="finance-drawer-close"
            onClick={onClose}
            aria-label="Close invoice drawer"
          >
            <X size={18} strokeWidth={2.1} />
          </button>
        </div>

        <div className="finance-toolbar">
          <ActionButton onClick={viewPdf} variant="primary" disabled={!row}>
            <FileText size={16} strokeWidth={2.1} />
            View PDF
          </ActionButton>

          <ActionButton onClick={downloadPdf} disabled={!row}>
            <Download size={16} strokeWidth={2.1} />
            Download
          </ActionButton>

          <ActionButton onClick={sendEmail} disabled={!row || busyAction === "send_email"}>
            <Mail size={16} strokeWidth={2.1} />
            {busyAction === "send_email" ? "Sending..." : "Send / Resend"}
          </ActionButton>

          <ActionButton onClick={copyPaymentLink} disabled={!row || busyAction === "payment_link" || !canCollect}>
            <LinkIcon size={16} strokeWidth={2.1} />
            {copied ? "Copied" : "Payment Link"}
          </ActionButton>

          <ActionButton onClick={markPaid} disabled={!canCollect || busyAction === "mark_paid"} variant="success">
            <CheckCircle2 size={16} strokeWidth={2.1} />
            Mark Paid
          </ActionButton>

          <ActionButton onClick={refundInvoice} disabled={!canRefund || busyAction === "refund_invoice"}>
            <RotateCcw size={16} strokeWidth={2.1} />
            Refund
          </ActionButton>

          <ActionButton onClick={cancelInvoice} disabled={!canCancel || busyAction === "cancel_invoice"} variant="danger">
            <XCircle size={16} strokeWidth={2.1} />
            Void
          </ActionButton>
        </div>

        {error ? (
          <div className="finance-alert error">
            <AlertTriangle size={16} strokeWidth={2.1} />
            {error}
          </div>
        ) : null}

        {loading ? <div className="finance-loading-card">Loading invoice...</div> : null}

        {!loading && row ? (
          <div className="finance-drawer-body">
            <div className="finance-summary-grid">
              <div className="finance-summary-card">
                <span>Invoice Total</span>
                <h3>{money(summary.total)}</h3>
                <small>Total invoice value</small>
              </div>

              <div className="finance-summary-card">
                <span>Paid Amount</span>
                <h3>{money(summary.paid)}</h3>
                <small>Collected amount</small>
              </div>

              <div className="finance-summary-card featured">
                <span>Balance Due</span>
                <h3>{money(summary.balance)}</h3>
                <small>Outstanding receivable</small>
              </div>

              <div className="finance-summary-card">
                <span>Status</span>
                <h3>
                  <FinanceBadge label={pretty(status)} type={statusTone(status)} />
                </h3>
                <small>Invoice lifecycle</small>
              </div>
            </div>

            <div className="finance-detail-grid">
              <div className="finance-detail-column">
                <section className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      <FileText size={18} strokeWidth={2.1} />
                      Invoice Information
                    </h3>
                  </div>

                  <div className="finance-detail-list">
                    <DetailItem label="Invoice #" value={invoiceNumber(row)} />
                    <DetailItem label="Payment #" value={firstValue(row, ["payment_number"])} />
                    <DetailItem label="Receipt #" value={receiptNumber(row)} />
                    <DetailItem label="Type" value={pretty(firstValue(row, ["invoice_type", "payment_type", "category"]))} />
                    <DetailItem label="Category" value={categoryLabel(firstValue(row, ["category", "payment_type"]))} />
                    <DetailItem
                      label="Details"
                      value={firstValue(row, ["sub_category", "plan_name", "program_name", "campaign_name", "description"])}
                    />
                    <DetailItem label="Created" value={formatDate(firstValue(row, ["created_at", "invoice_date"], ""))} />
                    <DetailItem label="Invoice Date" value={formatDate(firstValue(row, ["invoice_date", "issued_at"], ""))} />
                    <DetailItem label="Due Date" value={formatDate(firstValue(row, ["due_date"], ""))} />
                    <DetailItem label="Paid Date" value={formatDate(firstValue(row, ["paid_at"], ""))} />
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
                      <ShieldCheck size={18} strokeWidth={2.1} />
                      Audit Timeline
                    </h3>
                  </div>

                  <FinancePaymentAuditTimeline rows={auditRows} />
                </section>
              </div>

              <div className="finance-detail-column">
                <section className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      <User size={18} strokeWidth={2.1} />
                      Member / Donor
                    </h3>
                  </div>

                  <div className="finance-detail-list">
                    <DetailItem
                      label="Full Name"
                      value={firstValue(row, ["full_name", "full_name_snapshot", "payer_name", "guest_name", "donor_name"])}
                    />
                    <DetailItem label="Member #" value={firstValue(row, ["member_no", "member_number"])} />
                    <DetailItem label="Email" value={firstValue(row, ["email_snapshot", "email", "payer_email", "guest_email"])} />
                    <DetailItem label="Phone" value={firstValue(row, ["phone_snapshot", "phone", "payer_phone", "guest_phone"])} />
                  </div>
                </section>

                <section className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      <CreditCard size={18} strokeWidth={2.1} />
                      Payment Information
                    </h3>
                  </div>

                  <div className="finance-detail-list">
                    <DetailItem label="Method" value={pretty(firstValue(row, ["payment_method", "method"]))} />
                    <DetailItem label="Provider" value={paymentSource(firstValue(row, ["provider", "payment_source"]))} />
                    <DetailItem label="Reference" value={firstValue(row, ["reference_no", "reference_number", "transaction_reference"])} />
                    <DetailItem label="Stripe Payment" value={firstValue(row, ["stripe_payment_intent_id", "stripe_payment_intent"])} />
                    <DetailItem label="Stripe Invoice" value={firstValue(row, ["stripe_invoice_id"])} />
                  </div>
                </section>

                <section className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      <Wallet size={18} strokeWidth={2.1} />
                      Financial Summary
                    </h3>
                  </div>

                  <div className="finance-financial-list">
                    <div className="finance-financial-row">
                      <span>Invoice Total</span>
                      <strong>{money(summary.total)}</strong>
                    </div>

                    <div className="finance-financial-row">
                      <span>Paid Amount</span>
                      <strong>{money(summary.paid)}</strong>
                    </div>

                    <div className="finance-financial-row total">
                      <span>Balance Due</span>
                      <strong>{money(summary.balance)}</strong>
                    </div>
                  </div>
                </section>

                <section className="finance-card">
                  <div className="finance-card-header">
                    <h3>
                      <Mail size={18} strokeWidth={2.1} />
                      Email / Payment Link
                    </h3>
                  </div>

                  <div className="finance-detail-list">
                    <DetailItem
                      label="Email Status"
                      value={
                        <FinanceBadge
                          label={pretty(firstValue(row, ["email_status", "invoice_email_status"], "pending"))}
                          type={statusTone(firstValue(row, ["email_status", "invoice_email_status"], "pending"))}
                        />
                      }
                    />
                    <DetailItem label="Sent To" value={firstValue(row, ["emailed_to", "recipient_email", "email_snapshot", "email"])} />
                    <DetailItem label="Sent At" value={formatDate(firstValue(row, ["emailed_at", "sent_at"], ""))} />
                    <DetailItem
                      label="Payment Link"
                      value={
                        paymentLink(row) ? (
                          <button
                            type="button"
                            className="finance-inline-link"
                            onClick={copyPaymentLink}
                          >
                            <Copy size={13} strokeWidth={2.1} />
                            Copy Link
                          </button>
                        ) : (
                          "--"
                        )
                      }
                    />
                    <DetailItem label="Error" value={firstValue(row, ["email_error", "email_last_error"], "")} wide />
                  </div>
                </section>

                {receiptNumber(row) ? (
                  <section className="finance-card">
                    <div className="finance-card-header">
                      <h3>
                        <Receipt size={18} strokeWidth={2.1} />
                        Receipt
                      </h3>
                    </div>

                    <div className="finance-drawer-action-row">
                      <ActionButton onClick={openReceipt}>
                        <ExternalLink size={16} strokeWidth={2.1} />
                        View Receipt
                      </ActionButton>

                      <ActionButton onClick={openReceiptPdf}>
                        <Download size={16} strokeWidth={2.1} />
                        Receipt PDF
                      </ActionButton>
                    </div>
                  </section>
                ) : null}

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

              <ActionButton onClick={viewPdf} variant="primary">
                <FileText size={16} strokeWidth={2.1} />
                View PDF
              </ActionButton>

              <ActionButton onClick={sendEmail} disabled={busyAction === "send_email"}>
                <Mail size={16} strokeWidth={2.1} />
                Send Invoice
              </ActionButton>

              <ActionButton onClick={loadInvoice} disabled={loading}>
                <RefreshCcw size={16} strokeWidth={2.1} />
                Refresh
              </ActionButton>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}