

// // frontend/src/components/MembershipDashboard/pages/MyPayments.jsx

// import React, { useEffect, useMemo, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";

// import api from "../../api";

// import MemberPageHeader from "../components/MemberPageHeader";
// import MembershipRenewal from "./MembershipRenewal";
// import MyMembershipCoverage from "./MyMembershipCoverage";
// import MyLedger from "./MyLedger";
// import InvoicesReceipts from "./InvoicesReceipts";
// import GivingStatements from "./GivingStatements";

// import BillingTabs from "../components/BillingTabs";
// import PaymentTypeSelector from "../components/PaymentTypeSelector";
// import MembershipPaymentPanel from "../components/MembershipPaymentPanel";
// import DonationPaymentPanel from "../components/DonationPaymentPanel";
// import ProgramPaymentPanel from "../components/ProgramPaymentPanel";
// import PaymentSummaryPanel from "../components/PaymentSummaryPanel";
// import PaymentHistorySection from "../components/PaymentHistorySection";

// import "../../../styles/payment.css";

// const DONATION_CATEGORIES = [
//   "plate_collection",
//   "candle_sale",
//   "general_donation",
//   "tithe",
//   "vows",
//   "baptism",
//   "wedding_engagement",
//   "memorial_service",
//   "pledge",
//   "building_fund",
//   "charity_fund",
//   "auction",
//   "other_fund",
//   "sunday_cash_collection",
// ];

// function normalizePlanKey(value) {
//   const v = String(value || "").toLowerCase();

//   if (v === "monthly" || v === "1_month") return "1_month";
//   if (v === "3_month") return "3_month";
//   if (v === "6_month") return "6_month";
//   if (v === "12_month") return "12_month";

//   return "1_month";
// }

// function apiKeyFromPlanKey(value) {
//   const v = normalizePlanKey(value);
//   return v === "1_month" ? "monthly" : v;
// }

// function getPlanForOption(rows, selectedKey) {
//   const apiKey = apiKeyFromPlanKey(selectedKey);

//   return (
//     rows.find((p) => String(p.billing_cycle || "").toLowerCase() === apiKey) ||
//     rows.find((p) => String(p.plan_key || "").toLowerCase() === selectedKey) ||
//     null
//   );
// }

// function checkoutUrl(data) {
//   return (
//     data?.url ||
//     data?.checkout_url ||
//     data?.checkoutUrl ||
//     data?.session_url ||
//     data?.sessionUrl ||
//     ""
//   );
// }

// function money(value) {
//   return `$${Number(value || 0).toLocaleString("en-US", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;
// }

// export default function MyPayments() {
//   const navigate = useNavigate();
//   const { tab } = useParams();

//   const [planRows, setPlanRows] = useState([]);
//   const [programs, setPrograms] = useState([]);
//   const [campaigns, setCampaigns] = useState([]);

//   const [selectedType, setSelectedType] = useState("membership");
//   const [selectedPlan, setSelectedPlan] = useState("1_month");

//   const [selectedProgram, setSelectedProgram] = useState("");
//   const [programQuantity, setProgramQuantity] = useState(1);

//   const [donationAmount, setDonationAmount] = useState("");
//   const [donationCategory, setDonationCategory] = useState("general_donation");
//   const [recurringDonation, setRecurringDonation] = useState(false);
//   const [recurringFrequency, setRecurringFrequency] = useState("monthly");

//   const [selectedCampaign, setSelectedCampaign] = useState("");
//   const [pledgedAmount, setPledgedAmount] = useState("");
//   const [upfrontAmount, setUpfrontAmount] = useState("");

//   const [autoRenew, setAutoRenew] = useState(false);

//   const [busy, setBusy] = useState(false);
//   const [message, setMessage] = useState("");
//   const [error, setError] = useState("");

//   const activeTab = String(tab || "make-payment").toLowerCase();

//   const normalizedPlanRows = useMemo(
//     () =>
//       planRows.map((p) => {
//         const planKey = normalizePlanKey(p.billing_cycle);

//         return {
//           ...p,
//           plan_key: planKey,
//           duration_months:
//             Number(p.duration_months) ||
//             (planKey === "3_month"
//               ? 3
//               : planKey === "6_month"
//               ? 6
//               : planKey === "12_month"
//               ? 12
//               : 1),
//         };
//       }),
//     [planRows]
//   );

//   const selectedPlanRow = useMemo(
//     () => getPlanForOption(normalizedPlanRows, selectedPlan),
//     [normalizedPlanRows, selectedPlan]
//   );

//   const selectedProgramRow = useMemo(
//     () => programs.find((p) => Number(p.id) === Number(selectedProgram)) || null,
//     [programs, selectedProgram]
//   );

//   const selectedCampaignRow = useMemo(
//     () => campaigns.find((c) => Number(c.id) === Number(selectedCampaign)) || null,
//     [campaigns, selectedCampaign]
//   );

//   const membershipAmount = Number(
//     selectedPlanRow.minimum_amount || selectedPlanRow.amount || 0
//   );

//   const programTotal = useMemo(() => {
//     return (
//       Number(selectedProgramRow?.price_per_person || 0) *
//       Number(programQuantity || 1)
//     );
//   }, [selectedProgramRow, programQuantity]);

//   const pledgeRemaining = Math.max(
//     Number(pledgedAmount || 0) - Number(upfrontAmount || 0),
//     0
//   );

//   const totalAmount = useMemo(() => {
//     if (selectedType === "membership") return membershipAmount;
//     if (selectedType === "donation") return Number(donationAmount || 0);
//     if (selectedType === "school" || selectedType === "trip") return programTotal;
//     if (selectedType === "pledge") return Number(upfrontAmount || 0);
//     return 0;
//   }, [
//     selectedType,
//     membershipAmount,
//     donationAmount,
//     programTotal,
//     upfrontAmount,
//   ]);

//   useEffect(() => {
//     loadPlans();
//     loadCampaigns();
//   }, []);

//   useEffect(() => {
//     if (selectedType === "school" || selectedType === "trip") {
//       setSelectedProgram("");
//       setProgramQuantity(1);
//       loadPrograms(selectedType);
//     }
//   }, [selectedType]);

//   async function loadPlans() {
//     try {
//       const res = await api.get("/dues/plans");
//       setPlanRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
//     } catch (err) {
//       console.error(err);
//     }
//   }

//   async function loadCampaigns() {
//     try {
//       const res = await api.get("/finance/campaigns", {
//         params: {
//           status: "active",
//           limit: 100,
//         },
//       });

//       setCampaigns(Array.isArray(res.data?.rows) ? res.data.rows : []);
//     } catch (err) {
//       console.error(err);
//       setCampaigns([]);
//     }
//   }

//   async function loadPrograms(type = selectedType) {
//     try {
//       const endpoint =
//         type === "school"
//           ? "/news-events?category=kids&published=1&page=1&limit=100"
//           : "/news-events?category=trip&published=1&page=1&limit=100";

//       const res = await api.get(endpoint);
//       setPrograms(Array.isArray(res.data?.rows) ? res.data.rows : []);
//     } catch (err) {
//       console.error(err);
//       setPrograms([]);
//     }
//   }

//   function validateCheckout() {
//     if (selectedType === "membership" && !selectedPlanRow.id) {
//       throw new Error("Membership plan is not configured.");
//     }

//     if (selectedType === "donation") {
//       if (!DONATION_CATEGORIES.includes(donationCategory)) {
//         throw new Error("Please select a valid donation category.");
//       }

//       if (Number(donationAmount || 0) <= 0) {
//         throw new Error("Please enter a valid donation amount.");
//       }
//     }

//     if (
//       (selectedType === "school" || selectedType === "trip") &&
//       !selectedProgramRow
//     ) {
//       throw new Error("Please select a program.");
//     }

//     if (
//       (selectedType === "school" || selectedType === "trip") &&
//       programTotal <= 0
//     ) {
//       throw new Error("Program price is not configured.");
//     }

//     if (selectedType === "pledge") {
//       if (!selectedCampaignRow?.id) {
//         throw new Error("Please select a campaign.");
//       }

//       if (Number(pledgedAmount || 0) <= 0) {
//         throw new Error("Please enter a valid pledge amount.");
//       }

//       if (Number(upfrontAmount || 0) <= 0) {
//         throw new Error("Please enter the amount you want to pay now.");
//       }

//       if (Number(upfrontAmount) > Number(pledgedAmount)) {
//         throw new Error("Pay-now amount cannot exceed pledged amount.");
//       }
//     }
//   }

//   async function handleCheckout() {
//     try {
//       setBusy(true);
//       setError("");
//       setMessage("");

//       validateCheckout();

//       const successUrl = `${window.location.origin}/dash/membership/my-payments/history?status=success&session_id={CHECKOUT_SESSION_ID}`;
//       const cancelUrl = `${window.location.origin}/dash/membership/my-payments/make-payment?status=cancel&type=${selectedType}`;

//       let payload = {};

//       if (selectedType === "membership") {
//         payload = {
//           type: "membership",
//           payment_type: "membership",
//           category: "membership",

//           plan_id: selectedPlanRow.id,
//           dues_plan_id: selectedPlanRow.id,
//           plan_name: selectedPlanRow.plan_name,
//           selected_option: apiKeyFromPlanKey(selectedPlan),

//           amount: membershipAmount,
//           total_amount: membershipAmount,

//           duration_months: selectedPlanRow.duration_months,
//           months_paid: selectedPlanRow.duration_months,
//           interval_count: selectedPlanRow.duration_months,
//           interval_unit: "month",

//           auto_renew: autoRenew,
//           auto_payment_enabled: autoRenew,
//           recurring_frequency: "monthly",

//           sub_category: selectedPlanRow.plan_name || "Membership Dues",

//           success_url: successUrl,
//           cancel_url: cancelUrl,
//         };
//       }

//       if (selectedType === "donation") {
//         payload = {
//           type: "donation",
//           payment_type: "donation",
//           category: "donation",

//           donation_category: donationCategory,
//           sub_category: donationCategory,

//           amount: Number(donationAmount),
//           total_amount: Number(donationAmount),

//           is_recurring: recurringDonation,
//           recurring_frequency: recurringFrequency,

//           success_url: successUrl,
//           cancel_url: cancelUrl,
//         };
//       }

//       if (selectedType === "school" || selectedType === "trip") {
//         payload = {
//           type: selectedType,
//           payment_type: selectedType,
//           category: selectedType,

//           related_entity_id: selectedProgramRow.id,
//           related_entity_type: "news_event",
//           program_id: selectedProgramRow.id,
//           news_event_id: selectedProgramRow.id,
//           program_title: selectedProgramRow.title,
//           program_name: selectedProgramRow.title,
//           sub_category: selectedProgramRow.title,

//           quantity: Number(programQuantity) || 1,
//           amount: programTotal,
//           total_amount: programTotal,

//           success_url: successUrl,
//           cancel_url: cancelUrl,
//         };
//       }

//       if (selectedType === "pledge") {
//         payload = {
//           type: "pledge",
//           payment_type: "pledge",
//           category: "pledge",

//           campaign_id: selectedCampaignRow.id,
//           campaign_name: selectedCampaignRow.title,
//           sub_category: selectedCampaignRow.title,

//           pledge_type:
//             Number(upfrontAmount) >= Number(pledgedAmount)
//               ? "pay_now"
//               : "partial_upfront",

//           pledged_amount: Number(pledgedAmount),
//           upfront_amount: Number(upfrontAmount),
//           remaining_balance: pledgeRemaining,

//           amount: Number(upfrontAmount),
//           total_amount: Number(upfrontAmount),

//           success_url: successUrl,
//           cancel_url: cancelUrl,
//         };
//       }

//       const { data } = await api.post("/checkout/create-session", payload);
//       const url = checkoutUrl(data);

//       if (!url) throw new Error("Stripe checkout URL missing.");

//       window.location.assign(url);
//     } catch (err) {
//       setError(err?.response?.data?.error || err.message || "Checkout failed.");
//       setBusy(false);
//     }
//   }

//   function goTab(next) {
//     navigate(`/dash/membership/my-payments/${next}`);
//   }

//   return (
//     <div className="member-page">
//       <MemberPageHeader
//         title="My Payments"
//         subtitle="Membership, donations, school, trip, pledge, invoices, receipts, coverage, and ledger."
//       />

//       {message ? (
//         <div className="member-banner member-banner-success">{message}</div>
//       ) : null}

//       {error ? (
//         <div className="member-banner member-banner-error">{error}</div>
//       ) : null}

//       <BillingTabs activeTab={activeTab} onChange={goTab} />

//       {activeTab === "make-payment" ? (
//         <section className="payx-shell">
//           <div className="payx-layout">
//             <div className="payx-panel">
//               <div className="payx-section-head">
//                 <div>
//                   <h3 className="payx-section-title">Make Payment</h3>
//                   <p className="payx-section-subtitle">
//                     Pay membership dues, donate, register for school/trip, or pay a pledge.
//                   </p>
//                 </div>
//               </div>

//               <PaymentTypeSelector
//                 selectedType={selectedType}
//                 onChange={setSelectedType}
//               />

//               {selectedType === "membership" ? (
//                 <>
//                   <MembershipPaymentPanel
//                     planRows={normalizedPlanRows}
//                     selectedPlan={selectedPlan}
//                     setSelectedPlan={setSelectedPlan}
//                   />

//                   <label className="payx-check-row">
//                     <input
//                       type="checkbox"
//                       checked={autoRenew}
//                       onChange={(e) => setAutoRenew(e.target.checked)}
//                     />
//                     <span>Enable recurring automatic membership payment</span>
//                   </label>
//                 </>
//               ) : null}

//               {selectedType === "donation" ? (
//                 <>
//                   <DonationPaymentPanel
//                     donationCategory={donationCategory}
//                     setDonationCategory={setDonationCategory}
//                     donationAmount={donationAmount}
//                     setDonationAmount={setDonationAmount}
//                   />

//                   <label className="payx-check-row">
//                     <input
//                       type="checkbox"
//                       checked={recurringDonation}
//                       onChange={(e) => setRecurringDonation(e.target.checked)}
//                     />
//                     <span>Make this a recurring donation</span>
//                   </label>

//                   {recurringDonation ? (
//                     <div className="payx-field">
//                       <label>Recurring Frequency</label>
//                       <select
//                         value={recurringFrequency}
//                         onChange={(e) => setRecurringFrequency(e.target.value)}
//                       >
//                         <option value="weekly">Weekly</option>
//                         <option value="monthly">Monthly</option>
//                         <option value="quarterly">Quarterly</option>
//                         <option value="annual">Annual</option>
//                       </select>
//                     </div>
//                   ) : null}
//                 </>
//               ) : null}

//               {selectedType === "school" || selectedType === "trip" ? (
//                 <ProgramPaymentPanel
//                   selectedType={selectedType}
//                   programs={programs}
//                   selectedProgram={selectedProgram}
//                   setSelectedProgram={setSelectedProgram}
//                   programQuantity={programQuantity}
//                   setProgramQuantity={setProgramQuantity}
//                 />
//               ) : null}

//               {selectedType === "pledge" ? (
//                 <div className="payx-form-grid">
//                   <div className="payx-field">
//                     <label>Campaign</label>
//                     <select
//                       value={selectedCampaign}
//                       onChange={(e) => setSelectedCampaign(e.target.value)}
//                     >
//                       <option value="">Select campaign</option>
//                       {campaigns.map((c) => (
//                         <option key={c.id} value={c.id}>
//                           {c.title}
//                         </option>
//                       ))}
//                     </select>
//                   </div>

//                   <div className="payx-field">
//                     <label>Pledged Amount</label>
//                     <input
//                       type="number"
//                       min="1"
//                       step="0.01"
//                       value={pledgedAmount}
//                       onChange={(e) => setPledgedAmount(e.target.value)}
//                     />
//                   </div>

//                   <div className="payx-field">
//                     <label>Pay Now</label>
//                     <input
//                       type="number"
//                       min="1"
//                       step="0.01"
//                       value={upfrontAmount}
//                       onChange={(e) => setUpfrontAmount(e.target.value)}
//                     />
//                   </div>

//                   <div className="payx-summary-box payx-summary-box-highlight">
//                     <span className="payx-summary-label">Remaining Balance</span>
//                     <strong>{money(pledgeRemaining)}</strong>
//                   </div>
//                 </div>
//               ) : null}
//             </div>

//             <PaymentSummaryPanel
//               selectedType={selectedType}
//               selectedPlan={selectedPlanRow.plan_name}
//               selectedProgram={selectedProgram}
//               selectedProgramRow={selectedProgramRow}
//               donationCategory={donationCategory}
//               donationAmount={donationAmount}
//               quantity={programQuantity}
//               membershipAmount={membershipAmount}
//               totalAmount={
//                 selectedType === "school" || selectedType === "trip"
//                   ? programTotal
//                   : totalAmount
//               }
//               busy={busy}
//               onCheckout={handleCheckout}
//             />
//           </div>
//         </section>
//       ) : null}

//       {activeTab === "renewal" ? <MembershipRenewal /> : null}
//       {activeTab === "coverage" ? <MyMembershipCoverage /> : null}
//       {activeTab === "history" ? <PaymentHistorySection /> : null}
//       {activeTab === "ledger" ? <MyLedger /> : null}
//       {activeTab === "invoices" ? <InvoicesReceipts /> : null}
//       {activeTab === "giving" ? <GivingStatements /> : null}
//     </div>
//   );
// }


// frontend/src/components/MembershipDashboard/pages/MyPayments.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import api from "../../api";

import MemberPageHeader from "../components/MemberPageHeader";
import MembershipRenewal from "./MembershipRenewal";
import MyMembershipCoverage from "./MyMembershipCoverage";
import MyLedger from "./MyLedger";
import InvoicesReceipts from "./InvoicesReceipts";
import GivingStatements from "./GivingStatements";

import BillingTabs from "../components/BillingTabs";
import PaymentTypeSelector from "../components/PaymentTypeSelector";
import MembershipPaymentPanel from "../components/MembershipPaymentPanel";
import DonationPaymentPanel from "../components/DonationPaymentPanel";
import ProgramPaymentPanel from "../components/ProgramPaymentPanel";
import PaymentSummaryPanel from "../components/PaymentSummaryPanel";
import PaymentHistorySection from "../components/PaymentHistorySection";

import "../../../styles/payment.css";

const DONATION_CATEGORIES = [
  "plate_collection",
  "candle_sale",
  "general_donation",
  "tithe",
  "vows",
  "baptism",
  "wedding_engagement",
  "memorial_service",
  "pledge",
  "building_fund",
  "charity_fund",
  "auction",
  "other_fund",
  "sunday_cash_collection",
];

const MONTHS = [
  { value: 1, short: "Jan", label: "January" },
  { value: 2, short: "Feb", label: "February" },
  { value: 3, short: "Mar", label: "March" },
  { value: 4, short: "Apr", label: "April" },
  { value: 5, short: "May", label: "May" },
  { value: 6, short: "Jun", label: "June" },
  { value: 7, short: "Jul", label: "July" },
  { value: 8, short: "Aug", label: "August" },
  { value: 9, short: "Sep", label: "September" },
  { value: 10, short: "Oct", label: "October" },
  { value: 11, short: "Nov", label: "November" },
  { value: 12, short: "Dec", label: "December" },
];

function normalizePlanKey(value) {
  const v = String(value || "").toLowerCase();

  if (v === "monthly" || v === "1_month") return "1_month";
  if (v === "3_month") return "3_month";
  if (v === "6_month") return "6_month";
  if (v === "12_month") return "12_month";

  return "1_month";
}

function apiKeyFromPlanKey(value) {
  const v = normalizePlanKey(value);
  return v === "1_month" ? "monthly" : v;
}

function getPlanForOption(rows, selectedKey) {
  const apiKey = apiKeyFromPlanKey(selectedKey);

  return (
    rows.find((p) => String(p.billing_cycle || "").toLowerCase() === apiKey) ||
    rows.find((p) => String(p.plan_key || "").toLowerCase() === selectedKey) ||
    null
  );
}

function checkoutUrl(data) {
  return (
    data?.url ||
    data?.checkout_url ||
    data?.checkoutUrl ||
    data?.session_url ||
    data?.sessionUrl ||
    ""
  );
}

function money(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getMonthLabel(month) {
  return MONTHS.find((m) => Number(m.value) === Number(month))?.label || "--";
}

function getShortMonth(month) {
  return MONTHS.find((m) => Number(m.value) === Number(month))?.short || "--";
}

function buildCoverageLabel(year, startMonth, endMonth) {
  if (!startMonth || !endMonth) return "--";

  return `${getShortMonth(startMonth)} ${year} → ${getShortMonth(
    endMonth
  )} ${year}`;
}

function buildCoverageMonthsJson(year, startMonth, endMonth) {
  const start = Number(startMonth);
  const end = Number(endMonth);

  if (!start || !end || end < start) return "[]";

  const rows = [];

  for (let month = start; month <= end; month += 1) {
    rows.push({
      year: Number(year),
      month: getMonthLabel(month),
      month_number: month,
      label: `${getMonthLabel(month)} ${year}`,
    });
  }

  return JSON.stringify(rows);
}

function getFirstUnpaidGap(grid = []) {
  let start = null;
  let end = null;

  for (const row of grid) {
    const month = Number(row.month_number || 0);
    const paid =
      row.paid === true ||
      ["paid", "completed", "posted", "approved"].includes(
        String(row.status || "").toLowerCase()
      );

    if (!paid && month >= 1 && month <= 12) {
      if (!start) start = month;
      end = month;
    } else if (start) {
      break;
    }
  }

  return {
    start,
    end,
  };
}

export default function MyPayments() {
  const navigate = useNavigate();
  const { tab } = useParams();

  const currentYear = new Date().getFullYear();

  const [planRows, setPlanRows] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  const [selectedType, setSelectedType] = useState("membership");
  const [selectedPlan, setSelectedPlan] = useState("1_month");

  const [membershipMode, setMembershipMode] = useState("subscription");
  const [coverageYear, setCoverageYear] = useState(currentYear);
  const [coverageStartMonth, setCoverageStartMonth] = useState("");
  const [coverageEndMonth, setCoverageEndMonth] = useState("");
  const [coverageGrid, setCoverageGrid] = useState([]);

  const [selectedProgram, setSelectedProgram] = useState("");
  const [programQuantity, setProgramQuantity] = useState(1);

  const [donationAmount, setDonationAmount] = useState("");
  const [donationCategory, setDonationCategory] =
    useState("general_donation");
  const [recurringDonation, setRecurringDonation] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");

  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [pledgedAmount, setPledgedAmount] = useState("");
  const [upfrontAmount, setUpfrontAmount] = useState("");

  const [autoRenew, setAutoRenew] = useState(false);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeTab = String(tab || "make-payment").toLowerCase();

  const normalizedPlanRows = useMemo(
    () =>
      planRows.map((p) => {
        const planKey = normalizePlanKey(p.billing_cycle || p.plan_key);

        return {
          ...p,
          plan_key: planKey,
          duration_months:
            Number(p.duration_months) ||
            (planKey === "3_month"
              ? 3
              : planKey === "6_month"
              ? 6
              : planKey === "12_month"
              ? 12
              : 1),
        };
      }),
    [planRows]
  );

  const selectedPlanRow = useMemo(
    () => getPlanForOption(normalizedPlanRows, selectedPlan),
    [normalizedPlanRows, selectedPlan]
  );
const safePlanRow =
  selectedPlanRow ||
  normalizedPlanRows[0] ||
  {
    id: null,
    plan_name: "Monthly Membership",
    minimum_amount: 50,
    amount: 50,
    duration_months: 1,
  };
  const monthlyPlan = useMemo(
    () =>
      normalizedPlanRows.find((p) => Number(p.duration_months) === 1) ||
      selectedPlanRow,
    [normalizedPlanRows, selectedPlanRow]
  );

  const monthlyRate = Number(
    monthlyPlan?.minimum_amount || monthlyPlan?.amount || 0
  );

  const customMonths = useMemo(() => {
    const start = Number(coverageStartMonth || 0);
    const end = Number(coverageEndMonth || 0);

    if (!start || !end || end < start) return 0;

    return end - start + 1;
  }, [coverageStartMonth, coverageEndMonth]);

  const customCoverageAmount = Number(
    (monthlyRate * customMonths).toFixed(2)
  );

  const selectedProgramRow = useMemo(
    () => programs.find((p) => Number(p.id) === Number(selectedProgram)) || null,
    [programs, selectedProgram]
  );

  const selectedCampaignRow = useMemo(
    () => campaigns.find((c) => Number(c.id) === Number(selectedCampaign)) || null,
    [campaigns, selectedCampaign]
  );

 const membershipAmount =
  membershipMode === "custom"
    ? customCoverageAmount
    : Number(
        safePlanRow.minimum_amount ||
        safePlanRow.amount ||
        0
      );

  const programTotal = useMemo(() => {
    return (
      Number(selectedProgramRow?.price_per_person || 0) *
      Number(programQuantity || 1)
    );
  }, [selectedProgramRow, programQuantity]);

  const pledgeRemaining = Math.max(
    Number(pledgedAmount || 0) - Number(upfrontAmount || 0),
    0
  );

  const totalAmount = useMemo(() => {
    if (selectedType === "membership") return membershipAmount;
    if (selectedType === "donation") return Number(donationAmount || 0);
    if (selectedType === "school" || selectedType === "trip") return programTotal;
    if (selectedType === "pledge") return Number(upfrontAmount || 0);
    return 0;
  }, [
    selectedType,
    membershipAmount,
    donationAmount,
    programTotal,
    upfrontAmount,
  ]);
const subtotal = Number(totalAmount || 0);

const processingFee =
  subtotal > 0
    ? Number((subtotal * 0.029 + 0.30).toFixed(2))
    : 0;

const grandTotal =
  Number((subtotal + processingFee).toFixed(2));
  const recommendedGap = useMemo(
    () => getFirstUnpaidGap(coverageGrid),
    [coverageGrid]
  );

  const coverageLabel = useMemo(
    () =>
      buildCoverageLabel(
        coverageYear,
        coverageStartMonth,
        coverageEndMonth
      ),
    [coverageYear, coverageStartMonth, coverageEndMonth]
  );

  useEffect(() => {
    loadPlans();
    loadCampaigns();
  }, []);

  useEffect(() => {
    loadCoverageGrid();
  }, [coverageYear]);

  useEffect(() => {
    if (selectedType === "school" || selectedType === "trip") {
      setSelectedProgram("");
      setProgramQuantity(1);
      loadPrograms(selectedType);
    }
  }, [selectedType]);

  async function loadPlans() {
    try {
      const res = await api.get("/dues/plans");
      setPlanRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadCoverageGrid() {
    try {
      const res = await api.get(`/member/membership-grid/${coverageYear}`);
      const grid = Array.isArray(res.data?.grid) ? res.data.grid : [];

      setCoverageGrid(grid);

      const gap = getFirstUnpaidGap(grid);

      if (gap.start && gap.end) {
        setCoverageStartMonth(gap.start);
        setCoverageEndMonth(gap.end);
      }
    } catch (err) {
      console.error("coverage grid failed:", err);
      setCoverageGrid([]);
    }
  }

  async function loadCampaigns() {
    try {
      const res = await api.get("/finance/campaigns", {
        params: {
          status: "active",
          limit: 100,
        },
      });

      setCampaigns(Array.isArray(res.data?.rows) ? res.data.rows : []);
    } catch (err) {
      console.error(err);
      setCampaigns([]);
    }
  }

  async function loadPrograms(type = selectedType) {
    try {
      const endpoint =
        type === "school"
          ? "/news-events?category=kids&published=1&page=1&limit=100"
          : "/news-events?category=trip&published=1&page=1&limit=100";

      const res = await api.get(endpoint);
      setPrograms(Array.isArray(res.data?.rows) ? res.data.rows : []);
    } catch (err) {
      console.error(err);
      setPrograms([]);
    }
  }

  function validateCheckout() {
    if (selectedType === "membership") {
     if (!safePlanRow.id) {
        throw new Error("Membership plan is not configured.");
      }

      if (membershipMode === "custom") {
        if (!coverageStartMonth || !coverageEndMonth) {
          throw new Error("Please select coverage start and end month.");
        }

        if (Number(coverageEndMonth) < Number(coverageStartMonth)) {
          throw new Error("Coverage end month cannot be before start month.");
        }

        if (customCoverageAmount <= 0) {
          throw new Error("Custom coverage amount is invalid.");
        }
      }
    }

    if (selectedType === "donation") {
      if (!DONATION_CATEGORIES.includes(donationCategory)) {
        throw new Error("Please select a valid donation category.");
      }

      if (Number(donationAmount || 0) <= 0) {
        throw new Error("Please enter a valid donation amount.");
      }
    }

    if (
      (selectedType === "school" || selectedType === "trip") &&
      !selectedProgramRow
    ) {
      throw new Error("Please select a program.");
    }

    if (
      (selectedType === "school" || selectedType === "trip") &&
      programTotal <= 0
    ) {
      throw new Error("Program price is not configured.");
    }

    if (selectedType === "pledge") {
      if (!selectedCampaignRow?.id) {
        throw new Error("Please select a campaign.");
      }

      if (Number(pledgedAmount || 0) <= 0) {
        throw new Error("Please enter a valid pledge amount.");
      }

      if (Number(upfrontAmount || 0) <= 0) {
        throw new Error("Please enter the amount you want to pay now.");
      }

      if (Number(upfrontAmount) > Number(pledgedAmount)) {
        throw new Error("Pay-now amount cannot exceed pledged amount.");
      }
    }
  }

  async function handleCheckout() {
    try {
      setBusy(true);
      setError("");
      setMessage("");

      validateCheckout();

      const successUrl = `${window.location.origin}/dash/membership/my-payments/history?status=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/dash/membership/my-payments/make-payment?status=cancel&type=${selectedType}`;

      let payload = {};

      if (selectedType === "membership") {
        const isCustom = membershipMode === "custom";
        const monthsPaid = isCustom
  ? customMonths
  : Number(safePlanRow.duration_months || 1);
       const amountToPay = isCustom
  ? customCoverageAmount
  : Number(
      safePlanRow.minimum_amount ||
      safePlanRow.amount ||
      0
    );
        payload = {
          type: "membership",
          payment_type: "membership",
          category: "membership",

          membership_mode: membershipMode,
          renewal_type: isCustom ? "custom_missing_months" : "subscription_plan",

          plan_id: safePlanRow.id,
dues_plan_id: safePlanRow.id,
plan_name: safePlanRow.plan_name,
          selected_option: apiKeyFromPlanKey(selectedPlan),

          amount: amountToPay,
          total_amount: amountToPay,

          coverage_year: coverageYear,
          coverage_start_month: isCustom ? coverageStartMonth : "",
          coverage_end_month: isCustom ? coverageEndMonth : "",
          coverage_label: isCustom ? coverageLabel : "",
          coverage_months_json: isCustom
            ? buildCoverageMonthsJson(
                coverageYear,
                coverageStartMonth,
                coverageEndMonth
              )
            : "",

          duration_months: monthsPaid,
          months_paid: monthsPaid,
          interval_count: Number(safePlanRow.duration_months || 1),
          interval_unit: "month",

          auto_renew: autoRenew,
          auto_payment_enabled: autoRenew,
          is_recurring: autoRenew,
          subscription_enabled: autoRenew,
          recurring_frequency: "monthly",

          sub_category: isCustom
            ? `Custom Coverage: ${coverageLabel}`
            : safePlanRow.plan_name || "Membership Dues",

          success_url: successUrl,
          cancel_url: cancelUrl,
        };
      }

      if (selectedType === "donation") {
        payload = {
          type: "donation",
          payment_type: "donation",
          category: "donation",

          donation_category: donationCategory,
          sub_category: donationCategory,

          amount: Number(donationAmount),
          total_amount: Number(donationAmount),

          is_recurring: recurringDonation,
          recurring_frequency: recurringFrequency,

          success_url: successUrl,
          cancel_url: cancelUrl,
        };
      }

      if (selectedType === "school" || selectedType === "trip") {
        payload = {
          type: selectedType,
          payment_type: selectedType,
          category: selectedType,

          related_entity_id: selectedProgramRow.id,
          related_entity_type: "news_event",
          program_id: selectedProgramRow.id,
          news_event_id: selectedProgramRow.id,
          program_title: selectedProgramRow.title,
          program_name: selectedProgramRow.title,
          sub_category: selectedProgramRow.title,

          quantity: Number(programQuantity) || 1,
          amount: programTotal,
          total_amount: programTotal,

          success_url: successUrl,
          cancel_url: cancelUrl,
        };
      }

      if (selectedType === "pledge") {
        payload = {
          type: "pledge",
          payment_type: "pledge",
          category: "pledge",

          campaign_id: selectedCampaignRow.id,
          campaign_name: selectedCampaignRow.title,
          sub_category: selectedCampaignRow.title,

          pledge_type:
            Number(upfrontAmount) >= Number(pledgedAmount)
              ? "pay_now"
              : "partial_upfront",

          pledged_amount: Number(pledgedAmount),
          upfront_amount: Number(upfrontAmount),
          remaining_balance: pledgeRemaining,

          amount: Number(upfrontAmount),
          total_amount: Number(upfrontAmount),

          success_url: successUrl,
          cancel_url: cancelUrl,
        };
      }

      const { data } = await api.post("/checkout/create-session", payload);
      const url = checkoutUrl(data);

      if (!url) throw new Error("Stripe checkout URL missing.");

      window.location.assign(url);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Checkout failed.");
      setBusy(false);
    }
  }

  function goTab(next) {
    navigate(`/dash/membership/my-payments/${next}`);
  }

  return (
    <div className="member-page">
      <MemberPageHeader
        title="My Payments"
        subtitle="Membership, donations, school, trip, pledge, invoices, receipts, coverage, and ledger."
      />

      {message ? (
        <div className="member-banner member-banner-success">{message}</div>
      ) : null}

      {error ? (
        <div className="member-banner member-banner-error">{error}</div>
      ) : null}

      <BillingTabs activeTab={activeTab} onChange={goTab} />

      {activeTab === "make-payment" ? (
        <section className="payx-shell">
          <div className="payx-layout">
            <div className="payx-panel">
              <div className="payx-section-head">
                <div>
                  <h3 className="payx-section-title">Make Payment</h3>
                  <p className="payx-section-subtitle">
                    Pay membership dues, cover missing months, donate, register
                    for school/trip, or pay a pledge.
                  </p>
                </div>
              </div>

              <PaymentTypeSelector
                selectedType={selectedType}
                onChange={setSelectedType}
              />

              {selectedType === "membership" ? (
                <>
                  <MembershipPaymentPanel
                    planRows={normalizedPlanRows}
                    selectedPlan={selectedPlan}
                    setSelectedPlan={setSelectedPlan}
                    membershipMode={membershipMode}
                    setMembershipMode={setMembershipMode}
                    coverageYear={coverageYear}
                    setCoverageYear={setCoverageYear}
                    coverageStartMonth={coverageStartMonth}
                    setCoverageStartMonth={setCoverageStartMonth}
                    coverageEndMonth={coverageEndMonth}
                    setCoverageEndMonth={setCoverageEndMonth}
                    customMonthlyRate={monthlyRate}
                    recommendedStartMonth={recommendedGap.start}
                    recommendedEndMonth={recommendedGap.end}
                  />

                  <label className="payx-check-row">
                    <input
                      type="checkbox"
                      checked={autoRenew}
                      onChange={(e) => setAutoRenew(e.target.checked)}
                    />
                    <span>Enable recurring automatic membership payment</span>
                  </label>
                </>
              ) : null}

              {selectedType === "donation" ? (
                <>
                  <DonationPaymentPanel
                    donationCategory={donationCategory}
                    setDonationCategory={setDonationCategory}
                    donationAmount={donationAmount}
                    setDonationAmount={setDonationAmount}
                  />

                  <label className="payx-check-row">
                    <input
                      type="checkbox"
                      checked={recurringDonation}
                      onChange={(e) => setRecurringDonation(e.target.checked)}
                    />
                    <span>Make this a recurring donation</span>
                  </label>

                  {recurringDonation ? (
                    <div className="payx-field">
                      <label>Recurring Frequency</label>
                      <select
                        value={recurringFrequency}
                        onChange={(e) => setRecurringFrequency(e.target.value)}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>
                  ) : null}
                </>
              ) : null}

              {selectedType === "school" || selectedType === "trip" ? (
                <ProgramPaymentPanel
                  selectedType={selectedType}
                  programs={programs}
                  selectedProgram={selectedProgram}
                  setSelectedProgram={setSelectedProgram}
                  programQuantity={programQuantity}
                  setProgramQuantity={setProgramQuantity}
                />
              ) : null}

              {selectedType === "pledge" ? (
                <div className="payx-form-grid">
                  <div className="payx-field">
                    <label>Campaign</label>
                    <select
                      value={selectedCampaign}
                      onChange={(e) => setSelectedCampaign(e.target.value)}
                    >
                      <option value="">Select campaign</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="payx-field">
                    <label>Pledged Amount</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={pledgedAmount}
                      onChange={(e) => setPledgedAmount(e.target.value)}
                    />
                  </div>

                  <div className="payx-field">
                    <label>Pay Now</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={upfrontAmount}
                      onChange={(e) => setUpfrontAmount(e.target.value)}
                    />
                  </div>

                  <div className="payx-summary-box payx-summary-box-highlight">
                    <span className="payx-summary-label">
                      Remaining Balance
                    </span>
                    <strong>{money(pledgeRemaining)}</strong>
                  </div>
                </div>
              ) : null}
            </div>

            <PaymentSummaryPanel
              selectedType={selectedType}
              selectedPlan={safePlanRow.plan_name}
              membershipMode={membershipMode}
              coverageLabel={coverageLabel}
              coverageYear={coverageYear}
              coverageStartMonth={coverageStartMonth}
              coverageEndMonth={coverageEndMonth}
            monthsPaid={
  membershipMode === "custom"
    ? customMonths
    : Number(safePlanRow.duration_months || 1)
}
              selectedProgram={selectedProgram}
              selectedProgramRow={selectedProgramRow}
              donationCategory={donationCategory}
              donationAmount={donationAmount}
              quantity={programQuantity}
              membershipAmount={membershipAmount}
              totalAmount={
                selectedType === "school" || selectedType === "trip"
                  ? programTotal
                  : totalAmount
              }
              processingFee={processingFee}
grandTotal={grandTotal}
              busy={busy}
              onCheckout={handleCheckout}
            />
          </div>
        </section>
      ) : null}

      {activeTab === "renewal" ? <MembershipRenewal /> : null}
      {activeTab === "coverage" ? <MyMembershipCoverage /> : null}
      {activeTab === "history" ? <PaymentHistorySection /> : null}
      {activeTab === "ledger" ? <MyLedger /> : null}
      {activeTab === "invoices" ? <InvoicesReceipts /> : null}
      {activeTab === "giving" ? <GivingStatements /> : null}
    </div>
  );
}