// frontend/src/components/FinanceDashboard/components/FinancePledgeModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  FileText,
  Mail,
  RefreshCcw,
  Search,
  Send,
  Target,
  UserRound,
  X,
} from "lucide-react";

import api from "../../api";

// import "../../../styles/finance-dashboard.css";
// import "../../../styles/finance-enterprise.css";
import "../../../styles/finance-enterprise.css";
const PAYER_TYPES = [
  { value: "member", label: "Member" },
  { value: "guest", label: "Non Member / Guest" },
];

const PLEDGE_TYPES = [
  { value: "promise_to_pay", label: "Promise To Pay" },
  { value: "partial_upfront", label: "Partial Upfront" },
  { value: "pay_now", label: "Pay Full Amount Now" },
];

const PAYMENT_METHODS = [
  { value: "card", label: "Card - Stripe" },
  { value: "ach", label: "ACH - Stripe" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
];

const EMPTY_GUEST = {
  full_name: "",
  email: "",
  phone: "",
};

function rowsFrom(data) {
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.members)) return data.members;
  if (Array.isArray(data)) return data;
  return [];
}

function clean(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function memberName(member = {}) {
  return (
    member.full_name ||
    `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
    "Unnamed Member"
  );
}

function isStripeMethod(method) {
  return method === "card" || method === "ach";
}

function methodNeedsReference(method) {
  return method === "check" || method === "zelle";
}

function normalizeCampaign(row = {}) {
  return {
    ...row,
    id: row.id || row.campaign_id,
    title: row.title || row.campaign_name || row.name || `Campaign #${row.id}`,
    goal_amount: row.goal_amount || row.target_amount || 0,
    status: row.status || "active",
  };
}

async function postFirst(paths, payload = {}) {
  let lastError = null;

  for (const path of paths.filter(Boolean)) {
    try {
      return await api.post(path, payload);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export default function FinancePledgeModal({
  open,
  pledge = null,
  member = null,
  onClose,
  onSuccess,
  onSaved,
}) {
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [members, setMembers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  const [memberSearch, setMemberSearch] = useState("");
  const [payerType, setPayerType] = useState(member ? "member" : "member");
  const [selectedMember, setSelectedMember] = useState(member || null);
  const [guest, setGuest] = useState(EMPTY_GUEST);

  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [pledgeType, setPledgeType] = useState("promise_to_pay");
  const [pledgedAmount, setPledgedAmount] = useState("");
  const [upfrontAmount, setUpfrontAmount] = useState("");
  const [method, setMethod] = useState("card");
  const [referenceNo, setReferenceNo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [sendInvoiceEmail, setSendInvoiceEmail] = useState(true);
  const [includePaymentLink, setIncludePaymentLink] = useState(true);
  const [sendReminderNow, setSendReminderNow] = useState(false);
  const [createInvoice, setCreateInvoice] = useState(true);
  const [enableRecurring, setEnableRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");

  useEffect(() => {
    if (!open) return;

    setError("");
    setSuccess("");
    setSaving(false);

    setPayerType(member ? "member" : pledge?.member_id ? "member" : "member");
    setSelectedMember(member || null);
    setGuest(EMPTY_GUEST);

    setSelectedCampaignId(pledge?.campaign_id || "");
    setPledgeType(pledge ? "partial_upfront" : "promise_to_pay");
    setPledgedAmount(pledge?.remaining_balance || pledge?.pledged_amount || "");
    setUpfrontAmount("");
    setMethod("card");
    setReferenceNo("");
    setDueDate(String(pledge?.due_date || "").slice(0, 10));
    setNotes(pledge?.notes || "");

    setSendInvoiceEmail(true);
    setIncludePaymentLink(true);
    setSendReminderNow(false);
    setCreateInvoice(true);
    setEnableRecurring(false);
    setRecurringFrequency("monthly");

    loadInitialData();
    loadMembers("");
  }, [open, member, pledge]);

  useEffect(() => {
    if (!open) return undefined;

    const timer = window.setTimeout(() => {
      loadMembers(memberSearch);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [memberSearch, open]);

  useEffect(() => {
    const pledged = numberValue(pledgedAmount);

    if (pledgeType === "promise_to_pay") {
      setUpfrontAmount("");
    }

    if (pledgeType === "pay_now") {
      setUpfrontAmount(pledged ? String(pledged) : "");
    }
  }, [pledgeType, pledgedAmount]);

  async function loadInitialData() {
    try {
      setLoading(true);

      const campaignsRes = await api.get("/finance/campaigns").catch(() => ({
        data: { rows: [] },
      }));

      setCampaigns(rowsFrom(campaignsRes.data).map(normalizeCampaign));
    } catch (err) {
      console.error("Pledge modal load failed:", err);
      setError("Unable to load pledge campaigns.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers(search = "") {
    try {
      setLoadingMembers(true);

      const { data } = await api.get("/finance/members", {
        params: {
          page: 1,
          limit: 100,
          pageSize: 100,
          q: search,
          search,
        },
      });

      setMembers(rowsFrom(data));
    } catch (err) {
      console.error("Failed to load members:", err);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => String(campaign.id) === String(selectedCampaignId)),
    [campaigns, selectedCampaignId]
  );

  const pledged = numberValue(pledgedAmount);
  const upfront = numberValue(upfrontAmount);
  const remaining = Math.max(pledged - upfront, 0);
  const progress = pledged > 0 ? Math.min((upfront / pledged) * 100, 100) : 0;

  const payerName =
    payerType === "member" ? memberName(selectedMember || {}) : guest.full_name;
  const payerEmail =
    payerType === "member" ? selectedMember?.email || "" : guest.email;
  const payerPhone =
    payerType === "member" ? selectedMember?.phone || "" : guest.phone;

  function updateGuest(key, value) {
    setGuest((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function validate() {
    if (payerType === "member" && !selectedMember?.id) {
      return "Please select a member.";
    }

    if (payerType === "guest") {
      if (!clean(guest.full_name)) return "Guest full name is required.";
      if ((sendInvoiceEmail || includePaymentLink || isStripeMethod(method)) && !clean(guest.email)) {
        return "Guest email is required for invoice, payment link, Card, or ACH.";
      }
    }

    if (!selectedCampaign?.id) return "Please select a campaign.";
    if (pledged <= 0) return "Pledged amount must be greater than zero.";
    if (upfront > pledged) return "Upfront amount cannot exceed pledged amount.";

    if (pledgeType === "partial_upfront" && upfront <= 0) {
      return "Partial upfront pledge requires an upfront amount.";
    }

    if (pledgeType === "pay_now" && upfront !== pledged) {
      return "Pay Full Amount Now must equal the pledged amount.";
    }

    if (methodNeedsReference(method) && upfront > 0 && !clean(referenceNo)) {
      return "Reference number is required for Check or Zelle upfront payments.";
    }

    if (isStripeMethod(method) && upfront <= 0 && pledgeType !== "promise_to_pay") {
      return "Card or ACH requires an upfront payment amount.";
    }

    return "";
  }

  function payerPayload() {
    return {
      payer_type: payerType,
      donor_type: payerType,
      member_id: payerType === "member" ? selectedMember?.id || null : null,
      member_no: payerType === "member" ? selectedMember?.member_no || null : null,
      full_name: payerName || null,
      email: payerEmail || null,
      phone: payerPhone || null,
      guest_name: payerType === "guest" ? payerName || null : null,
      guest_email: payerType === "guest" ? payerEmail || null : null,
      guest_phone: payerType === "guest" ? payerPhone || null : null,
    };
  }

  function buildPayload() {
    return {
      ...payerPayload(),

      pledge_id: pledge?.id || null,
      campaign_id: selectedCampaign?.id,
      campaign_name: selectedCampaign?.title,

      pledge_type: pledgeType,
      category: "pledge",
      payment_type: "pledge",
      type: "pledge",

      pledged_amount: pledged,
      amount: pledged,
      total_amount: pledged,

      upfront_amount: upfront,
      paid_amount: upfront,
      remaining_balance: remaining,
      balance_due: remaining,

      payment_method: upfront > 0 ? method : null,
      method: upfront > 0 ? method : null,
      provider: upfront > 0 && isStripeMethod(method) ? "stripe" : method,
      reference_no: referenceNo || null,

      due_date: dueDate || null,
      notes: notes || null,

      status: remaining <= 0 ? "paid" : "active",
      pledge_status: remaining <= 0 ? "paid" : "active",

      create_invoice: !!createInvoice,
      send_invoice_email: !!sendInvoiceEmail,
      include_payment_link: !!includePaymentLink,
      create_payment_link: !!includePaymentLink,
      send_reminder_now: !!sendReminderNow,

      is_recurring: !!enableRecurring,
      recurring_frequency: enableRecurring ? recurringFrequency : null,

      source: "finance",
      created_from: "finance_pledge_modal",
    };
  }

  function checkoutPayload(payload) {
    return {
      ...payload,
      process_direct_payment: false,
      success_url: `${window.location.origin}/dash/finance/payments?pledge=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${window.location.origin}/dash/finance/payments?pledge=cancelled`,
    };
  }

  async function submitStripe(payload) {
    const { data } = await api.post("/checkout/create-session", checkoutPayload(payload));
    const checkoutUrl = data?.url || data?.checkout_url || data?.stripe_url;

    if (!checkoutUrl) {
      throw new Error("Stripe checkout URL missing from backend.");
    }

    window.location.href = checkoutUrl;
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const validationError = validate();

      if (validationError) {
        setError(validationError);
        return;
      }

      const payload = buildPayload();

      if (upfront > 0 && isStripeMethod(method)) {
        await submitStripe({
          ...payload,
          amount: upfront,
          total_amount: upfront,
        });
        return;
      }

      if (pledge?.id) {
        await postFirst(
          [
            `/finance/pledges/${pledge.id}`,
            `/finance/pledges/${pledge.id}/update`,
          ],
          payload
        );
      } else {
        await postFirst(["/finance/pledges"], payload);
      }

      setSuccess("Pledge saved successfully.");
      onSuccess?.();
      onSaved?.();

      window.setTimeout(() => {
        onClose?.();
      }, 500);
    } catch (err) {
      console.error("Pledge save failed:", err);

      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Unable to save pledge."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="finance-modal-overlay">
      <div className="finance-payment-modal finance-payment-modal-enterprise">
        <div className="finance-modal-header">
          <div>
            <h2>{pledge ? "Update Pledge" : "Create Pledge"}</h2>
            <p>
              Create member or non-member pledges with invoice, payment link,
              reminder, recurring intent, and optional upfront payment.
            </p>
          </div>

          <button
            type="button"
            className="finance-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close pledge modal"
          >
            <X size={18} strokeWidth={2.1} />
          </button>
        </div>

        {error ? (
          <div className="finance-alert error">
            <AlertTriangle size={16} strokeWidth={2.1} />
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="finance-alert success">
            <CheckCircle2 size={16} strokeWidth={2.1} />
            {success}
          </div>
        ) : null}

        <div className="finance-modal-body">
          <div className="finance-grid-3">
            <div className="finance-field">
              <label>Payer Type</label>
              <select
                value={payerType}
                onChange={(event) => {
                  setPayerType(event.target.value);
                  if (event.target.value === "guest") setSelectedMember(null);
                }}
              >
                {PAYER_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="finance-field">
              <label>Pledge Type</label>
              <select
                value={pledgeType}
                onChange={(event) => setPledgeType(event.target.value)}
              >
                {PLEDGE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="finance-field">
              <label>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          {payerType === "member" ? (
            <section className="finance-card finance-member-picker">
              <div className="finance-field">
                <label>Search Member</label>
                <div className="finance-input-with-icon">
                  <Search size={16} strokeWidth={2.1} />
                  <input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Search by member ID, name, email, or phone"
                  />
                </div>
              </div>

              <div className="finance-field">
                <label>Member *</label>
                <select
                  value={selectedMember?.id || ""}
                  onChange={(event) => {
                    const found = members.find(
                      (row) => String(row.id) === String(event.target.value)
                    );
                    setSelectedMember(found || null);
                  }}
                >
                  <option value="">
                    {loadingMembers ? "Loading members..." : "Select member"}
                  </option>
                  {members.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.member_no || "MEM"} - {memberName(row)} -{" "}
                      {row.email || "No email"}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          ) : (
            <div className="finance-grid-3">
              <div className="finance-field">
                <label>Guest Full Name *</label>
                <input
                  value={guest.full_name}
                  onChange={(event) => updateGuest("full_name", event.target.value)}
                />
              </div>

              <div className="finance-field">
                <label>Guest Email</label>
                <input
                  type="email"
                  value={guest.email}
                  onChange={(event) => updateGuest("email", event.target.value)}
                />
              </div>

              <div className="finance-field">
                <label>Guest Phone</label>
                <input
                  value={guest.phone}
                  onChange={(event) => updateGuest("phone", event.target.value)}
                />
              </div>
            </div>
          )}

          <div className="finance-field">
            <label>Campaign *</label>
            <select
              value={selectedCampaignId}
              onChange={(event) => setSelectedCampaignId(event.target.value)}
              disabled={loading}
            >
              <option value="">Select campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title} - Goal {money(campaign.goal_amount)}
                </option>
              ))}
            </select>
          </div>

          <div className="finance-grid-3">
            <div className="finance-field">
              <label>Pledged Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={pledgedAmount}
                onChange={(event) => setPledgedAmount(event.target.value)}
              />
            </div>

            <div className="finance-field">
              <label>Upfront Payment</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={upfrontAmount}
                onChange={(event) => setUpfrontAmount(event.target.value)}
                disabled={pledgeType === "promise_to_pay"}
              />
            </div>

            <div className="finance-field">
              <label>Payment Method</label>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                disabled={upfront <= 0}
              >
                {PAYMENT_METHODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {methodNeedsReference(method) && upfront > 0 ? (
            <div className="finance-field">
              <label>Reference Number *</label>
              <input
                value={referenceNo}
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="Check number or Zelle confirmation"
              />
            </div>
          ) : null}

          <div className="finance-field">
            <label>Notes</label>
            <textarea
              rows="3"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="finance-grid-3">
            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={createInvoice}
                onChange={(event) => setCreateInvoice(event.target.checked)}
              />
              <span>
                <FileText size={14} strokeWidth={2.1} />
                Create Invoice
              </span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={sendInvoiceEmail}
                onChange={(event) => setSendInvoiceEmail(event.target.checked)}
              />
              <span>
                <Mail size={14} strokeWidth={2.1} />
                Email Invoice
              </span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={includePaymentLink}
                onChange={(event) => setIncludePaymentLink(event.target.checked)}
              />
              <span>Include Payment Link</span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={sendReminderNow}
                onChange={(event) => setSendReminderNow(event.target.checked)}
              />
              <span>
                <Send size={14} strokeWidth={2.1} />
                Send Reminder Now
              </span>
            </label>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={enableRecurring}
                onChange={(event) => setEnableRecurring(event.target.checked)}
                disabled={!isStripeMethod(method)}
              />
              <span>Recurring Intent</span>
            </label>

            {enableRecurring ? (
              <div className="finance-field">
                <label>Frequency</label>
                <select
                  value={recurringFrequency}
                  onChange={(event) => setRecurringFrequency(event.target.value)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            ) : null}
          </div>

          <section className="finance-card finance-review-card">
            <div className="finance-payment-total">
              <span>
                <UserRound size={14} strokeWidth={2.1} />
                Donor
              </span>
              <strong>{payerName || "Not selected"}</strong>
            </div>

            <div className="finance-payment-total">
              <span>
                <Target size={14} strokeWidth={2.1} />
                Campaign
              </span>
              <strong>{selectedCampaign?.title || "--"}</strong>
            </div>

            <div className="finance-payment-total">
              <span>Pledged</span>
              <strong>{money(pledged)}</strong>
            </div>

            <div className="finance-payment-total">
              <span>Upfront</span>
              <strong>{money(upfront)}</strong>
            </div>

            <div className="finance-payment-total finance-payment-total-strong">
              <span>Remaining</span>
              <strong>{money(remaining)}</strong>
            </div>

            <div className="finance-progress-cell">
              <div className="finance-progress-wrap">
                <div
                  className="finance-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span>{progress.toFixed(0)}%</span>
            </div>
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
            disabled={saving || loading}
          >
            {saving ? (
              <>
                <RefreshCcw size={16} strokeWidth={2.1} />
                Saving...
              </>
            ) : upfront > 0 && isStripeMethod(method) ? (
              <>
                <CreditCard size={16} strokeWidth={2.1} />
                Continue To Checkout
              </>
            ) : (
              <>
                <CheckCircle2 size={16} strokeWidth={2.1} />
                Save Pledge
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}