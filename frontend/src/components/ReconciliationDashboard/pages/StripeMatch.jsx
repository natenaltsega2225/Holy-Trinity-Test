//frontend\src\components\ReconciliationDashboard\pages\StripeMatch.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";

function money(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Badge({ matched }) {
  return (
    <span className={`finance-badge ${matched ? "finance-badge-success" : "finance-badge-warning"}`}>
      {matched ? "Matched" : "Unmatched"}
    </span>
  );
}

export default function StripeMatch() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [stripeRes, summaryRes] = await Promise.all([
        api.get("/reconciliation/stripe", {
          params: { status, search, page: 1, limit: 100 },
        }),
        api.get("/reconciliation/summary"),
      ]);

      setRows(stripeRes.data?.rows || []);
      setSummary(summaryRes.data || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  const visibleTotal = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [rows]
  );

  async function approve(row) {
    await api.post(`/reconciliation/approve/${row.id}`);
    await load();
  }

  async function approveAllVisible() {
    const ids = rows.filter((r) => !Number(r.matched)).map((r) => r.id);
    if (!ids.length) return;
    await api.post("/reconciliation/bulk-match", { ids });
    await load();
  }

  return (
    <div className="recon-page">
      <div className="finance-page-head">
        <div>
          <h2>Stripe Matching</h2>
          <p>Match Stripe payments against internal finance records and approve reconciliation.</p>
        </div>

        <button className="finance-btn finance-btn-primary" onClick={approveAllVisible}>
          Approve Visible Unmatched
        </button>
      </div>

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <span>Stripe Rows</span>
          <strong>{summary?.stripe_rows ?? rows.length}</strong>
        </div>
        <div className="finance-summary-card">
          <span>Stripe Amount</span>
          <strong>{money(summary?.stripe_amount || visibleTotal)}</strong>
        </div>
        <div className="finance-summary-card">
          <span>Match Rate</span>
          <strong>{summary?.match_rate || 0}%</strong>
        </div>
        <div className="finance-summary-card">
          <span>Unmatched Amount</span>
          <strong>{money(summary?.unmatched_amount || 0)}</strong>
        </div>
      </div>

      <div className="finance-filter-bar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Stripe ID, payment number, member..."
        />

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Stripe Payments</option>
          <option value="matched">Matched</option>
          <option value="unmatched">Unmatched</option>
        </select>

        <button className="finance-btn finance-btn-secondary" onClick={load}>
          {loading ? "Loading..." : "Search"}
        </button>
      </div>

      <div className="finance-table-wrap">
        <table className="finance-table recon-table">
          <thead>
            <tr>
              <th>Stripe ID</th>
              <th>Payment #</th>
              <th>Member / Donor</th>
              <th>Amount</th>
              <th>Card</th>
              <th>Received</th>
              <th>Status</th>
              <th>Reconciliation</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.stripe_id || "--"}</td>
                <td>{row.payment_number || "--"}</td>
                <td>{row.full_name || "--"}</td>
                <td>{money(row.amount)}</td>
                <td>
                  {row.card_brand && row.card_last4
                    ? `${String(row.card_brand).toUpperCase()} •••• ${row.card_last4}`
                    : "--"}
                </td>
                <td>{formatDate(row.received_at)}</td>
                <td>{row.status || "--"}</td>
                <td><Badge matched={Number(row.matched) === 1} /></td>
                <td>
                  {Number(row.matched) === 1 ? (
                    "--"
                  ) : (
                    <button className="finance-btn finance-btn-xs" onClick={() => approve(row)}>
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan="9" className="finance-empty-cell">
                  No Stripe records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}