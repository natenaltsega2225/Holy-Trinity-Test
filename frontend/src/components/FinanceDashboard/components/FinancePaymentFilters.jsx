// frontend/src/components/FinanceDashboard/components/FinancePaymentFilters.jsx

import React from "react";

import "../../../styles/finance-dashboard.css";

/* =========================================================
   CONSTANTS
========================================================= */

const PAYMENT_TYPES = [
  "",
  "membership",
  "donation",
  "school",
  "trip",
  "pledge",
  "sunday_collection",
];

const METHODS = [
  "",
  "card",
  "cash",
  "check",
  "zelle",
  "bank",
  "manual",
];

const STATUSES = [
  "",
  "paid",
  "pending",
  "failed",
  "refunded",
];

const SOURCES = [
  "",
  "online",
  "in_person",
];

const DONATION_TYPES = [
  "",
  "plate_collection",
  "candle_sale",
  "general_donation",
  "tithe",
  "vows",
  "baptism",
  "wedding_engagement",
  "memorial_service",
  "pledge",
  "building_fund",
  "charity_fund",
  "auction",
  "other_fund",
  "sunday_cash_collection",
];

/* =========================================================
   COMPONENT
========================================================= */

export default function FinancePaymentFilters({

  filters,

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

    <div className="finance-payment-filters">

      {/* SEARCH */}

      <div className="finance-filter-item finance-filter-search">

        <input
          value={filters.search || ""}
          onChange={(e) =>
            update(
              "search",
              e.target.value
            )
          }
          placeholder="
Search member, payment #, receipt #
          "
        />

      </div>

      {/* TYPE */}

      <div className="finance-filter-item">

        <select
          value={
            filters.payment_type || ""
          }
          onChange={(e) =>
            update(
              "payment_type",
              e.target.value
            )
          }
        >

          {PAYMENT_TYPES.map(
            (v) => (

              <option
                key={v}
                value={v}
              >

                {v || "All Types"}

              </option>
            )
          )}

        </select>

      </div>

      {/* METHOD */}

      <div className="finance-filter-item">

        <select
          value={
            filters.method || ""
          }
          onChange={(e) =>
            update(
              "method",
              e.target.value
            )
          }
        >

          {METHODS.map(
            (v) => (

              <option
                key={v}
                value={v}
              >

                {v || "All Methods"}

              </option>
            )
          )}

        </select>

      </div>

      {/* STATUS */}

      <div className="finance-filter-item">

        <select
          value={
            filters.status || ""
          }
          onChange={(e) =>
            update(
              "status",
              e.target.value
            )
          }
        >

          {STATUSES.map(
            (v) => (

              <option
                key={v}
                value={v}
              >

                {v || "All Statuses"}

              </option>
            )
          )}

        </select>

      </div>

      {/* SOURCE */}

      <div className="finance-filter-item">

        <select
          value={
            filters.source || ""
          }
          onChange={(e) =>
            update(
              "source",
              e.target.value
            )
          }
        >

          {SOURCES.map(
            (v) => (

              <option
                key={v}
                value={v}
              >

                {v || "All Sources"}

              </option>
            )
          )}

        </select>

      </div>

      {/* DONATION CATEGORY */}

      <div className="finance-filter-item">

        <select
          value={
            filters.donation_category || ""
          }
          onChange={(e) =>
            update(
              "donation_category",
              e.target.value
            )
          }
        >

          {DONATION_TYPES.map(
            (v) => (

              <option
                key={v}
                value={v}
              >

                {v || "All Donations"}

              </option>
            )
          )}

        </select>

      </div>

      {/* YEAR */}

      <div className="finance-filter-item">

        <input
          type="number"
          value={
            filters.coverage_year || ""
          }
          onChange={(e) =>
            update(
              "coverage_year",
              e.target.value
            )
          }
          placeholder="Coverage Year"
        />

      </div>

      {/* DATE FROM */}

      <div className="finance-filter-item">

        <input
          type="date"
          value={
            filters.date_from || ""
          }
          onChange={(e) =>
            update(
              "date_from",
              e.target.value
            )
          }
        />

      </div>

      {/* DATE TO */}

      <div className="finance-filter-item">

        <input
          type="date"
          value={
            filters.date_to || ""
          }
          onChange={(e) =>
            update(
              "date_to",
              e.target.value
            )
          }
        />

      </div>

      {/* RESET */}

      <div className="finance-filter-item">

        <button
          type="button"
          className="finance-filter-reset"
          onClick={onReset}
        >

          Reset

        </button>

      </div>

    </div>
  );
}