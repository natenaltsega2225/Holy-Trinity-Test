// frontend/src/components/MembershipDashboard/components/DonationPaymentPanel.jsx

import React from "react";


import "../../../styles/membership-dashboard.css";

/* =========================================================
   CATEGORIES
========================================================= */

const DONATION_SUB_CATEGORIES = [

  {
    value:
      "plate_collection",

    amharic: "መባ",

    english:
      "Plate Collection",
  },

  {
    value:
      "candle_sale",

    amharic: "ሻማ",

    english:
      "Candle Sale",
  },

  {
    value:
      "general_donation",

    amharic: "ስጦታ",

    english:
      "General Donation",
  },

  {
    value: "tithe",

    amharic: "አስራት",

    english: "Tithe",
  },

  {
    value: "vows",

    amharic: "ስዕለት",

    english: "Vows",
  },

  {
    value: "baptism",

    amharic: "ክርስትና",

    english:
      "Baptism",
  },

  {
    value:
      "wedding_engagement",

    amharic:
      "ጋብቻ / ቀለበት",

    english:
      "Wedding / Engagement",
  },

  {
    value:
      "memorial_service",

    amharic: "ፍታት",

    english:
      "Memorial Service",
  },

  {
    value: "pledge",

    amharic:
      "ቃል የተገባ",

    english:
      "Pledge",
  },

  {
    value:
      "building_fund",

    amharic:
      "የቤተክርስቲያን ማሰሪያ",

    english:
      "Building Fund",
  },

  {
    value:
      "charity_fund",

    amharic:
      "በጎ አድራጎት",

    english:
      "Charity Fund",
  },

  {
    value: "auction",

    amharic: "ጨረታ",

    english:
      "Auction",
  },

  {
    value:
      "other_fund",

    amharic: "ሌላ",

    english:
      "Other Fund",
  },

  {
    value:
      "sunday_cash_collection",

    amharic:
      "የእሁድ ስብስብ",

    english:
      "Sunday Collection",
  },
];

/* =========================================================
   COMPONENT
========================================================= */

export default function DonationPaymentPanel({

  donationCategory,

  setDonationCategory,

  donationAmount,

  setDonationAmount,
}) {

  return (

    <div className="payx-panel">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="payx-section-head">

        <div>

          <h3 className="payx-section-title">
            Church Giving
          </h3>

          <p className="payx-section-subtitle">

            Support church ministries,
            outreach,
            memorial services,
            tithes,
            and community programs.

          </p>

        </div>

      </div>

      {/* =====================================
          CATEGORY
      ===================================== */}

      <label className="payx-field-label">
        Donation Type
      </label>

      <select
        className="payx-input"
        value={donationCategory}
        onChange={(e) =>
          setDonationCategory(
            e.target.value
          )
        }
      >

        {DONATION_SUB_CATEGORIES.map(
          (item) => (

            <option
              key={item.value}
              value={item.value}
            >

              {item.amharic}
              {" "}
              —
              {" "}
              {item.english}

            </option>
          )
        )}

      </select>

      {/* =====================================
          AMOUNT
      ===================================== */}

      <label className="payx-field-label">
        Donation Amount
      </label>

      <input
        className="payx-input"
        type="number"
        min="1"
        step="0.01"
        value={donationAmount}
        onChange={(e) =>
          setDonationAmount(
            e.target.value
          )
        }
        placeholder="Enter amount"
      />

      {/* =====================================
          QUICK AMOUNTS
      ===================================== */}

      <div className="payx-quick-grid">

        {[

          25,

          50,

          100,

          250,

          500,
        ].map((amount) => (

          <button
            key={amount}
            type="button"
            className="payx-quick-btn"
            onClick={() =>
              setDonationAmount(
                String(amount)
              )
            }
          >

            ${amount}

          </button>

        ))}

      </div>

      {/* =====================================
          GIVING INFO
      ===================================== */}

      <div className="payx-info-box">

        <div className="payx-info-row">

          <span>
            Payment Processor
          </span>

          <strong>
            Stripe Secure
          </strong>

        </div>

        <div className="payx-info-row">

          <span>
            Tax Deductible
          </span>

          <strong>
            Yes
          </strong>

        </div>

        <div className="payx-info-row">

          <span>
            Receipt Delivery
          </span>

          <strong>
            Email + PDF
          </strong>

        </div>

      </div>

    </div>
  );
}