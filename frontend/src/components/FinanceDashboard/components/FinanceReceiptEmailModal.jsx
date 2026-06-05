// frontend/src/components/FinanceDashboard/components/FinanceReceiptEmailModal.jsx

import React, {
  useState,
} from "react";

import {
  Mail,
  Send,
} from "lucide-react";

import api from "../../api";

import "../../../styles/finance-dashboard.css";


/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceReceiptEmailModal({
  open,

  row,

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
        row?.email || ""
      );

  const [message,
    setMessage] =
      useState(`
Dear ${row?.full_name || "Member"},

Attached is your payment receipt.

Thank you for your support and contribution.

Holy Trinity Finance Office
      `.trim()
      );

  /* =====================================================
     SEND
  ===================================================== */

  async function handleSend() {

    try {

      setSending(true);

      setError("");

      setSuccess("");

      await api.post(

        `/finance/receipts/${row.receipt_number}/send`,

        {
          email,

          message,
        }
      );

      setSuccess(
        "Receipt email successfully sent."
      );

      onSuccess?.();

    } catch (err) {

      console.error(err);

      setError(

        err?.response?.data
          ?.error ||

        "Unable to send receipt email."
      );

    } finally {

      setSending(false);
    }
  }

  /* =====================================================
     UI
  ===================================================== */

  if (!open || !row) {

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
                Send Receipt
              </h2>

              <p>

                Enterprise finance
                receipt delivery
                system.

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

          {/* RECEIPT */}

          <div className="finance-email-meta">

            <div>

              <label>
                Receipt #
              </label>

              <strong>

                {row.receipt_number}

              </strong>

            </div>

            <div>

              <label>
                Payment #
              </label>

              <strong>

                {row.payment_number}

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
              : "Send Receipt"}

          </button>

        </div>

      </div>

    </div>
  );
}