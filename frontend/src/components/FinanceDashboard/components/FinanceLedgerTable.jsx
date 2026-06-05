// frontend/src/components/FinanceDashboard/components/FinanceLedgerTable.jsx

import React, {
  useMemo,
  useState,
} from "react";

import {
  ChevronDown,
  ChevronUp,
  Eye,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Receipt,
  CreditCard,
} from "lucide-react";

import FinanceBadge from "../../Shared/FinanceBadge";

import "../../../styles/shared-payment-components.css";
// import "../finance-dashboard.css";

function money(value) {

  return Number(
    value || 0
  ).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  );
}

function pretty(value) {

  return String(
    value || ""
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(/\b\w/g, (m) =>
      m.toUpperCase()
    );
}

function formatDate(value) {

  if (!value)
    return "--";

  return new Date(
    value
  ).toLocaleDateString();
}

function SortHeader({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
}) {

  const active =
    currentKey === sortKey;

  return (
    <button
      type="button"
      className={`finance-sort-header ${
        active
          ? "active"
          : ""
      }`}
      onClick={() =>
        onSort(
          sortKey
        )
      }
    >

      <span>
        {label}
      </span>

      {active ? (
        direction ===
        "asc" ? (
          <ChevronUp
            size={14}
          />
        ) : (
          <ChevronDown
            size={14}
          />
        )
      ) : null}

    </button>
  );
}

function StatusBadge({
  value,
}) {

  const status =
    String(
      value || ""
    ).toLowerCase();

  let type =
    "primary";

  if (
    [
      "posted",
      "matched",
      "paid",
    ].includes(status)
  ) {
    type =
      "success";
  }

  if (
    [
      "pending",
      "draft",
    ].includes(status)
  ) {
    type =
      "warning";
  }

  if (
    [
      "reversed",
      "void",
      "failed",
    ].includes(status)
  ) {
    type =
      "danger";
  }

  return (
    <FinanceBadge
      label={pretty(
        value
      )}
      type={type}
    />
  );
}

export default function FinanceLedgerTable({

  rows = [],
  loading = false,

  selectedRows = [],
  onSelectRows,

  onView,
  onReverse,
  onReconcile,
  onUnreconcile,

  page = 1,
  totalPages = 1,
  onPageChange,

}) {

  const [sortKey,
    setSortKey] =
    useState(
      "record_date"
    );

  const [direction,
    setDirection] =
    useState("desc");

  function toggleSort(
    key
  ) {

    if (
      sortKey === key
    ) {

      setDirection(
        (
          prev
        ) =>
          prev ===
          "asc"
            ? "desc"
            : "asc"
      );

    } else {

      setSortKey(
        key
      );

      setDirection(
        "asc"
      );
    }
  }

  const sortedRows =
    useMemo(() => {

      const cloned =
        [...rows];

      cloned.sort(
        (a, b) => {

          const av =
            a[
              sortKey
            ];

          const bv =
            b[
              sortKey
            ];

          if (
            av ==
              null &&
            bv ==
              null
          )
            return 0;

          if (
            av ==
            null
          )
            return 1;

          if (
            bv ==
            null
          )
            return -1;

          if (
            typeof av ===
              "number" &&
            typeof bv ===
              "number"
          ) {

            return direction ===
              "asc"
              ? av -
                  bv
              : bv -
                  av;
          }

          return direction ===
            "asc"
            ? String(
                av
              ).localeCompare(
                String(
                  bv
                )
              )
            : String(
                bv
              ).localeCompare(
                String(
                  av
                )
              );
        }
      );

      return cloned;

    }, [
      rows,
      sortKey,
      direction,
    ]);

  function isSelected(
    row
  ) {

    return selectedRows.includes(
      row.id
    );
  }

  function toggleSelect(
    row
  ) {

    if (
      isSelected(
        row
      )
    ) {

      onSelectRows?.(
        selectedRows.filter(
          (
            id
          ) =>
            id !==
            row.id
        )
      );

    } else {

      onSelectRows?.([
        ...selectedRows,
        row.id,
      ]);
    }
  }

  function toggleSelectAll() {

    if (
      selectedRows.length ===
      rows.length
    ) {

      onSelectRows?.([]);

    } else {

      onSelectRows?.(
        rows.map(
          (
            r
          ) => r.id
        )
      );
    }
  }

  return (
    <div className="finance-table-card">

      <div className="finance-table-wrap">

        <table className="finance-table finance-table-sticky">

          <thead>

            <tr>

              <th>

                <input
                  type="checkbox"
                  checked={
                    rows.length >
                      0 &&
                    selectedRows.length ===
                      rows.length
                  }
                  onChange={
                    toggleSelectAll
                  }
                />

              </th>

              <th>

                <SortHeader
                  label="Date"
                  sortKey="record_date"
                  currentKey={
                    sortKey
                  }
                  direction={
                    direction
                  }
                  onSort={
                    toggleSort
                  }
                />

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
                Balance
              </th>

              <th>
                Reconciliation
              </th>

              <th>
                Status
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
                  colSpan="13"
                  className="finance-empty-cell"
                >
                  Loading
                  ledger...
                </td>
              </tr>
            )}

            {!loading &&
              sortedRows.length ===
                0 && (
                <tr>
                  <td
                    colSpan="13"
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
              sortedRows.map(
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

                        <input
                          type="checkbox"
                          checked={isSelected(
                            row
                          )}
                          onChange={() =>
                            toggleSelect(
                              row
                            )
                          }
                        />

                      </td>

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

                        <div className="finance-inline-icon">

                          <CreditCard
                            size={14}
                          />

                          <span>
                            {row.payment_number ||
                              "--"}
                          </span>

                        </div>

                      </td>

                      <td>

                        <div className="finance-inline-icon">

                          <FileText
                            size={14}
                          />

                          <span>
                            {row.invoice_number ||
                              "--"}
                          </span>

                        </div>

                      </td>

                      <td>

                        <div className="finance-inline-icon">

                          <Receipt
                            size={14}
                          />

                          <span>
                            {row.receipt_number ||
                              "--"}
                          </span>

                        </div>

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
                        {money(
                          row.running_balance
                        )}
                      </td>

                      <td>

                        <StatusBadge
                          value={
                            row.reconciliation_status ||
                            "pending"
                          }
                        />

                      </td>

                      <td>

                        <StatusBadge
                          value={
                            row.status ||
                            row.ledger_status
                          }
                        />

                      </td>

                      <td>

                        <div className="finance-row-actions">

                          <button
                            className="finance-btn finance-btn-xs"
                            onClick={() =>
                              onView?.(
                                row
                              )
                            }
                          >
                            <Eye
                              size={
                                14
                              }
                            />
                          </button>

                          {!matched && (
                            <button
                              className="finance-btn finance-btn-success finance-btn-xs"
                              onClick={() =>
                                onReconcile?.(
                                  row
                                )
                              }
                            >
                              <CheckCircle2
                                size={
                                  14
                                }
                              />
                            </button>
                          )}

                          {matched && (
                            <button
                              className="finance-btn finance-btn-warning finance-btn-xs"
                              onClick={() =>
                                onUnreconcile?.(
                                  row
                                )
                              }
                            >
                              <AlertTriangle
                                size={
                                  14
                                }
                              />
                            </button>
                          )}

                          <button
                            className="finance-btn finance-btn-danger finance-btn-xs"
                            onClick={() =>
                              onReverse?.(
                                row
                              )
                            }
                          >
                            <RotateCcw
                              size={
                                14
                              }
                            />
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

      <div className="finance-pagination">

        <button
          disabled={
            page <= 1
          }
          onClick={() =>
            onPageChange?.(
              page - 1
            )
          }
        >
          Previous
        </button>

        <span>
          Page {page} of{" "}
          {totalPages}
        </span>

        <button
          disabled={
            page >=
            totalPages
          }
          onClick={() =>
            onPageChange?.(
              page + 1
            )
          }
        >
          Next
        </button>

      </div>

    </div>
  );
}