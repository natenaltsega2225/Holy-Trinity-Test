import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  LineChart,
  PieChart,
  RefreshCcw,
  Send,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numberValue(value));
}

function clean(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function pretty(value) {
  return clean(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "--";

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[2]}/${match[3]}/${match[1]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function responseData(response) {
  return response?.data || response || {};
}

function rowsFrom(data, keys = []) {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function campaignId(campaign) {
  return campaign?.id || campaign?.campaign_id || "";
}

function campaignTitle(campaign) {
  return clean(campaign?.title || campaign?.campaign_name || campaign?.name || "Campaign");
}

function goalAmount(campaign, analytics = {}) {
  return numberValue(
    analytics.goal_amount ||
      analytics.goal ||
      campaign?.goal_amount ||
      campaign?.goal ||
      campaign?.target_amount
  );
}

function raisedAmount(campaign, analytics = {}) {
  return numberValue(
    analytics.raised_amount ||
      analytics.raised ||
      analytics.total_raised ||
      campaign?.raised_amount ||
      campaign?.total_raised ||
      campaign?.paid_amount
  );
}

function pledgedAmount(campaign, analytics = {}) {
  return numberValue(
    analytics.pledged_amount ||
      analytics.total_pledged ||
      campaign?.pledged_amount ||
      campaign?.total_pledged
  );
}

function remainingAmount(campaign, analytics = {}) {
  const explicit =
    analytics.remaining_amount ||
    analytics.remaining ||
    campaign?.remaining_amount ||
    campaign?.goal_remaining;

  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== "") {
    return Math.max(0, numberValue(explicit));
  }

  return Math.max(0, goalAmount(campaign, analytics) - raisedAmount(campaign, analytics));
}

function progressPercent(campaign, analytics = {}) {
  const goal = goalAmount(campaign, analytics);
  if (goal <= 0) return 0;
  return Math.min(100, Math.max(0, (raisedAmount(campaign, analytics) / goal) * 100));
}

function donorCount(campaign, analytics = {}) {
  return numberValue(
    analytics.donor_count ||
      analytics.supporter_count ||
      analytics.contributors ||
      campaign?.donor_count ||
      campaign?.supporter_count ||
      campaign?.pledge_count
  );
}

function averageGift(campaign, analytics = {}) {
  const donors = donorCount(campaign, analytics);
  if (!donors) return 0;
  return raisedAmount(campaign, analytics) / donors;
}

async function getFirst(paths, config = {}) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      const response = await api.get(path, config);

      return {
        endpoint: path,
        data: responseData(response),
      };
    } catch (err) {
      lastError = err;

      if ([404, 405].includes(err?.response?.status)) {
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Campaign analytics endpoint is not available.");
}

function exportCsv(campaign, analytics, donorRows, trendRows) {
  const headers = ["Section", "Metric", "Value"];

  const summary = [
    ["Summary", "Campaign", campaignTitle(campaign)],
    ["Summary", "Goal", goalAmount(campaign, analytics).toFixed(2)],
    ["Summary", "Pledged", pledgedAmount(campaign, analytics).toFixed(2)],
    ["Summary", "Raised", raisedAmount(campaign, analytics).toFixed(2)],
    ["Summary", "Remaining", remainingAmount(campaign, analytics).toFixed(2)],
    ["Summary", "Progress", progressPercent(campaign, analytics).toFixed(2)],
    ["Summary", "Donors", donorCount(campaign, analytics)],
    ["Summary", "Average Gift", averageGift(campaign, analytics).toFixed(2)],
  ];

  const donors = donorRows.map((row) => [
    "Donor",
    clean(row.full_name || row.donor_name || row.name),
    money(row.amount || row.total_amount || row.paid_amount || row.pledged_amount),
  ]);

  const trends = trendRows.map((row) => [
    "Trend",
    clean(row.month || row.day || row.date),
    money(row.amount || row.total_amount || row.raised_amount),
  ]);

  const csv = [headers, ...summary, ...donors, ...trends]
    .map((line) =>
      line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `campaign-analytics-${campaignId(campaign) || "export"}-${todayIso()}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

function BarRow({ label, amount, max, tone = "primary" }) {
  const width = max > 0 ? Math.min(100, Math.max(0, (numberValue(amount) / max) * 100)) : 0;

  return (
    <div className="finance-bar-row">
      <div>
        <span>{label}</span>
        <strong>{money(amount)}</strong>
      </div>

      <div className={`finance-bar-track ${tone}`}>
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function FinanceCampaignAnalyticsPanel({
  campaign = null,
  open = true,
  embedded = false,
  onClose,
  onSendReminder,
}) {
  const [filters, setFilters] = useState({
    from: monthStartIso(),
    to: todayIso(),
  });

  const [analytics, setAnalytics] = useState({});
  const [donorRows, setDonorRows] = useState([]);
  const [trendRows, setTrendRows] = useState([]);
  const [categoryRows, setCategoryRows] = useState([]);
  const [pledgeRows, setPledgeRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const id = campaignId(campaign);

  const maxCategoryAmount = useMemo(
    () =>
      Math.max(
        0,
        ...categoryRows.map((row) =>
          numberValue(row.amount || row.total_amount || row.raised_amount)
        )
      ),
    [categoryRows]
  );

  const maxTrendAmount = useMemo(
    () =>
      Math.max(
        0,
        ...trendRows.map((row) =>
          numberValue(row.amount || row.total_amount || row.raised_amount)
        )
      ),
    [trendRows]
  );

  const progress = progressPercent(campaign || {}, analytics);

  async function loadAnalytics() {
    if (!id) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await getFirst(
        [
          `/finance/campaigns/${id}/analytics`,
          `/finance/pledges/campaigns/${id}/analytics`,
          `/finance/reports/campaigns/${id}/analytics`,
          `/finance/campaigns/${id}`,
        ],
        {
          params: {
            from: filters.from,
            to: filters.to,
            date_from: filters.from,
            date_to: filters.to,
          },
        }
      );

      const data = result.data;
      const nextAnalytics = data.analytics || data.summary || data.campaign || data;

      setAnalytics(nextAnalytics || {});
      setDonorRows(rowsFrom(data, ["donors", "top_donors", "supporters"]));
      setTrendRows(rowsFrom(data, ["trends", "monthly_trend", "daily_trend", "revenue_trend"]));
      setCategoryRows(rowsFrom(data, ["categories", "category_breakdown", "funds"]));
      setPledgeRows(rowsFrom(data, ["pledges", "pledge_status", "pledge_breakdown"]));
      setSuccess("Campaign analytics refreshed.");
    } catch (err) {
      setAnalytics({});
      setDonorRows([]);
      setTrendRows([]);
      setCategoryRows([]);
      setPledgeRows([]);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load campaign analytics."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !id) return;

    setFilters({
      from: monthStartIso(),
      to: todayIso(),
    });

    setError("");
    setSuccess("");
    setBusyAction("");

    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  if (!open) {
    return null;
  }

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleReminder() {
    setBusyAction("reminder");
    setError("");
    setSuccess("");

    try {
      await onSendReminder?.(campaign, analytics);
      setSuccess("Reminder action started.");
    } catch (err) {
      setError(err?.message || "Failed to start reminder action.");
    } finally {
      setBusyAction("");
    }
  }

  const body = (
    <section className="finance-panel">
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Campaign Analytics</span>
          <h1>{campaignTitle(campaign)}</h1>
          <p>
            Executive view of campaign progress, pledge conversion, donor
            participation, and revenue movement.
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn"
            onClick={() => exportCsv(campaign || {}, analytics, donorRows, trendRows)}
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            className="finance-btn"
            onClick={loadAnalytics}
            disabled={loading || !id}
          >
            <RefreshCcw size={16} />
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={handleReminder}
            disabled={busyAction === "reminder"}
          >
            <Send size={16} />
            {busyAction === "reminder" ? "Starting..." : "Send Reminder"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="finance-alert danger">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="finance-alert success">
          <CheckCircle2 size={17} />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="finance-summary-grid compact">
        <div className="finance-summary-card">
          <span>Goal</span>
          <strong>{money(goalAmount(campaign || {}, analytics))}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Pledged</span>
          <strong>{money(pledgedAmount(campaign || {}, analytics))}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Raised</span>
          <strong>{money(raisedAmount(campaign || {}, analytics))}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Remaining</span>
          <strong>{money(remainingAmount(campaign || {}, analytics))}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Donors</span>
          <strong>{donorCount(campaign || {}, analytics)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Average Gift</span>
          <strong>{money(averageGift(campaign || {}, analytics))}</strong>
        </div>
      </div>

      <div className="finance-section">
        <div className="finance-section-title">
          <Target size={18} />
          <h3>Progress</h3>
        </div>

        <div className="finance-progress-block large">
          <div className="finance-progress-row">
            <span>{money(raisedAmount(campaign || {}, analytics))} raised</span>
            <strong>{progress.toFixed(1)}%</strong>
          </div>

          <div className="finance-progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>

          <small>
            Goal {money(goalAmount(campaign || {}, analytics))} | Remaining{" "}
            {money(remainingAmount(campaign || {}, analytics))}
          </small>
        </div>
      </div>

      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <CalendarDays size={16} />

          <label>
            From
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </label>

          <label>
            To
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
          </label>

          <button
            type="button"
            className="finance-btn primary"
            onClick={loadAnalytics}
            disabled={loading || !id}
          >
            Apply
          </button>
        </div>
      </div>

      <div className="finance-grid two">
        <div className="finance-section">
          <div className="finance-section-title">
            <PieChart size={18} />
            <h3>Category Breakdown</h3>
          </div>

          {!categoryRows.length ? (
            <div className="finance-audit-empty">No category data available.</div>
          ) : (
            <div className="finance-bar-list">
              {categoryRows.map((row, index) => (
                <BarRow
                  key={row.category || row.label || index}
                  label={pretty(row.category || row.label || row.name)}
                  amount={row.amount || row.total_amount || row.raised_amount}
                  max={maxCategoryAmount}
                />
              ))}
            </div>
          )}
        </div>

        <div className="finance-section">
          <div className="finance-section-title">
            <LineChart size={18} />
            <h3>Revenue Trend</h3>
          </div>

          {!trendRows.length ? (
            <div className="finance-audit-empty">No trend data available.</div>
          ) : (
            <div className="finance-bar-list">
              {trendRows.map((row, index) => (
                <BarRow
                  key={row.month || row.day || row.date || index}
                  label={clean(row.month || row.day || formatDate(row.date))}
                  amount={row.amount || row.total_amount || row.raised_amount}
                  max={maxTrendAmount}
                  tone="success"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="finance-grid two">
        <div className="finance-section">
          <div className="finance-section-title">
            <Users size={18} />
            <h3>Top Donors</h3>
          </div>

          <div className="finance-table-shell">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Donor</th>
                  <th>Email</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {!donorRows.length ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="finance-audit-empty">No donor data available.</div>
                    </td>
                  </tr>
                ) : null}

                {donorRows.map((row, index) => (
                  <tr key={row.id || row.member_id || row.email || index}>
                    <td>{clean(row.full_name || row.donor_name || row.name)}</td>
                    <td>{clean(row.email || row.donor_email)}</td>
                    <td className="text-right">
                      <strong>
                        {money(row.amount || row.total_amount || row.paid_amount || row.pledged_amount)}
                      </strong>
                    </td>
                    <td>
                      <span className="finance-status success">
                        {pretty(row.status || "active")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="finance-section">
          <div className="finance-section-title">
            <BarChart3 size={18} />
            <h3>Pledge Status</h3>
          </div>

          <div className="finance-table-shell">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th className="text-right">Count</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>

              <tbody>
                {!pledgeRows.length ? (
                  <tr>
                    <td colSpan={3}>
                      <div className="finance-audit-empty">No pledge data available.</div>
                    </td>
                  </tr>
                ) : null}

                {pledgeRows.map((row, index) => (
                  <tr key={row.status || row.label || index}>
                    <td>{pretty(row.status || row.label)}</td>
                    <td className="text-right">
                      <strong>{numberValue(row.count || row.total_count)}</strong>
                    </td>
                    <td className="text-right">
                      <strong>{money(row.amount || row.total_amount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="finance-audit-empty">
        <TrendingUp size={15} />
        Campaign analytics should reconcile against pledge schedules, payment
        records, invoices, receipts, and ledger entries.
      </div>
    </section>
  );

  if (embedded) {
    return body;
  }

  return (
    <div className="finance-drawer-backdrop" role="presentation">
      <aside
        className="finance-drawer finance-drawer-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Campaign analytics"
      >
        <div className="finance-drawer-head">
          <div>
            <span className="finance-kicker">Analytics</span>
            <h2>{campaignTitle(campaign)}</h2>
            <p>Campaign performance, donor activity, and pledge conversion.</p>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={onClose}
            aria-label="Close campaign analytics"
          >
            <X size={18} />
          </button>
        </div>

        {body}
      </aside>
    </div>
  );
}