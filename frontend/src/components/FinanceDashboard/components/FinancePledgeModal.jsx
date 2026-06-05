// frontend/src/components/FinanceDashboard/components/FinancePledgeModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import FinanceMemberLookup from "./FinanceMemberLookup";
import { Landmark, Save } from "lucide-react";

import "../../../styles/finance-dashboard.css";


function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function FinancePledgeModal({
  open,
  pledge = null,
  onClose,
  onSuccess,
}) {
  const [campaigns, setCampaigns] = useState([]);
  const [payer, setPayer] = useState(null);

  const [form, setForm] = useState({
    campaign_id: "",
    pledge_type: "promise_to_pay",
    pledged_amount: "",
    upfront_amount: "",
    payment_method: "cash",
    due_date: "",
    reminder_date: "",
    frequency: "one_time",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const remainingBalance = useMemo(() => {
    return Math.max(Number(form.pledged_amount || 0) - Number(form.upfront_amount || 0), 0);
  }, [form.pledged_amount, form.upfront_amount]);

  useEffect(() => {
    if (!open) return;
    loadCampaigns();

    if (pledge) {
      setForm({
        campaign_id: pledge.campaign_id || "",
        pledge_type: pledge.pledge_type || "promise_to_pay",
        pledged_amount: pledge.pledged_amount || "",
        upfront_amount: pledge.upfront_amount || "",
        payment_method: pledge.payment_method || "cash",
        due_date: pledge.due_date?.slice?.(0, 10) || "",
        reminder_date: pledge.reminder_date?.slice?.(0, 10) || "",
        frequency: pledge.frequency || "one_time",
        notes: pledge.notes || "",
      });

      setPayer({
        type: pledge.member_id ? "member" : "guest",
        member_id: pledge.member_id || null,
        member: pledge.member || null,
        guest: pledge.guest || {
          full_name: pledge.full_name || "",
          email: pledge.email || "",
          phone: pledge.phone || "",
        },
      });
    }
  }, [open, pledge]);

  async function loadCampaigns() {
    try {
      const { data } = await api.get("/finance/campaigns", {
        params: { status: "active", limit: 100 },
      });
      setCampaigns(data?.rows || []);
    } catch (err) {
      console.error(err);
    }
  }

  function update(key, value) {
    setForm((s) => ({
      ...s,
      [key]: value,
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");

      if (!payer) throw new Error("Please select a member or guest donor.");
      if (!form.campaign_id) throw new Error("Please select a campaign.");
      if (Number(form.pledged_amount || 0) <= 0) throw new Error("Pledged amount is required.");

      const payload = {
        campaign_id: form.campaign_id,
        pledge_type: form.pledge_type,
        pledged_amount: Number(form.pledged_amount || 0),
        upfront_amount: Number(form.upfront_amount || 0),
        remaining_balance: remainingBalance,
        payment_method: form.payment_method,
        due_date: form.due_date || null,
        reminder_date: form.reminder_date || null,
        frequency: form.frequency,
        notes: form.notes,

        payer_type: payer.type,
        member_id: payer.member_id || null,
        guest: payer.guest || null,

        create_payment_now: Number(form.upfront_amount || 0) > 0,
      };

      if (pledge?.id) {
        await api.put(`/finance/pledges/${pledge.id}`, payload);
      } else {
        await api.post("/finance/pledges", payload);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Unable to save pledge.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="finance-modal-overlay">
      <div className="finance-payment-modal">
        <div className="finance-modal-header">
          <div className="finance-email-title-wrap">
            <Landmark size={18} />
            <div>
              <h2>{pledge ? "Edit Pledge" : "Create Pledge"}</h2>
              <p>Promise-to-pay, pay-now, and partial upfront pledge workflow.</p>
            </div>
          </div>

          <button className="finance-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {error ? <div className="finance-alert error">{error}</div> : null}

        <div className="finance-modal-body">
          <FinanceMemberLookup value={payer} onChange={setPayer} allowGuest allowCreate />

          <div className="finance-field">
            <label>Campaign</label>
            <select value={form.campaign_id} onChange={(e) => update("campaign_id", e.target.value)}>
              <option value="">Select campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} — {money(c.goal_amount)}
                </option>
              ))}
            </select>
          </div>

          <div className="finance-grid-2">
            <div className="finance-field">
              <label>Pledge Type</label>
              <select value={form.pledge_type} onChange={(e) => update("pledge_type", e.target.value)}>
                <option value="promise_to_pay">Promise To Pay Later</option>
                <option value="pay_now">Pay Full Amount Now</option>
                <option value="partial_upfront">Partial Payment Now</option>
              </select>
            </div>

            <div className="finance-field">
              <label>Frequency</label>
              <select value={form.frequency} onChange={(e) => update("frequency", e.target.value)}>
                <option value="one_time">One Time</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>

          <div className="finance-grid-2">
            <div className="finance-field">
              <label>Pledged Amount</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.pledged_amount}
                onChange={(e) => {
                  const value = e.target.value;
                  update("pledged_amount", value);

                  if (form.pledge_type === "pay_now") {
                    update("upfront_amount", value);
                  }
                }}
              />
            </div>

            <div className="finance-field">
              <label>Upfront Payment</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.upfront_amount}
                onChange={(e) => update("upfront_amount", e.target.value)}
                disabled={form.pledge_type === "promise_to_pay"}
              />
            </div>
          </div>

          <div className="finance-grid-2">
            <div className="finance-field">
              <label>Payment Method</label>
              <select value={form.payment_method} onChange={(e) => update("payment_method", e.target.value)}>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="zelle">Zelle</option>
                <option value="card">Card / Stripe</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <div className="finance-field">
              <label>Due Date</label>
              <input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} />
            </div>
          </div>

          <div className="finance-field">
            <label>Reminder Date</label>
            <input
              type="date"
              value={form.reminder_date}
              onChange={(e) => update("reminder_date", e.target.value)}
            />
          </div>

          <div className="finance-payment-total">
            <span>Remaining Balance</span>
            <strong>{money(remainingBalance)}</strong>
          </div>

          <div className="finance-field">
            <label>Notes</label>
            <textarea rows="4" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </div>
        </div>

        <div className="finance-modal-footer">
          <button className="finance-btn secondary" onClick={onClose}>
            Cancel
          </button>

          <button className="finance-btn primary" onClick={handleSave} disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save Pledge"}
          </button>
        </div>
      </div>
    </div>
  );
}