
// frontend/src/components/FinanceDashboard/pages/DuesPlans.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "../../../styles/finance-enterprise.css";

const EMPTY_FORM = {
  id: null,
  code: "",
  name: "",
  description: "",
  billing_cycle: "monthly",
  duration_months: 1,
  minimum_amount: "",
  preset_amounts_text: "",
  registration_fee: "50",
  member_type: "both",
  is_active: true,
  sort_order: 1,
  allow_custom_amount: false,
};

function money(value) {
  const n = Number(value || 0);
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeOption(value) {
  const v = String(value || "monthly").toLowerCase();
  if (["monthly", "3_month", "6_month", "12_month"].includes(v)) return v;
  return "monthly";
}

function durationFromOption(option) {
  const v = normalizeOption(option);
  if (v === "3_month") return 3;
  if (v === "6_month") return 6;
  if (v === "12_month") return 12;
  return 1;
}

function labelFromOption(option) {
  const v = normalizeOption(option);
  if (v === "3_month") return "3-Month";
  if (v === "6_month") return "6-Month";
  if (v === "12_month") return "Yearly";
  return "Monthly";
}

function defaultCodeFromOption(option) {
  const v = normalizeOption(option);
  if (v === "3_month") return "MEM-3";
  if (v === "6_month") return "MEM-6";
  if (v === "12_month") return "MEM-12";
  return "MEM-1";
}

function parsePresetAmounts(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];

  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => Number(String(item).trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Number(n.toFixed(2)))
    )
  ).sort((a, b) => a - b);
}

function presetTextFromRow(row) {
  const source = row?.preset_amounts ?? row?.preset_amounts_json ?? [];

  try {
    const parsed = Array.isArray(source)
      ? source
      : typeof source === "string"
      ? JSON.parse(source)
      : [];

    return parsed.join(", ");
  } catch {
    return "";
  }
}

function PlanModal({ open, title, subtitle, children, onClose }) {
  if (!open) return null;

  return (
    <div className="mr-plan-modal-overlay" onClick={onClose}>
      <div className="mr-plan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mr-plan-modal-head">
          <div>
            <h3 className="mr-plan-modal-title">{title}</h3>
            {subtitle ? (
              <p className="mr-plan-modal-subtitle">{subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            className="mr-plan-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="mr-plan-modal-body">{children}</div>
      </div>
    </div>
  );
}

function ActionsMenu({ onEdit, onDelete, deleting }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    function close() {
      setOpen(false);
    }

    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="mr-action-menu" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="mr-kebab-btn"
        aria-label="Open actions"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span />
        <span />
        <span />
      </button>

      {open ? (
        <div className="mr-kebab-menu">
          <button
            type="button"
            className="mr-kebab-item"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </button>

          <button
            type="button"
            className="mr-kebab-item danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, sub, accent = false }) {
  return (
    <article
      className={`mr-plan-stat-card ${
        accent ? "mr-plan-stat-card--accent" : ""
      }`}
    >
      <span className="mr-plan-stat-label">{label}</span>
      <strong className="mr-plan-stat-value">{value}</strong>
      <p className="mr-plan-stat-sub">{sub}</p>
    </article>
  );
}

function statusMeta(row) {
  return Number(row.is_active) === 1
    ? {
        label: "Active",
        className: "mr-plan-status mr-plan-status-active",
      }
    : {
        label: "Inactive",
        className: "mr-plan-status mr-plan-status-inactive",
      };
}

export default function DuesPlans() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  async function loadPlans() {
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get("/admin/membership-plans");
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load membership plans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aOrder = Number(a.sort_order ?? 0);
      const bOrder = Number(b.sort_order ?? 0);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return Number(a.duration_months ?? 0) - Number(b.duration_months ?? 0);
    });
  }, [rows]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => Number(r.is_active) === 1).length;
    const custom = rows.filter((r) => Number(r.allow_custom_amount) === 1).length;
    const highestMinimum = rows.reduce(
      (max, row) => Math.max(max, Number(row.minimum_amount || 0)),
      0
    );

    return {
      total: rows.length,
      active,
      custom,
      highestMinimum,
    };
  }, [rows]);

  function updateField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "billing_cycle") {
        const option = normalizeOption(value);
        next.billing_cycle = option;
        next.duration_months = durationFromOption(option);

        if (!next.code || next.code === defaultCodeFromOption(prev.billing_cycle)) {
          next.code = defaultCodeFromOption(option);
        }

        if (!next.name || next.name.includes("Membership")) {
          next.name = `${labelFromOption(option)} Membership`;
        }
      }

      return next;
    });
  }

  function startCreate(defaults = {}) {
    const cycle = normalizeOption(defaults.billing_cycle || "monthly");

    setError("");
    setSuccess("");
    setForm({
      ...EMPTY_FORM,
      ...defaults,
      billing_cycle: cycle,
      duration_months: durationFromOption(cycle),
      code: defaults.code || defaultCodeFromOption(cycle),
      name: defaults.name || `${labelFromOption(cycle)} Membership`,
    });
    setFormOpen(true);
  }

  function startEdit(plan) {
    const cycle = normalizeOption(plan.billing_cycle || "monthly");

    setError("");
    setSuccess("");
    setForm({
      id: plan.id,
      code: plan.code ?? plan.plan_code ?? "",
      name: plan.name ?? plan.plan_name ?? "",
      description: plan.description ?? "",
      billing_cycle: cycle,
      duration_months: Number(plan.duration_months ?? durationFromOption(cycle)),
      minimum_amount: String(plan.minimum_amount ?? ""),
      preset_amounts_text: presetTextFromRow(plan),
      registration_fee: String(plan.registration_fee ?? "50"),
      member_type: plan.member_type ?? "both",
      is_active: Number(plan.is_active) === 1,
      sort_order: Number(plan.sort_order ?? 1),
      allow_custom_amount: Number(plan.allow_custom_amount) === 1,
    });
    setFormOpen(true);
  }

  function closeFormModal() {
    if (saving) return;
    setForm(EMPTY_FORM);
    setFormOpen(false);
  }

  function validateForm() {
    if (!String(form.code || "").trim()) return "Plan code is required.";
    if (!String(form.name || "").trim()) return "Plan name is required.";

    const minimum = Number(form.minimum_amount || 0);
    if (!Number.isFinite(minimum) || minimum <= 0) {
      return "Minimum amount must be greater than zero.";
    }

    const registrationFee = Number(form.registration_fee || 0);
    if (!Number.isFinite(registrationFee) || registrationFee < 0) {
      return "Registration fee cannot be negative.";
    }

    const presets = parsePresetAmounts(form.preset_amounts_text);
    if (!presets.length) return "Enter at least one preset amount.";

    if (presets.some((amount) => amount < minimum)) {
      return "Preset amounts must be greater than or equal to the minimum.";
    }

    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validation = validateForm();
    if (validation) {
      setError(validation);
      return;
    }

    const cycle = normalizeOption(form.billing_cycle);
    const presets = parsePresetAmounts(form.preset_amounts_text);

    const payload = {
      code: String(form.code).trim(),
      plan_code: String(form.code).trim(),
      name: String(form.name).trim(),
      plan_name: String(form.name).trim(),
      description: String(form.description || "").trim(),
      billing_cycle: cycle,
      duration_months: durationFromOption(cycle),
      minimum_amount: Number(form.minimum_amount || 0),
      preset_amounts_json: presets,
      registration_fee: Number(form.registration_fee || 0),
      member_type: form.member_type,
      is_active: form.is_active ? 1 : 0,
      sort_order: Number(form.sort_order || 0),
      allow_custom_amount: form.allow_custom_amount ? 1 : 0,
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (form.id) {
        await api.put(`/admin/membership-plans/${form.id}`, payload);
        setSuccess("Membership plan updated successfully.");
      } else {
        await api.post("/admin/membership-plans", payload);
        setSuccess("Membership plan created successfully.");
      }

      await loadPlans();
      closeFormModal();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save membership plan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this membership plan?")) return;

    try {
      setDeletingId(id);
      setError("");
      setSuccess("");
      await api.delete(`/admin/membership-plans/${id}`);
      setSuccess("Membership plan deleted successfully.");
      await loadPlans();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to delete membership plan.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mr-page">
      <section className="mr-plan-hero-v2">
        <div className="mr-plan-hero-v2__content">
          <div className="mr-plan-hero-v2__eyebrow">Finance Configuration</div>
          <h1 className="mr-plan-hero-v2__title">Membership Dues Plans</h1>
          <p className="mr-plan-hero-v2__subtitle">
            Finance controls the plans that render in the member dashboard.
            Configure one active plan per billing interval.
          </p>
        </div>

        <div className="mr-plan-hero-v2__actions">
          <button
            type="button"
            className="mr-btn mr-btn-primary"
            onClick={() => startCreate()}
          >
            + Create Plan
          </button>
        </div>
      </section>

      {error ? <div className="mr-banner mr-banner-error">{error}</div> : null}
      {success ? (
        <div className="mr-banner mr-plan-success-banner">{success}</div>
      ) : null}

      <section className="mr-plan-stats-grid">
        <StatCard label="Total Plans" value={stats.total} sub="Configured rows" />
        <StatCard label="Active Plans" value={stats.active} sub="Visible to members" />
        <StatCard label="Custom Allowed" value={stats.custom} sub="Optional only" />
        <StatCard
          label="Highest Minimum"
          value={money(stats.highestMinimum)}
          sub="Largest configured minimum"
          accent
        />
      </section>

      <section className="mr-card mr-plan-table-panel">
        <div className="mr-plan-panel-head mr-plan-panel-head--table">
          <div>
            <div className="mr-section-title">Configured Plans</div>
            <div className="mr-section-subtitle">
              These rows power member checkout, auto-pay, receipts, and ledger
              coverage.
            </div>
          </div>

          <button
            type="button"
            className="mr-btn mr-btn-secondary"
            onClick={() => startCreate()}
          >
            Add Plan
          </button>
        </div>

        {loading ? (
          <div className="mr-plan-empty-state">Loading membership plans...</div>
        ) : sortedRows.length === 0 ? (
          <div className="mr-plan-empty-state">No membership plans found.</div>
        ) : (
          <div className="mr-table-wrap">
            <div className="mr-table-scroll">
              <table className="mr-table mr-sticky">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Plan</th>
                    <th>Cycle</th>
                    <th>Duration</th>
                    <th>Minimum</th>
                    <th>Presets</th>
                    <th>Registration Fee</th>
                    <th>Custom</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => {
                    const status = statusMeta(row);

                    return (
                      <tr key={row.id}>
                        <td>
                          <span className="mr-plan-code-pill">
                            {row.plan_code || row.code || "--"}
                          </span>
                        </td>
                        <td>
                          <div className="mr-plan-name-cell">
                            <strong>{row.plan_name || row.name || "--"}</strong>
                            <span>{row.description || "Membership billing plan"}</span>
                          </div>
                        </td>
                        <td>{labelFromOption(row.billing_cycle)}</td>
                        <td>{Number(row.duration_months || 1)} month(s)</td>
                        <td>{money(row.minimum_amount)}</td>
                        <td>{presetTextFromRow(row) || "--"}</td>
                        <td>{money(row.registration_fee)}</td>
                        <td>{Number(row.allow_custom_amount) === 1 ? "Yes" : "No"}</td>
                        <td>
                          <span className={status.className}>{status.label}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <ActionsMenu
                            onEdit={() => startEdit(row)}
                            onDelete={() => handleDelete(row.id)}
                            deleting={deletingId === row.id}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <PlanModal
        open={formOpen}
        title={form.id ? "Edit Membership Plan" : "Create Membership Plan"}
        subtitle="Create finance-controlled dues options that members can select in the dashboard."
        onClose={closeFormModal}
      >
        <form className="mr-plan-form" onSubmit={handleSubmit}>
          <div className="mr-plan-form-grid">
            <label className="mr-field">
              <span className="mr-label">Billing Cycle</span>
              <select
                className="mr-input mr-input-plain"
                value={form.billing_cycle}
                onChange={(e) => updateField("billing_cycle", e.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="3_month">3-Month</option>
                <option value="6_month">6-Month</option>
                <option value="12_month">12-Month</option>
              </select>
            </label>

            <label className="mr-field">
              <span className="mr-label">Duration Months</span>
              <input
                className="mr-input mr-input-plain"
                value={durationFromOption(form.billing_cycle)}
                readOnly
              />
            </label>

            <label className="mr-field">
              <span className="mr-label">Code</span>
              <input
                className="mr-input mr-input-plain"
                value={form.code}
                onChange={(e) => updateField("code", e.target.value)}
                required
              />
            </label>

            <label className="mr-field">
              <span className="mr-label">Name</span>
              <input
                className="mr-input mr-input-plain"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </label>

            <label className="mr-field">
              <span className="mr-label">Minimum Amount</span>
              <input
                className="mr-input mr-input-plain"
                type="number"
                min="0"
                step="0.01"
                value={form.minimum_amount}
                onChange={(e) => updateField("minimum_amount", e.target.value)}
                required
              />
            </label>

            <label className="mr-field">
              <span className="mr-label">Registration Fee</span>
              <input
                className="mr-input mr-input-plain"
                type="number"
                min="0"
                step="0.01"
                value={form.registration_fee}
                onChange={(e) => updateField("registration_fee", e.target.value)}
              />
            </label>

            <label className="mr-field mr-field-span-2">
              <span className="mr-label">Preset Amounts</span>
              <input
                className="mr-input mr-input-plain"
                value={form.preset_amounts_text}
                onChange={(e) =>
                  updateField("preset_amounts_text", e.target.value)
                }
                placeholder="50, 100, 150"
                required
              />
            </label>

            <label className="mr-field">
              <span className="mr-label">Member Type</span>
              <select
                className="mr-input mr-input-plain"
                value={form.member_type}
                onChange={(e) => updateField("member_type", e.target.value)}
              >
                <option value="both">Both</option>
                <option value="individual">Individual</option>
                <option value="family">Family</option>
              </select>
            </label>

            <label className="mr-field">
              <span className="mr-label">Sort Order</span>
              <input
                className="mr-input mr-input-plain"
                type="number"
                value={form.sort_order}
                onChange={(e) => updateField("sort_order", e.target.value)}
              />
            </label>

            <label className="mr-field mr-field-span-2">
              <span className="mr-label">Description</span>
              <textarea
                className="mr-input mr-input-plain"
                rows={3}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </label>

            <label className="mr-check-row">
              <input
                type="checkbox"
                checked={Boolean(form.is_active)}
                onChange={(e) => updateField("is_active", e.target.checked)}
              />
              <span>Active and visible to members</span>
            </label>

            <label className="mr-check-row">
              <input
                type="checkbox"
                checked={Boolean(form.allow_custom_amount)}
                onChange={(e) =>
                  updateField("allow_custom_amount", e.target.checked)
                }
              />
              <span>Allow custom amount above minimum</span>
            </label>
          </div>

          <div className="mr-plan-modal-actions">
            <button
              type="button"
              className="mr-btn mr-btn-secondary"
              onClick={closeFormModal}
              disabled={saving}
            >
              Cancel
            </button>

            <button type="submit" className="mr-btn mr-btn-primary" disabled={saving}>
              {saving ? "Saving..." : form.id ? "Update Plan" : "Create Plan"}
            </button>
          </div>
        </form>
      </PlanModal>
    </div>
  );
}