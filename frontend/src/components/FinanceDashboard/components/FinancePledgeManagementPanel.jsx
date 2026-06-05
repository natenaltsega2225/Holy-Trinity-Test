// frontend/src/components/FinanceDashboard/components/FinancePledgeManagementPanel.jsx

import React, {
  useMemo,
  useState,
} from "react";

import {
  Landmark,
  Plus,
  Send,
  Download,
  CheckCircle2,
  AlertTriangle,
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

export default function FinancePledgeManagementPanel({
  rows = [],
  onCreatePledge,
  onApplyPayment,
  onReminder,
  onExport,
}) {
  const summary =
    useMemo(() => {

      const pledged =
        rows.reduce(
          (sum, r) =>
            sum +
            Number(
              r.pledged_amount || 0
            ),
          0
        );

      const paid =
        rows.reduce(
          (sum, r) =>
            sum +
            Number(
              r.paid_amount || 0
            ),
          0
        );

      return {
        pledged,
        paid,
        remaining:
          pledged - paid,
      };

    }, [rows]);

  return (
    <div className="finance-pledge-panel">

      {/* HEADER */}

      <div className="finance-pledge-head">

        <div className="finance-pledge-title">

          <Landmark size={20} />

          <div>

            <h2>
              Pledge Management
            </h2>

            <p>

              Member and non-member
              pledge commitment and
              payment tracking.

            </p>

          </div>

        </div>

        <div className="finance-pledge-actions">

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
              onCreatePledge
            }
          >

            <Plus size={16} />

            Create Pledge

          </button>

        </div>

      </div>

      {/* KPI */}

      <div className="finance-kpi-grid">

        <div className="finance-kpi-card">

          <span>
            Total Pledged
          </span>

          <strong>
            {money(
              summary.pledged
            )}
          </strong>

        </div>

        <div className="finance-kpi-card">

          <span>
            Total Paid
          </span>

          <strong>
            {money(
              summary.paid
            )}
          </strong>

        </div>

        <div className="finance-kpi-card">

          <span>
            Remaining
          </span>

          <strong>
            {money(
              summary.remaining
            )}
          </strong>

        </div>

      </div>

      {/* TABLE */}

      <table className="finance-pledge-table">

        <thead>

          <tr>

            <th>
              Donor
            </th>

            <th>
              Campaign
            </th>

            <th>
              Type
            </th>

            <th>
              Pledged
            </th>

            <th>
              Paid
            </th>

            <th>
              Remaining
            </th>

            <th>
              Status
            </th>

            <th />

          </tr>

        </thead>

        <tbody>

          {!rows.length ? (
            <tr>

              <td
                colSpan="8"
                className="finance-empty-state"
              >

                No pledges found.

              </td>

            </tr>
          ) : null}

          {rows.map(
            (row) => {

              const remaining =
                Number(
                  row.pledged_amount || 0
                ) -
                Number(
                  row.paid_amount || 0
                );

              return (
                <tr
                  key={row.id}
                >

                  <td>

                    <div className="finance-pledge-donor">

                      <strong>

                        {
                          row.full_name
                        }

                      </strong>

                      <span>

                        {row.member_no ||
                          "Non Member"}

                      </span>

                    </div>

                  </td>

                  <td>
                    {pretty(
                      row.campaign_name
                    )}
                  </td>

                  <td>

                    {row.pay_now
                      ? "Paid Now"
                      : "Promise To Pay"}

                  </td>

                  <td>
                    {money(
                      row.pledged_amount
                    )}
                  </td>

                  <td>
                    {money(
                      row.paid_amount
                    )}
                  </td>

                  <td>
                    {money(
                      remaining
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

                    <div className="finance-row-actions">

                      {remaining >
                      0 ? (

                        <button
                          className="finance-inline-btn"
                          onClick={() =>
                            onApplyPayment?.(
                              row
                            )
                          }
                        >

                          Apply Payment

                        </button>

                      ) : null}

                      <button
                        className="finance-inline-btn"
                        onClick={() =>
                          onReminder?.(
                            row
                          )
                        }
                      >

                        <Send
                          size={14}
                        />

                        Reminder

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
  );
}

/* =========================================================
   STATUS
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

      {value ===
      "completed" ? (

        <CheckCircle2
          size={14}
        />

      ) : (

        <AlertTriangle
          size={14}
        />

      )}

      {pretty(status)}

    </span>
  );
}