
// frontend/src/components/MembershipDashboard/pages/Donate.jsx

import React, {
  useMemo,
  useState,
} from "react";

import api from "../../api";

import "../membership-dashboard.css";

/* =========================================================
   DONATION CATEGORIES
========================================================= */

const DONATION_CATEGORIES = [

  {
    value:
      "plate_collection",

    label:
      "መባ — Plate Collection",
  },

  {
    value:
      "candle_sale",

    label:
      "ሻማ — Candle Sale",
  },

  {
    value:
      "general_donation",

    label:
      "ስጦታ — General Donation",
  },

  {
    value:
      "tithe",

    label:
      "አስራት — Tithe",
  },

  {
    value:
      "vows",

    label:
      "ስዕለት — Vows",
  },

  {
    value:
      "baptism",

    label:
      "ክርስትና — Baptism",
  },

  {
    value:
      "wedding_engagement",

    label:
      "ጋብቻ — Wedding / Engagement",
  },

  {
    value:
      "memorial_service",

    label:
      "ፍታት — Memorial Service",
  },

  {
    value:
      "pledge",

    label:
      "ቃል የተገባ — Pledge",
  },

  {
    value:
      "building_fund",

    label:
      "ማሰሪያ — Building Fund",
  },

  {
    value:
      "charity_fund",

    label:
      "በጎ አድራጎት — Charity Fund",
  },

  {
    value:
      "auction",

    label:
      "ጨረታ — Auction",
  },

  {
    value:
      "other_fund",

    label:
      "ሌላ — Other Fund",
  },

  {
    value:
      "sunday_cash_collection",

    label:
      "እሁድ — Sunday Collection",
  },
];

/* =========================================================
   COMPONENT
========================================================= */

export default function Donate() {

  const [form, setForm] =
    useState({

      category:
        "general_donation",

      amount: "",

      note: "",
    });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =====================================================
     VALID
  ===================================================== */

  const valid =
    useMemo(() => {

      return (

        Number(
          form.amount
        ) > 0
      );

    }, [form]);

  /* =====================================================
     UPDATE
  ===================================================== */

  function update(
    key,
    value
  ) {

    setForm((s) => ({
      ...s,
      [key]: value,
    }));
  }

  /* =====================================================
     DONATE
  ===================================================== */

  async function handleDonate() {

    try {

      setLoading(true);

      setError("");

      const { data } =
        await api.post(

          "/member/donate",

          {

            amount:
              Number(
                form.amount
              ),

            category:
              "donation",

            sub_category:
              form.category,

            notes:
              form.note,
          }
        );

      if (
        data?.url
      ) {

        window.location.href =
          data.url;
      }

    } catch (err) {

      console.error(err);

      setError(

        err?.response?.data
          ?.error ||

        "Donation failed."
      );

    } finally {

      setLoading(false);
    }
  }

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="member-page">

      {/* =========================================
          HEADER
      ========================================= */}

      <div className="member-page-header">

        <div>

          <p className="member-page-eyebrow">
            Church Giving
          </p>

          <h1>
            Donate & Support
          </h1>

          <p>
            Support church ministries,
            building funds,
            charitable outreach,
            and sacred services.
          </p>

        </div>

      </div>

      {/* =========================================
          FORM
      ========================================= */}

      <div className="member-card donate-card">

        <div className="member-card-header">

          <h2>
            Donation Information
          </h2>

        </div>

        {/* CATEGORY */}

        <div className="member-form-group">

          <label>
            Donation Category
          </label>

          <select
            value={form.category}
            onChange={(e) =>
              update(
                "category",
                e.target.value
              )
            }
          >

            {DONATION_CATEGORIES.map(

              (c) => (

                <option
                  key={c.value}
                  value={c.value}
                >
                  {c.label}
                </option>

              )
            )}

          </select>

        </div>

        {/* AMOUNT */}

        <div className="member-form-group">

          <label>
            Amount
          </label>

          <input
            type="number"
            min="1"
            step="0.01"
            value={form.amount}
            onChange={(e) =>
              update(
                "amount",
                e.target.value
              )
            }
            placeholder="Enter donation amount"
          />

        </div>

        {/* NOTE */}

        <div className="member-form-group">

          <label>
            Notes
          </label>

          <textarea
            rows={4}
            value={form.note}
            onChange={(e) =>
              update(
                "note",
                e.target.value
              )
            }
            placeholder="Optional dedication, memorial note, or giving note"
          />

        </div>

        {/* ERROR */}

        {error ? (

          <div className="member-alert error">
            {error}
          </div>

        ) : null}

        {/* ACTION */}

        <div className="donate-action">

          <button
            className="member-primary-btn"
            disabled={
              !valid || loading
            }
            onClick={
              handleDonate
            }
          >

            {loading
              ? "Redirecting..."
              : "Continue to Secure Payment"}

          </button>

        </div>

      </div>

    </div>
  );
}
