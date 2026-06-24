// frontend/src/components/FinanceDashboard/pages/Overview.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  HandCoins,
  Mail,
  Receipt,
  RefreshCcw,
  Search,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";

import api from "../../api";
import FinancePaymentModal from "../components/FinancePaymentModal";
import "../../../styles/finance-enterprise.css";

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return `$${numberValue(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function firstValue(source = {}, keys = [], fallback = "") {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusTone(value) {
  const status = String(value || "").toLowerCase();

  if (["paid", "completed", "success", "active", "sent", "issued"].includes(status)) {
    return "success";
  }

  if (["pending", "open", "partial", "queued", "processing"].includes(status)) {
    return "warning";
  }

  if (["failed", "overdue", "cancelled", "void", "inactive"].includes(status)) {
    return "danger";
  }

  return "neutral";
}

function StatusBadge({ value }) {
  return (
    <span className={`finance-status-badge ${statusTone(value)}`}>
      {pretty(value)}
    </span>
  );
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function getDashboard(data = {}) {
  return data.dashboard || data.data?.dashboard || data.data || data || {};
}

function findCard(cards = [], keys = []) {
  const normalizedKeys = keys.map((key) => String(key).toLowerCase());

  return cards.find((card) => {
    const key = String(card.key || card.id || card.title || card.label || "").toLowerCase();
    return normalizedKeys.some((needle) => key.includes(needle));
  });
}

function cardValue(cards, keys, fallback = 0) {
  const card = findCard(cards, keys);
  return numberValue(card?.value ?? card?.amount ?? card?.total ?? fallback);
}

function amountFromRow(row = {}) {
  return numberValue(firstValue(row, ["amount", "total", "value", "revenue"], 0));
}

function countFromRow(row = {}) {
  return numberValue(firstValue(row, ["count", "transactions", "records"], 0));
}

function normalizeCategoryKey(value) {
  const raw = String(value || "other").toLowerCase();

  if (raw.includes("member")) return "membership";
  if (raw.includes("pledge")) return "pledge";
  if (raw.includes("school") || raw.includes("kids")) return "school";
  if (raw.includes("trip")) return "trip";

  if (
    raw.includes("donation") ||
    raw.includes("fund") ||
    raw.includes("tithe") ||
    raw.includes("vow") ||
    raw.includes("plate") ||
    raw.includes("candle") ||
    raw.includes("baptism") ||
    raw.includes("wedding") ||
    raw.includes("memorial")
  ) {
    return "donation";
  }

  return raw && raw !== "--" ? raw.replace(/[^a-z0-9]+/g, "_") : "other";
}

function normalizeCategoryLabel(key) {
  const labels = {
    membership: "Membership",
    donation: "Donation",
    pledge: "Pledge",
    trip: "Trip",
    school: "School",
    other: "Other",
  };

  return labels[key] || pretty(key);
}

function normalizeMethodKey(value) {
  const raw = String(value || "other").toLowerCase();

  if (raw.includes("ach") || raw.includes("bank") || raw.includes("us_bank")) return "ach";
  if (
    raw.includes("card") ||
    raw.includes("stripe") ||
    raw.includes("visa") ||
    raw.includes("mastercard") ||
    raw.includes("amex")
  ) {
    return "card";
  }
  if (raw.includes("cash")) return "cash";
  if (raw.includes("check") || raw.includes("cheque")) return "check";
  if (raw.includes("zelle")) return "zelle";

  return raw && raw !== "--" ? raw.replace(/[^a-z0-9]+/g, "_") : "other";
}

function normalizeMethodLabel(key) {
  const labels = {
    card: "Card",
    ach: "ACH",
    cash: "Cash",
    check: "Check",
    zelle: "Zelle",
    other: "Other",
  };

  return labels[key] || pretty(key);
}

function mergeCategoryBreakdown(rows = [], summary = {}) {
  const order = ["membership", "donation", "pledge", "trip", "school", "other"];
  const map = new Map(
    order.map((key) => [
      key,
      {
        key,
        category: key,
        label: normalizeCategoryLabel(key),
        amount: 0,
        count: 0,
      },
    ])
  );

  const sourceRows = arrayValue(rows);

  for (const row of sourceRows) {
    const key = normalizeCategoryKey(firstValue(row, ["category", "label", "name", "key"], "other"));
    const existing =
      map.get(key) || {
        key,
        category: key,
        label: normalizeCategoryLabel(key),
        amount: 0,
        count: 0,
      };

    existing.amount += amountFromRow(row);
    existing.count += countFromRow(row);
    map.set(key, existing);
  }

  if (!sourceRows.length) {
    map.get("membership").amount = numberValue(summary.membership_payments);
    map.get("donation").amount = numberValue(summary.donation_payments);
    map.get("pledge").amount = numberValue(summary.pledge_payments);
    map.get("trip").amount = numberValue(summary.trip_program_payments);
    map.get("school").amount = numberValue(summary.school_program_payments);
  }

  return Array.from(map.values()).sort((a, b) => {
    const aIndex = order.indexOf(a.key);
    const bIndex = order.indexOf(b.key);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
}

function mergeMethodBreakdown(rows = []) {
  const order = ["card", "ach", "cash", "check", "zelle", "other"];
  const map = new Map(
    order.map((key) => [
      key,
      {
        key,
        method: key,
        label: normalizeMethodLabel(key),
        amount: 0,
        count: 0,
      },
    ])
  );

  for (const row of arrayValue(rows)) {
    const key = normalizeMethodKey(firstValue(row, ["method", "payment_method", "label", "name", "key"], "other"));
    const existing =
      map.get(key) || {
        key,
        method: key,
        label: normalizeMethodLabel(key),
        amount: 0,
        count: 0,
      };

    existing.amount += amountFromRow(row);
    existing.count += countFromRow(row);
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => {
    const aIndex = order.indexOf(a.key);
    const bIndex = order.indexOf(b.key);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
}

function totalFor(rows = [], key) {
  return arrayValue(rows).find((row) => row.key === key)?.amount || 0;
}

function normalizePayment(row = {}) {
  return {
    id: row.id || row.payment_id,
    number: firstValue(row, ["payment_number", "payment_no"], "--"),
    name: firstValue(row, ["payer_name", "full_name_snapshot", "member_name", "donor_name"], "Guest Donor"),
    memberNo: firstValue(row, ["member_no", "member_number"], "Guest"),
    category: firstValue(row, ["category", "payment_type"], "--"),
    method: firstValue(row, ["method", "payment_method"], "--"),
    amount: numberValue(firstValue(row, ["amount", "total_amount"], 0)),
    status: firstValue(row, ["status", "payment_status"], "--"),
    date: firstValue(row, ["paid_at", "created_at", "date"], ""),
    receiptNumber: firstValue(row, ["receipt_number"], ""),
    invoiceNumber: firstValue(row, ["invoice_number"], ""),
  };
}

function normalizeInvoice(row = {}) {
  return {
    id: row.id || row.invoice_id,
    number: firstValue(row, ["invoice_number", "invoice_no"], "--"),
    name: firstValue(row, ["bill_to", "payer_name", "full_name_snapshot", "member_name"], "Guest Donor"),
    memberNo: firstValue(row, ["member_no", "member_number"], "Guest"),
    category: firstValue(row, ["category", "invoice_type", "payment_type"], "--"),
    total: numberValue(firstValue(row, ["total_amount", "amount"], 0)),
    paid: numberValue(firstValue(row, ["paid_amount", "amount_paid"], 0)),
    balance: numberValue(firstValue(row, ["balance_due", "remaining_amount"], 0)),
    status: firstValue(row, ["status", "invoice_status"], "--"),
    date: firstValue(row, ["invoice_date", "created_at"], ""),
  };
}

function normalizeReceipt(row = {}) {
  return {
    id: row.id || row.receipt_id,
    number: firstValue(row, ["receipt_number", "receipt_no"], "--"),
    name: firstValue(row, ["payer_name", "full_name_snapshot", "member_name", "donor_name"], "Guest Donor"),
    amount: numberValue(firstValue(row, ["amount", "receipt_amount"], 0)),
    status: firstValue(row, ["status"], "--"),
    emailStatus: firstValue(row, ["email_status", "receipt_email_status"], "not_sent"),
    date: firstValue(row, ["issued_at", "created_at"], ""),
  };
}

function normalizePledge(row = {}) {
  const pledged = numberValue(firstValue(row, ["pledged_amount", "pledge_amount", "amount"], 0));
  const paid = numberValue(firstValue(row, ["paid_amount", "amount_paid"], 0));
  const remaining = numberValue(
    firstValue(row, ["remaining_amount", "remaining_balance", "balance_due"], Math.max(pledged - paid, 0))
  );

  return {
    id: row.id || row.pledge_id,
    number: firstValue(row, ["pledge_number", "number"], "--"),
    name: firstValue(row, ["donor_name", "full_name_snapshot", "member_name", "guest_name"], "Guest Donor"),
    campaign: firstValue(row, ["campaign_name", "campaign"], "--"),
    pledged,
    paid,
    remaining,
    status: firstValue(row, ["status"], "--"),
    due: firstValue(row, ["due_date"], ""),
  };
}

function BarRow({ label, value, max, colorClass = "" }) {
  const percent = max > 0 ? Math.min(100, Math.round((numberValue(value) / max) * 100)) : 0;

  return (
    <div className="finance-bar-row">
      <div className="finance-bar-row-top">
        <span>{label}</span>
        <strong>{money(value)}</strong>
      </div>

      <div className="finance-bar-track">
        <span
          className={`finance-bar-fill ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function MiniTable({ title, icon: Icon, rows, empty, columns, action }) {
  return (
    <section className="finance-panel">
      <div className="finance-section-head finance-section-head-between">
        <div>
          <Icon size={17} />
          <h2>{title}</h2>
        </div>

        {action || null}
      </div>

      {!rows.length ? (
        <div className="finance-empty-state">{empty}</div>
      ) : (
        <div className="finance-table-wrap">
          <table className="finance-table finance-compact-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key || column.label}>{column.label}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || row.number || index}>
                  {columns.map((column) => (
                    <td key={column.key || column.label}>
                      {column.render ? column.render(row[column.key], row) : row[column.key] ?? "--"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Overview() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [report, setReport] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");
  const [paymentModalConfig, setPaymentModalConfig] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const query = params.toString();
      const dashboardPath = `/finance/dashboard${query ? `?${query}` : ""}`;
      const reportPath = `/finance/reports/enterprise${query ? `?${query}` : ""}`;

      const [dashboardResult, reportResult] = await Promise.allSettled([
        api.get(dashboardPath),
        api.get(reportPath),
      ]);

      if (dashboardResult.status === "fulfilled") {
        setDashboard(getDashboard(dashboardResult.value.data || {}));
      } else {
        setDashboard(null);
      }

      if (reportResult.status === "fulfilled") {
        const data = reportResult.value.data || {};
        setReport(data.report || data.data?.report || data);
      } else {
        setReport(null);
      }

      if (dashboardResult.status === "rejected" && reportResult.status === "rejected") {
        throw dashboardResult.reason || reportResult.reason;
      }
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load finance dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const model = useMemo(() => {
    const d = dashboard || {};
    const r = report || {};
    const cards = arrayValue(d.cards);

    const revenue = d.summary?.revenue || d.revenue || {};
    const invoices = d.summary?.invoices || d.invoices || {};
    const pledges = d.summary?.pledges || d.pledges || {};
    const members = d.summary?.members || d.members || {};
    const programs = d.summary?.programs || d.programs || {};
    const emails = d.summary?.emails || d.emails || {};

    const recent = d.recent || {};
    const breakdowns = d.breakdowns || {};
    const trends = d.trends || {};
    const lists = d.lists || {};
    const reportSummary = r.summary || {};
    const reportBreakdowns = r.breakdowns || {};
    const reportLists = r.lists || {};
    const summaryForBreakdowns = {
      ...reportSummary,
      membership_payments:
        numberValue(reportSummary.membership_payments) ||
        numberValue(revenue.by_category?.membership) ||
        numberValue(revenue.membership),
      donation_payments:
        numberValue(reportSummary.donation_payments) ||
        numberValue(revenue.by_category?.donation) ||
        numberValue(revenue.donation),
      pledge_payments:
        numberValue(reportSummary.pledge_payments) ||
        numberValue(pledges.paid) ||
        numberValue(revenue.pledge),
      school_program_payments:
        numberValue(reportSummary.school_program_payments) ||
        numberValue(revenue.by_category?.school),
      trip_program_payments:
        numberValue(reportSummary.trip_program_payments) ||
        numberValue(revenue.by_category?.trip),
    };
    const dashboardMethodRows = [
      { method: "card", amount: numberValue(revenue.by_method?.card) || numberValue(revenue.card) },
      { method: "ach", amount: numberValue(revenue.by_method?.ach) || numberValue(revenue.ach) },
      { method: "cash", amount: numberValue(revenue.by_method?.cash) || numberValue(revenue.cash) },
      { method: "check", amount: numberValue(revenue.by_method?.check) || numberValue(revenue.check) },
      { method: "zelle", amount: numberValue(revenue.by_method?.zelle) || numberValue(revenue.zelle) },
    ];

    const revenueByCategory = mergeCategoryBreakdown(
      arrayValue(reportBreakdowns.revenue_by_category).length
        ? reportBreakdowns.revenue_by_category
        : breakdowns.revenue_by_category,
      summaryForBreakdowns
    );

    const paymentMethods = mergeMethodBreakdown(
      arrayValue(reportBreakdowns.payment_methods).length
        ? reportBreakdowns.payment_methods
        : arrayValue(breakdowns.payment_methods).length
          ? breakdowns.payment_methods
          : dashboardMethodRows
    );

    const schoolProgramRevenue = numberValue(reportSummary.school_program_payments);
    const tripProgramRevenue = numberValue(reportSummary.trip_program_payments);
    const programRevenue = schoolProgramRevenue + tripProgramRevenue;
    const programRows = arrayValue(reportLists.program_rows);
    const schoolRows =
      arrayValue(lists.school_registrations).length
        ? arrayValue(lists.school_registrations)
        : programRows.filter((row) => normalizeCategoryKey(row.category) === "school");
    const tripRows =
      arrayValue(lists.trip_registrations).length
        ? arrayValue(lists.trip_registrations)
        : programRows.filter((row) => normalizeCategoryKey(row.category) === "trip");

    return {
      cards,

      totalRevenue:
        numberValue(reportSummary.total_revenue) ||
        numberValue(revenue.total) ||
        cardValue(cards, ["total revenue", "total_payments"], 0),

      onlinePayments: numberValue(reportSummary.online_payments),
      manualPayments: numberValue(reportSummary.manual_payments),

      membershipRevenue:
        numberValue(reportSummary.membership_payments) ||
        numberValue(revenue.by_category?.membership) ||
        numberValue(revenue.membership) ||
        cardValue(cards, ["membership"], 0),

      donationRevenue:
        numberValue(reportSummary.donation_payments) ||
        numberValue(revenue.by_category?.donation) ||
        numberValue(revenue.donation) ||
        cardValue(cards, ["donation"], 0),

      programRevenue:
        programRevenue ||
        numberValue(programs.revenue) ||
        numberValue(revenue.program) ||
        cardValue(cards, ["program", "school", "trip"], 0),

      pledgeRevenue:
        numberValue(reportSummary.pledge_payments) ||
        numberValue(pledges.paid) ||
        numberValue(revenue.pledge) ||
        cardValue(cards, ["pledge_revenue", "pledge paid"], 0),

      cash: totalFor(paymentMethods, "cash"),
      check: totalFor(paymentMethods, "check"),
      zelle: totalFor(paymentMethods, "zelle"),
      card: totalFor(paymentMethods, "card"),
      ach: totalFor(paymentMethods, "ach"),

      outstandingInvoices:
        numberValue(reportSummary.outstanding_invoices) ||
        numberValue(invoices.balance_due) ||
        numberValue(invoices.outstanding) ||
        cardValue(cards, ["outstanding invoice", "invoice balance"], 0),

      outstandingPledges:
        numberValue(reportSummary.outstanding_pledges) ||
        numberValue(pledges.remaining) ||
        numberValue(pledges.outstanding) ||
        cardValue(cards, ["outstanding pledge", "pledge balance"], 0),

      activeMembers:
        numberValue(reportSummary.active_members) ||
        numberValue(members.active) ||
        cardValue(cards, ["active member"], 0),
      unpaidMembers:
        numberValue(reportSummary.unpaid_members) ||
        numberValue(members.unpaid) ||
        arrayValue(lists.unpaid_members).length ||
        cardValue(cards, ["unpaid member"], 0),

      membersAndDependents: numberValue(reportSummary.total_members_and_dependents),

      receiptEmailsSent:
        numberValue(emails.receipt_sent) ||
        numberValue(emails.sent) ||
        cardValue(cards, ["email sent", "receipt sent"], 0),

      receiptEmailsFailed:
        numberValue(emails.receipt_failed) ||
        numberValue(emails.failed) ||
        cardValue(cards, ["email failed", "receipt failed"], 0),

      recentPayments: (
        arrayValue(recent.payments).length ? arrayValue(recent.payments) : arrayValue(reportLists.payment_rows)
      ).map(normalizePayment),
      recentInvoices: arrayValue(recent.invoices).map(normalizeInvoice),
      recentReceipts: arrayValue(recent.receipts).map(normalizeReceipt),
      recentPledges: (
        arrayValue(recent.pledges).length ? arrayValue(recent.pledges) : arrayValue(reportLists.pledge_rows)
      ).map(normalizePledge),
      auditAlerts: arrayValue(recent.audit_alerts),

      revenueByCategory,
      paymentMethods,

      monthlyTrend: arrayValue(trends.monthly_revenue),
      dailyTrend: arrayValue(trends.daily_revenue),
      unpaidMemberRows:
        arrayValue(lists.unpaid_members).length ? arrayValue(lists.unpaid_members) : arrayValue(reportLists.unpaid_members),
      schoolRows,
      tripRows,
      generatedAt: r.generated_at || d.generated_at,
    };
  }, [dashboard, report]);

  const maxCategory = useMemo(
    () =>
      Math.max(
        1,
        ...model.revenueByCategory.map((row) =>
          numberValue(firstValue(row, ["amount", "total", "value"], 0))
        )
      ),
    [model.revenueByCategory]
  );

  const maxMethod = useMemo(
    () =>
      Math.max(
        1,
        ...model.paymentMethods.map((row) =>
          numberValue(firstValue(row, ["amount", "total", "value"], 0))
        )
      ),
    [model.paymentMethods]
  );

  function openFinanceModal(defaultWorkflow = "payment", defaultPaymentType = "membership") {
    setPaymentModalConfig({
      open: true,
      defaultWorkflow,
      defaultPaymentType,
      key: `${defaultWorkflow}-${defaultPaymentType}-${Date.now()}`,
    });
  }

  function closeFinanceModal() {
    setPaymentModalConfig(null);
  }

  function handleFinanceModalSaved() {
    closeFinanceModal();
    setSuccessText("Finance workflow completed successfully.");
    loadDashboard();
  }
  function quickSearch() {
    navigate("/dash/finance/members");
  }

  return (

    <div className="finance-page finance-overview-page">
      
      <div className="finance-page-header">
        <div>
          <p className="finance-eyebrow">Finance Dashboard</p>
          <h1>Finance Overview</h1>
          <p className="finance-page-subtitle">
            Executive visibility for payments, pledges, invoices, receipts, membership,
            programs, ledger health, and follow-up work.
          </p>
        </div>

        <div className="finance-page-actions">
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            aria-label="From date"
          />

          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-label="To date"
          />

          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={loadDashboard}
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? "finance-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {successText ? (
        <div className="finance-alert finance-alert-success">
          <CheckCircle2 size={17} />
          <span>{successText}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="finance-loading-panel">
          <RefreshCcw size={18} className="finance-spin" />
          Loading dashboard...
        </div>
      ) : null}

      <div className="finance-action-grid">
        <button
          type="button"
          className="finance-action-tile"
          onClick={() => navigate("/dash/finance/registration")}
        >
          <UserPlus size={18} />
          <span>Register Member</span>
        </button>

        <button
          type="button"
          className="finance-action-tile"
          onClick={() => openFinanceModal("payment", "membership")}
        >
          <CreditCard size={18} />
          <span>Collect Payment</span>
        </button>

        <button
          type="button"
          className="finance-action-tile"
          onClick={() => navigate("/dash/finance/invoice-generator")}
        >
          <FileText size={18} />
          <span>Create Invoice</span>
        </button>

        <button
          type="button"
          className="finance-action-tile"
          onClick={() => openFinanceModal("pledge", "pledge")}
        >
          <Target size={18} />
          <span>Create Pledge</span>
        </button>

        <button
          type="button"
          className="finance-action-tile"
          onClick={() => navigate("/dash/finance/receipts")}
        >
          <Receipt size={18} />
          <span>Receipt Center</span>
        </button>

        <button
          type="button"
          className="finance-action-tile"
          onClick={quickSearch}
        >
          <Search size={18} />
          <span>Member Search</span>
        </button>
      </div>

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <span>Total Revenue</span>
          <strong>{money(model.totalRevenue)}</strong>
          <small>All matched paid activity</small>
        </div>

        <div className="finance-summary-card">
          <span>Online Payments</span>
          <strong>{money(model.onlinePayments)}</strong>
          <small>Card and ACH checkout</small>
        </div>

        <div className="finance-summary-card">
          <span>Manual Payments</span>
          <strong>{money(model.manualPayments)}</strong>
          <small>Cash, check, and Zelle</small>
        </div>

        <div className="finance-summary-card">
          <span>Outstanding Invoices</span>
          <strong>{money(model.outstandingInvoices)}</strong>
          <small>Open invoice balance</small>
        </div>

        <div className="finance-summary-card">
          <span>Outstanding Pledges</span>
          <strong>{money(model.outstandingPledges)}</strong>
          <small>Pledge remaining</small>
        </div>
      </div>

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <span>Membership</span>
          <strong>{money(model.membershipRevenue)}</strong>
          <small>
            {model.activeMembers.toLocaleString()} active /{" "}
            {model.membersAndDependents.toLocaleString()} total with dependents
          </small>
        </div>

        <div className="finance-summary-card">
          <span>Donation</span>
          <strong>{money(model.donationRevenue)}</strong>
          <small>Giving and funds</small>
        </div>

        <div className="finance-summary-card">
          <span>Programs</span>
          <strong>{money(model.programRevenue)}</strong>
          <small>School and trip</small>
        </div>

        <div className="finance-summary-card">
          <span>Pledge Revenue</span>
          <strong>{money(model.pledgeRevenue)}</strong>
          <small>Collected pledges</small>
        </div>

        <div className="finance-summary-card">
          <span>Email Failures</span>
          <strong>{model.receiptEmailsFailed.toLocaleString()}</strong>
          <small>{model.receiptEmailsSent.toLocaleString()} sent</small>
        </div>
      </div>

<div className="finance-grid finance-grid-2">

  {/* Revenue By Category */}
  <section className="finance-panel finance-insight-panel">
    <div className="finance-section-head">
      <TrendingUp size={18} />
      <h2>Revenue By Category</h2>
    </div>

    <div className="finance-insight-list">
      {model.revenueByCategory.map((row, index) => {
        const label = firstValue(
          row,
          ["label", "category", "name"],
          `Category ${index + 1}`
        );

        const value = numberValue(
          firstValue(row, ["amount", "total", "value"], 0)
        );

        return (
          <div
            key={`${label}-${index}`}
            className="finance-insight-row"
          >
            <div className="finance-insight-left">
              <div className="finance-insight-dot finance-dot-category" />
              <span>{pretty(label)}</span>
            </div>

            <strong>{money(value)}</strong>
          </div>
        );
      })}
    </div>
  </section>

  {/* Payment Methods */}
  <section className="finance-panel finance-insight-panel">
    <div className="finance-section-head">
      <WalletCards size={18} />
      <h2>Payment Methods</h2>
    </div>

    <div className="finance-insight-list">
      {model.paymentMethods.map((row, index) => {
        const label = firstValue(
          row,
          ["label", "method", "name"],
          `Method ${index + 1}`
        );

        const value = numberValue(
          firstValue(row, ["amount", "total", "value"], 0)
        );

        return (
          <div
            key={`${label}-${index}`}
            className="finance-insight-row"
          >
            <div className="finance-insight-left">
              <div className="finance-insight-dot finance-dot-method" />
              <span>{pretty(label)}</span>
            </div>

            <strong>{money(value)}</strong>
          </div>
        );
      })}
    </div>
  </section>

</div>
      {/* <div className="finance-grid finance-grid-2">
        <section className="finance-panel">
          <div className="finance-section-head">
            <TrendingUp size={17} />
            <h2>Revenue By Category</h2>
          </div>

          <div className="finance-bar-list">
            {model.revenueByCategory.map((row, index) => {
              const label = firstValue(row, ["label", "category", "name"], `Category ${index + 1}`);
              const value = numberValue(firstValue(row, ["amount", "total", "value"], 0));

              return (
                <BarRow
                  key={`${label}-${index}`}
                  label={pretty(label)}
                  value={value}
                  max={maxCategory}
                  colorClass="category"
                />
              );
            })}
          </div>
        </section>

        <section className="finance-panel">
          <div className="finance-section-head">
            <WalletCards size={17} />
            <h2>Payment Methods</h2>
          </div>

          <div className="finance-bar-list">
            {model.paymentMethods.map((row, index) => {
              const label = firstValue(row, ["label", "method", "name"], `Method ${index + 1}`);
              const value = numberValue(firstValue(row, ["amount", "total", "value"], 0));

              return (
                <BarRow
                  key={`${label}-${index}`}
                  label={pretty(label)}
                  value={value}
                  max={maxMethod}
                  colorClass="method"
                />
              );
            })}
          </div>
        </section>
      </div> */}

      <div className="finance-grid finance-grid-2">
        <MiniTable
          title="Recent Payments"
          icon={CreditCard}
          rows={model.recentPayments.slice(0, 8)}
          empty="No recent payments."
          action={
            <button
              type="button"
              className="finance-mini-button"
              onClick={() => navigate("/dash/finance/payments")}
            >
              View All
            </button>
          }
          columns={[
            { key: "date", label: "Date", render: (value) => formatDate(value) },
            { key: "name", label: "Payer" },
            { key: "category", label: "Category", render: (value) => pretty(value) },
            { key: "amount", label: "Amount", render: (value) => money(value) },
            { key: "status", label: "Status", render: (value) => <StatusBadge value={value} /> },
          ]}
        />

        <MiniTable
          title="Recent Invoices"
          icon={FileText}
          rows={model.recentInvoices.slice(0, 8)}
          empty="No recent invoices."
          action={
            <button
              type="button"
              className="finance-mini-button"
              onClick={() => navigate("/dash/finance/invoices")}
            >
              View All
            </button>
          }
          columns={[
            { key: "number", label: "Invoice #" },
            { key: "name", label: "Bill To" },
            { key: "total", label: "Total", render: (value) => money(value) },
            { key: "balance", label: "Balance", render: (value) => money(value) },
            { key: "status", label: "Status", render: (value) => <StatusBadge value={value} /> },
          ]}
        />

        <MiniTable
          title="Recent Receipts"
          icon={Receipt}
          rows={model.recentReceipts.slice(0, 8)}
          empty="No recent receipts."
          action={
            <button
              type="button"
              className="finance-mini-button"
              onClick={() => navigate("/dash/finance/receipts")}
            >
              View All
            </button>
          }
          columns={[
            { key: "number", label: "Receipt #" },
            { key: "name", label: "Payer" },
            { key: "amount", label: "Amount", render: (value) => money(value) },
            { key: "emailStatus", label: "Email", render: (value) => <StatusBadge value={value} /> },
          ]}
        />

        <MiniTable
          title="Recent Pledges"
          icon={Target}
          rows={model.recentPledges.slice(0, 8)}
          empty="No recent pledges."
          action={
            <button
              type="button"
              className="finance-mini-button"
              onClick={() => openFinanceModal("pledge", "pledge")}
            >
              View All
            </button>
          }
          columns={[
            { key: "name", label: "Donor" },
            { key: "campaign", label: "Campaign" },
            { key: "remaining", label: "Remaining", render: (value) => money(value) },
            { key: "status", label: "Status", render: (value) => <StatusBadge value={value} /> },
          ]}
        />
      </div>

      <div className="finance-grid finance-grid-2">
        <section className="finance-panel">
          <div className="finance-section-head">
            <Users size={17} />
            <h2>Follow-Up Work</h2>
          </div>

          <div className="finance-followup-grid">
            <button
              type="button"
              onClick={() => navigate("/dash/finance/members?status=unpaid")}
            >
              <Users size={17} />
              <span>Unpaid Members</span>
              <strong>{model.unpaidMembers.toLocaleString()}</strong>
            </button>

            <button
              type="button"
              onClick={() => navigate("/dash/finance/invoices?status=open")}
            >
              <FileText size={17} />
              <span>Open Invoices</span>
              <strong>{money(model.outstandingInvoices)}</strong>
            </button>

            <button
              type="button"
              onClick={() => openFinanceModal("pledge", "pledge")}
            >
              <HandCoins size={17} />
              <span>Open Pledges</span>
              <strong>{money(model.outstandingPledges)}</strong>
            </button>

            <button
              type="button"
              onClick={() => navigate("/dash/finance/notifications")}
            >
              <Mail size={17} />
              <span>Email Failures</span>
              <strong>{model.receiptEmailsFailed.toLocaleString()}</strong>
            </button>
          </div>
        </section>

        <section className="finance-panel">
          <div className="finance-section-head">
            <CalendarDays size={17} />
            <h2>Dashboard Health</h2>
          </div>

          <div className="finance-detail-grid">
            <div>
              <span>Generated</span>
              <strong>{model.generatedAt ? formatDate(model.generatedAt) : "--"}</strong>
            </div>

            <div>
              <span>Audit Alerts</span>
              <strong>{model.auditAlerts.length.toLocaleString()}</strong>
            </div>

            <div>
              <span>School Registrations</span>
              <strong>{model.schoolRows.length.toLocaleString()}</strong>
            </div>

            <div>
              <span>Trip Registrations</span>
              <strong>{model.tripRows.length.toLocaleString()}</strong>
            </div>
          </div>

          {model.auditAlerts.length ? (
            <div className="finance-alert-list">
              {model.auditAlerts.slice(0, 4).map((alert, index) => (
                <div key={alert.id || index} className="finance-alert-row">
                  <AlertTriangle size={15} />
                  <span>
                    {firstValue(alert, ["message", "details", "action"], "Audit alert")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="finance-empty-state">No audit alerts in this view.</div>
          )}
        </section>
      </div>
      {paymentModalConfig?.open ? (
        <FinancePaymentModal
          key={paymentModalConfig.key}
          open={paymentModalConfig.open}
          defaultWorkflow={paymentModalConfig.defaultWorkflow}
          defaultPaymentType={paymentModalConfig.defaultPaymentType}
          onClose={closeFinanceModal}
          onSuccess={handleFinanceModalSaved}
          onSaved={handleFinanceModalSaved}
        />
      ) : null}
    </div>
  );
}
