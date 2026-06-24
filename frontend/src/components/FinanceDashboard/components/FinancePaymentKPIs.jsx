import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  CreditCard,
  FileText,
  Mail,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  Wallet,
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

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function responseData(response) {
  return response?.data || response || {};
}

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.payments)) return data.payments;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function summaryFromResponse(data) {
  return (
    data.summary ||
    data.kpis ||
    data.dashboard?.summary ||
    data.dashboard?.kpis ||
    data.dashboard ||
    data.data?.summary ||
    data.data?.kpis ||
    {}
  );
}

function getAmount(row) {
  return numberValue(row?.amount || row?.payment_amount || row?.total_amount);
}

function getMethod(row) {
  return normalize(row?.method || row?.payment_method || row?.payment_method_type);
}

function getStatus(row) {
  return normalize(row?.status || row?.payment_status || "pending");
}

function getCategory(row) {
  return normalize(row?.category || row?.payment_type || row?.finance_category);
}

function getEmailStatus(row) {
  return normalize(row?.email_status || row?.receipt_email_status || row?.email_delivery_status);
}

function isPaidStatus(status) {
  return ["paid", "completed", "posted", "succeeded", "success"].includes(status);
}

function isPendingStatus(status) {
  return ["pending", "processing", "open", "review"].includes(status);
}

function isFailedStatus(status) {
  return ["failed", "cancelled", "void", "returned", "declined"].includes(status);
}

function computeFromRows(rows = []) {
  const base = {
    records: rows.length,

    total_amount: 0,
    paid_amount: 0,
    pending_amount: 0,
    failed_amount: 0,
    refunded_amount: 0,

    paid_count: 0,
    pending_count: 0,
    failed_count: 0,
    refunded_count: 0,

    cash_amount: 0,
    check_amount: 0,
    zelle_amount: 0,
    card_amount: 0,
    ach_amount: 0,
    manual_amount: 0,

    cash_count: 0,
    check_count: 0,
    zelle_count: 0,
    card_count: 0,
    ach_count: 0,
    manual_count: 0,

    membership_amount: 0,
    donation_amount: 0,
    pledge_amount: 0,
    program_amount: 0,
    registration_amount: 0,

    receipt_email_sent: 0,
    receipt_email_failed: 0,

    invoice_count: 0,
    receipt_count: 0,
  };

  rows.forEach((row) => {
    const amount = getAmount(row);
    const status = getStatus(row);
    const method = getMethod(row);
    const category = getCategory(row);
    const emailStatus = getEmailStatus(row);

    base.total_amount += amount;

    if (isPaidStatus(status)) {
      base.paid_amount += amount;
      base.paid_count += 1;
    } else if (isPendingStatus(status)) {
      base.pending_amount += amount;
      base.pending_count += 1;
    } else if (isFailedStatus(status)) {
      base.failed_amount += amount;
      base.failed_count += 1;
    }

    if (status === "refunded" || numberValue(row.refunded_amount) > 0) {
      base.refunded_amount += numberValue(row.refunded_amount || amount);
      base.refunded_count += 1;
    }

    if (method === "cash") {
      base.cash_amount += amount;
      base.cash_count += 1;
      base.manual_amount += amount;
      base.manual_count += 1;
    }

    if (method === "check") {
      base.check_amount += amount;
      base.check_count += 1;
      base.manual_amount += amount;
      base.manual_count += 1;
    }

    if (method === "zelle") {
      base.zelle_amount += amount;
      base.zelle_count += 1;
      base.manual_amount += amount;
      base.manual_count += 1;
    }

    if (method === "card") {
      base.card_amount += amount;
      base.card_count += 1;
    }

    if (method === "ach" || method === "us_bank_account") {
      base.ach_amount += amount;
      base.ach_count += 1;
    }

    if (category === "membership") {
      base.membership_amount += amount;
    } else if (category === "donation") {
      base.donation_amount += amount;
    } else if (category === "pledge") {
      base.pledge_amount += amount;
    } else if (["school", "trip", "program"].includes(category)) {
      base.program_amount += amount;
    } else if (category === "registration") {
      base.registration_amount += amount;
    }

    if (emailStatus === "sent" || emailStatus === "delivered") {
      base.receipt_email_sent += 1;
    }

    if (emailStatus === "failed" || emailStatus === "bounced") {
      base.receipt_email_failed += 1;
    }

    if (row.invoice_number || row.invoice_id) {
      base.invoice_count += 1;
    }

    if (row.receipt_number || row.receipt_id) {
      base.receipt_count += 1;
    }
  });

  return base;
}

function mergeSummary(summary = {}, computed = {}) {
  const revenue = summary.revenue || {};
  const methods = summary.methods || summary.payment_methods || {};
  const categories = summary.categories || summary.by_category || {};
  const emails = summary.emails || {};

  return {
    records: numberValue(
      summary.records ||
        summary.count ||
        summary.payment_count ||
        computed.records
    ),

    total_amount: numberValue(
      summary.total_amount ||
        summary.total ||
        summary.visible_total ||
        revenue.total ||
        computed.total_amount
    ),

    paid_amount: numberValue(
      summary.paid_amount ||
        summary.successful_amount ||
        summary.completed_amount ||
        revenue.paid ||
        computed.paid_amount
    ),

    pending_amount: numberValue(
      summary.pending_amount ||
        summary.processing_amount ||
        revenue.pending ||
        computed.pending_amount
    ),

    failed_amount: numberValue(
      summary.failed_amount ||
        summary.cancelled_amount ||
        computed.failed_amount
    ),

    refunded_amount: numberValue(
      summary.refunded_amount ||
        summary.refund_amount ||
        computed.refunded_amount
    ),

    paid_count: numberValue(
      summary.paid_count ||
        summary.successful_count ||
        summary.completed_count ||
        computed.paid_count
    ),

    pending_count: numberValue(
      summary.pending_count ||
        summary.processing_count ||
        computed.pending_count
    ),

    failed_count: numberValue(
      summary.failed_count ||
        summary.cancelled_count ||
        computed.failed_count
    ),

    refunded_count: numberValue(summary.refunded_count || computed.refunded_count),

    cash_amount: numberValue(summary.cash_amount || methods.cash || computed.cash_amount),
    check_amount: numberValue(summary.check_amount || methods.check || computed.check_amount),
    zelle_amount: numberValue(summary.zelle_amount || methods.zelle || computed.zelle_amount),
    card_amount: numberValue(summary.card_amount || methods.card || computed.card_amount),
    ach_amount: numberValue(summary.ach_amount || methods.ach || computed.ach_amount),
    manual_amount: numberValue(
      summary.manual_amount ||
        methods.manual ||
        computed.manual_amount
    ),

    cash_count: numberValue(summary.cash_count || computed.cash_count),
    check_count: numberValue(summary.check_count || computed.check_count),
    zelle_count: numberValue(summary.zelle_count || computed.zelle_count),
    card_count: numberValue(summary.card_count || computed.card_count),
    ach_count: numberValue(summary.ach_count || computed.ach_count),
    manual_count: numberValue(summary.manual_count || computed.manual_count),

    membership_amount: numberValue(
      summary.membership_amount ||
        categories.membership ||
        revenue.membership ||
        computed.membership_amount
    ),

    donation_amount: numberValue(
      summary.donation_amount ||
        categories.donation ||
        revenue.donation ||
        computed.donation_amount
    ),

    pledge_amount: numberValue(
      summary.pledge_amount ||
        categories.pledge ||
        revenue.pledge ||
        computed.pledge_amount
    ),

    program_amount: numberValue(
      summary.program_amount ||
        categories.program ||
        categories.school ||
        categories.trip ||
        revenue.program ||
        computed.program_amount
    ),

    registration_amount: numberValue(
      summary.registration_amount ||
        categories.registration ||
        computed.registration_amount
    ),

    receipt_email_sent: numberValue(
      summary.receipt_email_sent ||
        emails.receipt_sent ||
        emails.sent ||
        computed.receipt_email_sent
    ),

    receipt_email_failed: numberValue(
      summary.receipt_email_failed ||
        emails.receipt_failed ||
        emails.failed ||
        computed.receipt_email_failed
    ),

    invoice_count: numberValue(
      summary.invoice_count ||
        summary.invoices ||
        computed.invoice_count
    ),

    receipt_count: numberValue(
      summary.receipt_count ||
        summary.receipts ||
        computed.receipt_count
    ),

    outstanding_invoices: numberValue(
      summary.outstanding_invoices ||
        summary.invoice_balance ||
        summary.balance_due
    ),

    outstanding_pledges: numberValue(
      summary.outstanding_pledges ||
        summary.pledge_balance ||
        summary.remaining_pledges
    ),
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

  throw lastError || new Error("Payment KPI endpoint is not available.");
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "",
  onClick,
  progress = null,
}) {
  const content = (
    <>
      <span className={`finance-kpi-icon ${tone}`}>
        <Icon size={18} />
      </span>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {sub ? <small>{sub}</small> : null}

        {progress !== null ? (
          <div className="finance-progress-track">
            <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        ) : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="finance-summary-card as-button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className="finance-summary-card">{content}</div>;
}

export default function FinancePaymentKpis({
  rows = null,
  summary = null,
  filters = {},
  autoLoad = true,
  compact = false,
  title = "Payment KPIs",
  subtitle = "Executive payment metrics across Stripe card, ACH, cash, check, Zelle, receipts, invoices, and categories.",
  onLoaded,
  onOpenPayments,
  onOpenReceipts,
  onOpenInvoices,
  onOpenPledges,
}) {
  const [remoteRows, setRemoteRows] = useState([]);
  const [remoteSummary, setRemoteSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sourceRows = Array.isArray(rows) ? rows : remoteRows;

  const computed = useMemo(() => computeFromRows(sourceRows), [sourceRows]);

  const kpis = useMemo(
    () => mergeSummary(summary || remoteSummary, computed),
    [summary, remoteSummary, computed]
  );

  const paidProgress = kpis.total_amount
    ? (kpis.paid_amount / kpis.total_amount) * 100
    : 0;

  const manualShare = kpis.total_amount
    ? (kpis.manual_amount / kpis.total_amount) * 100
    : 0;

  const onlineShare = kpis.total_amount
    ? ((kpis.card_amount + kpis.ach_amount) / kpis.total_amount) * 100
    : 0;

  async function loadKpis() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await getFirst(
        [
          "/finance/payments/kpis",
          "/finance/payments/summary",
          "/finance/dashboard/summary",
          "/finance/dashboard",
        ],
        {
          params: {
            ...filters,
            from: filters.from || filters.date_from || "",
            to: filters.to || filters.date_to || "",
            date_from: filters.from || filters.date_from || "",
            date_to: filters.to || filters.date_to || "",
          },
        }
      );

      const data = result.data?.dashboard || result.data;

      setRemoteRows(rowsFrom(data));
      setRemoteSummary(summaryFromResponse(data));
      setSuccess("Payment KPIs refreshed.");

      onLoaded?.({
        endpoint: result.endpoint,
        rows: rowsFrom(data),
        summary: summaryFromResponse(data),
      });
    } catch (err) {
      setRemoteRows([]);
      setRemoteSummary({});
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load payment KPIs."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (Array.isArray(rows)) return;
    if (!autoLoad) return;

    loadKpis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  return (
    <section className={`finance-panel ${compact ? "compact" : ""}`}>
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Finance Dashboard</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn"
            onClick={loadKpis}
            disabled={loading || Array.isArray(rows)}
          >
            <RefreshCcw size={16} />
            {loading ? "Loading..." : "Refresh"}
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
        <KpiCard
          icon={BadgeDollarSign}
          label="Total Visible"
          value={money(kpis.total_amount)}
          sub={`${kpis.records.toLocaleString()} payment record(s)`}
          onClick={() => onOpenPayments?.({ status: "" })}
        />

        <KpiCard
          icon={CheckCircle2}
          label="Paid"
          value={money(kpis.paid_amount)}
          sub={`${kpis.paid_count.toLocaleString()} successful`}
          tone="success"
          progress={paidProgress}
          onClick={() => onOpenPayments?.({ status: "paid" })}
        />

        <KpiCard
          icon={AlertTriangle}
          label="Pending"
          value={money(kpis.pending_amount)}
          sub={`${kpis.pending_count.toLocaleString()} pending`}
          tone="warning"
          onClick={() => onOpenPayments?.({ status: "pending" })}
        />

        <KpiCard
          icon={XCircleIcon}
          label="Failed / Returned"
          value={money(kpis.failed_amount)}
          sub={`${kpis.failed_count.toLocaleString()} failed`}
          tone="danger"
          onClick={() => onOpenPayments?.({ status: "failed" })}
        />

        <KpiCard
          icon={CreditCard}
          label="Card"
          value={money(kpis.card_amount)}
          sub={`${kpis.card_count.toLocaleString()} card payment(s)`}
          tone="success"
          onClick={() => onOpenPayments?.({ method: "card" })}
        />

        <KpiCard
          icon={Wallet}
          label="ACH"
          value={money(kpis.ach_amount)}
          sub={`${kpis.ach_count.toLocaleString()} ACH payment(s)`}
          tone="success"
          onClick={() => onOpenPayments?.({ method: "ach" })}
        />

        <KpiCard
          icon={Banknote}
          label="Manual"
          value={money(kpis.manual_amount)}
          sub={`${kpis.manual_count.toLocaleString()} cash/check/Zelle`}
          tone="warning"
          progress={manualShare}
          onClick={() => onOpenPayments?.({ method: "manual" })}
        />

        <KpiCard
          icon={TrendingUp}
          label="Online Share"
          value={`${onlineShare.toFixed(0)}%`}
          sub={`${money(kpis.card_amount + kpis.ach_amount)} card/ACH`}
          progress={onlineShare}
        />

        <KpiCard
          icon={ShieldCheck}
          label="Membership"
          value={money(kpis.membership_amount)}
          sub="Membership dues and registration"
          onClick={() => onOpenPayments?.({ category: "membership" })}
        />

        <KpiCard
          icon={BadgeDollarSign}
          label="Donations"
          value={money(kpis.donation_amount)}
          sub="Donation categories and funds"
          onClick={() => onOpenPayments?.({ category: "donation" })}
        />

        <KpiCard
          icon={FileText}
          label="Pledges"
          value={money(kpis.pledge_amount)}
          sub={`Outstanding ${money(kpis.outstanding_pledges)}`}
          onClick={() => onOpenPledges?.()}
        />

        <KpiCard
          icon={Receipt}
          label="Receipts"
          value={kpis.receipt_count.toLocaleString()}
          sub={`${kpis.receipt_email_sent.toLocaleString()} sent, ${kpis.receipt_email_failed.toLocaleString()} failed`}
          onClick={() => onOpenReceipts?.()}
        />

        <KpiCard
          icon={FileText}
          label="Invoices"
          value={kpis.invoice_count.toLocaleString()}
          sub={`Outstanding ${money(kpis.outstanding_invoices)}`}
          onClick={() => onOpenInvoices?.()}
        />

        <KpiCard
          icon={Mail}
          label="Receipt Emails"
          value={kpis.receipt_email_sent.toLocaleString()}
          sub={`${kpis.receipt_email_failed.toLocaleString()} failed deliveries`}
          tone={kpis.receipt_email_failed ? "warning" : "success"}
          onClick={() => onOpenReceipts?.({ email_status: "failed" })}
        />
      </div>
    </section>
  );
}

function XCircleIcon(props) {
  return <AlertTriangle {...props} />;
}