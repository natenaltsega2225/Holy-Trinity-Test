import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  HeartHandshake,
  RefreshCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../../api";

const DASHBOARD_ENDPOINTS = [
  "/membership/dashboard",
  "/member/dashboard",
  "/members/me/dashboard",
  "/membership/me/dashboard",
];

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
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

function clean(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") {
      return row[key];
    }
  }

  return fallback;
}

function firstArray(row, keys) {
  for (const key of keys) {
    if (Array.isArray(row?.[key])) return row[key];
  }

  return [];
}

async function requestFirstAvailable(endpoints) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      return await api.get(endpoint);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

function normalizeDashboardPayload(response) {
  const body = response?.data?.data || response?.data || {};
  const payload = body.dashboard || body;

  return {
    member:
      payload.member ||
      payload.profile ||
      payload.user ||
      payload.account ||
      {},

    stats:
      payload.stats ||
      payload.summary ||
      payload.totals ||
      {},

    coverage:
      payload.coverage ||
      payload.membership_coverage ||
      payload.membershipCoverage ||
      payload.current_coverage ||
      {},

    payments: firstArray(payload, [
      "recent_payments",
      "recentPayments",
      "payments",
      "payment_rows",
    ]),

    invoices: firstArray(payload, [
      "open_invoices",
      "recent_invoices",
      "invoices",
      "invoice_rows",
    ]),

    dependents: firstArray(payload, [
      "dependents",
      "family",
      "household_members",
    ]),

    requests: firstArray(payload, [
      "requests",
      "service_requests",
      "member_requests",
    ]),

    documents: firstArray(payload, [
      "documents",
      "files",
      "member_documents",
    ]),
  };
}

function paymentAmount(row) {
  return Number(
    firstValue(row, ["amount", "total_amount", "paid_amount", "payment_amount"], 0)
  );
}

function invoiceBalance(row) {
  return Number(
    firstValue(row, ["balance_due", "balance", "remaining_balance", "total_amount"], 0)
  );
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["paid", "active", "sent", "current", "completed", "success"].includes(status)) {
    return "member-badge-success";
  }

  if (["open", "pending", "due", "processing"].includes(status)) {
    return "member-badge-warning";
  }

  if (["failed", "overdue", "cancelled", "canceled", "expired"].includes(status)) {
    return "member-badge-danger";
  }

  return "member-badge-neutral";
}

function StatusBadge({ value }) {
  const label = clean(value, "Unknown");

  return (
    <span className={`member-badge ${statusClass(label)}`}>
      {label}
    </span>
  );
}

function SummaryCard({ icon, label, value, sub, actionLabel, onAction }) {
  return (
    <article className="member-summary-card">
      <div className="member-card-icon">{icon}</div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {sub ? <small>{sub}</small> : null}
      </div>

      {onAction ? (
        <button type="button" className="member-card-link" onClick={onAction}>
          {actionLabel || "Open"}
          <ArrowRight size={14} />
        </button>
      ) : null}
    </article>
  );
}

export default function DashboardHome() {
  const navigate = useNavigate();

  const [data, setData] = useState({
    member: {},
    stats: {},
    coverage: {},
    payments: [],
    invoices: [],
    dependents: [],
    requests: [],
    documents: [],
  });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const response = await requestFirstAvailable(DASHBOARD_ENDPOINTS);
      setData(normalizeDashboardPayload(response));
    } catch (error) {
      console.error("Unable to load member dashboard:", error);
      setErr(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Unable to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const memberName = useMemo(() => {
    const first = clean(
      firstValue(data.member, ["first_name", "firstName"], ""),
      ""
    );
    const last = clean(
      firstValue(data.member, ["last_name", "lastName"], ""),
      ""
    );

    return (
      clean(
        firstValue(data.member, ["full_name", "name", "member_name"], ""),
        `${first} ${last}`.trim()
      ) || "Member"
    );
  }, [data.member]);

  const memberNo = clean(
    firstValue(data.member, ["member_no", "member_number", "member_id"], ""),
    "--"
  );

  const totalPaid = Number(
    firstValue(data.stats, ["total_paid", "paid_total", "total_contributions"], 0)
  );

  const balanceDue = Number(
    firstValue(data.stats, ["balance_due", "open_balance", "outstanding_balance"], 0)
  );

  const yearGiving = Number(
    firstValue(data.stats, ["year_giving", "annual_total", "statement_total"], totalPaid)
  );

  const openInvoiceCount = Number(
    firstValue(data.stats, ["open_invoice_count", "invoice_count"], data.invoices.length)
  );

  const coverageStatus = clean(
    firstValue(data.coverage, ["status", "coverage_status", "membership_status"], ""),
    "Not Active"
  );

  const coveragePlan = clean(
    firstValue(data.coverage, ["plan_name", "plan", "membership_plan"], ""),
    "No active plan"
  );

  const coverageEnd = firstValue(data.coverage, [
    "coverage_end",
    "end_date",
    "membership_end_date",
    "expires_at",
  ]);

  const latestPayment = data.payments[0];

  return (
    <main className="membership-dashboard-page">
      <section className="member-page-hero">
        <div>
          <span className="member-eyebrow">Member Dashboard</span>
          <h1>Welcome, {memberName}</h1>
          <p className="member-page-subtitle">
            Review membership coverage, payments, invoices, giving statements,
            family records, and church documents from one secure dashboard.
          </p>
        </div>

        <div className="member-page-actions">
          <button
            type="button"
            className="member-btn member-btn-light"
            onClick={load}
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? "member-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="member-btn member-btn-primary"
            onClick={() => navigate("/dash/membership/my-payments/make-payment")}
          >
            <CreditCard size={16} />
            Make Payment
          </button>
        </div>
      </section>

      {err ? (
        <div className="member-alert member-alert-danger">
          <AlertTriangle size={16} />
          {err}
        </div>
      ) : null}

      <section className="member-summary-grid">
        <SummaryCard
          icon={<ShieldCheck size={19} />}
          label="Coverage"
          value={coverageStatus}
          sub={coverageEnd ? `Through ${formatDate(coverageEnd)}` : coveragePlan}
          actionLabel="View"
          onAction={() => navigate("/dash/membership/membership-coverage")}
        />

        <SummaryCard
          icon={<CreditCard size={19} />}
          label="Total Paid"
          value={money(totalPaid)}
          sub="Recorded payments"
          actionLabel="Payments"
          onAction={() => navigate("/dash/membership/my-payments")}
        />

        <SummaryCard
          icon={<FileText size={19} />}
          label="Open Balance"
          value={money(balanceDue)}
          sub={`${openInvoiceCount} open invoice(s)`}
          actionLabel="Invoices"
          onAction={() => navigate("/dash/membership/invoices-receipts")}
        />

        <SummaryCard
          icon={<Download size={19} />}
          label="Year Giving"
          value={money(yearGiving)}
          sub="Annual statement total"
          actionLabel="Statement"
          onAction={() => navigate("/dash/membership/giving-statements")}
        />

        <SummaryCard
          icon={<Users size={19} />}
          label="Family"
          value={data.dependents.length}
          sub="Dependent records"
          actionLabel="Manage"
          onAction={() => navigate("/dash/membership/family")}
        />

        <SummaryCard
          icon={<FolderOpen size={19} />}
          label="Documents"
          value={data.documents.length}
          sub="Available files"
          actionLabel="Open"
          onAction={() => navigate("/dash/membership/documents")}
        />
      </section>

      <section className="member-dashboard-grid">
        <article className="member-card member-card-feature">
          <div className="member-section-header">
            <div>
              <span className="member-eyebrow">Membership</span>
              <h2>Current Coverage</h2>
            </div>

            <StatusBadge value={coverageStatus} />
          </div>

          <div className="member-detail-grid">
            <div>
              <span>Member</span>
              <strong>{memberName}</strong>
              <small>{memberNo}</small>
            </div>

            <div>
              <span>Plan</span>
              <strong>{coveragePlan}</strong>
              <small>
                {formatDate(
                  firstValue(data.coverage, [
                    "coverage_start",
                    "start_date",
                    "membership_start_date",
                  ])
                )}{" "}
                - {formatDate(coverageEnd)}
              </small>
            </div>

            <div>
              <span>Latest Payment</span>
              <strong>{latestPayment ? money(paymentAmount(latestPayment)) : "$0.00"}</strong>
              <small>
                {latestPayment
                  ? formatDate(
                      firstValue(latestPayment, [
                        "payment_date",
                        "paid_at",
                        "received_at",
                        "created_at",
                      ])
                    )
                  : "No payment found"}
              </small>
            </div>
          </div>

          <div className="member-card-actions">
            <button
              type="button"
              className="member-btn member-btn-primary"
              onClick={() => navigate("/dash/membership/membership-coverage")}
            >
              <CalendarDays size={16} />
              Renew or Manage
            </button>

            <button
              type="button"
              className="member-btn member-btn-light"
              onClick={() => navigate("/dash/membership/giving-statements")}
            >
              <Download size={16} />
              Annual Statement
            </button>
          </div>
        </article>

        <article className="member-card">
          <div className="member-section-header">
            <div>
              <span className="member-eyebrow">Giving</span>
              <h2>Contribution Statement</h2>
            </div>
            <HeartHandshake size={22} />
          </div>

          <p className="member-muted">
            Download or email your official annual contribution statement for
            donations, membership, school, trip, and pledge payments.
          </p>

          <div className="member-statement-total">{money(yearGiving)}</div>

          <button
            type="button"
            className="member-btn member-btn-primary member-full-width"
            onClick={() => navigate("/dash/membership/giving-statements")}
          >
            <FileText size={16} />
            Open Giving Statements
          </button>
        </article>
      </section>

      <section className="member-dashboard-grid">
        <article className="member-card">
          <div className="member-section-header">
            <div>
              <span className="member-eyebrow">Payments</span>
              <h2>Recent Payments</h2>
            </div>

            <button
              type="button"
              className="member-btn member-btn-light member-btn-sm"
              onClick={() => navigate("/dash/membership/my-payments")}
            >
              View All
            </button>
          </div>

          <div className="member-table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Method</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {data.payments.slice(0, 5).map((row, index) => (
                  <tr key={row.id || row.payment_number || index}>
                    <td>
                      {formatDate(
                        firstValue(row, [
                          "payment_date",
                          "paid_at",
                          "received_at",
                          "created_at",
                        ])
                      )}
                    </td>
                    <td>{clean(firstValue(row, ["category", "payment_type", "type"]))}</td>
                    <td>{clean(firstValue(row, ["payment_method", "method"]))}</td>
                    <td>{money(paymentAmount(row))}</td>
                  </tr>
                ))}

                {!data.payments.length ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="member-empty-state">
                        No recent payments found.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="member-card">
          <div className="member-section-header">
            <div>
              <span className="member-eyebrow">Invoices</span>
              <h2>Open Invoices</h2>
            </div>

            <button
              type="button"
              className="member-btn member-btn-light member-btn-sm"
              onClick={() => navigate("/dash/membership/invoices-receipts")}
            >
              View All
            </button>
          </div>

          <div className="member-table-wrap">
            <table className="member-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Balance</th>
                </tr>
              </thead>

              <tbody>
                {data.invoices.slice(0, 5).map((row, index) => (
                  <tr key={row.id || row.invoice_number || index}>
                    <td>{clean(firstValue(row, ["invoice_number", "number"]))}</td>
                    <td>{formatDate(firstValue(row, ["due_date", "due_at"]))}</td>
                    <td>
                      <StatusBadge value={firstValue(row, ["status"], "open")} />
                    </td>
                    <td>{money(invoiceBalance(row))}</td>
                  </tr>
                ))}

                {!data.invoices.length ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="member-empty-state">
                        No open invoices found.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="member-dashboard-grid">
        <article className="member-card">
          <div className="member-section-header">
            <div>
              <span className="member-eyebrow">Family</span>
              <h2>Dependents</h2>
            </div>
          </div>

          <p className="member-muted">
            Manage household and dependent information connected to your member
            profile.
          </p>

          <button
            type="button"
            className="member-btn member-btn-light"
            onClick={() => navigate("/dash/membership/family")}
          >
            <Users size={16} />
            Manage Family
          </button>
        </article>

        <article className="member-card">
          <div className="member-section-header">
            <div>
              <span className="member-eyebrow">Requests</span>
              <h2>Member Requests</h2>
            </div>

            <StatusBadge value={`${data.requests.length} Open`} />
          </div>

          <p className="member-muted">
            Submit or track member service requests, document requests, and
            profile update needs.
          </p>

          <button
            type="button"
            className="member-btn member-btn-light"
            onClick={() => navigate("/dash/membership/myrequests")}
          >
            <ArrowRight size={16} />
            Open Requests
          </button>
        </article>
      </section>
    </main>
  );
}