// frontend/src/components/FinanceDashboard/components/FinancePaymentAuditTimeline.jsx

import React from "react";

import {
  Clock3,
  Receipt,
  Mail,
  RotateCcw,
  ShieldCheck,
  Pencil,
  CreditCard,
} from "lucide-react";

// import "../finance-dashboard.css";

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
    String(type || "")
      .toLowerCase();

  if (
    value.includes(
      "receipt"
    )
  ) {

    return Receipt;
  }

  if (
    value.includes(
      "email"
    )
  ) {

    return Mail;
  }

  if (
    value.includes(
      "refund"
    )
  ) {

    return RotateCcw;
  }

  if (
    value.includes(
      "edit"
    )
  ) {

    return Pencil;
  }

  if (
    value.includes(
      "audit"
    )
  ) {

    return ShieldCheck;
  }

  return CreditCard;
}

function pretty(value) {

  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) =>
      c.toUpperCase()
    );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinancePaymentAuditTimeline({

  rows = [],
}) {

  return (

    <div className="finance-audit-timeline">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="finance-audit-head">

        <Clock3 size={18} />

        <div>

          <h3>
            Audit Timeline
          </h3>

          <p>

            Enterprise treasury
            audit and transaction
            history.

          </p>

        </div>

      </div>

      {/* =====================================
          EMPTY
      ===================================== */}

      {!rows.length ? (

        <div className="finance-audit-empty">

          No audit activity found.

        </div>

      ) : null}

      {/* =====================================
          TIMELINE
      ===================================== */}

      {rows.length ? (

        <div className="finance-audit-list">

          {rows.map(
            (
              item,
              index
            ) => {

              const Icon =
                resolveIcon(
                  item.event_type
                );

              return (

                <div
                  key={
                    item.id ||
                    index
                  }
                  className="finance-audit-item"
                >

                  {/* LINE */}

                  <div className="finance-audit-line" />

                  {/* ICON */}

                  <div className="finance-audit-icon">

                    <Icon size={16} />

                  </div>

                  {/* CONTENT */}

                  <div className="finance-audit-content">

                    <div className="finance-audit-top">

                      <strong>

                        {pretty(
                          item.event_type
                        )}

                      </strong>

                      <span>

                        {formatDate(
                          item.created_at
                        )}

                      </span>

                    </div>

                    <p>

                      {item.message ||
                        item.notes ||
                        "--"}

                    </p>

                    <div className="finance-audit-meta">

                      <small>

                        By:
                        {" "}
                        {
                          item.actor_name
                        }

                      </small>

                      {item.reference_no ? (

                        <small>

                          Ref:
                          {" "}
                          {
                            item.reference_no
                          }

                        </small>

                      ) : null}

                    </div>

                  </div>

                </div>
              );
            }
          )}

        </div>

      ) : null}

    </div>
  );
}