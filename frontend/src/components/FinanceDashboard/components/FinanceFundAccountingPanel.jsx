// frontend/src/components/FinanceDashboard/components/FinanceFundAccountingPanel.jsx

import React, {
  useMemo,
  useState,
} from "react";

import {
  Landmark,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Download,
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

export default function FinanceFundAccountingPanel({
  rows = [],
  transactions = [],
  onExport,
  onViewFund,
}) {
  const [activeType, setActiveType] =
    useState("all");

  /* =====================================================
     FILTERED FUNDS
  ===================================================== */

  const filteredRows =
    useMemo(() => {

      if (
        activeType === "all"
      ) {
        return rows;
      }

      return rows.filter(
        (r) =>
          r.fund_type ===
          activeType
      );

    }, [rows, activeType]);

  /* =====================================================
     KPI
  ===================================================== */

  const summary =
    useMemo(() => {

      const restricted =
        rows
          .filter(
            (r) =>
              r.fund_type ===
              "restricted"
          )
          .reduce(
            (sum, r) =>
              sum +
              Number(
                r.current_balance || 0
              ),
            0
          );

      const unrestricted =
        rows
          .filter(
            (r) =>
              r.fund_type ===
              "unrestricted"
          )
          .reduce(
            (sum, r) =>
              sum +
              Number(
                r.current_balance || 0
              ),
            0
          );

      const income =
        transactions
          .filter(
            (t) =>
              t.entry_type ===
              "income"
          )
          .reduce(
            (sum, t) =>
              sum +
              Number(
                t.amount || 0
              ),
            0
          );

      const expense =
        transactions
          .filter(
            (t) =>
              t.entry_type ===
              "expense"
          )
          .reduce(
            (sum, t) =>
              sum +
              Number(
                t.amount || 0
              ),
            0
          );

      return {
        restricted,
        unrestricted,
        income,
        expense,
      };

    }, [
      rows,
      transactions,
    ]);

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="finance-fund-panel">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="finance-fund-head">

        <div className="finance-fund-title">

          <Landmark size={20} />

          <div>

            <h2>
              Fund Accounting
            </h2>

            <p>

              Enterprise nonprofit
              treasury and fund
              separation accounting.

            </p>

          </div>

        </div>

        <button
          className="finance-btn primary"
          onClick={onExport}
        >

          <Download size={16} />

          Export Report

        </button>

      </div>

      {/* =====================================
          KPI
      ===================================== */}

      <div className="finance-kpi-grid">

        <div className="finance-kpi-card">

          <span>
            Restricted Funds
          </span>

          <strong>

            {money(
              summary.restricted
            )}

          </strong>

        </div>

        <div className="finance-kpi-card">

          <span>
            Unrestricted Funds
          </span>

          <strong>

            {money(
              summary.unrestricted
            )}

          </strong>

        </div>

        <div className="finance-kpi-card success">

          <span>
            Income
          </span>

          <strong>

            {money(
              summary.income
            )}

          </strong>

        </div>

        <div className="finance-kpi-card danger">

          <span>
            Expenses
          </span>

          <strong>

            {money(
              summary.expense
            )}

          </strong>

        </div>

      </div>

      {/* =====================================
          FILTERS
      ===================================== */}

      <div className="finance-fund-filters">

        {[
          "all",
          "restricted",
          "unrestricted",
        ].map((type) => (

          <button
            key={type}
            className={
              activeType === type
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveType(type)
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
                Fund Name
              </th>

              <th>
                Type
              </th>

              <th>
                Current Balance
              </th>

              <th>
                Income
              </th>

              <th>
                Expense
              </th>

              <th>
                Net
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
                  colSpan="8"
                  className="finance-empty-state"
                >

                  No funds found.

                </td>

              </tr>

            ) : null}

            {filteredRows.map(
              (row) => {

                const net =
                  Number(
                    row.total_income || 0
                  ) -
                  Number(
                    row.total_expense || 0
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

                      <span className={`
                        finance-status-badge
                        ${row.fund_type}
                      `}>

                        {pretty(
                          row.fund_type
                        )}

                      </span>

                    </td>

                    <td>

                      {money(
                        row.current_balance
                      )}

                    </td>

                    <td className="finance-text-success">

                      <ArrowUpRight
                        size={14}
                      />

                      {money(
                        row.total_income
                      )}

                    </td>

                    <td className="finance-text-danger">

                      <ArrowDownRight
                        size={14}
                      />

                      {money(
                        row.total_expense
                      )}

                    </td>

                    <td>

                      {money(net)}

                    </td>

                    <td>

                      <span className="finance-status-badge active">

                        <ShieldCheck
                          size={14}
                        />

                        Active

                      </span>

                    </td>

                    <td>

                      <button
                        className="finance-inline-btn"
                        onClick={() =>
                          onViewFund?.(
                            row
                          )
                        }
                      >

                        View

                      </button>

                    </td>

                  </tr>
                );
              }
            )}

          </tbody>

        </table>

      </div>

      {/* =====================================
          RECENT TRANSACTIONS
      ===================================== */}

      <div className="finance-fund-transactions">

        <div className="finance-section-head">

          <h3>
            Recent Fund Transactions
          </h3>

        </div>

        <table className="finance-table">

          <thead>

            <tr>

              <th>
                Fund
              </th>

              <th>
                Type
              </th>

              <th>
                Description
              </th>

              <th>
                Amount
              </th>

              <th>
                Date
              </th>

            </tr>

          </thead>

          <tbody>

            {!transactions.length ? (

              <tr>

                <td
                  colSpan="5"
                  className="finance-empty-state"
                >

                  No transactions found.

                </td>

              </tr>

            ) : null}

            {transactions.map(
              (tx) => (

                <tr key={tx.id}>

                  <td>
                    {
                      tx.fund_name
                    }
                  </td>

                  <td>

                    <span className={`
                      finance-status-badge
                      ${tx.entry_type}
                    `}>

                      {pretty(
                        tx.entry_type
                      )}

                    </span>

                  </td>

                  <td>
                    {
                      tx.description
                    }
                  </td>

                  <td>

                    {money(
                      tx.amount
                    )}

                  </td>

                  <td>

                    {new Date(
                      tx.created_at
                    ).toLocaleDateString()}

                  </td>

                </tr>
              )
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}