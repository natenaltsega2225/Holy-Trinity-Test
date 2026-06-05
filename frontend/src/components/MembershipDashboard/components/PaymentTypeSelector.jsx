// frontend/src/components/MembershipDashboard/components/PaymentTypeSelector.jsx

import React from "react";

import "../../../styles/membership-dashboard.css";

/* =========================================================
   TYPES
========================================================= */

const PAYMENT_TYPES = [

  {
    key: "membership",

    label:
      "Membership",
  },

  {
    key: "school",

    label:
      "Kids School",
  },

  {
    key: "trip",

    label:
      "Trip",
  },

  {
    key: "donation",

    label:
      "Donation",
  },
];

/* =========================================================
   COMPONENT
========================================================= */

export default function PaymentTypeSelector({

  selectedType,

  onChange,
}) {

  return (

    <div className="payx-frequency-tabs">

      {PAYMENT_TYPES.map(
        (type) => (

          <button
            key={type.key}
            type="button"
            className={`
              payx-frequency-tab
              ${
                selectedType ===
                type.key

                  ? "is-active"

                  : ""
              }
            `}
            onClick={() =>
              onChange(
                type.key
              )
            }
          >

            {type.label}

          </button>
        )
      )}

    </div>
  );
}