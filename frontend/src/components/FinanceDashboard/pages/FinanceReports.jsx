// frontend/src/components/FinanceDashboard/pages/FinanceReports.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCcw,
  Search,
  TrendingUp,
} from "lucide-react";

// import "../../../styles/shared-payment-components.css";
// import "../../../styles/finance-dashboard.css";
import "../../../styles/finance-enterprise.css";
function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function number(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function readAuthToken() {
  const tokenKeys = [
    "ht_token",
    "access_token",
    "accessToken",
    "auth_token",
    "authToken",
    "token",
    "jwt",
    "jwtToken",
    "id_token",
    "holy_token",
    "holy_access_token",
  ];

  const objectKeys = [
    "ht_auth",
    "auth",
    "holy_auth",
    "ht_user",
    "user",
    "authUser",
    "currentUser",
  ];

  const stores = [window.localStorage, window.sessionStorage].filter(Boolean);

  for (const store of stores) {
    for (const key of tokenKeys) {
      const value = store.getItem(key);
      if (value && !["undefined", "null"].includes(value)) {
        return String(value).replace(/^Bearer\s+/i, "");
      }
    }

    for (const key of objectKeys) {
      const raw = store.getItem(key);
      if (!raw) continue;

      try {
        const value = JSON.parse(raw);
        const token =
          value?.accessToken ||
          value?.access_token ||
          value?.token ||
          value?.jwt ||
          value?.auth?.token;

        if (token) {
          return String(token).replace(/^Bearer\s+/i, "");
        }
      } catch (_err) {}
    }
  }

  return "";
}

async function apiFetch(path, options = {}) {
  const token = readAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers,
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (_err) {
    data = { raw: text };
  }

  if (response.status === 401) {
    throw new Error("Your finance session expired. Please sign in again.");
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || data.details || data.message || `Request failed (${response.status}).`);
  }

  return data;
}

function cardValue(card) {
  if (card?.type === "count") return number(card.value);
  return money(card?.value);
}

function cardTone(key) {
  if (String(key).includes("revenue") || String(key).includes("payments")) return "finance-report-card-money";
  if (String(key).includes("pledge")) return "finance-report-card-pledge";
  if (String(key).includes("invoice") || String(key).includes("unpaid")) return "finance-report-card-risk";
  return "";
}

function buildParams(filters) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.search) params.set("search", filters.search);
  return params;
}

const pageStyles = `
.finance-enterprise-page {
  width: 100%;
  max-width: 1520px;
  margin: 0 auto;
  padding: 24px;
  color: #0f172a;
}

.finance-page-hero,
.finance-panel,
.finance-summary-card {
  background: #ffffff;
  border: 1px solid #cfe0f1;
  border-radius: 8px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.finance-page-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 28px;
  margin-bottom: 18px;
}

.finance-eyebrow {
  margin: 0 0 8px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.finance-page-hero h1 {
  margin: 0;
  font-size: 32px;
  line-height: 1.15;
  letter-spacing: 0;
}

.finance-page-hero p:not(.finance-eyebrow) {
  margin: 12px 0 0;
  max-width: 860px;
  color: #334155;
  font-size: 15px;
  line-height: 1.6;
}

.finance-actions,
.finance-report-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.finance-btn {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid #c8d8eb;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  font-weight: 800;
  cursor: pointer;
}

.finance-btn:hover {
  border-color: #2563eb;
  color: #1d4ed8;
}

.finance-btn:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.finance-btn-primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
}

.finance-btn-primary:hover {
  color: #ffffff;
  background: #1d4ed8;
}

.finance-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  margin: 0 0 18px;
  border-radius: 8px;
  font-weight: 800;
}

.finance-alert-danger {
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #be123c;
}

.finance-panel {
  padding: 18px;
  margin-bottom: 18px;
}

.finance-filter-bar {
  display: grid;
  grid-template-columns: minmax(260px, 1.5fr) minmax(180px, 0.7fr) repeat(2, minmax(150px, 0.5fr)) auto;
  gap: 12px;
  align-items: center;
}

.finance-search-field {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 12px;
  border: 1px solid #c8d8eb;
  border-radius: 8px;
  background: #ffffff;
}

.finance-search-field input,
.finance-filter-bar select,
.finance-filter-bar input[type="date"] {
  width: 100%;
  min-width: 0;
  height: 44px;
  border: 1px solid #c8d8eb;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  font-weight: 700;
}

.finance-search-field input {
  height: auto;
  border: 0;
  outline: 0;
}

.finance-filter-bar select,
.finance-filter-bar input[type="date"] {
  padding: 0 12px;
}

.finance-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.finance-summary-card {
  min-height: 132px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-top: 4px solid #d7e6f6;
}

.finance-summary-card span {
  color: #334155;
  font-size: 14px;
}

.finance-summary-card strong {
  margin-top: 8px;
  font-size: 28px;
  line-height: 1.1;
  letter-spacing: 0;
}

.finance-summary-card small {
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}

.finance-report-card-money {
  border-top-color: #2563eb;
}

.finance-report-card-pledge {
  border-top-color: #7c3aed;
}

.finance-report-card-risk {
  border-top-color: #f59e0b;
}

.finance-report-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.finance-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.finance-section-title h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0;
}

.finance-breakdown-list {
  display: grid;
  gap: 10px;
}

.finance-breakdown-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.finance-breakdown-row span {
  font-weight: 800;
}

.finance-breakdown-row strong {
  color: #0f4a73;
}

.finance-breakdown-row small {
  color: #64748b;
}

.finance-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #dbe7f3;
  border-radius: 8px;
}

.finance-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  background: #ffffff;
}

.finance-table th {
  padding: 13px 14px;
  background: #f4f7fb;
  color: #475569;
  text-align: left;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.finance-table td {
  padding: 14px;
  border-top: 1px solid #e6edf5;
  color: #0f172a;
  vertical-align: top;
}

.finance-table td small {
  display: block;
  margin-top: 4px;
  color: #64748b;
}

.finance-empty-inline {
  padding: 18px;
  border: 1px dashed #b7cbe2;
  border-radius: 8px;
  color: #64748b;
  text-align: center;
  font-weight: 800;
}

@media (max-width: 1180px) {
  .finance-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .finance-filter-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .finance-enterprise-page {
    padding: 14px;
  }

  .finance-page-hero {
    flex-direction: column;
    padding: 20px;
  }

  .finance-page-hero h1 {
    font-size: 26px;
  }

  .finance-actions,
  .finance-report-actions {
    width: 100%;
    justify-content: stretch;
  }

  .finance-actions .finance-btn,
  .finance-report-actions .finance-btn {
    flex: 1 1 140px;
  }

  .finance-summary-grid,
  .finance-report-grid,
  .finance-filter-bar {
    grid-template-columns: 1fr;
  }

  .finance-summary-card {
    min-height: 112px;
  }

  .finance-breakdown-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
`;

export default function FinanceReports() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    type: "summary",
    from: "",
    to: "",
  });

  const cards = useMemo(() => report?.cards || [], [report]);
  const categoryRows = report?.breakdowns?.revenue_by_category || [];
  const methodRows = report?.breakdowns?.payment_methods || [];
  const unpaidRows = report?.lists?.unpaid_members || [];
  const pledgeRows = report?.lists?.pledge_rows || [];
  const programRows = report?.lists?.program_rows || [];
  const paymentRows = report?.lists?.payment_rows || [];

  function updateFilter(key, value) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch(`/api/finance/reports/enterprise?${buildParams(filters).toString()}`);
      setReport(data.report || data.dashboard || data);
    } catch (err) {
      setError(err.message || "Failed to load finance reports.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const token = readAuthToken();
    const url = `/api/finance/reports/export.csv?${buildParams(filters).toString()}`;

    if (!token) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    fetch(url, {
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unable to export CSV.");
        return res.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `finance-report-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(objectUrl);
      })
      .catch((err) => setError(err.message || "Unable to export CSV."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="finance-enterprise-page">
      <style>{pageStyles}</style>

      <section className="finance-page-hero">
        <div>
          <p className="finance-eyebrow">Enterprise Reports</p>
          <h1>Finance Reports</h1>
          <p>
            Real-time reporting for members and dependents, payments, pledges,
            invoices, donations, school programs, trip programs, and unpaid balances.
          </p>
        </div>

        <div className="finance-actions">
          <button type="button" className="finance-btn" onClick={load} disabled={loading}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button type="button" className="finance-btn" onClick={exportCsv}>
            <Download size={16} />
            CSV
          </button>
          <button type="button" className="finance-btn" onClick={exportCsv}>
            <FileSpreadsheet size={16} />
            Excel
          </button>
          <button type="button" className="finance-btn" onClick={() => window.print()}>
            <FileText size={16} />
            PDF
          </button>
        </div>
      </section>

      {error ? (
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      <section className="finance-panel">
        <div className="finance-filter-bar">
          <label className="finance-search-field">
            <Search size={15} />
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search report data..."
            />
          </label>

          <select value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}>
            <option value="summary">Executive Summary</option>
            <option value="pledges">Pledge Report</option>
            <option value="payments">Payment Report</option>
            <option value="programs">School & Trip Programs</option>
            <option value="unpaid">Unpaid Members</option>
          </select>

          <input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} />
          <input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} />

          {/* <button type="button" className="finance-btn finance-btn-primary" onClick={load} disabled={loading}>
            Search
          </button> */}
        </div>
      </section>

      <section className="finance-summary-grid">
        {cards.map((card) => (
          <div className={`finance-summary-card ${cardTone(card.key)}`} key={card.key || card.label}>
            <span>{card.label}</span>
            <strong>{cardValue(card)}</strong>
            <small>{card.note || "Current report range"}</small>
          </div>
        ))}
      </section>

      <section className="finance-report-grid">
        <div className="finance-panel">
          <div className="finance-section-title">
            <TrendingUp size={18} />
            <h2>Revenue By Category</h2>
          </div>
          <div className="finance-breakdown-list">
            {categoryRows.map((row) => (
              <div className="finance-breakdown-row" key={row.category}>
                <span>{pretty(row.category)}</span>
                <strong>{money(row.amount)}</strong>
                <small>{number(row.count)} transaction(s)</small>
              </div>
            ))}
            {!categoryRows.length ? <div className="finance-empty-inline">No category revenue found.</div> : null}
          </div>
        </div>

        <div className="finance-panel">
          <div className="finance-section-title">
            <TrendingUp size={18} />
            <h2>Payment Methods</h2>
          </div>
          <div className="finance-breakdown-list">
            {methodRows.map((row) => (
              <div className="finance-breakdown-row" key={row.method}>
                <span>{pretty(row.method)}</span>
                <strong>{money(row.amount)}</strong>
                <small>{number(row.count)} transaction(s)</small>
              </div>
            ))}
            {!methodRows.length ? <div className="finance-empty-inline">No payment methods found.</div> : null}
          </div>
        </div>
      </section>

      <section className="finance-panel">
        <div className="finance-section-title">
          <h2>Individual Payment Detail</h2>
        </div>
        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payment #</th>
                <th>Payer</th>
                <th>Category</th>
                <th>Method</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((row) => (
                <tr key={row.id || row.payment_number}>
                  <td>{formatDate(row.paid_at)}</td>
                  <td>{row.payment_number || "--"}</td>
                  <td>
                    <strong>{row.payer_name || "--"}</strong>
                    <small>{row.email || "--"}</small>
                  </td>
                  <td>{pretty(row.category_norm)}</td>
                  <td>{pretty(row.method_norm)}</td>
                  <td>{money(row.amount)}</td>
                </tr>
              ))}
              {!paymentRows.length ? (
                <tr>
                  <td colSpan="6">No payment rows found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="finance-report-grid">
        <div className="finance-panel">
          <div className="finance-section-title">
            <h2>Pledge Report</h2>
          </div>
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Pledge #</th>
                  <th>Donor</th>
                  <th>Campaign</th>
                  <th>Pledged</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {pledgeRows.map((row) => (
                  <tr key={row.id || row.pledge_number}>
                    <td>{row.pledge_number || "--"}</td>
                    <td>
                      <strong>{row.donor_name || "--"}</strong>
                      <small>{row.email || "--"}</small>
                    </td>
                    <td>{row.campaign_name || "--"}</td>
                    <td>{money(row.pledged_amount)}</td>
                    <td>{money(row.paid_amount)}</td>
                    <td>{money(row.outstanding_amount)}</td>
                  </tr>
                ))}
                {!pledgeRows.length ? (
                  <tr>
                    <td colSpan="6">No pledge rows found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="finance-panel">
          <div className="finance-section-title">
            <h2>Unpaid Members</h2>
          </div>
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Member ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {unpaidRows.map((row) => (
                  <tr key={row.id || row.member_no}>
                    <td>{row.member_no || "--"}</td>
                    <td>{row.full_name || "--"}</td>
                    <td>{row.email || "--"}</td>
                    <td>{money(row.balance)}</td>
                  </tr>
                ))}
                {!unpaidRows.length ? (
                  <tr>
                    <td colSpan="4">No unpaid members found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="finance-panel">
        <div className="finance-section-title">
          <h2>School & Trip Program Activity</h2>
        </div>
        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Registrant</th>
                <th>Email</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {programRows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.created_at)}</td>
                  <td>{row.full_name || "--"}</td>
                  <td>{row.email || "--"}</td>
                  <td>{pretty(row.category)}</td>
                  <td>{money(row.total_amount)}</td>
                  <td>{pretty(row.status)}</td>
                </tr>
              ))}
              {!programRows.length ? (
                <tr>
                  <td colSpan="6">No program rows found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
