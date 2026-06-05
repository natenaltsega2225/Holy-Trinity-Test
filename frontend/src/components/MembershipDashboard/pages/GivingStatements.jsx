
// frontend/src/components/MembershipDashoard/pages/GivingStatements.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api";

import FinanceBadge from "../../Shared/FinanceBadge";

import "../../../styles/member-dashboard.css";

function money(value) {
  return `$${Number(value || 0).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function fmtDate(value) {
  if (!value) return "--";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return value;
  }

  return d.toLocaleDateString("en-US");
}

const CATEGORY_LABELS = {
  plate_collection:
    "መባ — Plate Collection",

  candle_sale:
    "ሻማ — Candle Sale",

  general_donation:
    "ስጦታ — General Donation",

  tithe:
    "አስራት — Tithe",

  vows:
    "ስዕለት — Vows",

  baptism:
    "ክርስትና — Baptism",

  wedding_engagement:
    "ጋብቻ / ቀለበት — Wedding / Engagement",

  memorial_service:
    "ፍታት — Memorial Service",

  pledge:
    "ቃል የተገባ — Pledge",

  building_fund:
    "የቤተክርስቲያን ማሰሪያ — Building Fund",

  charity_fund:
    "በጎ አድራጎት — Charity Fund",

  auction:
    "ጨረታ — Auction",

  other_fund:
    "ሌላ — Other Fund",

  sunday_cash_collection:
    "የእሁድ ስብስብ — Sunday Collection",
};

export default function GivingStatements() {
  const [rows, setRows] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [year, setYear] =
    useState(
      String(
        new Date().getFullYear()
      )
    );

  const [search, setSearch] =
    useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const res =
        await api.get(
          "/member/payments"
        );

      const payments =
        Array.isArray(
          res.data?.rows
        )
          ? res.data.rows
          : [];

      const donations =
        payments.filter(
          (row) =>
            String(
              row.category ||
                row.payment_type
            ).toLowerCase() ===
            "donation"
        );

      setRows(donations);
    } catch (err) {
      console.error(
        "Failed to load giving statements:",
        err
      );

      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered =
    useMemo(() => {
      return rows.filter(
        (row) => {
          const q =
            search
              .trim()
              .toLowerCase();

          const paymentDate =
            row.payment_date ||
            row.paid_at ||
            row.created_at;

          const rowYear =
            paymentDate
              ? String(
                  new Date(
                    paymentDate
                  ).getFullYear()
                )
              : "";

          const matchesYear =
            !year ||
            rowYear === year;

          const matchesSearch =
            !q ||
            [
              row.payment_number,
              row.receipt_number,
              row.sub_category,
              row.category,
            ]
              .join(" ")
              .toLowerCase()
              .includes(q);

          return (
            matchesYear &&
            matchesSearch
          );
        }
      );
    }, [
      rows,
      search,
      year,
    ]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.total += Number(
          row.amount || 0
        );

        return acc;
      },
      {
        total: 0,
      }
    );
  }, [filtered]);

  const yearlyBreakdown =
    useMemo(() => {
      const map = {};

      filtered.forEach(
        (row) => {
          const key =
            row.sub_category ||
            "general_donation";

          if (!map[key]) {
            map[key] = 0;
          }

          map[key] += Number(
            row.amount || 0
          );
        }
      );

      return Object.entries(map)
        .map(
          ([key, value]) => ({
            key,
            label:
              CATEGORY_LABELS[
                key
              ] || key,
            amount: value,
          })
        )
        .sort(
          (a, b) =>
            b.amount - a.amount
        );
    }, [filtered]);

  return (
    <div className="member-enterprise-page">

      {/* ======================================== */}
      {/* HEADER */}
      {/* ======================================== */}

      <div className="member-page-header-card">
        <div>
          <h1>
            Giving Statements
          </h1>

          <p>
            Review donation,
            tithe, pledge,
            memorial, candle,
            and giving statement
            history for tax and
            church contribution
            records.
          </p>
        </div>
      </div>

      {/* ======================================== */}
      {/* KPI */}
      {/* ======================================== */}

      <div className="member-kpi-grid">

        <div className="member-kpi-card">
          <span>
            Total Donations
          </span>

          <strong>
            {money(
              totals.total
            )}
          </strong>
        </div>

        <div className="member-kpi-card">
          <span>
            Records
          </span>

          <strong>
            {filtered.length}
          </strong>
        </div>

        <div className="member-kpi-card">
          <span>
            Statement Year
          </span>

          <strong>
            {year}
          </strong>
        </div>

      </div>

      {/* ======================================== */}
      {/* FILTERS */}
      {/* ======================================== */}

      <div className="member-filter-card">

        <div className="member-filter-grid">

          <div className="member-filter-item">
            <label>
              Search
            </label>

            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search donation, receipt, payment number..."
            />
          </div>

          <div className="member-filter-item">
            <label>
              Statement Year
            </label>

            <select
              value={year}
              onChange={(e) =>
                setYear(
                  e.target.value
                )
              }
            >
              {Array.from(
                { length: 6 },
                (_, i) =>
                  new Date().getFullYear() -
                  i
              ).map((y) => (
                <option
                  key={y}
                  value={String(y)}
                >
                  {y}
                </option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* ======================================== */}
      {/* BREAKDOWN */}
      {/* ======================================== */}

      <div className="member-table-card">

        <div className="member-section-header">
          <h2>
            Giving Breakdown
          </h2>
        </div>

        <div className="member-breakdown-grid">

          {yearlyBreakdown.map(
            (item) => (
              <div
                key={item.key}
                className="member-breakdown-card"
              >

                <span>
                  {item.label}
                </span>

                <strong>
                  {money(
                    item.amount
                  )}
                </strong>

              </div>
            )
          )}

        </div>

      </div>

      {/* ======================================== */}
      {/* TABLE */}
      {/* ======================================== */}

      <div className="member-table-card">

        {loading ? (
          <div className="member-empty-state">
            Loading giving statements...
          </div>
        ) : filtered.length === 0 ? (
          <div className="member-empty-state">

            <h3>
              No giving statements found
            </h3>

            <p>
              Donation and
              contribution history
              will appear here.
            </p>

          </div>
        ) : (
          <div className="member-table-wrap">

            <table className="member-enterprise-table">

              <thead>
                <tr>

                  <th>
                    Payment #
                  </th>

                  <th>
                    Category
                  </th>

                  <th>
                    Amount
                  </th>

                  <th>
                    Receipt
                  </th>

                  <th>
                    Method
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Date
                  </th>

                </tr>
              </thead>

              <tbody>

                {filtered.map(
                  (row) => (
                    <tr
                      key={row.id}
                    >

                      <td>

                        <div className="member-table-primary">
                          {
                            row.payment_number
                          }
                        </div>

                        <div className="member-table-secondary">
                          {
                            row.invoice_number ||
                            "--"
                          }
                        </div>

                      </td>

                      <td>

                        <div className="member-table-primary">
                          {CATEGORY_LABELS[
                            row.sub_category
                          ] ||
                            row.sub_category ||
                            row.category}
                        </div>

                      </td>

                      <td>

                        <div className="member-table-primary">
                          {money(
                            row.amount
                          )}
                        </div>

                      </td>

                      <td>

                        <div className="member-table-primary">
                          {
                            row.receipt_number ||
                            "--"
                          }
                        </div>

                      </td>

                      <td>

                        <div className="member-table-primary">
                          {
                            row.payment_method
                          }
                        </div>

                        <div className="member-table-secondary">
                          {
                            row.payment_source
                          }
                        </div>

                      </td>

                      <td>

                        <FinanceBadge
                          status={
                            row.status
                          }
                        />

                      </td>

                      <td>

                        <div className="member-table-primary">
                          {fmtDate(
                            row.payment_date ||
                              row.paid_at
                          )}
                        </div>

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </div>

    </div>
  );
}