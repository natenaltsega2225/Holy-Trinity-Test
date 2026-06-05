// frontend/src/components/FinanceDashboard/components/FinanceGivingStatementPreview.jsx

import React from "react";

import {
  HeartHandshake,
  Download,
  Printer,
  Mail,
  Landmark,
  Calendar,
  Receipt,
} from "lucide-react";

// import "../finance-dashboard.css";

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

function formatDate(value) {

  if (!value) {

    return "--";
  }

  const d =
    new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {

    return "--";
  }

  return d.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

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

export default function FinanceGivingStatementPreview({

  open,

  year,

  church = {},

  donor = {},

  rows = [],

  onClose,

  onDownload,

  onPrint,

  onEmail,
}) {

  if (!open) {

    return null;
  }

  /* =====================================================
     FILTER DONATIONS ONLY
  ===================================================== */

  const donationRows =
    rows.filter(
      (r) =>
        String(
          r.category
        ).toLowerCase() ===
        "donation"
    );

  /* =====================================================
     TOTALS
  ===================================================== */

  const totalGiving =
    donationRows.reduce(
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

  /* =====================================================
     CATEGORY TOTALS
  ===================================================== */

  const grouped =
    donationRows.reduce(
      (
        acc,
        row
      ) => {

        const key =
          row.donation_category ||
          "other";

        if (!acc[key]) {

          acc[key] = 0;
        }

        acc[key] += Number(
          row.amount || 0
        );

        return acc;

      },
      {}
    );

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="finance-modal-overlay">

      <div className="finance-giving-statement">

        {/* =====================================
            HEADER
        ===================================== */}

        <div className="finance-giving-head">

          <div className="finance-giving-head-left">

            <div className="finance-giving-icon">

              <HeartHandshake
                size={20}
              />

            </div>

            <div>

              <h2>
                Annual Giving Statement
              </h2>

              <p>

                Enterprise donor
                contribution and
                tax statement.

              </p>

            </div>

          </div>

          <button
            className="finance-modal-close"
            onClick={onClose}
          >

            ×

          </button>

        </div>

        {/* =====================================
            CHURCH INFO
        ===================================== */}

        <div className="finance-statement-church">

          <div>

            <h3>

              {church.name ||
                "Holy Trinity Ethiopian Orthodox Church"}

            </h3>

            <p>

              {church.address ||
                "Nashville, TN"}

            </p>

            <p>

              {church.phone ||
                "--"}

            </p>

          </div>

          <div className="finance-statement-tax">

            <span>
              EIN / Tax ID
            </span>

            <strong>

              {church.ein ||
                "--"}

            </strong>

          </div>

        </div>

        {/* =====================================
            DONOR INFO
        ===================================== */}

        <div className="finance-statement-donor">

          <div className="finance-statement-section-title">

            <Landmark size={16} />

            <span>
              Donor Information
            </span>

          </div>

          <div className="finance-grid-2">

            <div>

              <label>
                Donor Name
              </label>

              <strong>

                {donor.full_name ||
                  "--"}

              </strong>

            </div>

            <div>

              <label>
                Statement Year
              </label>

              <strong>

                {year}

              </strong>

            </div>

            <div>

              <label>
                Email
              </label>

              <strong>

                {donor.email ||
                  "--"}

              </strong>

            </div>

            <div>

              <label>
                Member #
              </label>

              <strong>

                {donor.member_no ||
                  "--"}

              </strong>

            </div>

          </div>

        </div>

        {/* =====================================
            SUMMARY
        ===================================== */}

        <div className="finance-giving-summary">

          <div className="finance-summary-box finance-summary-highlight">

            <span>
              Total Giving
            </span>

            <strong>

              {money(
                totalGiving
              )}

            </strong>

          </div>

        </div>

        {/* =====================================
            CATEGORY TOTALS
        ===================================== */}

        <div className="finance-statement-section">

          <div className="finance-statement-section-title">

            <Calendar size={16} />

            <span>
              Donation Categories
            </span>

          </div>

          <div className="finance-category-grid">

            {Object.entries(
              grouped
            ).map(
              ([
                key,
                value,
              ]) => (

                <div
                  key={key}
                  className="finance-category-card"
                >

                  <span>

                    {pretty(
                      key
                    )}

                  </span>

                  <strong>

                    {money(
                      value
                    )}

                  </strong>

                </div>
              )
            )}

          </div>

        </div>

        {/* =====================================
            TABLE
        ===================================== */}

        <div className="finance-statement-section">

          <div className="finance-statement-section-title">

            <Receipt size={16} />

            <span>
              Donation Transactions
            </span>

          </div>

          <table className="finance-giving-table">

            <thead>

              <tr>

                <th>
                  Receipt #
                </th>

                <th>
                  Donation Type
                </th>

                <th>
                  Method
                </th>

                <th>
                  Date
                </th>

                <th>
                  Amount
                </th>

              </tr>

            </thead>

            <tbody>

              {!donationRows.length ? (

                <tr>

                  <td
                    colSpan="5"
                    className="finance-empty-state"
                  >

                    No donation
                    records found.

                  </td>

                </tr>

              ) : null}

              {donationRows.map(
                (
                  row,
                  index
                ) => (

                  <tr
                    key={
                      row.id ||
                      index
                    }
                  >

                    <td>

                      {
                        row.receipt_number
                      }

                    </td>

                    <td>

                      {pretty(
                        row.donation_category
                      )}

                    </td>

                    <td>

                      {pretty(
                        row.method
                      )}

                    </td>

                    <td>

                      {formatDate(
                        row.payment_date
                      )}

                    </td>

                    <td>

                      {money(
                        row.amount
                      )}

                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>

        </div>

        {/* =====================================
            DISCLAIMER
        ===================================== */}

        <div className="finance-giving-disclaimer">

          Contributions are
          tax-deductible to the
          extent allowed by law.
          No goods or services
          were provided in
          exchange for these
          contributions unless
          otherwise noted.

        </div>

        {/* =====================================
            FOOTER
        ===================================== */}

        <div className="finance-giving-footer">

          <div>

            Generated:
            {" "}
            {formatDate(
              new Date()
            )}

          </div>

          <div>

            Holy Trinity
            Finance Office

          </div>

        </div>

        {/* =====================================
            ACTIONS
        ===================================== */}

        <div className="finance-giving-actions">

          <button
            className="finance-btn secondary"
            onClick={onClose}
          >

            Close

          </button>

          <button
            className="finance-btn secondary"
            onClick={() =>
              onPrint?.()
            }
          >

            <Printer size={16} />

            Print

          </button>

          <button
            className="finance-btn secondary"
            onClick={() =>
              onEmail?.()
            }
          >

            <Mail size={16} />

            Email Statement

          </button>

          <button
            className="finance-btn primary"
            onClick={() =>
              onDownload?.()
            }
          >

            <Download size={16} />

            Download PDF

          </button>

        </div>

      </div>

    </div>
  );
}