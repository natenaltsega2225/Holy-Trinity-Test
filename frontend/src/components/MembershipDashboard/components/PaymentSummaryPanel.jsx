// frontend/src/components/MembershipDashboard/components/PaymentSummaryPanel.jsx


import React from "react";

function money(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pretty(value) {
  if (!value) return "--";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PaymentSummaryPanel({
  selectedType,

  selectedPlan,

  membershipMode,
  coverageLabel,
  coverageYear,
  coverageStartMonth,
  coverageEndMonth,
  monthsPaid,

  selectedProgramRow,

  donationCategory,
  donationAmount,

  quantity,

  membershipAmount,
  totalAmount,

  processingFee = 0,
  grandTotal = 0,

  busy,
  onCheckout,
}) {
  const subtotal =
    selectedType === "membership"
      ? Number(membershipAmount || 0)
      : selectedType === "donation"
      ? Number(donationAmount || 0)
      : Number(totalAmount || 0);

  return (
    <aside className="payx-panel payx-panel-summary">

      <div className="payx-summary-header">
        <div>
          <span className="payx-summary-kicker">
            Secure Checkout
          </span>

          <h3 className="payx-summary-title">
            Payment Summary
          </h3>
        </div>
      </div>

      <div className="payx-summary-card">

        <div className="payx-summary-row">
          <span>Payment Type</span>
          <strong>{pretty(selectedType)}</strong>
        </div>

        <div className="payx-summary-row">
          <span>Details</span>

          <strong>
            {selectedType === "membership"
              ? selectedPlan
              : selectedType === "donation"
              ? pretty(donationCategory)
              : selectedProgramRow?.title || "--"}
          </strong>
        </div>

        {selectedType === "membership" && (
          <>
            <div className="payx-summary-row">
              <span>Renewal Type</span>

              <strong>
                {membershipMode === "custom"
                  ? "Missing Months Coverage"
                  : "Membership Subscription"}
              </strong>
            </div>

            {membershipMode === "custom" && (
              <>
                <div className="payx-summary-row">
                  <span>Coverage Year</span>
                  <strong>{coverageYear}</strong>
                </div>

                <div className="payx-summary-row">
                  <span>Coverage Period</span>
                  <strong>{coverageLabel || "--"}</strong>
                </div>

                <div className="payx-summary-row">
                  <span>Start Month</span>
                  <strong>{coverageStartMonth || "--"}</strong>
                </div>

                <div className="payx-summary-row">
                  <span>End Month</span>
                  <strong>{coverageEndMonth || "--"}</strong>
                </div>

                <div className="payx-summary-row">
                  <span>Months Covered</span>
                  <strong>{monthsPaid || 0}</strong>
                </div>
              </>
            )}
          </>
        )}

        {(selectedType === "school" ||
          selectedType === "trip") && (
          <div className="payx-summary-row">
            <span>Quantity</span>
            <strong>{Number(quantity || 1)}</strong>
          </div>
        )}
      </div>

      <div className="payx-total-card">

        <div className="payx-total-row">
          <span>Subtotal</span>
          <strong>{money(subtotal)}</strong>
        </div>

        <div className="payx-total-row">
          <span>Processing Fee</span>
          <strong>{money(processingFee)}</strong>
        </div>

        <div className="payx-total-row payx-total-grand">
          <span>Total</span>
          <strong>{money(grandTotal)}</strong>
        </div>

      </div>

      <div className="payx-checkout-info">

     

      </div>

      <button
        type="button"
        className="payx-checkout-btn"
        disabled={busy}
        onClick={onCheckout}
      >
        {busy
          ? "Processing..."
          : "Continue to Stripe"}
      </button>

      <div className="payx-summary-footer">
        <small>
          Payments are securely processed by Stripe.
          No card information is stored on church servers.
        </small>
      </div>

    </aside>
  );
}

