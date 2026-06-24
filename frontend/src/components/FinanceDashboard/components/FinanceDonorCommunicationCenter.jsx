// frontend/src/components/FinanceDashboard/components/FinanceDonorCommunicationCenter.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Mail,
  Receipt,
  RefreshCcw,
  Send,
  UserRound,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const MESSAGE_TYPES = [
  { value: "invoice", label: "Invoice Payment Link" },
  { value: "receipt", label: "Receipt Resend" },
  { value: "pledge", label: "Pledge Reminder" },
  { value: "membership", label: "Membership Dues Reminder" },
  { value: "statement", label: "Statement" },
  { value: "custom", label: "Custom Message" },
];

const STATEMENT_TYPES = [
  { value: "giving_statement", label: "Giving Statement" },
  { value: "membership_statement", label: "Membership Statement" },
  { value: "pledge_statement", label: "Pledge Statement" },
  { value: "monthly_statement", label: "Monthly Statement" },
  { value: "quarterly_statement", label: "Quarterly Statement" },
  { value: "annual_statement", label: "Annual Statement" },
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

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];

    if (value !== undefined && value !== null && clean(value) !== "") {
      return value;
    }
  }

  return fallback;
}

function normalizeRows(payload, keys = []) {
  if (Array.isArray(payload)) return payload;

  for (const key of keys) {
    const value = payload?.[key] || payload?.data?.[key];
    if (Array.isArray(value)) return value;
  }

  const candidates = [
    payload?.rows,
    payload?.data,
    payload?.items,
    payload?.results,
    payload?.data?.rows,
    payload?.data?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
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

function pretty(value) {
  const text = clean(value);
  if (!text) return "--";

  return text
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function recipientName(donor = {}) {
  return firstValue(
    donor,
    [
      "full_name",
      "full_name_snapshot",
      "member_name",
      "payer_name",
      "donor_name",
      "guest_name",
      "name",
    ],
    "Donor"
  );
}

function recipientEmail(donor = {}) {
  return firstValue(
    donor,
    [
      "email",
      "email_snapshot",
      "member_email",
      "payer_email",
      "donor_email",
      "guest_email",
    ],
    ""
  );
}

function recipientPhone(donor = {}) {
  return firstValue(
    donor,
    ["phone", "phone_snapshot", "member_phone", "payer_phone", "donor_phone"],
    ""
  );
}

function recipientMemberNo(donor = {}) {
  return firstValue(donor, ["member_no", "member_number"], "");
}

function recipientMemberId(donor = {}) {
  return firstValue(donor, ["id", "member_id", "donor_id"], "");
}

function defaultSubject(type, donor) {
  const name = recipientName(donor);

  if (type === "invoice") return "Holy Trinity Invoice Payment Link";
  if (type === "receipt") return "Holy Trinity Receipt";
  if (type === "pledge") return "Holy Trinity Pledge Reminder";
  if (type === "membership") return "Holy Trinity Membership Dues Reminder";
  if (type === "statement") return "Holy Trinity Statement";

  return `Message for ${name}`;
}

function defaultMessage(type, donor) {
  const name = recipientName(donor);

  if (type === "invoice") {
    return `Dear ${name},\n\nYour Holy Trinity invoice is ready. Please use the secure payment link in this email to view and pay your invoice.\n\nThank you.`;
  }

  if (type === "receipt") {
    return `Dear ${name},\n\nA copy of your Holy Trinity receipt is attached for your records.\n\nThank you.`;
  }

  if (type === "pledge") {
    return `Dear ${name},\n\nThis is a friendly reminder about your pledge commitment. You may make a payment using the secure invoice/payment link provided.\n\nThank you for your support.`;
  }

  if (type === "membership") {
    return `Dear ${name},\n\nThis is a friendly reminder about your membership dues. Please use the secure payment link provided to complete your payment.\n\nThank you.`;
  }

  if (type === "statement") {
    return `Dear ${name},\n\nYour requested Holy Trinity statement is attached or available for review.\n\nThank you.`;
  }

  return `Dear ${name},\n\n`;
}

async function getFirst(endpoints, config = {}) {
  let lastError = null;

  for (const endpoint of endpoints.filter(Boolean)) {
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

  for (const endpoint of endpoints.filter(Boolean)) {
    try {
      const response = await api.post(endpoint, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

function DocumentSelect({
  label,
  value,
  onChange,
  rows,
  type,
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select {label}</option>

        {rows.map((row) => {
          const id = firstValue(row, ["id", `${type}_id`], "");
          const number = firstValue(row, [`${type}_number`, "number"], id);
          const amount = firstValue(row, ["total_amount", "amount", "pledged_amount"], 0);
          const status = firstValue(row, ["status", "invoice_status", "email_status"], "");

          return (
            <option key={`${type}-${id || number}`} value={id || number}>
              {number} - {money(amount)} - {pretty(status)}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export default function FinanceDonorCommunicationCenter({
  open = true,
  donor,
  defaultType = "invoice",
  onClose,
  onSent,
}) {
  const [type, setType] = useState(defaultType);
  const [form, setForm] = useState({
    email: "",
    subject: "",
    message: "",
    invoice_id: "",
    receipt_id: "",
    pledge_id: "",
    statement_type: "giving_statement",
    include_payment_link: true,
    attach_invoice_pdf: true,
    attach_receipt_pdf: true,
    copy_to_finance: false,
  });

  const [documents, setDocuments] = useState({
    invoices: [],
    receipts: [],
    pledges: [],
  });

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const memberId = recipientMemberId(donor);
  const memberNo = recipientMemberNo(donor);
  const email = recipientEmail(donor);

  const recipient = useMemo(
    () => ({
      member_id: memberId || null,
      member_no: memberNo || null,
      full_name: recipientName(donor),
      email: form.email || email,
      phone: recipientPhone(donor),
      payer_type: memberId || memberNo ? "member" : "guest",
    }),
    [donor, email, form.email, memberId, memberNo]
  );

  const selectedDocument = useMemo(() => {
    if (type === "invoice") {
      return documents.invoices.find((row) => {
        const id = firstValue(row, ["id", "invoice_id"], "");
        const number = firstValue(row, ["invoice_number"], "");
        return String(id) === String(form.invoice_id) || number === form.invoice_id;
      });
    }

    if (type === "receipt") {
      return documents.receipts.find((row) => {
        const id = firstValue(row, ["id", "receipt_id"], "");
        const number = firstValue(row, ["receipt_number"], "");
        return String(id) === String(form.receipt_id) || number === form.receipt_id;
      });
    }

    if (type === "pledge") {
      return documents.pledges.find((row) => {
        const id = firstValue(row, ["id", "pledge_id"], "");
        const number = firstValue(row, ["pledge_number"], "");
        return String(id) === String(form.pledge_id) || number === form.pledge_id;
      });
    }

    return null;
  }, [documents, form.invoice_id, form.receipt_id, form.pledge_id, type]);

  const loadDocuments = useCallback(async () => {
    if (!donor) return;

    setLoading(true);
    setError("");

    const params = {
      member_id: memberId || "",
      member_no: memberNo || "",
      email: email || "",
      q: memberNo || email || recipientName(donor),
      limit: 25,
    };

    try {
      const [invoicePayload, receiptPayload, pledgePayload] = await Promise.all([
        getFirst(["/finance/invoices", "/invoices"], { params }),
        getFirst(["/finance/receipts", "/receipts"], { params }),
        getFirst(["/finance/pledges"], { params }),
      ]);

      setDocuments({
        invoices: normalizeRows(invoicePayload, ["invoices"]),
        receipts: normalizeRows(receiptPayload, ["receipts"]),
        pledges: normalizeRows(pledgePayload, ["pledges"]),
      });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load donor communication documents."
      );
    } finally {
      setLoading(false);
    }
  }, [donor, email, memberId, memberNo]);

  useEffect(() => {
    if (!open) return;

    setType(defaultType || "invoice");
    setForm({
      email: recipientEmail(donor),
      subject: defaultSubject(defaultType || "invoice", donor),
      message: defaultMessage(defaultType || "invoice", donor),
      invoice_id: "",
      receipt_id: "",
      pledge_id: "",
      statement_type: "giving_statement",
      include_payment_link: true,
      attach_invoice_pdf: true,
      attach_receipt_pdf: true,
      copy_to_finance: false,
    });

    setSuccess("");
    setError("");
    loadDocuments();
  }, [open, donor, defaultType, loadDocuments]);

  function setValue(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function changeType(nextType) {
    setType(nextType);
    setForm((prev) => ({
      ...prev,
      subject: defaultSubject(nextType, donor),
      message: defaultMessage(nextType, donor),
      include_payment_link: nextType === "invoice" || nextType === "pledge" || nextType === "membership",
      attach_invoice_pdf: nextType === "invoice",
      attach_receipt_pdf: nextType === "receipt",
    }));
  }

  function validate() {
    if (!form.email) {
      setError("Recipient email is required.");
      return false;
    }

    if (!form.subject) {
      setError("Email subject is required.");
      return false;
    }

    if (!form.message) {
      setError("Message body is required.");
      return false;
    }

    if (type === "invoice" && !form.invoice_id) {
      setError("Select an invoice to send.");
      return false;
    }

    if (type === "receipt" && !form.receipt_id) {
      setError("Select a receipt to resend.");
      return false;
    }

    if (type === "pledge" && !form.pledge_id) {
      setError("Select a pledge to remind.");
      return false;
    }

    return true;
  }

  async function sendMessage(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!validate()) return;

    const invoiceNumber = firstValue(selectedDocument, ["invoice_number"], "");
    const receiptNumber = firstValue(selectedDocument, ["receipt_number"], "");
    const pledgeNumber = firstValue(selectedDocument, ["pledge_number"], "");

    const payload = {
      ...recipient,

      type,
      message_type: type,
      subject: form.subject,
      message: form.message,
      body: form.message,

      email: form.email,
      recipient_email: form.email,
      recipient_name: recipient.full_name,

      invoice_id: form.invoice_id || null,
      invoice_number: invoiceNumber || null,

      receipt_id: form.receipt_id || null,
      receipt_number: receiptNumber || null,

      pledge_id: form.pledge_id || null,
      pledge_number: pledgeNumber || null,

      statement_type: type === "statement" ? form.statement_type : null,

      include_payment_link: Boolean(form.include_payment_link),
      attach_invoice_pdf: Boolean(form.attach_invoice_pdf),
      attach_receipt_pdf: Boolean(form.attach_receipt_pdf),
      copy_to_finance: Boolean(form.copy_to_finance),

      source: "finance_donor_communication_center",
    };

    setSending(true);

    try {
      if (type === "invoice") {
        await postFirst(
          [
            form.invoice_id ? `/finance/invoices/${form.invoice_id}/email` : "",
            form.invoice_id ? `/finance/invoices/${form.invoice_id}/resend` : "",
            "/finance/notifications/invoice",
          ],
          payload
        );
      } else if (type === "receipt") {
        await postFirst(
          [
            form.receipt_id ? `/finance/receipts/${form.receipt_id}/resend` : "",
            form.receipt_id ? `/finance/receipts/${form.receipt_id}/email` : "",
            "/finance/notifications/receipt",
          ],
          payload
        );
      } else if (type === "pledge") {
        await postFirst(
          [
            form.pledge_id ? `/finance/pledges/${form.pledge_id}/send-reminder` : "",
            "/finance/pledge-reminders/send",
            "/finance/notifications/pledge",
          ],
          payload
        );
      } else if (type === "statement") {
        await postFirst(
          [
            "/finance/statements/send",
            "/finance/member-statements/send",
            "/finance/reports/statements/send",
          ],
          payload
        );
      } else {
        await postFirst(
          ["/finance/notifications/send", "/finance/notifications"],
          payload
        );
      }

      setSuccess("Email queued successfully.");
      onSent?.(payload);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to send email."
      );
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const content = (
    <form className="finance-communication-center" onSubmit={sendMessage}>
      <div className="finance-section-head">
        <div>
          <p className="finance-eyebrow">Communication Center</p>
          <h2>
            <Mail size={18} />
            Donor Email Workflow
          </h2>
          <span>
            Send invoice links, receipts, pledge reminders, membership reminders,
            statements, and custom finance messages.
          </span>
        </div>

        <div className="finance-row-actions">
          <button
            type="button"
            className="finance-btn ghost"
            onClick={loadDocuments}
            disabled={loading}
          >
            <RefreshCcw size={16} />
            Refresh
          </button>

          {onClose ? (
            <button
              type="button"
              className="finance-icon-button"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
      </div>

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

      <div className="finance-selected-member">
        <div className="finance-selected-member-icon">
          <UserRound size={18} />
        </div>

        <div>
          <strong>{recipient.full_name}</strong>
          <span>
            {recipient.member_no || "Non-Member"}
            {recipient.email ? ` - ${recipient.email}` : ""}
          </span>
          <small>{recipient.phone || "--"}</small>
        </div>
      </div>

      <div className="finance-form-grid three">
        <label>
          Message Type
          <select value={type} onChange={(event) => changeType(event.target.value)}>
            {MESSAGE_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Recipient Email *
          <input
            type="email"
            value={form.email}
            onChange={(event) => setValue("email", event.target.value)}
            required
          />
        </label>

        {type === "invoice" ? (
          <DocumentSelect
            label="Invoice"
            value={form.invoice_id}
            onChange={(value) => setValue("invoice_id", value)}
            rows={documents.invoices}
            type="invoice"
          />
        ) : null}

        {type === "receipt" ? (
          <DocumentSelect
            label="Receipt"
            value={form.receipt_id}
            onChange={(value) => setValue("receipt_id", value)}
            rows={documents.receipts}
            type="receipt"
          />
        ) : null}

        {type === "pledge" ? (
          <DocumentSelect
            label="Pledge"
            value={form.pledge_id}
            onChange={(value) => setValue("pledge_id", value)}
            rows={documents.pledges}
            type="pledge"
          />
        ) : null}

        {type === "statement" ? (
          <label>
            Statement Type
            <select
              value={form.statement_type}
              onChange={(event) => setValue("statement_type", event.target.value)}
            >
              {STATEMENT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {selectedDocument ? (
        <div className="finance-summary-grid compact">
          <div className="finance-summary-card">
            <span>Selected Document</span>
            <strong>
              {firstValue(
                selectedDocument,
                ["invoice_number", "receipt_number", "pledge_number"],
                "--"
              )}
            </strong>
            <small>{pretty(firstValue(selectedDocument, ["status"], ""))}</small>
          </div>

          <div className="finance-summary-card">
            <span>Amount</span>
            <strong>
              {money(
                firstValue(
                  selectedDocument,
                  ["total_amount", "amount", "pledged_amount"],
                  0
                )
              )}
            </strong>
            <small>{formatDate(firstValue(selectedDocument, ["created_at", "date"], ""))}</small>
          </div>
        </div>
      ) : null}

      <label className="finance-field-full">
        Subject *
        <input
          value={form.subject}
          onChange={(event) => setValue("subject", event.target.value)}
          required
        />
      </label>

      <label className="finance-field-full">
        Message *
        <textarea
          rows={8}
          value={form.message}
          onChange={(event) => setValue("message", event.target.value)}
          required
        />
      </label>

      <div className="finance-check-grid">
        <label>
          <input
            type="checkbox"
            checked={form.include_payment_link}
            onChange={(event) =>
              setValue("include_payment_link", event.target.checked)
            }
          />
          Include payment link
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.attach_invoice_pdf}
            onChange={(event) =>
              setValue("attach_invoice_pdf", event.target.checked)
            }
          />
          Attach invoice PDF
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.attach_receipt_pdf}
            onChange={(event) =>
              setValue("attach_receipt_pdf", event.target.checked)
            }
          />
          Attach receipt PDF
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.copy_to_finance}
            onChange={(event) =>
              setValue("copy_to_finance", event.target.checked)
            }
          />
          Copy finance office
        </label>
      </div>

      <div className="finance-modal-actions">
        <button
          type="button"
          className="finance-btn ghost"
          onClick={onClose || loadDocuments}
        >
          {onClose ? "Cancel" : "Refresh"}
        </button>

        <button type="submit" className="finance-btn primary" disabled={sending}>
          {type === "receipt" ? <Receipt size={16} /> : <Send size={16} />}
          {sending ? "Sending..." : "Send Email"}
        </button>
      </div>
    </form>
  );

  if (onClose) {
    return (
      <aside className="finance-drawer-backdrop" role="presentation">
        <div className="finance-drawer finance-communication-drawer">
          {content}
        </div>
      </aside>
    );
  }

  return (
    <section className="finance-panel">
      {content}
    </section>
  );
}

export { MESSAGE_TYPES, STATEMENT_TYPES };