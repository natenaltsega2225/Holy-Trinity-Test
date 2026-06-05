// // //frontend\src\components\Auth\RegistrationSummaryModal.jsx
// import React, { useEffect, useMemo } from "react";

// function money(value) {
//   const n = Number(value || 0);
//   return `$${n.toLocaleString(undefined, {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;
// }

// export default function RegistrationSummaryModal({
//   open,
//   onClose,
//   onContinue,
//   memberType,
//   selectedPlan = null,
//   registrationFee = 0,
//   agreed = false,
// }) {
//   useEffect(() => {
//     if (!open) return undefined;

//     const onKeyDown = (event) => {
//       if (event.key === "Escape") onClose?.();
//     };

//     document.body.style.overflow = "hidden";
//     window.addEventListener("keydown", onKeyDown);

//     return () => {
//       document.body.style.overflow = "";
//       window.removeEventListener("keydown", onKeyDown);
//     };
//   }, [open, onClose]);

//   const isNew = String(memberType || "").toLowerCase() === "new";

//   const planName = useMemo(
//     () => selectedPlan?.title || "Membership Plan",
//     [selectedPlan]
//   );

//   const planDurationLabel = useMemo(() => {
//     const months = Number(selectedPlan?.durationMonths || 0);
//     if (!months) return "--";
//     return `${months} month${months > 1 ? "s" : ""}`;
//   }, [selectedPlan]);

//   const memberFee = useMemo(
//     () => Number(selectedPlan?.displayAmount ?? selectedPlan?.amount ?? 0),
//     [selectedPlan]
//   );

//   const regFee = useMemo(
//     () => (isNew ? Number(registrationFee || 0) : 0),
//     [isNew, registrationFee]
//   );

//   const totalDue = regFee + memberFee;

//   if (!open) return null;

//   return (
//     <div
//       className="terms-overlay"
//       role="dialog"
//       aria-modal="true"
//       aria-labelledby="registration-summary-title"
//       onClick={onClose}
//     >
//       <div
//         className="terms-modal reg-summary-modal"
//         onClick={(e) => e.stopPropagation()}
//       >
//         <div className="terms-head">
//           <h2 id="registration-summary-title">Registration Summary</h2>
//           <button
//             type="button"
//             className="terms-close"
//             onClick={onClose}
//             aria-label="Close registration summary"
//           >
//             ×
//           </button>
//         </div>

//         <div className="terms-body">
//           <div className="reg-summary-grid">
//             <div className="reg-summary-card">
//               <div className="reg-summary-label">Member Type</div>
//               <div className="reg-summary-value">
//                 {isNew ? "New church member" : "Existing church member"}
//               </div>
//             </div>

//             <div className="reg-summary-card">
//               <div className="reg-summary-label">Selected Membership Plan</div>
//               <div className="reg-summary-value">{planName}</div>
//             </div>

//             <div className="reg-summary-card">
//               <div className="reg-summary-label">Plan Duration</div>
//               <div className="reg-summary-value">{planDurationLabel}</div>
//             </div>

//             <div className="reg-summary-card">
//               <div className="reg-summary-label">Registration Fee</div>
//               <div className="reg-summary-value">{money(regFee)}</div>
//             </div>

//             <div className="reg-summary-card">
//               <div className="reg-summary-label">Membership Fee</div>
//               <div className="reg-summary-value">{money(memberFee)}</div>
//             </div>

//             <div className="reg-summary-card reg-summary-card-highlight">
//               <div className="reg-summary-label">Initial Total Due</div>
//               <div className="reg-summary-value">{money(totalDue)}</div>
//             </div>
//           </div>

//           <div className="reg-summary-note">
//             {isNew ? (
//               <>
//                 Your account will be created first. After registration, the
//                 system will continue with the selected membership option and
//                 securely redirect you to Stripe Checkout.
//               </>
//             ) : (
//               <>
//                 After sign in, you will land on the{" "}
//                 <strong>Member Dashboard</strong>. From there, open{" "}
//                 <strong>My Payments</strong>, choose a plan, and click{" "}
//                 <strong>Pay Membership</strong>.
//               </>
//             )}
//           </div>

//           <div className="reg-summary-check">
//             <span
//               className={`reg-summary-check-indicator ${
//                 agreed ? "is-checked" : ""
//               }`}
//             />
//             <span>
//               Terms and conditions status:{" "}
//               <strong>{agreed ? "Accepted" : "Not accepted yet"}</strong>
//             </span>
//           </div>
//         </div>

//         <div className="terms-actions">
//           <button type="button" className="terms-cancel" onClick={onClose}>
//             Cancel
//           </button>
//           <button
//             type="button"
//             className="terms-accept"
//             onClick={onContinue}
//             disabled={!agreed}
//           >
//             Continue
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }


//frontend\src\components\Auth\RegistrationSummaryModal.jsx

import React, { useEffect, useMemo } from "react";

function money(value) {
  const n = Number(value || 0);
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPlanLabel(selectedOption, selectedPlan) {
  if (selectedPlan?.title) return selectedPlan.title;

  const key = String(selectedOption || selectedPlan?.key || "").toLowerCase();

  if (key === "12_month") return "Yearly";
  if (key === "6_month") return "6-Month";
  if (key === "3_month") return "3-Month";
  return "Monthly";
}

function getDurationMonths(selectedOption, selectedPlan) {
  if (Number(selectedPlan?.durationMonths || 0) > 0) {
    return Number(selectedPlan.durationMonths);
  }

  const key = String(selectedOption || selectedPlan?.key || "").toLowerCase();

  if (key === "12_month") return 12;
  if (key === "6_month") return 6;
  if (key === "3_month") return 3;
  return 1;
}

export default function RegistrationSummaryModal({
  open,
  onClose,
  onContinue,
  memberType,
  selectedPlan = null,
  selectedOption = "monthly",
  selectedAmount = 0,
  minimumAmount = 0,
  registrationFee = 0,
  agreed = false,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const isNew = String(memberType || "").toLowerCase() === "new";

  const planName = useMemo(
    () => formatPlanLabel(selectedOption, selectedPlan),
    [selectedOption, selectedPlan]
  );

  const durationMonths = useMemo(
    () => getDurationMonths(selectedOption, selectedPlan),
    [selectedOption, selectedPlan]
  );

  const planDurationLabel = useMemo(() => {
    if (!durationMonths) return "--";
    return `${durationMonths} month${durationMonths > 1 ? "s" : ""}`;
  }, [durationMonths]);

  const memberFee = useMemo(
    () => Number(selectedAmount || 0),
    [selectedAmount]
  );

  const minimumFee = useMemo(
    () => Number(minimumAmount || selectedPlan?.minimumAmount || 0),
    [minimumAmount, selectedPlan]
  );

  const regFee = useMemo(
    () => (isNew ? Number(registrationFee || 0) : 0),
    [isNew, registrationFee]
  );

  const totalDue = useMemo(
    () => Number((regFee + memberFee).toFixed(2)),
    [regFee, memberFee]
  );

  if (!open) return null;

  return (
    <div
      className="terms-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="registration-summary-title"
      onClick={onClose}
    >
      <div
        className="terms-modal reg-summary-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="terms-head">
          <h2 id="registration-summary-title">Registration Summary</h2>
          <button
            type="button"
            className="terms-close"
            onClick={onClose}
            aria-label="Close registration summary"
          >
            ×
          </button>
        </div>

        <div className="terms-body">
          <div className="reg-summary-grid">
            <div className="reg-summary-card">
              <div className="reg-summary-label">Member Type</div>
              <div className="reg-summary-value">
                {isNew ? "New church member" : "Existing church member"}
              </div>
            </div>

            <div className="reg-summary-card">
              <div className="reg-summary-label">Selected Plan</div>
              <div className="reg-summary-value">{planName}</div>
            </div>

            <div className="reg-summary-card">
              <div className="reg-summary-label">Plan Duration</div>
              <div className="reg-summary-value">{planDurationLabel}</div>
            </div>

            <div className="reg-summary-card">
              <div className="reg-summary-label">Minimum Amount</div>
              <div className="reg-summary-value">{money(minimumFee)}</div>
            </div>

            <div className="reg-summary-card">
              <div className="reg-summary-label">Selected Amount</div>
              <div className="reg-summary-value">{money(memberFee)}</div>
            </div>

            <div className="reg-summary-card">
              <div className="reg-summary-label">Registration Fee</div>
              <div className="reg-summary-value">{money(regFee)}</div>
            </div>

            <div className="reg-summary-card reg-summary-card-highlight">
              <div className="reg-summary-label">Initial Total Due</div>
              <div className="reg-summary-value">{money(totalDue)}</div>
            </div>
          </div>

          <div className="reg-summary-note">
            Your account will be created first. After registration, the system
            will continue with your selected frequency and amount, then securely
            redirect you to Stripe Checkout.
          </div>

          <div className="reg-summary-check">
            <span
              className={`reg-summary-check-indicator ${
                agreed ? "is-checked" : ""
              }`}
            />
            <span>
              Terms and conditions status:{" "}
              <strong>{agreed ? "Accepted" : "Not accepted yet"}</strong>
            </span>
          </div>
        </div>

        <div className="terms-actions">
          <button type="button" className="terms-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="terms-accept"
            onClick={onContinue}
            disabled={!agreed}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}