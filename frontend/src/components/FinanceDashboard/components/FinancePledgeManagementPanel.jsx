// frontend/src/components/FinanceDashboard/components/FinancePledgeManagementPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  FileText,
  Mail,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Target,
} from "lucide-react";

import api from "../../api";

// import "../../../styles/finance-enterprise.css";
// import "../../../styles/finance-dashboard.css";
import "../../../styles/finance-enterprise.css";
function rowsFrom(data) {
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "--";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pledgeProgress(row = {}) {
  const pledged = numberValue(row.pledged_amount || row.amount || row.total_amount);
  const paid = Math.min(numberValue(row.paid_amount), pledged);
  const remaining = Math.max(pledged - paid, 0);
  const progress = pledged > 0 ? Math.min((paid / pledged) * 100, 100) : 0;

  return {
    pledged,
    paid,
    remaining,
    progress,
  };
}

async function postFirst(paths, payload = {}) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      return await api.post(path, payload);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export default function FinancePledgeManagementPanel({
  onCreatePledge,
  onApplyPayment,
  onViewPledge,
}) {
  const [rows, setRows] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    campaign_id: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const [pledgesRes, campaignsRes] = await Promise.all([
        api.get("/finance/pledges", { params: filters }),
        api.get("/finance/campaigns").catch(() => ({ data: { rows: [] } })),
      ]);

      setRows(rowsFrom(pledgesRes.data));
      setCampaigns(rowsFrom(campaignsRes.data));
    } catch (err) {
      console.error("Failed to load pledges:", err);
      setError(err?.response?.data?.error || "Unable to load pledge records.");
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const progress = pledgeProgress(row);

        acc.count += 1;
        acc.pledged += progress.pledged;
        acc.paid += progress.paid;
        acc.remaining += progress.remaining;

        if (progress.remaining <= 0) acc.paidCount += 1;
        else if (progress.paid > 0) acc.partialCount += 1;
        else acc.openCount += 1;

        return acc;
      },
      {
        count: 0,
        pledged: 0,
        paid: 0,
        remaining: 0,
        paidCount: 0,
        partialCount: 0,
        openCount: 0,
      }
    );
  }, [rows]);

  function updateFilter(key, value) {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function sendReminder(row) {
    try {
      setBusyId(`reminder-${row.id}`);
      setError("");
      setSuccess("");

      await postFirst(
        [
          `/finance/pledges/${row.id}/send-reminder`,
          `/finance/pledges/${row.id}/reminder`,
          `/finance/pledge-reminders/${row.id}/send`,
        ],
        {
          include_invoice: true,
          include_payment_link: true,
          send_email: true,
        }
      );

      setSuccess("Pledge reminder sent with invoice/payment link.");
      await load();
    } catch (err) {
      console.error("Pledge reminder failed:", err);
      setError(err?.response?.data?.error || "Unable to send pledge reminder.");
    } finally {
      setBusyId("");
    }
  }

  async function createInvoice(row) {
    try {
      setBusyId(`invoice-${row.id}`);
      setError("");
      setSuccess("");

      await postFirst(
        [
          `/finance/pledges/${row.id}/invoice`,
          `/finance/pledges/${row.id}/create-invoice`,
          "/finance/invoices",
        ],
        {
          pledge_id: row.id,
          campaign_id: row.campaign_id,
          category: "pledge",
          payment_type: "pledge",
          full_name: row.full_name || row.guest_name || row.donor_name,
          email: row.email || row.donor_email,
          phone: row.phone,
          member_id: row.member_id || null,
          member_no: row.member_no || null,
          pledged_amount: row.pledged_amount,
          amount: pledgeProgress(row).remaining,
          total_amount: pledgeProgress(row).remaining,
          balance_due: pledgeProgress(row).remaining,
          create_payment_link: true,
          send_invoice_email: true,
          include_payment_link: true,
        }
      );

      setSuccess("Pledge invoice created and queued for email.");
      await load();
    } catch (err) {
      console.error("Pledge invoice failed:", err);
      setError(err?.response?.data?.error || "Unable to create pledge invoice.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="finance-card finance-pledge-panel">
      <div className="finance-card-header finance-card-header-split">
        <div>
          <h3>
            <Target size={18} strokeWidth={2.1} />
            Pledge Management
          </h3>
          <p>Track promised giving, remaining balances, reminders, invoices, and payment links.</p>
        </div>

        <div className="finance-toolbar compact">
          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={load}
            disabled={loading}
          >
            <RefreshCcw size={15} strokeWidth={2.1} />
            Refresh
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={onCreatePledge}
          >
            <Plus size={15} strokeWidth={2.1} />
            New Pledge
          </button>
        </div>
      </div>

      {error ? (
        <div className="finance-alert error">
          <AlertTriangle size={16} strokeWidth={2.1} />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="finance-alert success">
          <CheckCircle2 size={16} strokeWidth={2.1} />
          {success}
        </div>
      ) : null}

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <span>Pledges</span>
          <h3>{summary.count}</h3>
          <small>Total visible pledges</small>
        </div>

        <div className="finance-summary-card featured">
          <span>Pledged</span>
          <h3>{money(summary.pledged)}</h3>
          <small>Promise total</small>
        </div>

        <div className="finance-summary-card">
          <span>Paid</span>
          <h3>{money(summary.paid)}</h3>
          <small>Collected amount</small>
        </div>

        <div className="finance-summary-card">
          <span>Remaining</span>
          <h3>{money(summary.remaining)}</h3>
          <small>Outstanding pledge balance</small>
        </div>
      </div>

      <div className="finance-filter-grid compact">
        <label className="finance-filter-control finance-filter-search">
          <span>Search</span>
          <div className="finance-filter-input-icon">
            <Search size={15} strokeWidth={2.1} />
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") load();
              }}
              placeholder="Donor, member #, email, pledge #..."
            />
          </div>
        </label>

        <label className="finance-filter-control">
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>

        <label className="finance-filter-control">
          <span>Campaign</span>
          <select
            value={filters.campaign_id}
            onChange={(event) => updateFilter("campaign_id", event.target.value)}
          >
            <option value="">All Campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title || campaign.campaign_name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="finance-btn finance-btn-secondary"
          onClick={load}
          disabled={loading}
        >
          Apply
        </button>
      </div>

      <div className="finance-table-wrap">
        <table className="finance-table">
          <thead>
            <tr>
              <th>Donor</th>
              <th>Campaign</th>
              <th>Pledged</th>
              <th>Paid</th>
              <th>Remaining</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Due Date</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {!loading && !rows.length ? (
              <tr>
                <td colSpan="9" className="finance-empty-state">
                  No pledge records found.
                </td>
              </tr>
            ) : null}

            {loading ? (
              <tr>
                <td colSpan="9" className="finance-empty-state">
                  Loading pledges...
                </td>
              </tr>
            ) : null}

            {!loading
              ? rows.map((row) => {
                  const progress = pledgeProgress(row);
                  const donor =
                    row.full_name ||
                    row.full_name_snapshot ||
                    row.guest_name ||
                    row.donor_name ||
                    "Guest Donor";

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="finance-member-cell">
                          <strong>{donor}</strong>
                          <span>{row.member_no || row.email || row.phone || "--"}</span>
                        </div>
                      </td>

                      <td>{row.campaign_name || row.campaign || "--"}</td>
                      <td>{money(progress.pledged)}</td>
                      <td>{money(progress.paid)}</td>
                      <td>{money(progress.remaining)}</td>

                      <td>
                        <div className="finance-progress-cell">
                          <div className="finance-progress-wrap">
                            <div
                              className="finance-progress-bar"
                              style={{ width: `${progress.progress}%` }}
                            />
                          </div>
                          <span>{progress.progress.toFixed(0)}%</span>
                        </div>
                      </td>

                      <td>
                        <span className={`finance-status-badge ${String(row.status || "").toLowerCase()}`}>
                          {pretty(row.status)}
                        </span>
                      </td>

                      <td>{formatDate(row.due_date)}</td>

                      <td>
                        <div className="finance-row-actions">
                          <button
                            type="button"
                            className="finance-inline-btn"
                            onClick={() => onViewPledge?.(row)}
                          >
                            <FileText size={14} strokeWidth={2.1} />
                            View
                          </button>

                          {progress.remaining > 0 ? (
                            <button
                              type="button"
                              className="finance-inline-btn"
                              onClick={() => onApplyPayment?.(row)}
                            >
                              <CreditCard size={14} strokeWidth={2.1} />
                              Pay
                            </button>
                          ) : null}

                          {progress.remaining > 0 ? (
                            <button
                              type="button"
                              className="finance-inline-btn"
                              onClick={() => createInvoice(row)}
                              disabled={busyId === `invoice-${row.id}`}
                            >
                              <FileText size={14} strokeWidth={2.1} />
                              Invoice
                            </button>
                          ) : null}

                          {progress.remaining > 0 ? (
                            <button
                              type="button"
                              className="finance-inline-btn"
                              onClick={() => sendReminder(row)}
                              disabled={busyId === `reminder-${row.id}`}
                            >
                              <Mail size={14} strokeWidth={2.1} />
                              Reminder
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}