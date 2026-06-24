// frontend/src/components/FinanceDashboard/components/FinanceInvoiceEmailModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Link as LinkIcon,
  Mail,
  Send,
  X,
} from "lucide-react";

import api from "../../api";

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function clean(value) {
  return String(value ?? "").trim();
}

function firstValue(row = {}, keys = [], fallback = "") {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return fallback;
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
    "Member / Donor"
  );
}

function recipientEmail(invoice = {}) {
  return firstValue(
    invoice,
    [
      "email_snapshot",
      "email",
      "recipient_email",
      "payer_email",
      "donor_email",
      "guest_email",
      "customer_email",
    ],
    ""
  );
}

function invoiceNumber(invoice = {}) {
  return firstValue(invoice, ["invoice_number", "invoice_no"], "");
}

function balanceDue(invoice = {}) {
  const total = Number(firstValue(invoice, ["total_amount", "amount"], 0));
  const paid = Math.min(Number(firstValue(invoice, ["paid_amount"], 0)), total);
  const explicit = firstValue(invoice, ["balance_due", "remaining_amount"], null);

  if (explicit !== null && explicit !== undefined && explicit !== "") {
    return Math.max(Math.min(Number(explicit || 0), total - paid), 0);
  }

  return Math.max(total - paid, 0);
}

function defaultSubject(invoice = {}, reminder = false) {
  const number = invoiceNumber(invoice);

  if (reminder) {
    return `Payment Reminder - Invoice ${number}`;
  }

  return `Holy Trinity Ethiopian Orthodox Church Invoice ${number}`;
}

function defaultMessage(invoice = {}, reminder = false) {
  const name = recipientName(invoice);
  const number = invoiceNumber(invoice);
  const balance = balanceDue(invoice);

  if (reminder) {
    return `
Dear ${name},

This is a friendly reminder regarding your open invoice.

Invoice Number: ${number}
Balance Due: ${money(balance)}

Please use the secure payment link in this email to complete payment. A PDF copy of the invoice is attached when available.

Thank you.

Holy Trinity Finance Office
    `.trim();
  }

  return `
Dear ${name},

Your invoice has been generated.

Invoice Number: ${number}
Amount: ${money(firstValue(invoice, ["total_amount", "amount"], 0))}
Balance Due: ${money(balance)}

Please use the secure payment link in this email if payment is still due. A PDF copy of the invoice is attached when available.

Thank you.

Holy Trinity Finance Office
  `.trim();
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

export default function FinanceInvoiceEmailModal({
  open,
  invoice,
  onClose,
  onSuccess,
}) {
  const [sending, setSending] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [includePdf, setIncludePdf] = useState(true);
  const [includePaymentLink, setIncludePaymentLink] = useState(true);
  const [sendReminder, setSendReminder] = useState(false);
  const [markAsSent, setMarkAsSent] = useState(true);

  const number = invoiceNumber(invoice || {});
  const balance = useMemo(() => balanceDue(invoice || {}), [invoice]);

  useEffect(() => {
    if (!open || !invoice) return;

    const reminder = balanceDue(invoice) > 0;

    setError("");
    setSuccess("");
    setSending(false);
    setCreatingLink(false);

    setEmail(recipientEmail(invoice));
    setCc("");
    setSendReminder(reminder);
    setIncludePdf(true);
    setIncludePaymentLink(reminder);
    setMarkAsSent(true);
    setSubject(defaultSubject(invoice, reminder));
    setMessage(defaultMessage(invoice, reminder));
  }, [open, invoice]);

  useEffect(() => {
    if (!open || !invoice) return;

    setSubject(defaultSubject(invoice, sendReminder));
    setMessage(defaultMessage(invoice, sendReminder));
  }, [sendReminder]);

  function validate() {
    if (!clean(email)) return "Recipient email is required.";
    if (!clean(subject)) return "Subject is required.";
    if (!clean(message)) return "Message is required.";
    if (!number && !invoice?.id) return "Invoice identifier is missing.";

    return "";
  }

  async function createPaymentLink() {
    if (!invoice?.id) return null;

    setCreatingLink(true);

    try {
      const { data } = await postFirst(
        [
          `/finance/invoices/${invoice.id}/payment-link`,
          `/invoices/${invoice.id}/payment-link`,
          `/finance/invoices/${invoice.id}/public-link`,
        ],
        {
          scope: ["view", "pdf", "download", "pay", "email"],
        }
      );

      return (
        data?.payment_link ||
        data?.payment_url ||
        data?.public_invoice_url ||
        data?.url ||
        ""
      );
    } finally {
      setCreatingLink(false);
    }
  }

  async function handleSend() {
    try {
      setSending(true);
      setError("");
      setSuccess("");

      const validationError = validate();

      if (validationError) {
        setError(validationError);
        return;
      }

      let paymentLink = firstValue(
        invoice,
        ["payment_link", "payment_url", "public_invoice_url", "checkout_url"],
        ""
      );

      if (includePaymentLink && !paymentLink && balance > 0) {
        paymentLink = await createPaymentLink();
      }

      const payload = {
        email,
        to: email,
        cc: cc
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        subject,
        message,
        include_pdf: includePdf,
        attach_pdf: includePdf,
        include_payment_link: includePaymentLink,
        payment_link: includePaymentLink ? paymentLink : "",
        reminder: sendReminder,
        mark_sent: markAsSent,
      };

      await postFirst(
        [
          invoice?.id ? `/invoices/${invoice.id}/send-email` : null,
          invoice?.id ? `/finance/invoices/${invoice.id}/send` : null,
          invoice?.id ? `/finance/invoices/${invoice.id}/resend` : null,
          number ? `/finance/invoices/${encodeURIComponent(number)}/send` : null,
        ],
        payload
      );

      setSuccess("Invoice email sent successfully.");
      onSuccess?.();
    } catch (err) {
      console.error("Invoice email failed:", err);

      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to send invoice email."
      );
    } finally {
      setSending(false);
      setCreatingLink(false);
    }
  }

  if (!open || !invoice) return null;

  return (
    <div className="finance-modal-overlay">
      <div className="finance-email-modal" role="dialog" aria-modal="true">
        <div className="finance-modal-header">
          <div className="finance-email-title-wrap">
            <Mail size={18} strokeWidth={2.1} />

            <div>
              <h2>Email Invoice</h2>
              <p>Send invoice PDF, reminder notice, and secure payment link.</p>
            </div>
          </div>

          <button
            type="button"
            className="finance-modal-close"
            onClick={onClose}
            aria-label="Close email invoice"
            disabled={sending}
          >
            <X size={18} strokeWidth={2.1} />
          </button>
        </div>

        <div className="finance-email-warning">
          <AlertTriangle size={16} strokeWidth={2.1} />
          Invoice emails are recorded for finance audit history.
        </div>

        {error ? (
          <div className="finance-alert error" role="alert">
            <AlertTriangle size={16} strokeWidth={2.1} />
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="finance-alert success" role="status">
            <CheckCircle2 size={16} strokeWidth={2.1} />
            {success}
          </div>
        ) : null}

        <div className="finance-modal-body">
          <div className="finance-email-meta">
            <div>
              <label>Invoice #</label>
              <strong>{number || "--"}</strong>
            </div>

            <div>
              <label>Recipient</label>
              <strong>{recipientName(invoice)}</strong>
            </div>

            <div>
              <label>Balance Due</label>
              <strong>{money(balance)}</strong>
            </div>
          </div>

          <div className="finance-field">
            <label>Recipient Email *</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="finance-field">
            <label>CC</label>
            <input
              value={cc}
              onChange={(event) => setCc(event.target.value)}
              placeholder="Optional comma-separated email addresses"
            />
          </div>

          <div className="finance-field">
            <label>Subject *</label>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>

          <div className="finance-field">
            <label>Message *</label>
            <textarea
              rows="9"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          <div className="finance-grid-2">
            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={includePdf}
                onChange={(event) => setIncludePdf(event.target.checked)}
              />
              <span>
                <FileText size={14} strokeWidth={2.1} />
                Attach PDF invoice
              </span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={includePaymentLink}
                onChange={(event) => setIncludePaymentLink(event.target.checked)}
                disabled={balance <= 0}
              />
              <span>
                <LinkIcon size={14} strokeWidth={2.1} />
                Include payment link
              </span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={sendReminder}
                onChange={(event) => setSendReminder(event.target.checked)}
              />
              <span>Send as reminder / overdue notice</span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={markAsSent}
                onChange={(event) => setMarkAsSent(event.target.checked)}
              />
              <span>Mark invoice email as sent</span>
            </label>
          </div>
        </div>

        <div className="finance-modal-footer">
          <button
            type="button"
            className="finance-btn secondary"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={handleSend}
            disabled={sending || creatingLink}
          >
            <Send size={16} strokeWidth={2.1} />
            {creatingLink ? "Creating Link..." : sending ? "Sending..." : "Send Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}