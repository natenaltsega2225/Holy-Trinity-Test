import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  Filter,
  Megaphone,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Target,
  ToggleLeft,
  ToggleRight,
  Users,
  XCircle,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "inactive", label: "Inactive" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All Campaign Types" },
  { value: "pledge", label: "Pledge" },
  { value: "building_fund", label: "Building Fund" },
  { value: "charity_fund", label: "Charity Fund" },
  { value: "general_donation", label: "General Donation" },
  { value: "school", label: "School" },
  { value: "trip", label: "Trip" },
  { value: "special_fund", label: "Special Fund" },
];

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

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.campaigns)) return data.campaigns;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function campaignId(row) {
  return row?.id || row?.campaign_id || "";
}

function campaignTitle(row) {
  return clean(row?.title || row?.campaign_name || row?.name);
}

function goalAmount(row) {
  return numberValue(row?.goal_amount || row?.goal || row?.target_amount);
}

function raisedAmount(row) {
  return numberValue(row?.raised_amount || row?.amount_raised || row?.total_raised || row?.paid_amount);
}

function pledgedAmount(row) {
  return numberValue(row?.pledged_amount || row?.total_pledged || row?.pledge_total);
}

function remainingAmount(row) {
  const explicit = row?.remaining_amount || row?.goal_remaining || row?.balance_remaining;

  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== "") {
    return Math.max(0, numberValue(explicit));
  }

  return Math.max(0, goalAmount(row) - raisedAmount(row));
}

function progressPercent(row) {
  const goal = goalAmount(row);

  if (goal <= 0) return 0;

  return Math.min(100, Math.max(0, (raisedAmount(row) / goal) * 100));
}

function donorCount(row) {
  return numberValue(row?.donor_count || row?.supporter_count || row?.contributors || row?.pledge_count);
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["active", "completed", "published"].includes(status)) return "success";
  if (["draft", "paused", "pending", "review"].includes(status)) return "warning";
  if (["inactive", "cancelled", "closed", "failed"].includes(status)) return "danger";

  return "neutral";
}

function summaryFrom(data, rows) {
  const source = data.summary || data.totals || {};

  return {
    campaigns: source.campaigns ?? source.count ?? rows.length,
    active:
      source.active_count ??
      rows.filter((row) => String(row.status || "active").toLowerCase() === "active").length,
    goal:
      source.goal_amount ??
      source.goal_total ??
      rows.reduce((sum, row) => sum + goalAmount(row), 0),
    pledged:
      source.pledged_amount ??
      source.pledged_total ??
      rows.reduce((sum, row) => sum + pledgedAmount(row), 0),
    raised:
      source.raised_amount ??
      source.raised_total ??
      rows.reduce((sum, row) => sum + raisedAmount(row), 0),
    remaining:
      source.remaining_amount ??
      source.remaining_total ??
      rows.reduce((sum, row) => sum + remainingAmount(row), 0),
    donors:
      source.donor_count ??
      source.supporter_count ??
      rows.reduce((sum, row) => sum + donorCount(row), 0),
  };
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

  throw lastError || new Error("Campaign endpoint is not available.");
}

async function postFirst(paths, payload = {}) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      const response = await api.post(path, payload);

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

  throw lastError || new Error("Campaign action endpoint is not available.");
}

function exportCsv(rows) {
  const headers = [
    "Campaign",
    "Type",
    "Status",
    "Goal",
    "Pledged",
    "Raised",
    "Remaining",
    "Progress %",
    "Donors",
    "Start Date",
    "End Date",
  ];

  const body = rows.map((row) => [
    campaignTitle(row),
    pretty(row.campaign_type || row.type || row.category),
    pretty(row.status || "active"),
    goalAmount(row).toFixed(2),
    pledgedAmount(row).toFixed(2),
    raisedAmount(row).toFixed(2),
    remainingAmount(row).toFixed(2),
    progressPercent(row).toFixed(2),
    donorCount(row),
    formatDate(row.start_date || row.created_at),
    formatDate(row.end_date || row.due_date),
  ]);

  const csv = [headers, ...body]
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
  link.download = `finance-campaigns-${todayIso()}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

export default function FinanceCampaignDashboard({
  compact = false,
  onCreateCampaign,
  onEditCampaign,
  onOpenCampaign,
  onOpenDonors,
  onOpenAnalytics,
  onSendReminder,
  onUpdated,
}) {
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    type: "",
  });

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(summaryFrom({}, []));
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const visibleRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return rows.filter((row) => {
      const haystack = [
        row.title,
        row.campaign_name,
        row.name,
        row.type,
        row.category,
        row.campaign_type,
        row.status,
        row.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || haystack.includes(search);

      const matchesStatus =
        !filters.status ||
        String(row.status || "active").toLowerCase() === filters.status.toLowerCase();

      const matchesType =
        !filters.type ||
        String(row.campaign_type || row.type || row.category || "").toLowerCase() ===
          filters.type.toLowerCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [rows, filters]);

  async function loadCampaigns() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await getFirst(
        [
          "/finance/campaigns",
          "/finance/pledges/campaigns",
          "/finance/reports/campaigns",
          "/finance/campaigns/dashboard",
        ],
        {
          params: {
            search: filters.search,
            status: filters.status,
            type: filters.type,
            limit: compact ? 20 : 250,
          },
        }
      );

      const data = result.data;
      const nextRows = rowsFrom(data);

      setRows(nextRows);
      setSummary(summaryFrom(data, nextRows));
    } catch (err) {
      setRows([]);
      setSummary(summaryFrom({}, []));
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load campaigns."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function runAction(row, action) {
    const id = campaignId(row);

    if (!id) {
      setError("Campaign id is missing.");
      return;
    }

    if (
      ["deactivate", "cancel", "close"].includes(action) &&
      !window.confirm(`Are you sure you want to ${pretty(action).toLowerCase()} this campaign?`)
    ) {
      return;
    }

    setBusyAction(`${action}:${id}`);
    setError("");
    setSuccess("");

    try {
      const result = await postFirst(
        [
          `/finance/campaigns/${id}/${action}`,
          `/finance/pledges/campaigns/${id}/${action}`,
          `/finance/campaigns/${id}/status`,
          "/finance/campaigns/action",
        ],
        {
          id,
          campaign_id: id,
          action,
          source: "finance_campaign_dashboard",
        }
      );

      setSuccess(`${pretty(action)} completed.`);
      onUpdated?.(result.data);
      await loadCampaigns();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          `Failed to ${pretty(action).toLowerCase()} campaign.`
      );
    } finally {
      setBusyAction("");
    }
  }

  const overallProgress =
    summary.goal > 0 ? Math.min(100, Math.max(0, (summary.raised / summary.goal) * 100)) : 0;

  return (
    <section className={`finance-panel ${compact ? "compact" : ""}`}>
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Campaigns</span>
          <h1>Campaign Dashboard</h1>
          <p>
            Track campaign goals, pledge commitments, raised revenue, remaining
            balances, donor follow-up, and progress.
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn"
            onClick={() => exportCsv(visibleRows)}
            disabled={!visibleRows.length}
          >
            <Download size={16} />
            Export
          </button>

          <button
            type="button"
            className="finance-btn"
            onClick={loadCampaigns}
            disabled={loading}
          >
            <RefreshCcw size={16} />
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={onCreateCampaign}
          >
            <Plus size={16} />
            Campaign
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
          <span>Campaigns</span>
          <strong>{summary.campaigns}</strong>
          <small>{summary.active} active</small>
        </div>

        <div className="finance-summary-card">
          <span>Goal</span>
          <strong>{money(summary.goal)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Pledged</span>
          <strong>{money(summary.pledged)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Raised</span>
          <strong>{money(summary.raised)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Remaining</span>
          <strong>{money(summary.remaining)}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Progress</span>
          <strong>{overallProgress.toFixed(0)}%</strong>
          <div className="finance-progress-track">
            <span style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      </div>

      <div className="finance-toolbar">
        <div className="finance-toolbar-group">
          <Filter size={16} />

          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Type
            <select
              value={filters.type}
              onChange={(event) => updateFilter("type", event.target.value)}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="finance-btn primary"
            onClick={loadCampaigns}
            disabled={loading}
          >
            Apply
          </button>
        </div>

        <div className="finance-search">
          <Search size={16} />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search campaign, fund, status, type..."
          />
        </div>
      </div>

      <div className="finance-campaign-grid">
        {loading ? (
          <div className="finance-audit-empty">Loading campaigns...</div>
        ) : null}

        {!loading && !visibleRows.length ? (
          <div className="finance-audit-empty">No campaigns found.</div>
        ) : null}

        {!loading &&
          visibleRows.map((row) => {
            const id = campaignId(row);
            const progress = progressPercent(row);
            const active = String(row.status || "active").toLowerCase() === "active";

            return (
              <article className="finance-campaign-card" key={id || campaignTitle(row)}>
                <div className="finance-campaign-card-head">
                  <div>
                    <span className="finance-kicker">
                      {pretty(row.campaign_type || row.type || row.category)}
                    </span>
                    <h3>{campaignTitle(row)}</h3>
                    <p>{clean(row.description || row.summary || row.notes, "")}</p>
                  </div>

                  <span className={`finance-status ${statusClass(row.status || "active")}`}>
                    {pretty(row.status || "active")}
                  </span>
                </div>

                <div className="finance-progress-block">
                  <div className="finance-progress-row">
                    <span>Progress</span>
                    <strong>{progress.toFixed(0)}%</strong>
                  </div>

                  <div className="finance-progress-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="finance-campaign-metrics">
                  <div>
                    <Target size={15} />
                    <span>Goal</span>
                    <strong>{money(goalAmount(row))}</strong>
                  </div>

                  <div>
                    <BadgeDollarSign size={15} />
                    <span>Raised</span>
                    <strong>{money(raisedAmount(row))}</strong>
                  </div>

                  <div>
                    <BarChart3 size={15} />
                    <span>Remaining</span>
                    <strong>{money(remainingAmount(row))}</strong>
                  </div>

                  <div>
                    <Users size={15} />
                    <span>Donors</span>
                    <strong>{donorCount(row)}</strong>
                  </div>
                </div>

                <div className="finance-detail-grid">
                  <div>
                    <span>Start</span>
                    <strong>{formatDate(row.start_date || row.created_at)}</strong>
                  </div>

                  <div>
                    <span>End / Due</span>
                    <strong>{formatDate(row.end_date || row.due_date)}</strong>
                  </div>

                  <div>
                    <span>Pledged</span>
                    <strong>{money(pledgedAmount(row))}</strong>
                  </div>

                  <div>
                    <span>Remaining</span>
                    <strong>{money(remainingAmount(row))}</strong>
                  </div>
                </div>

                <div className="finance-row-actions">
                  <button
                    type="button"
                    className="finance-mini-btn"
                    onClick={() => onOpenCampaign?.(row)}
                  >
                    <Eye size={13} />
                    View
                  </button>

                  <button
                    type="button"
                    className="finance-mini-btn"
                    onClick={() => onEditCampaign?.(row)}
                  >
                    <Edit3 size={13} />
                    Edit
                  </button>

                  <button
                    type="button"
                    className="finance-mini-btn"
                    onClick={() => onOpenDonors?.(row)}
                  >
                    <Users size={13} />
                    Donors
                  </button>

                  <button
                    type="button"
                    className="finance-mini-btn"
                    onClick={() => onOpenAnalytics?.(row)}
                  >
                    <BarChart3 size={13} />
                    Analytics
                  </button>

                  <button
                    type="button"
                    className="finance-mini-btn"
                    onClick={() => onSendReminder?.(row)}
                  >
                    <Send size={13} />
                    Reminder
                  </button>

                  <button
                    type="button"
                    className="finance-mini-btn"
                    onClick={() => runAction(row, active ? "deactivate" : "activate")}
                    disabled={Boolean(busyAction)}
                  >
                    {active ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                    {active ? "Deactivate" : "Activate"}
                  </button>

                  <button
                    type="button"
                    className="finance-mini-btn danger"
                    onClick={() => runAction(row, "close")}
                    disabled={Boolean(busyAction)}
                  >
                    <XCircle size={13} />
                    Close
                  </button>
                </div>
              </article>
            );
          })}
      </div>

      <div className="finance-audit-empty">
        <ShieldCheck size={15} />
        Campaign totals should reconcile with pledge schedules, paid pledge
        payments, receipts, and ledger records.
      </div>
    </section>
  );
}