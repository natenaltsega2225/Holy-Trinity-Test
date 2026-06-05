// frontend/src/components/FinanceDashboard/components/FinanceLedgerReconciliationPanel.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  Landmark,
  CreditCard,
  Wallet,
  Building2,
  Download,
  Search,
} from "lucide-react";

import FinanceBadge from "../../Shared/FinanceBadge";

import "../../../styles/shared-payment-components.css";
// import "../finance-dashboard.css";

function money(value) {
  return Number(value || 0).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  );
}

function pretty(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) =>
      m.toUpperCase()
    );
}

function formatDate(value) {
  if (!value) return "--";

  return new Date(value).toLocaleDateString();
}

export default function FinanceLedgerReconciliationPanel() {

  const [loading, setLoading] =
    useState(false);

  const [rows, setRows] =
    useState([]);

  const [summary, setSummary] =
    useState(null);

  const [filters, setFilters] =
    useState({
      search: "",
      reconciliation_status:
        "pending",
      entry_type: "",
      date_from: "",
      date_to: "",
    });

  async function loadData() {

    try {

      setLoading(true);

      const params =
        new URLSearchParams();

      Object.entries(filters)
        .forEach(([k, v]) => {

          if (
            v !== undefined &&
            v !== null &&
            String(v).trim() !== ""
          ) {

            params.append(k, v);
          }
        });

      params.append(
        "limit",
        "250"
      );

      const res =
        await fetch(
          `/api/finance/ledger?${params.toString()}`,
          {
            credentials:
              "include",
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "Failed to load reconciliation data."
        );
      }

      setRows(
        data.rows || []
      );

      setSummary(
        data.summary || null
      );

    } catch (err) {

      console.error(err);

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function reconcileRow(
    row
  ) {

    const batch =
      window.prompt(
        "Enter reconciliation batch/reference:"
      );

    if (batch === null)
      return;

    await fetch(
      `/api/finance/ledger/${row.id}/reconcile`,
      {
        method: "POST",

        credentials:
          "include",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            reconciliation_batch:
              batch,
          }),
      }
    );

    loadData();
  }

  async function unreconcileRow(
    row
  ) {

    await fetch(
      `/api/finance/ledger/${row.id}/unreconcile`,
      {
        method: "POST",
        credentials:
          "include",
      }
    );

    loadData();
  }

  const totals =
    useMemo(() => {

      const credits =
        rows.reduce(
          (
            sum,
            row
          ) =>
            sum +
            Number(
              row.credit_amount || 0
            ),
          0
        );

      const debits =
        rows.reduce(
          (
            sum,
            row
          ) =>
            sum +
            Number(
              row.debit_amount || 0
            ),
          0
        );

      const matched =
        rows.filter(
          (r) =>
            String(
              r.reconciliation_status || ""
            ).toLowerCase() ===
            "matched"
        ).length;

      const pending =
        rows.filter(
          (r) =>
            String(
              r.reconciliation_status || ""
            ).toLowerCase() !==
            "matched"
        ).length;

      return {
        credits,
        debits,
        matched,
        pending,
      };

    }, [rows]);

  return (
    <div className="finance-enterprise-page">

      <div className="finance-page-header">

        <div>

          <h1>
            Ledger
            Reconciliation
          </h1>

          <p>
            Enterprise
            accounting
            reconciliation
            center for
            bank, Stripe,
            Zelle, cash,
            and finance
            ledger matching.
          </p>

        </div>

        <div className="finance-header-actions">

          <button
            className="finance-btn finance-btn-secondary"
            onClick={
              loadData
            }
          >
            <RefreshCcw
              size={16}
            />

            Refresh
          </button>

          <button
            className="finance-btn finance-btn-primary"
            onClick={() =>
              window.open(
                "/api/finance/ledger/export",
                "_blank"
              )
            }
          >
            <Download
              size={16}
            />

            Export
          </button>

        </div>

      </div>

      <div className="finance-summary-grid">

        <div className="finance-summary-card finance-summary-card-primary">
          <span>
            Total Credits
          </span>

          <strong>
            {money(
              totals.credits
            )}
          </strong>
        </div>

        <div className="finance-summary-card">
          <span>
            Total Debits
          </span>

          <strong>
            {money(
              totals.debits
            )}
          </strong>
        </div>

        <div className="finance-summary-card finance-summary-card-success">
          <span>
            Matched
            Entries
          </span>

          <strong>
            {
              totals.matched
            }
          </strong>
        </div>

        <div className="finance-summary-card finance-summary-card-warning">
          <span>
            Pending
            Reconciliation
          </span>

          <strong>
            {
              totals.pending
            }
          </strong>
        </div>

      </div>

      <div className="finance-section-card">

        <div className="finance-section-title">

          <Search size={16} />

          <span>
            Reconciliation
            Filters
          </span>

        </div>

        <div className="finance-grid finance-grid-5">

          <div className="finance-field">
            <label>
              Search
            </label>

            <input
              value={
                filters.search
              }
              onChange={(e) =>
                setFilters(
                  (
                    prev
                  ) => ({
                    ...prev,
                    search:
                      e.target
                        .value,
                  })
                )
              }
            />
          </div>

          <div className="finance-field">
            <label>
              Status
            </label>

            <select
              value={
                filters.reconciliation_status
              }
              onChange={(e) =>
                setFilters(
                  (
                    prev
                  ) => ({
                    ...prev,
                    reconciliation_status:
                      e.target
                        .value,
                  })
                )
              }
            >
              <option value="">
                All
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="matched">
                Matched
              </option>
            </select>
          </div>

          <div className="finance-field">
            <label>
              Entry Type
            </label>

            <select
              value={
                filters.entry_type
              }
              onChange={(e) =>
                setFilters(
                  (
                    prev
                  ) => ({
                    ...prev,
                    entry_type:
                      e.target
                        .value,
                  })
                )
              }
            >
              <option value="">
                All
              </option>

              <option value="payment">
                Payment
              </option>

              <option value="donation">
                Donation
              </option>

              <option value="membership">
                Membership
              </option>

              <option value="refund">
                Refund
              </option>

              <option value="adjustment">
                Adjustment
              </option>
            </select>
          </div>

          <div className="finance-field">
            <label>
              From
            </label>

            <input
              type="date"
              value={
                filters.date_from
              }
              onChange={(e) =>
                setFilters(
                  (
                    prev
                  ) => ({
                    ...prev,
                    date_from:
                      e.target
                        .value,
                  })
                )
              }
            />
          </div>

          <div className="finance-field">
            <label>
              To
            </label>

            <input
              type="date"
              value={
                filters.date_to
              }
              onChange={(e) =>
                setFilters(
                  (
                    prev
                  ) => ({
                    ...prev,
                    date_to:
                      e.target
                        .value,
                  })
                )
              }
            />
          </div>

        </div>

        <div className="finance-toolbar-actions">

          <button
            className="finance-btn finance-btn-primary"
            onClick={
              loadData
            }
          >
            Apply
            Filters
          </button>

        </div>

      </div>

      <div className="finance-section-card">

        <div className="finance-section-title">

          <Landmark size={16} />

          <span>
            Reconciliation
            Queue
          </span>

        </div>

        <div className="finance-table-wrap">

          <table className="finance-table">

            <thead>

              <tr>

                <th>
                  Date
                </th>

                <th>
                  Entry
                </th>

                <th>
                  Member
                </th>

                <th>
                  Payment
                </th>

                <th>
                  Invoice
                </th>

                <th>
                  Receipt
                </th>

                <th>
                  Debit
                </th>

                <th>
                  Credit
                </th>

                <th>
                  Source
                </th>

                <th>
                  Reconciliation
                </th>

                <th>
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {loading && (
                <tr>
                  <td
                    colSpan="11"
                    className="finance-empty-cell"
                  >
                    Loading...
                  </td>
                </tr>
              )}

              {!loading &&
                rows.length === 0 && (
                  <tr>
                    <td
                      colSpan="11"
                      className="finance-empty-cell"
                    >
                      No
                      ledger
                      entries
                      found.
                    </td>
                  </tr>
                )}

              {!loading &&
                rows.map(
                  (
                    row
                  ) => {

                    const matched =
                      String(
                        row.reconciliation_status || ""
                      ).toLowerCase() ===
                      "matched";

                    return (
                      <tr
                        key={
                          row.id
                        }
                      >

                        <td>
                          {formatDate(
                            row.record_date
                          )}
                        </td>

                        <td>
                          <div className="finance-cell-stack">
                            <strong>
                              {row.ledger_uuid ||
                                row.ledger_number}
                            </strong>

                            <span>
                              {pretty(
                                row.entry_type
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          {row.full_name_snapshot ||
                            "--"}
                        </td>

                        <td>
                          {row.payment_number ||
                            "--"}
                        </td>

                        <td>
                          {row.invoice_number ||
                            "--"}
                        </td>

                        <td>
                          {row.receipt_number ||
                            "--"}
                        </td>

                        <td>
                          {money(
                            row.debit_amount
                          )}
                        </td>

                        <td>
                          {money(
                            row.credit_amount
                          )}
                        </td>

                        <td>

                          <div className="finance-inline-icon">

                            {row.source ===
                            "stripe" ? (
                              <CreditCard
                                size={14}
                              />
                            ) : row.source ===
                              "cash" ? (
                              <Wallet
                                size={14}
                              />
                            ) : row.source ===
                              "bank" ? (
                              <Building2
                                size={14}
                              />
                            ) : (
                              <Landmark
                                size={14}
                              />
                            )}

                            <span>
                              {pretty(
                                row.source
                              )}
                            </span>

                          </div>

                        </td>

                        <td>

                          <FinanceBadge
                            label={pretty(
                              row.reconciliation_status ||
                                "pending"
                            )}
                            type={
                              matched
                                ? "success"
                                : "warning"
                            }
                          />

                        </td>

                        <td>

                          <div className="finance-row-actions">

                            {!matched && (
                              <button
                                className="finance-btn finance-btn-xs finance-btn-success"
                                onClick={() =>
                                  reconcileRow(
                                    row
                                  )
                                }
                              >
                                <CheckCircle2
                                  size={
                                    14
                                  }
                                />

                                Match
                              </button>
                            )}

                            {matched && (
                              <button
                                className="finance-btn finance-btn-xs finance-btn-warning"
                                onClick={() =>
                                  unreconcileRow(
                                    row
                                  )
                                }
                              >
                                <AlertTriangle
                                  size={
                                    14
                                  }
                                />

                                Unmatch
                              </button>
                            )}

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

    </div>
  );
}