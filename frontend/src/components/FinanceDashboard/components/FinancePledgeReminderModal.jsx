// frontend/src/components/FinanceDashboard/components/FinancePledgeReminderModal.jsx

import React, { useState } from "react";
import api from "../../api";
import { Mail, Send, AlertTriangle } from "lucide-react";

import "../../../styles/finance-dashboard.css";


function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function FinancePledgeReminderModal({
  open,
  pledge,
  onClose,
  onSuccess,
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [email, setEmail] = useState(pledge?.email || "");
  const [subject, setSubject] = useState(
    `Pledge Reminder${pledge?.campaign_name ? ` - ${pledge.campaign_name}` : ""}`
  );
  const [message, setMessage] = useState(
    `
Dear ${pledge?.full_name || "Donor"},

This is a friendly reminder regarding your pledge.

Campaign: ${pledge?.campaign_name || "--"}
Pledged Amount: ${money(pledge?.pledged_amount)}
Paid Amount: ${money(pledge?.paid_amount)}
Remaining Balance: ${money(
      Number(pledge?.pledged_amount || 0) - Number(pledge?.paid_amount || 0)
    )}

Thank you for your commitment and support.

Holy Trinity Finance Office
    `.trim()
  );

  async function handleSend() {
    try {
      setSending(true);
      setError("");
      setSuccess("");

      await api.post(`/finance/pledges/${pledge.id}/reminder`, {
        email,
        subject,
        message,
      });

      setSuccess("Pledge reminder sent successfully.");
      onSuccess?.();
    } catch (err) {
      setError(err?.response?.data?.error || "Unable to send reminder.");
    } finally {
      setSending(false);
    }
  }

  if (!open || !pledge) return null;

  return (
    <div className="finance-modal-overlay">
      <div className="finance-email-modal">
        <div className="finance-modal-header">
          <div className="finance-email-title-wrap">
            <Mail size={18} />
            <div>
              <h2>Send Pledge Reminder</h2>
              <p>Promise-to-pay donor follow-up and reminder system.</p>
            </div>
          </div>

          <button className="finance-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="finance-email-warning">
          <AlertTriangle size={16} />
          This reminder does not create payment or receipt. It only records follow-up communication.
        </div>

        {error ? <div className="finance-alert error">{error}</div> : null}
        {success ? <div className="finance-alert success">{success}</div> : null}

        <div className="finance-modal-body">
          <div className="finance-email-meta">
            <div>
              <label>Donor</label>
              <strong>{pledge.full_name || "Guest Donor"}</strong>
            </div>

            <div>
              <label>Remaining</label>
              <strong>
                {money(Number(pledge.pledged_amount || 0) - Number(pledge.paid_amount || 0))}
              </strong>
            </div>
          </div>

          <div className="finance-field">
            <label>Recipient Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="finance-field">
            <label>Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="finance-field">
            <label>Message</label>
            <textarea rows="10" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>

        <div className="finance-modal-footer">
          <button className="finance-btn secondary" onClick={onClose}>
            Cancel
          </button>

          <button className="finance-btn primary" onClick={handleSend} disabled={sending}>
            <Send size={16} />
            {sending ? "Sending..." : "Send Reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}