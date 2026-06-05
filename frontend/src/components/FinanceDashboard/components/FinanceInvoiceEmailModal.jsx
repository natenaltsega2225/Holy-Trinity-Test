// frontend/src/components/FinanceDashboard/components/FinanceInvoiceEmailModal.jsx

import React, {
  useState,
} from "react";

import {
  Mail,
  Send,
  AlertTriangle,
} from "lucide-react";

import api from "../../api";

// import "../finance-dashboard.css";

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceInvoiceEmailModal({

  open,

  invoice,

  onClose,

  onSuccess,
}) {

  const [sending,
    setSending] =
      useState(false);

  const [error,
    setError] =
      useState("");

  const [success,
    setSuccess] =
      useState("");

  const [email,
    setEmail] =
      useState(
        invoice?.email || ""
      );

  const [subject,
    setSubject] =
      useState(
        `Invoice ${invoice?.invoice_number || ""}`
      );

  const [message,
    setMessage] =
      useState(`
Dear ${invoice?.full_name || "Member"},

Please find your invoice attached.

Invoice Number:
${invoice?.invoice_number || "--"}

Thank you.

Holy Trinity Finance Office
      `.trim()
      );

  const [includePdf,
    setIncludePdf] =
      useState(true);

  const [sendReminder,
    setSendReminder] =
      useState(false);

  /* =====================================================
     SEND
  ===================================================== */

  async function handleSend() {

    try {

      setSending(true);

      setError("");

      setSuccess("");

      await api.post(

        `/finance/invoices/${invoice.invoice_number}/send`,

        {
          email,

          subject,

          message,

          include_pdf:
            includePdf,

          reminder:
            sendReminder,
        }
      );

      setSuccess(
        "Invoice email successfully sent."
      );

      onSuccess?.();

    } catch (err) {

      console.error(err);

      setError(

        err?.response?.data
          ?.error ||

        "Unable to send invoice email."
      );

    } finally {

      setSending(false);
    }
  }

  /* =====================================================
     UI
  ===================================================== */

  if (
    !open ||
    !invoice
  ) {

    return null;
  }

  return (

    <div className="finance-modal-overlay">

      <div className="finance-email-modal">

        {/* =====================================
            HEADER
        ===================================== */}

        <div className="finance-modal-header">

          <div className="finance-email-title-wrap">

            <Mail size={18} />

            <div>

              <h2>
                Email Invoice
              </h2>

              <p>

                Enterprise billing
                communication and
                reminder system.

              </p>

            </div>

          </div>

          <button
            className="finance-modal-close"
            onClick={onClose}
          >

            ×

          </button>

        </div>

        {/* =====================================
            WARNING
        ===================================== */}

        <div className="finance-email-warning">

          <AlertTriangle size={16} />

          Invoice emails are
          tracked and logged
          for finance audit
          history.

        </div>

        {/* =====================================
            ALERTS
        ===================================== */}

        {error ? (

          <div className="finance-alert error">

            {error}

          </div>

        ) : null}

        {success ? (

          <div className="finance-alert success">

            {success}

          </div>

        ) : null}

        {/* =====================================
            BODY
        ===================================== */}

        <div className="finance-modal-body">

          {/* META */}

          <div className="finance-email-meta">

            <div>

              <label>
                Invoice #
              </label>

              <strong>

                {
                  invoice.invoice_number
                }

              </strong>

            </div>

            <div>

              <label>
                Member
              </label>

              <strong>

                {
                  invoice.full_name
                }

              </strong>

            </div>

          </div>

          {/* EMAIL */}

          <div className="finance-field">

            <label>
              Recipient Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
            />

          </div>

          {/* SUBJECT */}

          <div className="finance-field">

            <label>
              Subject
            </label>

            <input
              value={subject}
              onChange={(e) =>
                setSubject(
                  e.target.value
                )
              }
            />

          </div>

          {/* MESSAGE */}

          <div className="finance-field">

            <label>
              Message
            </label>

            <textarea
              rows="10"
              value={message}
              onChange={(e) =>
                setMessage(
                  e.target.value
                )
              }
            />

          </div>

          {/* OPTIONS */}

          <div className="finance-checkbox-row">

            <input
              type="checkbox"
              checked={includePdf}
              onChange={(e) =>
                setIncludePdf(
                  e.target.checked
                )
              }
            />

            <span>

              Attach PDF invoice

            </span>

          </div>

          <div className="finance-checkbox-row">

            <input
              type="checkbox"
              checked={
                sendReminder
              }
              onChange={(e) =>
                setSendReminder(
                  e.target.checked
                )
              }
            />

            <span>

              Mark as reminder /
              overdue notice

            </span>

          </div>

        </div>

        {/* =====================================
            FOOTER
        ===================================== */}

        <div className="finance-modal-footer">

          <button
            className="finance-btn secondary"
            onClick={onClose}
          >

            Cancel

          </button>

          <button
            className="finance-btn primary"
            onClick={
              handleSend
            }
            disabled={sending}
          >

            <Send size={16} />

            {sending
              ? "Sending..."
              : "Send Invoice"}

          </button>

        </div>

      </div>

    </div>
  );
}