// frontend/src/components/MembershipDashboard/components/RecentActivityFeed.jsx

import React from "react";

import {
  CreditCard,
  FileText,
  Receipt,
  RefreshCw,
  Heart,
  Plane,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";

// import "../membership-dashboard.css";

/* =========================================================
   HELPERS
========================================================= */

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

  return d.toLocaleString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function resolveIcon(type) {

  const value =
    String(
      type || ""
    ).toLowerCase();

  if (
    value.includes(
      "payment"
    )
  ) {

    return CreditCard;
  }

  if (
    value.includes(
      "invoice"
    )
  ) {

    return FileText;
  }

  if (
    value.includes(
      "receipt"
    )
  ) {

    return Receipt;
  }

  if (
    value.includes(
      "renew"
    )
  ) {

    return RefreshCw;
  }

  if (
    value.includes(
      "donation"
    )
  ) {

    return Heart;
  }

  if (
    value.includes(
      "trip"
    )
  ) {

    return Plane;
  }

  if (
    value.includes(
      "school"
    )
  ) {

    return GraduationCap;
  }

  return CheckCircle2;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function RecentActivityFeed({

  activities = [],
}) {

  return (

    <div className="activity-feed-card">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="activity-feed-head">

        <div>

          <span className="activity-feed-label">
            Member Portal
          </span>

          <h3 className="activity-feed-title">

            Recent Activity

          </h3>

        </div>

      </div>

      {/* =====================================
          EMPTY
      ===================================== */}

      {!activities.length ? (

        <div className="activity-feed-empty">

          No recent activity found.

        </div>

      ) : null}

      {/* =====================================
          LIST
      ===================================== */}

      {activities.length ? (

        <div className="activity-feed-list">

          {activities
            .slice(0, 12)
            .map((item, index) => {

              const Icon =
                resolveIcon(
                  item.type
                );

              return (

                <div
                  key={
                    item.id ||
                    index
                  }
                  className="activity-feed-row"
                >

                  {/* ===================
                      ICON
                  =================== */}

                  <div className="activity-feed-icon">

                    <Icon size={18} />

                  </div>

                  {/* ===================
                      CONTENT
                  =================== */}

                  <div className="activity-feed-content">

                    <strong>

                      {item.title ||
                        "Activity"}

                    </strong>

                    <p>

                      {item.description ||
                        "--"}

                    </p>

                    <span>

                      {formatDate(
                        item.created_at
                      )}

                    </span>

                  </div>

                </div>
              );
            })}

        </div>

      ) : null}

    </div>
  );
}