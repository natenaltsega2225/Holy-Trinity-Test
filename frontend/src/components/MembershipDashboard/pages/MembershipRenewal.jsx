
// frontend/src/components/MembershipDashboard/pages/MembershipRenewal.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api";
import "../../../styles/membership-dashboard.css";

const MONTHS = [
  { n: 1, short: "Jan", label: "January" },
  { n: 2, short: "Feb", label: "February" },
  { n: 3, short: "Mar", label: "March" },
  { n: 4, short: "Apr", label: "April" },
  { n: 5, short: "May", label: "May" },
  { n: 6, short: "Jun", label: "June" },
  { n: 7, short: "Jul", label: "July" },
  { n: 8, short: "Aug", label: "August" },
  { n: 9, short: "Sep", label: "September" },
  { n: 10, short: "Oct", label: "October" },
  { n: 11, short: "Nov", label: "November" },
  { n: 12, short: "Dec", label: "December" },
];

const FALLBACK_PLANS = [
  { id: "monthly", label: "Monthly Membership", months: 1, amount: 50 },
  { id: "quarterly", label: "3-Month Membership", months: 3, amount: 150 },
  { id: "semi_annual", label: "6-Month Membership", months: 6, amount: 300 },
  { id: "annual", label: "Yearly Membership", months: 12, amount: 600 },
];

function money(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "--";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "--"
    : d.toLocaleDateString("en-US");
}

function normalizePlan(row = {}) {
  const planKey = String(
    row.billing_cycle ||
      row.plan_code ||
      row.plan_key ||
      ""
  ).toLowerCase();

  const months =
    Number(row.duration_months) ||
    Number(row.months) ||
    Number(row.interval_count) ||
    (planKey.includes("12")
      ? 12
      : planKey.includes("6")
      ? 6
      : planKey.includes("3")
      ? 3
      : 1);

  return {
    id: row.id,
    label:
      row.plan_name ||
      row.name ||
      `${months} Month Membership`,
    months,
    amount: Number(
      row.minimum_amount ||
        row.amount ||
        row.current_amount ||
        0
    ),
    planCode:
      row.plan_code ||
      row.billing_cycle ||
      row.plan_key ||
      null,
    raw: row,
  };
}

function normalizeRows(data) {
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.grid)) return data.grid;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function checkoutUrl(data) {
  return (
    data?.url ||
    data?.checkout_url ||
    data?.checkoutUrl ||
    data?.session_url ||
    data?.sessionUrl ||
    ""
  );
}

function monthObj(monthNumber) {
  return (
    MONTHS.find(
      (m) => Number(m.n) === Number(monthNumber)
    ) || MONTHS[0]
  );
}

function monthLabel(monthNumber, year, short = true) {
  const m = monthObj(monthNumber);
  return `${short ? m.short : m.label} ${year}`;
}

function monthsBetween(fromMonth, fromYear, toMonth, toYear) {
  const startIndex =
    Number(fromYear) * 12 +
    Number(fromMonth);

  const endIndex =
    Number(toYear) * 12 +
    Number(toMonth);

  return Math.max(
    1,
    endIndex - startIndex + 1
  );
}

function buildMonthRange(fromMonth, fromYear, toMonth, toYear) {
  const list = [];

  let cursor =
    new Date(
      Number(fromYear),
      Number(fromMonth) - 1,
      1
    );

  const end =
    new Date(
      Number(toYear),
      Number(toMonth) - 1,
      1
    );

  while (cursor <= end) {
    const year =
      cursor.getFullYear();

    const month =
      cursor.getMonth() + 1;

    list.push({
      month,
      year,
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: monthLabel(month, year),
      short: monthObj(month).short,
    });

    cursor =
      new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        1
      );
  }

  return list;
}

function getPaidMap(grid = []) {
  const map = new Map();

  grid.forEach((row) => {
    const monthNumber =
      Number(row.month_number || row.month || 0);

    const paid =
      row.paid === true ||
      [
        "paid",
        "completed",
        "posted",
        "approved",
      ].includes(
        String(
          row.status ||
            row.coverage_status ||
            ""
        ).toLowerCase()
      );

    if (
      monthNumber >= 1 &&
      monthNumber <= 12
    ) {
      map.set(monthNumber, paid);
    }
  });

  return map;
}

function getFirstGap(grid = []) {
  const paid =
    getPaidMap(grid);

  let start = null;
  let end = null;

  for (let i = 1; i <= 12; i += 1) {
    if (!paid.get(i)) {
      if (!start) start = i;
      end = i;
    } else if (start) {
      break;
    }
  }

  return {
    start,
    end,
  };
}

export default function MembershipRenewal() {
  const currentYear =
    new Date().getFullYear();

  const yearOptions =
    useMemo(
      () =>
        Array.from(
          { length: 12 },
          (_, i) => currentYear - 3 + i
        ),
      [currentYear]
    );

  const [plans, setPlans] =
    useState(FALLBACK_PLANS);

  const [selected, setSelected] =
    useState(FALLBACK_PLANS[0]);

  const [summary, setSummary] =
    useState(null);

  const [coverageGrid, setCoverageGrid] =
    useState([]);

  const [subscription, setSubscription] =
    useState(null);

  const [renewalType, setRenewalType] =
    useState("recommended");

  const [fromMonth, setFromMonth] =
    useState(new Date().getMonth() + 1);

  const [fromYear, setFromYear] =
    useState(currentYear);

  const [toMonth, setToMonth] =
    useState(new Date().getMonth() + 1);

  const [toYear, setToYear] =
    useState(currentYear);

  const [loading, setLoading] =
    useState(false);

  const [pageLoading, setPageLoading] =
    useState(true);

  const [savingAutoRenew, setSavingAutoRenew] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadData(fromYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(year = fromYear) {
    try {
      setPageLoading(true);
      setError("");

      const [
        plansRes,
        summaryRes,
        gridRes,
        subscriptionRes,
      ] = await Promise.allSettled([
        api.get("/dues/plans"),
        api.get("/member/summary"),
        api.get(`/member/membership-grid/${year}`),
        api.get("/subscription/current"),
      ]);

      if (plansRes.status === "fulfilled") {
        const backendPlans =
          Array.isArray(
            plansRes.value.data?.rows
          )
            ? plansRes.value.data.rows.map(
                normalizePlan
              )
            : [];

        const finalPlans =
          backendPlans.length
            ? backendPlans
            : FALLBACK_PLANS;

        setPlans(finalPlans);

        setSelected((current) => {
          const match =
            finalPlans.find(
              (p) =>
                String(p.id) ===
                String(current?.id)
            );

          return match || finalPlans[0];
        });
      }

      if (summaryRes.status === "fulfilled") {
        setSummary(
          summaryRes.value.data?.summary ||
            summaryRes.value.data ||
            null
        );
      }

      if (gridRes.status === "fulfilled") {
        const grid =
          normalizeRows(gridRes.value.data);

        setCoverageGrid(grid);

        const gap =
          getFirstGap(grid);

        if (gap.start && gap.end) {
          setFromMonth(gap.start);
          setFromYear(year);
          setToMonth(gap.end);
          setToYear(year);
        }
      }

      if (
        subscriptionRes.status ===
        "fulfilled"
      ) {
        setSubscription(
          subscriptionRes.value.data?.row ||
            subscriptionRes.value.data
              ?.subscription ||
            null
        );
      }
    } catch (err) {
      console.error(
        "Membership renewal load failed:",
        err
      );

      setError(
        err?.response?.data?.error ||
          "Failed to load renewal information."
      );
    } finally {
      setPageLoading(false);
    }
  }

  const monthlyRate =
    useMemo(() => {
      const oneMonth =
        plans.find(
          (p) => Number(p.months) === 1
        ) ||
        plans.find((p) =>
          String(
            p.planCode || ""
          )
            .toLowerCase()
            .includes("monthly")
        );

      if (oneMonth?.amount) {
        return Number(oneMonth.amount);
      }

      return (
        Number(selected?.amount || 0) /
        Math.max(
          Number(selected?.months || 1),
          1
        )
      );
    }, [plans, selected]);

  const paidCount =
    useMemo(() => {
      return coverageGrid.filter((row) => {
        return (
          row.paid === true ||
          [
            "paid",
            "completed",
            "posted",
            "approved",
          ].includes(
            String(
              row.status ||
                row.coverage_status ||
                ""
            ).toLowerCase()
          )
        );
      }).length;
    }, [coverageGrid]);

  const unpaidCount =
    Math.max(0, 12 - paidCount);

  const recommendedGap =
    useMemo(
      () => getFirstGap(coverageGrid),
      [coverageGrid]
    );

  function applyRecommendedGap() {
    if (
      recommendedGap.start &&
      recommendedGap.end
    ) {
      setFromMonth(recommendedGap.start);
      setToMonth(recommendedGap.end);
      setToYear(fromYear);
    }

    setRenewalType("recommended");
  }

  function applyFullYear() {
    setFromMonth(1);
    setToMonth(12);
    setToYear(fromYear);
    setRenewalType("full_year");
  }

  function handleFromMonthChange(value) {
    const next =
      Number(value);

    setFromMonth(next);

    const fromIndex =
      Number(fromYear) * 12 + next;

    const toIndex =
      Number(toYear) * 12 +
      Number(toMonth);

    if (toIndex < fromIndex) {
      setToMonth(next);
      setToYear(fromYear);
    }
  }

  function handleFromYearChange(value) {
    const next =
      Number(value);

    setFromYear(next);

    const fromIndex =
      next * 12 + Number(fromMonth);

    const toIndex =
      Number(toYear) * 12 +
      Number(toMonth);

    if (toIndex < fromIndex) {
      setToYear(next);
      setToMonth(fromMonth);
    }

    loadData(next);
  }

  function handleToMonthChange(value) {
    setToMonth(Number(value));
  }

  function handleToYearChange(value) {
    setToYear(Number(value));
  }

  const activeRange =
    useMemo(() => {
      if (renewalType === "auto_renew") {
        const now =
          new Date();

        const start =
          new Date(
            now.getFullYear(),
            now.getMonth(),
            1
          );

        const end =
          new Date(
            start.getFullYear(),
            start.getMonth() +
              Number(selected?.months || 1) -
              1,
            1
          );

        return {
          fromMonth:
            start.getMonth() + 1,
          fromYear:
            start.getFullYear(),
          toMonth:
            end.getMonth() + 1,
          toYear:
            end.getFullYear(),
        };
      }

      return {
        fromMonth,
        fromYear,
        toMonth,
        toYear,
      };
    }, [
      renewalType,
      selected,
      fromMonth,
      fromYear,
      toMonth,
      toYear,
    ]);

  const monthsToPay =
    useMemo(
      () =>
        monthsBetween(
          activeRange.fromMonth,
          activeRange.fromYear,
          activeRange.toMonth,
          activeRange.toYear
        ),
      [activeRange]
    );

  const calculatedAmount =
    renewalType === "auto_renew"
      ? Number(selected?.amount || 0)
      : Number(
          (
            monthlyRate *
            monthsToPay
          ).toFixed(2)
        );

  const previewMonths =
    useMemo(
      () =>
        buildMonthRange(
          activeRange.fromMonth,
          activeRange.fromYear,
          activeRange.toMonth,
          activeRange.toYear
        ),
      [activeRange]
    );

  const previewLabel =
    previewMonths.length
      ? `${previewMonths[0].label} - ${
          previewMonths[
            previewMonths.length - 1
          ].label
        }`
      : "--";

  const autoEnabled =
    Number(
      subscription?.auto_payment_enabled || 0
    ) === 1 ||
    Number(subscription?.auto_renew || 0) === 1;

  async function handleToggleAutoRenew() {
    try {
      setSavingAutoRenew(true);
      setError("");

      await api.patch(
        "/subscription/toggle-auto-payment",
        {
          enabled: !autoEnabled,
        }
      );

      await loadData(fromYear);
    } catch (err) {
      console.error(
        "Auto-renew update failed:",
        err
      );

      setError(
        err?.response?.data?.error ||
          "Failed to update auto-renew setting."
      );
    } finally {
      setSavingAutoRenew(false);
    }
  }

  async function handleCheckout() {
    try {
      setLoading(true);
      setError("");

      if (!selected?.id) {
        throw new Error(
          "Please select a membership plan."
        );
      }

      if (calculatedAmount <= 0) {
        throw new Error(
          "Payment amount is not configured."
        );
      }

      const successUrl =
        `${window.location.origin}/dash/membership/my-payments/history?status=success&session_id={CHECKOUT_SESSION_ID}`;

      const cancelUrl =
        `${window.location.origin}/dash/membership/my-payments/renewal?status=cancel`;

      const isAutoRenew =
        renewalType === "auto_renew";

      const payload = {
        type: "membership",
        payment_type: "membership",
        category: "membership",

        renewal_type: renewalType,
        custom_coverage: !isAutoRenew,

        plan_id: selected.id,
        dues_plan_id: selected.id,
        plan_name: selected.label,
        plan_code: selected.planCode,

        amount: calculatedAmount,
        total_amount: calculatedAmount,

        coverage_year:
          activeRange.fromYear,

        coverage_start_month:
          activeRange.fromMonth,

        coverage_start_year:
          activeRange.fromYear,

        coverage_end_month:
          activeRange.toMonth,

        coverage_end_year:
          activeRange.toYear,

        coverage_label:
          previewLabel,

        duration_months:
          monthsToPay,

        months_paid:
          monthsToPay,

        interval_count:
          isAutoRenew
            ? selected.months
            : monthsToPay,

        interval_unit: "month",

        auto_renew:
          isAutoRenew,

        auto_payment_enabled:
          isAutoRenew,

        subscription_enabled:
          isAutoRenew,

        is_recurring:
          isAutoRenew,

        recurring_frequency:
          isAutoRenew
            ? "monthly"
            : "",

        sub_category:
          isAutoRenew
            ? `${selected.label} Auto Renewal`
            : `${previewLabel} Membership Renewal`,

        success_url:
          successUrl,

        cancel_url:
          cancelUrl,
      };

      const { data } =
        await api.post(
          "/checkout/create-session",
          payload
        );

      const url =
        checkoutUrl(data);

      if (!url) {
        throw new Error(
          "Stripe checkout URL missing."
        );
      }

      window.location.href =
        url;
    } catch (err) {
      console.error(
        "Membership renewal checkout failed:",
        err
      );

      setError(
        err?.response?.data?.error ||
          err.message ||
          "Checkout failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="member-page renewal-page">
      <div className="member-page-header">
        <div>
          <p className="member-page-eyebrow">
            Membership Renewal
          </p>

          <h1>Renew Membership</h1>

          <p>
            Pay missing months, select a custom coverage period,
            renew a full year, or start automatic subscription renewal.
          </p>
        </div>

        <div className="member-page-actions">
          <button
            type="button"
            className="member-link-btn"
            onClick={() =>
              loadData(fromYear)
            }
            disabled={pageLoading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="member-alert error">
          {error}
        </div>
      ) : null}

      {pageLoading ? (
        <div className="member-card member-loading-card">
          Loading renewal information...
        </div>
      ) : null}

      <div className="member-summary-grid">
        <div className="member-summary-card">
          <span>Paid Months</span>
          <h2>{paidCount}</h2>
          <small>{fromYear} coverage</small>
        </div>

        <div className="member-summary-card">
          <span>Missing Months</span>
          <h2>{unpaidCount}</h2>
          <small>Unpaid coverage</small>
        </div>

        <div className="member-summary-card">
          <span>Recommended Gap</span>
          <h2>
            {recommendedGap.start
              ? `${monthObj(
                  recommendedGap.start
                ).short} - ${monthObj(
                  recommendedGap.end
                ).short}`
              : "--"}
          </h2>
          <small>First unpaid range</small>
        </div>

        <div className="member-summary-card featured">
          <span>Total Due</span>
          <h2>{money(calculatedAmount)}</h2>
          <small>{monthsToPay} month coverage</small>
        </div>
      </div>

      <div className="member-card">
        <div className="member-card-header">
          <div>
            <h2>Renewal Options</h2>
            <p>
              Choose how you want to renew your membership.
            </p>
          </div>
        </div>

        <div className="renewal-mode-grid">
          <button
            type="button"
            className={`renewal-option-card ${
              renewalType === "recommended"
                ? "active"
                : ""
            }`}
            onClick={applyRecommendedGap}
          >
            <strong>Pay Missing Months</strong>
            <span>Use the first unpaid coverage gap.</span>
          </button>

          <button
            type="button"
            className={`renewal-option-card ${
              renewalType === "custom"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setRenewalType("custom")
            }
          >
            <strong>Custom Coverage</strong>
            <span>Pick From and To month/year.</span>
          </button>

          <button
            type="button"
            className={`renewal-option-card ${
              renewalType === "full_year"
                ? "active"
                : ""
            }`}
            onClick={applyFullYear}
          >
            <strong>Full Year</strong>
            <span>Cover January through December.</span>
          </button>

          <button
            type="button"
            className={`renewal-option-card ${
              renewalType === "auto_renew"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setRenewalType("auto_renew")
            }
          >
            <strong>Auto Renewal</strong>
            <span>Start recurring Stripe billing.</span>
          </button>
        </div>
      </div>

      {renewalType !== "auto_renew" ? (
        <div className="member-card">
          <div className="member-card-header">
            <div>
              <h2>Coverage Date Builder</h2>
              <p>
                Select the exact coverage period using month and year.
              </p>
            </div>
          </div>

          <div className="renewal-date-builder">
            <div className="renewal-date-card">
              <label>From</label>

              <div className="renewal-date-row">
                <select
                  value={fromMonth}
                  onChange={(e) =>
                    handleFromMonthChange(
                      e.target.value
                    )
                  }
                >
                  {MONTHS.map((m) => (
                    <option
                      key={m.n}
                      value={m.n}
                    >
                      {m.short}
                    </option>
                  ))}
                </select>

                <select
                  value={fromYear}
                  onChange={(e) =>
                    handleFromYearChange(
                      e.target.value
                    )
                  }
                >
                  {yearOptions.map((year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="renewal-date-card">
              <label>To</label>

              <div className="renewal-date-row">
                <select
                  value={toMonth}
                  onChange={(e) =>
                    handleToMonthChange(
                      e.target.value
                    )
                  }
                >
                  {MONTHS.map((m) => (
                    <option
                      key={m.n}
                      value={m.n}
                    >
                      {m.short}
                    </option>
                  ))}
                </select>

                <select
                  value={toYear}
                  onChange={(e) =>
                    handleToYearChange(
                      e.target.value
                    )
                  }
                >
                  {yearOptions.map((year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {renewalType === "auto_renew" ? (
        <div className="member-card">
          <div className="member-card-header">
            <div>
              <h2>Auto Renewal Subscription</h2>
              <p>
                Select a plan and enable automatic future renewal.
              </p>
            </div>
          </div>

          <div className="renewal-plan-grid">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className={`renewal-plan-card ${
                  String(selected?.id) ===
                  String(plan.id)
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setSelected(plan)
                }
              >
                <h3>{plan.label}</h3>
                <div className="renewal-price">
                  {money(plan.amount)}
                </div>
                <p>
                  {plan.months} month
                  {plan.months > 1 ? "s" : ""}
                </p>
              </button>
            ))}
          </div>

          <div className="subscription-status-card">
            <div>
              <span>Current Plan</span>
              <strong>
                {subscription?.plan_name || "--"}
              </strong>
            </div>

            <div>
              <span>Auto Renewal</span>
              <strong>
                {autoEnabled
                  ? "Enabled"
                  : "Disabled"}
              </strong>
            </div>

            <div>
              <span>Next Renewal</span>
              <strong>
                {formatDate(
                  subscription?.next_renewal_date
                )}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="member-primary-btn"
            onClick={handleToggleAutoRenew}
            disabled={
              savingAutoRenew ||
              !subscription
            }
          >
            {savingAutoRenew
              ? "Saving..."
              : autoEnabled
              ? "Disable Auto Renewal"
              : "Enable Auto Renewal"}
          </button>
        </div>
      ) : null}

      <div className="member-card renewal-summary-card">
        <div className="member-card-header">
          <div>
            <h2>Payment Summary</h2>
            <p>
              Review the coverage and amount before continuing to Stripe.
            </p>
          </div>
        </div>

        <div className="renewal-summary-grid">
          <div className="renewal-summary-item">
            <span>Coverage Period</span>
            <strong>{previewLabel}</strong>
          </div>

          <div className="renewal-summary-item">
            <span>Months</span>
            <strong>{monthsToPay}</strong>
          </div>

          <div className="renewal-summary-item">
            <span>Monthly Rate</span>
            <strong>{money(monthlyRate)}</strong>
          </div>

          <div className="renewal-summary-item total">
            <span>Total Due</span>
            <strong>{money(calculatedAmount)}</strong>
          </div>
        </div>

        {previewMonths.length ? (
          <div className="coverage-preview-grid">
            {previewMonths.map((m) => (
              <div
                key={m.key}
                className="coverage-preview-item"
              >
                <span>{m.short}</span>
                <strong>{m.year}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="member-card renewal-action-card">
        <div>
          <h2>
            {renewalType === "auto_renew"
              ? "Start Auto-Renew Membership?"
              : "Ready to Renew?"}
          </h2>
          <p>
            Secure online payment powered by Stripe.
          </p>
        </div>

        <button
          type="button"
          className="member-primary-btn member-primary-btn-lg"
          onClick={handleCheckout}
          disabled={
            loading ||
            calculatedAmount <= 0
          }
        >
          {loading
            ? "Redirecting..."
            : renewalType === "auto_renew"
            ? `Subscribe ${money(calculatedAmount)}`
            : `Pay ${money(calculatedAmount)}`}
        </button>
      </div>
    </div>
  );
}