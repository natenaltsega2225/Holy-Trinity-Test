// frontend/src/components/FinanceDashboard/components/FinanceCoverageManager.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api";

import {
  CheckCircle2,
  AlertTriangle,
  Save,
  RotateCcw,
} from "lucide-react";

// import "../finance-dashboard.css";

/* =========================================================
   CONSTANTS
========================================================= */

const MONTHS = [
  {
    value: 1,
    key: "jan",
    label: "Jan",
    full: "January",
  },

  {
    value: 2,
    key: "feb",
    label: "Feb",
    full: "February",
  },

  {
    value: 3,
    key: "mar",
    label: "Mar",
    full: "March",
  },

  {
    value: 4,
    key: "apr",
    label: "Apr",
    full: "April",
  },

  {
    value: 5,
    key: "may",
    label: "May",
    full: "May",
  },

  {
    value: 6,
    key: "jun",
    label: "Jun",
    full: "June",
  },

  {
    value: 7,
    key: "jul",
    label: "Jul",
    full: "July",
  },

  {
    value: 8,
    key: "aug",
    label: "Aug",
    full: "August",
  },

  {
    value: 9,
    key: "sep",
    label: "Sep",
    full: "September",
  },

  {
    value: 10,
    key: "oct",
    label: "Oct",
    full: "October",
  },

  {
    value: 11,
    key: "nov",
    label: "Nov",
    full: "November",
  },

  {
    value: 12,
    key: "dec",
    label: "Dec",
    full: "December",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) =>
      c.toUpperCase()
    );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceCoverageManager({
  memberId,

  memberName,

  initialYear =
    new Date().getFullYear(),

  onUpdated,
}) {
  /* =====================================================
     STATE
  ===================================================== */

  const [year,
    setYear] =
      useState(initialYear);

  const [loading,
    setLoading] =
      useState(false);

  const [saving,
    setSaving] =
      useState(false);

  const [error,
    setError] =
      useState("");

  const [success,
    setSuccess] =
      useState("");

  const [rows,
    setRows] =
      useState([]);

  const [selectedMonths,
    setSelectedMonths] =
      useState([]);

  /* =====================================================
     LOAD
  ===================================================== */

  useEffect(() => {

    if (!memberId) {

      return;
    }

    loadCoverage();

  }, [
    memberId,
    year,
  ]);

  async function loadCoverage() {

    try {

      setLoading(true);

      setError("");

      const { data } =
        await api.get(

          `/finance/members/${memberId}/coverage`,

          {
            params: {
              year,
            },
          }
        );

      const coverageRows =
        data?.rows || [];

      setRows(
        coverageRows
      );

      const paidMonths =
        coverageRows.map(
          (r) =>
            Number(
              r.coverage_month
            )
        );

      setSelectedMonths(
        paidMonths
      );

    } catch (err) {

      console.error(err);

      setError(
        "Unable to load coverage."
      );

    } finally {

      setLoading(false);
    }
  }

  /* =====================================================
     TOGGLE MONTH
  ===================================================== */

  function toggleMonth(
    monthValue
  ) {

    setSelectedMonths(
      (prev) => {

        if (
          prev.includes(
            monthValue
          )
        ) {

          return prev.filter(
            (m) =>
              m !== monthValue
          );
        }

        return [
          ...prev,
          monthValue,
        ];
      }
    );
  }

  /* =====================================================
     SAVE
  ===================================================== */

  async function handleSave() {

    try {

      setSaving(true);

      setError("");

      setSuccess("");

      await api.put(

        `/finance/members/${memberId}/coverage`,

        {
          year,

          months:
            selectedMonths,
        }
      );

      setSuccess(
        "Coverage successfully updated."
      );

      loadCoverage();

      onUpdated?.();

    } catch (err) {

      console.error(err);

      setError(

        err?.response?.data
          ?.error ||

        "Unable to save coverage."
      );

    } finally {

      setSaving(false);
    }
  }

  /* =====================================================
     RESET
  ===================================================== */

  function handleReset() {

    loadCoverage();
  }

  /* =====================================================
     COVERAGE DETAILS
  ===================================================== */

  const coverageLookup =
    useMemo(() => {

      const map = {};

      rows.forEach((r) => {

        map[
          Number(
            r.coverage_month
          )
        ] = r;
      });

      return map;

    }, [rows]);

  /* =====================================================
     SUMMARY
  ===================================================== */

  const paidCount =
    selectedMonths.length;

  const unpaidCount =
    12 - paidCount;

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="finance-coverage-manager">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="finance-coverage-head">

        <div>

          <h3>
            Membership Coverage
          </h3>

          <p>

            Enterprise Jan–Dec
            membership coverage
            management.

          </p>

        </div>

        <div className="finance-coverage-year">

          <label>
            Coverage Year
          </label>

          <input
            type="number"
            value={year}
            onChange={(e) =>
              setYear(
                e.target.value
              )
            }
          />

        </div>

      </div>

      {/* =====================================
          MEMBER
      ===================================== */}

      <div className="finance-coverage-member">

        <strong>

          {memberName ||
            "Member"}

        </strong>

        <span>

          Coverage tracking
          and manual finance
          adjustments.

        </span>

      </div>

      {/* =====================================
          ALERTS
      ===================================== */}

      {error ? (

        <div className="finance-alert error">

          {error}

        </div>

      ) : null}

      {success ? (

        <div className="finance-alert success">

          {success}

        </div>

      ) : null}

      {/* =====================================
          SUMMARY
      ===================================== */}

      <div className="finance-coverage-summary">

        <div className="finance-summary-box">

          <span>
            Paid Months
          </span>

          <strong>

            {paidCount}

          </strong>

        </div>

        <div className="finance-summary-box">

          <span>
            Unpaid Months
          </span>

          <strong>

            {unpaidCount}

          </strong>

        </div>

      </div>

      {/* =====================================
          GRID
      ===================================== */}

      <div className="finance-coverage-grid">

        {MONTHS.map(
          (month) => {

            const selected =
              selectedMonths.includes(
                month.value
              );

            const detail =
              coverageLookup[
                month.value
              ];

            return (

              <button
                key={
                  month.value
                }
                type="button"
                className={`
                  finance-coverage-month
                  ${
                    selected
                      ? "paid"
                      : "unpaid"
                  }
                `}
                onClick={() =>
                  toggleMonth(
                    month.value
                  )
                }
              >

                {/* STATUS */}

                <div className="finance-coverage-status">

                  {selected ? (

                    <CheckCircle2
                      size={18}
                    />

                  ) : (

                    <AlertTriangle
                      size={18}
                    />

                  )}

                </div>

                {/* MONTH */}

                <strong>

                  {month.label}

                </strong>

                <span>

                  {month.full}

                </span>

                {/* DETAILS */}

                {detail ? (

                  <div className="finance-coverage-meta">

                    <small>

                      {
                        detail.payment_number
                      }

                    </small>

                    <small>

                      {
                        detail.receipt_number
                      }

                    </small>

                    <small>

                      {pretty(
                        detail.method
                      )}

                    </small>

                  </div>

                ) : (

                  <div className="finance-coverage-meta empty">

                    <small>
                      Unpaid
                    </small>

                  </div>

                )}

              </button>
            );
          }
        )}

      </div>

      {/* =====================================
          FOOTER
      ===================================== */}

      <div className="finance-coverage-actions">

        <button
          type="button"
          className="finance-btn secondary"
          onClick={
            handleReset
          }
        >

          <RotateCcw
            size={16}
          />

          Reset

        </button>

        <button
          type="button"
          className="finance-btn primary"
          onClick={
            handleSave
          }
          disabled={saving}
        >

          <Save size={16} />

          {saving
            ? "Saving..."
            : "Save Coverage"}

        </button>

      </div>

      {/* =====================================
          LOADING
      ===================================== */}

      {loading ? (

        <div className="finance-loading-overlay">

          Loading coverage...

        </div>

      ) : null}

    </div>
  );
}