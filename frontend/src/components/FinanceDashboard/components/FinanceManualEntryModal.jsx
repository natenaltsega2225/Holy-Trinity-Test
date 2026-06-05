
// src/components/FinanceDashboard/components/FinanceManualEntryModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";

import "../../../styles/finance-dashboard.css";
const PAYMENT_TYPES = [
  { value: "membership", label: "Membership Dues" },
  { value: "donation", label: "Donation" },
  { value: "school", label: "Kids School" },
  { value: "trip", label: "Trip Program" },
  { value: "pledge", label: "Pledge" },
  { value: "sunday_collection", label: "Sunday Collection" },
];

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
  { value: "bank_deposit", label: "Bank Deposit" },
  { value: "stripe_card", label: "Card" },
  { value: "stripe_ach", label: "ACH Bank " },
  { value: "manual", label: "Manual Entry" },
];

const DONATION_CATEGORIES = [
  {
    value: "plate_collection",
    amharic: "መባ",
    english: "Plate Collection",
    label: "መባ — Plate Collection",
    type: "donation",
  },

  {
    value: "candle_sale",
    amharic: "ሻማ",
    english: "Candle Sale",
    label: "ሻማ — Candle Sale",
    type: "donation",
  },

  {
    value: "general_donation",
    amharic: "ስጦታ",
    english: "General Donation",
    label: "ስጦታ — General Donation",
    type: "donation",
  },

  {
    value: "tithe",
    amharic: "አስራት",
    english: "Tithe",
    label: "አስራት — Tithe",
    type: "donation",
  },

  {
    value: "vows",
    amharic: "ስዕለት",
    english: "Vows",
    label: "ስዕለት — Vows",
    type: "donation",
  },

  {
    value: "baptism",
    amharic: "ክርስትና",
    english: "Baptism",
    label: "ክርስትና — Baptism",
    type: "service",
  },

  {
    value: "wedding_engagement",
    amharic: "ጋብቻ / ቀለበት",
    english: "Wedding / Engagement",
    label: "ጋብቻ / ቀለበት — Wedding / Engagement",
    type: "service",
  },

  {
    value: "memorial_service",
    amharic: "ፍታት",
    english: "Memorial Service",
    label: "ፍታት — Memorial Service",
    type: "service",
  },

  {
    value: "pledge",
    amharic: "ቃል የተገባ",
    english: "Pledge",
    label: "ቃል የተገባ — Pledge",
    type: "receivable",
  },

  {
    value: "building_fund",
    amharic: "የቤተክርስቲያን ማሰሪያ",
    english: "Building Fund",
    label: "የቤተክርስቲያን ማሰሪያ — Building Fund",
    type: "fund",
  },

  {
    value: "charity_fund",
    amharic: "በጎ አድራጎት",
    english: "Charity Fund",
    label: "በጎ አድራጎት — Charity Fund",
    type: "fund",
  },

  {
    value: "auction",
    amharic: "ጨረታ",
    english: "Auction",
    label: "ጨረታ — Auction",
    type: "event",
  },

  {
    value: "other_fund",
    amharic: "ሌላ (ይገልፅ)",
    english: "Other Fund",
    label: "ሌላ (ይገልፅ) — Other Fund",
    type: "other",
  },
];
const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const emptyForm = {
  category: "membership",
  sub_category: "",
  payment_method: "cash",
  member_id: "",
  member_no: "",
  full_name: "",
  email: "",
  phone: "",
  amount: "",
  quantity: 1,
  months_paid: 1,
  coverage_start_month: new Date().getMonth() + 1,
  coverage_year: new Date().getFullYear(),
  received_date: "",
  reference_no: "",
  notes: "",
  send_receipt: true,
  create_invoice: true,
};

function money(value) {
  return Number(value || 0).toFixed(2);
}

function normalizeRows(data) {
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function isStripeMethod(method) {
  return method === "stripe_card" || method === "stripe_ach";
}

export default function FinanceManualEntryModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [plans, setPlans] = useState([]);
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!open) return;

    setForm(emptyForm);
    setErr("");
    loadPlans();
    loadEvents();
    loadMembers();
  }, [open]);

  async function loadPlans() {
    try {
      const { data } = await api.get("/dues/plans");
      setPlans(normalizeRows(data));
    } catch (error) {
      console.error("loadPlans error:", error);
      setPlans([]);
    }
  }

  async function loadEvents() {
    try {
      const [schoolRes, tripRes] = await Promise.all([
        api.get("/school/programs").catch(() => ({ data: { rows: [] } })),
        api.get("/trip/programs").catch(() => ({ data: { rows: [] } })),
      ]);

      const schoolPrograms = normalizeRows(schoolRes.data).map((r) => ({
        ...r,
        category: "school",
        title: r.title || r.program_name || "School Program",
        price: r.price_per_person || r.price || 0,
      }));

      const tripPrograms = normalizeRows(tripRes.data).map((r) => ({
        ...r,
        category: "trip",
        title: r.title || r.trip_name || "Trip Program",
        price: r.price_per_person || r.price || 0,
      }));

      setEvents([...schoolPrograms, ...tripPrograms]);
    } catch (error) {
      console.error("loadEvents error:", error);
      setEvents([]);
    }
  }

  async function loadMembers() {
    try {
      const { data } = await api.get("/finance/members", {
        params: {
          page: 1,
          limit: 500,
          pageSize: 500,
          search: "",
          q: "",
        },
      });

      setMembers(normalizeRows(data));
    } catch (error) {
      console.error("loadMembers error:", error);
      setMembers([]);
    }
  }

  const isMembership = form.category === "membership";
  const isDonation = form.category === "donation";
  const isSchool = form.category === "school";
  const isTrip = form.category === "trip";
  const isCheck = form.payment_method === "check";
  const isStripe = isStripeMethod(form.payment_method);

  const selectedPlan = useMemo(() => {
    return plans.find((p) => String(p.id) === String(form.sub_category));
  }, [plans, form.sub_category]);

  const filteredPrograms = useMemo(() => {
    return events.filter((ev) =>
      isSchool ? ev.category === "school" : ev.category === "trip"
    );
  }, [events, isSchool, isTrip]);

  const selectedProgram = useMemo(() => {
    return events.find((ev) => String(ev.id) === String(form.sub_category));
  }, [events, form.sub_category]);

  const coverageEndMonth = useMemo(() => {
    const start = Number(form.coverage_start_month || 1);
    const duration = Number(selectedPlan?.duration_months || form.months_paid || 1);

    let end = start + duration - 1;

    while (end > 12) {
      end -= 12;
    }

    return end;
  }, [form.coverage_start_month, form.months_paid, selectedPlan]);

  const calculatedAmount = useMemo(() => {
    if (isMembership) {
      return Number(
        selectedPlan?.minimum_amount ||
          selectedPlan?.amount ||
          form.amount ||
          0
      );
    }

    if (isSchool || isTrip) {
      return (
        Number(selectedProgram?.price_per_person || selectedProgram?.price || 0) *
        Number(form.quantity || 1)
      );
    }

    return Number(form.amount || 0);
  }, [isMembership, isSchool, isTrip, selectedPlan, selectedProgram, form.amount, form.quantity]);

  const valid = useMemo(() => {
    if (!form.category) return false;

    if (isMembership && !selectedPlan?.id) return false;

    if ((isSchool || isTrip) && !selectedProgram?.id) return false;

    if (form.category === "membership" && !form.member_id) return false;

    if (!calculatedAmount || Number(calculatedAmount) <= 0) return false;

    if (isStripe && !form.email) return false;

    return true;
  }, [form, selectedPlan, selectedProgram, calculatedAmount, isMembership, isSchool, isTrip, isStripe]);

  function upd(key, value) {
    setForm((s) => ({
      ...s,
      [key]: value,
    }));
  }

  function closeModal() {
    if (busy) return;

    setForm(emptyForm);
    setErr("");
    onClose?.();
  }

  function selectMember(memberId) {
    const selected = members.find((m) => String(m.id) === String(memberId));

    setForm((s) => ({
      ...s,
      member_id: selected?.id || "",
      member_no: selected?.member_no || "",
      full_name: selected?.full_name || "",
      email: selected?.email || "",
      phone: selected?.phone || "",
    }));
  }

  function selectPlan(planId) {
    const selected = plans.find((p) => String(p.id) === String(planId));

    setForm((s) => ({
      ...s,
      sub_category: planId,
      amount: selected?.minimum_amount || selected?.amount || "",
      months_paid: selected?.duration_months || 1,
    }));
  }

  function selectProgram(programId) {
    const selected = events.find((ev) => String(ev.id) === String(programId));

    setForm((s) => ({
      ...s,
      sub_category: programId,
      amount: selected?.price_per_person || selected?.price || "",
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");

    if (!valid) {
      setErr(
        isStripe && !form.email
          ? "Email is required for Stripe checkout."
          : "Please complete all required fields."
      );
      return;
    }

    try {
      setBusy(true);

      const amount = Number(calculatedAmount || 0);
      const coverageYear = Number(form.coverage_year || new Date().getFullYear());
      const coverageLabel = `${MONTHS.find((m) => Number(m.value) === Number(form.coverage_start_month))?.label || form.coverage_start_month} ${coverageYear} - ${MONTHS.find((m) => Number(m.value) === Number(coverageEndMonth))?.label || coverageEndMonth} ${coverageYear}`;

      if (isStripe) {
        const checkoutPayload = {
          category: form.category,
          payment_type: form.category,
          type: form.category,

          sub_category:
            selectedPlan?.plan_name ||
            selectedProgram?.title ||
            form.sub_category,

          member_id: form.member_id || null,
          member_no: form.member_no || null,
          full_name: form.full_name || null,
          email: form.email || null,
          phone: form.phone || null,

          payment_method:
            form.payment_method === "stripe_ach" ? "ach" : "card",
          method:
            form.payment_method === "stripe_ach" ? "ach" : "card",
          provider: "stripe",

          amount,
          total_amount: amount,
          quantity: Number(form.quantity || 1),

          plan_id: selectedPlan?.id || null,
          dues_plan_id: selectedPlan?.id || null,
          plan_name: selectedPlan?.plan_name || null,
          duration_months: Number(selectedPlan?.duration_months || form.months_paid || 1),
          months_paid: Number(selectedPlan?.duration_months || form.months_paid || 1),

          coverage_year: coverageYear,
          coverage_start_month: Number(form.coverage_start_month || 1),
          coverage_end_month: coverageEndMonth,
          coverage_label: isMembership ? coverageLabel : null,

          related_entity_id: selectedProgram?.id || null,
          news_event_id: selectedProgram?.id || null,
          program_id: selectedProgram?.id || null,
          program_name: selectedProgram?.title || null,
          program_title: selectedProgram?.title || null,

          donation_category: isDonation ? form.sub_category : null,

          source: "finance",
          created_from: "finance",
          send_receipt_email: true,
          create_invoice: true,
          create_ledger_entry: true,

          success_url:
            `${window.location.origin}/dash/finance/payments?status=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url:
            `${window.location.origin}/dash/finance/payments?status=cancelled`,
        };

        const { data } = await api.post("/checkout/create-session", checkoutPayload);

        const checkoutUrl = data?.url || data?.checkout_url || data?.stripe_url;

        if (checkoutUrl && typeof checkoutUrl === "string") {
          window.location.href = checkoutUrl;
          return;
        }

        throw new Error("Stripe checkout URL was not returned.");
      }

      await api.post("/finance/manual-entries", {
        category: form.category,
        payment_type: form.category,

        sub_category:
          selectedPlan?.plan_name ||
          selectedProgram?.title ||
          form.sub_category,

        payment_method: form.payment_method,
        method: form.payment_method,
        provider: form.payment_method,

        member_id: form.member_id || null,
        member_no: form.member_no || null,
        full_name: form.full_name || null,
        email: form.email || null,
        phone: form.phone || null,

        amount,
        total_amount: amount,
        quantity: Number(form.quantity || 1),

        plan_id: selectedPlan?.id || null,
        dues_plan_id: selectedPlan?.id || null,
        plan_name: selectedPlan?.plan_name || null,
        months_paid: Number(selectedPlan?.duration_months || form.months_paid || 1),

        coverage_year: isMembership ? coverageYear : null,
        coverage_start_month: isMembership ? Number(form.coverage_start_month || 1) : null,
        coverage_end_month: isMembership ? coverageEndMonth : null,
        coverage_label: isMembership ? coverageLabel : null,

        related_entity_id: selectedProgram?.id || null,
        program_id: selectedProgram?.id || null,
        program_title: selectedProgram?.title || null,

        received_date: form.received_date || null,
        reference_no: form.reference_no || null,
        notes: form.notes || null,

        send_receipt: !!form.send_receipt,
        send_receipt_email: !!form.send_receipt,
        create_invoice: !!form.create_invoice,
        create_ledger_entry: true,
      });

      onSaved?.();
      closeModal();
    } catch (e2) {
      console.error("Finance payment submit error:", e2);
      setErr(
        e2?.response?.data?.error ||
          e2?.response?.data?.message ||
          e2?.message ||
          "Failed to save payment."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="terms-overlay">
      <div className="finance-modal-card finance-modal-card-lg">
        <div className="finance-modal-head">
          <div>
            <p className="finance-modal-eyebrow">Unified Finance Payment</p>
            <h2>Record Payment</h2>
            <p>
              Enterprise payment processing for membership, donations, school,
              trip, pledge, ACH, Stripe card, and in-person collections.
            </p>
          </div>

          <button
            type="button"
            className="terms-close"
            onClick={closeModal}
            disabled={busy}
          >
            ✕
          </button>
        </div>

        <form className="finance-modal-form" onSubmit={submit}>
          <div className="auth-field">
            <label>Existing Member</label>

            <select value={form.member_id} onChange={(e) => selectMember(e.target.value)}>
              <option value="">Select Member</option>

              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.member_no || "MEM"} — {m.full_name} — {m.email || "No Email"}
                </option>
              ))}
            </select>
          </div>

          <div className="finance-modal-grid finance-modal-grid-2">
            <div className="auth-field">
              <label>Payment Category</label>

              <select
                value={form.category}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    category: e.target.value,
                    sub_category: "",
                    amount: "",
                    quantity: 1,
                    months_paid: 1,
                  }))
                }
              >
                {PAYMENT_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-field">
              <label>Payment Method</label>

              <select value={form.payment_method} onChange={(e) => upd("payment_method", e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="finance-modal-grid finance-modal-grid-2">
            <div className="auth-field">
              <label>Full Name</label>
              <input value={form.full_name} readOnly />
            </div>

            <div className="auth-field">
              <label>Email {isStripe ? "*" : ""}</label>
              <input
                value={form.email}
                onChange={(e) => upd("email", e.target.value)}
                readOnly={!!form.member_id}
              />
            </div>
          </div>

          {isMembership ? (
            <>
              <div className="finance-modal-grid finance-modal-grid-2">
                <div className="auth-field">
                  <label>Membership Plan *</label>

                  <select value={form.sub_category} onChange={(e) => selectPlan(e.target.value)}>
                    <option value="">Select Plan</option>

                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.plan_name || p.name} — {p.duration_months || 1} Months — $
                        {money(p.minimum_amount || p.amount)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="auth-field">
                  <label>Months Paid</label>
                  <input type="number" min="1" value={form.months_paid} readOnly />
                </div>
              </div>

              <div className="finance-modal-grid finance-modal-grid-3">
                <div className="auth-field">
                  <label>Coverage Start Month</label>

                  <select
                    value={form.coverage_start_month || 1}
                    onChange={(e) => upd("coverage_start_month", e.target.value)}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="auth-field">
                  <label>Coverage End Month</label>
                  <input
                    value={
                      MONTHS.find((m) => Number(m.value) === Number(coverageEndMonth))?.label ||
                      coverageEndMonth
                    }
                    disabled
                  />
                </div>

                <div className="auth-field">
                  <label>Coverage Year</label>
                  <input
                    type="number"
                    value={form.coverage_year || new Date().getFullYear()}
                    onChange={(e) => upd("coverage_year", e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : null}

          {isDonation ? (
            <div className="auth-field">
              <label>Donation Category</label>

              <select value={form.sub_category} onChange={(e) => upd("sub_category", e.target.value)}>
               {DONATION_CATEGORIES.map((d) => (
  <option
    key={d.value}
    value={d.value}
  >
    {d.amharic} — {d.english}
  </option>
))}
              </select>
            </div>
          ) : null}

          {(isSchool || isTrip) ? (
            <div className="auth-field">
              <label>Program *</label>

              <select value={form.sub_category} onChange={(e) => selectProgram(e.target.value)}>
                <option value="">Select Program</option>

                {filteredPrograms.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} — ${money(ev.price_per_person || ev.price)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="finance-modal-grid finance-modal-grid-2">
            <div className="auth-field">
              <label>Amount</label>
              <input
                type="number"
                step="0.01"
                value={calculatedAmount || ""}
                onChange={(e) => upd("amount", e.target.value)}
                readOnly={isMembership || isSchool || isTrip}
              />
            </div>

            <div className="auth-field">
              <label>Quantity</label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => upd("quantity", e.target.value)}
                disabled={isMembership}
              />
            </div>
          </div>

          {isCheck ? (
            <div className="auth-field">
              <label>Check Number</label>
              <input value={form.reference_no} onChange={(e) => upd("reference_no", e.target.value)} />
            </div>
          ) : null}

          <div className="auth-field">
            <label>Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => upd("notes", e.target.value)} />
          </div>

          <div className="finance-checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={form.send_receipt}
                onChange={(e) => upd("send_receipt", e.target.checked)}
              />
              Send Receipt
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.create_invoice}
                onChange={(e) => upd("create_invoice", e.target.checked)}
              />
              Create Invoice
            </label>
          </div>

          {err ? <div className="auth-banner">{err}</div> : null}

          <div className="finance-modal-actions">
            <button
              type="button"
              className="finance-btn finance-btn-secondary"
              onClick={closeModal}
              disabled={busy}
            >
              Cancel
            </button>

            <button type="submit" className="finance-btn finance-btn-primary" disabled={busy || !valid}>
              {busy
                ? "Processing..."
                : isStripe
                ? "Continue to Stripe"
                : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}