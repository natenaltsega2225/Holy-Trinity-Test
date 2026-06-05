//frontend\src\components\MembershipDashoard\components\MemberEmptyState.jsx
import React from "react";

export default function MemberEmptyState({
  title = "No records found",
  subtitle = "Try adjusting your search or filters.",
}) {
  return (
    <section className="member-card member-empty">
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </section>
  );
}