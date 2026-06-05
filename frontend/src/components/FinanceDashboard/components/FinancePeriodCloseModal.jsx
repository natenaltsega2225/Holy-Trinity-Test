// frontend/src/components/FinanceDashboard/components/FinancePeriodCloseModal.jsx

import React, {
  useMemo,
  useState,
} from "react";

import api from "../../api";

import {
  Lock,
  ShieldCheck,
  AlertTriangle,
  Download,
  CheckCircle2,
  FileText,
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

/* =========================================================
   COMPONENT
========================================================= */

export default function FinancePeriodCloseModal({

  open,

  periodSummary = {},

  validation = {},

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

  const [closeNotes,
    setCloseNotes] =
      useState("");

  const [generateSnapshot,
    setGenerateSnapshot] =
      useState(true);

  const [exportReports,
    setExportReports] =
      useState(true);

  const [lockTransactions,
    setLockTransactions] =
      useState(true);

  /* =====================================================
     VALIDATION
  ===================================================== */

  const validationIssues =
    useMemo(() => {

      const issues = [];

      if (
        Number(
          validation.unreconciled_count || 0
        ) > 0
      ) {

        issues.push(
          "Unreconciled transactions exist."
        );
      }

      if (
        Number(
          validation.failed_receipt_emails || 0
        ) > 0
      ) {

        issues.push(
          "Failed receipt emails detected."
        );
      }

      if (
        Number(
          validation.orphan_invoices || 0
        ) > 0
      ) {

        issues.push(
          "Orphan invoices detected."
        );
      }

      if (
        Number(
          validation.negative_balances || 0
        ) > 0
      ) {

        issues.push(
          "Negative balances detected."
        );
      }

      return issues;

    }, [validation]);

  /* =====================================================
     CLOSE PERIOD
  ===================================================== */

  async function handleClosePeriod() {

    try {

      setLoading(true);

      setError("");

      setSuccess("");

      await api.post(

        "/finance/period-close",

        {
          close_notes:
            closeNotes,

          generate_snapshot:
            generateSnapshot,

          export_reports:
            exportReports,

          lock_transactions:
            lockTransactions,
        }
      );

      setSuccess(
        "Accounting period successfully closed."
      );

      onSuccess?.();

    } catch (err) {

      console.error(err);

      setError(

        err?.response?.data
          ?.error ||

        "Unable to close accounting period."
      );

    } finally {

      setLoading(false);
    }
  }

  /* =====================================================
     UI
  ===================================================== */

  if (!open) {

    return null;
  }

  return (

    <div className="finance-modal-overlay">

      <div className="finance-period-close-modal">

        {/* =====================================
            HEADER
        ===================================== */}

        <div className="finance-modal-header">

          <div className="finance-period-close-title">

            <Lock size={18} />

            <div>

              <h2>
                Accounting Period Close
              </h2>

              <p>

                Enterprise financial
                governance and
                treasury period lock.

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
            GOVERNANCE WARNING
        ===================================== */}

        <div className="finance-period-warning">

          <ShieldCheck size={18} />

          Closing a period locks
          accounting transactions
          and preserves audit
          snapshots.

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
            PERIOD SUMMARY
        ===================================== */}

        <div className="finance-period-summary">

          <div className="finance-summary-box">

            <span>
              Total Payments
            </span>

            <strong>

              {money(
                periodSummary.total_payments
              )}

            </strong>

          </div>

          <div className="finance-summary-box">

            <span>
              Donations
            </span>

            <strong>

              {money(
                periodSummary.total_donations
              )}

            </strong>

          </div>

          <div className="finance-summary-box">

            <span>
              Refunds
            </span>

            <strong>

              {money(
                periodSummary.total_refunds
              )}

            </strong>

          </div>

          <div className="finance-summary-box">

            <span>
              Discrepancies
            </span>

            <strong>

              {
                periodSummary.discrepancy_count || 0
              }

            </strong>

          </div>

        </div>

        {/* =====================================
            VALIDATION
        ===================================== */}

        <div className="finance-period-section">

          <div className="finance-period-section-title">

            <AlertTriangle size={16} />

            <span>
              Validation Checks
            </span>

          </div>

          {!validationIssues.length ? (

            <div className="finance-validation-success">

              <CheckCircle2 size={18} />

              No validation issues
              detected.

            </div>

          ) : (

            <div className="finance-validation-list">

              {validationIssues.map(
                (
                  issue,
                  index
                ) => (

                  <div
                    key={index}
                    className="finance-validation-item"
                  >

                    <AlertTriangle
                      size={14}
                    />

                    <span>

                      {issue}

                    </span>

                  </div>
                )
              )}

            </div>

          )}

        </div>

        {/* =====================================
            OPTIONS
        ===================================== */}

        <div className="finance-period-section">

          <div className="finance-period-section-title">

            <FileText size={16} />

            <span>
              Close Options
            </span>

          </div>

          <div className="finance-checkbox-row">

            <input
              type="checkbox"
              checked={
                generateSnapshot
              }
              onChange={(e) =>
                setGenerateSnapshot(
                  e.target.checked
                )
              }
            />

            <span>

              Generate audit
              snapshot

            </span>

          </div>

          <div className="finance-checkbox-row">

            <input
              type="checkbox"
              checked={
                exportReports
              }
              onChange={(e) =>
                setExportReports(
                  e.target.checked
                )
              }
            />

            <span>

              Export treasury
              reports

            </span>

          </div>

          <div className="finance-checkbox-row">

            <input
              type="checkbox"
              checked={
                lockTransactions
              }
              onChange={(e) =>
                setLockTransactions(
                  e.target.checked
                )
              }
            />

            <span>

              Lock transactions
              after close

            </span>

          </div>

        </div>

        {/* =====================================
            NOTES
        ===================================== */}

        <div className="finance-field">

          <label>
            Treasury Notes
          </label>

          <textarea
            rows="6"
            value={closeNotes}
            onChange={(e) =>
              setCloseNotes(
                e.target.value
              )
            }
            placeholder="
Month-end or year-end treasury notes and auditor comments
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
            className="finance-btn secondary"
            type="button"
          >

            <Download size={16} />

            Export Reports

          </button>

          <button
            className="finance-btn primary"
            onClick={
              handleClosePeriod
            }
            disabled={loading}
          >

            <Lock size={16} />

            {loading
              ? "Closing..."
              : "Close Period"}

          </button>

        </div>

      </div>

    </div>
  );
}