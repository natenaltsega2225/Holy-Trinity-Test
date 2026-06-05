

// // // src/components/Checkout.jsx


// import React, { useEffect, useMemo, useState } from "react";
// import { useNavigate, useLocation } from "react-router-dom";
// import api from "./api";
// import { useAuth } from "../hooks/useAuth";
// import "../styles/checkout.css";

// const FINANCE_CATEGORIES = [
//   { value: "plate_collection", label: "መባ — Plate Collection" },
//   { value: "candle_sale", label: "ሻማ — Candle Sale" },
//   { value: "general_donation", label: "ስጦታ — General Donation" },
//   { value: "tithe", label: "አስራት — Tithe" },
//   { value: "vows", label: "ስዕለት — Vows" },
//   { value: "baptism", label: "ክርስትና — Baptism" },
//   { value: "wedding_engagement", label: "ጋብቻ / ቀለበት — Wedding / Engagement" },
//   { value: "memorial_service", label: "ፍታት — Memorial Service" },
//   { value: "pledge", label: "ቃል የተገባ — Pledge" },
//   { value: "building_fund", label: "የቤተክርስቲያን ማሰሪያ — Building Fund" },
//   { value: "charity_fund", label: "በጎ አድራጎት — Charity Fund" },
//   { value: "auction", label: "ጨረታ — Auction" },
//   { value: "other_fund", label: "ሌላ — Other Fund" },
//   { value: "sunday_cash_collection", label: "የእሁድ ስብስብ — Sunday Collection" },
// ];

// const SUPPORTED_MODES = ["membership", "donation", "school", "trip"];

// function money(value) {
//   const n = Number(value || 0);

//   return `$${n.toLocaleString("en-US", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;
// }

// function normalizeMode(value) {
//   const raw = String(value || "membership").toLowerCase();

//   if (["kids", "kids_school", "school_program"].includes(raw)) {
//     return "school";
//   }

//   if (SUPPORTED_MODES.includes(raw)) {
//     return raw;
//   }

//   return "membership";
// }

// function clean(value, fallback = "") {
//   return String(value ?? fallback).trim();
// }

// function dateOnly(value) {
//   const d = value instanceof Date ? value : new Date(value);

//   if (Number.isNaN(d.getTime())) return "";

//   return d.toISOString().slice(0, 10);
// }

// function addMonths(value, months) {
//   const d = value ? new Date(value) : new Date();

//   if (Number.isNaN(d.getTime())) return new Date();

//   const copy = new Date(d);
//   copy.setMonth(copy.getMonth() + Number(months || 1));

//   return copy;
// }

// function formatMonthYear(value) {
//   const d = value instanceof Date ? value : new Date(value);

//   if (Number.isNaN(d.getTime())) return "";

//   return d.toLocaleDateString("en-US", {
//     month: "short",
//     year: "numeric",
//   });
// }

// function buildCoverage(durationMonths) {
//   const months = Math.max(1, Number(durationMonths || 1));
//   const start = new Date();
//   start.setHours(0, 0, 0, 0);

//   const end = addMonths(start, months);

//   const coverageMonths = [];
//   const current = new Date(start.getFullYear(), start.getMonth(), 1);
//   const last = new Date(end.getFullYear(), end.getMonth() - 1, 1);

//   while (current <= last) {
//     coverageMonths.push(
//       current.toLocaleDateString("en-US", {
//         month: "long",
//         year: "numeric",
//       })
//     );

//     current.setMonth(current.getMonth() + 1);
//   }

//   return {
//     months,
//     coverage_start: dateOnly(start),
//     coverage_end: dateOnly(end),
//     coverage_label: `${formatMonthYear(start)} - ${formatMonthYear(end)}`,
//     coverageMonths,
//   };
// }

// function getCategoryLabel(value) {
//   return (
//     FINANCE_CATEGORIES.find((item) => item.value === value)?.label ||
//     clean(value).replaceAll("_", " ")
//   );
// }

// function checkoutUrlFromResponse(data) {
//   return (
//     data?.url ||
//     data?.checkout_url ||
//     data?.checkoutUrl ||
//     data?.session_url ||
//     data?.sessionUrl ||
//     ""
//   );
// }

// function inferProgram(state = {}) {
//   return {
//     program_id:
//       state.program_id ||
//       state.news_event_id ||
//       state.related_entity_id ||
//       "",

//     news_event_id:
//       state.news_event_id ||
//       state.program_id ||
//       state.related_entity_id ||
//       "",

//     program_name:
//       state.program_name ||
//       state.title ||
//       state.event_title ||
//       state.name ||
//       "",

//     category:
//       state.category ||
//       state.event_category ||
//       "",

//     unit_price:
//       Number(
//         state.unit_price ||
//           state.price ||
//           state.amount ||
//           state.registration_fee ||
//           0
//       ),

//     quantity: Math.max(1, Number(state.quantity || state.participants || 1)),
//   };
// }

// export default function Checkout() {
//   const nav = useNavigate();
//   const location = useLocation();
//   const { isAuthed, user } = useAuth();

//   const checkoutState = location.state || {};

//   const initialMode = normalizeMode(
//     checkoutState.type ||
//       checkoutState.paymentType ||
//       checkoutState.kind ||
//       "membership"
//   );

//   const initialProgram = inferProgram(checkoutState);

//   const [mode, setMode] = useState(initialMode);
//   const [plans, setPlans] = useState([]);
//   const [selectedPlan, setSelectedPlan] = useState(null);

//   const [donationAmount, setDonationAmount] = useState(
//     Number(checkoutState.amount || 50)
//   );

//   const [donationCategory, setDonationCategory] = useState(
//     checkoutState.category ||
//       checkoutState.donation_category ||
//       "general_donation"
//   );

//   const [programName, setProgramName] = useState(initialProgram.program_name);
//   const [programId, setProgramId] = useState(initialProgram.program_id);
//   const [newsEventId, setNewsEventId] = useState(initialProgram.news_event_id);
//   const [programQuantity, setProgramQuantity] = useState(initialProgram.quantity);
//   const [programUnitPrice, setProgramUnitPrice] = useState(
//     initialProgram.unit_price
//   );

//   const [coverFee, setCoverFee] = useState(false);
//   const [autoRenew, setAutoRenew] = useState(false);

//   const [loading, setLoading] = useState(true);
//   const [busy, setBusy] = useState(false);
//   const [error, setError] = useState("");

//   useEffect(() => {
//     if (mode === "membership" && !isAuthed) {
//       nav("/login", {
//         replace: true,
//         state: {
//           message: "Please sign in to continue membership payment.",
//           redirectTo: "/dash/membership/my-payments/make-payment",
//           paymentType: "membership",
//           type: "membership",
//           checkoutState,
//         },
//       });
//     }
//   }, [mode, isAuthed, nav, checkoutState]);

//   useEffect(() => {
//     let mounted = true;

//     async function loadPlans() {
//       try {
//         setLoading(true);
//         setError("");

//         const res = await api.get("/dues/plans");

//         if (!mounted) return;

//         const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];

//         setPlans(rows);

//         const selected =
//           rows.find((p) => Number(p.id) === Number(checkoutState.plan_id)) ||
//           rows.find((p) => Number(p.id) === Number(checkoutState.dues_plan_id)) ||
//           rows[0] ||
//           null;

//         setSelectedPlan(selected);
//       } catch (err) {
//         console.error(err);

//         if (mode === "membership") {
//           setError("Failed to load membership plans.");
//         }
//       } finally {
//         if (mounted) setLoading(false);
//       }
//     }

//     loadPlans();

//     return () => {
//       mounted = false;
//     };
//   }, [checkoutState.plan_id, checkoutState.dues_plan_id, mode]);

//   const selectedPlanMonths = useMemo(() => {
//     return Math.max(
//       1,
//       Number(
//         selectedPlan?.duration_months ||
//           selectedPlan?.months_paid ||
//           selectedPlan?.interval_count ||
//           1
//       )
//     );
//   }, [selectedPlan]);

//   const membershipCoverage = useMemo(() => {
//     return buildCoverage(selectedPlanMonths);
//   }, [selectedPlanMonths]);

//   const baseAmount = useMemo(() => {
//     if (mode === "membership") {
//       return Number(
//         selectedPlan?.minimum_amount ||
//           selectedPlan?.amount ||
//           selectedPlan?.price ||
//           0
//       );
//     }

//     if (mode === "donation") {
//       return Number(donationAmount || 0);
//     }

//     if (mode === "school" || mode === "trip") {
//       return Number(programUnitPrice || 0) * Math.max(1, Number(programQuantity || 1));
//     }

//     return 0;
//   }, [
//     mode,
//     selectedPlan,
//     donationAmount,
//     programUnitPrice,
//     programQuantity,
//   ]);

//   const processingFee = useMemo(() => {
//     if (!coverFee || baseAmount <= 0) return 0;

//     return Number(((baseAmount * 0.029 + 0.3) / (1 - 0.029)).toFixed(2));
//   }, [baseAmount, coverFee]);

//   const total = Number((baseAmount + processingFee).toFixed(2));

//   const modeLabel = useMemo(() => {
//     if (mode === "membership") return "Membership";
//     if (mode === "donation") return "Donation";
//     if (mode === "school") return "Kids School Program";
//     if (mode === "trip") return "Trip Program";
//     return "Payment";
//   }, [mode]);

//   function validate() {
//     if (mode === "membership") {
//       if (!isAuthed) {
//         return "Please sign in before paying membership dues.";
//       }

//       if (!selectedPlan?.id) {
//         return "Please select a membership plan.";
//       }
//     }

//     if (mode === "donation") {
//       if (!donationCategory) {
//         return "Please select a donation category.";
//       }

//       if (Number(donationAmount || 0) <= 0) {
//         return "Please enter a valid donation amount.";
//       }
//     }

//     if (mode === "school" || mode === "trip") {
//       if (!programName) {
//         return "Program name is missing.";
//       }

//       if (Number(programUnitPrice || 0) <= 0) {
//         return "Program price is missing.";
//       }

//       if (Number(programQuantity || 0) <= 0) {
//         return "Please enter a valid participant quantity.";
//       }
//     }

//     if (total <= 0) {
//       return "Payment amount must be greater than zero.";
//     }

//     return "";
//   }

//   function buildPayload() {
//     const successUrl =
//       mode === "membership"
//         ? `${window.location.origin}/dash/membership/my-payments/history?status=success&session_id={CHECKOUT_SESSION_ID}`
//         : mode === "donation"
//         ? `${window.location.origin}/payment-success?type=donation&session_id={CHECKOUT_SESSION_ID}`
//         : `${window.location.origin}/payment-success?type=${mode}&session_id={CHECKOUT_SESSION_ID}`;

//     const cancelUrl =
//       mode === "membership"
//         ? `${window.location.origin}/dash/membership/my-payments/make-payment?status=cancel&type=membership`
//         : mode === "donation"
//         ? `${window.location.origin}/donate?status=cancel`
//         : `${window.location.origin}/events/${encodeURIComponent(
//             programId || newsEventId || ""
//           )}?status=cancel&type=${mode}`;

//     if (mode === "membership") {
//       return {
//         kind: "membership",
//         type: "membership",
//         payment_type: "membership",

//         plan_id: selectedPlan.id,
//         dues_plan_id: selectedPlan.id,
//         plan_name: selectedPlan.plan_name,
//         plan_type: selectedPlan.billing_cycle || selectedPlan.plan_type || "",
//         selected_option: selectedPlan.billing_cycle || selectedPlan.plan_type || "",

//         amount: total,
//         total_amount: total,
//         quantity: 1,

//         duration_months: membershipCoverage.months,
//         months_paid: membershipCoverage.months,
//         interval_count: membershipCoverage.months,
//         interval_unit: "month",

//         coverage_start: membershipCoverage.coverage_start,
//         coverage_end: membershipCoverage.coverage_end,
//         coverage_label: membershipCoverage.coverage_label,

//         sub_category: selectedPlan.plan_name || "Membership Dues",

//         auto_renew: autoRenew,
//         auto_payment_enabled: autoRenew,

//         cover_processing_fee: coverFee,
//         processing_fee: processingFee,

//         method: "card",
//         provider: "stripe",

//         note: `Membership payment: ${
//           selectedPlan.plan_name || "Membership"
//         } (${membershipCoverage.coverage_label})`,

//         success_url: successUrl,
//         cancel_url: cancelUrl,
//       };
//     }

//     if (mode === "donation") {
//       return {
//         kind: "donation",
//         type: "donation",
//         payment_type: "donation",

//         category: "donation",
//         sub_category: donationCategory,
//         donation_category: donationCategory,

//         amount: total,
//         total_amount: total,
//         quantity: 1,

//         cover_processing_fee: coverFee,
//         processing_fee: processingFee,

//         method: "card",
//         provider: "stripe",

//         note: `Donation: ${getCategoryLabel(donationCategory)}`,

//         success_url: successUrl,
//         cancel_url: cancelUrl,
//       };
//     }

//     return {
//       kind: mode,
//       type: mode,
//       payment_type: mode,

//       category: mode,
//       sub_category: programName,
//       program_name: programName,

//       amount: total,
//       total_amount: total,
//       quantity: Math.max(1, Number(programQuantity || 1)),
//       unit_price: Number(programUnitPrice || 0),

//       program_id: programId || newsEventId || "",
//       news_event_id: newsEventId || programId || "",
//       related_entity_id: programId || newsEventId || "",
//       related_entity_type: "news_event",

//       cover_processing_fee: coverFee,
//       processing_fee: processingFee,

//       method: "card",
//       provider: "stripe",

//       note: `${modeLabel}: ${programName}`,

//       success_url: successUrl,
//       cancel_url: cancelUrl,
//     };
//   }

//   async function handleCheckout() {
//     try {
//       setBusy(true);
//       setError("");

//       const validationError = validate();

//       if (validationError) {
//         throw new Error(validationError);
//       }

//       const { data } = await api.post("/checkout/create-session", buildPayload());

//       const url = checkoutUrlFromResponse(data);

//       if (!url) {
//         throw new Error("Stripe checkout URL was not returned.");
//       }

//       window.location.assign(url);
//     } catch (err) {
//       console.error(err);

//       setError(
//         err?.response?.data?.error ||
//           err?.message ||
//           "Checkout failed."
//       );

//       setBusy(false);
//     }
//   }

//   if (loading && mode === "membership") {
//     return <div className="ck-loading">Loading secure checkout...</div>;
//   }

//   return (
//     <div className="ck-page">
//       <div className="ck-header">
//         <div>
//           <p className="ck-eyebrow">SECURE PAYMENT</p>
//           <h1>Checkout</h1>
//           <p className="ck-subtitle">
//             Welcome <strong>{user?.username || user?.email || "Guest"}</strong>
//           </p>
//         </div>
//       </div>

//       {error ? <div className="ck-error">{error}</div> : null}

//       <div className="ck-tabs">
//         {isAuthed ? (
//           <button
//             type="button"
//             className={mode === "membership" ? "active" : ""}
//             onClick={() => setMode("membership")}
//           >
//             Membership
//           </button>
//         ) : null}

//         <button
//           type="button"
//           className={mode === "donation" ? "active" : ""}
//           onClick={() => setMode("donation")}
//         >
//           Donation
//         </button>

//         <button
//           type="button"
//           className={mode === "school" ? "active" : ""}
//           onClick={() => setMode("school")}
//         >
//           School
//         </button>

//         <button
//           type="button"
//           className={mode === "trip" ? "active" : ""}
//           onClick={() => setMode("trip")}
//         >
//           Trip
//         </button>
//       </div>

//       <div className="ck-layout">
//         <div className="ck-left">
//           {mode === "membership" ? (
//             <div className="ck-section">
//               <div className="ck-section-head">
//                 <h2>Select Membership Plan</h2>
//                 <p>Choose your membership contribution plan and coverage period.</p>
//               </div>

//               <div className="ck-card-grid">
//                 {plans.map((p) => {
//                   const months = Number(p.duration_months || 1);
//                   const active = Number(selectedPlan?.id) === Number(p.id);

//                   return (
//                     <button
//                       key={p.id}
//                       type="button"
//                       className={`ck-plan-card ${active ? "active" : ""}`}
//                       onClick={() => setSelectedPlan(p)}
//                     >
//                       <div className="ck-plan-name">{p.plan_name}</div>
//                       <div className="ck-plan-price">
//                         {money(p.minimum_amount || p.amount)}
//                       </div>
//                       <div className="ck-plan-meta">
//                         Covers <strong>{months}</strong> month
//                         {months > 1 ? "s" : ""}
//                       </div>
//                     </button>
//                   );
//                 })}
//               </div>

//               <div className="ck-coverage-card">
//                 <h3>Coverage Preview</h3>
//                 <p>
//                   {membershipCoverage.months} Month
//                   {membershipCoverage.months > 1 ? "s" : ""} —{" "}
//                   <strong>{membershipCoverage.coverage_label}</strong>
//                 </p>

//                 <div className="ck-coverage-list">
//                   {membershipCoverage.coverageMonths.map((month) => (
//                     <span key={month}>✓ {month}</span>
//                   ))}
//                 </div>
//               </div>

//               <label className="ck-check">
//                 <input
//                   type="checkbox"
//                   checked={autoRenew}
//                   onChange={(e) => setAutoRenew(e.target.checked)}
//                 />
//                 Enable recurring automatic payment
//               </label>
//             </div>
//           ) : null}

//           {mode === "donation" ? (
//             <div className="ck-section">
//               <div className="ck-section-head">
//                 <h2>Donation</h2>
//                 <p>Support church ministries and community programs.</p>
//               </div>

//               <div className="ck-donation-grid">
//                 <div className="ck-field">
//                   <label>Donation Category</label>
//                   <select
//                     value={donationCategory}
//                     onChange={(e) => setDonationCategory(e.target.value)}
//                   >
//                     {FINANCE_CATEGORIES.map((category) => (
//                       <option key={category.value} value={category.value}>
//                         {category.label}
//                       </option>
//                     ))}
//                   </select>
//                 </div>

//                 <div className="ck-field">
//                   <label>Amount</label>
//                   <input
//                     type="number"
//                     min="1"
//                     step="0.01"
//                     value={donationAmount}
//                     onChange={(e) => setDonationAmount(e.target.value)}
//                   />
//                 </div>
//               </div>
//             </div>
//           ) : null}

//           {mode === "school" || mode === "trip" ? (
//             <div className="ck-section">
//               <div className="ck-section-head">
//                 <h2>{mode === "school" ? "Kids School Program" : "Trip Program"}</h2>
//                 <p>Confirm registration details before secure payment.</p>
//               </div>

//               <div className="ck-donation-grid">
//                 <div className="ck-field">
//                   <label>Program Name</label>
//                   <input
//                     value={programName}
//                     onChange={(e) => setProgramName(e.target.value)}
//                     placeholder="Program name"
//                   />
//                 </div>

//                 <div className="ck-field">
//                   <label>Participants</label>
//                   <input
//                     type="number"
//                     min="1"
//                     value={programQuantity}
//                     onChange={(e) => setProgramQuantity(e.target.value)}
//                   />
//                 </div>

//                 <div className="ck-field">
//                   <label>Price Per Person</label>
//                   <input
//                     type="number"
//                     min="1"
//                     step="0.01"
//                     value={programUnitPrice}
//                     onChange={(e) => setProgramUnitPrice(e.target.value)}
//                   />
//                 </div>
//               </div>
//             </div>
//           ) : null}

//           <label className="ck-check">
//             <input
//               type="checkbox"
//               checked={coverFee}
//               onChange={(e) => setCoverFee(e.target.checked)}
//             />
//             Cover payment processing fee
//           </label>
//         </div>

//         <div className="ck-right">
//           <div className="ck-summary-card">
//             <h3>Payment Summary</h3>

//             <div className="ck-summary-row">
//               <span>Payment Type</span>
//               <strong>{modeLabel}</strong>
//             </div>

//             {mode === "membership" && selectedPlan ? (
//               <>
//                 <div className="ck-summary-row">
//                   <span>Plan</span>
//                   <strong>{selectedPlan.plan_name}</strong>
//                 </div>

//                 <div className="ck-summary-row">
//                   <span>Coverage</span>
//                   <strong>{membershipCoverage.coverage_label}</strong>
//                 </div>

//                 <div className="ck-summary-row">
//                   <span>Months Paid</span>
//                   <strong>{membershipCoverage.months}</strong>
//                 </div>

//                 <div className="ck-summary-row">
//                   <span>Auto Renew</span>
//                   <strong>{autoRenew ? "Enabled" : "No"}</strong>
//                 </div>
//               </>
//             ) : null}

//             {mode === "donation" ? (
//               <div className="ck-summary-row">
//                 <span>Category</span>
//                 <strong>{getCategoryLabel(donationCategory)}</strong>
//               </div>
//             ) : null}

//             {mode === "school" || mode === "trip" ? (
//               <>
//                 <div className="ck-summary-row">
//                   <span>Program</span>
//                   <strong>{programName || "--"}</strong>
//                 </div>

//                 <div className="ck-summary-row">
//                   <span>Participants</span>
//                   <strong>{programQuantity}</strong>
//                 </div>

//                 <div className="ck-summary-row">
//                   <span>Price / Person</span>
//                   <strong>{money(programUnitPrice)}</strong>
//                 </div>
//               </>
//             ) : null}

//             <div className="ck-summary-row">
//               <span>Subtotal</span>
//               <strong>{money(baseAmount)}</strong>
//             </div>

//             {coverFee ? (
//               <div className="ck-summary-row">
//                 <span>Processing Fee</span>
//                 <strong>{money(processingFee)}</strong>
//               </div>
//             ) : null}

//             <div className="ck-total">
//               <span>Total</span>
//               <strong>{money(total)}</strong>
//             </div>

//             <button
//               type="button"
//               className="ck-btn"
//               onClick={handleCheckout}
//               disabled={busy || total <= 0}
//             >
//               {busy ? "Processing..." : "Continue to Secure Payment"}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// src/components/Checkout.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useLocation,
} from "react-router-dom";

import api from "./api";

import { useAuth } from "../hooks/useAuth";

import "../styles/checkout.css";

/* =========================================================
   CONSTANTS
========================================================= */

const DONATION_CATEGORIES = [
  { value: "plate_collection", label: "መባ — Plate Collection" },
  { value: "candle_sale", label: "ሻማ — Candle Sale" },
  { value: "general_donation", label: "ስጦታ — General Donation" },
  { value: "tithe", label: "አስራት — Tithe" },
  { value: "vows", label: "ስዕለት — Vows" },
  { value: "baptism", label: "ክርስትና — Baptism" },
  { value: "wedding_engagement", label: "ጋብቻ — Wedding / Engagement" },
  { value: "memorial_service", label: "ፍታት — Memorial Service" },
  { value: "building_fund", label: "Building Fund" },
  { value: "charity_fund", label: "Charity Fund" },
  { value: "auction", label: "Auction" },
];

const MODES = [
  "membership",
  "donation",
  "school",
  "trip",
  "pledge",
];

/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  return `$${Number(value || 0).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function clean(v, fallback = "") {
  return String(v ?? fallback).trim();
}

function normalizeMode(value) {
  const raw = clean(value).toLowerCase();

  if (
    [
      "kids",
      "kids_school",
      "school_program",
    ].includes(raw)
  ) {
    return "school";
  }

  if (MODES.includes(raw)) {
    return raw;
  }

  return "membership";
}

function buildCoverage(months) {
  const totalMonths = Math.max(
    1,
    Number(months || 1)
  );

  const start = new Date();

  const end = new Date(start);
  end.setMonth(
    end.getMonth() + totalMonths
  );

  const label = `${start.toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "numeric",
    }
  )} - ${end.toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "numeric",
    }
  )}`;

  return {
    months: totalMonths,
    label,
  };
}

function categoryLabel(value) {
  return (
    DONATION_CATEGORIES.find(
      (x) => x.value === value
    )?.label ||
    clean(value)
  );
}

function sessionUrl(data) {
  return (
    data?.url ||
    data?.checkout_url ||
    data?.checkoutUrl ||
    ""
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Checkout() {
  const nav = useNavigate();
  const location = useLocation();

  const { user, isAuthed } =
    useAuth();

  const state = location.state || {};

  const initialMode = normalizeMode(
    state.type ||
      state.paymentType ||
      "membership"
  );

  const [mode, setMode] =
    useState(initialMode);

  const [plans, setPlans] =
    useState([]);

  const [selectedPlan,
    setSelectedPlan] =
      useState(null);

  const [donationCategory,
    setDonationCategory] =
      useState(
        state.donation_category ||
          "general_donation"
      );

  const [donationAmount,
    setDonationAmount] =
      useState(
        Number(
          state.amount || 50
        )
      );

  const [programName,
    setProgramName] =
      useState(
        state.program_name ||
          state.title ||
          ""
      );

  const [programId,
    setProgramId] =
      useState(
        state.program_id ||
          state.news_event_id ||
          ""
      );

  const [programQuantity,
    setProgramQuantity] =
      useState(
        Number(
          state.quantity || 1
        )
      );

  const [programPrice,
    setProgramPrice] =
      useState(
        Number(
          state.price ||
            state.unit_price ||
            0
        )
      );

  const [pledgeAmount,
    setPledgeAmount] =
      useState(
        Number(
          state.pledged_amount ||
            100
        )
      );

  const [pledgePayNow,
    setPledgePayNow] =
      useState(
        Number(
          state.upfront_amount ||
            25
        )
      );

  const [coverFee,
    setCoverFee] =
      useState(false);

  const [autoRenew,
    setAutoRenew] =
      useState(false);

  const [recurringDonation,
    setRecurringDonation] =
      useState(false);

  const [recurringFrequency,
    setRecurringFrequency] =
      useState("monthly");

  const [loading,
    setLoading] =
      useState(true);

  const [busy,
    setBusy] =
      useState(false);

  const [error,
    setError] =
      useState("");

  /* =====================================================
     MEMBERSHIP AUTH
  ===================================================== */

  useEffect(() => {
    if (
      mode === "membership" &&
      !isAuthed
    ) {
      nav("/login", {
        replace: true,
        state: {
          redirectTo:
            "/checkout",
          type: "membership",
        },
      });
    }
  }, [
    mode,
    isAuthed,
    nav,
  ]);

  /* =====================================================
     LOAD PLANS
  ===================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadPlans() {
      try {
        setLoading(true);

        const res =
          await api.get(
            "/dues/plans"
          );

        if (!mounted) return;

        const rows =
          res.data?.rows || [];

        setPlans(rows);

        setSelectedPlan(
          rows[0] || null
        );
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPlans();

    return () => {
      mounted = false;
    };
  }, []);

  /* =====================================================
     MEMBERSHIP
  ===================================================== */

  const membershipCoverage =
    useMemo(() => {
      return buildCoverage(
        selectedPlan?.duration_months
      );
    }, [selectedPlan]);

  /* =====================================================
     AMOUNTS
  ===================================================== */

  const subtotal =
    useMemo(() => {

      if (
        mode ===
        "membership"
      ) {

        return Number(
          selectedPlan?.minimum_amount ||
            0
        );
      }

      if (
        mode ===
        "donation"
      ) {

        return Number(
          donationAmount || 0
        );
      }

      if (
        mode === "school" ||
        mode === "trip"
      ) {

        return (
          Number(
            programPrice || 0
          ) *
          Number(
            programQuantity || 1
          )
        );
      }

      if (
        mode === "pledge"
      ) {

        return Number(
          pledgePayNow || 0
        );
      }

      return 0;

    }, [
      mode,
      selectedPlan,
      donationAmount,
      programPrice,
      programQuantity,
      pledgePayNow,
    ]);

  const processingFee =
    useMemo(() => {

      if (
        !coverFee ||
        subtotal <= 0
      ) {
        return 0;
      }

      return Number(
        (
          subtotal * 0.029 +
          0.3
        ).toFixed(2)
      );

    }, [
      subtotal,
      coverFee,
    ]);

  const total =
    Number(
      (
        subtotal +
        processingFee
      ).toFixed(2)
    );

  /* =====================================================
     VALIDATION
  ===================================================== */

  function validate() {

    if (
      mode ===
        "membership" &&
      !selectedPlan
    ) {

      return "Please select membership plan.";
    }

    if (
      mode ===
        "donation" &&
      donationAmount <= 0
    ) {

      return "Invalid donation amount.";
    }

    if (
      ["school", "trip"].includes(
        mode
      )
    ) {

      if (!programName) {
        return "Program name required.";
      }

      if (
        Number(programPrice) <=
        0
      ) {

        return "Program price required.";
      }
    }

    if (
      mode ===
        "pledge" &&
      pledgePayNow <= 0
    ) {

      return "Pledge upfront amount required.";
    }

    return "";
  }

  /* =====================================================
     PAYLOAD
  ===================================================== */

  function buildPayload() {

    const successUrl = `${window.location.origin}/payment-success?type=${mode}&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl = `${window.location.origin}/checkout?status=cancel&type=${mode}`;

    /* MEMBERSHIP */

    if (
      mode ===
      "membership"
    ) {

      return {

        type: "membership",
        payment_type:
          "membership",

        plan_id:
          selectedPlan.id,

        dues_plan_id:
          selectedPlan.id,

        plan_name:
          selectedPlan.plan_name,

        duration_months:
          membershipCoverage.months,

        months_paid:
          membershipCoverage.months,

        amount: total,

        auto_renew:
          autoRenew,

        recurring_frequency:
          "monthly",

        success_url:
          successUrl,

        cancel_url:
          cancelUrl,

        note: `Membership payment (${membershipCoverage.label})`,
      };
    }

    /* DONATION */

    if (
      mode ===
      "donation"
    ) {

      return {

        type: "donation",

        payment_type:
          "donation",

        donation_category:
          donationCategory,

        sub_category:
          donationCategory,

        amount: total,

        is_recurring:
          recurringDonation,

        recurring_frequency:
          recurringFrequency,

        success_url:
          successUrl,

        cancel_url:
          cancelUrl,

        note: `Donation: ${categoryLabel(
          donationCategory
        )}`,
      };
    }

    /* PROGRAM */

    if (
      ["school", "trip"].includes(
        mode
      )
    ) {

      return {

        type: mode,

        payment_type:
          mode,

        category: mode,

        program_name:
          programName,

        program_title:
          programName,

        related_entity_id:
          programId,

        news_event_id:
          programId,

        quantity:
          programQuantity,

        unit_price:
          programPrice,

        amount: total,

        success_url:
          successUrl,

        cancel_url:
          cancelUrl,

        note: `${mode} registration payment`,
      };
    }

    /* PLEDGE */

    return {

      type: "pledge",

      payment_type:
        "pledge",

      pledged_amount:
        pledgeAmount,

      upfront_amount:
        pledgePayNow,

      amount: total,

      pledge_type:
        pledgePayNow >=
        pledgeAmount
          ? "pay_now"
          : "partial_upfront",

      success_url:
        successUrl,

      cancel_url:
        cancelUrl,

      note: "Pledge payment",
    };
  }

  /* =====================================================
     CHECKOUT
  ===================================================== */

  async function handleCheckout() {

    try {

      setBusy(true);

      setError("");

      const validation =
        validate();

      if (validation) {
        throw new Error(
          validation
        );
      }

      const payload =
        buildPayload();

      const { data } =
        await api.post(
          "/checkout/create-session",
          payload
        );

      const url =
        sessionUrl(data);

      if (!url) {
        throw new Error(
          "Stripe session URL missing."
        );
      }

      window.location.assign(
        url
      );

    } catch (err) {

      console.error(err);

      setBusy(false);

      setError(
        err?.response?.data
          ?.error ||
          err?.message ||
          "Unable to process checkout."
      );
    }
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (
    loading &&
    mode ===
      "membership"
  ) {

    return (
      <div className="ck-loading">

        Loading secure checkout...

      </div>
    );
  }

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="ck-page">

      <div className="ck-header">

        <div>

          <p className="ck-eyebrow">

            SECURE PAYMENT

          </p>

          <h1>

            Checkout

          </h1>

          <p className="ck-subtitle">

            {isAuthed
              ? `Signed in as ${user?.email || user?.username}`
              : "Guest Payment"}

          </p>

        </div>

      </div>

      {error ? (

        <div className="ck-error">

          {error}

        </div>

      ) : null}

      {/* TABS */}

      <div className="ck-tabs">

        {isAuthed ? (

          <button
            className={
              mode ===
              "membership"
                ? "active"
                : ""
            }
            onClick={() =>
              setMode(
                "membership"
              )
            }
          >

            Membership

          </button>

        ) : null}

        <button
          className={
            mode ===
            "donation"
              ? "active"
              : ""
          }
          onClick={() =>
            setMode(
              "donation"
            )
          }
        >

          Donation

        </button>

        <button
          className={
            mode ===
            "school"
              ? "active"
              : ""
          }
          onClick={() =>
            setMode(
              "school"
            )
          }
        >

          School

        </button>

        <button
          className={
            mode ===
            "trip"
              ? "active"
              : ""
          }
          onClick={() =>
            setMode("trip")
          }
        >

          Trip

        </button>

        <button
          className={
            mode ===
            "pledge"
              ? "active"
              : ""
          }
          onClick={() =>
            setMode(
              "pledge"
            )
          }
        >

          Pledge

        </button>

      </div>

      {/* BODY */}

      <div className="ck-layout">

        {/* LEFT */}

        <div className="ck-left">

          {/* MEMBERSHIP */}

          {mode ===
          "membership" ? (

            <div className="ck-section">

              <div className="ck-section-head">

                <h2>

                  Membership Plans

                </h2>

                <p>

                  Choose membership
                  dues plan and
                  coverage.

                </p>

              </div>

              <div className="ck-card-grid">

                {plans.map((p) => {

                  const active =
                    Number(
                      selectedPlan?.id
                    ) ===
                    Number(p.id);

                  return (

                    <button
                      key={p.id}
                      className={`ck-plan-card ${
                        active
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedPlan(
                          p
                        )
                      }
                    >

                      <div className="ck-plan-name">

                        {p.plan_name}

                      </div>

                      <div className="ck-plan-price">

                        {money(
                          p.minimum_amount
                        )}

                      </div>

                      <div className="ck-plan-meta">

                        {
                          p.duration_months
                        }{" "}
                        Month
                        {Number(
                          p.duration_months
                        ) > 1
                          ? "s"
                          : ""}

                      </div>

                    </button>
                  );
                })}

              </div>

              <label className="ck-check">

                <input
                  type="checkbox"
                  checked={
                    autoRenew
                  }
                  onChange={(e) =>
                    setAutoRenew(
                      e.target.checked
                    )
                  }
                />

                Enable recurring
                automatic payment

              </label>

            </div>

          ) : null}

          {/* DONATION */}

          {mode ===
          "donation" ? (

            <div className="ck-section">

              <div className="ck-field">

                <label>

                  Donation Category

                </label>

                <select
                  value={
                    donationCategory
                  }
                  onChange={(e) =>
                    setDonationCategory(
                      e.target.value
                    )
                  }
                >

                  {DONATION_CATEGORIES.map(
                    (x) => (

                      <option
                        key={
                          x.value
                        }
                        value={
                          x.value
                        }
                      >

                        {x.label}

                      </option>
                    )
                  )}

                </select>

              </div>

              <div className="ck-field">

                <label>

                  Amount

                </label>

                <input
                  type="number"
                  min="1"
                  value={
                    donationAmount
                  }
                  onChange={(e) =>
                    setDonationAmount(
                      e.target.value
                    )
                  }
                />

              </div>

              <label className="ck-check">

                <input
                  type="checkbox"
                  checked={
                    recurringDonation
                  }
                  onChange={(e) =>
                    setRecurringDonation(
                      e.target.checked
                    )
                  }
                />

                Recurring Donation

              </label>

              {recurringDonation ? (

                <div className="ck-field">

                  <label>

                    Frequency

                  </label>

                  <select
                    value={
                      recurringFrequency
                    }
                    onChange={(e) =>
                      setRecurringFrequency(
                        e.target.value
                      )
                    }
                  >

                    <option value="weekly">
                      Weekly
                    </option>

                    <option value="monthly">
                      Monthly
                    </option>

                    <option value="quarterly">
                      Quarterly
                    </option>

                    <option value="annual">
                      Annual
                    </option>

                  </select>

                </div>

              ) : null}

            </div>

          ) : null}

          {/* PROGRAM */}

          {["school", "trip"].includes(
            mode
          ) ? (

            <div className="ck-section">

              <div className="ck-field">

                <label>

                  Program Name

                </label>

                <input
                  value={
                    programName
                  }
                  onChange={(e) =>
                    setProgramName(
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="ck-field">

                <label>

                  Quantity

                </label>

                <input
                  type="number"
                  min="1"
                  value={
                    programQuantity
                  }
                  onChange={(e) =>
                    setProgramQuantity(
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="ck-field">

                <label>

                  Price Per Person

                </label>

                <input
                  type="number"
                  min="1"
                  value={
                    programPrice
                  }
                  onChange={(e) =>
                    setProgramPrice(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

          ) : null}

          {/* PLEDGE */}

          {mode ===
          "pledge" ? (

            <div className="ck-section">

              <div className="ck-field">

                <label>

                  Pledge Amount

                </label>

                <input
                  type="number"
                  value={
                    pledgeAmount
                  }
                  onChange={(e) =>
                    setPledgeAmount(
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="ck-field">

                <label>

                  Pay Now

                </label>

                <input
                  type="number"
                  value={
                    pledgePayNow
                  }
                  onChange={(e) =>
                    setPledgePayNow(
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="ck-pledge-remaining">

                Remaining Balance:
                <strong>

                  {money(
                    Math.max(
                      pledgeAmount -
                        pledgePayNow,
                      0
                    )
                  )}

                </strong>

              </div>

            </div>

          ) : null}

          {/* FEE */}

          <label className="ck-check">

            <input
              type="checkbox"
              checked={
                coverFee
              }
              onChange={(e) =>
                setCoverFee(
                  e.target.checked
                )
              }
            />

            Cover payment
            processing fee

          </label>

        </div>

        {/* RIGHT */}

        <div className="ck-right">

          <div className="ck-summary-card">

            <h3>

              Payment Summary

            </h3>

            <div className="ck-summary-row">

              <span>

                Payment Type

              </span>

              <strong>

                {mode}

              </strong>

            </div>

            <div className="ck-summary-row">

              <span>

                Subtotal

              </span>

              <strong>

                {money(
                  subtotal
                )}

              </strong>

            </div>

            {coverFee ? (

              <div className="ck-summary-row">

                <span>

                  Processing Fee

                </span>

                <strong>

                  {money(
                    processingFee
                  )}

                </strong>

              </div>

            ) : null}

            <div className="ck-total">

              <span>

                Total

              </span>

              <strong>

                {money(total)}

              </strong>

            </div>

            <button
              className="ck-btn"
              disabled={
                busy ||
                total <= 0
              }
              onClick={
                handleCheckout
              }
            >

              {busy
                ? "Processing..."
                : "Continue to Secure Payment"}

            </button>

          </div>

        </div>

      </div>

    </div>
  );
}