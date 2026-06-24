import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  RefreshCcw,
  Repeat2,
  ShieldCheck,
  Sparkles,
  WalletCards,
  XCircle,
} from "lucide-react";

import api from "../../api";
import "../../../styles/member-dashboard.css";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CHECKOUT_ENDPOINTS = [
  "/checkout/member",
  "/checkout/create-session",
  "/checkout/session",
  "/checkout",
  "/payments/checkout",
];

const COVERAGE_ENDPOINTS = [
  "/subscription/coverage",
  "/membership/coverage",
  "/dues/coverage",
  "/subscription/me",
];

const PLAN_ENDPOINTS = [
  "/dues/plans",
  "/dues/plans?active=1",
  "/subscription/plans",
  "/membership/plans",
];

const SUBSCRIPTION_ENDPOINTS = [
  "/subscription/me",
  "/subscription/current",
  "/membership/subscription",
];

const SUBSCRIPTION_CHECKOUT_ENDPOINTS = [
  "/subscription/checkout",
  "/subscription/create-checkout-session",
  "/subscription/create",
  "/checkout/member",
];

const SUBSCRIPTION_CANCEL_ENDPOINTS = [
  "/subscription/cancel",
  "/subscription/disable",
  "/membership/subscription/cancel",
];

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function monthKey(year, monthIndex) {
  return `${year}-${pad2(monthIndex + 1)}`;
}

function parseJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function firstValue(source, keys, fallback = "") {
  if (!source) return fallback;

  for (const key of keys) {
    if (
      source[key] !== undefined &&
      source[key] !== null &&
      source[key] !== ""
    ) {
      return source[key];
    }
  }

  return fallback;
}

function unwrapPayload(response) {
  return response?.data ?? response;
}

function pickArray(payload) {
  const data = payload?.data;

  const candidates = [
    payload,
    data,
    data?.rows,
    data?.items,
    data?.plans,
    data?.coverage,
    data?.records,
    payload?.rows,
    payload?.items,
    payload?.plans,
    payload?.coverage,
    payload?.records,
    payload?.results,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

async function getFirstList(paths, params = {}) {
  for (const path of paths) {
    try {
      const response = await api.get(path, { params });
      const payload = unwrapPayload(response);
      const rows = pickArray(payload);
      if (rows.length) return rows;
    } catch {
      // Try next compatible backend route.
    }
  }

  return [];
}

async function getFirstObject(paths, params = {}) {
  for (const path of paths) {
    try {
      const response = await api.get(path, { params });
      const payload = unwrapPayload(response);
      const data = payload?.data && !Array.isArray(payload.data)
        ? payload.data
        : payload;

      if (data && typeof data === "object") return data;
    } catch {
      // Try next compatible backend route.
    }
  }

  return {};
}

async function postFirst(paths, payload) {
  let lastError = null;

  for (const path of paths) {
    try {
      const response = await api.post(path, payload);
      return unwrapPayload(response);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("No compatible checkout route was available.");
}

function normalizeMonthKey(value, fallbackYear) {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "number") {
    if (value >= 1 && value <= 12) return monthKey(fallbackYear, value - 1);
  }

  const raw = String(value).trim();

  const yearMonth = raw.match(/^(\d{4})[-/](\d{1,2})/);
  if (yearMonth) {
    return `${yearMonth[1]}-${pad2(yearMonth[2])}`;
  }

  if (/^\d{1,2}$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1 && n <= 12) return monthKey(fallbackYear, n - 1);
  }

  const lower = raw.toLowerCase();
  const monthIndex = FULL_MONTHS.findIndex((m) =>
    lower.includes(m.toLowerCase())
  );

  if (monthIndex >= 0) {
    const yearMatch = raw.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : fallbackYear;
    return monthKey(year, monthIndex);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return monthKey(parsed.getFullYear(), parsed.getMonth());
  }

  return null;
}

function monthRange(startKey, endKey) {
  if (!startKey || !endKey) return [];

  const [startYear, startMonth] = startKey.split("-").map(Number);
  const [endYear, endMonth] = endKey.split("-").map(Number);

  const keys = [];
  let y = startYear;
  let m = startMonth;

  while (y < endYear || (y === endYear && m <= endMonth)) {
    keys.push(`${y}-${pad2(m)}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }

    if (keys.length > 36) break;
  }

  return keys;
}

function normalizePlan(plan) {
  const duration =
    numberValue(
      firstValue(plan, [
        "duration_months",
        "coverage_months",
        "months",
        "billing_interval_count",
      ], 1)
    ) || 1;

  const amount = numberValue(
    firstValue(plan, [
      "amount",
      "price",
      "membership_amount",
      "total_amount",
      "plan_amount",
      "dues_amount",
    ], 0)
  );

  return {
    ...plan,
    id: firstValue(plan, ["id", "plan_id", "dues_plan_id", "stripe_price_id"]),
    name: firstValue(plan, ["name", "plan_name", "title"], "Membership Plan"),
    durationMonths: duration,
    amount,
    monthlyAmount:
      numberValue(firstValue(plan, ["monthly_amount", "month_amount"], 0)) ||
      amount / Math.max(duration, 1),
    isActive:
      firstValue(plan, ["is_active", "active", "status"], "active") !==
      "inactive",
  };
}

function isPaidCoverage(row) {
  const status = String(
    firstValue(row, [
      "status",
      "payment_status",
      "coverage_status",
      "ledger_status",
    ], "")
  ).toLowerCase();

  return [
    "paid",
    "covered",
    "active",
    "current",
    "completed",
    "succeeded",
    "settled",
  ].includes(status);
}

function extractCoverageKeys(row, fallbackYear) {
  const keys = new Set();

  const months = [
    ...parseJson(firstValue(row, ["coverage_months_json"], null), []),
    ...parseJson(firstValue(row, ["coverage_months"], null), []),
  ];

  months.forEach((item) => {
    const key = normalizeMonthKey(item, fallbackYear);
    if (key) keys.add(key);
  });

  const directMonth = normalizeMonthKey(
    firstValue(row, ["coverage_month", "month", "paid_month"], ""),
    Number(firstValue(row, ["coverage_year", "year"], fallbackYear))
  );

  if (directMonth) keys.add(directMonth);

  const start = normalizeMonthKey(
    firstValue(row, ["coverage_start_month", "start_month", "period_start"], ""),
    fallbackYear
  );

  const end = normalizeMonthKey(
    firstValue(row, ["coverage_end_month", "end_month", "period_end"], ""),
    fallbackYear
  );

  monthRange(start, end).forEach((key) => keys.add(key));

  return Array.from(keys);
}

function feeFor(amount, method) {
  const base = numberValue(amount);

  if (base <= 0) return 0;

  if (method === "ach") {
    return Math.min(base * 0.008, 5);
  }

  return Math.ceil(((base + 0.3) / (1 - 0.029) - base) * 100) / 100;
}

function extractCheckoutUrl(payload) {
  return (
    payload?.url ||
    payload?.checkout_url ||
    payload?.checkoutUrl ||
    payload?.payment_url ||
    payload?.paymentUrl ||
    payload?.payment_link ||
    payload?.paymentLink ||
    payload?.data?.url ||
    payload?.data?.checkout_url ||
    payload?.data?.checkoutUrl ||
    payload?.data?.payment_url ||
    payload?.session?.url ||
    payload?.stripe?.url ||
    ""
  );
}

function startOfCurrentMemberYear(meta, subscription) {
  const raw = firstValue(
    { ...subscription, ...meta },
    [
      "membership_start_date",
      "member_since",
      "joined_at",
      "start_date",
      "coverage_start_date",
      "created_at",
    ],
    ""
  );

  if (!raw) {
    return {
      year: new Date().getFullYear(),
      monthIndex: 0,
    };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return {
      year: new Date().getFullYear(),
      monthIndex: 0,
    };
  }

  return {
    year: date.getFullYear(),
    monthIndex: date.getMonth(),
  };
}

function MetricCard({ label, value, sub, icon }) {
  return (
    <article className="member-stat-card">
      <div className="member-stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </article>
  );
}

function StatusPill({ status }) {
  const value = String(status || "open").toLowerCase();

  return (
    <span className={`member-status-pill member-status-${value}`}>
      {value === "paid" ? "Paid" : value === "selected" ? "Selected" : "Open"}
    </span>
  );
}

export default function MyMembershipCoverage() {
  const today = new Date();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [plans, setPlans] = useState([]);
  const [coverageRows, setCoverageRows] = useState([]);
  const [coverageMeta, setCoverageMeta] = useState({});
  const [subscription, setSubscription] = useState({});

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [coverageCount, setCoverageCount] = useState(1);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [method, setMethod] = useState("card");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [planRows, coveragePayload, subscriptionPayload] =
        await Promise.all([
          getFirstList(PLAN_ENDPOINTS),
          getFirstObject(COVERAGE_ENDPOINTS, { year: selectedYear }),
          getFirstObject(SUBSCRIPTION_ENDPOINTS),
        ]);

      const normalizedPlans = planRows
        .map(normalizePlan)
        .filter((plan) => plan.isActive || plan.id);

      const coverageList = pickArray(coveragePayload);

      setPlans(normalizedPlans);
      setCoverageRows(coverageList);
      setCoverageMeta(coveragePayload || {});
      setSubscription(subscriptionPayload || {});

      setSelectedPlanId((current) => {
        if (current) return current;

        const subscriptionPlanId = firstValue(subscriptionPayload, [
          "plan_id",
          "dues_plan_id",
          "membership_plan_id",
        ]);

        return (
          subscriptionPlanId ||
          normalizedPlans[0]?.id ||
          ""
        );
      });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Unable to load membership coverage."
      );
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => String(plan.id) === String(selectedPlanId)) || plans[0];
  }, [plans, selectedPlanId]);

  const paidMonthKeys = useMemo(() => {
    const keys = new Set();

    coverageRows.forEach((row) => {
      if (!isPaidCoverage(row)) return;

      extractCoverageKeys(row, selectedYear).forEach((key) => keys.add(key));
    });

    return keys;
  }, [coverageRows, selectedYear]);

  const memberStart = useMemo(
    () => startOfCurrentMemberYear(coverageMeta, subscription),
    [coverageMeta, subscription]
  );

  const monthRows = useMemo(() => {
    if (selectedYear < memberStart.year) return [];

    const startMonth =
      selectedYear === memberStart.year ? memberStart.monthIndex : 0;

    return MONTHS.map((label, index) => {
      if (index < startMonth) return null;

      const key = monthKey(selectedYear, index);
      const paid = paidMonthKeys.has(key);
      const selected = selectedMonths.includes(key);

      return {
        key,
        index,
        label,
        fullLabel: `${FULL_MONTHS[index]} ${selectedYear}`,
        paid,
        selected,
        status: paid ? "paid" : selected ? "selected" : "open",
      };
    }).filter(Boolean);
  }, [memberStart, paidMonthKeys, selectedMonths, selectedYear]);

  const openMonths = useMemo(
    () => monthRows.filter((month) => !month.paid),
    [monthRows]
  );

  useEffect(() => {
    setSelectedMonths((current) => {
      const allowed = new Set(openMonths.map((month) => month.key));
      const kept = current.filter((key) => allowed.has(key));

      if (kept.length) return kept;

      return openMonths.slice(0, coverageCount).map((month) => month.key);
    });
  }, [coverageCount, openMonths]);

  const selectedMonthRows = useMemo(
    () => monthRows.filter((month) => selectedMonths.includes(month.key) && !month.paid),
    [monthRows, selectedMonths]
  );

  const baseAmount = useMemo(() => {
    if (!selectedPlan || !selectedMonthRows.length) return 0;

    const count = selectedMonthRows.length;

    if (count === selectedPlan.durationMonths) {
      return selectedPlan.amount;
    }

    return selectedPlan.monthlyAmount * count;
  }, [selectedMonthRows, selectedPlan]);

  const processingFee = useMemo(
    () => feeFor(baseAmount, method),
    [baseAmount, method]
  );

  const totalAmount = baseAmount + processingFee;

  const activeSubscription = useMemo(() => {
    const status = String(
      firstValue(subscription, ["status", "subscription_status"], "")
    ).toLowerCase();

    return ["active", "trialing", "current"].includes(status);
  }, [subscription]);

  function selectNextMonths(count) {
    setCoverageCount(count);
    setSelectedMonths(openMonths.slice(0, count).map((month) => month.key));
  }

  function toggleMonth(month) {
    if (month.paid) return;

    setSelectedMonths((current) =>
      current.includes(month.key)
        ? current.filter((key) => key !== month.key)
        : [...current, month.key]
    );
  }

  async function continueToCheckout() {
    if (!selectedPlan) {
      setError("Please select a membership plan.");
      return;
    }

    if (!selectedMonthRows.length) {
      setError("Please select at least one open coverage month.");
      return;
    }

    setActionLoading("checkout");
    setError("");
    setNotice("");

    try {
      const monthKeys = selectedMonthRows.map((month) => month.key);

      const payload = {
        source: "member_dashboard",
        created_from: "member_dashboard",
        category: "membership",
        payment_type: "membership",
        finance_type: "membership",

        method,
        payment_method: method,

        plan_id: selectedPlan.id,
        membership_plan_id: selectedPlan.id,
        plan_name: selectedPlan.name,
        billing_cycle: selectedPlan.durationMonths,

        coverage_year: selectedYear,
        coverage_months: monthKeys,
        coverage_months_json: JSON.stringify(monthKeys),
        coverage_start_month: monthKeys[0],
        coverage_end_month: monthKeys[monthKeys.length - 1],
        coverage_label: selectedMonthRows.map((month) => month.fullLabel).join(", "),
        months_count: monthKeys.length,

        amount: baseAmount,
        base_amount: baseAmount,
        subtotal_amount: baseAmount,
        processing_fee: processingFee,
        total_amount: totalAmount,

        create_invoice: 1,
        send_invoice_email: 1,
        send_receipt_email: 1,
        attach_invoice_pdf: 1,
        attach_receipt_pdf: 1,
      };

      const result = await postFirst(CHECKOUT_ENDPOINTS, payload);
      const url = extractCheckoutUrl(result);

      if (!url) {
        throw new Error("Checkout was created, but no Stripe checkout URL was returned.");
      }

      window.location.assign(url);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Unable to start secure checkout."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function setupAutoRenew() {
    if (!selectedPlan) {
      setError("Please select a membership plan.");
      return;
    }

    setActionLoading("subscription");
    setError("");
    setNotice("");

    try {
      const payload = {
        source: "member_dashboard",
        created_from: "member_dashboard",
        category: "membership",
        payment_type: "membership",
        subscription_mode: true,
        auto_renew: true,

        method,
        payment_method: method,

        plan_id: selectedPlan.id,
        membership_plan_id: selectedPlan.id,
        plan_name: selectedPlan.name,
        billing_cycle: selectedPlan.durationMonths,

        create_invoice: 1,
        send_invoice_email: 1,
        send_receipt_email: 1,
      };

      const result = await postFirst(SUBSCRIPTION_CHECKOUT_ENDPOINTS, payload);
      const url = extractCheckoutUrl(result);

      if (url) {
        window.location.assign(url);
        return;
      }

      setNotice("Auto-renew settings were updated.");
      await loadPage();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Unable to update auto-renew."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function cancelAutoRenew() {
    setActionLoading("cancel-subscription");
    setError("");
    setNotice("");

    try {
      await postFirst(SUBSCRIPTION_CANCEL_ENDPOINTS, {
        source: "member_dashboard",
        cancel_at_period_end: true,
      });

      setNotice("Auto-renew was cancelled. Your current paid coverage remains active.");
      await loadPage();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Unable to cancel auto-renew."
      );
    } finally {
      setActionLoading("");
    }
  }

  const paidCount = monthRows.filter((month) => month.paid).length;
  const openCount = monthRows.filter((month) => !month.paid).length;

  return (
    <main className="member-dashboard-page member-coverage-page">
      <section className="member-page-hero">
        <div>
          <span className="member-eyebrow">Membership Coverage</span>
          <h1>My Membership Coverage</h1>
          <p>
            Review paid and open months, avoid duplicate payments, and manage
            auto-renew membership checkout.
          </p>
        </div>

        <button
          type="button"
          className="member-btn member-btn-light"
          onClick={loadPage}
          disabled={loading}
        >
          <RefreshCcw size={17} className={loading ? "member-spin" : ""} />
          Refresh
        </button>
      </section>

      {error ? (
        <div className="member-alert member-alert-danger">
          <AlertTriangle size={18} />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="member-alert member-alert-success">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      ) : null}

      <section className="member-summary-grid">
        <MetricCard
          icon={<ShieldCheck size={18} />}
          label="Paid Months"
          value={paidCount}
          sub={`${selectedYear} coverage`}
        />
        <MetricCard
          icon={<CalendarCheck size={18} />}
          label="Open Months"
          value={openCount}
          sub="Available for checkout"
        />
        <MetricCard
          icon={<Repeat2 size={18} />}
          label="Auto-Renew"
          value={activeSubscription ? "On" : "Off"}
          sub={selectedPlan?.name || "No plan selected"}
        />
        <MetricCard
          icon={<WalletCards size={18} />}
          label="Selected Total"
          value={money(totalAmount)}
          sub={`${money(processingFee)} processing fee`}
        />
      </section>

      <section className="member-panel-grid">
        <article className="member-card member-card-wide">
          <div className="member-section-header">
            <div>
              <h2>Coverage Months</h2>
              <p>
                Months before your membership start date are hidden. Paid months
                cannot be selected again.
              </p>
            </div>

            <label className="member-field member-year-field">
              <span>Year</span>
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
              >
                {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(
                  (year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="member-empty-state">
              <RefreshCcw size={22} className="member-spin" />
              Loading coverage...
            </div>
          ) : null}

          {!loading && !monthRows.length ? (
            <div className="member-empty-state">
              No membership months are available for this year.
            </div>
          ) : null}

          {!loading && monthRows.length ? (
            <div className="member-month-grid">
              {monthRows.map((month) => (
                <button
                  key={month.key}
                  type="button"
                  className={`member-month-card member-month-${month.status}`}
                  disabled={month.paid}
                  onClick={() => toggleMonth(month)}
                >
                  <span>{month.label}</span>
                  <strong>{month.fullLabel}</strong>
                  <StatusPill status={month.status} />
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <aside className="member-card member-checkout-card">
          <div className="member-section-header">
            <div>
              <h2>Checkout</h2>
              <p>Pay only open months. Invoice and receipt PDFs are emailed after payment.</p>
            </div>
            <Sparkles size={20} />
          </div>

          <label className="member-field">
            <span>Membership Plan</span>
            <select
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(event.target.value)}
            >
              {!plans.length ? <option value="">No plans available</option> : null}
              {plans.map((plan) => (
                <option key={plan.id || plan.name} value={plan.id}>
                  {plan.name} - {money(plan.amount)}
                </option>
              ))}
            </select>
          </label>

          <label className="member-field">
            <span>Coverage Length</span>
            <select
              value={coverageCount}
              onChange={(event) => selectNextMonths(Number(event.target.value))}
            >
              {[1, 3, 6, 12].map((count) => (
                <option key={count} value={count}>
                  Next {count} month{count > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="member-field">
            <span>Payment Method</span>
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="card">Card</option>
              <option value="ach">ACH / Bank</option>
            </select>
          </label>

          <div className="member-checkout-summary">
            <div>
              <span>Selected Months</span>
              <strong>{selectedMonthRows.length}</strong>
            </div>
            <div>
              <span>Base Amount</span>
              <strong>{money(baseAmount)}</strong>
            </div>
            <div>
              <span>{method === "ach" ? "ACH Fee" : "Card Processing Fee"}</span>
              <strong>{money(processingFee)}</strong>
            </div>
            <div className="member-total-row">
              <span>Total Checkout</span>
              <strong>{money(totalAmount)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="member-btn member-btn-primary member-btn-full"
            onClick={continueToCheckout}
            disabled={
              !selectedPlan ||
              !selectedMonthRows.length ||
              actionLoading === "checkout"
            }
          >
            <CreditCard size={18} />
            {actionLoading === "checkout"
              ? "Starting Checkout..."
              : "Continue To Secure Checkout"}
          </button>

          <div className="member-divider" />

          <h3>Auto-Renew</h3>
          <p className="member-muted">
            Set up or change your recurring membership plan. Stripe securely
            manages card and ACH billing.
          </p>

          <button
            type="button"
            className="member-btn member-btn-light member-btn-full"
            onClick={setupAutoRenew}
            disabled={!selectedPlan || actionLoading === "subscription"}
          >
            <Repeat2 size={18} />
            {activeSubscription ? "Change Auto-Renew Plan" : "Set Up Auto-Renew"}
          </button>

          {activeSubscription ? (
            <button
              type="button"
              className="member-btn member-btn-danger member-btn-full"
              onClick={cancelAutoRenew}
              disabled={actionLoading === "cancel-subscription"}
            >
              <XCircle size={18} />
              Cancel Auto-Renew
            </button>
          ) : null}
        </aside>
      </section>
    </main>
  );
}