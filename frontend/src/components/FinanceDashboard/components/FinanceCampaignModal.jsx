// frontend/src/components/FinanceDashboard/components/FinanceCampaignModal.jsx

import React, { useEffect, useState } from "react";
import api from "../../api";
import { Target, Save } from "lucide-react";
// import "../finance-dashboard.css";

export default function FinanceCampaignModal({
  open,
  campaign = null,
  onClose,
  onSuccess,
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    goal_amount: "",
    start_date: "",
    end_date: "",
    status: "active",
    fund_category: "building_fund",
    is_public: true,
  });

  useEffect(() => {
    if (!open) return;

    setError("");

    if (campaign) {
      setForm({
        title: campaign.title || "",
        description: campaign.description || "",
        goal_amount: campaign.goal_amount || "",
        start_date: campaign.start_date?.slice?.(0, 10) || "",
        end_date: campaign.end_date?.slice?.(0, 10) || "",
        status: campaign.status || "active",
        fund_category: campaign.fund_category || "building_fund",
        is_public: Boolean(campaign.is_public ?? true),
      });
    } else {
      setForm({
        title: "",
        description: "",
        goal_amount: "",
        start_date: "",
        end_date: "",
        status: "active",
        fund_category: "building_fund",
        is_public: true,
      });
    }
  }, [open, campaign]);

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

      const payload = {
        ...form,
        goal_amount: Number(form.goal_amount || 0),
      };

      if (!payload.title.trim()) {
        throw new Error("Campaign title is required.");
      }

      if (payload.goal_amount <= 0) {
        throw new Error("Goal amount must be greater than zero.");
      }

      if (campaign?.id) {
        await api.put(`/finance/campaigns/${campaign.id}`, payload);
      } else {
        await api.post("/finance/campaigns", payload);
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Unable to save campaign.");
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
            <Target size={18} />
            <div>
              <h2>{campaign ? "Edit Campaign" : "Create Campaign"}</h2>
              <p>Enterprise fundraising campaign setup.</p>
            </div>
          </div>

          <button className="finance-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {error ? <div className="finance-alert error">{error}</div> : null}

        <div className="finance-modal-body">
          <div className="finance-field">
            <label>Campaign Title</label>
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Building Fund 2026"
            />
          </div>

          <div className="finance-field">
            <label>Description</label>
            <textarea
              rows="4"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Campaign purpose and details"
            />
          </div>

          <div className="finance-grid-2">
            <div className="finance-field">
              <label>Goal Amount</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.goal_amount}
                onChange={(e) => update("goal_amount", e.target.value)}
              />
            </div>

            <div className="finance-field">
              <label>Fund Category</label>
              <select
                value={form.fund_category}
                onChange={(e) => update("fund_category", e.target.value)}
              >
                <option value="building_fund">Building Fund</option>
                <option value="charity_fund">Charity Fund</option>
                <option value="general_donation">General Donation</option>
                <option value="pledge">Pledge</option>
                <option value="other_fund">Other Fund</option>
              </select>
            </div>
          </div>

          <div className="finance-grid-2">
            <div className="finance-field">
              <label>Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => update("start_date", e.target.value)}
              />
            </div>

            <div className="finance-field">
              <label>End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => update("end_date", e.target.value)}
              />
            </div>
          </div>

          <div className="finance-grid-2">
            <div className="finance-field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => update("status", e.target.value)}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <label className="finance-checkbox-row">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(e) => update("is_public", e.target.checked)}
              />
              <span>Show campaign publicly</span>
            </label>
          </div>
        </div>

        <div className="finance-modal-footer">
          <button className="finance-btn secondary" onClick={onClose}>
            Cancel
          </button>

          <button className="finance-btn primary" onClick={handleSave} disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save Campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}