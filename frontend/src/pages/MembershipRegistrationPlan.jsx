

// //frontend\src\pages\MembershipRegistrationPlan.jsx


import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import api from "../components/api";
import "../styles/payment.css";

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function normalizeRows(data) {
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.plans)) return data.plans;
  if (Array.isArray(data)) return data;
  return [];
}

function normalizeOption(value) {
  const v = String(value || "monthly").toLowerCase();
  if (["monthly", "3_month", "6_month", "12_month"].includes(v)) return v;
  return "monthly";
}

function planLabel(plan) {
  return plan?.plan_name || plan?.name || "Membership Plan";
}

function planAmount(plan) {
  return Number(plan?.minimum_amount || plan?.amount || 0);
}

export default function MembershipRegistrationPlan() {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const selectedPlanIdFromState = location.state?.selectedPlanId;
  const selectedOptionFromState = location.state?.selectedOption;

  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [autoRenew, setAutoRenew] = useState(false);
  const [coverFee, setCoverFee] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const selectedOption = useMemo(() => {
    return normalizeOption(
      selected?.billing_cycle ||
        selectedOptionFromState ||
        searchParams.get("selected_option") ||
        "monthly"
    );
  }, [selected, selectedOptionFromState, searchParams]);

  const amount = planAmount(selected);
  const processingFee = coverFee
    ? Number(((amount * 0.029 + 0.3) / (1 - 0.029)).toFixed(2))
    : 0;

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setErr("");

        const { data } = await api.get("/dues/plans");
        const rows = normalizeRows(data);

        if (!mounted) return;

        setPlans(rows);

        const preferred =
          rows.find((p) => Number(p.id) === Number(selectedPlanIdFromState)) ||
          rows.find(
            (p) =>
              normalizeOption(p.billing_cycle) ===
              normalizeOption(selectedOptionFromState)
          ) ||
          rows[0] ||
          null;

        setSelected(preferred);
      } catch (error) {
        console.error(error);
        if (mounted) setErr("Failed to load membership plans.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [selectedPlanIdFromState, selectedOptionFromState]);

  async function checkout() {
    if (!selected?.id) {
      setErr("Please select a membership plan.");
      return;
    }

    try {
      setBusy(true);
      setErr("");

      const { data } = await api.post("/checkout/create-session", {
        kind: "membership",
        type: "membership",
        plan_id: selected.id,
        selected_option: selectedOption,
        custom_amount: amount,
        auto_renew: autoRenew,
        cover_processing_fee: coverFee,
        processing_fee: processingFee,
        success_url: `${window.location.origin}/dash/membership/my-payments/history?status=success`,
        cancel_url: `${window.location.origin}/membership-plan?status=cancel`,
      });

      if (!data?.url) throw new Error("Stripe URL was not returned.");

      window.location.href = data.url;
    } catch (error) {
      console.error(error);
      setErr(error?.response?.data?.error || "Failed to start checkout.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="payments-wrap">
        <div className="payments-container">
          <div className="payx-inline-note">Loading membership plans...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="payments-wrap">
      <div className="payments-container">
        <div className="payx-public-head">
          <span className="payx-eyebrow">Membership Checkout</span>
          <h2 className="payments-title">Choose Membership Plan</h2>
          <p className="payments-subtitle">
            Select the finance-approved membership plan and continue to secure Stripe checkout.
          </p>
        </div>

        {err ? <div className="payx-error">{err}</div> : null}

        <div className="payx-layout payx-layout-premium">
          <div className="payx-panel payx-panel-main">
            <div className="payx-preset-grid">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={`payx-preset-btn ${selected?.id === plan.id ? "is-selected" : ""}`}
                  onClick={() => setSelected(plan)}
                >
                  {planLabel(plan)}
                  <span>
                    {normalizeOption(plan.billing_cycle).replace("_", " ")} · {money(planAmount(plan))}
                  </span>
                </button>
              ))}
            </div>

            <label className="payx-checkbox-row">
              <input
                type="checkbox"
                checked={autoRenew}
                onChange={(e) => setAutoRenew(e.target.checked)}
              />
              Enable auto-renew subscription
            </label>

            <label className="payx-checkbox-row">
              <input
                type="checkbox"
                checked={coverFee}
                onChange={(e) => setCoverFee(e.target.checked)}
              />
              Cover processing fee ({money(processingFee)})
            </label>

            {!plans.length ? (
              <div className="payx-inline-note">
                No active membership plans are configured.
              </div>
            ) : null}
          </div>

          <div className="payx-panel payx-panel-summary payx-sticky">
            <div className="payx-summary-grid payx-summary-grid-tall">
              <div className="payx-summary-box">
                <span className="payx-summary-label">Plan</span>
                <strong>{planLabel(selected)}</strong>
              </div>

              <div className="payx-summary-box">
                <span className="payx-summary-label">Billing Option</span>
                <strong>{selectedOption.replace("_", " ")}</strong>
              </div>

              {coverFee ? (
                <div className="payx-summary-box">
                  <span className="payx-summary-label">Processing Fee</span>
                  <strong>{money(processingFee)}</strong>
                </div>
              ) : null}

              <div className="payx-summary-box payx-summary-box-highlight">
                <span className="payx-summary-label">Total</span>
                <strong>{money(amount + processingFee)}</strong>
              </div>
            </div>

            <div className="payx-actions">
              <button
                type="button"
                className="payx-btn payx-btn-primary"
                onClick={checkout}
                disabled={busy || !selected?.id}
              >
                {busy ? "Processing..." : "Continue to Stripe"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}