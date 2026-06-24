// frontend/src/components/FinanceDashboard/components/FinanceReceiptEmailModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Paperclip,
  Receipt,
  RefreshCcw,
  Send,
  UserRound,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

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

function receiptId(receipt = {}) {
  return firstValue(receipt, ["id", "receipt_id"], "");
}

function receiptNumber(receipt = {}) {
  return firstValue(receipt, ["receipt_number", "receipt_no", "number"], "--");
}

function paymentNumber(receipt = {}) {
  return firstValue(receipt, ["payment_number", "payment_no"], "--");
}

function invoiceNumber(receipt = {}) {
  return firstValue(receipt, ["invoice_number", "invoice_no"], "--");
}

function payerName(receipt = {}) {
  return firstValue(
    receipt,
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

function payerEmail(receipt = {}) {
  return firstValue(
    receipt,
    ["email_snapshot", "payer_email", "member_email", "donor_email", "guest_email", "email"],
    ""
  );
}

function payerPhone(receipt = {}) {
  return firstValue(
    receipt,
    ["phone_snapshot", "payer_phone", "member_phone", "donor_phone", "guest_phone", "phone"],
    ""
  );
}

function payerType(receipt = {}) {
  return firstValue(
    receipt,
    ["payer_type", "donor_type", "member_type"],
    receipt.member_id ? "member" : "guest"
  );
}

function memberNo(receipt = {}) {
  return firstValue(receipt, ["member_no", "member_number", "membership_id"], "--");
}

function amount(receipt = {}) {
  return numberValue(
    firstValue(receipt, ["amount", "receipt_amount", "total_amount", "payment_amount"], 0)
  );
}

function category(receipt = {}) {
  return firstValue(
    receipt,
    ["category", "payment_category", "finance_category", "donation_category", "payment_type"],
    "payment"
  );
}

function paymentMethod(receipt = {}) {
  return firstValue(receipt, ["payment_method", "method"], "--");
}

function referenceNo(receipt = {}) {
  return firstValue(
    receipt,
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

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function defaultSubject(receipt = {}) {
  return `Holy Trinity Ethiopian Orthodox Church Receipt ${receiptNumber(receipt)}`;
}

function defaultMessage(receipt = {}) {
  return `Dear ${payerName(receipt)},

Thank you for your payment to Holy Trinity Ethiopian Orthodox Church.

Your official receipt is attached as a PDF for your records.

Receipt Number: ${receiptNumber(receipt)}
Payment Number: ${paymentNumber(receipt)}
Invoice Number: ${invoiceNumber(receipt)}
Amount: ${money(amount(receipt))}
Method: ${pretty(paymentMethod(receipt))}
Category: ${pretty(category(receipt))}

Thank you for your support.

Holy Trinity Finance Office`;
}

function statusTone(value) {
  const status = String(value || "").toLowerCase();

  if (["sent", "delivered", "issued", "paid"].includes(status)) return "success";
  if (["queued", "pending", "not_sent"].includes(status)) return "warning";
  if (["failed", "error", "void", "cancelled"].includes(status)) return "danger";

  return "neutral";
}

function StatusBadge({ value }) {
  return (
    <span className={`finance-status-badge ${statusTone(value)}`}>
      {pretty(value)}
    </span>
  );
}

async function postFirst(endpoints, payload) {
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

  throw lastError || new Error("No receipt email endpoint is available.");
}

async function patchFirst(endpoints, payload) {
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

  throw lastError || new Error("No receipt status endpoint is available.");
}

export default function FinanceReceiptEmailModal({
  open = false,
  receipt = null,
  mode = "resend",
  onClose,
  onSent,
  onUpdated,
}) {
  const currentReceipt = receipt || {};
  const id = receiptId(currentReceipt);
  const number = receiptNumber(currentReceipt);

  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [attachPdf, setAttachPdf] = useState(true);
  const [markSentAfterEmail, setMarkSentAfterEmail] = useState(true);
  const [sendCopyToFinance, setSendCopyToFinance] = useState(false);

  const [saving, setSaving] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");

  useEffect(() => {
    if (!open) return;

    setRecipientName(payerName(currentReceipt));
    setRecipientEmail(payerEmail(currentReceipt));
    setCcEmail("");
    setSubject(defaultSubject(currentReceipt));
    setMessage(defaultMessage(currentReceipt));
    setAttachPdf(true);
    setMarkSentAfterEmail(true);
    setSendCopyToFinance(false);
    setSaving(false);
    setMarkingSent(false);
    setError("");
    setSuccessText("");
  }, [open, id, number]);

  const validationError = useMemo(() => {
    if (!id && (!number || number === "--")) {
      return "Receipt record is missing.";
    }

    if (!clean(recipientName)) {
      return "Recipient name is required.";
    }

    if (!clean(recipientEmail)) {
      return "Recipient email is required.";
    }

    if (!clean(subject)) {
      return "Subject is required.";
    }

    if (!clean(message)) {
      return "Message is required.";
    }

    return "";
  }, [id, number, recipientName, recipientEmail, subject, message]);

  function buildPayload() {
    return {
      receipt_id: id || null,
      receipt_number: number !== "--" ? number : null,

      payment_id: firstValue(currentReceipt, ["payment_id"], null),
      payment_number: paymentNumber(currentReceipt) !== "--" ? paymentNumber(currentReceipt) : null,

      invoice_id: firstValue(currentReceipt, ["invoice_id"], null),
      invoice_number: invoiceNumber(currentReceipt) !== "--" ? invoiceNumber(currentReceipt) : null,

      member_id: firstValue(currentReceipt, ["member_id"], null),
      member_no: memberNo(currentReceipt) !== "--" ? memberNo(currentReceipt) : null,

      payer_type: payerType(currentReceipt),
      donor_type: payerType(currentReceipt),

      recipient_name: clean(recipientName),
      recipient_email: clean(recipientEmail),
      recipient_phone: payerPhone(currentReceipt) || null,
      cc_email: clean(ccEmail) || null,

      full_name: clean(recipientName),
      payer_name: clean(recipientName),
      donor_name: clean(recipientName),
      email: clean(recipientEmail),
      payer_email: clean(recipientEmail),
      donor_email: clean(recipientEmail),

      subject: clean(subject),
      message: clean(message),

      amount: amount(currentReceipt),
      category: category(currentReceipt),
      payment_method: paymentMethod(currentReceipt),
      method: paymentMethod(currentReceipt),
      reference_no: referenceNo(currentReceipt),

      attach_pdf: attachPdf,
      include_pdf_attachment: attachPdf,

      include_public_link: false,
      include_view_link: false,
      include_download_link: false,

      mark_sent: markSentAfterEmail,
      send_copy_to_finance: sendCopyToFinance,
      send_receipt_email: true,
      channel: "email",

      source: "finance",
      created_from: "finance_receipt_email_modal",
      email_mode: mode,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccessText("");

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload();

      const res = await postFirst(
        [
          id ? `/finance/receipts/${id}/resend` : null,
          id ? `/finance/receipts/${id}/email` : null,
          id ? `/finance/receipts/${id}/resend-email` : null,
          id ? `/receipts/${id}/resend` : null,
          number && number !== "--"
            ? `/finance/receipts/${encodeURIComponent(number)}/resend`
            : null,
          number && number !== "--"
            ? `/finance/receipts/${encodeURIComponent(number)}/email`
            : null,
        ].filter(Boolean),
        payload
      );

      setSuccessText(
        res?.data?.message ||
          `Receipt ${number} was emailed to ${clean(recipientEmail)}.`
      );

      onSent?.(res?.data || {});
      onUpdated?.(res?.data || {});
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to email receipt."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkSentOnly() {
    setError("");
    setSuccessText("");

    setMarkingSent(true);

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
          sent_at: new Date().toISOString(),
          status: firstValue(currentReceipt, ["status"], "issued"),
          source: "finance",
          created_from: "finance_receipt_email_modal",
        }
      );

      setSuccessText(`Receipt ${number} was marked sent.`);
      onUpdated?.(res?.data || {});
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to mark receipt sent."
      );
    } finally {
      setMarkingSent(false);
    }
  }

  if (!open) return null;

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-receipt-email-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-email-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="finance-modal-header">
            <div className="finance-modal-title-row">
              <span className="finance-modal-icon">
                <Mail size={20} />
              </span>

              <div>
                <h2 id="receipt-email-title">Email Receipt</h2>
                <p>
                  Send the official receipt PDF attachment to a member or guest
                  donor. Receipt emails do not include public document links.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="finance-icon-button"
              onClick={onClose}
              aria-label="Close receipt email modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="finance-modal-body">
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

            <div className="finance-grid finance-grid-2">
              <section className="finance-panel">
                <div className="finance-section-head">
                  <Receipt size={17} />
                  <h3>Receipt Summary</h3>
                </div>

                <div className="finance-detail-grid">
                  <div>
                    <span>Receipt #</span>
                    <strong>{number}</strong>
                  </div>

                  <div>
                    <span>Payment #</span>
                    <strong>{paymentNumber(currentReceipt)}</strong>
                  </div>

                  <div>
                    <span>Invoice #</span>
                    <strong>{invoiceNumber(currentReceipt)}</strong>
                  </div>

                  <div>
                    <span>Amount</span>
                    <strong>{money(amount(currentReceipt))}</strong>
                  </div>

                  <div>
                    <span>Method</span>
                    <strong>{pretty(paymentMethod(currentReceipt))}</strong>
                  </div>

                  <div>
                    <span>Email Status</span>
                    <StatusBadge
                      value={firstValue(
                        currentReceipt,
                        ["email_status", "receipt_email_status"],
                        "not_sent"
                      )}
                    />
                  </div>
                </div>
              </section>

              <section className="finance-panel">
                <div className="finance-section-head">
                  <UserRound size={17} />
                  <h3>Recipient</h3>
                </div>

                <div className="finance-detail-grid">
                  <div>
                    <span>Donor Type</span>
                    <strong>{pretty(payerType(currentReceipt))}</strong>
                  </div>

                  <div>
                    <span>Member ID</span>
                    <strong>{memberNo(currentReceipt)}</strong>
                  </div>

                  <div>
                    <span>Phone</span>
                    <strong>{payerPhone(currentReceipt) || "--"}</strong>
                  </div>

                  <div>
                    <span>Issued Date</span>
                    <strong>
                      {formatDate(
                        firstValue(
                          currentReceipt,
                          ["issued_at", "receipt_date", "created_at"],
                          ""
                        )
                      )}
                    </strong>
                  </div>
                </div>
              </section>
            </div>

            <section className="finance-panel">
              <div className="finance-section-head">
                <Send size={17} />
                <h3>Email Message</h3>
              </div>

              <div className="finance-form-grid">
                <label className="finance-field">
                  <span>Recipient Name *</span>
                  <input
                    value={recipientName}
                    onChange={(event) => setRecipientName(event.target.value)}
                    required
                  />
                </label>

                <label className="finance-field">
                  <span>Recipient Email *</span>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    required
                  />
                </label>

                <label className="finance-field finance-field-full">
                  <span>CC</span>
                  <input
                    type="email"
                    value={ccEmail}
                    onChange={(event) => setCcEmail(event.target.value)}
                    placeholder="Optional copy recipient"
                  />
                </label>

                <label className="finance-field finance-field-full">
                  <span>Subject *</span>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    required
                  />
                </label>

                <label className="finance-field finance-field-full">
                  <span>Message *</span>
                  <textarea
                    rows={9}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    required
                  />
                </label>
              </div>
            </section>

            <section className="finance-panel">
              <div className="finance-section-head">
                <Paperclip size={17} />
                <h3>Delivery Options</h3>
              </div>

              <div className="finance-checkbox-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={attachPdf}
                    onChange={(event) => setAttachPdf(event.target.checked)}
                  />
                  <span>Attach official receipt PDF</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={markSentAfterEmail}
                    onChange={(event) => setMarkSentAfterEmail(event.target.checked)}
                  />
                  <span>Mark receipt email as sent after delivery</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={sendCopyToFinance}
                    onChange={(event) => setSendCopyToFinance(event.target.checked)}
                  />
                  <span>Send copy to finance office</span>
                </label>
              </div>
            </section>
          </div>

          <div className="finance-modal-footer">
            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={onClose}
              disabled={saving || markingSent}
            >
              Close
            </button>

            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={handleMarkSentOnly}
              disabled={saving || markingSent}
            >
              {markingSent ? (
                <>
                  <RefreshCcw size={16} className="finance-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Mark Sent
                </>
              )}
            </button>

            <button
              type="submit"
              className="finance-btn finance-btn-primary"
              disabled={saving || markingSent}
            >
              {saving ? (
                <>
                  <RefreshCcw size={16} className="finance-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send Receipt
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}