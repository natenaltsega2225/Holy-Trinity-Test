// src/components/FinanceDashboard/components/FinanceMemberFilters.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Search,
  RotateCcw,
  Users,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All Membership Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" },
  { value: "delinquent", label: "Delinquent" },
  { value: "suspended", label: "Suspended" },
];

const ACCOUNT_OPTIONS = [
  { value: "", label: "All Accounts" },
  { value: "1", label: "Active Accounts" },
  { value: "0", label: "Inactive Accounts" },
];

const HOUSEHOLD_OPTIONS = [
  { value: "", label: "All Households" },
  { value: "single", label: "Single" },
  { value: "family", label: "Family" },
  { value: "dependent", label: "Dependents" },
];

export default function FinanceMemberFilters({
  value = {},
  onChange,
  pageSize = 10,
  onPageSize,
  loading = false,
}) {
  const [searchInput, setSearchInput] =
    useState(value.search || "");

  /* =====================================================
     DEBOUNCED SEARCH
  ===================================================== */

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange?.({
        ...value,
        search: searchInput,
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput(value.search || "");
  }, [value.search]);

  /* =====================================================
     HELPERS
  ===================================================== */

  function upd(key, next) {
    onChange?.({
      ...value,
      [key]: next,
    });
  }

  function resetFilters() {
    setSearchInput("");

    onChange?.({
      search: "",
      status: "",
      active: "",
      householdType: "",
    });
  }

  const activeFilterCount =
    useMemo(() => {
      let total = 0;

      if (value.search) total += 1;
      if (value.status) total += 1;
      if (value.active !== "") total += 1;
      if (value.householdType) total += 1;

      return total;
    }, [value]);

  /* =====================================================
     UI
  ===================================================== */

  return (
    <section className="finance-filter-card">
      <div className="finance-filter-toolbar">
        <div className="finance-filter-title-wrap">
          <div className="finance-filter-icon">
            <Users size={18} />
          </div>

          <div>
            <h3 className="finance-filter-title">
              Member Filters
            </h3>

            <p className="finance-filter-subtitle">
              Search and filter finance members,
              households, account status, and membership records.
            </p>
          </div>
        </div>

        <div className="finance-filter-actions">
          <button
            type="button"
            className="finance-filter-reset-btn"
            onClick={resetFilters}
          >
            <RotateCcw size={15} />
            Reset
          </button>

          <div className="finance-filter-count">
            {activeFilterCount} Active
          </div>
        </div>
      </div>

      <div className="finance-filter-grid">
        {/* ========================================
            SEARCH
        ======================================== */}

        <div className="finance-filter-search-wrap">
          <Search
            size={18}
            className="finance-filter-search-icon"
          />

          <input
            type="text"
            className="finance-filter-search-input"
            placeholder="Search member name, member #, email, phone..."
            value={searchInput}
            onChange={(e) =>
              setSearchInput(e.target.value)
            }
          />
        </div>

        {/* ========================================
            MEMBERSHIP STATUS
        ======================================== */}

        <div className="finance-filter-select-wrap">
          <ShieldCheck
            size={16}
            className="finance-filter-select-icon"
          />

          <select
            className="finance-filter-select"
            value={value.status || ""}
            onChange={(e) =>
              upd("status", e.target.value)
            }
          >
            {STATUS_OPTIONS.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* ========================================
            ACCOUNT ACTIVE
        ======================================== */}

        <div className="finance-filter-select-wrap">
          <UserCheck
            size={16}
            className="finance-filter-select-icon"
          />

          <select
            className="finance-filter-select"
            value={value.active || ""}
            onChange={(e) =>
              upd("active", e.target.value)
            }
          >
            {ACCOUNT_OPTIONS.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* ========================================
            HOUSEHOLD TYPE
        ======================================== */}

        <div className="finance-filter-select-wrap">
          <select
            className="finance-filter-select"
            value={value.householdType || ""}
            onChange={(e) =>
              upd(
                "householdType",
                e.target.value
              )
            }
          >
            {HOUSEHOLD_OPTIONS.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* ========================================
            PAGE SIZE
        ======================================== */}

        <div className="finance-filter-select-wrap">
          <select
            className="finance-filter-select"
            value={pageSize}
            onChange={(e) =>
              onPageSize?.(
                Number(e.target.value)
              )
            }
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================================
          ACTIVE FILTER PILLS
      ======================================== */}

      {activeFilterCount > 0 ? (
        <div className="finance-filter-pills">
          {value.search ? (
            <span className="finance-filter-pill">
              Search: {value.search}
            </span>
          ) : null}

          {value.status ? (
            <span className="finance-filter-pill">
              Status: {value.status}
            </span>
          ) : null}

          {value.active !== "" ? (
            <span className="finance-filter-pill">
              Account:{" "}
              {value.active === "1"
                ? "Active"
                : "Inactive"}
            </span>
          ) : null}

          {value.householdType ? (
            <span className="finance-filter-pill">
              Household: {value.householdType}
            </span>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="finance-filter-loading">
          Loading finance members...
        </div>
      ) : null}
    </section>
  );
}