// frontend/src/components/FinanceDashboard/components/FinanceRestrictedFundsTable.jsx

import React, {
  useMemo,
  useState,
} from "react";

import {
  ShieldCheck,
  AlertTriangle,
  Landmark,
  Wallet,
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

export default function FinanceRestrictedFundsTable({
  rows = [],
  onAllocate,
  onTransfer,
  onView,
}) {
  const [filter, setFilter] =
    useState("all");

  /* =====================================================
     FILTERED
  ===================================================== */

  const filteredRows =
    useMemo(() => {

      if (
        filter === "all"
      ) {
        return rows;
      }

      return rows.filter(
        (r) =>
          r.restriction_type ===
          filter
      );

    }, [rows, filter]);

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="finance-restricted-panel">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="finance-section-head">

        <div>

          <h2>
            Restricted Funds
          </h2>

          <p>

            Designated nonprofit
            fund tracking and
            treasury allocation.

          </p>

        </div>

      </div>

      {/* =====================================
          FILTERS
      ===================================== */}

      <div className="finance-fund-filters">

        {[
          "all",
          "building",
          "mission",
          "scholarship",
          "charity",
          "memorial",
        ].map((type) => (

          <button
            key={type}
            className={
              filter === type
                ? "active"
                : ""
            }
            onClick={() =>
              setFilter(type)
            }
          >

            {pretty(type)}

          </button>
        ))}

      </div>

      {/* =====================================
          TABLE
      ===================================== */}

      <div className="finance-table-wrap">

        <table className="finance-table">

          <thead>

            <tr>

              <th>
                Fund
              </th>

              <th>
                Restriction
              </th>

              <th>
                Balance
              </th>

              <th>
                Allocated
              </th>

              <th>
                Available
              </th>

              <th>
                Status
              </th>

              <th />

            </tr>

          </thead>

          <tbody>

            {!filteredRows.length ? (

              <tr>

                <td
                  colSpan="7"
                  className="finance-empty-state"
                >

                  No restricted
                  funds found.

                </td>

              </tr>

            ) : null}

            {filteredRows.map(
              (row) => {

                const available =
                  Number(
                    row.balance || 0
                  ) -
                  Number(
                    row.allocated_amount || 0
                  );

                return (

                  <tr key={row.id}>

                    <td>

                      <div className="finance-member-cell">

                        <strong>

                          {
                            row.fund_name
                          }

                        </strong>

                        <span>

                          {
                            row.description
                          }

                        </span>

                      </div>

                    </td>

                    <td>

                      <span className="finance-status-badge restricted">

                        <Landmark
                          size={14}
                        />

                        {pretty(
                          row.restriction_type
                        )}

                      </span>

                    </td>

                    <td>

                      {money(
                        row.balance
                      )}

                    </td>

                    <td>

                      {money(
                        row.allocated_amount
                      )}

                    </td>

                    <td>

                      {money(
                        available
                      )}

                    </td>

                    <td>

                      {available <= 0 ? (

                        <span className="finance-status-badge danger">

                          <AlertTriangle
                            size={14}
                          />

                          Exhausted

                        </span>

                      ) : (

                        <span className="finance-status-badge active">

                          <ShieldCheck
                            size={14}
                          />

                          Available

                        </span>

                      )}

                    </td>

                    <td>

                      <div className="finance-row-actions">

                        <button
                          className="finance-inline-btn"
                          onClick={() =>
                            onView?.(
                              row
                            )
                          }
                        >

                          View

                        </button>

                        <button
                          className="finance-inline-btn"
                          onClick={() =>
                            onAllocate?.(
                              row
                            )
                          }
                        >

                          Allocate

                        </button>

                        <button
                          className="finance-inline-btn"
                          onClick={() =>
                            onTransfer?.(
                              row
                            )
                          }
                        >

                          Transfer

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

      {/* =====================================
          NOTICE
      ===================================== */}

      <div className="finance-warning-box">

        <Wallet size={16} />

        Restricted funds must
        only be used for their
        designated nonprofit or
        church purpose.

      </div>

    </div>
  );
}