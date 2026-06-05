// frontend/src/components/FinanceDashboard/components/FinanceReconciliationPanel.jsx

import React, {
  useMemo,
  useState,
} from "react";

import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  Landmark,
  ArrowRightLeft,
  Download,
  Lock,
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

function formatDate(value) {

  if (!value) {

    return "--";
  }

  const d =
    new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {

    return "--";
  }

  return d.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceReconciliationPanel({

  rows = [],

  onMarkReconciled,

  onCreateAdjustment,

  onExport,

  onClosePeriod,
}) {

  /* =====================================================
     FILTER
  ===================================================== */

  const [activeTab,
    setActiveTab] =
      useState("all");

  /* =====================================================
     SUMMARY
  ===================================================== */

  const summary =
    useMemo(() => {

      const matched =
        rows.filter(
          (r) =>
            r.status ===
            "matched"
        );

      const unmatched =
        rows.filter(
          (r) =>
            r.status ===
            "unmatched"
        );

      const discrepancies =
        rows.filter(
          (r) =>
            r.status ===
            "discrepancy"
        );

      const refunds =
        rows.filter(
          (r) =>
            r.type ===
            "refund"
        );

      return {

        matchedCount:
          matched.length,

        matchedTotal:
          matched.reduce(
            (
              sum,
              r
            ) =>
              sum +
              Number(
                r.amount || 0
              ),
            0
          ),

        unmatchedCount:
          unmatched.length,

        discrepancyCount:
          discrepancies.length,

        refundCount:
          refunds.length,
      };

    }, [rows]);

  /* =====================================================
     FILTERED
  ===================================================== */

  const filteredRows =
    useMemo(() => {

      if (
        activeTab ===
        "all"
      ) {

        return rows;
      }

      return rows.filter(
        (r) =>
          r.status ===
          activeTab
      );

    }, [
      rows,
      activeTab,
    ]);

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="finance-reconciliation-panel">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="finance-reconciliation-head">

        <div className="finance-reconciliation-title">

          <ShieldCheck size={20} />

          <div>

            <h2>
              Reconciliation Center
            </h2>

            <p>

              Enterprise treasury
              balancing and
              reconciliation.

            </p>

          </div>

        </div>

        <div className="finance-reconciliation-actions">

          <button
            className="finance-btn secondary"
            onClick={onExport}
          >

            <Download size={16} />

            Export

          </button>

          <button
            className="finance-btn primary"
            onClick={
              onClosePeriod
            }
          >

            <Lock size={16} />

            Close Period

          </button>

        </div>

      </div>

      {/* =====================================
          KPI
      ===================================== */}

      <div className="finance-kpi-grid">

        <div className="finance-kpi-card">

          <span>
            Matched
          </span>

          <strong>

            {
              summary.matchedCount
            }

          </strong>

          <small>

            {money(
              summary.matchedTotal
            )}

          </small>

        </div>

        <div className="finance-kpi-card warning">

          <span>
            Unmatched
          </span>

          <strong>

            {
              summary.unmatchedCount
            }

          </strong>

        </div>

        <div className="finance-kpi-card danger">

          <span>
            Discrepancies
          </span>

          <strong>

            {
              summary.discrepancyCount
            }

          </strong>

        </div>

        <div className="finance-kpi-card">

          <span>
            Refunds
          </span>

          <strong>

            {
              summary.refundCount
            }

          </strong>

        </div>

      </div>

      {/* =====================================
          TABS
      ===================================== */}

      <div className="finance-reconciliation-tabs">

        {[
          "all",
          "matched",
          "unmatched",
          "discrepancy",
        ].map((tab) => (

          <button
            key={tab}
            type="button"
            className={
              activeTab === tab
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab(
                tab
              )
            }
          >

            {pretty(tab)}

          </button>
        ))}

      </div>

      {/* =====================================
          TABLE
      ===================================== */}

      <div className="finance-reconciliation-table-wrap">

        <table className="finance-reconciliation-table">

          <thead>

            <tr>

              <th>
                Type
              </th>

              <th>
                Source
              </th>

              <th>
                Payment #
              </th>

              <th>
                Amount
              </th>

              <th>
                Bank Amount
              </th>

              <th>
                Difference
              </th>

              <th>
                Status
              </th>

              <th>
                Date
              </th>

              <th />

            </tr>

          </thead>

          <tbody>

            {!filteredRows.length ? (

              <tr>

                <td
                  colSpan="9"
                  className="finance-empty-state"
                >

                  No reconciliation
                  records found.

                </td>

              </tr>

            ) : null}

            {filteredRows.map(
              (row) => {

                const difference =
                  Number(
                    row.bank_amount || 0
                  ) -
                  Number(
                    row.amount || 0
                  );

                return (

                  <tr
                    key={
                      row.id
                    }
                  >

                    <td>

                      <div className="finance-recon-type">

                        {row.type ===
                        "stripe" ? (

                          <CreditCardBadge />

                        ) : row.type ===
                          "cash" ? (

                          <Wallet size={16} />

                        ) : row.type ===
                          "bank" ? (

                          <Landmark size={16} />

                        ) : (

                          <ArrowRightLeft
                            size={16}
                          />
                        )}

                        <span>

                          {pretty(
                            row.type
                          )}

                        </span>

                      </div>

                    </td>

                    <td>

                      {pretty(
                        row.source
                      )}

                    </td>

                    <td>

                      {
                        row.payment_number
                      }

                    </td>

                    <td>

                      {money(
                        row.amount
                      )}

                    </td>

                    <td>

                      {money(
                        row.bank_amount
                      )}

                    </td>

                    <td className={
                      difference !== 0
                        ? "finance-difference"
                        : ""
                    }>

                      {money(
                        difference
                      )}

                    </td>

                    <td>

                      <StatusBadge
                        status={
                          row.status
                        }
                      />

                    </td>

                    <td>

                      {formatDate(
                        row.created_at
                      )}

                    </td>

                    <td>

                      <div className="finance-row-actions">

                        <button
                          className="finance-inline-btn"
                          onClick={() =>
                            onMarkReconciled?.(
                              row
                            )
                          }
                        >

                          Match

                        </button>

                        <button
                          className="finance-inline-btn"
                          onClick={() =>
                            onCreateAdjustment?.(
                              row
                            )
                          }
                        >

                          Adjust

                        </button>

                      </div>

                    </td>

                  </tr>
                );
              }
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}

/* =========================================================
   SUB COMPONENTS
========================================================= */

function StatusBadge({
  status,
}) {

  const value =
    String(status || "")
      .toLowerCase();

  return (

    <span className={`
      finance-status-badge
      ${value}
    `}>

      {pretty(status)}

    </span>
  );
}

function CreditCardBadge() {

  return (
    <div className="finance-recon-icon">

      💳

    </div>
  );
}