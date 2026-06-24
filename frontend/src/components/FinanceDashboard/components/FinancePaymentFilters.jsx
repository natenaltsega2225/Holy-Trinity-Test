// frontend/src/components/FinanceDashboard/components/FinancePaymentFilters.jsx
import React from "react";
import {
  CalendarDays,
  Filter,
  RefreshCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

// import "../../../styles/finance-dashboard.css";
import "../../../styles/finance-enterprise.css";
const PAYMENT_TYPES = [
  { value: "", label: "All Types" },
  { value: "membership", label: "Membership" },
  { value: "donation", label: "Donation" },
  { value: "school", label: "School" },
  { value: "trip", label: "Trip" },
  { value: "pledge", label: "Pledge" },
  { value: "sunday_collection", label: "Sunday Collection" },
];

const METHODS = [
  { value: "", label: "All Methods" },
  { value: "card", label: "Card" },
  { value: "ach", label: "ACH" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
  { value: "bank_deposit", label: "Bank Deposit" },
  { value: "manual", label: "Manual" },
];

const STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "void", label: "Void" },
];

const SOURCES = [
  { value: "", label: "All Sources" },
  { value: "finance", label: "Finance" },
  { value: "online", label: "Online" },
  { value: "member_portal", label: "Member Portal" },
  { value: "public_invoice", label: "Public Invoice" },
  { value: "manual", label: "Manual" },
];

const DONATION_TYPES = [
  { value: "", label: "All Donations" },
  { value: "plate_collection", label: "Plate Collection" },
  { value: "candle_sale", label: "Candle Sale" },
  { value: "general_donation", label: "General Donation" },
  { value: "tithe", label: "Tithe" },
  { value: "vows", label: "Vows" },
  { value: "baptism", label: "Baptism" },
  { value: "wedding_engagement", label: "Wedding / Engagement" },
  { value: "memorial_service", label: "Memorial Service" },
  { value: "building_fund", label: "Building Fund" },
  { value: "charity_fund", label: "Charity Fund" },
  { value: "auction", label: "Auction" },
  { value: "other_fund", label: "Other Fund" },
  { value: "sunday_cash_collection", label: "Sunday Collection" },
];

function SelectFilter({ label, value, onChange, options }) {
  return (
    <label className="finance-filter-control">
      <span>{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextFilter({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="finance-filter-control">
      <span>{label}</span>
      <input
        type={type}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export default function FinancePaymentFilters({
  filters = {},
  onChange,
  onReset,
}) {
  function update(key, value) {
    onChange?.({
      ...filters,
      [key]: value,
    });
  }

  return (
    <section className="finance-payment-filters" aria-label="Payment filters">
      <div className="finance-filter-header">
        <div>
          <Filter size={16} strokeWidth={2.1} />
          <strong>Payment Filters</strong>
        </div>

        <button
          type="button"
          className="finance-filter-reset"
          onClick={onReset}
        >
          <RefreshCcw size={14} strokeWidth={2.1} />
          Reset
        </button>
      </div>

      <div className="finance-filter-grid">
        <label className="finance-filter-control finance-filter-search">
          <span>Search</span>
          <div className="finance-filter-input-icon">
            <Search size={15} strokeWidth={2.1} />
            <input
              value={filters.search || ""}
              onChange={(event) => update("search", event.target.value)}
              placeholder="Member, payment #, receipt #, invoice #, email, reference..."
            />
          </div>
        </label>

        <SelectFilter
          label="Type"
          value={filters.payment_type}
          onChange={(value) => update("payment_type", value)}
          options={PAYMENT_TYPES}
        />

        <SelectFilter
          label="Method"
          value={filters.method}
          onChange={(value) => update("method", value)}
          options={METHODS}
        />

        <SelectFilter
          label="Status"
          value={filters.status}
          onChange={(value) => update("status", value)}
          options={STATUSES}
        />

        <SelectFilter
          label="Source"
          value={filters.source}
          onChange={(value) => update("source", value)}
          options={SOURCES}
        />

        <SelectFilter
          label="Donation"
          value={filters.donation_category}
          onChange={(value) => update("donation_category", value)}
          options={DONATION_TYPES}
        />

        <TextFilter
          label="Coverage Year"
          type="number"
          value={filters.coverage_year}
          onChange={(value) => update("coverage_year", value)}
          placeholder="2026"
        />

        <label className="finance-filter-control">
          <span>
            <CalendarDays size={13} strokeWidth={2.1} />
            From
          </span>
          <input
            type="date"
            value={filters.date_from || ""}
            onChange={(event) => update("date_from", event.target.value)}
          />
        </label>

        <label className="finance-filter-control">
          <span>
            <CalendarDays size={13} strokeWidth={2.1} />
            To
          </span>
          <input
            type="date"
            value={filters.date_to || ""}
            onChange={(event) => update("date_to", event.target.value)}
          />
        </label>

        <div className="finance-filter-chip">
          <SlidersHorizontal size={14} strokeWidth={2.1} />
          Advanced
        </div>
      </div>
    </section>
  );
}