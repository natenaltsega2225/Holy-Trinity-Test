//frontend\src\components\MembershipDashoard\components\MemberPageHeader.jsx
import React from "react";

export default function MemberPageHeader({
  title,
  subtitle,
  actions = [],
}) {
  return (
    <section className="member-card member-header">
      <div className="member-header-main">
        <h2 className="member-header-title">{title}</h2>
        {subtitle ? (
          <p className="member-header-subtitle">{subtitle}</p>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <div className="member-header-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`member-btn ${
                action.variant === "primary"
                  ? "member-btn-primary"
                  : action.variant === "danger"
                  ? "member-btn-danger"
                  : "member-btn-secondary"
              }`}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}