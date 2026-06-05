import React, { useState } from "react";
import api from "../../api";

export default function Settings() {
  const [form, setForm] = useState({
    auto_match_enabled: true,
    amount_tolerance: "1.00",
    date_tolerance_days: "2",
    require_approval: true,
    lock_after_period_close: true,
  });
  const [saving, setSaving] = useState(false);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post("/reconciliation/settings", form);
      alert("Settings saved successfully.");
    } catch (err) {
      console.error("Failed to save reconciliation settings:", err);
      alert(err?.response?.data?.error || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="recon-page">
      <h2>Reconciliation Settings</h2>
      <p className="recon-subtitle">
        Configure matching tolerance, approval rules, and locking behavior.
      </p>

      <form className="recon-settings-form" onSubmit={handleSave}>
        <div className="recon-card">
          <div className="recon-form-row">
            <label>
              <input
                type="checkbox"
                checked={!!form.auto_match_enabled}
                onChange={(e) =>
                  updateField("auto_match_enabled", e.target.checked)
                }
              />
              <span> Enable auto-match engine</span>
            </label>
          </div>

          <div className="recon-form-row">
            <label>Amount tolerance ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount_tolerance}
              onChange={(e) =>
                updateField("amount_tolerance", e.target.value)
              }
            />
          </div>

          <div className="recon-form-row">
            <label>Date tolerance (days)</label>
            <input
              type="number"
              min="0"
              value={form.date_tolerance_days}
              onChange={(e) =>
                updateField("date_tolerance_days", e.target.value)
              }
            />
          </div>

          <div className="recon-form-row">
            <label>
              <input
                type="checkbox"
                checked={!!form.require_approval}
                onChange={(e) =>
                  updateField("require_approval", e.target.checked)
                }
              />
              <span> Require approval before final reconcile</span>
            </label>
          </div>

          <div className="recon-form-row">
            <label>
              <input
                type="checkbox"
                checked={!!form.lock_after_period_close}
                onChange={(e) =>
                  updateField("lock_after_period_close", e.target.checked)
                }
              />
              <span> Lock records after period close</span>
            </label>
          </div>

          <div className="recon-form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}