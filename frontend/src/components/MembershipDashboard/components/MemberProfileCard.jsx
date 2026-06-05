// frontend/src/components/MembershipDashboard/components/MemberProfileCard.jsx

import React from "react";

import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Calendar,
} from "lucide-react";

import "../membership-dashboard.css";

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
    "en-US"
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function MemberProfileCard({

  member = {},
}) {

  return (

    <div className="member-profile-card">

      {/* =====================================
          TOP
      ===================================== */}

      <div className="member-profile-top">

        <div className="member-profile-avatar">

          <User size={22} />

        </div>

        <div className="member-profile-main">

          <h3>

            {member.full_name ||
              "Member"}

          </h3>

          <span>

            {member.member_no ||
              "Membership ID"}

          </span>

        </div>

      </div>

      {/* =====================================
          STATUS
      ===================================== */}

      <div className="member-profile-status">

        <span
          className={`
            member-status-badge
            ${
              String(
                member.membership_status
              ).toLowerCase() ===
              "active"

                ? "active"

                : "inactive"
            }
          `}
        >

          <ShieldCheck size={14} />

          {member.membership_status ||
            "Active"}

        </span>

      </div>

      {/* =====================================
          INFO
      ===================================== */}

      <div className="member-profile-info">

        <div className="member-profile-row">

          <Mail size={15} />

          <span>

            {member.email ||
              "--"}

          </span>

        </div>

        <div className="member-profile-row">

          <Phone size={15} />

          <span>

            {member.phone ||
              "--"}

          </span>

        </div>

        <div className="member-profile-row">

          <Calendar size={15} />

          <span>

            Joined:
            {" "}
            {formatDate(
              member.created_at
            )}

          </span>

        </div>

      </div>

      {/* =====================================
          PLAN
      ===================================== */}

      <div className="member-profile-plan">

        <span>
          Active Plan
        </span>

        <strong>

          {member.active_plan ||
            "Membership"}

        </strong>

      </div>

    </div>
  );
}