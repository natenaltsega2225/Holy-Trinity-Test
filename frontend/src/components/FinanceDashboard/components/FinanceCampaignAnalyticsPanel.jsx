// frontend/src/components/FinanceDashboard/components/FinanceCampaignAnalyticsPanel.jsx

import React, {
  useMemo,
  useState,
} from "react";

import {
  BarChart3,
  TrendingUp,
  Users,
  Landmark,
  AlertTriangle,
  RefreshCcw,
  Target,
  Download,
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

function percent(a, b) {
  if (!b) return "0%";
  return `${(
    (Number(a || 0) /
      Number(b || 1)) *
    100
  ).toFixed(1)}%`;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceCampaignAnalyticsPanel({
  campaigns = [],
  pledges = [],
  payments = [],
  donors = [],
  onExport,
}) {
  const [activeCampaign,
    setActiveCampaign] =
      useState("all");

  /* =====================================================
     FILTERED
  ===================================================== */

  const filteredCampaigns =
    useMemo(() => {

      if (
        activeCampaign ===
        "all"
      ) {
        return campaigns;
      }

      return campaigns.filter(
        (c) =>
          String(c.id) ===
          String(
            activeCampaign
          )
      );

    }, [
      campaigns,
      activeCampaign,
    ]);

  /* =====================================================
     KPI
  ===================================================== */

  const summary =
    useMemo(() => {

      const totalPledged =
        pledges.reduce(
          (sum, p) =>
            sum +
            Number(
              p.pledged_amount || 0
            ),
          0
        );

      const totalCollected =
        payments.reduce(
          (sum, p) =>
            sum +
            Number(
              p.amount || 0
            ),
          0
        );

      const overdue =
        pledges.filter(
          (p) =>
            p.status ===
            "overdue"
        ).length;

      const recurring =
        donors.filter(
          (d) =>
            d.is_recurring
        ).length;

      return {
        totalPledged,
        totalCollected,
        overdue,
        recurring,
      };

    }, [
      pledges,
      payments,
      donors,
    ]);

  /* =====================================================
     TOP DONORS
  ===================================================== */

  const topDonors =
    useMemo(() => {

      return [...donors]
        .sort(
          (a, b) =>
            Number(
              b.total_giving || 0
            ) -
            Number(
              a.total_giving || 0
            )
        )
        .slice(0, 10);

    }, [donors]);

  return (

    <div className="finance-campaign-analytics">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="finance-section-head">

        <div>

          <h2>
            Campaign Analytics
          </h2>

          <p>

            Enterprise fundraising
            intelligence and donor
            performance analytics.

          </p>

        </div>

        <button
          className="finance-btn primary"
          onClick={onExport}
        >

          <Download size={16} />

          Export Analytics

        </button>

      </div>

      {/* =====================================
          FILTER
      ===================================== */}

      <div className="finance-filter-row">

        <select
          value={
            activeCampaign
          }
          onChange={(e) =>
            setActiveCampaign(
              e.target.value
            )
          }
        >

          <option value="all">
            All Campaigns
          </option>

          {campaigns.map(
            (campaign) => (

              <option
                key={campaign.id}
                value={
                  campaign.id
                }
              >

                {
                  campaign.title
                }

              </option>
            )
          )}

        </select>

      </div>

      {/* =====================================
          KPI GRID
      ===================================== */}

      <div className="finance-kpi-grid">

        <div className="finance-kpi-card">

          <Target size={18} />

          <span>
            Total Pledged
          </span>

          <strong>

            {money(
              summary.totalPledged
            )}

          </strong>

        </div>

        <div className="finance-kpi-card success">

          <Landmark size={18} />

          <span>
            Total Collected
          </span>

          <strong>

            {money(
              summary.totalCollected
            )}

          </strong>

        </div>

        <div className="finance-kpi-card warning">

          <AlertTriangle
            size={18}
          />

          <span>
            Overdue Pledges
          </span>

          <strong>

            {
              summary.overdue
            }

          </strong>

        </div>

        <div className="finance-kpi-card">

          <RefreshCcw
            size={18}
          />

          <span>
            Recurring Donors
          </span>

          <strong>

            {
              summary.recurring
            }

          </strong>

        </div>

      </div>

      {/* =====================================
          CAMPAIGN TABLE
      ===================================== */}

      <div className="finance-table-wrap">

        <table className="finance-table">

          <thead>

            <tr>

              <th>
                Campaign
              </th>

              <th>
                Goal
              </th>

              <th>
                Collected
              </th>

              <th>
                Pledged
              </th>

              <th>
                Fulfillment
              </th>

              <th>
                Donors
              </th>

              <th>
                Status
              </th>

            </tr>

          </thead>

          <tbody>

            {!filteredCampaigns.length ? (

              <tr>

                <td
                  colSpan="7"
                  className="finance-empty-state"
                >

                  No campaign
                  analytics found.

                </td>

              </tr>

            ) : null}

            {filteredCampaigns.map(
              (
                campaign
              ) => {

                const collected =
                  Number(
                    campaign.raised_amount || 0
                  );

                const pledged =
                  Number(
                    campaign.pledged_amount || 0
                  );

                return (

                  <tr
                    key={
                      campaign.id
                    }
                  >

                    <td>

                      <div className="finance-member-cell">

                        <strong>

                          {
                            campaign.title
                          }

                        </strong>

                        <span>

                          {
                            campaign.description
                          }

                        </span>

                      </div>

                    </td>

                    <td>

                      {money(
                        campaign.goal_amount
                      )}

                    </td>

                    <td>

                      {money(
                        collected
                      )}

                    </td>

                    <td>

                      {money(
                        pledged
                      )}

                    </td>

                    <td>

                      {percent(
                        collected,
                        pledged
                      )}

                    </td>

                    <td>

                      {
                        campaign.donor_count
                      }

                    </td>

                    <td>

                      <span className={`
                        finance-status-badge
                        ${campaign.status}
                      `}>

                        {
                          campaign.status
                        }

                      </span>

                    </td>

                  </tr>
                );
              }
            )}

          </tbody>

        </table>

      </div>

      {/* =====================================
          TOP DONORS
      ===================================== */}

      <div className="finance-section-head finance-section-head-tight">

        <h3>
          Top Donors
        </h3>

      </div>

      <div className="finance-table-wrap">

        <table className="finance-table">

          <thead>

            <tr>

              <th>
                Donor
              </th>

              <th>
                Member #
              </th>

              <th>
                Total Giving
              </th>

              <th>
                Recurring
              </th>

            </tr>

          </thead>

          <tbody>

            {!topDonors.length ? (

              <tr>

                <td
                  colSpan="4"
                  className="finance-empty-state"
                >

                  No donors found.

                </td>

              </tr>

            ) : null}

            {topDonors.map(
              (
                donor
              ) => (

                <tr
                  key={
                    donor.id
                  }
                >

                  <td>

                    {
                      donor.full_name
                    }

                  </td>

                  <td>

                    {donor.member_no ||
                      "Non Member"}

                  </td>

                  <td>

                    {money(
                      donor.total_giving
                    )}

                  </td>

                  <td>

                    {donor.is_recurring
                      ? "Yes"
                      : "No"}

                  </td>

                </tr>
              )
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}