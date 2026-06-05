

// frontend/src/pages/Membership.jsx


import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../components/api";
import "../styles/public-membership.css";

const DONATION_CATEGORIES = [
  { value: "plate_collection", label: "መባ — Plate Collection" },
  { value: "candle_sale", label: "ሻማ — Candle Sale" },
  { value: "general_donation", label: "ስጦታ — General Donation" },
  { value: "tithe", label: "አስራት — Tithe" },
  { value: "vows", label: "ስዕለት — Vows" },
  { value: "baptism", label: "ክርስትና — Baptism" },
  { value: "wedding_engagement", label: "ጋብቻ — Wedding" },
  { value: "memorial_service", label: "ፍታት — Memorial" },
  { value: "pledge", label: "Pledge" },
  { value: "building_fund", label: "Building Fund" },
  { value: "charity_fund", label: "Charity Fund" },
  { value: "auction", label: "Auction" },
  { value: "other_fund", label: "Other" },
];

const money = (v) => `$${Number(v || 0).toFixed(2)}`;

export default function Membership() {
  const navigate = useNavigate();

  const [type, setType] = useState("membership");

  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [donationType, setDonationType] =
    useState("general_donation");

  const [donationAmount, setDonationAmount] =
    useState(50);

  const [loading, setLoading] = useState(true);

  //////////////////////////////////////////////////////
  // LOAD
  //////////////////////////////////////////////////////

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const res = await api.get("/dues/plans");

        if (!mounted) return;

        const rows = res.data?.rows || [];

        setPlans(rows);

        if (rows.length) {
          setSelectedPlan(rows[0]);
        }

      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  //////////////////////////////////////////////////////
  // TOTAL
  //////////////////////////////////////////////////////

  const total = useMemo(() => {

    if (type === "membership") {
      return Number(
        selectedPlan?.minimum_amount ||
        selectedPlan?.amount ||
        0
      );
    }

    if (type === "donation") {
      return Number(donationAmount || 0);
    }

    return 0;

  }, [
    type,
    selectedPlan,
    donationAmount,
  ]);

  //////////////////////////////////////////////////////
  // CONTINUE
  //////////////////////////////////////////////////////

 function handleContinue() {

  ////////////////////////////////////////////////
  // MEMBERSHIP
  ////////////////////////////////////////////////

  if (type === "membership") {

    if (!selectedPlan?.id) {
      alert("Please select a membership plan.");
      return;
    }

    navigate("/login", {
      state: {
        paymentType: "membership",

        selectedPlan: {
          id: selectedPlan.id,
          plan_name: selectedPlan.plan_name,

          amount:
            selectedPlan.minimum_amount ||
            selectedPlan.amount,

          months:
            selectedPlan.duration_months,
        },
      },
    });

    return;
  }

  ////////////////////////////////////////////////
  // DONATION
  ////////////////////////////////////////////////

  if (type === "donation") {

    navigate("/login", {
      state: {
        paymentType: "donation",

        donation: {
          category: donationType,

          amount: Number(
            donationAmount || 0
          ),
        },
      },
    });

    return;
  }
}
  

  if (loading) {
    return (
      <div className="pay-loading">
        Loading...
      </div>
    );
  }

  //////////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////////

  return (
    <section className="pay-page">

      <div className="pay-container">

        <h1 className="payments-title">
          Payments & Registration
        </h1>

        <p className="payments-subtitle">
          Membership dues and donations —
          secure and simple.
        </p>

        {/* TABS */}

        <div className="pay-tabs">

          <button
            className={
              type === "membership"
                ? "active"
                : ""
            }
            onClick={() =>
              setType("membership")
            }
          >
            membership
          </button>

          <button
            className={
              type === "donation"
                ? "active"
                : ""
            }
            onClick={() =>
              setType("donation")
            }
          >
            donation
          </button>

        </div>

        <div className="pay-layout">

          {/* LEFT */}

          <div className="pay-left">

            {/* MEMBERSHIP */}

            {type === "membership" && (

              <div className="pay-grid">

                {plans.map((p) => (

                  <div
                    key={p.id}
                    className={`pay-card ${
                      selectedPlan?.id === p.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedPlan(p)
                    }
                  >
                    <h3>
                      {p.plan_name}
                    </h3>

                    <p>
                      {p.duration_months} month
                      {Number(p.duration_months) > 1
                        ? "s"
                        : ""}
                    </p>

                    <strong>
                      {money(
                        p.minimum_amount
                      )}
                    </strong>
                  </div>

                ))}

              </div>
            )}

            {/* DONATION */}

            {type === "donation" && (

              <div className="pay-donation">

                <select
                  className="pay-input"
                  value={donationType}
                  onChange={(e) =>
                    setDonationType(
                      e.target.value
                    )
                  }
                >
                  {DONATION_CATEGORIES.map((d) => (
                    <option
                      key={d.value}
                      value={d.value}
                    >
                      {d.label}
                    </option>
                  ))}
                </select>

                <input
                  className="pay-input"
                  type="number"
                  min="1"
                  value={donationAmount}
                  onChange={(e) =>
                    setDonationAmount(
                      e.target.value
                    )
                  }
                />

              </div>
            )}

          </div>

          {/* RIGHT */}

          <div className="pay-summary">

            <h3>
              Summary
            </h3>

            <div className="pay-row">
              <span>Type</span>

              <strong>
                {type}
              </strong>
            </div>

            {type === "membership" &&
              selectedPlan && (
              <div className="pay-row">
                <span>Plan</span>

                <strong>
                  {selectedPlan.plan_name}
                </strong>
              </div>
            )}

            {type === "donation" && (
              <div className="pay-row">
                <span>Category</span>

                <strong>
                  {donationType.replaceAll("_", " ")}
                </strong>
              </div>
            )}

            <div className="pay-row total">
              <span>Total</span>

              <strong>
                {money(total)}
              </strong>
            </div>

            <button
              className="pay-btn"
              onClick={handleContinue}
            >
              Continue
            </button>

          </div>

        </div>

      </div>

    </section>
  );
}


