import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Filter,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Wallet,
  X,
} from "lucide-react";

import "../../../styles/finance-enterprise.css";

export const FINANCE_MEMBER_FILTER_DEFAULTS = {
  search: "",
  q: "",

  status: "",
  active: "",
  membership_status: "",
  account_status: "",
  payment_status: "",
  registration_fee_status: "",

  household_type: "",
  gender: "",

  member_no: "",
  email: "",
  phone: "",

  city: "",
  state: "",
  zip: "",

  dues_plan_id: "",
  campaign_id: "",

  coverage_year: "",
  coverage_month: "",
  coverage_status: "",

  balance_min: "",
  balance_max: "",
  total_paid_min: "",
  total_paid_max: "",

  start_date_from: "",
  start_date_to: "",
  registered_from: "",
  registered_to: "",
  last_payment_from: "",
  last_payment_to: "",
  next_due_from: "",
  next_due_to: "",

  has_dependents: "",
  has_login: "",
  must_change_password: "",
  welcome_email_status: "",

  include_inactive: false,
  only_overdue: false,
  only_unpaid: false,
  only_missing_email: false,
};

const MEMBERSHIP_STATUS_OPTIONS = [
  { value: "", label: "All Membership Statuses" },
  { value: "active", label: "Active" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "inactive", label: "Inactive" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

const ACCOUNT_STATUS_OPTIONS = [
  { value: "", label: "All Account Statuses" },
  { value: "active", label: "Active" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "pending_activation", label: "Pending Activation" },
  { value: "locked", label: "Locked" },
  { value: "disabled", label: "Disabled" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "All Payment Statuses" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "waived", label: "Waived" },
];

const REGISTRATION_FEE_OPTIONS = [
  { value: "", label: "All Registration Fees" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "waived", label: "Waived" },
  { value: "unpaid", label: "Unpaid" },
];

const HOUSEHOLD_OPTIONS = [
  { value: "", label: "All Household Types" },
  { value: "family", label: "Family" },
  { value: "single", label: "Single" },
  { value: "couple", label: "Couple" },
  { value: "organization", label: "Organization" },
];

const GENDER_OPTIONS = [
  { value: "", label: "All Genders" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const BOOLEAN_OPTIONS = [
  { value: "", label: "Any" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const COVERAGE_STATUS_OPTIONS = [
  { value: "", label: "All Coverage" },
  { value: "covered", label: "Covered" },
  { value: "open", label: "Open" },
  { value: "partial", label: "Partial" },
  { value: "expired", label: "Expired" },
  { value: "overdue", label: "Overdue" },
];

const MONTH_OPTIONS = [
  { value: "", label: "All Months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function normalizeFilters(filters = {}) {
  return {
    ...FINANCE_MEMBER_FILTER_DEFAULTS,
    ...filters,
    household_type: filters.household_type || filters.householdType || "",
    start_date_from: filters.start_date_from || filters.startDateFrom || "",
    start_date_to: filters.start_date_to || filters.startDateTo || "",
  };
}

function cleanObject(value = {}) {
  return Object.entries(value).reduce((acc, [key, item]) => {
    if (item === undefined || item === null) return acc;
    if (typeof item === "string" && item.trim() === "") return acc;
    if (typeof item === "boolean" && item === false) return acc;

    acc[key] = item;
    return acc;
  }, {});
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function currentYear() {
  return String(new Date().getFullYear());
}

function activeFilterCount(filters = {}) {
  const normalized = normalizeFilters(filters);

  return Object.entries(normalized).filter(([key, value]) => {
    if (["q"].includes(key)) return false;
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    if (typeof value === "boolean" && value === false) return false;
    return true;
  }).length;
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function MoneyField({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0.00"
      />
    </label>
  );
}

export default function FinanceMemberFilters({
  open = true,
  embedded = false,
  filters = {},
  membershipPlans = [],
  campaigns = [],
  onChange,
  onApply,
  onReset,
  onClose,
}) {
  const [draft, setDraft] = useState(normalizeFilters(filters));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeCount = useMemo(() => activeFilterCount(draft), [draft]);

  const planOptions = useMemo(
    () => [
      { value: "", label: "All Plans" },
      ...membershipPlans.map((plan) => ({
        value: String(plan.id || plan.dues_plan_id || plan.plan_id),
        label: plan.plan_name || plan.name || plan.title || `Plan ${plan.id}`,
      })),
    ],
    [membershipPlans]
  );

  const campaignOptions = useMemo(
    () => [
      { value: "", label: "All Campaigns" },
      ...campaigns.map((campaign) => ({
        value: String(campaign.id || campaign.campaign_id),
        label:
          campaign.title ||
          campaign.campaign_name ||
          campaign.name ||
          `Campaign ${campaign.id}`,
      })),
    ],
    [campaigns]
  );

  const validationError = useMemo(() => {
    const datePairs = [
      ["start_date_from", "start_date_to", "Membership start date"],
      ["registered_from", "registered_to", "Registered date"],
      ["last_payment_from", "last_payment_to", "Last payment date"],
      ["next_due_from", "next_due_to", "Next due date"],
    ];

    for (const [fromKey, toKey, label] of datePairs) {
      if (draft[fromKey] && draft[toKey] && draft[fromKey] > draft[toKey]) {
        return `${label}: From date cannot be after To date.`;
      }
    }

    const moneyPairs = [
      ["balance_min", "balance_max", "Balance"],
      ["total_paid_min", "total_paid_max", "Total paid"],
    ];

    for (const [minKey, maxKey, label] of moneyPairs) {
      const min = numberValue(draft[minKey]);
      const max = numberValue(draft[maxKey]);

      if (draft[minKey] && min < 0) {
        return `${label}: minimum cannot be negative.`;
      }

      if (draft[maxKey] && max < 0) {
        return `${label}: maximum cannot be negative.`;
      }

      if (draft[minKey] && draft[maxKey] && min > max) {
        return `${label}: minimum cannot be greater than maximum.`;
      }
    }

    return "";
  }, [draft]);

  useEffect(() => {
    if (!open) return;

    setDraft(normalizeFilters(filters));
    setError("");
    setSuccess("");
  }, [open, filters]);

  if (!open) {
    return null;
  }

  function updateField(key, value) {
    setDraft((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      if (key === "search") {
        next.q = value;
      }

      return next;
    });
  }

  function handleApply() {
    setError("");
    setSuccess("");

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = cleanObject({
      ...draft,

      q: draft.search || draft.q,
      search: draft.search || draft.q,

      householdType: draft.household_type,

      startDateFrom: draft.start_date_from,
      startDateTo: draft.start_date_to,

      date_from: draft.registered_from,
      date_to: draft.registered_to,

      includeInactive: draft.include_inactive,
      onlyOverdue: draft.only_overdue,
      onlyUnpaid: draft.only_unpaid,
    });

    onChange?.(payload);
    onApply?.(payload);

    setSuccess("Member filters applied.");

    if (!embedded) {
      window.setTimeout(() => onClose?.(), 250);
    }
  }

  function handleReset() {
    const reset = {
      ...FINANCE_MEMBER_FILTER_DEFAULTS,
      coverage_year: currentYear(),
    };

    setDraft(reset);
    setError("");
    setSuccess("");

    onChange?.(reset);
    onReset?.(reset);
  }

  const content = (
    <section className="finance-panel">
      <div className="finance-page-head">
        <div>
          <span className="finance-kicker">Member Filters</span>
          <h1>Advanced Member Search</h1>
          <p>
            Filter finance members by membership status, payment balance, coverage,
            registration dates, account access, dependents, and contact quality.
          </p>
        </div>

        <div className="finance-page-actions">
          <button type="button" className="finance-btn" onClick={handleReset}>
            <RotateCcw size={16} />
            Reset
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={handleApply}
            disabled={Boolean(validationError)}
            title={validationError || "Apply member filters"}
          >
            <Filter size={16} />
            Apply Filters
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
        <div className="finance-summary-card">
          <span>Active Filters</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="finance-summary-card">
          <span>Membership</span>
          <strong>
            {draft.membership_status
              ? draft.membership_status.replaceAll("_", " ")
              : "All"}
          </strong>
        </div>

        <div className="finance-summary-card">
          <span>Payment</span>
          <strong>
            {draft.payment_status ? draft.payment_status.replaceAll("_", " ") : "All"}
          </strong>
        </div>

        <div className="finance-summary-card">
          <span>Coverage Year</span>
          <strong>{draft.coverage_year || "All"}</strong>
        </div>
      </div>

      <div className="finance-section">
        <div className="finance-section-title">
          <Search size={18} />
          <h3>Search</h3>
        </div>

        <div className="finance-form-grid three">
          <label className="finance-field-full">
            Keyword Search
            <input
              value={draft.search}
              onChange={(event) => updateField("search", event.target.value)}
              placeholder="Search by member ID, name, email, phone, address, city..."
            />
          </label>

          <label>
            Member ID
            <input
              value={draft.member_no}
              onChange={(event) => updateField("member_no", event.target.value)}
              placeholder="M-00081"
            />
          </label>

          <label>
            Email
            <input
              value={draft.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="member@example.com"
            />
          </label>

          <label>
            Phone
            <input
              value={draft.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              placeholder="Phone"
            />
          </label>
        </div>
      </div>

      <div className="finance-section">
        <div className="finance-section-title">
          <ShieldCheck size={18} />
          <h3>Status</h3>
        </div>

        <div className="finance-form-grid three">
          <SelectField
            label="Membership Status"
            value={draft.membership_status}
            onChange={(value) => updateField("membership_status", value)}
            options={MEMBERSHIP_STATUS_OPTIONS}
          />

          <SelectField
            label="Account Status"
            value={draft.account_status}
            onChange={(value) => updateField("account_status", value)}
            options={ACCOUNT_STATUS_OPTIONS}
          />

          <SelectField
            label="Payment Status"
            value={draft.payment_status}
            onChange={(value) => updateField("payment_status", value)}
            options={PAYMENT_STATUS_OPTIONS}
          />

          <SelectField
            label="Registration Fee"
            value={draft.registration_fee_status}
            onChange={(value) => updateField("registration_fee_status", value)}
            options={REGISTRATION_FEE_OPTIONS}
          />

          <SelectField
            label="Welcome Email"
            value={draft.welcome_email_status}
            onChange={(value) => updateField("welcome_email_status", value)}
            options={[
              { value: "", label: "Any" },
              { value: "sent", label: "Sent" },
              { value: "pending", label: "Pending" },
              { value: "failed", label: "Failed" },
            ]}
          />

          <SelectField
            label="Must Change Password"
            value={draft.must_change_password}
            onChange={(value) => updateField("must_change_password", value)}
            options={BOOLEAN_OPTIONS}
          />
        </div>
      </div>

      <div className="finance-section">
        <div className="finance-section-title">
          <User size={18} />
          <h3>Member Profile</h3>
        </div>

        <div className="finance-form-grid three">
          <SelectField
            label="Household Type"
            value={draft.household_type}
            onChange={(value) => updateField("household_type", value)}
            options={HOUSEHOLD_OPTIONS}
          />

          <SelectField
            label="Gender"
            value={draft.gender}
            onChange={(value) => updateField("gender", value)}
            options={GENDER_OPTIONS}
          />

          <SelectField
            label="Has Dependents"
            value={draft.has_dependents}
            onChange={(value) => updateField("has_dependents", value)}
            options={BOOLEAN_OPTIONS}
          />

          <SelectField
            label="Has Login Account"
            value={draft.has_login}
            onChange={(value) => updateField("has_login", value)}
            options={BOOLEAN_OPTIONS}
          />

          <label>
            City
            <input
              value={draft.city}
              onChange={(event) => updateField("city", event.target.value)}
              placeholder="City"
            />
          </label>

          <label>
            State
            <input
              value={draft.state}
              onChange={(event) => updateField("state", event.target.value)}
              placeholder="State"
            />
          </label>

          <label>
            ZIP
            <input
              value={draft.zip}
              onChange={(event) => updateField("zip", event.target.value)}
              placeholder="ZIP"
            />
          </label>
        </div>
      </div>

      <div className="finance-section">
        <div className="finance-section-title">
          <Wallet size={18} />
          <h3>Finance & Coverage</h3>
        </div>

        <div className="finance-form-grid three">
          <SelectField
            label="Membership Plan"
            value={draft.dues_plan_id}
            onChange={(value) => updateField("dues_plan_id", value)}
            options={planOptions}
          />

          <SelectField
            label="Campaign"
            value={draft.campaign_id}
            onChange={(value) => updateField("campaign_id", value)}
            options={campaignOptions}
          />

          <SelectField
            label="Coverage Status"
            value={draft.coverage_status}
            onChange={(value) => updateField("coverage_status", value)}
            options={COVERAGE_STATUS_OPTIONS}
          />

          <label>
            Coverage Year
            <input
              type="number"
              min="2000"
              max="2100"
              value={draft.coverage_year}
              onChange={(event) => updateField("coverage_year", event.target.value)}
              placeholder={currentYear()}
            />
          </label>

          <SelectField
            label="Coverage Month"
            value={draft.coverage_month}
            onChange={(value) => updateField("coverage_month", value)}
            options={MONTH_OPTIONS}
          />

          <MoneyField
            label="Min Balance"
            value={draft.balance_min}
            onChange={(value) => updateField("balance_min", value)}
          />

          <MoneyField
            label="Max Balance"
            value={draft.balance_max}
            onChange={(value) => updateField("balance_max", value)}
          />

          <MoneyField
            label="Min Total Paid"
            value={draft.total_paid_min}
            onChange={(value) => updateField("total_paid_min", value)}
          />

          <MoneyField
            label="Max Total Paid"
            value={draft.total_paid_max}
            onChange={(value) => updateField("total_paid_max", value)}
          />
        </div>
      </div>

      <div className="finance-section">
        <div className="finance-section-title">
          <CalendarDays size={18} />
          <h3>Date Ranges</h3>
        </div>

        <div className="finance-form-grid three">
          <DateField
            label="Start Date From"
            value={draft.start_date_from}
            onChange={(value) => updateField("start_date_from", value)}
          />

          <DateField
            label="Start Date To"
            value={draft.start_date_to}
            onChange={(value) => updateField("start_date_to", value)}
          />

          <DateField
            label="Registered From"
            value={draft.registered_from}
            onChange={(value) => updateField("registered_from", value)}
          />

          <DateField
            label="Registered To"
            value={draft.registered_to}
            onChange={(value) => updateField("registered_to", value)}
          />

          <DateField
            label="Last Payment From"
            value={draft.last_payment_from}
            onChange={(value) => updateField("last_payment_from", value)}
          />

          <DateField
            label="Last Payment To"
            value={draft.last_payment_to}
            onChange={(value) => updateField("last_payment_to", value)}
          />

          <DateField
            label="Next Due From"
            value={draft.next_due_from}
            onChange={(value) => updateField("next_due_from", value)}
          />

          <DateField
            label="Next Due To"
            value={draft.next_due_to}
            onChange={(value) => updateField("next_due_to", value)}
          />
        </div>
      </div>

      <div className="finance-section">
        <div className="finance-section-title">
          <SlidersHorizontal size={18} />
          <h3>Advanced Flags</h3>
        </div>

        <div className="finance-check-grid">
          <label>
            <input
              type="checkbox"
              checked={draft.include_inactive}
              onChange={(event) =>
                updateField("include_inactive", event.target.checked)
              }
            />
            <span>Include inactive members</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={draft.only_overdue}
              onChange={(event) => updateField("only_overdue", event.target.checked)}
            />
            <span>Only overdue members</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={draft.only_unpaid}
              onChange={(event) => updateField("only_unpaid", event.target.checked)}
            />
            <span>Only unpaid members</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={draft.only_missing_email}
              onChange={(event) =>
                updateField("only_missing_email", event.target.checked)
              }
            />
            <span>Only missing email</span>
          </label>
        </div>
      </div>

      <div className="finance-audit-empty">
        Member filters support finance workflows for registration, overdue dues,
        membership coverage, login setup, payment follow-up, dependents, and
        statement generation.
      </div>
    </section>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="finance-drawer-backdrop" role="presentation">
      <aside
        className="finance-drawer finance-drawer-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Finance member filters"
      >
        <div className="finance-drawer-head">
          <div>
            <span className="finance-kicker">Advanced Filters</span>
            <h2>Member Search</h2>
            <p>Filter members for finance operations and follow-up work.</p>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={onClose}
            aria-label="Close member filters"
          >
            <X size={18} />
          </button>
        </div>

        {content}
      </aside>
    </div>
  );
}