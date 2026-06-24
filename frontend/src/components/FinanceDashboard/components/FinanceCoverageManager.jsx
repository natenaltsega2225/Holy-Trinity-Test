// frontend/src/components/FinanceDashboard/components/FinanceCoverageManager.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  RefreshCcw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

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

const PAYMENT_METHODS = [
  { value: "card", label: "Stripe Card" },
  { value: "ach", label: "Stripe ACH" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
];

function clean(value) {
  return String(value ?? "").trim();
}

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

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];

    if (value !== undefined && value !== null && clean(value) !== "") {
      return value;
    }
  }

  return fallback;
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.rows,
    payload?.data,
    payload?.coverage,
    payload?.subscriptions,
    payload?.items,
    payload?.data?.rows,
    payload?.data?.coverage,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function normalizePlans(payload) {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.rows,
    payload?.plans,
    payload?.data,
    payload?.items,
    payload?.data?.rows,
    payload?.data?.plans,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function dateOnly(value) {
  if (!value) return "";

  const raw = clean(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  return d.toISOString().slice(0, 10);
}

function formatDate(value) {
  const date = dateOnly(value);

  if (!date) return "--";

  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}

function memberStartMonth(member = {}) {
  const start = dateOnly(
    firstValue(
      member,
      [
        "membership_start_date",
        "start_date",
        "joined_at",
        "registered_at",
        "created_at",
      ],
      ""
    )
  );

  if (!start) return 1;

  return Number(start.slice(5, 7)) || 1;
}

function memberStartYear(member = {}) {
  const start = dateOnly(
    firstValue(
      member,
      [
        "membership_start_date",
        "start_date",
        "joined_at",
        "registered_at",
        "created_at",
      ],
      ""
    )
  );

  if (!start) return new Date().getFullYear();

  return Number(start.slice(0, 4)) || new Date().getFullYear();
}

function parseMonths(value) {
  if (Array.isArray(value)) {
    return value.map(Number).filter((n) => n >= 1 && n <= 12);
  }

  const text = clean(value);

  if (!text) return [];

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return parsed.map(Number).filter((n) => n >= 1 && n <= 12);
    }
  } catch (_err) {
    // Continue with fallback parsing.
  }

  return text
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => n >= 1 && n <= 12);
}

function coverageMonths(row = {}) {
  const explicit = parseMonths(
    firstValue(
      row,
      [
        "coverage_months_json",
        "coverage_months",
        "months",
        "membership_months",
      ],
      ""
    )
  );

  if (explicit.length) return explicit;

  const start = Number(
    firstValue(row, ["coverage_start_month", "start_month"], 0)
  );

  const end = Number(
    firstValue(row, ["coverage_end_month", "end_month"], 0)
  );

  if (start >= 1 && start <= 12 && end >= 1 && end <= 12 && end >= start) {
    return MONTHS.filter((month) => month.n >= start && month.n <= end).map(
      (month) => month.n
    );
  }

  return [];
}

function planMonths(plan = {}) {
  return (
    Number(
      firstValue(
        plan,
        [
          "duration_months",
          "months",
          "coverage_months",
          "billing_interval_count",
        ],
        1
      )
    ) || 1
  );
}

function planAmount(plan = {}) {
  return numberValue(
    firstValue(
      plan,
      ["amount", "price", "current_amount", "membership_amount", "dues_amount"],
      0
    )
  );
}

function planName(plan = {}) {
  return firstValue(plan, ["plan_name", "name", "title", "label"], "Membership Plan");
}

function planId(plan = {}) {
  return firstValue(plan, ["id", "plan_id", "dues_plan_id"], "");
}

function coverageLabelFromMonths(months = [], year = new Date().getFullYear()) {
  if (!months.length) return "--";

  const sorted = [...months].sort((a, b) => a - b);
  const first = MONTHS.find((month) => month.n === sorted[0]);
  const last = MONTHS.find((month) => month.n === sorted[sorted.length - 1]);

  if (!first || !last) return "--";

  return `${first.short} - ${last.short} ${year}`;
}

function statusTone(status) {
  const value = clean(status).toLowerCase();

  if (["active", "paid", "covered", "current"].includes(value)) return "success";
  if (["pending", "open", "partial"].includes(value)) return "warning";
  if (["overdue", "inactive", "expired", "unpaid"].includes(value)) return "danger";

  return "neutral";
}

function StatusBadge({ status }) {
  return (
    <span className={`finance-status-badge ${statusTone(status)}`}>
      {clean(status).replaceAll("_", " ") || "--"}
    </span>
  );
}

async function getFirst(endpoints, config = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint, config);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

async function postFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.post(endpoint, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

function RenewalModal({
  open,
  member,
  plans,
  currentCoverage,
  onClose,
  onSaved,
}) {
  const defaultPlan = plans[0] || {};
  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    plan_id: planId(defaultPlan),
    coverage_year: String(currentYear),
    coverage_start_month: String(
      Math.max(
        memberStartYear(member) === currentYear ? memberStartMonth(member) : 1,
        new Date().getMonth() + 1
      )
    ),
    payment_method: "cash",
    reference_no: "",
    send_invoice_email: true,
    send_receipt_email: true,
    create_payment_link: false,
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = useMemo(() => {
    return (
      plans.find((plan) => String(planId(plan)) === String(form.plan_id)) ||
      defaultPlan
    );
  }, [plans, form.plan_id, defaultPlan]);

  const durationMonths = Math.max(1, planMonths(selectedPlan));
  const startMonth = Number(form.coverage_start_month) || 1;
  const endMonth = Math.min(12, startMonth + durationMonths - 1);
  const selectedMonths = MONTHS.filter(
    (month) => month.n >= startMonth && month.n <= endMonth
  ).map((month) => month.n);

  const amount = planAmount(selectedPlan);
  const coverageLabel = coverageLabelFromMonths(
    selectedMonths,
    Number(form.coverage_year)
  );

  useEffect(() => {
    if (!open) return;

    const basePlan = plans[0] || {};
    const nowYear = new Date().getFullYear();
    const minimumStart =
      memberStartYear(member) === nowYear ? memberStartMonth(member) : 1;

    setForm({
      plan_id: planId(basePlan),
      coverage_year: String(nowYear),
      coverage_start_month: String(
        Math.max(minimumStart, new Date().getMonth() + 1)
      ),
      payment_method: "cash",
      reference_no: "",
      send_invoice_email: true,
      send_receipt_email: true,
      create_payment_link: false,
      notes: "",
    });

    setError("");
    setSaving(false);
  }, [open, plans, member]);

  function setValue(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function close() {
    if (saving) return;
    onClose?.();
  }

  async function submit(event) {
    event.preventDefault();

    setError("");

    if (!form.plan_id) {
      setError("Select a membership plan.");
      return;
    }

    if (amount <= 0) {
      setError("Selected plan must have a valid amount.");
      return;
    }

    const memberId = firstValue(member, ["id", "member_id"], "");
    const memberNo = firstValue(member, ["member_no", "member_number"], "");

    if (!memberId) {
      setError("Member profile is missing.");
      return;
    }

    const payload = {
      member_id: memberId,
      member_no: memberNo,

      plan_id: form.plan_id,
      dues_plan_id: form.plan_id,
      plan_name: planName(selectedPlan),
      duration_months: durationMonths,
      months_paid: selectedMonths.length,

      amount,
      membership_amount: amount,
      total_amount: amount,

      coverage_year: Number(form.coverage_year),
      coverage_start_month: startMonth,
      coverage_end_month: endMonth,
      coverage_months: selectedMonths,
      coverage_months_json: JSON.stringify(selectedMonths),
      coverage_label: coverageLabel,

      payment_method: form.payment_method,
      method: form.payment_method,
      provider: ["card", "ach"].includes(form.payment_method)
        ? "stripe"
        : form.payment_method,

      reference_no: clean(form.reference_no) || null,
      notes: clean(form.notes) || null,

      category: "membership",
      payment_type: "membership",
      source: "finance_coverage_manager",

      create_invoice: true,
      generate_invoice: true,
      send_invoice_email: Boolean(form.send_invoice_email),

      generate_receipt: !form.create_payment_link,
      send_receipt_email: Boolean(form.send_receipt_email),

      create_payment_link:
        Boolean(form.create_payment_link) ||
        ["card", "ach"].includes(form.payment_method),
    };

    setSaving(true);

    try {
      const response = await postFirst(
        [
          `/finance/members/${memberId}/coverage`,
          "/finance/membership-coverage",
          "/subscription/renew",
        ],
        payload
      );

      const checkoutUrl =
        response?.checkout_url ||
        response?.url ||
        response?.data?.checkout_url ||
        response?.data?.url;

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      onSaved?.();
      close();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update membership coverage."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const currentMonths = coverageMonths(currentCoverage);

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <form className="finance-modal finance-modal-wide" onSubmit={submit}>
        <div className="finance-modal-head">
          <div>
            <p className="finance-eyebrow">Membership Coverage</p>
            <h2>Renew or Change Plan</h2>
            <span>
              Select coverage plan, start month, payment method, and document
              email behavior.
            </span>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={close}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="finance-alert danger">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}

        <div className="finance-form-grid three">
          <label>
            Membership Plan *
            <select
              value={form.plan_id}
              onChange={(event) => setValue("plan_id", event.target.value)}
              required
            >
              {plans.map((plan) => (
                <option key={planId(plan)} value={planId(plan)}>
                  {planName(plan)} - {money(planAmount(plan))}
                </option>
              ))}
            </select>
          </label>

          <label>
            Coverage Year
            <input
              type="number"
              value={form.coverage_year}
              onChange={(event) => setValue("coverage_year", event.target.value)}
            />
          </label>

          <label>
            Start Month
            <select
              value={form.coverage_start_month}
              onChange={(event) =>
                setValue("coverage_start_month", event.target.value)
              }
            >
              {MONTHS.map((month) => {
                const minMonth =
                  Number(form.coverage_year) === memberStartYear(member)
                    ? memberStartMonth(member)
                    : 1;

                return (
                  <option
                    key={month.n}
                    value={month.n}
                    disabled={month.n < minMonth}
                  >
                    {month.label}
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            Payment Method
            <select
              value={form.payment_method}
              onChange={(event) => setValue("payment_method", event.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Reference #
            <input
              value={form.reference_no}
              onChange={(event) => setValue("reference_no", event.target.value)}
              placeholder="Check #, Zelle ref, or note"
            />
          </label>

          <div className="finance-calculated-box">
            <span>Total Due</span>
            <strong>{money(amount)}</strong>
          </div>
        </div>

        <div className="finance-coverage-preview">
          <div>
            <strong>New Coverage</strong>
            <span>{coverageLabel}</span>
          </div>

          <div className="finance-month-grid">
            {MONTHS.map((month) => {
              const selected = selectedMonths.includes(month.n);
              const current = currentMonths.includes(month.n);

              return (
                <span
                  key={month.n}
                  className={[
                    "finance-month-pill",
                    selected ? "selected" : "",
                    current ? "current" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {selected ? "X " : ""}
                  {month.short}
                </span>
              );
            })}
          </div>
        </div>

        <label className="finance-field-full">
          Notes
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => setValue("notes", event.target.value)}
            placeholder="Optional internal coverage note"
          />
        </label>

        <div className="finance-check-grid">
          <label>
            <input
              type="checkbox"
              checked={form.send_invoice_email}
              onChange={(event) =>
                setValue("send_invoice_email", event.target.checked)
              }
            />
            Send invoice email
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.send_receipt_email}
              onChange={(event) =>
                setValue("send_receipt_email", event.target.checked)
              }
            />
            Send receipt email
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.create_payment_link}
              onChange={(event) =>
                setValue("create_payment_link", event.target.checked)
              }
            />
            Create payment link instead of manual paid record
          </label>
        </div>

        <div className="finance-modal-actions">
          <button type="button" className="finance-btn ghost" onClick={close}>
            Cancel
          </button>

          <button type="submit" className="finance-btn primary" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save Coverage"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function FinanceCoverageManager({ member, memberId }) {
  const resolvedMemberId =
    memberId || firstValue(member, ["id", "member_id"], "");

  const [coverageRows, setCoverageRows] = useState([]);
  const [plans, setPlans] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const currentCoverage = useMemo(() => {
    return (
      coverageRows.find((row) =>
        ["active", "paid", "current"].includes(
          clean(firstValue(row, ["status", "subscription_status"], "")).toLowerCase()
        )
      ) ||
      coverageRows[0] ||
      {}
    );
  }, [coverageRows]);

  const currentMonths = useMemo(
    () => coverageMonths(currentCoverage),
    [currentCoverage]
  );

  const year = Number(
    firstValue(
      currentCoverage,
      ["coverage_year", "year"],
      new Date().getFullYear()
    )
  );

  const openMonths = useMemo(() => {
    const startMonth =
      year === memberStartYear(member) ? memberStartMonth(member) : 1;

    return MONTHS.filter(
      (month) => month.n >= startMonth && !currentMonths.includes(month.n)
    ).map((month) => month.n);
  }, [currentMonths, member, year]);

  const loadData = useCallback(async () => {
    if (!resolvedMemberId) return;

    setLoading(true);
    setError("");

    try {
      const [coveragePayload, plansPayload] = await Promise.all([
        getFirst([
          `/finance/members/${resolvedMemberId}/coverage`,
          `/finance/membership-coverage?member_id=${resolvedMemberId}`,
          `/subscription/member/${resolvedMemberId}`,
        ]),
        getFirst([
          "/admin/membership-plans",
          "/finance/dues-plans",
          "/dues/plans",
        ]),
      ]);

      setCoverageRows(normalizeRows(coveragePayload));
      setPlans(normalizePlans(plansPayload));
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load membership coverage."
      );
    } finally {
      setLoading(false);
    }
  }, [resolvedMemberId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSaved() {
    setSuccess("Membership coverage updated.");
    loadData();
  }

  return (
    <section className="finance-panel">
      <div className="finance-section-head">
        <div>
          <p className="finance-eyebrow">Membership</p>
          <h2>
            <CalendarDays size={18} />
            Coverage Manager
          </h2>
          <span>
            Review paid coverage, open months, plan status, and renew or change
            membership plans.
          </span>
        </div>

        <div className="finance-row-actions">
          <button
            type="button"
            className="finance-btn ghost"
            onClick={loadData}
            disabled={loading || !resolvedMemberId}
          >
            <RefreshCcw size={16} />
            Refresh
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={() => setModalOpen(true)}
            disabled={!resolvedMemberId || !plans.length}
          >
            <CreditCard size={16} />
            Renew / Change Plan
          </button>
        </div>
      </div>

      {error ? (
        <div className="finance-alert danger">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="finance-alert success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      ) : null}

      <div className="finance-summary-grid compact">
        <div className="finance-summary-card">
          <span>Current Plan</span>
          <strong>
            {firstValue(
              currentCoverage,
              ["plan_name", "membership_plan", "dues_plan_name"],
              "--"
            )}
          </strong>
          <small>
            <StatusBadge
              status={firstValue(
                currentCoverage,
                ["status", "subscription_status"],
                "unknown"
              )}
            />
          </small>
        </div>

        <div className="finance-summary-card">
          <span>Coverage</span>
          <strong>
            {firstValue(
              currentCoverage,
              ["coverage_label"],
              coverageLabelFromMonths(currentMonths, year)
            )}
          </strong>
          <small>{currentMonths.length} covered month(s)</small>
        </div>

        <div className="finance-summary-card">
          <span>Open Months</span>
          <strong>{openMonths.length}</strong>
          <small>
            {openMonths.length
              ? coverageLabelFromMonths(openMonths, year)
              : "No open months"}
          </small>
        </div>

        <div className="finance-summary-card">
          <span>Amount</span>
          <strong>
            {money(
              firstValue(
                currentCoverage,
                ["current_amount", "amount", "membership_amount"],
                0
              )
            )}
          </strong>
          <small>Current subscription value</small>
        </div>
      </div>

      <div className="finance-coverage-preview">
        <div>
          <strong>Coverage Year {year}</strong>
          <span>
            Months before the member start date are not treated as unpaid.
          </span>
        </div>

        <div className="finance-month-grid">
          {MONTHS.map((month) => {
            const startMonth =
              year === memberStartYear(member) ? memberStartMonth(member) : 1;

            const beforeStart = month.n < startMonth;
            const covered = currentMonths.includes(month.n);
            const open = !beforeStart && !covered;

            return (
              <span
                key={month.n}
                className={[
                  "finance-month-pill",
                  covered ? "selected" : "",
                  beforeStart ? "disabled" : "",
                  open ? "open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {covered ? "X " : ""}
                {month.short}
              </span>
            );
          })}
        </div>
      </div>

      <div className="finance-table-wrap">
        <table className="finance-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Coverage</th>
              <th>Months</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="finance-empty-cell">
                  Loading coverage...
                </td>
              </tr>
            ) : null}

            {!loading && !coverageRows.length ? (
              <tr>
                <td colSpan="7" className="finance-empty-cell">
                  No membership coverage found.
                </td>
              </tr>
            ) : null}

            {!loading &&
              coverageRows.map((row, index) => {
                const months = coverageMonths(row);

                return (
                  <tr key={firstValue(row, ["id", "subscription_id"], index)}>
                    <td>
                      <strong>
                        {firstValue(
                          row,
                          ["plan_name", "membership_plan", "dues_plan_name"],
                          "--"
                        )}
                      </strong>
                      <small>
                        {firstValue(row, ["payment_number", "invoice_number"], "--")}
                      </small>
                    </td>
                    <td>
                      {firstValue(
                        row,
                        ["coverage_label"],
                        coverageLabelFromMonths(
                          months,
                          Number(firstValue(row, ["coverage_year", "year"], year))
                        )
                      )}
                    </td>
                    <td>{months.length}</td>
                    <td>
                      {money(
                        firstValue(
                          row,
                          ["current_amount", "amount", "membership_amount"],
                          0
                        )
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        status={firstValue(
                          row,
                          ["status", "subscription_status"],
                          "--"
                        )}
                      />
                    </td>
                    <td>{formatDate(firstValue(row, ["start_date"], ""))}</td>
                    <td>{formatDate(firstValue(row, ["end_date"], ""))}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="finance-audit-empty">
        <ShieldCheck size={16} />
        Coverage changes should create invoice, receipt, payment, ledger, and
        audit records when paid.
      </div>

      <RenewalModal
        open={modalOpen}
        member={member}
        plans={plans}
        currentCoverage={currentCoverage}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </section>
  );
}