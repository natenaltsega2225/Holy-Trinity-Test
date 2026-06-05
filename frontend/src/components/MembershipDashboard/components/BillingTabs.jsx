// frontend/src/components/MembershipDashboard/components/BillingTabs.jsx

import React from "react";

// import "../membership-dashboard.css";

/* =========================================================
   TABS
========================================================= */

const BILLING_TABS = [

  {
    key: "make-payment",

    label:
      "Make Payment",
  },

  {
    key: "renewal",

    label:
      "Membership Renewal",
  },

  {
    key: "coverage",

    label:
      "Membership Coverage",
  },

  {
    key: "history",

    label:
      "Payment History",
  },

  {
    key: "ledger",

    label:
      "Ledger",
  },

  {
    key: "invoices",

    label:
      "Invoices",
  },

  {
    key: "giving",

    label:
      "Giving Statements",
  },
];

/* =========================================================
   COMPONENT
========================================================= */

export default function BillingTabs({

  activeTab,

  onChange,
}) {

  return (

    <section className="member-tabs-card">

      <div className="member-tabs-grid">

        {BILLING_TABS.map(
          (item) => (

            <button
              key={item.key}
              type="button"
              className={`
                member-tab-tile
                ${
                  activeTab ===
                  item.key

                    ? "is-active"

                    : ""
                }
              `}
              onClick={() =>
                onChange(
                  item.key
                )
              }
            >

              <span className="member-tab-title">

                {item.label}

              </span>

            </button>
          )
        )}

      </div>

    </section>
  );
}