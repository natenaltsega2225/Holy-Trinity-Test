// frontend/src/components/FinanceDashboard/components/FinanceCampaignDashboard.jsx

import React from "react";

import {
  Target,
  TrendingUp,
  Users,
  Landmark,
} from "lucide-react";

// import "../finance-dashboard.css";

function money(value) {
  return `$${Number(
    value || 0
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function FinanceCampaignDashboard({
  campaigns = [],
}) {
  return (
    <div className="finance-campaign-dashboard">

      <div className="finance-campaign-head">

        <div>

          <h2>
            Campaign Dashboard
          </h2>

          <p>
            Enterprise fundraising
            campaign analytics and
            donor tracking.
          </p>

        </div>

      </div>

      <div className="finance-campaign-grid">

        {campaigns.map(
          (campaign) => {

            const progress =
              (
                (Number(
                  campaign.raised_amount || 0
                ) /
                  Number(
                    campaign.goal_amount || 1
                  )) *
                100
              ).toFixed(1);

            return (
              <div
                key={campaign.id}
                className="finance-campaign-card"
              >

                <div className="finance-campaign-top">

                  <Target
                    size={20}
                  />

                  <span>
                    {
                      campaign.status
                    }
                  </span>

                </div>

                <h3>
                  {
                    campaign.title
                  }
                </h3>

                <p>
                  {
                    campaign.description
                  }
                </p>

                <div className="finance-campaign-kpis">

                  <div>

                    <label>
                      Goal
                    </label>

                    <strong>
                      {money(
                        campaign.goal_amount
                      )}
                    </strong>

                  </div>

                  <div>

                    <label>
                      Raised
                    </label>

                    <strong>
                      {money(
                        campaign.raised_amount
                      )}
                    </strong>

                  </div>

                </div>

                <div className="finance-progress-wrap">

                  <div
                    className="finance-progress-bar"
                    style={{
                      width: `${Math.min(
                        progress,
                        100
                      )}%`,
                    }}
                  />

                </div>

                <div className="finance-campaign-footer">

                  <span>

                    <TrendingUp
                      size={14}
                    />

                    {progress}%
                    funded

                  </span>

                  <span>

                    <Users
                      size={14}
                    />

                    {
                      campaign.donor_count
                    } donors

                  </span>

                </div>

              </div>
            );
          }
        )}

      </div>

    </div>
  );
}

