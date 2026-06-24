// frontend/src/components/FinanceDashboard/pages/FinanceRegistration.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Hash,
  Loader2,
  Mail,
  RefreshCcw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const PAYMENT_METHODS = [
  { value: "card", label: "Stripe Card" },
  { value: "ach", label: "Stripe ACH" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
];

const COVERAGE_MONTHS = [
  { value: 1, label: "1 Month" },
  { value: 3, label: "3 Months" },
  { value: 6, label: "6 Months" },
  { value: 12, label: "12 Months" },
];

const HOUSEHOLD_TYPES = [
  { value: "family", label: "Family" },
  { value: "single", label: "Single" },
  { value: "couple", label: "Couple" },
 
];

const GENDER_OPTIONS = [
  { value: "", label: "Select Gender" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
  return Math.round(numberValue(value) * 100) / 100;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numberValue(value));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function clean(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
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

function responseData(response) {
  return response?.data || response || {};
}

function rowsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.plans)) return data.plans;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  if (Array.isArray(data?.data?.plans)) return data.data.plans;
  return [];
}

async function getFirst(endpoints) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint);
      return responseData(response);
    } catch (err) {
      lastError = err;
      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) throw err;
    }
  }

  throw lastError || new Error("Membership plans endpoint is not available.");
}

function monthName(monthNumber, long = false) {
  const index = Math.max(0, Math.min(11, Number(monthNumber || 1) - 1));
  return new Date(2026, index, 1).toLocaleString("en-US", {
    month: long ? "long" : "short",
  });
}

function addMonths(startDate, months) {
  const date = new Date(`${startDate || todayIso()}T00:00:00`);
  date.setMonth(date.getMonth() + Number(months || 1) - 1);
  return date;
}

function coverageFrom(startDate, months) {
  const start = new Date(`${startDate || todayIso()}T00:00:00`);
  const end = addMonths(startDate, months);

  const startMonth = start.getMonth() + 1;
  const endMonth = end.getMonth() + 1;
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  return {
    start_month: startMonth,
    start_year: startYear,
    end_month: endMonth,
    end_year: endYear,
    year: startYear,
    label:
      startYear === endYear
        ? `${monthName(startMonth)} - ${monthName(endMonth)} ${startYear}`
        : `${monthName(startMonth)} ${startYear} - ${monthName(endMonth)} ${endYear}`,
  };
}

function planId(plan = {}) {
  return firstValue(plan, ["id", "plan_id", "dues_plan_id"], "");
}

function planName(plan = {}) {
  return firstValue(plan, ["plan_name", "name", "title"], "Membership Plan");
}

function planAmount(plan = {}) {
  return numberValue(
    firstValue(
      plan,
      [
        "minimum_amount",
        "amount",
        "price",
        "monthly_amount",
        "current_amount",
        "membership_amount",
        "dues_amount",
      ],
      0
    )
  );
}

function planMonths(plan = {}) {
  return (
    Number(
      firstValue(
        plan,
        ["duration_months", "months", "billing_months", "coverage_months"],
        1
      )
    ) || 1
  );
}

function planRegistrationFee(plan = {}, fallback = 55) {
  return numberValue(
    firstValue(plan, ["registration_fee", "new_member_fee", "signup_fee"], fallback)
  );
}

function planBillingCycle(plan = {}) {
  return firstValue(plan, ["billing_cycle", "cycle", "selected_option"], "");
}

function amountForMonths(plan, months) {
  if (!plan) return 0;

  const baseAmount = planAmount(plan);
  const baseMonths = Math.max(1, planMonths(plan));
  const nextMonths = Math.max(1, Number(months || baseMonths));

  if (baseAmount <= 0) return 0;
  if (baseMonths === nextMonths) return roundMoney(baseAmount);

  return roundMoney((baseAmount / baseMonths) * nextMonths);
}

function processingFee(amount, method) {
  if (!["card", "ach"].includes(method)) return 0;
  if (method === "ach") return roundMoney(amount * 0.008 + 0.3);
  return roundMoney(amount * 0.029 + 0.3);
}

function initialForm() {
  return {
    first_name: "",
    last_name: "",
    gender: "",
    email: "",
    phone: "",
    household_type: "family",
    start_date: todayIso(),
    address: "",
    city: "",
    state: "",
    zip: "",
    dues_plan_id: "",
    plan_name: "",
    coverage_months: 1,
    membership_amount: "",
    registration_fee: "55",
    payment_method: "cash",
    reference_no: "",
    check_number: "",
    bank_name: "",
    zelle_reference: "",
    notes: "",
    create_login: true,
    send_welcome_email: true,
    send_invoice_email: true,
    send_receipt_email: true,
  };
}

export default function FinanceRegistration() {
  const [form, setForm] = useState(initialForm());
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedPlan = useMemo(
    () =>
      plans.find((plan) => String(planId(plan)) === String(form.dues_plan_id)) ||
      null,
    [plans, form.dues_plan_id]
  );

  const fullName = useMemo(
    () => `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
    [form.first_name, form.last_name]
  );

  const registrationFee = numberValue(form.registration_fee);
  const membershipAmount = numberValue(form.membership_amount);
  const isStripe = ["card", "ach"].includes(form.payment_method);
  const fee = processingFee(registrationFee + membershipAmount, form.payment_method);
  const totalDue = roundMoney(registrationFee + membershipAmount + fee);
  const coverage = coverageFrom(form.start_date, form.coverage_months);

  const validationError = useMemo(() => {
    if (!form.first_name.trim()) return "First name is required.";
    if (!form.last_name.trim()) return "Last name is required.";
    if (!form.gender) return "Gender is required.";
    if (!form.email.trim()) return "Email is required.";
    if (!form.phone.trim()) return "Phone is required.";
    if (!form.start_date) return "Membership start date is required.";
    if (!form.dues_plan_id && !form.plan_name.trim()) return "Membership plan is required.";
    if (membershipAmount <= 0) return "Membership amount must be greater than zero.";
    if (registrationFee < 0) return "Registration fee cannot be negative.";
    if (form.payment_method === "check" && !form.check_number.trim()) {
      return "Check number is required for check payment.";
    }
    if (form.payment_method === "zelle" && !form.zelle_reference.trim()) {
      return "Zelle reference is required for Zelle payment.";
    }
    return "";
  }, [form, membershipAmount, registrationFee]);

  async function loadPlans() {
    setLoadingPlans(true);
    setError("");

    try {
      const data = await getFirst([
        "/dues/plans",
        "/admin/membership-plans",
        "/subscription/plans",
      ]);

      const nextPlans = rowsFrom(data);
      setPlans(nextPlans);

      if (nextPlans.length && !form.dues_plan_id) {
        const first = nextPlans[0];
        const months = planMonths(first);
        setForm((current) => ({
          ...current,
          dues_plan_id: String(planId(first)),
          plan_name: planName(first),
          coverage_months: months,
          membership_amount: String(amountForMonths(first, months)),
          registration_fee: String(planRegistrationFee(first, current.registration_fee)),
        }));
      }
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load membership plans."
      );
    } finally {
      setLoadingPlans(false);
    }
  }

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "dues_plan_id") {
        const plan = plans.find((item) => String(planId(item)) === String(value));
        if (plan) {
          const months = planMonths(plan);
          next.plan_name = planName(plan);
          next.coverage_months = months;
          next.membership_amount = String(amountForMonths(plan, months));
          next.registration_fee = String(planRegistrationFee(plan, current.registration_fee));
        }
      }

      if (key === "coverage_months") {
        const months = Number(value || 1);
        next.coverage_months = months;
        const plan =
          plans.find((item) => String(planId(item)) === String(current.dues_plan_id)) ||
          selectedPlan;
        if (plan) next.membership_amount = String(amountForMonths(plan, months));
      }

      return next;
    });
  }

  function buildPayload() {
    const reference =
      form.reference_no.trim() ||
      form.check_number.trim() ||
      form.zelle_reference.trim() ||
      null;
console.log("REGISTRATION FORM");
console.log({
  start_date: form.start_date,
  coverage,
  coverage_year: coverage.year,
});
    return {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      full_name: fullName,
      gender: form.gender,
      email: form.email.trim(),
      phone: form.phone.trim(),
      household_type: form.household_type,
      membership_start_date: form.start_date,
      start_date: form.start_date,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
      dues_plan_id: form.dues_plan_id || null,
      plan_id: form.dues_plan_id || null,
      plan_name: form.plan_name || planName(selectedPlan || {}),
      billing_cycle: planBillingCycle(selectedPlan || {}),
      selected_option: planBillingCycle(selectedPlan || ""),
      coverage_months: Number(form.coverage_months || 1),
      duration_months: Number(form.coverage_months || 1),
      months_paid: Number(form.coverage_months || 1),
      coverage_start_month: coverage.start_month,
      coverage_start_year: coverage.start_year,
      coverage_end_month: coverage.end_month,
      coverage_end_year: coverage.end_year,
      coverage_year: coverage.year,
      coverage_label: coverage.label,
      registration_fee: registrationFee,
      membership_amount: membershipAmount,
      processing_fee: fee,
      amount: totalDue,
      total_amount: totalDue,
      payment_method: form.payment_method,
      method: form.payment_method,
      provider: isStripe ? "stripe" : "manual",
      reference_no: reference,
      check_number: form.check_number.trim() || null,
      bank_name: form.bank_name.trim() || null,
      zelle_reference: form.zelle_reference.trim() || null,
      notes: form.notes.trim() || null,
      create_login: form.create_login,
      create_user: form.create_login,
      send_welcome_email: form.send_welcome_email,
      send_invoice_email: form.send_invoice_email,
      send_receipt_email: form.send_receipt_email,
      source: "finance_registration_frontend",
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setResult(null);

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);

      const endpoint = isStripe
        ? "/finance/registration/stripe"
        : "/finance/registration/manual";

      const response = await api.post(endpoint, buildPayload(), { timeout: 120000 });
      const data = responseData(response);
      setResult(data);

      if (isStripe) {
        const checkoutUrl = data.checkout_url || data.url || data.session_url || data.stripe_url;
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
          return;
        }
        setSuccess("Stripe checkout session created.");
      } else {
        setSuccess("Member registration completed. Invoice, receipt, and welcome email were requested.");
      }
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Finance registration failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm(initialForm());
    setResult(null);
    setError("");
    setSuccess("");
  }

  const monthActive = (month) =>
    coverage.start_year === coverage.end_year
      ? month >= coverage.start_month && month <= coverage.end_month
      : month >= coverage.start_month || month <= coverage.end_month;

  return (
    <section className="finance-page finance-registration-page">

      <div className="finance-page-header finance-registration-hero">
        <div>
          <p className="finance-eyebrow">Finance Registration</p>
          <h1>New Member Registration</h1>
          <p className="finance-page-subtitle">
            Register a member, create login access, collect card/ACH or manual payment,
            generate invoice and receipt, and send the welcome email.
          </p>
        </div>

        <div className="finance-page-actions">
          <button type="button" className="finance-btn finance-btn-light" onClick={loadPlans}>
            <RefreshCcw size={16} className={loadingPlans ? "finance-spin" : ""} />
            Plans
          </button>
          <button type="button" className="finance-btn finance-btn-light" onClick={resetForm}>
            Reset
          </button>
        </div>
      </div>

      {error ? (
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="finance-alert finance-alert-success">
          <CheckCircle2 size={17} />
          <span>{success}</span>
        </div>
      ) : null}

      <form className="finance-registration-form" onSubmit={handleSubmit}>
        <div className="finance-registration-layout">
          <div className="finance-panel finance-registration-card">
            <div className="finance-section-title">
              <UserPlus size={18} />
              <h3>Member Information</h3>
            </div>

            <p className="finance-muted">
              The backend assigns the next unique five-digit member ID and creates secure
              first-login credentials when account creation is enabled.
            </p>

            <div className="finance-registration-fields">
              <label>
                <span>First Name *</span>
                <input value={form.first_name} onChange={(e) => updateField("first_name", e.target.value)} disabled={submitting} />
              </label>

              <label>
                <span>Last Name *</span>
                <input value={form.last_name} onChange={(e) => updateField("last_name", e.target.value)} disabled={submitting} />
              </label>

              <label>
                <span>Gender *</span>
                <select value={form.gender} onChange={(e) => updateField("gender", e.target.value)} disabled={submitting}>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value || "gender-empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Email *</span>
                <input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} disabled={submitting} />
              </label>

              <label>
                <span>Phone *</span>
                <input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} disabled={submitting} />
              </label>

              <label>
                <span>Household Type</span>
                <select value={form.household_type} onChange={(e) => updateField("household_type", e.target.value)} disabled={submitting}>
                  {HOUSEHOLD_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Membership Start Date *</span>
                <input type="date" value={form.start_date} onChange={(e) => updateField("start_date", e.target.value)} disabled={submitting} />
              </label>

              <label className="span-3">
                <span>Address</span>
                <input value={form.address} onChange={(e) => updateField("address", e.target.value)} disabled={submitting} />
              </label>

              <label>
                <span>City</span>
                <input value={form.city} onChange={(e) => updateField("city", e.target.value)} disabled={submitting} />
              </label>

              <label>
                <span>State</span>
                <input value={form.state} onChange={(e) => updateField("state", e.target.value)} disabled={submitting} />
              </label>

              <label>
                <span>ZIP</span>
                <input value={form.zip} onChange={(e) => updateField("zip", e.target.value)} disabled={submitting} />
              </label>
            </div>
          </div>

          <div className="finance-panel finance-registration-card">
            <div className="finance-section-title">
              <DollarSign size={18} />
              <h3>Payment Summary</h3>
            </div>

            <div className="finance-summary-list compact">
              <div><span>Registration Fee</span><strong>{money(registrationFee)}</strong></div>
              <div><span>Membership Payment</span><strong>{money(membershipAmount)}</strong></div>
              {fee ? <div><span>Processing Fee</span><strong>{money(fee)}</strong></div> : null}
              <div><span>Coverage</span><strong>{coverage.label}</strong></div>
              <div className="total"><span>Total Due</span><strong>{money(totalDue)}</strong></div>
            </div>

           
          </div>
        </div>

        <div className="finance-registration-layout">
          <div className="finance-panel finance-registration-card">
            <div className="finance-section-title">
              <CalendarDays size={18} />
              <h3>Membership Plan</h3>
            </div>

            <div className="finance-registration-fields two">
              <label>
                <span>Plan *</span>
                <select value={form.dues_plan_id} onChange={(e) => updateField("dues_plan_id", e.target.value)} disabled={submitting || loadingPlans}>
                  <option value="">{loadingPlans ? "Loading plans..." : "Select Plan"}</option>
                  {plans.map((plan) => (
                    <option key={planId(plan)} value={planId(plan)}>
                      {planName(plan)} - {money(planAmount(plan))}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Coverage Months</span>
                <select value={form.coverage_months} onChange={(e) => updateField("coverage_months", Number(e.target.value))} disabled={submitting}>
                  {COVERAGE_MONTHS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Plan Name</span>
                <input value={form.plan_name} onChange={(e) => updateField("plan_name", e.target.value)} disabled={submitting} />
              </label>

              <label>
                <span>Membership Amount *</span>
                <input type="number" min="0.01" step="0.01" value={form.membership_amount} onChange={(e) => updateField("membership_amount", e.target.value)} disabled={submitting} />
              </label>

              <label>
                <span>Registration Fee</span>
                <input type="number" min="0" step="0.01" value={form.registration_fee} onChange={(e) => updateField("registration_fee", e.target.value)} disabled={submitting} />
              </label>
            </div>
          </div>

          <div className="finance-panel finance-registration-card">
            <div className="finance-section-title">
              <CreditCard size={18} />
              <h3>Payment Method</h3>
            </div>

            <div className="finance-registration-fields two">
              <label>
                <span>Payment Method *</span>
                <select value={form.payment_method} onChange={(e) => updateField("payment_method", e.target.value)} disabled={submitting}>
                  {PAYMENT_METHODS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Reference #</span>
                <input value={form.reference_no} onChange={(e) => updateField("reference_no", e.target.value)} placeholder="Optional manual reference" disabled={submitting} />
              </label>

              {form.payment_method === "check" ? (
                <>
                  <label>
                    <span>Check # *</span>
                    <input value={form.check_number} onChange={(e) => updateField("check_number", e.target.value)} disabled={submitting} />
                  </label>
                  <label>
                    <span>Bank Name</span>
                    <input value={form.bank_name} onChange={(e) => updateField("bank_name", e.target.value)} disabled={submitting} />
                  </label>
                </>
              ) : null}

              {form.payment_method === "zelle" ? (
                <label>
                  <span>Zelle Reference *</span>
                  <input value={form.zelle_reference} onChange={(e) => updateField("zelle_reference", e.target.value)} disabled={submitting} />
                </label>
              ) : null}

              <label className="span-2">
                <span>Notes</span>
                <textarea rows={4} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} disabled={submitting} />
              </label>
            </div>
          </div>
        </div>

        <div className="finance-panel finance-registration-card">
          <div className="finance-section-title">
            <ShieldCheck size={18} />
            <h3>Workflow Controls</h3>
          </div>

          <div className="finance-check-grid enterprise">
            {[
              ["create_login", "Create member login account"],
              ["send_welcome_email", "Send welcome email"],
              ["send_invoice_email", "Send invoice email with PDF attachment"],
              ["send_receipt_email", "Send receipt email with PDF attachment"],
            ].map(([key, label]) => (
              <label key={key}>
                <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => updateField(key, e.target.checked)} disabled={submitting} />
                <span>{key === "send_welcome_email" ? <Mail size={15} /> : null}{label}</span>
              </label>
            ))}
          </div>
        </div>

        {result ? (
          <div className="finance-panel finance-registration-card">
            <div className="finance-section-title">
              <CheckCircle2 size={18} />
              <h3>Registration Result</h3>
            </div>

            <div className="finance-detail-grid">
              <div><span>Member ID</span><strong>{clean(result.member_no || result.member?.member_no, "--")}</strong></div>
              <div><span>Payment #</span><strong>{clean(result.payment_number || result.payment?.payment_number, "--")}</strong></div>
              <div><span>Invoice #</span><strong>{clean(result.invoice_number || result.invoice?.invoice_number, "--")}</strong></div>
              <div><span>Receipt #</span><strong>{clean(result.receipt_number || result.receipt?.receipt_number, "--")}</strong></div>
            </div>
          </div>
        ) : null}

        <div className="finance-modal-actions sticky">
          <button type="button" className="finance-btn finance-btn-light" onClick={resetForm} disabled={submitting}>
            Reset
          </button>

          <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting || Boolean(validationError)} title={validationError || "Register member"}>
            {submitting ? <Loader2 size={16} className="finance-spin" /> : <UserPlus size={16} />}
            {submitting ? (isStripe ? "Creating Checkout..." : "Registering...") : isStripe ? "Continue to Stripe Checkout" : "Create Member, Invoice & Receipt"}
          </button>
        </div>
      </form>

      
    </section>
  );
}