// frontend/src/components/FinanceDashboard/components/FinancePageHeader.jsx

import React from "react";

/* =========================================================
   COMPONENT
========================================================= */

export default function FinancePageHeader({
  title = "Finance",
  subtitle = "",
  eyebrow = "Finance Dashboard",
  actions = [],
  rightContent = null,
}) {
  return (
    <section className="finance-header-card">

      {/* =========================================
          LEFT
      ========================================= */}

      <div className="finance-header-main">

        <div className="finance-header-content">

          {eyebrow ? (
            <p className="finance-header-eyebrow">
              {eyebrow}
            </p>
          ) : null}

          <h1 className="finance-header-title">
            {title}
          </h1>

          {subtitle ? (
            <p className="finance-header-subtitle">
              {subtitle}
            </p>
          ) : null}

        </div>

        {/* =====================================
            RIGHT TOOLBAR
        ===================================== */}

        <div className="finance-header-toolbar">

          {rightContent ? (
            <div className="finance-header-extra">
              {rightContent}
            </div>
          ) : null}

          {Array.isArray(actions) &&
          actions.length > 0 ? (

            <div className="finance-header-actions">

              {actions.map((action, index) => {

                const {
                  label,
                  icon,
                  onClick,
                  disabled = false,
                  loading = false,
                  variant = "secondary",
                  type = "button",
                } = action || {};

                return (

                  <button
                    key={`${label}-${index}`}
                    type={type}
                    className={`
                      finance-btn
                      ${
                        variant === "primary"
                          ? "finance-btn-primary"
                          : variant === "danger"
                          ? "finance-btn-danger"
                          : "finance-btn-secondary"
                      }
                    `}
                    onClick={onClick}
                    disabled={disabled || loading}
                  >

                    {loading ? (

                      <span className="finance-btn-spinner" />

                    ) : icon ? (

                      <span className="finance-btn-icon">
                        {icon}
                      </span>

                    ) : null}

                    <span>
                      {loading
                        ? "Processing..."
                        : label}
                    </span>

                  </button>
                );
              })}

            </div>

          ) : null}

        </div>

      </div>

    </section>
  );
}