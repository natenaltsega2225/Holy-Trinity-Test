// //frontend\src\components\MembershipDashoard\components\MemberSummaryCards.jsx

import React from "react";

function safeValue(value) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  return value;
}

export default function MemberSummaryCards({ items = [] }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  if (!safeItems.length) return null;

  return (
    <section className="member-kpi-row">
      {safeItems.map((item, index) => {
        const key = item.key || item.label || index;

        return (
          <div
            key={key}
            className={[
              "member-kpi-card",
              item.featured ? "featured" : "",
              item.variant ? `member-kpi-${item.variant}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="member-kpi-label">
              {safeValue(item.label)}
            </div>

            <div className="member-kpi-value">
              {safeValue(item.value)}
            </div>

            {item.sub ? (
              <div className="member-kpi-sub">
                {item.sub}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}