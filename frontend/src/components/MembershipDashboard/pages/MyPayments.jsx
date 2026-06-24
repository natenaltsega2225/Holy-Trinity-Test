// frontend/src/components/MembershipDashboard/pages/MyPayment.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bus,
  CreditCard,
  Gift,
  GraduationCap,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import api from "../../api";
import "../../../styles/member-dashboard.css";

const PAYMENT_TYPES = [
  {
    key: "membership",
    label: "Membership",
    sub: "Renew dues or enable auto-pay.",
    icon: CreditCard,
  },
  {
    key: "donation",
    label: "Donation",
    sub: "Give to church funds and categories.",
    icon: Gift,
  },
  {
    key: "school",
    label: "School Program",
    sub: "Pay school program registration.",
    icon: GraduationCap,
  },
  {
    key: "trip",
    label: "Trip Program",
    sub: "Pay trip program registration.",
    icon: Bus,
  },
];

const FALLBACK_DONATION_CATEGORIES = [
  { value: "plate_collection", label: "መባ — Plate Collection" },
  { value: "candle_sale", label: "ሻማ — Candle Sale" },
  { value: "general_donation", label: "ስጦታ — General Donation" },
  { value: "tithe", label: "አስራት — Tithe" },
  { value: "vows", label: "ስዕለት — Vows" },
  { value: "baptism", label: "ክርስትና — Baptism" },
  { value: "wedding_engagement", label: "ጋብቻ / ቀለበት — Wedding / Engagement" },
  { value: "memorial_service", label: "ፍታት — Memorial Service" },
  { value: "building_fund", label: "የቤተክርስቲያን ማሰሪያ — Building Fund" },
  { value: "charity_fund", label: "በጎ አድራጎት — Charity Fund" },
  { value: "auction", label: "ጨረታ — Auction" },
  { value: "other_fund", label: "ሌላ — Other Fund" },
];

const PLAN_ENDPOINTS = [
  "/dues/plans?active=1",
  "/dues/plans",
  "/membership/plans?active=1",
  "/membership/plans",
  "/member/plans?active=1",
  "/member/plans",
];

const DONATION_ENDPOINTS = [
  "/donation/categories?active=1",
  "/donation/categories",
  "/donations/categories?active=1",
  "/donations/categories",
  "/finance/donation-categories?active=1",
  "/finance/donation-categories",
];

const SCHOOL_ENDPOINTS = [
  "/school/programs?status=active",
  "/school/programs?active=1",
  "/school/programs",
  "/programs/school?status=active",
  "/programs/school",
];

const TRIP_ENDPOINTS = [
  "/trip/programs?status=active",
  "/trip/programs?active=1",
  "/trip/programs",
  "/programs/trip?status=active",
  "/programs/trip",
];

const CHECKOUT_ENDPOINTS = [
  "/checkout/member-payment",
  "/membership/payments/checkout",
  "/payments/member/checkout",
  "/payments/checkout",
  "/checkout/membership",
];

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function firstValue(source, keys, fallback = "") {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function collectArrays(payload, keys) {
  const found = [];
  const visited = new WeakSet();

  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      found.push(node);
      return;
    }

    for (const key of keys) {
      if (Array.isArray(node[key])) found.push(node[key]);
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") walk(value);
    }
  }

  walk(payload);
  return found;
}

function normalizeRows(payload, keys = []) {
  if (Array.isArray(payload)) return payload;

  const preferredKeys = [
    ...keys,
    "rows",
    "items",
    "results",
    "data",
    "plans",
    "programs",
    "categories",
    "records",
  ];

  const arrays = collectArrays(payload, preferredKeys);
  return arrays.find((items) => items.length > 0) || arrays[0] || [];
}

function normalizeIsActive(row) {
  const raw = firstValue(row, ["is_active", "active", "enabled", "isEnabled", "status"], "active");
  const value = String(raw).trim().toLowerCase();
  return !["inactive", "disabled", "archived", "deleted", "false", "0", "closed", "cancelled"].includes(value);
}

function optionId(row) {
  return String(firstValue(row, ["id", "_id", "uuid", "program_id", "plan_id", "category_id", "slug", "code"], ""));
}

function optionName(row) {
  return clean(
    firstValue(row, [
      "name",
      "title",
      "label",
      "program_name",
      "program_title",
      "plan_name",
      "category_name",
      "display_name",
    ]),
    "Untitled"
  );
}

function rowAmount(row) {
  return numberValue(
    firstValue(row, [
      "amount",
      "price",
      "fee",
      "cost",
      "price_per_person",
      "registration_fee",
      "monthly_amount",
      "membership_amount",
      "total_amount",
      "default_amount",
    ])
  );
}

function schoolAmount(program, quantity) {
  const tiers = parseJsonArray(firstValue(program, ["pricing_tiers", "pricing_tiers_json", "tiers"], []));
  const normalizedQty = Math.max(1, Number(quantity || 1));

  const exactTier = tiers.find((tier) => {
    const tierQty = Number(firstValue(tier, ["student_count", "students", "quantity", "qty", "count"], 0));
    return tierQty === normalizedQty;
  });

  if (exactTier) return numberValue(firstValue(exactTier, ["amount", "price", "total"], 0));
  return rowAmount(program) * normalizedQty;
}

function normalizeCategory(row) {
  const value = clean(firstValue(row, ["value", "key", "slug", "code", "id", "_id", "name"], ""), "other_fund");
  return {
    value: String(value),
    label: optionName(row),
  };
}

async function getFirstAvailable(endpoints, keys) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint, {
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        params: { _ts: Date.now() },
      });
      const rows = normalizeRows(response.data, keys).filter(Boolean);
      if (rows.length > 0) return rows;
    } catch (error) {
      lastError = error;
      if (![401, 403, 404, 405].includes(error?.response?.status)) break;
    }
  }

  if (lastError && ![404, 405].includes(lastError?.response?.status)) throw lastError;
  return [];
}

async function postFirstAvailable(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.post(endpoint, payload);
      return response.data;
    } catch (error) {
      lastError = error;
      if (![404, 405].includes(error?.response?.status)) break;
    }
  }

  throw lastError || new Error("Checkout route is not available.");
}

function TypeButton({ option, active, onClick }) {
  const Icon = option.icon;

  return (
    <button
      type="button"
      className={`member-card member-card-feature ${active ? "is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <div className="member-section-header">
        <Icon size={20} />
        <h3>{option.label}</h3>
      </div>
      <p className="member-muted">{option.sub}</p>
    </button>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="member-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function MyPayment() {
  const location = useLocation();
  const navigate = useNavigate();

  const requestedType = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("type") || params.get("category");
    return PAYMENT_TYPES.some((item) => item.key === type) ? type : "membership";
  }, [location.search]);

  const [form, setForm] = useState({
    type: requestedType,
    donation_category: "tithe",
    amount: "",
    school_program_id: "",
    trip_program_id: "",
    plan_id: "",
    coverage_months: 1,
    quantity: 1,
    payment_method: "card",
    auto_subscription: false,
    notes: "",
  });

  const [plans, setPlans] = useState([]);
  const [donationCategories, setDonationCategories] = useState(FALLBACK_DONATION_CATEGORIES);
  const [schoolPrograms, setSchoolPrograms] = useState([]);
  const [tripPrograms, setTripPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    setForm((current) => ({ ...current, type: requestedType }));
  }, [requestedType]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    setOk("");

    try {
      const [planResult, donationResult, schoolResult, tripResult] = await Promise.allSettled([
        getFirstAvailable(PLAN_ENDPOINTS, ["plans"]),
        getFirstAvailable(DONATION_ENDPOINTS, ["categories"]),
        getFirstAvailable(SCHOOL_ENDPOINTS, ["programs", "schoolPrograms"]),
        getFirstAvailable(TRIP_ENDPOINTS, ["programs", "tripPrograms"]),
      ]);

      if (planResult.status === "fulfilled") {
        setPlans(planResult.value.filter(normalizeIsActive));
      }

      if (donationResult.status === "fulfilled" && donationResult.value.length > 0) {
        setDonationCategories(donationResult.value.filter(normalizeIsActive).map(normalizeCategory));
      } else {
        setDonationCategories(FALLBACK_DONATION_CATEGORIES);
      }

      if (schoolResult.status === "fulfilled") {
        setSchoolPrograms(schoolResult.value.filter(normalizeIsActive));
      }

      if (tripResult.status === "fulfilled") {
        setTripPrograms(tripResult.value.filter(normalizeIsActive));
      }

      const failures = [planResult, schoolResult, tripResult]
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason?.response?.data?.error || result.reason?.message)
        .filter(Boolean);

      if (failures.length > 0) setErr(failures[0]);
    } catch (error) {
      setErr(error?.response?.data?.error || error?.message || "Unable to load payment options.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedPlan = useMemo(
    () => plans.find((row) => optionId(row) === String(form.plan_id)) || plans[0] || null,
    [plans, form.plan_id]
  );

  const selectedSchool = useMemo(
    () => schoolPrograms.find((row) => optionId(row) === String(form.school_program_id)) || null,
    [schoolPrograms, form.school_program_id]
  );

  const selectedTrip = useMemo(
    () => tripPrograms.find((row) => optionId(row) === String(form.trip_program_id)) || null,
    [tripPrograms, form.trip_program_id]
  );

  const computedAmount = useMemo(() => {
    if (form.type === "membership") {
      const months = Math.max(1, Number(form.coverage_months || 1));
      const base = rowAmount(selectedPlan);
      return form.auto_subscription ? base : base * months;
    }

    if (form.type === "school") {
      if (!selectedSchool) return 0;
      return schoolAmount(selectedSchool, form.quantity);
    }

    if (form.type === "trip") {
      if (!selectedTrip) return 0;
      return rowAmount(selectedTrip) * Math.max(1, Number(form.quantity || 1));
    }

    return numberValue(form.amount);
  }, [form, selectedPlan, selectedSchool, selectedTrip]);

  const selectedType = PAYMENT_TYPES.find((item) => item.key === form.type) || PAYMENT_TYPES[0];
  const SelectedIcon = selectedType.icon;

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function chooseType(type) {
    setErr("");
    setOk("");
    setForm((current) => ({
      ...current,
      type,
      amount: "",
      quantity: 1,
      auto_subscription: type === "membership" ? current.auto_subscription : false,
    }));
  }

  function validate() {
    if (form.type === "membership" && !selectedPlan) return "No active membership plans were returned from the backend.";
    if (form.type === "school" && !selectedSchool) return "No active school programs were returned from the backend.";
    if (form.type === "trip" && !selectedTrip) return "No active trip programs were returned from the backend.";
    if (!computedAmount || computedAmount <= 0) return "Please enter or select a valid amount.";
    return "";
  }

  async function submitCheckout(event) {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setErr(validationError);
      return;
    }

    setSubmitting(true);
    setErr("");
    setOk("");

    try {
      const type = form.type;
      const selectedProgram = type === "school" ? selectedSchool : selectedTrip;
      const selectedProgramName = selectedProgram ? optionName(selectedProgram) : "";

      const payload = {
        source: "member_dashboard",
        created_from: "member_dashboard",
        category: type,
        payment_type: type,
        type,
        amount: computedAmount,
        total_amount: computedAmount,
        subtotal_amount: computedAmount,
        payment_method: form.payment_method,
        method: form.payment_method,
        create_invoice: true,
        send_invoice_email: true,
        send_receipt_email: true,
        return_url: `${window.location.origin}/dash/membership/invoices-receipts`,
        cancel_url: window.location.href,
        notes: form.notes || "",
        donation_category: type === "donation" ? form.donation_category : "",
        plan_id: type === "membership" ? optionId(selectedPlan) : null,
        dues_plan_id: type === "membership" ? optionId(selectedPlan) : null,
        plan_name: type === "membership" ? optionName(selectedPlan || {}) : "",
        coverage_months: type === "membership" ? Number(form.coverage_months || 1) : null,
        auto_subscription: type === "membership" ? Boolean(form.auto_subscription) : false,
        subscription: type === "membership" ? Boolean(form.auto_subscription) : false,
        school_program_id: type === "school" ? optionId(selectedSchool) : null,
        trip_program_id: type === "trip" ? optionId(selectedTrip) : null,
        program_id: ["school", "trip"].includes(type) ? optionId(selectedProgram) : null,
        program_name: selectedProgramName,
        program_title: selectedProgramName,
        quantity: ["school", "trip"].includes(type) ? Number(form.quantity || 1) : 1,
        number_of_students: type === "school" ? Number(form.quantity || 1) : null,
        participants_count: type === "trip" ? Number(form.quantity || 1) : null,
        metadata: {
          source: "member_dashboard",
          category: type,
          payment_type: type,
          donation_category: type === "donation" ? form.donation_category : "",
          program_name: selectedProgramName,
          auto_subscription: type === "membership" ? String(Boolean(form.auto_subscription)) : "false",
        },
      };

      const response = await postFirstAvailable(CHECKOUT_ENDPOINTS, payload);
      const checkoutUrl = firstValue(response, [
        "url",
        "checkout_url",
        "payment_url",
        "session_url",
        "stripe_url",
        "redirect_url",
        "payment_link",
        "payment_link_url",
        "public_url",
        "invoice_url",
        "checkoutUrl",
      ]);

      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }

      setOk("Payment request was created. Please check your email for the invoice and payment link.");
    } catch (error) {
      setErr(
        error?.response?.data?.details ||
          error?.response?.data?.error ||
          error?.message ||
          "Unable to start checkout."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="membership-dashboard-page member-page-stack">
      <section className="member-page-hero">
        <div>
          <span className="member-eyebrow">Member Self Checkout</span>
          <h1>Make a Payment</h1>
          <p className="member-page-subtitle">
            Pay membership dues, donations, school programs, and trip programs with secure card or ACH checkout.
          </p>
        </div>

        <div className="member-page-actions">
          <button type="button" className="member-btn member-btn-light" onClick={load} disabled={loading}>
            <RefreshCcw size={16} className={loading ? "member-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="member-btn member-btn-light"
            onClick={() => navigate("/dash/membership/invoices-receipts")}
          >
            <ShieldCheck size={16} />
            Invoices
          </button>
        </div>
      </section>

      {err ? (
        <div className="member-alert member-alert-danger">
          <AlertTriangle size={17} />
          {err}
        </div>
      ) : null}

      {ok ? (
        <div className="member-alert member-alert-success">
          <ShieldCheck size={17} />
          {ok}
        </div>
      ) : null}

      <section className="member-dashboard-grid">
        {PAYMENT_TYPES.map((option) => (
          <TypeButton
            key={option.key}
            option={option}
            active={form.type === option.key}
            onClick={() => chooseType(option.key)}
          />
        ))}
      </section>

      <form className="member-dashboard-grid" onSubmit={submitCheckout}>
        <section className="member-card member-card-feature">
          <div className="member-section-header">
            <SelectedIcon size={21} />
            <h2>{selectedType.label} Details</h2>
          </div>

          {form.type === "donation" ? (
            <div className="member-filter-grid">
              <label>
                Donation Category
                <select
                  value={form.donation_category}
                  onChange={(event) => updateField("donation_category", event.target.value)}
                >
                  {donationCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Amount
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => updateField("amount", event.target.value)}
                  placeholder="100.00"
                />
              </label>
            </div>
          ) : null}

          {form.type === "school" ? (
            <div className="member-filter-grid">
              <label>
                School Program
                <select
                  value={form.school_program_id}
                  onChange={(event) => updateField("school_program_id", event.target.value)}
                >
                  <option value="">Select school program</option>
                  {schoolPrograms.map((program) => (
                    <option key={optionId(program)} value={optionId(program)}>
                      {optionName(program)} - {money(rowAmount(program))}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Number of Students
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(event) => updateField("quantity", event.target.value)}
                />
              </label>
            </div>
          ) : null}

          {form.type === "trip" ? (
            <div className="member-filter-grid">
              <label>
                Trip Program
                <select
                  value={form.trip_program_id}
                  onChange={(event) => updateField("trip_program_id", event.target.value)}
                >
                  <option value="">Select trip program</option>
                  {tripPrograms.map((program) => (
                    <option key={optionId(program)} value={optionId(program)}>
                      {optionName(program)} - {money(rowAmount(program))}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Participants
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(event) => updateField("quantity", event.target.value)}
                />
              </label>
            </div>
          ) : null}

          {form.type === "membership" ? (
            <div className="member-filter-grid">
              <label>
                Membership Plan
                <select value={form.plan_id} onChange={(event) => updateField("plan_id", event.target.value)}>
                  {plans.length === 0 ? <option value="">No active plans found</option> : null}
                  {plans.map((plan) => (
                    <option key={optionId(plan)} value={optionId(plan)}>
                      {optionName(plan)} - {money(rowAmount(plan))}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Coverage Months
                <select
                  value={form.coverage_months}
                  onChange={(event) => updateField("coverage_months", event.target.value)}
                  disabled={form.auto_subscription}
                >
                  {[1, 3, 6, 12].map((month) => (
                    <option key={month} value={month}>
                      {month} Month{month > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Auto Subscription
                <select
                  value={form.auto_subscription ? "yes" : "no"}
                  onChange={(event) => updateField("auto_subscription", event.target.value === "yes")}
                >
                  <option value="no">One-time renewal</option>
                  <option value="yes">Auto subscription</option>
                </select>
              </label>
            </div>
          ) : null}

          <div className="member-filter-grid">
            <label>
              Checkout Method
              <select value={form.payment_method} onChange={(event) => updateField("payment_method", event.target.value)}>
                <option value="card">Card - Stripe</option>
                <option value="ach">ACH / Bank</option>
              </select>
            </label>

            <label>
              Notes
              <input value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Optional note" />
            </label>
          </div>
        </section>

        <aside className="member-card">
          <div className="member-section-header">
            <CreditCard size={20} />
            <h2>Checkout Summary</h2>
          </div>

          <div className="member-detail-grid">
            <SummaryRow label="Payment Type" value={selectedType.label} />
            <SummaryRow label="Method" value={form.payment_method === "ach" ? "ACH" : "Card"} />
            <SummaryRow label="Invoice Email" value="Will be sent" />
            <SummaryRow label="Receipt Email" value="After payment" />
            <SummaryRow label={form.auto_subscription ? "Subscription Amount" : "Total Due"} value={money(computedAmount)} />
          </div>

          <button type="submit" className="member-btn member-btn-primary member-full-width" disabled={submitting || loading}>
            {submitting ? <RefreshCcw size={16} className="member-spin" /> : <CreditCard size={16} />}
            Continue to Secure Checkout
          </button>
        </aside>
      </form>
    </div>
  );
}
