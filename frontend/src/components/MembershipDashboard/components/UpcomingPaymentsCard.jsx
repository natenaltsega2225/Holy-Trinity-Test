// frontend/src/components/MembershipDashboard/components/UpcomingPaymentsCard.jsx

import React, {
  useMemo,
} from "react";

import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  GraduationCap,
  Plane,
} from "lucide-react";

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

/* =========================================================
   COMPONENT
========================================================= */

export default function UpcomingPaymentsCard({

  pendingInvoices = [],

  unpaidMonths = [],

  upcomingPrograms = [],

  onPayNow,
}) {

  /* =====================================================
     ALERT COUNT
  ===================================================== */

  const totalAlerts =
    useMemo(() => {

      return (

        pendingInvoices.length +

        unpaidMonths.length +

        upcomingPrograms.length
      );

    }, [

      pendingInvoices,

      unpaidMonths,

      upcomingPrograms,
    ]);

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="upcoming-payments-card">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="upcoming-payments-head">

        <div>

          <span className="upcoming-payments-label">
            Billing Alerts
          </span>

          <h3 className="upcoming-payments-title">

            Upcoming Payments

          </h3>

        </div>

        <div className="upcoming-payments-count">

          {totalAlerts}

        </div>

      </div>

      {/* =====================================
          EMPTY
      ===================================== */}

      {!totalAlerts ? (

        <div className="upcoming-payments-empty">

          All payments are up to date.

        </div>

      ) : null}

      {/* =====================================
          PENDING INVOICES
      ===================================== */}

      {pendingInvoices.map(
        (invoice) => (

          <div
            key={`invoice-${invoice.id}`}
            className="upcoming-payment-row"
          >

            <div className="upcoming-payment-left">

              <div className="upcoming-payment-icon warning">

                <CreditCard size={16} />

              </div>

              <div>

                <strong>

                  Pending Invoice

                </strong>

                <span>

                  {
                    invoice.invoice_number
                  }

                </span>

              </div>

            </div>

            <div className="upcoming-payment-right">

              <strong>

                {money(
                  invoice.balance_due
                )}

              </strong>

              <button
                type="button"
                onClick={() =>
                  onPayNow?.(
                    invoice
                  )
                }
              >

                Pay

              </button>

            </div>

          </div>
        )
      )}

      {/* =====================================
          UNPAID MONTHS
      ===================================== */}

      {unpaidMonths.map(
        (month) => (

          <div
            key={month}
            className="upcoming-payment-row"
          >

            <div className="upcoming-payment-left">

              <div className="upcoming-payment-icon danger">

                <AlertTriangle size={16} />

              </div>

              <div>

                <strong>

                  Membership Due

                </strong>

                <span>
                  {month}
                </span>

              </div>

            </div>

            <div className="upcoming-payment-right">

              <button
                type="button"
                onClick={() =>
                  onPayNow?.(
                    month
                  )
                }
              >

                Renew

              </button>

            </div>

          </div>
        )
      )}

      {/* =====================================
          PROGRAMS
      ===================================== */}

      {upcomingPrograms.map(
        (program) => {

          const Icon =

            program.category ===
            "trip"

              ? Plane

              : GraduationCap;

          return (

            <div
              key={program.id}
              className="upcoming-payment-row"
            >

              <div className="upcoming-payment-left">

                <div className="upcoming-payment-icon primary">

                  <Icon size={16} />

                </div>

                <div>

                  <strong>

                    {program.title}

                  </strong>

                  <span>

                    {formatDate(
                      program.start_date
                    )}

                  </span>

                </div>

              </div>

              <div className="upcoming-payment-right">

                <button
                  type="button"
                  onClick={() =>
                    onPayNow?.(
                      program
                    )
                  }
                >

                  Register

                </button>

              </div>

            </div>
          );
        }
      )}

      {/* =====================================
          FOOTER
      ===================================== */}

      {totalAlerts ? (

        <div className="upcoming-payments-footer">

          <CalendarClock size={16} />

          <span>

            Action recommended to
            maintain active membership
            status.

          </span>

        </div>

      ) : null}

    </div>
  );
}