// frontend/src/components/MembershipDashboard/components/AnnouncementCenter.jsx

import React from "react";

import {
  Bell,
  Calendar,
  Megaphone,
  AlertTriangle,
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

  return d.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function resolveIcon(category) {

  const value =
    String(
      category || ""
    ).toLowerCase();

  if (
    value.includes(
      "finance"
    )
  ) {

    return AlertTriangle;
  }

  if (
    value.includes(
      "event"
    )
  ) {

    return Calendar;
  }

  return Megaphone;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AnnouncementCenter({

  announcements = [],
}) {

  return (

    <div className="announcement-center-card">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="announcement-center-head">

        <div>

          <span className="announcement-center-label">
            Communication
          </span>

          <h3 className="announcement-center-title">

            Announcements

          </h3>

        </div>

        <div className="announcement-center-icon">

          <Bell size={18} />

        </div>

      </div>

      {/* =====================================
          EMPTY
      ===================================== */}

      {!announcements.length ? (

        <div className="announcement-center-empty">

          No announcements available.

        </div>

      ) : null}

      {/* =====================================
          LIST
      ===================================== */}

      {announcements.length ? (

        <div className="announcement-center-list">

          {announcements
            .slice(0, 10)
            .map((item) => {

              const Icon =
                resolveIcon(
                  item.category
                );

              return (

                <div
                  key={item.id}
                  className="announcement-row"
                >

                  {/* ===================
                      ICON
                  =================== */}

                  <div className="announcement-row-icon">

                    <Icon size={18} />

                  </div>

                  {/* ===================
                      CONTENT
                  =================== */}

                  <div className="announcement-row-content">

                    <strong>

                      {item.title}

                    </strong>

                    <p>

                      {item.summary ||
                        item.message ||
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