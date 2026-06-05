
// frontend/src/components/MembershipDashoard/pages/MyLedger.jsx
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api";
import FinanceBadge from "../../Shared/FinanceBadge";

import "../../../styles/membership-dashboard.css";

function money(value) {
  return `$${Number(value || 0).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function fmtDate(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "--";
  }

  return d.toLocaleDateString("en-US");
}

function normalizeRows(data) {
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function getDate(row) {
  return (
    row.entry_date ||
    row.record_date ||
    row.created_at ||
    row.updated_at
  );
}

function getRecordType(row) {
  return (
    row.record_type ||
    row.entry_type ||
    row.related_document_type ||
    "--"
  );
}

function getReference(row) {
  return (
    row.reference_number ||
    row.reference_no ||
    row.related_document_number ||
    row.payment_number ||
    row.invoice_number ||
    row.receipt_number ||
    "--"
  );
}

function getDocumentType(row) {
  return (
    row.related_document_type ||
    row.source_type ||
    row.payment_type ||
    "--"
  );
}

function getDescription(row) {
  return (
    row.description ||
    row.sub_category ||
    row.category ||
    row.payment_type ||
    "--"
  );
}

export function LedgerSection({
  rows = [],
}) {
  if (!rows.length) {
    return (
      <div className="member-empty-state">
        <h3>No ledger activity found</h3>
        <p>
          Payments, invoices, credits, and finance activity will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="member-table-wrap">
      <table className="member-enterprise-table member-table">
        <thead>
          <tr>
            <th>Entry Date</th>
            <th>Record Type</th>
            <th>Reference</th>
            <th>Description</th>
            <th>Debit</th>
            <th>Credit</th>
            <th>Balance</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="member-table-primary">
                  {fmtDate(getDate(row))}
                </div>
              </td>

              <td>
                <div className="member-table-primary">
                  {getRecordType(row)}
                </div>

                <div className="member-table-secondary">
                  {row.payment_source ||
                    row.provider ||
                    "--"}
                </div>
              </td>

              <td>
                <div className="member-table-primary">
                  {getReference(row)}
                </div>

                <div className="member-table-secondary">
                  {getDocumentType(row)}
                </div>
              </td>

              <td>
                <div className="member-table-primary">
                  {getDescription(row)}
                </div>

                {row.notes ? (
                  <div className="member-table-muted">
                    {row.notes}
                  </div>
                ) : null}
              </td>

              <td>
                <div className="member-table-danger">
                  {Number(row.debit || 0) > 0
                    ? money(row.debit)
                    : "--"}
                </div>
              </td>

              <td>
                <div className="member-table-success">
                  {Number(row.credit || 0) > 0
                    ? money(row.credit)
                    : "--"}
                </div>
              </td>

              <td>
                <div className="member-table-primary">
                  {money(row.balance)}
                </div>
              </td>

              <td>
                <FinanceBadge
                  status={
                    row.status ||
                    row.ledger_status ||
                    row.payment_status
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MyLedger() {
  const [rows, setRows] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [recordType, setRecordType] =
    useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res =
        await api.get("/member/ledger");

      setRows(
        normalizeRows(res.data)
      );
    } catch (err) {
      console.error(
        "Failed to load ledger:",
        err
      );

      setRows([]);
      setError(
        err?.response?.data?.error ||
          "Failed to load ledger."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered =
    useMemo(() => {
      const q =
        search.trim().toLowerCase();

      return rows.filter((row) => {
        const searchable = [
          getReference(row),
          getRecordType(row),
          getDescription(row),
          row.notes,
          getDocumentType(row),
          row.payment_number,
          row.invoice_number,
          row.receipt_number,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !q || searchable.includes(q);

        const matchesType =
          !recordType ||
          String(getRecordType(row))
            .toLowerCase() ===
            recordType.toLowerCase();

        return (
          matchesSearch &&
          matchesType
        );
      });
    }, [rows, search, recordType]);

  const totals =
    useMemo(() => {
      return filtered.reduce(
        (acc, row) => {
          acc.debit += Number(row.debit || 0);
          acc.credit += Number(row.credit || 0);
          acc.balance =
            Number(row.balance || acc.balance || 0);

          return acc;
        },
        {
          debit: 0,
          credit: 0,
          balance: 0,
        }
      );
    }, [filtered]);

  return (
    <div className="member-enterprise-page member-page">
      <div className="member-page-header-card member-page-header">
        <div>
          <p className="member-page-eyebrow">
            Financial Ledger
          </p>

          <h1>My Ledger</h1>

          <p>
            Review invoices, payments, credits, balances, membership dues,
            and financial activity history.
          </p>
        </div>

        <div className="member-page-actions">
          <button
            type="button"
            className="member-link-btn"
            onClick={load}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="member-kpi-grid member-summary-grid">
        <div className="member-kpi-card member-summary-card">
          <span>Total Debit</span>
          <strong>{money(totals.debit)}</strong>
        </div>

        <div className="member-kpi-card member-summary-card">
          <span>Total Credit</span>
          <strong>{money(totals.credit)}</strong>
        </div>

        <div className="member-kpi-card member-summary-card">
          <span>Current Balance</span>
          <strong>{money(totals.balance)}</strong>
        </div>
      </div>

      <div className="member-filter-card member-card">
        <div className="member-filter-grid">
          <div className="member-filter-item">
            <label>Search</label>

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search reference, invoice, receipt, description..."
            />
          </div>

          <div className="member-filter-item">
            <label>Record Type</label>

            <select
              value={recordType}
              onChange={(e) =>
                setRecordType(e.target.value)
              }
            >
              <option value="">All</option>
              <option value="invoice">Invoice</option>
              <option value="payment">Payment</option>
              <option value="receipt">Receipt</option>
              <option value="credit">Credit</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>
        </div>
      </div>

      {error ? (
        <div className="member-alert error">
          {error}
        </div>
      ) : null}

      <div className="member-table-card member-card">
        {loading ? (
          <div className="member-empty-state">
            Loading ledger...
          </div>
        ) : (
          <LedgerSection rows={filtered} />
        )}
      </div>
    </div>
  );
}