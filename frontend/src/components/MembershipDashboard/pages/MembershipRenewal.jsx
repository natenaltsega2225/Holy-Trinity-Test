import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCcw,
  Repeat,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";

import api from "../../api";
import "../../../styles/member-dashboard.css";

const MONTHS = [
  { index: 1, short: "Jan", label: "January" },
  { index: 2, short: "Feb", label: "February" },
  { index: 3, short: "Mar", label: "March" },
  { index: 4, short: "Apr", label: "April" },
  { index: 5, short: "May", label: "May" },
  { index: 6, short: "Jun", label: "June" },
  { index: 7, short: "Jul", label: "July" },
  { index: 8, short: "Aug", label: "August" },
  { index: 9, short: "Sep", label: "September" },
  { index: 10, short: "Oct", label: "October" },
  { index: 11, short: "Nov", label: "November" },
  { index: 12, short: "Dec", label: "December" },
];

const PROFILE_ENDPOINTS = ["/membership/me", "/membership/profile", "/member/profile"];
const PLAN_ENDPOINTS = ["/dues/plans", "/membership/plans", "/membership/dues-plans"];
const COVERAGE_ENDPOINTS = [
  "/membership/coverage",
  "/membership/my-coverage",
  "/member/membership-coverage",
];
const SUBSCRIPTION_ENDPOINTS = [
  "/subscription/me",
  "/membership/subscription",
  "/member/subscription",
];

const CHECKOUT_ENDPOINTS = [
  "/checkout/member",
  "/checkout/self-service",
  "/checkout",
  "/payments/member/checkout",
  "/payments/checkout",
];

const SUBSCRIPTION_SETUP_ENDPOINTS = [
  "/subscription/checkout",
  "/subscription/create-checkout",
  "/subscription/setup",
  "/membership/subscription/checkout",
  "/membership/subscription/setup",
];

const SUBSCRIPTION_CANCEL_ENDPOINTS = [
  "/subscription/cancel",
  "/membership/subscription/cancel",
  "/member/subscription/cancel",
];

function clean(value, fallback = "--") {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || fallback;
}

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function boolValue(value) {
  if (value === true || value === 1) return true;
  const text = String(value || "").toLowerCase();
  return ["1", "true", "yes", "active", "enabled"].includes(text);
}

function roundMoney(value) {
  return Math.round((numberValue(value) + Number.EPSILON) * 100) / 100;
}

function money(value) {
  return roundMoney(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "--";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthKey(year, monthIndex) {
  return `${year}-${String(monthIndex).padStart(2, "0")}`;
}

function monthDateFromKey(key) {
  const [year, month] = String(key || "").split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, 1);
}

function monthLabelFromKey(key) {
  const date = monthDateFromKey(key);
  if (!date) return clean(key);
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return fallback;
}

function unwrapObject(payload) {
  const data = payload?.data ?? payload;
  if (data?.data && !Array.isArray(data.data)) return data.data;
  if (data?.profile) return data.profile;
  if (data?.member) return data.member;
  if (data?.user) return data.user;
  return data || {};
}

function unwrapArray(payload, keys = []) {
  const data = payload?.data ?? payload;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data?.[key])) return data.data[key];
  }

  return [];
}

async function getFirst(endpoints, config = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint, config);
      return response;
    } catch (error) {
      const status = error?.response?.status;
      lastError = error;

      if (![404, 405].includes(status)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("No available API route.");
}

async function postFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.post(endpoint, payload);
      return response;
    } catch (error) {
      const status = error?.response?.status;
      lastError = error;

      if (![404, 405].includes(status)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("No available API route.");
}

function responseCheckoutUrl(response) {
  const data = response?.data || {};
  return (
    data.url ||
    data.checkout_url ||
    data.checkoutUrl ||
    data.payment_link ||
    data.paymentLink ||
    data.session_url ||
    data.data?.url ||
    data.data?.checkout_url ||
    data.data?.payment_link ||
    ""
  );
}

function redirectToCheckout(url) {
  if (!url) return false;
  window.location.assign(url);
  return true;
}

function memberId(profile) {
  return firstValue(profile, ["member_id", "id", "user_id"], null);
}

function memberNo(profile) {
  return firstValue(profile, ["member_no", "member_number", "memberId"], "");
}

function memberName(profile) {
  const full = firstValue(profile, ["full_name", "name"], "");
  if (full) return full;

  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Member";
}

function memberEmail(profile) {
  return firstValue(profile, ["email", "member_email"], "");
}

function memberPhone(profile) {
  return firstValue(profile, ["phone", "mobile", "member_phone"], "");
}

function memberStartDate(profile) {
  return (
    firstValue(profile, [
      "membership_start_date",
      "start_date",
      "joined_at",
      "registration_date",
      "created_at",
    ]) || todayIso()
  );
}

function planId(plan) {
  return String(firstValue(plan, ["id", "plan_id", "membership_plan_id"], ""));
}

function planName(plan) {
  return clean(firstValue(plan, ["name", "plan_name", "title"], "Membership Plan"));
}

function planAmount(plan) {
  return roundMoney(
    firstValue(plan, ["amount", "price", "monthly_amount", "membership_amount", "total_amount"], 0)
  );
}

function planDurationMonths(plan) {
  const direct = numberValue(
    firstValue(plan, ["duration_months", "months", "coverage_months", "term_months"], 0)
  );

  if (direct > 0) return direct;

  const cycle = String(firstValue(plan, ["billing_cycle", "cycle", "interval"], "")).toLowerCase();

  if (cycle.includes("annual") || cycle.includes("year")) return 12;
  if (cycle.includes("semi")) return 6;
  if (cycle.includes("quarter")) return 3;

  return 1;
}

function planMonthlyRate(plan) {
  const duration = Math.max(1, planDurationMonths(plan));
  return roundMoney(planAmount(plan) / duration);
}

function isPlanActive(plan) {
  const raw = firstValue(plan, ["is_active", "active", "status"], "active");
  return raw === 1 || raw === true || String(raw).toLowerCase() === "active";
}

function coverageKey(row) {
  const direct = firstValue(row, [
    "month_key",
    "coverage_month",
    "month",
    "period_month",
    "coverage_period",
  ]);

  if (/^\d{4}-\d{2}$/.test(String(direct))) return String(direct);

  const startDate = parseDate(
    firstValue(row, ["coverage_start_date", "start_date", "period_start", "paid_for_month"], "")
  );

  if (startDate) {
    return monthKey(startDate.getFullYear(), startDate.getMonth() + 1);
  }

  const year = numberValue(firstValue(row, ["year", "coverage_year"], 0));
  const month = numberValue(firstValue(row, ["month_number", "coverage_month_number"], 0));

  if (year && month) return monthKey(year, month);

  return "";
}

function coverageStatus(row) {
  const status = String(
    firstValue(row, ["status", "coverage_status", "payment_status", "invoice_status"], "")
  ).toLowerCase();

  if (["paid", "active", "covered", "complete", "completed"].includes(status)) return "paid";
  if (["pending", "open", "processing", "invoiced"].includes(status)) return "pending";
  if (["failed", "cancelled", "canceled", "void", "refunded"].includes(status)) return "open";

  return numberValue(firstValue(row, ["paid_amount", "amount_paid"], 0)) > 0 ? "paid" : "open";
}

function unwrapCoverageRows(payload) {
  const data = payload?.data ?? payload;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;

  const keys = [
    "months",
    "coverage_months",
    "coverage",
    "rows",
    "items",
    "records",
    "payments",
  ];

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data?.[key])) return data.data[key];
  }

  if (data?.by_month && typeof data.by_month === "object") {
    return Object.entries(data.by_month).map(([key, value]) => ({
      month_key: key,
      ...(typeof value === "object" ? value : { status: value }),
    }));
  }

  return [];
}

function subscriptionStatus(subscription) {
  return String(
    firstValue(subscription, ["status", "subscription_status", "stripe_status"], "inactive")
  ).toLowerCase();
}

function subscriptionActive(subscription) {
  return ["active", "trialing", "past_due"].includes(subscriptionStatus(subscription));
}

function processingFee(amount, method) {
  const base = roundMoney(amount);

  if (base <= 0) return 0;

  if (method === "ach") {
    return roundMoney(Math.min(base * 0.008, 5));
  }

  return roundMoney(base / (1 - 0.029) + 0.3 - base);
}

function makeReference(prefix = "MEM-RENEW") {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();

  return `${prefix}-${Date.now()}-${random}`;
}

export default function MembershipRenewal() {
  const currentYear = new Date().getFullYear();

  const [profile, setProfile] = useState({});
  const [plans, setPlans] = useState([]);
  const [coverageRows, setCoverageRows] = useState([]);
  const [subscription, setSubscription] = useState({});

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [selectedMonthKeys, setSelectedMonthKeys] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activePlans = useMemo(() => plans.filter(isPlanActive), [plans]);

  const selectedPlan = useMemo(() => {
    return activePlans.find((plan) => planId(plan) === selectedPlanId) || activePlans[0] || {};
  }, [activePlans, selectedPlanId]);

  const selectedPlanDuration = Math.max(1, planDurationMonths(selectedPlan));
  const selectedPlanMonthlyRate = planMonthlyRate(selectedPlan);

  const startDate = useMemo(() => parseDate(memberStartDate(profile)) || new Date(), [profile]);
  const startYear = startDate.getFullYear();

  const yearOptions = useMemo(() => {
    const first = Math.min(startYear, currentYear);
    const last = Math.max(currentYear + 1, startYear + 1);
    const years = [];

    for (let year = first; year <= last; year += 1) {
      years.push(year);
    }

    return years;
  }, [currentYear, startYear]);

  const coverageMap = useMemo(() => {
    const map = new Map();

    for (const row of coverageRows) {
      const key = coverageKey(row);
      if (!key) continue;

      const existing = map.get(key);
      const nextStatus = coverageStatus(row);

      if (!existing || existing.status !== "paid") {
        map.set(key, {
          key,
          status: nextStatus,
          row,
        });
      }
    }

    return map;
  }, [coverageRows]);

  const visibleMonths = useMemo(() => {
    return MONTHS.map((month) => {
      const key = monthKey(selectedYear, month.index);
      const record = coverageMap.get(key);

      const beforeStartYear = selectedYear < startYear;
      const beforeStartMonth =
        selectedYear === startYear && month.index < startDate.getMonth() + 1;

      const hidden = beforeStartYear || beforeStartMonth;
      const status = hidden ? "not_available" : record?.status || "open";

      return {
        ...month,
        key,
        hidden,
        status,
        selectable: !hidden && status === "open",
      };
    }).filter((month) => !month.hidden);
  }, [coverageMap, selectedYear, startDate, startYear]);

  const visibleMonthsSignature = visibleMonths
    .map((month) => `${month.key}:${month.status}`)
    .join("|");

  useEffect(() => {
    if (activePlans.length && !selectedPlanId) {
      setSelectedPlanId(planId(activePlans[0]));
    }
  }, [activePlans, selectedPlanId]);

  useEffect(() => {
    const availableKeys = visibleMonths
      .filter((month) => month.selectable)
      .map((month) => month.key);

    setSelectedMonthKeys((current) => {
      const cleaned = current.filter((key) => availableKeys.includes(key));

      if (cleaned.length) {
        return cleaned.slice(0, selectedPlanDuration);
      }

      return availableKeys.slice(0, selectedPlanDuration);
    });
  }, [selectedPlanDuration, visibleMonthsSignature]);

  async function load() {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const [profileResponse, planResponse, coverageResponse, subscriptionResponse] =
        await Promise.allSettled([
          getFirst(PROFILE_ENDPOINTS),
          getFirst(PLAN_ENDPOINTS),
          getFirst(COVERAGE_ENDPOINTS, { params: { year: selectedYear } }),
          getFirst(SUBSCRIPTION_ENDPOINTS),
        ]);

      if (profileResponse.status === "fulfilled") {
        setProfile(unwrapObject(profileResponse.value));
      }

      if (planResponse.status === "fulfilled") {
        setPlans(unwrapArray(planResponse.value, ["plans", "rows", "items", "records"]));
      }

      if (coverageResponse.status === "fulfilled") {
        setCoverageRows(unwrapCoverageRows(coverageResponse.value));
      }

      if (subscriptionResponse.status === "fulfilled") {
        setSubscription(unwrapObject(subscriptionResponse.value));
      }

      if (profileResponse.status === "rejected") {
        throw profileResponse.reason;
      }
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.details ||
          err?.response?.data?.error ||
          "Unable to load membership renewal information."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const selectedBaseAmount = useMemo(() => {
    const count = selectedMonthKeys.length;

    if (!selectedPlan || !count) return 0;

    if (count === selectedPlanDuration) {
      return roundMoney(planAmount(selectedPlan));
    }

    return roundMoney(selectedPlanMonthlyRate * count);
  }, [selectedMonthKeys.length, selectedPlan, selectedPlanDuration, selectedPlanMonthlyRate]);

  const fee = processingFee(selectedBaseAmount, paymentMethod);
  const totalAmount = roundMoney(selectedBaseAmount + fee);

  const paidMonths = visibleMonths.filter((month) => month.status === "paid").length;
  const pendingMonths = visibleMonths.filter((month) => month.status === "pending").length;
  const openMonths = visibleMonths.filter((month) => month.status === "open").length;
  const nextOpenMonth = visibleMonths.find((month) => month.status === "open");

  function toggleMonth(key) {
    const month = visibleMonths.find((item) => item.key === key);

    if (!month?.selectable) return;

    setSelectedMonthKeys((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key);
      }

      if (current.length >= selectedPlanDuration) {
        return [...current.slice(1), key].sort();
      }

      return [...current, key].sort();
    });
  }

  async function startRenewalCheckout() {
    if (!memberId(profile) && !memberNo(profile)) {
      setError("Member profile is missing. Please refresh and try again.");
      return;
    }

    if (!selectedPlanId) {
      setError("Please select a membership renewal plan.");
      return;
    }

    if (!selectedMonthKeys.length) {
      setError("No open renewal months are selected.");
      return;
    }

    setError("");
    setNotice("");
    setActionLoading("checkout");

    const reference = makeReference();

    const lineItems = [
      {
        item_type: "membership",
        type: "membership_renewal",
        name: "Membership Renewal",
        description: `${planName(selectedPlan)} - ${selectedMonthKeys
          .map(monthLabelFromKey)
          .join(", ")}`,
        quantity: 1,
        unit_amount: selectedBaseAmount,
        amount: selectedBaseAmount,
        category: "membership",
      },
    ];

    if (fee > 0) {
      lineItems.push({
        item_type: "processing_fee",
        type: "processing_fee",
        name: paymentMethod === "ach" ? "ACH Processing Fee" : "Card Processing Fee",
        quantity: 1,
        unit_amount: fee,
        amount: fee,
        category: "processing_fee",
      });
    }

    const payload = {
      source: "member_dashboard",
      checkout_context: "membership_renewal",
      created_from: "member_membership_renewal",

      payment_type: "membership",
      category: "membership",
      payment_method: paymentMethod,
      method: paymentMethod,

      member_id: memberId(profile),
      member_no: memberNo(profile),
      full_name: memberName(profile),
      email: memberEmail(profile),
      phone: memberPhone(profile),

      plan_id: selectedPlanId,
      membership_plan_id: selectedPlanId,
      plan_name: planName(selectedPlan),
      duration_months: selectedMonthKeys.length,
      requested_plan_duration_months: selectedPlanDuration,

      amount: selectedBaseAmount,
      base_amount: selectedBaseAmount,
      membership_amount: selectedBaseAmount,
      subtotal_amount: selectedBaseAmount,
      processing_fee: fee,
      total_amount: totalAmount,

      coverage_year: selectedYear,
      coverage_months: selectedMonthKeys,
      coverage_months_json: JSON.stringify(selectedMonthKeys),
      coverage_start_month: selectedMonthKeys[0],
      coverage_end_month: selectedMonthKeys[selectedMonthKeys.length - 1],
      coverage_start_date: `${selectedMonthKeys[0]}-01`,
      prevent_duplicate_coverage: true,

      line_items: lineItems,
      items: lineItems,

      reference_no: reference,
      client_reference_id: reference,
      idempotency_key: reference,

      create_invoice: true,
      create_pdf: true,
      send_invoice_email: true,
      send_receipt_email: true,
      attach_invoice_pdf: true,
      attach_receipt_pdf: true,

      success_url: `${window.location.origin}/dash/membership/membership-coverage?payment=success`,
      cancel_url: `${window.location.origin}/dash/membership/membership-coverage?payment=cancelled`,
    };

    try {
      const response = await postFirst(CHECKOUT_ENDPOINTS, payload);
      const url = responseCheckoutUrl(response);

      if (redirectToCheckout(url)) return;

      setNotice("Renewal invoice was created. Please open your invoice email to complete payment.");
      await load();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.details ||
          err?.response?.data?.error ||
          "Unable to start membership renewal checkout."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function setupAutoRenewal() {
    if (!selectedPlanId) {
      setError("Please select a membership plan before setting up auto renewal.");
      return;
    }

    setError("");
    setNotice("");
    setActionLoading("subscription");

    const reference = makeReference("MEM-SUB");

    const payload = {
      source: "member_dashboard",
      checkout_context: "membership_subscription",
      payment_type: "membership",
      category: "membership",

      member_id: memberId(profile),
      member_no: memberNo(profile),
      full_name: memberName(profile),
      email: memberEmail(profile),
      phone: memberPhone(profile),

      plan_id: selectedPlanId,
      membership_plan_id: selectedPlanId,
      plan_name: planName(selectedPlan),
      duration_months: selectedPlanDuration,

      payment_method: paymentMethod,
      method: paymentMethod,
      amount: planAmount(selectedPlan),
      base_amount: planAmount(selectedPlan),
      membership_amount: planAmount(selectedPlan),

      reference_no: reference,
      client_reference_id: reference,
      idempotency_key: reference,

      send_invoice_email: true,
      send_receipt_email: true,

      success_url: `${window.location.origin}/dash/membership/membership-coverage?subscription=success`,
      cancel_url: `${window.location.origin}/dash/membership/membership-coverage?subscription=cancelled`,
    };

    try {
      const response = await postFirst(SUBSCRIPTION_SETUP_ENDPOINTS, payload);
      const url = responseCheckoutUrl(response);

      if (redirectToCheckout(url)) return;

      setNotice("Auto renewal settings were updated.");
      await load();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.details ||
          err?.response?.data?.error ||
          "Unable to set up auto renewal."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function cancelAutoRenewal() {
    setError("");
    setNotice("");
    setActionLoading("cancel-subscription");

    try {
      await postFirst(SUBSCRIPTION_CANCEL_ENDPOINTS, {
        member_id: memberId(profile),
        member_no: memberNo(profile),
        subscription_id: firstValue(subscription, ["id", "subscription_id", "stripe_subscription_id"]),
        reason: "Cancelled by member from membership dashboard",
      });

      setNotice("Auto renewal was cancelled.");
      await load();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.details ||
          err?.response?.data?.error ||
          "Unable to cancel auto renewal."
      );
    } finally {
      setActionLoading("");
    }
  }

  if (loading) {
    return (
      <div className="member-dashboard-page">
        <div className="member-loading-state">
          <Loader2 size={20} className="member-spin" />
          Loading membership renewal...
        </div>
      </div>
    );
  }

  return (
    <div className="member-dashboard-page">
      <section className="member-page-hero">
        <div>
          <span className="member-eyebrow">Membership Renewal</span>
          <h1>Renew Membership</h1>
          <p>
            Select open coverage months, pay by card or ACH, and keep your membership
            current without duplicate month payments.
          </p>
        </div>

        <div className="member-hero-actions">
          <button type="button" className="member-btn member-btn-light" onClick={load}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button
            type="button"
            className="member-btn member-btn-primary"
            onClick={() => window.location.assign("/dash/membership/my-payments/make-payment")}
          >
            <WalletCards size={16} />
            Other Payments
          </button>
        </div>
      </section>

      {error ? (
        <div className="member-alert member-alert-danger">
          <AlertTriangle size={17} />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="member-alert member-alert-success">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      ) : null}

      <section className="member-summary-grid">
        <div className="member-summary-card">
          <span>Membership Start</span>
          <strong>{formatDate(memberStartDate(profile))}</strong>
          <small>Coverage starts from this date</small>
        </div>

        <div className="member-summary-card">
          <span>Paid Months</span>
          <strong>{paidMonths}</strong>
          <small>{selectedYear} coverage</small>
        </div>

        <div className="member-summary-card">
          <span>Open Months</span>
          <strong>{openMonths}</strong>
          <small>{nextOpenMonth ? `Next due: ${nextOpenMonth.label}` : "No open months"}</small>
        </div>

        <div className="member-summary-card">
          <span>Auto Renewal</span>
          <strong>{subscriptionActive(subscription) ? "On" : "Off"}</strong>
          <small>{clean(firstValue(subscription, ["plan_name", "status"], ""), "Manual renewal")}</small>
        </div>
      </section>

      <div className="member-two-column">
        <section className="member-panel">
          <div className="member-panel-header">
            <div>
              <CalendarDays size={18} />
              <h2>Coverage Months</h2>
            </div>
            <span>{selectedYear}</span>
          </div>

          <div className="member-form-grid">
            <label>
              Year
              <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Renewal Plan
              <select
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
              >
                {activePlans.map((plan) => (
                  <option key={planId(plan)} value={planId(plan)}>
                    {planName(plan)} - {money(planAmount(plan))}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Payment Method
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                <option value="card">Card</option>
                <option value="ach">ACH</option>
              </select>
            </label>
          </div>

          <div className="member-month-grid">
            {visibleMonths.map((month) => {
              const selected = selectedMonthKeys.includes(month.key);
              const className = [
                "member-month-card",
                `member-month-${month.status}`,
                selected ? "member-month-selected" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={month.key}
                  type="button"
                  className={className}
                  disabled={!month.selectable}
                  onClick={() => toggleMonth(month.key)}
                >
                  <strong>{month.short}</strong>
                  <span>
                    {selected
                      ? "Selected"
                      : month.status === "paid"
                      ? "Paid"
                      : month.status === "pending"
                      ? "Pending"
                      : "Open"}
                  </span>
                </button>
              );
            })}
          </div>

          {!visibleMonths.length ? (
            <div className="member-empty-state">
              This member did not have active coverage months in {selectedYear}.
            </div>
          ) : null}
        </section>

        <aside className="member-panel member-checkout-panel">
          <div className="member-panel-header">
            <div>
              <CreditCard size={18} />
              <h2>Renewal Summary</h2>
            </div>
          </div>

          <div className="member-summary-list">
            <div>
              <span>Member</span>
              <strong>{memberName(profile)}</strong>
            </div>
            <div>
              <span>Plan</span>
              <strong>{planName(selectedPlan)}</strong>
            </div>
            <div>
              <span>Selected Months</span>
              <strong>{selectedMonthKeys.length}</strong>
            </div>
            <div>
              <span>Coverage</span>
              <strong>
                {selectedMonthKeys.length
                  ? `${monthLabelFromKey(selectedMonthKeys[0])} - ${monthLabelFromKey(
                      selectedMonthKeys[selectedMonthKeys.length - 1]
                    )}`
                  : "--"}
              </strong>
            </div>
            <div>
              <span>Membership Amount</span>
              <strong>{money(selectedBaseAmount)}</strong>
            </div>
            <div>
              <span>{paymentMethod === "ach" ? "ACH Fee" : "Card Fee"}</span>
              <strong>{money(fee)}</strong>
            </div>
            <div className="member-summary-total">
              <span>Total Today</span>
              <strong>{money(totalAmount)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="member-btn member-btn-primary member-btn-full"
            disabled={actionLoading === "checkout" || selectedBaseAmount <= 0}
            onClick={startRenewalCheckout}
          >
            {actionLoading === "checkout" ? (
              <Loader2 size={16} className="member-spin" />
            ) : (
              <ShieldCheck size={16} />
            )}
            Continue To Checkout
          </button>

          <p className="member-muted">
            Invoice and receipt emails are sent automatically after successful payment.
          </p>
        </aside>
      </div>

      <section className="member-panel">
        <div className="member-panel-header">
          <div>
            <Repeat size={18} />
            <h2>Auto Renewal</h2>
          </div>
          <span>{subscriptionActive(subscription) ? "Active" : "Not Active"}</span>
        </div>

        <div className="member-auto-renewal-row">
          <div>
            <strong>{subscriptionActive(subscription) ? "Auto renewal is enabled." : "Set up auto renewal."}</strong>
            <p>
              Auto renewal uses your selected membership plan and Stripe checkout. You can
              change or cancel it any time from this page.
            </p>
          </div>

          <div className="member-inline-actions">
            <button
              type="button"
              className="member-btn member-btn-primary"
              disabled={actionLoading === "subscription" || !selectedPlanId}
              onClick={setupAutoRenewal}
            >
              {actionLoading === "subscription" ? (
                <Loader2 size={16} className="member-spin" />
              ) : (
                <Repeat size={16} />
              )}
              {subscriptionActive(subscription) ? "Change Plan" : "Set Up Auto Renewal"}
            </button>

            {subscriptionActive(subscription) ? (
              <button
                type="button"
                className="member-btn member-btn-light"
                disabled={actionLoading === "cancel-subscription"}
                onClick={cancelAutoRenewal}
              >
                {actionLoading === "cancel-subscription" ? (
                  <Loader2 size={16} className="member-spin" />
                ) : (
                  <XCircle size={16} />
                )}
                Cancel Auto Renewal
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}