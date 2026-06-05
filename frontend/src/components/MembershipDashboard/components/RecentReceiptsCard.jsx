// frontend/src/components/MembershipDashboard/components/RecentReceiptsCard.jsx

import React from "react";

// import "../membership-dashboard.css";

/* =========================================================
   HELPERS
========================================================= */

function money(value) {

  return `$${Number(
    value || 0
  ).toLocaleString(undefined, {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  })}`;
}

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

function statusClass(status) {

  const s =
    String(
      status || ""
    ).toLowerCase();

  if (
    s === "sent" ||
    s === "delivered"
  ) {

    return "success";
  }

  if (
    s === "pending"
  ) {

    return "warning";
  }

  return "neutral";
}

/* =========================================================
   COMPONENT
========================================================= */

export default function RecentReceiptsCard({

  receipts = [],

  onDownload,
}) {

  return (

    <div className="recent-receipts-card">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="recent-receipts-head">

        <div>

          <span className="recent-receipts-label">
            Billing
          </span>

          <h3 className="recent-receipts-title">

            Recent Receipts

          </h3>

        </div>

      </div>

      {/* =====================================
          EMPTY
      ===================================== */}

      {!receipts.length ? (

        <div className="recent-receipts-empty">

          No receipts available.

        </div>

      ) : null}

      {/* =====================================
          LIST
      ===================================== */}

      {receipts.length ? (

        <div className="recent-receipts-list">

          {receipts
            .slice(0, 5)
            .map((receipt) => (

              <div
                key={receipt.id}
                className="recent-receipt-row"
              >

                {/* =====================
                    LEFT
                ===================== */}

                <div className="recent-receipt-left">

                  <strong>

                    {
                      receipt.receipt_number
                    }

                  </strong>

                  <span>

                    {formatDate(
                      receipt.created_at
                    )}

                  </span>

                </div>

                {/* =====================
                    CENTER
                ===================== */}

                <div className="recent-receipt-center">

                  <span>

                    {money(
                      receipt.amount
                    )}

                  </span>

                  <div
                    className={`
                      recent-receipt-status
                      ${statusClass(
                        receipt.email_status
                      )}
                    `}
                  >

                    {receipt.email_status ||
                      "Pending"}

                  </div>

                </div>

                {/* =====================
                    RIGHT
                ===================== */}

                <div className="recent-receipt-right">

                  <button
                    type="button"
                    className="recent-receipt-btn"
                    onClick={() =>
                      onDownload?.(
                        receipt
                      )
                    }
                  >

                    PDF

                  </button>

                </div>

              </div>
            ))}

        </div>

      ) : null}

    </div>
  );
}