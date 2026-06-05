// frontend/src/components/FinanceDashboard/components/FinanceAdjustmentModal.jsx

import React, {
  useState,
} from "react";

import api from "../../api";

import {
  Calculator,
  AlertTriangle,
  Save,
} from "lucide-react";

// import "../finance-dashboard.css";

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

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceAdjustmentModal({

  open,

  row,

  onClose,

  onSuccess,
}) {

  /* =====================================================
     STATE
  ===================================================== */

  const [loading,
    setLoading] =
      useState(false);

  const [error,
    setError] =
      useState("");

  const [success,
    setSuccess] =
      useState("");

  const [adjustmentType,
    setAdjustmentType] =
      useState(
        "credit"
      );

  const [amount,
    setAmount] =
      useState(
        row?.difference || 0
      );

  const [reason,
    setReason] =
      useState("");

  const [notes,
    setNotes] =
      useState("");

  /* =====================================================
     SAVE
  ===================================================== */

  async function handleSave() {

    try {

      setLoading(true);

      setError("");

      setSuccess("");

      await api.post(

        "/finance/reconciliation/adjustments",

        {
          reconciliation_id:
            row?.id,

          adjustment_type:
            adjustmentType,

          amount:
            Number(amount),

          reason,

          notes,
        }
      );

      setSuccess(
        "Adjustment successfully created."
      );

      onSuccess?.();

    } catch (err) {

      console.error(err);

      setError(

        err?.response?.data
          ?.error ||

        "Unable to create adjustment."
      );

    } finally {

      setLoading(false);
    }
  }

  /* =====================================================
     UI
  ===================================================== */

  if (
    !open ||
    !row
  ) {

    return null;
  }

  return (

    <div className="finance-modal-overlay">

      <div className="finance-adjustment-modal">

        {/* =====================================
            HEADER
        ===================================== */}

        <div className="finance-modal-header">

          <div className="finance-adjustment-title">

            <Calculator size={18} />

            <div>

              <h2>
                Reconciliation Adjustment
              </h2>

              <p>

                Enterprise treasury
                balancing and
                correction entry.

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

        <div className="finance-adjustment-warning">

          <AlertTriangle size={16} />

          Adjustments create
          permanent accounting
          audit entries and do
          not modify original
          transactions.

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
            SUMMARY
        ===================================== */}

        <div className="finance-adjustment-summary">

          <div>

            <label>
              Payment #
            </label>

            <strong>

              {
                row.payment_number
              }

            </strong>

          </div>

          <div>

            <label>
              Current Difference
            </label>

            <strong>

              {money(
                row.difference
              )}

            </strong>

          </div>

        </div>

        {/* =====================================
            TYPE
        ===================================== */}

        <div className="finance-field">

          <label>
            Adjustment Type
          </label>

          <select
            value={
              adjustmentType
            }
            onChange={(e) =>
              setAdjustmentType(
                e.target.value
              )
            }
          >

            <option value="credit">
              Credit Adjustment
            </option>

            <option value="debit">
              Debit Adjustment
            </option>

          </select>

        </div>

        {/* =====================================
            AMOUNT
        ===================================== */}

        <div className="finance-field">

          <label>
            Adjustment Amount
          </label>

          <input
            type="number"
            value={amount}
            onChange={(e) =>
              setAmount(
                e.target.value
              )
            }
          />

        </div>

        {/* =====================================
            REASON
        ===================================== */}

        <div className="finance-field">

          <label>
            Adjustment Reason
          </label>

          <input
            value={reason}
            onChange={(e) =>
              setReason(
                e.target.value
              )
            }
            placeholder="
Treasury correction reason
            "
          />

        </div>

        {/* =====================================
            NOTES
        ===================================== */}

        <div className="finance-field">

          <label>
            Audit Notes
          </label>

          <textarea
            rows="6"
            value={notes}
            onChange={(e) =>
              setNotes(
                e.target.value
              )
            }
            placeholder="
Accounting explanation and reconciliation notes
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
            className="finance-btn primary"
            onClick={
              handleSave
            }
            disabled={loading}
          >

            <Save size={16} />

            {loading
              ? "Saving..."
              : "Create Adjustment"}

          </button>

        </div>

      </div>

    </div>
  );
}