
// // src/pages/DonationPage.jsx






// src/pages/DonationPage.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../components/api";
import "../styles/donation.css";

const AMOUNT_PRESETS = [25, 50, 100, 250];

const DONATION_CATEGORIES = [
  { value: "plate_collection", amharic: "መባ", english: "Plate Collection" },
  { value: "candle_sale", amharic: "ሻማ", english: "Candle Sale" },
  { value: "general_donation", amharic: "ስጦታ", english: "General Donation" },
  { value: "tithe", amharic: "አስራት", english: "Tithe" },
  { value: "vows", amharic: "ስዕለት", english: "Vows" },
  { value: "baptism", amharic: "ክርስትና", english: "Baptism" },
  {
    value: "wedding_engagement",
    amharic: "ጋብቻ / ቀለበት",
    english: "Wedding / Engagement",
  },
  {
    value: "memorial_service",
    amharic: "ፍታት",
    english: "Memorial Service",
  },
  { value: "pledge", amharic: "ቃል የተገባ", english: "Pledge" },
  {
    value: "building_fund",
    amharic: "የቤተክርስቲያን ማሰሪያ",
    english: "Building Fund",
  },
  {
    value: "charity_fund",
    amharic: "በጎ አድራጎት",
    english: "Charity Fund",
  },
  { value: "auction", amharic: "ጨረታ", english: "Auction" },
  {
    value: "other_fund",
    amharic: "ሌላ (ይገልፅ)",
    english: "Other Fund",
  },
];
function formatCurrency(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export default function DonationPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("general_donation");
  const [note, setNote] = useState("");
  const [coverFee, setCoverFee] = useState(true);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  //////////////////////////////////////////////////////
  // CALCULATIONS
  //////////////////////////////////////////////////////
  const donationAmount = customAmount
    ? Number(customAmount || 0)
    : Number(amount || 0);

  const fee = useMemo(() => {
    if (!coverFee) return 0;
    return Number(((donationAmount * 0.029 + 0.3) / (1 - 0.029)).toFixed(2));
  }, [donationAmount, coverFee]);

  const total = donationAmount + fee;

  //////////////////////////////////////////////////////
  // CATEGORY OBJECT
  //////////////////////////////////////////////////////
  const selectedCategoryObj = useMemo(() => {
    return (
      DONATION_CATEGORIES.find((c) => c.value === selectedCategory) ||
      DONATION_CATEGORIES[2]
    );
  }, [selectedCategory]);

  //////////////////////////////////////////////////////
  // SUCCESS STATE
  //////////////////////////////////////////////////////
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");

    if (status === "success") {
      setSuccessMessage("Donation completed successfully.");
      setErr("");
    }

    if (status === "cancel") {
      setSuccessMessage("Donation was cancelled.");
      setErr("");
    }
  }, []);

  //////////////////////////////////////////////////////
  // SUBMIT
  //////////////////////////////////////////////////////
  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");

    try {
      const payload = {
        kind: "donation",

        amount: donationAmount,
        quantity: 1,

        category: selectedCategoryObj.value,
        purpose: selectedCategoryObj.english,

        note,

        cover_processing_fee: coverFee,
        processing_fee: fee,

        success_url: `${window.location.origin}/donate?status=success`,
        cancel_url: `${window.location.origin}/donate?status=cancel`,
      };

      const { data } = await api.post("/checkout/create-session", payload);

      if (data?.url) {
        window.location.assign(data.url);
      } else {
        setErr("Failed to start checkout.");
      }
    } catch (err) {
      console.error(err);
      setErr("Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  //////////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////////
  return (
    <div className="donation-page-shell donation-page-wrap">

      <h1>Donate</h1>

      {err && <div className="donation-alert error">{err}</div>}
      {successMessage && <div className="donation-alert info">{successMessage}</div>}

      <form onSubmit={handleSubmit} className="donation-form">

        {/* CATEGORY */}
        <label>Donation Type</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {DONATION_CATEGORIES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.amharic} — {d.english}
            </option>
          ))}
        </select>

        {/* AMOUNT */}
        <div className="donation-amount-chips">
          {AMOUNT_PRESETS.map((amt) => (
            <button
              key={amt}
              type="button"
              className={amount === amt ? "active" : ""}
              onClick={() => {
                setAmount(amt);
                setCustomAmount("");
              }}
            >
              ${amt}
            </button>
          ))}
        </div>

        <input
          type="number"
          placeholder="Custom amount"
          value={customAmount}
          onChange={(e) => {
            setCustomAmount(e.target.value);
            setAmount("");
          }}
        />

        {/* NOTE */}
        <textarea
          placeholder="Optional note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* FEE */}
        <label>
          <input
            type="checkbox"
            checked={coverFee}
            onChange={(e) => setCoverFee(e.target.checked)}
          />
          Cover processing fee ({formatCurrency(fee)})
        </label>

        {/* SUMMARY */}
        <div className="donation-summary-box">
          <div className="donation-summary-row">
            <span>Amount</span>
            <strong>{formatCurrency(donationAmount)}</strong>
          </div>

          {coverFee && (
            <div className="donation-summary-row">
              <span>Processing Fee</span>
              <strong>{formatCurrency(fee)}</strong>
            </div>
          )}

          <div className="donation-summary-row total">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </div>

        {/* ACTION */}
        <button type="submit" disabled={busy}>
          {busy ? "Processing..." : "Continue to Stripe"}
        </button>

      </form>
    </div>
  );
}