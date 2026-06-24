// frontend/src/components/FinanceDashboard/components/FinanceInvoicePreview.jsx
import React from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Mail,
  Printer,
  Receipt,
  Send,
  User,
  X,
} from "lucide-react";

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "--";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function firstValue(row = {}, keys = [], fallback = "--") {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return fallback;
}

function invoiceStatus(invoice = {}) {
  return String(firstValue(invoice, ["status", "invoice_status"], "open")).toLowerCase();
}

function financialSummary(invoice = {}) {
  const total = numberValue(firstValue(invoice, ["total_amount", "amount", "invoice_amount"], 0));
  const paidRaw = numberValue(firstValue(invoice, ["paid_amount", "amount_paid", "total_paid"], 0));
  const paid = total > 0 ? Math.min(Math.max(paidRaw, 0), total) : Math.max(paidRaw, 0);

  const explicitBalance = firstValue(invoice, ["balance_due", "remaining_amount", "outstanding_amount"], null);
  const computedBalance = Math.max(total - paid, 0);

  const balance =
    explicitBalance === null || explicitBalance === undefined || explicitBalance === ""
      ? computedBalance
      : Math.max(Math.min(numberValue(explicitBalance), computedBalance), 0);

  return {
    total,
    paid,
    balance,
    paidInFull: balance <= 0 && total > 0,
  };
}

function rowsFromItems(invoice = {}) {
  if (Array.isArray(invoice.items) && invoice.items.length) {
    return invoice.items.map((item, index) => {
      const qty = numberValue(firstValue(item, ["quantity", "qty"], 1)) || 1;
      const unit = numberValue(firstValue(item, ["unit_price", "unit_amount", "rate"], 0));
      const total = numberValue(firstValue(item, ["total_price", "total_amount", "total", "amount"], qty * unit));

      return {
        id: item.id || index,
        code: firstValue(item, ["code"], String(index + 1).padStart(2, "0")),
        type: firstValue(item, ["item_type", "type", "category"], firstValue(invoice, ["category", "payment_type"], "Invoice")),
        description: firstValue(
          item,
          ["description", "item_name", "detail", "coverage", "program_name", "campaign_name"],
          "--"
        ),
        qty,
        unit,
        total,
      };
    });
  }

  const total = numberValue(firstValue(invoice, ["total_amount", "amount", "invoice_amount"], 0));
  const category = firstValue(invoice, ["category", "payment_type", "invoice_type"], "finance");

  return [
    {
      id: "summary",
      code: "01",
      type: category,
      description:
        firstValue(invoice, ["description", "sub_category", "plan_name", "program_name", "campaign_name"], "") ||
        pretty(category),
      qty: 1,
      unit: total,
      total,
    },
  ];
}

function paymentRows(invoice = {}) {
  if (Array.isArray(invoice.payments)) return invoice.payments;
  if (Array.isArray(invoice.payment_history)) return invoice.payment_history;

  if (invoice.payment_number || invoice.paid_amount) {
    return [
      {
        payment_number: invoice.payment_number,
        payment_date: invoice.paid_at || invoice.payment_date,
        amount: invoice.paid_amount,
        method: invoice.payment_method || invoice.method,
      },
    ];
  }

  return [];
}

function recipientName(invoice = {}) {
  return firstValue(
    invoice,
    [
      "full_name_snapshot",
      "full_name",
      "bill_to",
      "payer_name",
      "donor_name",
      "guest_name",
      "customer_name",
      "member_name",
    ],
    "Guest / Unknown"
  );
}

function recipientEmail(invoice = {}) {
  return firstValue(
    invoice,
    ["email_snapshot", "email", "recipient_email", "payer_email", "donor_email", "guest_email"],
    "--"
  );
}

function paymentLink(invoice = {}) {
  return firstValue(
    invoice,
    ["payment_link", "payment_url", "public_invoice_url", "checkout_url", "pay_url"],
    ""
  );
}

function StatusBanner({ invoice, summary }) {
  const status = invoiceStatus(invoice);

  if (summary.paidInFull || status === "paid") {
    return (
      <div className="finance-status-paid">
        <CheckCircle2 size={18} strokeWidth={2.1} />
        Invoice fully paid
      </div>
    );
  }

  if (status === "overdue") {
    return (
      <div className="finance-status-unpaid">
        <AlertTriangle size={18} strokeWidth={2.1} />
        Invoice overdue
      </div>
    );
  }

  if (status === "cancelled" || status === "canceled" || status === "void") {
    return (
      <div className="finance-status-unpaid">
        <AlertTriangle size={18} strokeWidth={2.1} />
        Invoice cancelled / void
      </div>
    );
  }

  return (
    <div className="finance-status-unpaid">
      <AlertTriangle size={18} strokeWidth={2.1} />
      Outstanding balance
    </div>
  );
}

function ActionButton({ children, onClick, variant = "secondary", disabled }) {
  return (
    <button
      type="button"
      className={`finance-btn ${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function FinanceInvoicePreview({
  open,
  invoice,
  onClose,
  onDownload,
  onPrint,
  onEmail,
  onResend,
  onSendPaymentLink,
  onMarkPaid,
  onAddPayment,
  onCancel,
  onRefund,
}) {
  if (!open || !invoice) return null;

  const summary = financialSummary(invoice);
  const items = rowsFromItems(invoice);
  const payments = paymentRows(invoice);
  const link = paymentLink(invoice);
  const status = invoiceStatus(invoice);
  const canCollect =
    summary.balance > 0 && !["paid", "cancelled", "canceled", "void"].includes(status);
  const canRefund = summary.paid > 0 && status === "paid";

  return (
    <div className="finance-modal-overlay">
      <div className="finance-invoice-preview" role="dialog" aria-modal="true">
        <div className="finance-invoice-head">
          <div className="finance-invoice-head-left">
            <div className="finance-invoice-icon">
              <FileText size={19} strokeWidth={2.1} />
            </div>

            <div>
              <h2>Invoice Preview</h2>
              <p>Accounts receivable preview with payment, receipt, and delivery controls.</p>
            </div>
          </div>

          <button
            type="button"
            className="finance-modal-close"
            onClick={onClose}
            aria-label="Close invoice preview"
          >
            <X size={18} strokeWidth={2.1} />
          </button>
        </div>

        <div className="finance-invoice-summary">
          <div className="finance-summary-box">
            <span>Invoice #</span>
            <strong>{firstValue(invoice, ["invoice_number", "invoice_no"])}</strong>
          </div>

          <div className="finance-summary-box">
            <span>Status</span>
            <strong>{pretty(status)}</strong>
          </div>

          <div className="finance-summary-box">
            <span>Due Date</span>
            <strong>{formatDate(firstValue(invoice, ["due_date"], ""))}</strong>
          </div>

          <div className="finance-summary-box finance-summary-highlight">
            <span>Balance</span>
            <strong>{money(summary.balance)}</strong>
          </div>
        </div>

        <div className="finance-invoice-body">
          <section className="finance-invoice-section">
            <div className="finance-invoice-section-title">
              <User size={16} strokeWidth={2.1} />
              <span>Member / Donor</span>
            </div>

            <div className="finance-grid-2">
              <div>
                <label>Full Name</label>
                <strong>{recipientName(invoice)}</strong>
              </div>

              <div>
                <label>Member #</label>
                <strong>{firstValue(invoice, ["member_no", "member_number"])}</strong>
              </div>

              <div>
                <label>Email</label>
                <strong>{recipientEmail(invoice)}</strong>
              </div>

              <div>
                <label>Phone</label>
                <strong>{firstValue(invoice, ["phone_snapshot", "phone", "payer_phone", "guest_phone"])}</strong>
              </div>
            </div>
          </section>

          <section className="finance-invoice-section">
            <div className="finance-invoice-section-title">
              <Calendar size={16} strokeWidth={2.1} />
              <span>Invoice Context</span>
            </div>

            <div className="finance-grid-2">
              <div>
                <label>Category</label>
                <strong>{pretty(firstValue(invoice, ["category", "payment_type", "invoice_type"]))}</strong>
              </div>

              <div>
                <label>Details</label>
                <strong>
                  {firstValue(
                    invoice,
                    ["sub_category", "plan_name", "program_name", "campaign_name", "donation_category", "description"],
                    "--"
                  )}
                </strong>
              </div>

              <div>
                <label>Payment #</label>
                <strong>{firstValue(invoice, ["payment_number"])}</strong>
              </div>

              <div>
                <label>Receipt #</label>
                <strong>{firstValue(invoice, ["receipt_number"])}</strong>
              </div>
            </div>
          </section>

          <section className="finance-invoice-section">
            <div className="finance-invoice-section-title">
              <CreditCard size={16} strokeWidth={2.1} />
              <span>Invoice Items</span>
            </div>

            <table className="finance-invoice-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{pretty(item.type)}</td>
                    <td>
                      <div className="finance-line-item">
                        <strong>{pretty(item.type)}</strong>
                        <span>{item.description}</span>
                      </div>
                    </td>
                    <td>{item.qty}</td>
                    <td>{money(item.unit)}</td>
                    <td>{money(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="finance-invoice-section">
            <div className="finance-invoice-section-title">
              <CheckCircle2 size={16} strokeWidth={2.1} />
              <span>Payments Applied</span>
            </div>

            {payments.length ? (
              <table className="finance-invoice-payment-table">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment, index) => (
                    <tr key={payment.id || payment.payment_number || index}>
                      <td>{payment.payment_number || "--"}</td>
                      <td>{formatDate(payment.payment_date || payment.paid_at || payment.created_at)}</td>
                      <td>{pretty(payment.method || payment.payment_method)}</td>
                      <td>{money(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="finance-empty-state">No payments applied.</div>
            )}
          </section>

          <div className="finance-invoice-totals">
            <div>
              <label>Total Amount</label>
              <strong>{money(summary.total)}</strong>
            </div>

            <div>
              <label>Total Paid</label>
              <strong>{money(summary.paid)}</strong>
            </div>

            <div className={summary.balance <= 0 ? "paid" : "unpaid"}>
              <label>Remaining Balance</label>
              <strong>{money(summary.balance)}</strong>
            </div>
          </div>

          {link ? (
            <section className="finance-invoice-section">
              <div className="finance-invoice-section-title">
                <ExternalLink size={16} strokeWidth={2.1} />
                <span>Payment Link</span>
              </div>

              <div className="finance-payment-link-preview">
                <span>{link}</span>
                <ActionButton onClick={() => navigator.clipboard?.writeText(link)}>
                  Copy Link
                </ActionButton>
              </div>
            </section>
          ) : null}

          <div className="finance-invoice-status">
            <StatusBanner invoice={invoice} summary={summary} />
          </div>
        </div>

        <div className="finance-invoice-actions">
          <ActionButton onClick={onClose}>Close</ActionButton>

          <ActionButton onClick={() => onPrint?.(invoice)}>
            <Printer size={16} strokeWidth={2.1} />
            Print
          </ActionButton>

          <ActionButton onClick={() => onDownload?.(invoice)}>
            <Download size={16} strokeWidth={2.1} />
            PDF
          </ActionButton>

          <ActionButton onClick={() => onEmail?.(invoice)}>
            <Mail size={16} strokeWidth={2.1} />
            Email
          </ActionButton>

          <ActionButton onClick={() => onResend?.(invoice)}>
            <Send size={16} strokeWidth={2.1} />
            Resend
          </ActionButton>

          {canCollect ? (
            <>
              <ActionButton onClick={() => onSendPaymentLink?.(invoice)}>
                <ExternalLink size={16} strokeWidth={2.1} />
                Payment Link
              </ActionButton>

              <ActionButton onClick={() => onAddPayment?.(invoice)}>
                <Receipt size={16} strokeWidth={2.1} />
                Add Payment
              </ActionButton>

              <ActionButton variant="primary" onClick={() => onMarkPaid?.(invoice)}>
                <CheckCircle2 size={16} strokeWidth={2.1} />
                Mark Paid
              </ActionButton>
            </>
          ) : null}

          {canRefund ? (
            <ActionButton onClick={() => onRefund?.(invoice)}>
              <Receipt size={16} strokeWidth={2.1} />
              Refund
            </ActionButton>
          ) : null}

          {!["cancelled", "canceled", "void"].includes(status) ? (
            <ActionButton variant="danger" onClick={() => onCancel?.(invoice)}>
              <AlertTriangle size={16} strokeWidth={2.1} />
              Cancel
            </ActionButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}