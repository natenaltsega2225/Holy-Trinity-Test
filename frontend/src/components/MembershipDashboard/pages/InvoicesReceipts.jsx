
// frontend/src/components/MembershipDashboard/pages/InvoicesReceipts.jsx
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api";

import "../../../styles/membership-dashboard.css";

function money(value) {
  return Number(value || 0).toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  );
}

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "--";
  }

  return d.toLocaleDateString("en-US");
}

function pretty(value) {
  if (!value) return "--";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) =>
      c.toUpperCase()
    );
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();

  if (
    ["paid", "posted", "completed", "approved", "emailed"].includes(s)
  ) {
    return (
      <span className="member-status-badge success">
        {pretty(status || "paid")}
      </span>
    );
  }

  if (
    ["partial", "pending", "processing"].includes(s)
  ) {
    return (
      <span className="member-status-badge warning">
        {pretty(status)}
      </span>
    );
  }

  if (
    ["overdue", "failed", "void", "cancelled"].includes(s)
  ) {
    return (
      <span className="member-status-badge danger">
        {pretty(status)}
      </span>
    );
  }

  return (
    <span className="member-status-badge">
      {pretty(status)}
    </span>
  );
}

function normalizeRows(data) {
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

export default function InvoicesReceipts() {
  const [tab, setTab] =
    useState("invoices");

  const [invoices, setInvoices] =
    useState([]);

  const [receipts, setReceipts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [invRes, recRes] =
        await Promise.all([
          api.get("/member/invoices/me"),
          api.get("/member/receipts/me"),
        ]);

      setInvoices(
        normalizeRows(invRes.data)
      );

      setReceipts(
        normalizeRows(recRes.data)
      );
    } catch (err) {
      console.error(
        "Failed to load invoices and receipts:",
        err
      );

      setError(
        err?.response?.data?.error ||
          "Failed to load invoices and receipts."
      );

      setInvoices([]);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    const invoiceTotal =
      invoices.reduce(
        (sum, row) =>
          sum +
          Number(
            row.total_amount ||
              row.amount ||
              0
          ),
        0
      );

    const paidInvoices =
      invoices.filter((invoice) =>
        [
          "paid",
          "posted",
          "completed",
          "approved",
        ].includes(
          String(
            invoice.status ||
              invoice.payment_status ||
              ""
          ).toLowerCase()
        )
      ).length;

    const receiptTotal =
      receipts.reduce(
        (sum, row) =>
          sum +
          Number(
            row.amount ||
              row.total_amount ||
              row.paid_amount ||
              0
          ),
        0
      );

    return {
      invoiceTotal,
      receiptTotal,
      paidInvoices,
      receipts: receipts.length,
    };
  }, [invoices, receipts]);

  function openReceipt(row) {
    const number =
      row.receipt_number ||
      row.id;

    if (!number) return;

    window.open(
      `/dash/membership/receipts/${encodeURIComponent(number)}`,
      "_blank"
    );
  }

  function openInvoice(row) {
    const number =
      row.invoice_number ||
      row.id;

    if (!number) return;

    window.open(
      `/dash/membership/invoices/${encodeURIComponent(number)}`,
      "_blank"
    );
  }

  return (
    <div className="member-page">
      <div className="member-page-header">
        <div>
          <p className="member-page-eyebrow">
            Billing Center
          </p>

          <h1>
            Invoices & Receipts
          </h1>

          <p>
            Access invoices, receipts, downloadable payment records,
            and billing history.
          </p>
        </div>

        <div className="member-page-actions">
          <button
            type="button"
            className="member-link-btn"
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="member-summary-grid">
        <div className="member-summary-card">
          <span>Total Invoices</span>
          <h2>{invoices.length}</h2>
          <small>{money(summary.invoiceTotal)}</small>
        </div>

        <div className="member-summary-card">
          <span>Paid Invoices</span>
          <h2>{summary.paidInvoices}</h2>
          <small>Completed billing</small>
        </div>

        <div className="member-summary-card">
          <span>Receipts</span>
          <h2>{summary.receipts}</h2>
          <small>{money(summary.receiptTotal)}</small>
        </div>
      </div>

      <div className="member-tabs">
        <button
          type="button"
          className={tab === "invoices" ? "active" : ""}
          onClick={() => setTab("invoices")}
        >
          Invoices
        </button>

        <button
          type="button"
          className={tab === "receipts" ? "active" : ""}
          onClick={() => setTab("receipts")}
        >
          Receipts
        </button>
      </div>

      {error ? (
        <div className="member-alert error">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="member-card">
          Loading billing records...
        </div>
      ) : null}

      {!loading && tab === "invoices" ? (
        <div className="member-card">
          <div className="member-card-header">
            <h2>Invoice History</h2>
          </div>

          {!invoices.length ? (
            <div className="member-empty-state">
              <h3>No invoices found</h3>
              <p>
                Invoices generated from payments will appear here.
              </p>
            </div>
          ) : (
            <div className="member-table-wrap">
              <table className="member-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Receipt</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id || invoice.invoice_number}>
                      <td>{invoice.invoice_number || "--"}</td>

                      <td>
                        {pretty(
                          invoice.category ||
                            invoice.invoice_type ||
                            invoice.payment_type
                        )}
                      </td>

                      <td>
                        {money(
                          invoice.total_amount ||
                            invoice.amount ||
                            0
                        )}
                      </td>

                      <td>
                        {money(
                          invoice.paid_amount ||
                            invoice.amount_paid ||
                            0
                        )}
                      </td>

                      <td>
                        {money(
                          invoice.balance_due ||
                            0
                        )}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            invoice.status ||
                            invoice.payment_status
                          }
                        />
                      </td>

                      <td>
                        {formatDate(
                          invoice.invoice_date ||
                            invoice.issue_date ||
                            invoice.created_at
                        )}
                      </td>

                      <td>
                        {invoice.receipt_number || "--"}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="member-link-btn"
                          onClick={() => openInvoice(invoice)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {!loading && tab === "receipts" ? (
        <div className="member-card">
          <div className="member-card-header">
            <h2>Receipt History</h2>
          </div>

          {!receipts.length ? (
            <div className="member-empty-state">
              <h3>No receipts found</h3>
              <p>
                Receipts generated from completed payments will appear here.
              </p>
            </div>
          ) : (
            <div className="member-table-wrap">
              <table className="member-table">
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Email</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.id || receipt.receipt_number}>
                      <td>{receipt.receipt_number || "--"}</td>

                      <td>
                        {pretty(
                          receipt.category ||
                            receipt.payment_type ||
                            receipt.sub_category
                        )}
                      </td>

                      <td>
                        {money(
                          receipt.amount ||
                            receipt.total_amount ||
                            receipt.paid_amount ||
                            0
                        )}
                      </td>

                      <td>
                        {pretty(
                          receipt.method ||
                            receipt.payment_method
                        )}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            receipt.payment_status ||
                            receipt.status
                          }
                        />
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            receipt.email_status ||
                            "pending"
                          }
                        />
                      </td>

                      <td>
                        {formatDate(
                          receipt.receipt_date ||
                            receipt.created_at
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="member-link-btn"
                          onClick={() => openReceipt(receipt)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}