// frontend/src/components/FinanceDashboard/components/FinancePaymentModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";

import "../../../styles/finance-dashboard.css";
const PAYMENT_TYPES = [
  { value: "membership", label: "Membership" },
  { value: "donation", label: "Donation" },
  { value: "school", label: "Kids School" },
  { value: "trip", label: "Trip" },
  { value: "pledge", label: "Pledge" },
];

const PAYMENT_METHODS = [
  { value: "card", label: "Card — Stripe Checkout" },
  { value: "ach", label: "ACH Bank Transfer — Stripe Checkout" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
  { value: "bank_deposit", label: "Bank Deposit" },
  { value: "manual", label: "Manual Entry" },
];

const DONATION_CATEGORIES = [
  { value: "plate_collection", label: "መባ — Plate Collection" },
  { value: "candle_sale", label: "ሻማ — Candle Sale" },
  { value: "general_donation", label: "ስጦታ — General Donation" },
  { value: "tithe", label: "አስራት — Tithe" },
  { value: "vows", label: "ስዕለት — Vows" },
  { value: "baptism", label: "ክርስትና — Baptism" },
  { value: "wedding_engagement", label: "ጋብቻ — Wedding / Engagement" },
  { value: "memorial_service", label: "ፍታት — Memorial Service" },
  { value: "pledge", label: "ቃል ኪዳን — Pledge" },
  { value: "building_fund", label: "የህንፃ ፈንድ — Building Fund" },
  { value: "charity_fund", label: "የበጎ አድራጎት ፈንድ — Charity Fund" },
  { value: "auction", label: "ጨረታ — Auction" },
  { value: "other_fund", label: "ሌላ — Other" },
];

const MONTH_OPTIONS = [
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

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function clean(value) {
  return String(value || "").trim();
}

function isStripeMethod(method) {
  return method === "card" || method === "ach";
}

function rowsFrom(data) {
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.members)) return data.members;
  if (Array.isArray(data)) return data;
  return [];
}

function memberName(m = {}) {
  return (
    m.full_name ||
    `${m.first_name || ""} ${m.last_name || ""}`.trim() ||
    "Unnamed Member"
  );
}

export default function FinancePaymentModal({
  open,
  onClose,
  onSuccess,
  onSaved,
  member,
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [plans, setPlans] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState(member || null);

  const [paymentType, setPaymentType] = useState("membership");
  const [method, setMethod] = useState("card");
  const [payerType, setPayerType] = useState("member");

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState("");
  const [pledgedAmount, setPledgedAmount] = useState("");
  const [upfrontAmount, setUpfrontAmount] = useState("");
  const [pledgeType, setPledgeType] = useState("promise_to_pay");

  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [donationCategory, setDonationCategory] = useState("general_donation");

  const [coverageYear, setCoverageYear] = useState(new Date().getFullYear());
  const [coverageStartMonth, setCoverageStartMonth] = useState(
    new Date().getMonth() + 1
  );

  const [sendReceiptEmail, setSendReceiptEmail] = useState(true);
  const [createInvoice, setCreateInvoice] = useState(true);
  const [createLedgerEntry, setCreateLedgerEntry] = useState(true);

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");

  useEffect(() => {
    if (!open) return;

    setError("");
    setSaving(false);
    setSelectedMember(member || null);
    setPayerType(member ? "member" : "member");

    loadInitial();
    loadMembers("");
  }, [open, member]);

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      loadMembers(memberSearch);
    }, 350);

    return () => clearTimeout(timer);
  }, [memberSearch, open]);


 async function loadInitial() {
  try {
    const [plansRes, schoolRes, tripRes, campaignsRes] = await Promise.all([
      api.get("/dues/plans"),
      api.get("/school/programs").catch(() => ({ data: { rows: [] } })),
      api.get("/trip/programs").catch(() => ({ data: { rows: [] } })),
      api.get("/finance/campaigns").catch(() => ({ data: { rows: [] } })),
    ]);

    setPlans(rowsFrom(plansRes.data));
    setPrograms([
      ...rowsFrom(schoolRes.data),
      ...rowsFrom(tripRes.data),
    ]);
    setCampaigns(rowsFrom(campaignsRes.data));
  } catch (err) {
    console.error("Finance modal load failed:", err);
  }
}
  async function loadMembers(search = "") {
    try {
      setLoadingMembers(true);

      const { data } = await api.get("/finance/members", {
        params: {
          page: 1,
          limit: 500,
          pageSize: 500,
          search,
          q: search,
          status: "",
          active: "",
          householdType: "",
        },
      });

      setMembers(rowsFrom(data));
    } catch (err) {
      console.error("Failed to load finance members:", err);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }

  const filteredPrograms = useMemo(() => {
    return programs.filter((p) =>
      paymentType === "school" ? p.category === "kids" : p.category === "trip"
    );
  }, [programs, paymentType]);

  const planRow = useMemo(() => {
    return plans.find((p) => String(p.id) === String(selectedPlan));
  }, [plans, selectedPlan]);

  const programRow = useMemo(() => {
    return filteredPrograms.find((p) => String(p.id) === String(selectedProgram));
  }, [filteredPrograms, selectedProgram]);

  const calculatedTotal = useMemo(() => {
    if (paymentType === "membership") {
    return Number(
  planRow?.minimum_amount ||
  planRow?.amount ||
  0
);
    }

    if (paymentType === "school" || paymentType === "trip") {
      return Number(
  programRow?.price_per_person ||
  programRow?.price ||
  0
) * Number(quantity || 1);
    }

    if (paymentType === "pledge") {
      return Number(upfrontAmount || 0);
    }

    return Number(amount || 0);
  }, [paymentType, amount, planRow, quantity, programRow, upfrontAmount]);

  const pledgeRemaining = useMemo(() => {
    return Math.max(Number(pledgedAmount || 0) - Number(upfrontAmount || 0), 0);
  }, [pledgedAmount, upfrontAmount]);

 const coverageEndMonth =
  useMemo(() => {

    const start =
      Number(
        coverageStartMonth || 1
      );

    const duration =
      Number(
        planRow?.duration_months || 1
      );

    return Math.min(
      12,
      start + duration - 1
    );

  }, [
    coverageStartMonth,
    planRow,
  ]);
  const selectedPayerName =
    payerType === "member" ? memberName(selectedMember || {}) : guestName;

  const selectedPayerEmail =
    payerType === "member" ? selectedMember?.email || "" : guestEmail;

  function validate() {
    if (payerType === "member" && !selectedMember?.id) {
      return "Please select a member.";
    }

    if (payerType === "guest" && !clean(guestName)) {
      return "Guest full name is required.";
    }

    if (paymentType === "membership" && !planRow?.id) {
      return "Please select a membership plan.";
    }

    if ((paymentType === "school" || paymentType === "trip") && !programRow?.id) {
      return "Please select a program.";
    }

    if (paymentType === "pledge") {
      if (!Number(pledgedAmount || 0)) return "Pledged amount is required.";
      if (pledgeType !== "promise_to_pay" && !Number(upfrontAmount || 0)) {
        return "Upfront payment is required.";
      }
    }

    if (!calculatedTotal || Number(calculatedTotal) <= 0) {
      return "Payment amount must be greater than zero.";
    }

    return "";
  }

  function buildPayload() {
    const payload = {
      payment_type: paymentType,
      category: paymentType,

      method,
      payment_method: method,
      provider: isStripeMethod(method) ? "stripe" : method,

      amount: Number(calculatedTotal || 0),
      total_amount: Number(calculatedTotal || 0),

      notes,
      reference_no: referenceNo || null,

      send_receipt_email: !!sendReceiptEmail,
      create_invoice: !!createInvoice,
      create_ledger_entry: !!createLedgerEntry,

      payer_type: payerType,

      member_id: payerType === "member" ? selectedMember?.id : null,
      member_no: payerType === "member" ? selectedMember?.member_no : null,

      full_name: payerType === "member" ? memberName(selectedMember) : guestName,
      email: payerType === "member" ? selectedMember?.email : guestEmail,
      phone: payerType === "member" ? selectedMember?.phone : guestPhone,

      guest:
        payerType === "guest"
          ? {
              full_name: guestName,
              email: guestEmail,
              phone: guestPhone,
            }
          : null,
    };

    if (paymentType === "membership") {
      payload.plan_id = planRow?.id;
      payload.dues_plan_id = planRow?.id;
      payload.plan_name = planRow?.plan_name;
      payload.sub_category = planRow?.plan_name;
      payload.months_paid = Number(planRow?.duration_months || 1);
      payload.duration_months = Number(planRow?.duration_months || 1);
      payload.coverage_year = Number(coverageYear);
      payload.coverage_start_month = Number(coverageStartMonth);
      payload.coverage_end_month = Number(coverageEndMonth);
    }

    if (paymentType === "donation") {
      payload.sub_category = donationCategory;
      payload.donation_category = donationCategory;
      payload.is_recurring = !!isRecurring;
      payload.recurring_frequency = recurringFrequency;
    }

    if (paymentType === "school" || paymentType === "trip") {
      payload.related_entity_id = programRow?.id;
      payload.program_id = programRow?.id;
      payload.news_event_id = programRow?.id;
      payload.quantity = Number(quantity || 1);
      payload.program_title = programRow?.title;
      payload.program_name = programRow?.title;
      payload.sub_category = programRow?.title;
      payload.event_date = programRow?.start_date;
    }

    if (paymentType === "pledge") {
      payload.pledge_id = selectedCampaign || null;
      payload.campaign_id = selectedCampaign || null;
      payload.pledge_type = pledgeType;
      payload.pledged_amount = Number(pledgedAmount || 0);
      payload.upfront_amount = Number(upfrontAmount || 0);
      payload.remaining_balance = pledgeRemaining;

      payload.pledge = {
        campaign_id: selectedCampaign,
        pledge_type: pledgeType,
        pledged_amount: Number(pledgedAmount || 0),
        upfront_amount: Number(upfrontAmount || 0),
        remaining_balance: pledgeRemaining,
        status: pledgeRemaining > 0 ? "active" : "completed",
      };
    }

    return payload;
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      const validationError = validate();

      if (validationError) {
        setError(validationError);
        setSaving(false);
        return;
      }

      const payload = buildPayload();

      if (isStripeMethod(method)) {
   const { data } = await api.post("/checkout/create-session", {
          ...payload,
          source: "finance",
          created_from: "finance",
          process_direct_payment: false,
          success_url:
            `${window.location.origin}/dash/finance/payments?status=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url:
            `${window.location.origin}/dash/finance/payments?status=cancelled`,
        });

        const checkoutUrl = data?.url || data?.checkout_url || data?.stripe_url;

        if (!checkoutUrl) {
          throw new Error("Stripe checkout URL missing from backend.");
        }

        window.location.href = checkoutUrl;
        return;
      }

      await api.post("/finance/payments", {
        ...payload,
        status: "paid",
        payment_status: "paid",
        source: "finance",
      });

      onSuccess?.();
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Unable to create payment."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="finance-modal-overlay">
      <div className="finance-payment-modal">
        <div className="finance-modal-header">
          <div>
            <h2>Finance Payment Center</h2>
            <p>
              Search members, process Stripe Card/ACH checkout, or record
              cash/check/Zelle payments with invoice, receipt, email, and ledger.
            </p>
          </div>

          <button
            type="button"
            className="finance-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>

        {error ? <div className="finance-alert error">{error}</div> : null}

        <div className="finance-modal-body">
          <div className="finance-grid-2">
            <div className="finance-field">
              <label>Payer Type</label>
              <select
                value={payerType}
                onChange={(e) => {
                  setPayerType(e.target.value);
                  if (e.target.value === "guest") setSelectedMember(null);
                }}
              >
                <option value="member">Member</option>
                <option value="guest">Guest / Non Member</option>
              </select>
            </div>

            <div className="finance-field">
              <label>Payment Type</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
              >
                {PAYMENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {payerType === "member" ? (
            <section className="finance-card" style={{ marginBottom: 14 }}>
              <div className="finance-field">
                <label>Search Member</label>
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search by member ID, name, email, or phone..."
                />
              </div>

              <div className="finance-field">
                <label>Member *</label>
                <select
                  value={selectedMember?.id || ""}
                  onChange={(e) => {
                    const found = members.find(
                      (m) => String(m.id) === String(e.target.value)
                    );
                    setSelectedMember(found || null);
                  }}
                >
                  <option value="">
                    {loadingMembers ? "Loading members..." : "Select member"}
                  </option>

                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.member_no || "MEM"} — {memberName(m)} —{" "}
                      {m.email || "No email"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedMember ? (
                <div className="finance-payment-total">
                  <span>
                    {selectedMember.member_no || "--"} ·{" "}
                    {selectedMember.email || "No email"} ·{" "}
                    {selectedMember.phone || "No phone"}
                  </span>
                  <strong>{memberName(selectedMember)}</strong>
                </div>
              ) : null}
            </section>
          ) : (
            <div className="finance-grid-3">
              <div className="finance-field">
                <label>Guest Full Name *</label>
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>

              <div className="finance-field">
                <label>Guest Email</label>
                <input
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>

              <div className="finance-field">
                <label>Guest Phone</label>
                <input
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="finance-field">
            <label>Payment Method *</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {paymentType === "membership" ? (
            <>
              <div className="finance-field">
                <label>Membership Plan *</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                >
                  <option value="">Select Plan</option>
                 {plans.map((p) => (
  <option key={p.id} value={p.id}>
    {p.plan_name || p.name}
    {" — "}
    {p.duration_months || 1}
    {" Month"}
    {Number(p.duration_months || 1) > 1 ? "s" : ""}
    {" — "}
    {money(p.minimum_amount || p.amount)}
  </option>
))}
                </select>
              </div>

              <div className="finance-grid-2">
                <div className="finance-field">
                  <label>Coverage Start Month</label>
                  <select
                    value={coverageStartMonth}
                    onChange={(e) =>
                      setCoverageStartMonth(Number(e.target.value))
                    }
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="finance-field">
                  <label>Coverage Year</label>
                  <input
                    type="number"
                    value={coverageYear}
                    onChange={(e) => setCoverageYear(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : null}

          {paymentType === "donation" ? (
            <>
              <div className="finance-field">
                <label>Donation Category</label>
                <select
                  value={donationCategory}
                  onChange={(e) => setDonationCategory(e.target.value)}
                >
                  {DONATION_CATEGORIES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="finance-field">
                <label>Amount *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <label className="finance-checkbox-row">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                <span>Recurring Donation</span>
              </label>

              {isRecurring ? (
                <div className="finance-field">
                  <label>Frequency</label>
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

          {paymentType === "school" || paymentType === "trip" ? (
            <>
              <div className="finance-field">
  <label>Program *</label>

  <select
    value={selectedProgram}
    onChange={(e) =>
      setSelectedProgram(
        e.target.value
      )
    }
  >
    <option value="">
      Select Program
    </option>

    {filteredPrograms.map((p) => {

      const title =
        p.title ||
        p.program_name ||
        p.trip_name ||
        "Unnamed Program";

      const price =
        p.price_per_person ||
        p.price ||
        0;

      return (
        <option
          key={p.id}
          value={p.id}
        >
          {title}
          {" — "}
          {money(price)}
        </option>
      );
    })}
  </select>
</div>

              <div className="finance-field">
                <label>Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </>
          ) : null}

          {paymentType === "pledge" ? (
            <>
              <div className="finance-field">
                <label>Campaign</label>
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                >
                  <option value="">Select Campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="finance-field">
                <label>Pledge Type</label>
                <select
                  value={pledgeType}
                  onChange={(e) => setPledgeType(e.target.value)}
                >
                  <option value="promise_to_pay">Promise To Pay</option>
                  <option value="pay_now">Pay Now</option>
                  <option value="partial_upfront">Partial Upfront</option>
                </select>
              </div>

              <div className="finance-grid-2">
                <div className="finance-field">
                  <label>Pledged Amount</label>
                  <input
                    type="number"
                    value={pledgedAmount}
                    onChange={(e) => setPledgedAmount(e.target.value)}
                  />
                </div>

                <div className="finance-field">
                  <label>Upfront Payment</label>
                  <input
                    type="number"
                    value={upfrontAmount}
                    onChange={(e) => setUpfrontAmount(e.target.value)}
                    disabled={pledgeType === "promise_to_pay"}
                  />
                </div>
              </div>

              <div className="finance-payment-total">
                <span>Remaining Pledge Balance</span>
                <strong>{money(pledgeRemaining)}</strong>
              </div>
            </>
          ) : null}

          {!isStripeMethod(method) ? (
            <div className="finance-field">
              <label>Reference #</label>
              <input
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Check number, Zelle ref, bank deposit ref..."
              />
            </div>
          ) : null}

          <div className="finance-field">
            <label>Notes</label>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="finance-grid-3">
            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={sendReceiptEmail}
                onChange={(e) => setSendReceiptEmail(e.target.checked)}
              />
              <span>Email Receipt</span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={createInvoice}
                onChange={(e) => setCreateInvoice(e.target.checked)}
              />
              <span>Create Invoice</span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={createLedgerEntry}
                onChange={(e) => setCreateLedgerEntry(e.target.checked)}
              />
              <span>Post Ledger</span>
            </label>
          </div>

          <section className="finance-card">
            <div className="finance-payment-total">
              <span>Payer</span>
              <strong>{selectedPayerName || "Not selected"}</strong>
            </div>

            <div className="finance-payment-total">
              <span>Payment Method</span>
              <strong>
                {isStripeMethod(method)
                  ? method === "ach"
                    ? "ACH via Stripe Checkout"
                    : "Card via Stripe Checkout"
                  : "Manual / In-Person"}
              </strong>
            </div>

            <div className="finance-payment-total">
              <span>Total Amount</span>
              <strong>{money(calculatedTotal)}</strong>
            </div>

            {selectedPayerEmail ? (
              <div className="finance-payment-total">
                <span>Receipt Email</span>
                <strong>{selectedPayerEmail}</strong>
              </div>
            ) : null}
          </section>
        </div>

        <div className="finance-modal-footer">
          <button
            type="button"
            className="finance-btn secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? "Processing..."
              : isStripeMethod(method)
              ? "Continue To Stripe Checkout"
              : "Create Invoice, Receipt & Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}