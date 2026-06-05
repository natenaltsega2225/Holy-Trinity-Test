// frontend/src/components/FinanceDashboard/components/FinanceDonorProfileDrawer.jsx

import React from "react";

import {
  X,
  Mail,
  Download,
  HeartHandshake,
  Calendar,
  Receipt,
  Landmark,
  TrendingUp,
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

export default function FinanceDonorProfileDrawer({
  open,
  donor = {},
  donations = [],
  pledges = [],
  timeline = [],
  onClose,
  onEmail,
  onStatement,
  onCreatePledge,
}) {
  if (!open) return null;

  const lifetimeGiving =
    donations.reduce(
      (sum, r) =>
        sum +
        Number(r.amount || 0),
      0
    );

  const yearlyGiving =
    donations
      .filter(
        (r) =>
          new Date(
            r.payment_date
          ).getFullYear() ===
          new Date().getFullYear()
      )
      .reduce(
        (sum, r) =>
          sum +
          Number(r.amount || 0),
        0
      );

  const largestGift =
    Math.max(
      ...donations.map((r) =>
        Number(r.amount || 0)
      ),
      0
    );

  return (
    <div className="finance-drawer-overlay">

      <div className="finance-donor-drawer">

        {/* HEADER */}

        <div className="finance-drawer-header">

          <div>

            <span className="finance-drawer-label">
              Donor Profile
            </span>

            <h2>
              {donor.full_name ||
                "Donor"}
            </h2>

          </div>

          <button
            className="finance-drawer-close"
            onClick={onClose}
          >
            <X size={18} />
          </button>

        </div>

        {/* BODY */}

        <div className="finance-drawer-body">

          {/* OVERVIEW */}

          <div className="finance-drawer-section">

            <div className="finance-drawer-section-title">

              <HeartHandshake
                size={16}
              />

              <span>
                Donor Overview
              </span>

            </div>

            <div className="finance-detail-grid">

              <div>
                <label>
                  Member #
                </label>

                <strong>
                  {donor.member_no ||
                    "Non Member"}
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
                  Phone
                </label>

                <strong>
                  {donor.phone ||
                    "--"}
                </strong>
              </div>

              <div>
                <label>
                  Donor Since
                </label>

                <strong>
                  {donor.created_at
                    ? new Date(
                        donor.created_at
                      ).toLocaleDateString()
                    : "--"}
                </strong>
              </div>

            </div>

          </div>

          {/* KPI */}

          <div className="finance-kpi-grid">

            <div className="finance-kpi-card">
              <span>
                Lifetime Giving
              </span>

              <strong>
                {money(
                  lifetimeGiving
                )}
              </strong>
            </div>

            <div className="finance-kpi-card">
              <span>
                Yearly Giving
              </span>

              <strong>
                {money(
                  yearlyGiving
                )}
              </strong>
            </div>

            <div className="finance-kpi-card">
              <span>
                Largest Gift
              </span>

              <strong>
                {money(
                  largestGift
                )}
              </strong>
            </div>

            <div className="finance-kpi-card">
              <span>
                Active Pledges
              </span>

              <strong>
                {
                  pledges.filter(
                    (p) =>
                      p.status ===
                      "active"
                  ).length
                }
              </strong>
            </div>

          </div>

          {/* DONATIONS */}

          <div className="finance-drawer-section">

            <div className="finance-drawer-section-title">

              <Receipt size={16} />

              <span>
                Donation History
              </span>

            </div>

            <table className="finance-mini-table">

              <thead>
                <tr>
                  <th>
                    Type
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

                {!donations.length ? (
                  <tr>
                    <td
                      colSpan="3"
                      className="finance-empty-state"
                    >
                      No donations
                    </td>
                  </tr>
                ) : null}

                {donations.map(
                  (row) => (
                    <tr
                      key={row.id}
                    >

                      <td>
                        {pretty(
                          row.donation_category
                        )}
                      </td>

                      <td>
                        {new Date(
                          row.payment_date
                        ).toLocaleDateString()}
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

          {/* TIMELINE */}

          <div className="finance-drawer-section">

            <div className="finance-drawer-section-title">

              <TrendingUp
                size={16}
              />

              <span>
                Activity Timeline
              </span>

            </div>

            <div className="finance-timeline">

              {timeline.map(
                (
                  item,
                  index
                ) => (

                  <div
                    key={index}
                    className="finance-timeline-item"
                  >

                    <span>
                      {
                        item.message
                      }
                    </span>

                    <strong>
                      {new Date(
                        item.created_at
                      ).toLocaleString()}
                    </strong>

                  </div>
                )
              )}

            </div>

          </div>

        </div>

        {/* FOOTER */}

        <div className="finance-drawer-footer">

          <button
            className="finance-btn secondary"
            onClick={() =>
              onEmail?.(
                donor
              )
            }
          >

            <Mail size={16} />

            Email Donor

          </button>

          <button
            className="finance-btn secondary"
            onClick={() =>
              onStatement?.(
                donor
              )
            }
          >

            <Download
              size={16}
            />

            Giving Statement

          </button>

          <button
            className="finance-btn primary"
            onClick={() =>
              onCreatePledge?.(
                donor
              )
            }
          >

            <Landmark
              size={16}
            />

            Create Pledge

          </button>

        </div>

      </div>

    </div>
  );
}