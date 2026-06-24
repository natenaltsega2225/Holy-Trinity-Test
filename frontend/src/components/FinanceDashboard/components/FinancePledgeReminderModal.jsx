
// frontend/src/components/FinanceDashboard/components/FinancePledgeReminderModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Copy,
  FileText,
  Link as LinkIcon,
  Mail,
  RefreshCcw,
  Send,
  Target,
  UserRound,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const REMINDER_TYPES = [
  { value: "friendly", label: "Friendly Reminder" },
  { value: "before_due", label: "Before Due Date" },
  { value: "due_today", label: "Due Today" },
  { value: "overdue", label: "Overdue" },
  { value: "monthly", label: "Monthly Follow Up" },
  { value: "final", label: "Final Reminder" },
  { value: "custom", label: "Custom Message" },
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

function clean(value) {
  return String(value ?? "").trim();
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

function pledgeNumbers(pledge = {}) {
  const pledged = numberValue(
    firstValue(pledge, ["pledged_amount", "pledge_amount", "amount"], 0)
  );

  const paid = numberValue(
    firstValue(pledge, ["paid_amount", "amount_paid", "collected_amount"], 0)
  );

  const storedRemaining = firstValue(
    pledge,
    ["remaining_amount", "remaining_balance", "balance_due", "pledge_remaining"],
    null
  );

  const remaining =
    storedRemaining === null || storedRemaining === undefined || storedRemaining === ""
      ? Math.max(pledged - paid, 0)
      : Math.max(numberValue(storedRemaining), 0);

  return { pledged, paid, remaining };
}

function donorName(pledge = {}) {
  return firstValue(
    pledge,
    [
      "full_name_snapshot",
      "donor_name",
      "member_name",
      "full_name",
      "guest_name",
      "payer_name",
      "name",
    ],
    "Guest Donor"
  );
}

function donorEmail(pledge = {}) {
  return firstValue(
    pledge,
    [
      "email_snapshot",
      "donor_email",
      "member_email",
      "email",
      "guest_email",
      "payer_email",
    ],
    ""
  );
}

function donorPhone(pledge = {}) {
  return firstValue(
    pledge,
    [
      "phone_snapshot",
      "donor_phone",
      "member_phone",
      "phone",
      "guest_phone",
      "payer_phone",
    ],
    ""
  );
}

function donorType(pledge = {}) {
  return firstValue(
    pledge,
    ["payer_type", "donor_type", "member_type"],
    pledge.member_id ? "member" : "guest"
  );
}

function campaignName(pledge = {}) {
  return firstValue(
    pledge,
    ["campaign_name", "campaign_title", "campaign", "fund_name"],
    "Pledge Campaign"
  );
}

function dueDateValue(pledge = {}) {
  const value = firstValue(pledge, ["due_date", "pledge_due_date", "next_due_date"], "");

  if (!value) return "";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  return d.toISOString().slice(0, 10);
}

function defaultSubject(type, pledge = {}) {
  const campaign = campaignName(pledge);

  if (type === "overdue") {
    return `Pledge Reminder: ${campaign} balance is overdue`;
  }

  if (type === "due_today") {
    return `Pledge Reminder: ${campaign} payment is due today`;
  }

  if (type === "final") {
    return `Final Pledge Reminder: ${campaign}`;
  }

  return `Pledge Reminder: ${campaign}`;
}

function defaultMessage(type, pledge = {}) {
  const name = donorName(pledge);
  const campaign = campaignName(pledge);
  const totals = pledgeNumbers(pledge);
  const due = formatDate(firstValue(pledge, ["due_date", "pledge_due_date"], ""));

  if (type === "overdue") {
    return `Dear ${name},\n\nThis is a reminder that your pledge balance for ${campaign} is currently overdue. Remaining balance: ${money(
      totals.remaining
    )}. Due date: ${due}.\n\nYou may use the secure payment link in this email to complete or partially pay your pledge.\n\nThank you for your support.`;
  }

  if (type === "final") {
    return `Dear ${name},\n\nThis is a final reminder for your pledge to ${campaign}. Remaining balance: ${money(
      totals.remaining
    )}.\n\nPlease contact the finance office if you need help or would like to update your pledge schedule.\n\nThank you.`;
  }

  return `Dear ${name},\n\nThank you for your pledge to ${campaign}. This is a friendly reminder that your remaining pledge balance is ${money(
    totals.remaining
  )}.\n\nYou may use the secure payment link in this email to make a payment at any time.\n\nThank you for your generosity.`;
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

  throw lastError || new Error("No pledge reminder endpoint is available.");
}

export default function FinancePledgeReminderModal({
  open = false,
  pledge = null,
  onClose,
  onSent,
  onSuccess,
}) {
  const pledgeId = pledge?.id || pledge?.pledge_id || null;
  const totals = useMemo(() => pledgeNumbers(pledge || {}), [pledge]);

  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [reminderType, setReminderType] = useState("friendly");
  const [dueDate, setDueDate] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [createInvoice, setCreateInvoice] = useState(true);
  const [includePaymentLink, setIncludePaymentLink] = useState(true);
  const [attachInvoicePdf, setAttachInvoicePdf] = useState(true);
  const [includePledgeSummary, setIncludePledgeSummary] = useState(true);
  const [sendCopyToFinance, setSendCopyToFinance] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
const [sendMode, setSendMode] =
  useState("now");

const [frequency, setFrequency] =
  useState("weekly");

const [scheduleEndDate, setScheduleEndDate] =
  useState("");
  useEffect(() => {
    if (!open) return;

    const initialType = "friendly";

    setRecipientName(donorName(pledge || {}));
    setRecipientEmail(donorEmail(pledge || {}));
    setRecipientPhone(donorPhone(pledge || {}));
    setReminderType(initialType);
    setDueDate(dueDateValue(pledge || {}));
    setSubject(defaultSubject(initialType, pledge || {}));
    setMessage(defaultMessage(initialType, pledge || {}));
    setCreateInvoice(true);
    setIncludePaymentLink(true);
    setAttachInvoicePdf(true);
    setIncludePledgeSummary(true);
    setSendCopyToFinance(false);
    setSaving(false);
    setError("");
    setSuccessText("");
    setPaymentLink("");
  }, [open, pledgeId]);

  function handleTypeChange(value) {
    setReminderType(value);
    setSubject(defaultSubject(value, pledge || {}));

    if (value !== "custom") {
      setMessage(defaultMessage(value, pledge || {}));
    }
  }

  const validationError = useMemo(() => {
    if (!pledgeId) return "Pledge record is missing.";
    if (!clean(recipientName)) return "Recipient name is required.";
    if (!clean(recipientEmail)) return "Recipient email is required.";
    if (!clean(subject)) return "Email subject is required.";
    if (!clean(message)) return "Reminder message is required.";
    if (totals.remaining <= 0) return "This pledge does not have an outstanding balance.";

    return "";
  }, [pledgeId, recipientName, recipientEmail, subject, message, totals.remaining]);

  function buildPayload() {
    return {
      pledge_id: pledgeId,
      pledge_number: firstValue(pledge, ["pledge_number", "number"], null),

      campaign_id: firstValue(pledge, ["campaign_id"], null),
      campaign_name: campaignName(pledge || {}),

      member_id: firstValue(pledge, ["member_id"], null),
      member_no: firstValue(pledge, ["member_no", "member_number"], null),

      payer_type: donorType(pledge || {}),
      donor_type: donorType(pledge || {}),

      recipient_name: clean(recipientName),
      recipient_email: clean(recipientEmail),
      recipient_phone: clean(recipientPhone) || null,

      full_name: clean(recipientName),
      donor_name: clean(recipientName),
      email: clean(recipientEmail),
      donor_email: clean(recipientEmail),
      phone: clean(recipientPhone) || null,
send_mode: sendMode,

schedule_frequency:
  sendMode === "schedule"
    ? frequency
    : null,

schedule_end_date:
  sendMode === "schedule"
    ? scheduleEndDate
    : null,
      reminder_type: reminderType,
      subject: clean(subject),
      message: clean(message),
      due_date: dueDate || null,

      pledged_amount: totals.pledged,
      paid_amount: totals.paid,
      remaining_amount: totals.remaining,
      balance_due: totals.remaining,

      create_invoice: createInvoice,
      update_invoice: createInvoice,
      include_payment_link: includePaymentLink,
      create_payment_link: includePaymentLink,
      attach_invoice_pdf: attachInvoicePdf,
      include_pledge_summary: includePledgeSummary,
      send_copy_to_finance: sendCopyToFinance,

      send_email: true,
      channel: "email",
      status: "queued",

      source: "finance",
      created_from: "finance_pledge_reminder_modal",
    };
  }

  async function handleCopyLink() {
    if (!paymentLink) return;

    try {
      await navigator.clipboard.writeText(paymentLink);
      setSuccessText("Payment link copied.");
    } catch (_err) {
      setError("Could not copy payment link.");
    }
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
    /*
    =====================================================
    SCHEDULE REMINDER CAMPAIGN
    =====================================================
    */
    if (sendMode === "schedule") {
      const schedulePayload = {
        schedule_name:
          `${campaignName(pledge || {})} Reminder Campaign`,

        frequency,

        campaign_id:
          pledge?.campaign_id ||
          null,

        start_date:
          new Date()
            .toISOString()
            .slice(0, 10),

        end_date:
          scheduleEndDate ||
          null,

        email_subject:
          clean(subject),

        email_template:
          clean(message),

        reminder_type:
          reminderType,

        pledge_id:
          pledgeId,

        created_by:
          localStorage.getItem("userId") ||
          null,

        active: 1,
      };

      await api.post(
        "/finance/reminder-schedules",
        schedulePayload
      );

      setSuccessText(
        `Reminder campaign scheduled successfully (${frequency}).`
      );

      onSuccess?.({
        type: "schedule_created",
        frequency,
      });

      setSaving(false);
      return;
    }

    /*
    =====================================================
    SEND IMMEDIATELY
    =====================================================
    */

    const payload = buildPayload();

    const res = await postFirst(
      [
        `/finance/pledges/${pledgeId}/reminders/send`,
        `/finance/pledges/${pledgeId}/send-reminder`,
        `/finance/pledges/${pledgeId}/reminder`,
        "/finance/pledge-reminders/send",
        "/finance/pledge-reminders",
      ],
      payload
    );

    const data =
      res?.data || {};

    const link =
      data.payment_link ||
      data.paymentLink ||
      data.invoice?.payment_link ||
      data.invoice?.public_url ||
      data.invoice?.checkout_url ||
      data.public_pay_url ||
      "";

    if (link) {
      setPaymentLink(link);
    }

    setSuccessText(
      data.message ||
        "Pledge reminder sent successfully."
    );

    onSent?.(data);
    onSuccess?.(data);
  } catch (err) {
    console.error(
      "Reminder submit failed:",
      err
    );

    setError(
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      "Failed to process pledge reminder."
    );
  } finally {
    setSaving(false);
  }
}
  if (!open) return null;

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-pledge-reminder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pledge-reminder-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="finance-modal-header">
            <div className="finance-modal-title-row">
              <span className="finance-modal-icon">
                <Mail size={20} />
              </span>

              <div>
                <h2 id="pledge-reminder-title">Send Pledge Reminder</h2>
                <p>
                  Send an audit-ready reminder with pledge summary, invoice PDF,
                  and secure payment link for members or guest donors.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="finance-icon-button"
              onClick={onClose}
              aria-label="Close pledge reminder modal"
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

            {paymentLink ? (
              <div className="finance-alert finance-alert-info">
                <LinkIcon size={17} />
                <span className="finance-link-text">{paymentLink}</span>
                <button
                  type="button"
                  className="finance-mini-button"
                  onClick={handleCopyLink}
                >
                  <Copy size={14} />
                  Copy
                </button>
              </div>
            ) : null}


            <div className="finance-grid finance-grid-2">
              <section className="finance-panel">
                <div className="finance-section-head">
                  <UserRound size={17} />
                  <h3>Recipient</h3>
                </div>

                <div className="finance-form-grid">
                  <label className="finance-field">
                    <span>Name *</span>
                    <input
                      value={recipientName}
                      onChange={(event) => setRecipientName(event.target.value)}
                      required
                    />
                  </label>

                  <label className="finance-field">
                    <span>Email *</span>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(event) => setRecipientEmail(event.target.value)}
                      required
                    />
                  </label>

                  <label className="finance-field">
                    <span>Phone</span>
                    <input
                      value={recipientPhone}
                      onChange={(event) => setRecipientPhone(event.target.value)}
                    />
                  </label>

                  <label className="finance-field">
                    <span>Donor Type</span>
                    <input value={donorType(pledge || {})} readOnly />
                  </label>
                </div>
              </section>

              <section className="finance-panel finance-summary-panel">
                <div className="finance-section-head">
                  <Target size={17} />
                  <h3>Pledge Summary</h3>
                </div>

                <div className="finance-kpi-stack">
                  <div>
                    <span>Campaign</span>
                    <strong>{campaignName(pledge || {})}</strong>
                  </div>

                  <div>
                    <span>Pledged</span>
                    <strong>{money(totals.pledged)}</strong>
                  </div>

                  <div>
                    <span>Paid</span>
                    <strong>{money(totals.paid)}</strong>
                  </div>

                  <div className="danger">
                    <span>Remaining</span>
                    <strong>{money(totals.remaining)}</strong>
                  </div>
                </div>
              </section>
            </div>

            <section className="finance-panel">
              <div className="finance-section-head">
                <CalendarClock size={17} />
                <h3>Reminder Details</h3>
              </div>

              <div className="finance-form-grid">
                <label className="finance-field">
                  <span>Reminder Type</span>
                  <select
                    value={reminderType}
                    onChange={(event) => handleTypeChange(event.target.value)}
                  >
                    {REMINDER_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="finance-field">
                  <span>Due Date</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
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
                    rows={8}
                    value={message}
                    onChange={(event) => {
                      setReminderType("custom");
                      setMessage(event.target.value);
                    }}
                    required
                  />
                </label>
              </div>
            </section>
<section className="finance-panel">
  <div className="finance-section-head">
    <CalendarClock size={17} />
    <h3>Reminder Automation</h3>
  </div>

  <div className="finance-form-grid">
    <label className="finance-field">
      <span>Delivery Mode</span>

      <select
        value={sendMode}
        onChange={(e) =>
          setSendMode(e.target.value)
        }
      >
        <option value="now">
          Send Now
        </option>

        <option value="schedule">
          Schedule Campaign
        </option>
      </select>
    </label>

    {sendMode === "schedule" && (
      <>
        <label className="finance-field">
          <span>Frequency</span>

          <select
            value={frequency}
            onChange={(e) =>
              setFrequency(e.target.value)
            }
          >
            <option value="weekly">
              Weekly
            </option>

            <option value="biweekly">
              Biweekly
            </option>

            <option value="monthly">
              Monthly
            </option>
          </select>
        </label>

        <label className="finance-field">
          <span>Schedule End Date</span>

          <input
            type="date"
            value={scheduleEndDate}
            onChange={(e) =>
              setScheduleEndDate(
                e.target.value
              )
            }
          />
        </label>
      </>
    )}
  </div>
</section>
            <section className="finance-panel">
              <div className="finance-section-head">
                <FileText size={17} />
                <h3>Invoice & Payment Link</h3>
              </div>

              <div className="finance-checkbox-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={createInvoice}
                    onChange={(event) => setCreateInvoice(event.target.checked)}
                  />
                  <span>Create or update pledge invoice</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={includePaymentLink}
                    onChange={(event) => setIncludePaymentLink(event.target.checked)}
                  />
                  <span>Include secure payment link</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={attachInvoicePdf}
                    onChange={(event) => setAttachInvoicePdf(event.target.checked)}
                  />
                  <span>Attach invoice PDF</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={includePledgeSummary}
                    onChange={(event) =>
                      setIncludePledgeSummary(event.target.checked)
                    }
                  />
                  <span>Include pledge balance summary</span>
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
              disabled={saving}
            >
              Close
            </button>

            <button
              type="submit"
              className="finance-btn finance-btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCcw size={16} className="finance-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send Reminder
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}