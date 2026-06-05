// frontend/src/components/FinanceDashboard/components/FinanceTreasuryReportsPanel.jsx

import React, {
  useMemo,
  useState,
} from "react";

import {
  BarChart3,
  Download,
  Receipt,
  Landmark,
  CreditCard,
  Wallet,
  Calendar,
} from "lucide-react";


import "../../../styles/finance-dashboard.css";


/* =========================================================
   HELPERS
========================================================= */

function money(value) {

  return `$${Number(
    value || 0
  ).toLocaleString(undefined, {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  })}`;
}

function sumBy(
  rows,
  predicate
) {

  return rows
    .filter(predicate)
    .reduce(
      (
        sum,
        r
      ) =>
        sum +
        Number(
          r.amount || 0
        ),
      0
    );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceTreasuryReportsPanel({

  rows = [],

  onExportReport,
}) {

  /* =====================================================
     FILTER
  ===================================================== */

  const [year,
    setYear] =
      useState(
        new Date().getFullYear()
      );

  /* =====================================================
     REPORTS
  ===================================================== */

  const reports =
    useMemo(() => {

      return {

        membership:
          sumBy(
            rows,
            (r) =>
              r.category ===
              "membership"
          ),

        donations:
          sumBy(
            rows,
            (r) =>
              r.category ===
              "donation"
          ),

        programs:
          sumBy(
            rows,
            (r) =>

              r.category ===
                "school" ||

              r.category ===
                "trip"
          ),

        refunds:
          sumBy(
            rows,
            (r) =>
              r.type ===
              "refund"
          ),

        stripe:
          sumBy(
            rows,
            (r) =>
              r.method ===
              "card"
          ),

        zelle:
          sumBy(
            rows,
            (r) =>
              r.method ===
              "zelle"
          ),

        cash:
          sumBy(
            rows,
            (r) =>
              r.method ===
              "cash"
          ),
      };

    }, [rows]);

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="finance-treasury-reports">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="finance-reports-head">

        <div className="finance-reports-title">

          <BarChart3 size={20} />

          <div>

            <h2>
              Treasury Reports
            </h2>

            <p>

              Enterprise accounting,
              donation, membership,
              and treasury analytics.

            </p>

          </div>

        </div>

        <div className="finance-reports-actions">

          <div className="finance-report-year">

            <Calendar size={16} />

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

          <button
            className="finance-btn primary"
            onClick={() =>
              onExportReport?.(
                year
              )
            }
          >

            <Download size={16} />

            Export Reports

          </button>

        </div>

      </div>

      {/* =====================================
          KPI GRID
      ===================================== */}

      <div className="finance-kpi-grid">

        <ReportCard
          icon={<Receipt size={18} />}
          title="Membership Revenue"
          value={money(
            reports.membership
          )}
        />

        <ReportCard
          icon={<Landmark size={18} />}
          title="Donations"
          value={money(
            reports.donations
          )}
        />

        <ReportCard
          icon={<Wallet size={18} />}
          title="Programs"
          value={money(
            reports.programs
          )}
        />

        <ReportCard
          icon={<CreditCard size={18} />}
          title="Stripe Revenue"
          value={money(
            reports.stripe
          )}
        />

        <ReportCard
          icon={<Wallet size={18} />}
          title="Cash Revenue"
          value={money(
            reports.cash
          )}
        />

        <ReportCard
          icon={<Landmark size={18} />}
          title="Zelle Revenue"
          value={money(
            reports.zelle
          )}
        />

        <ReportCard
          icon={<Receipt size={18} />}
          title="Refunds"
          value={money(
            reports.refunds
          )}
        />

      </div>

      {/* =====================================
          REPORT EXPORTS
      ===================================== */}

      <div className="finance-report-export-grid">

        {[
          "Donation Report",
          "Membership Revenue",
          "Sunday Collection",
          "Stripe Treasury",
          "Refund Report",
          "Audit Report",
          "Ledger Export",
          "Reconciliation Export",
        ].map((report) => (

          <button
            key={report}
            className="finance-report-export-card"
            onClick={() =>
              onExportReport?.(
                report
              )
            }
          >

            <Download size={18} />

            <span>

              {report}

            </span>

          </button>
        ))}

      </div>

    </div>
  );
}

/* =========================================================
   SUB COMPONENT
========================================================= */

function ReportCard({

  icon,

  title,

  value,
}) {

  return (

    <div className="finance-kpi-card">

      <div className="finance-kpi-icon">

        {icon}

      </div>

      <span>

        {title}

      </span>

      <strong>

        {value}

      </strong>

    </div>
  );
}