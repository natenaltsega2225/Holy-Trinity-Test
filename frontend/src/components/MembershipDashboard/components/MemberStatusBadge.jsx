//frontend\src\components\MembershipDashoard\components\MemberStatusBadge.jsx
import React from "react";

export default function MemberStatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  let className = "member-pill member-pill-neutral";

  if (
    ["paid", "succeeded", "active", "verified", "deposited", "matched", "available", "approved", "posted"].includes(
      normalized
    )
  ) {
    className = "member-pill member-pill-ok";
  } else if (
    ["pending", "draft", "open", "partially_paid", "partially matched", "manual_renewal"].includes(
      normalized
    )
  ) {
    className = "member-pill member-pill-warn";
  } else if (
    ["failed", "overdue", "cancelled", "returned", "unmatched", "voided", "refunded"].includes(
      normalized
    )
  ) {
    className = "member-pill member-pill-danger";
  }

  return <span className={className}>{status || "--"}</span>;
}