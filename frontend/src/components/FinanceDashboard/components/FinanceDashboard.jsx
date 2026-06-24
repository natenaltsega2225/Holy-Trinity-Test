//frontend\src\components\FinanceDashboard\components\FinanceDashboard.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  HandCoins,
  Landmark,
  Mail,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import api from "../../api";
// import "../../styles/finance-dashboard.css";
import "../../../styles/finance-enterprise.css";
const MODULES = [
  {
    key: "payments",
    title: "Payments",
    desc: "Card, ACH, cash, check, and Zelle transactions.",
    path: "/dash/finance/payments",
    icon: CreditCard,
  },
  {
    key: "registration",
    title: "Member Registration",
    desc: "Register members, collect first payment, send welcome access.",
    path: "/dash/finance/registration",
    icon: Users,
  },
  {
    key: "pledges",
    title: "Pledges",
    desc: "Campaign pledges, balances, reminders, and donor follow-up.",
    path: "/dash/finance/pledges",
    icon: Target,
  },
  {
    key: "invoices",
    title: "Invoices",
    desc: "Open, partial, paid, voided, and public payment links.",
    path: "/dash/finance/invoices",
    icon: FileText,
  },
  {
    key: "receipts",
    title: "Receipts",
    desc: "View, resend, download, print, and email receipt PDFs.",
    path: "/dash/finance/receipts",
    icon: Receipt,
  },
  {
    key: "reports",
    title: "Reports",
    desc: "Members, giving, pledges, programs, payments, and audit reports.",
    path: "/dash/finance/reports",
    icon: BarChart3,
  },
  {
    key: "statements",
    title: "Statements",
    desc: "Monthly, quarterly, annual, giving, membership, and pledge statements.",
    path: "/dash/finance/statements",
    icon: Landmark,
  },
  {
    key: "search",
    title: "Finance Search",
    desc: "Search by member, receipt, invoice, payment, method, date, or status.",
    path: "/dash/finance/search",
    icon: Search,
  },
];

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "all", label: "All" },
  { value: "custom", label: "Custom" },
];

function numberValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function intValue(value) {
  return numberValue(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function percent(value) {
  return `${numberValue(value).toFixed(1)}%`;
}

function readKey(source, key) {
  if (!source || !key) return undefined;

  if (!String(key).includes(".")) {
    return source[key];
  }

  return String(key)
    .split(".")
    .reduce((current, part) => {
      if (!current) return undefined;
      return current[part];
    }, source);
}

function firstValue(source, keys, fallback = null) {
  for (const key of keys) {
    const value = readKey(source, key);

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return fallback;
}

function normalizeRows(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.payments)) return value.payments;
  return [];
}

function methodTotal(source, method) {
  const key = String(method || "").toLowerCase();

  if (Array.isArray(source)) {
    const row = source.find((item) =>
      String(
        item.method ||
          item.payment_method ||
          item.type ||
          ""
      ).toLowerCase() === key
    );

    return numberValue(
      row?.amount ||
        row?.total_amount ||
        row?.total ||
        row?.payment_amount
    );
  }

  return numberValue(
    source?.[key] ||
      source?.[`${key}_amount`] ||
      source?.[`${key}_total`]
  );
}

function formatDate(value) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString();
}

function statusLabel(value) {
  return String(value || "pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusClass(value) {
  const normalized = String(value || "pending").toLowerCase();

  if (["paid", "completed", "success", "active"].includes(normalized)) {
    return "success";
  }

  if (["partial", "pending", "open", "processing"].includes(normalized)) {
    return "warning";
  }

  if (["failed", "overdue", "cancelled", "void", "inactive"].includes(normalized)) {
    return "danger";
  }

  return "neutral";
}

function buildQuery(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  return params.toString();
}

async function requestJson(path, filters = {}) {
  const query = buildQuery(filters);
  const url = query ? `${path}?${query}` : path;
  const response = await api.get(url);
  return response.data;
}

function flattenDashboard(payload) {
  const root =
    payload?.data ||
    payload?.dashboard ||
    payload?.summary ||
    payload ||
    {};

  return {
    root,
    kpis:
      root.kpis ||
      root.finance_kpis ||
      root.executive_kpis ||
      root.summary ||
      {},
    revenue:
      root.revenue ||
      root.revenue_summary ||
      root.totals ||
      {},
    methods:
      root.payment_methods ||
      root.method_summary ||
      root.paymentMethodSummary ||
      [],
    members:
      root.members ||
      root.member_summary ||
      {},
    invoices:
      root.invoices ||
      root.invoice_summary ||
      {},
    receipts:
      root.receipts ||
      root.receipt_summary ||
      {},
    payments: normalizeRows(
      root.recent_payments ||
        root.payments ||
        root.payment_rows ||
        root.rows
    ),
  };
}

function buildMetrics(dashboardPayload, pledgePayload, reminderPayload) {
  const dashboard = flattenDashboard(dashboardPayload);
  const pledgeRoot =
    pledgePayload?.data ||
    pledgePayload?.kpis ||
    pledgePayload?.summary ||
    pledgePayload ||
    {};
  const reminderRoot =
    reminderPayload?.data ||
    reminderPayload?.stats ||
    reminderPayload?.summary ||
    reminderPayload ||
    {};

  const lookup = [
    dashboard.kpis,
    dashboard.revenue,
    dashboard.root,
  ];

  function pick(keys, fallback = 0) {
    for (const source of lookup) {
      const value = firstValue(source, keys, null);

      if (value !== null) {
        return numberValue(value);
      }
    }

    return fallback;
  }

  const goalAmount = numberValue(
    firstValue(pledgeRoot, [
      "goal_amount",
      "campaign_goal",
      "total_goal",
    ], 0)
  );

  const raisedAmount = numberValue(
    firstValue(pledgeRoot, [
      "raised_amount",
      "campaign_raised",
      "total_paid",
      "paid_amount",
    ], 0)
  );

  return {
    records: pick(["records", "total_records", "payment_count"]),
    visibleTotal: pick(["visible_total", "total_revenue", "total_amount"]),
    todayRevenue: pick(["today_revenue", "todayRevenue"]),
    monthRevenue: pick(["month_revenue", "monthly_revenue", "monthRevenue"]),
    yearRevenue: pick(["year_revenue", "annual_revenue", "yearRevenue"]),

    membershipRevenue: pick(["membership_revenue", "membershipRevenue"]),
    donationRevenue: pick(["donation_revenue", "donationRevenue"]),
    programRevenue: pick(["program_revenue", "school_trip_revenue", "programRevenue"]),
    pledgeRevenue: pick(["pledge_revenue", "pledgeRevenue"]),

    cashAmount: methodTotal(dashboard.methods, "cash"),
    checkAmount: methodTotal(dashboard.methods, "check"),
    zelleAmount: methodTotal(dashboard.methods, "zelle"),
    cardAmount: methodTotal(dashboard.methods, "card"),
    achAmount: methodTotal(dashboard.methods, "ach"),

    activeMembers: numberValue(
      firstValue(dashboard.members, ["active_members", "active", "active_count"], 0)
    ),
    inactiveMembers: numberValue(
      firstValue(dashboard.members, ["inactive_members", "inactive", "inactive_count"], 0)
    ),
    unpaidMembers: numberValue(
      firstValue(dashboard.members, ["unpaid_members", "overdue_members", "open_members"], 0)
    ),

    outstandingInvoices: numberValue(
      firstValue(dashboard.invoices, ["outstanding", "open_amount", "balance_due"], 0)
    ),
    overdueInvoices: numberValue(
      firstValue(dashboard.invoices, ["overdue_count", "overdue"], 0)
    ),

    receiptEmailsSent: numberValue(
      firstValue(dashboard.receipts, ["emails_sent", "sent_count", "sent"], 0)
    ),
    receiptEmailsFailed: numberValue(
      firstValue(dashboard.receipts, ["emails_failed", "failed_count", "failed"], 0)
    ),

    pledgeGoal: goalAmount,
    pledgeRaised: raisedAmount,
    pledgeRemaining: Math.max(goalAmount - raisedAmount, 0),
    pledgeProgress: goalAmount > 0 ? (raisedAmount / goalAmount) * 100 : 0,
    activePledges: numberValue(
      firstValue(pledgeRoot, ["active_pledges", "active_count", "active"], 0)
    ),
    paidPledges: numberValue(
      firstValue(pledgeRoot, ["paid_pledges", "paid_count", "paid"], 0)
    ),
    partialPledges: numberValue(
      firstValue(pledgeRoot, ["partial_pledges", "partial_count", "partial"], 0)
    ),
    overduePledges: numberValue(
      firstValue(pledgeRoot, ["overdue_pledges", "overdue_count", "overdue"], 0)
    ),

    remindersQueued: numberValue(
      firstValue(reminderRoot, ["queued", "queued_count", "pending"], 0)
    ),
    remindersSent: numberValue(
      firstValue(reminderRoot, ["sent", "sent_count", "emails_sent"], 0)
    ),
    remindersFailed: numberValue(
      firstValue(reminderRoot, ["failed", "failed_count", "emails_failed"], 0)
    ),
  };
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}) {
  return (
    <div className={`finance-kpi-card finance-kpi-card-${tone}`}>
      <div className="finance-kpi-card-top">
        <span className="finance-kpi-icon">
          <Icon size={18} />
        </span>
        <span>{label}</span>
      </div>

      <strong>{value}</strong>

      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function ModuleCard({
  module,
  onOpen,
}) {
  const Icon = module.icon;

  return (
    <button
      type="button"
      className="finance-module-card"
      onClick={() => onOpen(module.path)}
    >
      <span className="finance-module-icon">
        <Icon size={20} />
      </span>

      <span className="finance-module-body">
        <strong>{module.title}</strong>
        <small>{module.desc}</small>
      </span>
    </button>
  );
}

export default function FinanceDashboard() {
  const navigate = useNavigate();

  const [period, setPeriod] = useState("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [payload, setPayload] = useState({
    dashboard: null,
    pledges: null,
    reminders: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const filters = useMemo(() => ({
    period,
    from: period === "custom" ? fromDate : "",
    to: period === "custom" ? toDate : "",
  }), [period, fromDate, toDate]);

  const loadDashboard = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [dashboard, pledges, reminders] = await Promise.all([
        requestJson("/finance/dashboard", filters).catch((err) => {
          console.warn("Finance dashboard endpoint failed:", err);
          return null;
        }),
        requestJson("/finance/pledges/kpis", filters).catch((err) => {
          console.warn("Pledge KPI endpoint failed:", err);
          return null;
        }),
        requestJson("/finance/pledges/reminders/stats", filters).catch((err) => {
          console.warn("Pledge reminder stats endpoint failed:", err);
          return null;
        }),
      ]);

      if (!dashboard && !pledges && !reminders) {
        throw new Error("Finance dashboard endpoints did not return data.");
      }

      setPayload({
        dashboard,
        pledges,
        reminders,
      });
    } catch (err) {
      console.error("Finance dashboard load error:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Unable to load finance dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  const dashboard = useMemo(
    () => flattenDashboard(payload.dashboard),
    [payload.dashboard]
  );

  const metrics = useMemo(
    () => buildMetrics(
      payload.dashboard,
      payload.pledges,
      payload.reminders
    ),
    [payload]
  );

  const recentPayments = dashboard.payments.slice(0, 12);

  async function exportCurrentView() {
    setError("");

    try {
      const query = buildQuery({
        ...filters,
        type: "finance_dashboard",
        format: "csv",
      });

      const response = await api.get(
        `/finance/reports/export?${query}`,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `finance-dashboard-${period}.csv`;
      link.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Finance dashboard export error:", err);
      setError(
        err?.response?.data?.error ||
          "Dashboard export is not available for this view yet."
      );
    }
  }

  return (
    <div className="finance-dashboard-page">
      <section className="finance-dashboard-header">
        <div>
          <span className="finance-eyebrow">Finance Dashboard</span>
          <h1>Finance Command Center</h1>
          <p>
            Unified finance operations for payments, pledges, invoices,
            receipts, member dues, programs, reporting, reminders, and audit.
          </p>
        </div>

        <div className="finance-dashboard-actions">
          <button
            type="button"
            className="finance-btn primary"
            onClick={() => navigate("/dash/finance/payments/new")}
          >
            <CreditCard size={16} />
            Create Payment
          </button>

          <button
            type="button"
            className="finance-btn"
            onClick={() => navigate("/dash/finance/registration")}
          >
            <Users size={16} />
            Register Member
          </button>

          <button
            type="button"
            className="finance-icon-btn"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            aria-label="Refresh dashboard"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>

          <button
            type="button"
            className="finance-icon-btn"
            onClick={exportCurrentView}
            aria-label="Export dashboard"
            title="Export"
          >
            <Download size={18} />
          </button>
        </div>
      </section>

      <section className="finance-toolbar">
        <div className="finance-period-tabs" role="tablist">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={period === item.value ? "active" : ""}
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {period === "custom" ? (
          <div className="finance-date-range">
            <label>
              From
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </label>

            <label>
              To
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </label>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="finance-alert error" role="alert">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="finance-loading-panel">
          Loading finance dashboard...
        </div>
      ) : (
        <>
          <section className="finance-kpi-grid finance-kpi-grid-executive">
            <KpiCard
              icon={TrendingUp}
              label="Today Revenue"
              value={money(metrics.todayRevenue)}
              sub="Current operating day"
              tone="success"
            />

            <KpiCard
              icon={CalendarDays}
              label="Month Revenue"
              value={money(metrics.monthRevenue)}
              sub="Current month"
              tone="primary"
            />

            <KpiCard
              icon={Landmark}
              label="Year Revenue"
              value={money(metrics.yearRevenue)}
              sub="Current fiscal year"
              tone="primary"
            />

            <KpiCard
              icon={Activity}
              label="Records"
              value={intValue(metrics.records)}
              sub="Returned from current query"
              tone="default"
            />
          </section>

          <section className="finance-kpi-grid">
            <KpiCard
              icon={Users}
              label="Membership"
              value={money(metrics.membershipRevenue)}
              sub={`${intValue(metrics.activeMembers)} active, ${intValue(metrics.unpaidMembers)} unpaid`}
              tone="primary"
            />

            <KpiCard
              icon={HandCoins}
              label="Donations"
              value={money(metrics.donationRevenue)}
              sub="Donation categories and funds"
              tone="success"
            />

            <KpiCard
              icon={WalletCards}
              label="Programs"
              value={money(metrics.programRevenue)}
              sub="School and trip registrations"
              tone="warning"
            />

            <KpiCard
              icon={Target}
              label="Pledges"
              value={money(metrics.pledgeRevenue)}
              sub={`${intValue(metrics.activePledges)} active, ${intValue(metrics.overduePledges)} overdue`}
              tone="danger"
            />
          </section>

          <section className="finance-dashboard-split">
            <div className="finance-panel">
              <div className="finance-panel-head">
                <div>
                  <h2>Payment Method Mix</h2>
                  <p>Cash, check, Zelle, card, and ACH totals.</p>
                </div>
              </div>

              <div className="finance-method-grid">
                <KpiCard icon={HandCoins} label="Cash" value={money(metrics.cashAmount)} />
                <KpiCard icon={FileText} label="Check" value={money(metrics.checkAmount)} />
                <KpiCard icon={WalletCards} label="Zelle" value={money(metrics.zelleAmount)} />
                <KpiCard icon={CreditCard} label="Card" value={money(metrics.cardAmount)} />
                <KpiCard icon={Landmark} label="ACH" value={money(metrics.achAmount)} />
              </div>
            </div>

            <div className="finance-panel">
              <div className="finance-panel-head">
                <div>
                  <h2>Pledge Progress</h2>
                  <p>Campaign goal, raised amount, and reminder queue.</p>
                </div>
              </div>

              <div className="finance-progress-summary">
                <div>
                  <span>Goal</span>
                  <strong>{money(metrics.pledgeGoal)}</strong>
                </div>

                <div>
                  <span>Raised</span>
                  <strong>{money(metrics.pledgeRaised)}</strong>
                </div>

                <div>
                  <span>Remaining</span>
                  <strong>{money(metrics.pledgeRemaining)}</strong>
                </div>

                <div>
                  <span>Complete</span>
                  <strong>{percent(metrics.pledgeProgress)}</strong>
                </div>
              </div>

              <div className="finance-progress-wrap">
                <div
                  className="finance-progress-bar"
                  style={{
                    width: `${Math.min(metrics.pledgeProgress, 100)}%`,
                  }}
                />
              </div>

              <div className="finance-mini-stats">
                <span>Paid: {intValue(metrics.paidPledges)}</span>
                <span>Partial: {intValue(metrics.partialPledges)}</span>
                <span>Queued: {intValue(metrics.remindersQueued)}</span>
                <span>Sent: {intValue(metrics.remindersSent)}</span>
                <span>Failed: {intValue(metrics.remindersFailed)}</span>
              </div>
            </div>
          </section>

          <section className="finance-dashboard-split">
            <div className="finance-panel">
              <div className="finance-panel-head">
                <div>
                  <h2>Enterprise Work Queue</h2>
                  <p>Operational items that need finance attention.</p>
                </div>
              </div>

              <div className="finance-work-queue">
                <button type="button" onClick={() => navigate("/dash/finance/invoices?status=overdue")}>
                  <AlertTriangle size={18} />
                  <span>
                    <strong>{intValue(metrics.overdueInvoices)}</strong>
                    Overdue invoices
                  </span>
                </button>

                <button type="button" onClick={() => navigate("/dash/finance/pledges?status=overdue")}>
                  <Target size={18} />
                  <span>
                    <strong>{intValue(metrics.overduePledges)}</strong>
                    Overdue pledges
                  </span>
                </button>

                <button type="button" onClick={() => navigate("/dash/finance/receipts?email_status=failed")}>
                  <Mail size={18} />
                  <span>
                    <strong>{intValue(metrics.receiptEmailsFailed)}</strong>
                    Failed receipt emails
                  </span>
                </button>

                <button type="button" onClick={() => navigate("/dash/finance/search")}>
                  <Search size={18} />
                  <span>
                    <strong>{money(metrics.outstandingInvoices)}</strong>
                    Outstanding invoices
                  </span>
                </button>
              </div>
            </div>

            <div className="finance-panel">
              <div className="finance-panel-head">
                <div>
                  <h2>Audit Readiness</h2>
                  <p>Receipt delivery, user action tracking, and finance controls.</p>
                </div>
              </div>

              <div className="finance-audit-grid">
                <KpiCard
                  icon={Mail}
                  label="Receipt Emails Sent"
                  value={intValue(metrics.receiptEmailsSent)}
                  tone="success"
                />

                <KpiCard
                  icon={ShieldCheck}
                  label="Receipt Emails Failed"
                  value={intValue(metrics.receiptEmailsFailed)}
                  tone={metrics.receiptEmailsFailed > 0 ? "danger" : "success"}
                />
              </div>
            </div>
          </section>

          <section className="finance-panel">
            <div className="finance-panel-head">
              <div>
                <h2>Recent Payments</h2>
                <p>Latest card, ACH, cash, check, Zelle, membership, donation, program, and pledge activity.</p>
              </div>

              <button
                type="button"
                className="finance-btn"
                onClick={() => navigate("/dash/finance/payments")}
              >
                View All
              </button>
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
                    <th>Status</th>
                    <th>Receipt #</th>
                  </tr>
                </thead>

                <tbody>
                  {!recentPayments.length ? (
                    <tr>
                      <td colSpan="8" className="finance-empty-state">
                        No recent payments found for this filter.
                      </td>
                    </tr>
                  ) : null}

                  {recentPayments.map((row, index) => {
                    const key =
                      row.id ||
                      row.payment_id ||
                      row.payment_number ||
                      index;

                    return (
                      <tr key={key}>
                        <td>{formatDate(row.payment_date || row.created_at || row.date)}</td>
                        <td>{row.payment_number || row.payment_no || "--"}</td>
                        <td>{row.full_name_snapshot || row.full_name || row.payer_name || row.guest_name || "--"}</td>
                        <td>{statusLabel(row.category || row.payment_type || row.type)}</td>
                        <td>{statusLabel(row.payment_method || row.method)}</td>
                        <td>{money(row.amount || row.total_amount || row.payment_amount)}</td>
                        <td>
                          <span className={`finance-status-badge ${statusClass(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td>{row.receipt_number || "--"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="finance-panel">
            <div className="finance-panel-head">
              <div>
                <h2>Finance Modules</h2>
                <p>Open the workflow your team needs.</p>
              </div>
            </div>

            <div className="finance-module-grid">
              {MODULES.map((module) => (
                <ModuleCard
                  key={module.key}
                  module={module}
                  onOpen={navigate}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}