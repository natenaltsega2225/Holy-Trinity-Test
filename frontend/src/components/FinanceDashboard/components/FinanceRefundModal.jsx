// frontend/src/components/FinanceDashboard/components/FinanceRefundModal.jsx

import React, {
  useMemo,
  useState,
} from "react";

import api from "../../api";

import {
  RotateCcw,
  AlertTriangle,
  Receipt,
} from "lucide-react";


import "../../../styles/finance-dashboard.css";


/* =========================================================
   HELPERS
========================================================= */

function money(value) {

  return `$${Number(
    value || 0
  ).toLocaleString(undefined, {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  })}`;
}

function pretty(value) {

  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) =>
      c.toUpperCase()
    );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceRefundModal({

  open,

  row,

  onClose,

  onSuccess,
}) {

  /* =====================================================
     STATE
  ===================================================== */

  const [refundType,
    setRefundType] =
      useState("full");

  const [refundAmount,
    setRefundAmount] =
      useState(
        row?.amount || 0
      );

  const [reason,
    setReason] =
      useState("");

  const [reverseCoverage,
    setReverseCoverage] =
      useState(true);

  const [sendEmail,
    setSendEmail] =
      useState(true);

  const [loading,
    setLoading] =
      useState(false);

  const [error,
    setError] =
      useState("");

  const [success,
    setSuccess] =
      useState("");

  /* =====================================================
     COMPUTED
  ===================================================== */

  const maxRefund =
    useMemo(() => {

      return Number(
        row?.amount || 0
      );

    }, [row]);

  /* =====================================================
     SAVE
  ===================================================== */

  async function handleRefund() {

    try {

      setLoading(true);

      setError("");

      setSuccess("");

      await api.post(

        `/finance/payments/${row.id}/refund`,

        {
          refund_type:
            refundType,

          refund_amount:
            Number(
              refundAmount
            ),

          reverse_coverage:
            reverseCoverage,

          send_email:
            sendEmail,

          reason,
        }
      );

      setSuccess(
        "Refund successfully processed."
      );

      onSuccess?.();

    } catch (err) {

      console.error(err);

      setError(

        err?.response?.data
          ?.error ||

        "Unable to process refund."
      );

    } finally {

      setLoading(false);
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

      <div className="finance-refund-modal">

        {/* =====================================
            HEADER
        ===================================== */}

        <div className="finance-modal-header">

          <div className="finance-refund-title">

            <RotateCcw size={18} />

            <div>

              <h2>
                Refund Payment
              </h2>

              <p>

                Enterprise treasury
                refund processing.

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
            WARNING
        ===================================== */}

        <div className="finance-refund-warning">

          <AlertTriangle size={18} />

          <div>

            Refunds create reversing
            accounting entries and
            preserve audit history.

          </div>

        </div>

        {/* =====================================
            PAYMENT SUMMARY
        ===================================== */}

        <div className="finance-refund-summary">

          <div>

            <label>
              Payment #
            </label>

            <strong>

              {row.payment_number}

            </strong>

          </div>

          <div>

            <label>
              Receipt #
            </label>

            <strong>

              {row.receipt_number ||
                "--"}

            </strong>

          </div>

          <div>

            <label>
              Category
            </label>

            <strong>

              {pretty(
                row.category
              )}

            </strong>

          </div>

          <div>

            <label>
              Original Amount
            </label>

            <strong>

              {money(
                row.amount
              )}

            </strong>

          </div>

        </div>

        {/* =====================================
            REFUND TYPE
        ===================================== */}

        <div className="finance-field">

          <label>
            Refund Type
          </label>

          <select
            value={refundType}
            onChange={(e) =>
              setRefundType(
                e.target.value
              )
            }
          >

            <option value="full">
              Full Refund
            </option>

            <option value="partial">
              Partial Refund
            </option>

          </select>

        </div>

        {/* =====================================
            AMOUNT
        ===================================== */}

        <div className="finance-field">

          <label>
            Refund Amount
          </label>

          <input
            type="number"
            min="0"
            max={maxRefund}
            value={refundAmount}
            onChange={(e) =>
              setRefundAmount(
                e.target.value
              )
            }
          />

        </div>

        {/* =====================================
            MEMBERSHIP COVERAGE
        ===================================== */}

        {String(
          row.category
        ).toLowerCase() ===
        "membership" ? (

          <div className="finance-checkbox-row">

            <input
              type="checkbox"
              checked={
                reverseCoverage
              }
              onChange={(e) =>
                setReverseCoverage(
                  e.target.checked
                )
              }
            />

            <span>

              Reverse membership
              coverage months

            </span>

          </div>

        ) : null}

        {/* =====================================
            EMAIL
        ===================================== */}

        <div className="finance-checkbox-row">

          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) =>
              setSendEmail(
                e.target.checked
              )
            }
          />

          <span>

            Email refund receipt

          </span>

        </div>

        {/* =====================================
            REASON
        ===================================== */}

        <div className="finance-field">

          <label>
            Refund Reason
          </label>

          <textarea
            rows="5"
            value={reason}
            onChange={(e) =>
              setReason(
                e.target.value
              )
            }
            placeholder="
Refund explanation and treasury notes
            "
          />

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
            className="finance-btn danger"
            onClick={
              handleRefund
            }
            disabled={loading}
          >

            <Receipt size={16} />

            {loading
              ? "Processing..."
              : "Process Refund"}

          </button>

        </div>

      </div>

    </div>
  );
}