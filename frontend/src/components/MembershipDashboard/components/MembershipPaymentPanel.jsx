// frontend/src/components/MembershipDashboard/components/MembershipPaymentPanel.jsx

// frontend/src/components/MembershipDashboard/components/MembershipPaymentPanel.jsx

import React, { useMemo } from "react";

import "../../../styles/membership-dashboard.css";

const MONTHS = [
  { value: 1, short: "Jan", label: "January" },
  { value: 2, short: "Feb", label: "February" },
  { value: 3, short: "Mar", label: "March" },
  { value: 4, short: "Apr", label: "April" },
  { value: 5, short: "May", label: "May" },
  { value: 6, short: "Jun", label: "June" },
  { value: 7, short: "Jul", label: "July" },
  { value: 8, short: "Aug", label: "August" },
  { value: 9, short: "Sep", label: "September" },
  { value: 10, short: "Oct", label: "October" },
  { value: 11, short: "Nov", label: "November" },
  { value: 12, short: "Dec", label: "December" },
];

const FALLBACK_PLAN = {
  id: null,
  plan_key: "1_month",
  plan_name: "Monthly Membership",
  amount: 50,
  minimum_amount: 50,
  duration_months: 1,
};

function money(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthName(value) {
  return MONTHS.find((m) => Number(m.value) === Number(value))?.label || "--";
}

function shortMonth(value) {
  return MONTHS.find((m) => Number(m.value) === Number(value))?.short || "--";
}

function getPlanAmount(plan) {
  if (!plan || typeof plan !== "object") return 0;

  return Number(
    plan.minimum_amount ??
      plan.amount ??
      plan.current_amount ??
      0
  );
}

function getPlanMonths(plan) {
  if (!plan || typeof plan !== "object") return 1;

  return Number(
    plan.duration_months ??
      plan.months ??
      plan.interval_count ??
      1
  );
}

function getPlanName(plan) {
  if (!plan || typeof plan !== "object") return "Membership Plan";

  return (
    plan.plan_name ||
    plan.name ||
    `${getPlanMonths(plan)} Month Membership`
  );
}

function buildCoveragePreview(year, startMonth, endMonth) {
  const start = Number(startMonth);
  const end = Number(endMonth);

  if (!start || !end || end < start) return [];

  const rows = [];

  for (let m = start; m <= end; m += 1) {
    rows.push({
      month: m,
      year,
      label: `${shortMonth(m)} ${year}`,
    });
  }

  return rows;
}

export default function MembershipPaymentPanel({
  planRows = [],

  selectedPlan,
  setSelectedPlan,

  membershipMode = "subscription",
  setMembershipMode = () => {},

  coverageYear = new Date().getFullYear(),
  setCoverageYear = () => {},

  coverageStartMonth = "",
  setCoverageStartMonth = () => {},

  coverageEndMonth = "",
  setCoverageEndMonth = () => {},

  customMonthlyRate = 0,

  recommendedStartMonth = "",
  recommendedEndMonth = "",
}) {
  const currentYear = new Date().getFullYear();

  const safePlans = useMemo(() => {
    return Array.isArray(planRows) && planRows.length
      ? planRows
      : [FALLBACK_PLAN];
  }, [planRows]);

  const selected = useMemo(() => {
    return (
      safePlans.find((p) => String(p?.plan_key) === String(selectedPlan)) ||
      safePlans[0] ||
      FALLBACK_PLAN
    );
  }, [safePlans, selectedPlan]);

  const monthlyRate = useMemo(() => {
    if (Number(customMonthlyRate || 0) > 0) {
      return Number(customMonthlyRate);
    }

    const monthlyPlan =
      safePlans.find((p) => Number(getPlanMonths(p)) === 1) ||
      selected ||
      FALLBACK_PLAN;

    return Number(getPlanAmount(monthlyPlan) || 0);
  }, [customMonthlyRate, safePlans, selected]);

  const customMonths = useMemo(() => {
    const start = Number(coverageStartMonth || 0);
    const end = Number(coverageEndMonth || 0);

    if (!start || !end || end < start) return 0;

    return end - start + 1;
  }, [coverageStartMonth, coverageEndMonth]);

  const customAmount = useMemo(() => {
    return Number((monthlyRate * customMonths).toFixed(2));
  }, [monthlyRate, customMonths]);

  const previewMonths = useMemo(() => {
    return buildCoveragePreview(
      coverageYear,
      coverageStartMonth,
      coverageEndMonth
    );
  }, [coverageYear, coverageStartMonth, coverageEndMonth]);

  const selectedPlanMonths = getPlanMonths(selected);
  const selectedPlanAmount = getPlanAmount(selected);

  function applyRecommendedMonths() {
    if (recommendedStartMonth) {
      setCoverageStartMonth(Number(recommendedStartMonth));
    }

    if (recommendedEndMonth) {
      setCoverageEndMonth(Number(recommendedEndMonth));
    }

    setMembershipMode("custom");
  }

  return (
    <div className="payx-panel payx-membership-enterprise">
      <div className="payx-section-head">
        <div>
          <h3 className="payx-section-title">Membership Payment</h3>

          <p className="payx-section-subtitle">
            Choose a subscription plan or pay only selected missing coverage
            months.
          </p>
        </div>
      </div>

      <div className="payx-renewal-mode-row">
        <button
          type="button"
          className={`payx-renewal-mode ${
            membershipMode === "subscription" ? "is-active" : ""
          }`}
          onClick={() => setMembershipMode("subscription")}
        >
          <strong>Subscription Plans</strong>
          <span>Monthly, 3 month, 6 month, or yearly membership.</span>
        </button>

        <button
          type="button"
          className={`payx-renewal-mode ${
            membershipMode === "custom" ? "is-active" : ""
          }`}
          onClick={() => setMembershipMode("custom")}
        >
          <strong>Custom Missing Months</strong>
          <span>Select start month, end month, and pay exact coverage.</span>
        </button>
      </div>

      <div className="payx-subsection">
        <div className="payx-subsection-head">
          <h4>Subscription Plans</h4>
          <span>Use these for recurring or standard membership dues.</span>
        </div>

        <div className="payx-plan-grid payx-plan-grid-compact">
          {safePlans.map((plan, index) => {
            const planKey =
              plan?.plan_key ||
              plan?.billing_cycle ||
              `plan-${index}`;

            const active = String(selectedPlan) === String(planKey);
            const months = getPlanMonths(plan);
            const amount = getPlanAmount(plan);

            return (
              <button
                key={plan?.id || planKey}
                type="button"
                className={`payx-plan-card payx-plan-card-compact ${
                  active ? "active" : ""
                }`}
                onClick={() => {
                  setSelectedPlan(planKey);
                  setMembershipMode("subscription");
                }}
              >
                <div className="payx-plan-top">
                  <h4>{getPlanName(plan)}</h4>
                  <div className="payx-plan-price">{money(amount)}</div>
                </div>

                <div className="payx-plan-meta-row">
                  <span>Duration</span>
                  <strong>
                    {months} Month{months > 1 ? "s" : ""}
                  </strong>
                </div>

                {active ? (
                  <div className="payx-plan-selected">✓ Selected Plan</div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="payx-renewal-card">
        <div className="payx-renewal-card-head">
          <div>
            <h4>Custom Missing Months</h4>
            <p>
              Select the exact coverage months to pay. This is best for members
              who only need to cover unpaid months.
            </p>
          </div>

          {recommendedStartMonth && recommendedEndMonth ? (
            <button
              type="button"
              className="payx-btn payx-btn-secondary payx-btn-small"
              onClick={applyRecommendedMonths}
            >
              Use Recommended Gap
            </button>
          ) : null}
        </div>

        <div className="payx-renewal-grid">
          <div className="payx-field">
            <label className="payx-field-label">Coverage Year</label>
            <select
              className="payx-input"
              value={coverageYear}
              onChange={(e) => setCoverageYear(Number(e.target.value))}
            >
              <option value={currentYear - 1}>{currentYear - 1}</option>
              <option value={currentYear}>{currentYear}</option>
              <option value={currentYear + 1}>{currentYear + 1}</option>
            </select>
          </div>

          <div className="payx-field">
            <label className="payx-field-label">Start Month</label>
            <select
              className="payx-input"
              value={coverageStartMonth}
              onChange={(e) => {
                const value = Number(e.target.value);
                setCoverageStartMonth(value);

                if (!coverageEndMonth || Number(coverageEndMonth) < value) {
                  setCoverageEndMonth(value);
                }

                setMembershipMode("custom");
              }}
            >
              <option value="">Select start</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="payx-field">
            <label className="payx-field-label">End Month</label>
            <select
              className="payx-input"
              value={coverageEndMonth}
              onChange={(e) => {
                setCoverageEndMonth(Number(e.target.value));
                setMembershipMode("custom");
              }}
            >
              <option value="">Select end</option>
              {MONTHS.filter(
                (m) =>
                  !coverageStartMonth ||
                  Number(m.value) >= Number(coverageStartMonth)
              ).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="payx-renewal-total-box">
            <span>Custom Total</span>
            <strong>{money(customAmount)}</strong>
            <small>
              {customMonths} month{customMonths === 1 ? "" : "s"} ×{" "}
              {money(monthlyRate)}
            </small>
          </div>
        </div>

        {previewMonths.length ? (
          <div className="payx-coverage-preview-row">
            {previewMonths.map((m) => (
              <span key={`${m.year}-${m.month}`}>{m.label}</span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="payx-plan-preview payx-plan-preview-compact">
        <div className="payx-plan-preview-left">
          <span className="payx-plan-preview-label">
            {membershipMode === "custom"
              ? "Selected Custom Coverage"
              : "Selected Subscription Plan"}
          </span>

          <h3>
            {membershipMode === "custom"
              ? `${monthName(coverageStartMonth)} - ${monthName(
                  coverageEndMonth
                )} ${coverageYear}`
              : getPlanName(selected)}
          </h3>

          <p>
            {membershipMode === "custom"
              ? `${customMonths} selected month${
                  customMonths === 1 ? "" : "s"
                } at ${money(monthlyRate)} per month.`
              : `${selectedPlanMonths} month${
                  selectedPlanMonths === 1 ? "" : "s"
                } membership subscription plan.`}
          </p>
        </div>

        <div className="payx-plan-preview-right">
          <div className="payx-plan-preview-price">
            {membershipMode === "custom"
              ? money(customAmount)
              : money(selectedPlanAmount)}
          </div>
        </div>
      </div>
    </div>
  );
}