// frontend/src/components/FinanceDashboard/pages/DuesPlans.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";
import FinanceActionMenu from "../components/FinanceActionMenu"
const BILLING_CYCLES = [
  { value: "monthly", label: "Monthly", months: 1 },
  { value: "3_month", label: "3 Month", months: 3 },
  { value: "6_month", label: "6 Month", months: 6 },
  { value: "12_month", label: "12 Month", months: 12 },
  { value: "one_time", label: "One Time", months: 1 },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numberValue(value));
}

function clean(value) {
  return String(value ?? "").trim();
}

function firstValue(source = {}, keys = [], fallback = "") {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.plans)) return data.plans;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  if (Array.isArray(data?.data?.plans)) return data.data.plans;
  return [];
}

function planId(row = {}) {
  return firstValue(row, ["id", "plan_id", "dues_plan_id"], "");
}
function planCode(row = {}) {
  return firstValue(
    row,
    ["plan_code", "code"],
    ""
  );
}
function planName(row = {}) {
  return firstValue(row, ["plan_name", "name", "title"], "Membership Plan");
}

function planDescription(row = {}) {
  return firstValue(row, ["description", "notes"], "");
}

function planAmount(row = {}) {
  return numberValue(
    firstValue(
      row,
      [
        "minimum_amount",
        "amount",
        "price",
        "monthly_amount",
        "current_amount",
        "membership_amount",
        "dues_amount",
      ],
      0
    )
  );
}

function registrationFee(row = {}) {
  return numberValue(
    firstValue(row, ["registration_fee", "new_member_fee", "signup_fee"], 0)
  );
}

function durationMonths(row = {}) {
  const value = Number(
    firstValue(row, ["duration_months", "months", "coverage_months"], 0)
  );

  if (value > 0) return value;

  const cycle = String(firstValue(row, ["billing_cycle", "cycle"], "")).toLowerCase();
  const found = BILLING_CYCLES.find((item) => item.value === cycle);
  return found?.months || 1;
}

function billingCycle(row = {}) {
  const raw = String(firstValue(row, ["billing_cycle", "cycle"], "")).toLowerCase();

  if (raw) return raw;

  const months = durationMonths(row);
  if (months === 3) return "3_month";
  if (months === 6) return "6_month";
  if (months === 12) return "12_month";
  return "monthly";
}

function isActive(row = {}) {
  const status = String(firstValue(row, ["status"], "")).toLowerCase();

  if (status) {
    return status === "active";
  }

  return Number(firstValue(row, ["is_active", "active"], 1)) === 1;
}

function isDefault(row = {}) {
  return Number(firstValue(row, ["is_default", "default_plan"], 0)) === 1;
}

function cycleLabel(value) {
  const found = BILLING_CYCLES.find((item) => item.value === value);
  return found?.label || pretty(value);
}

function buildEmptyPlan() {
  return {
    plan_code: "",

    plan_name: "",

    description: "",

    billing_cycle: "monthly",

    duration_months: 1,

    amount: "50.00",

    registration_fee: "55.00",

    grace_period_days: 0,

    sort_order: 0,

    is_active: 1,

    is_default: 0,

    allow_online_payment: 1,

    allow_manual_payment: 1,
  };
}
async function getFirst(endpoints) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const res = await api.get(endpoint);
      return res?.data || res || {};
    } catch (err) {
      lastError = err;
      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) throw err;
    }
  }

  throw lastError || new Error("Membership plans endpoint is not available.");
}

async function requestFirst(attempts, fallbackMessage) {
  let lastError = null;

  for (const attempt of attempts) {
    try {
      const method = String(attempt.method || "get").toLowerCase();
      const payload = attempt.payload || {};
      return await api[method](attempt.endpoint, payload);
    } catch (err) {
      lastError = err;
      const status = Number(err?.response?.status || 0);
      if (![404, 405].includes(status)) throw err;
    }
  }

  throw lastError || new Error(fallbackMessage);
}

function buildPlanPayload(form = {}) {
  const amount = numberValue(form.amount);
  const regFee = numberValue(form.registration_fee);
  const months = Math.max(1, Number(form.duration_months || 1));
  const active = Number(form.is_active) === 1 ? 1 : 0;
  const defaultPlan = Number(form.is_default) === 1 ? 1 : 0;

return {
  plan_code: form.plan_code,
  code: form.plan_code,

  plan_name: clean(form.plan_name),
  name: clean(form.plan_name),
  title: clean(form.plan_name),

  minimum_amount: amount,
  amount,
  price: amount,

  registration_fee: regFee,

  billing_cycle: form.billing_cycle,

  duration_months: months,

  sort_order: Number(form.sort_order || 0),

  is_active: active,

  allow_custom_amount: 0,

  description: clean(form.description),
};
}

function PlanModal({ open, plan, onClose, onSave, saving }) {
  const [form, setForm] = useState(buildEmptyPlan());

  const editing = Boolean(planId(plan || {}));

  useEffect(() => {
    if (!open) return;

    if (plan) {
      setForm({
        plan_code: planCode(plan),
        plan_name: planName(plan),
        description: planDescription(plan),
        billing_cycle: billingCycle(plan),
        duration_months: durationMonths(plan),
        amount: String(planAmount(plan).toFixed(2)),
        registration_fee: String(registrationFee(plan).toFixed(2)),
        grace_period_days: numberValue(firstValue(plan, ["grace_period_days"], 0)),
        sort_order: numberValue(firstValue(plan, ["sort_order", "display_order"], 0)),
        is_active: isActive(plan) ? 1 : 0,
        is_default: isDefault(plan) ? 1 : 0,
        allow_online_payment: Number(firstValue(plan, ["allow_online_payment"], 1)),
        allow_manual_payment: Number(firstValue(plan, ["allow_manual_payment"], 1)),
      });
    } else {
      setForm(buildEmptyPlan());
    }
  }, [open, plan]);

  if (!open) return null;

  function update(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCycleChange(value) {
    const found = BILLING_CYCLES.find((item) => item.value === value);

    setForm((current) => ({
      ...current,
      billing_cycle: value,
      duration_months: found?.months || current.duration_months,
    }));
  }

  function submit(event) {
    event.preventDefault();

    if (!clean(form.plan_name)) return;
    if (numberValue(form.amount) <= 0) return;

    onSave(buildPlanPayload(form));
  }

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <div
        className="finance-modal finance-dues-plan-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dues-plan-modal-title"
      >
        <form onSubmit={submit}>
          <div className="finance-modal-header">
            <div className="finance-modal-title-row">
              <span className="finance-modal-icon">
                <ShieldCheck size={20} />
              </span>

              <div>
                <h2 id="dues-plan-modal-title">
                  {editing ? "Edit Membership Plan" : "Create Membership Plan"}
                </h2>
                <p>
                  Configure dues used by finance registration, member renewals,
                  Stripe checkout, cash, check, and Zelle workflows.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="finance-icon-button"
              onClick={onClose}
              aria-label="Close membership plan modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="finance-modal-body">
            <div className="finance-form-grid">
              <label className="finance-field finance-field-full">
                <span>Plan Name *</span>
                <input
                  value={form.plan_name}
                  onChange={(event) => update("plan_name", event.target.value)}
                  placeholder="Example: 3-Month Membership"
                  required
                />
              </label>

              <label className="finance-field">
                <span>Billing Cycle *</span>
                <select
                  value={form.billing_cycle}
                  onChange={(event) => handleCycleChange(event.target.value)}
                  required
                >
                  {BILLING_CYCLES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="finance-field">
                <span>Coverage Months *</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={form.duration_months}
                  onChange={(event) => update("duration_months", event.target.value)}
                  required
                />
              </label>

              <label className="finance-field">
                <span>Plan Amount *</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => update("amount", event.target.value)}
                  required
                />
              </label>

              <label className="finance-field">
                <span>Registration Fee</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.registration_fee}
                  onChange={(event) => update("registration_fee", event.target.value)}
                />
              </label>

              <label className="finance-field">
                <span>Grace Period Days</span>
                <input
                  type="number"
                  min="0"
                  value={form.grace_period_days}
                  onChange={(event) => update("grace_period_days", event.target.value)}
                />
              </label>

              <label className="finance-field">
                <span>Sort Order</span>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => update("sort_order", event.target.value)}
                />
              </label>

              <label className="finance-field finance-field-full">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="Optional description shown to finance/admin users."
                />
              </label>
            </div>

            <div className="finance-checkbox-grid">
              <label>
                <input
                  type="checkbox"
                  checked={Number(form.is_active) === 1}
                  onChange={(event) =>
                    update("is_active", event.target.checked ? 1 : 0)
                  }
                />
                <span>Active plan</span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={Number(form.is_default) === 1}
                  onChange={(event) =>
                    update("is_default", event.target.checked ? 1 : 0)
                  }
                />
                <span>Default plan</span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={Number(form.allow_online_payment) === 1}
                  onChange={(event) =>
                    update("allow_online_payment", event.target.checked ? 1 : 0)
                  }
                />
                <span>Allow card / ACH checkout</span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={Number(form.allow_manual_payment) === 1}
                  onChange={(event) =>
                    update("allow_manual_payment", event.target.checked ? 1 : 0)
                  }
                />
                <span>Allow cash / check / Zelle</span>
              </label>
            </div>
          </div>

          <div className="finance-modal-footer">
            <button
              type="button"
              className="finance-btn finance-btn-light"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="finance-btn finance-btn-primary"
              disabled={saving || !clean(form.plan_name) || numberValue(form.amount) <= 0}
            >
              {saving ? (
                <>
                  <RefreshCcw size={16} className="finance-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Plan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DuesPlans() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [successText, setSuccessText] = useState("");

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getFirst([
        "/admin/membership-plans",
        "/dues/plans",
        "/subscription/plans",
      ]);

      setRows(normalizeRows(data));
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load membership plans."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const filteredRows = useMemo(() => {
    const q = clean(search).toLowerCase();

    return rows.filter((row) => {
      const text = [
        planName(row),
        planDescription(row),
        billingCycle(row),
        durationMonths(row),
        planAmount(row),
        registrationFee(row),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || text.includes(q);
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" && isActive(row)) ||
        (statusFilter === "inactive" && !isActive(row));

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const summary = useMemo(() => {
    const active = rows.filter(isActive).length;
    const inactive = rows.length - active;
    const defaultPlan = rows.find(isDefault);

    return {
      total: rows.length,
      active,
      inactive,
      defaultName: defaultPlan ? planName(defaultPlan) : "--",
    };
  }, [rows]);

  function openCreate() {
    setSelectedPlan(null);
    setModalOpen(true);
    setError("");
    setSuccessText("");
  }

  function openEdit(row) {
    setSelectedPlan(row);
    setModalOpen(true);
    setError("");
    setSuccessText("");
  }

  async function savePlan(payload) {
    setActionLoading("save");
    setError("");
    setSuccessText("");

    try {
      const id = planId(selectedPlan || {});

      if (id) {
        await requestFirst(
          [
            { method: "patch", endpoint: `/admin/membership-plans/${id}`, payload },
            { method: "put", endpoint: `/admin/membership-plans/${id}`, payload },
            { method: "patch", endpoint: `/finance/dues-plans/${id}`, payload },
            { method: "put", endpoint: `/finance/dues-plans/${id}`, payload },
          ],
          "Update plan endpoint is not available."
        );

       setSuccessText(
  payload.billing_cycle === "monthly"
    ? "Monthly plan updated. 3, 6 and 12 month plans recalculated."
    : "Membership plan updated."
);
      } else {
        await requestFirst(
          [
            { method: "post", endpoint: "/admin/membership-plans", payload },
            { method: "post", endpoint: "/finance/dues-plans", payload },
          ],
          "Create plan endpoint is not available."
        );

        setSuccessText("Membership plan created.");
      }

      setModalOpen(false);
      setSelectedPlan(null);
      await loadPlans();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save membership plan."
      );
    } finally {
      setActionLoading("");
    }
  }



  async function togglePlan(row) {
    const id = planId(row);
    if (!id) return;

    const nextActive = !isActive(row);

    setActionLoading(`toggle-${id}`);
    setError("");
    setSuccessText("");

    const payload = {
   ...buildPlanPayload({
  plan_code: planCode(row),

  plan_name: planName(row),

  description: planDescription(row),

  billing_cycle: billingCycle(row),

  duration_months: durationMonths(row),

  amount: planAmount(row),

  registration_fee: registrationFee(row),

  grace_period_days: firstValue(
    row,
    ["grace_period_days"],
    0
  ),

  sort_order: firstValue(
    row,
    ["sort_order", "display_order"],
    0
  ),

  allow_online_payment: firstValue(
    row,
    ["allow_online_payment"],
    1
  ),

  allow_manual_payment: firstValue(
    row,
    ["allow_manual_payment"],
    1
  ),

  is_default: isDefault(row) ? 1 : 0,

  is_active: nextActive ? 1 : 0,
})
    };

    try {
      await requestFirst(
        [
          { method: "patch", endpoint: `/admin/membership-plans/${id}/status`, payload },
          { method: "put", endpoint: `/admin/membership-plans/${id}/status`, payload },
          { method: "patch", endpoint: `/admin/membership-plans/${id}`, payload },
          { method: "put", endpoint: `/admin/membership-plans/${id}`, payload },
          { method: "patch", endpoint: `/finance/dues-plans/${id}/status`, payload },
          { method: "put", endpoint: `/finance/dues-plans/${id}/status`, payload },
          { method: "patch", endpoint: `/finance/dues-plans/${id}`, payload },
          { method: "put", endpoint: `/finance/dues-plans/${id}`, payload },
        ],
        "Update plan status endpoint is not available."
      );

      setSuccessText(`Plan ${nextActive ? "activated" : "deactivated"}.`);
      await loadPlans();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update plan status."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function setDefaultPlan(row) {
    const id = planId(row);
    if (!id) return;

    setActionLoading(`default-${id}`);
    setError("");
    setSuccessText("");

    const payload = {
  ...buildPlanPayload({
  plan_code: planCode(row),

  plan_name: planName(row),

  description: planDescription(row),

  billing_cycle: billingCycle(row),

  duration_months: durationMonths(row),

  amount: planAmount(row),

  registration_fee: registrationFee(row),

  grace_period_days: firstValue(
    row,
    ["grace_period_days"],
    0
  ),

  sort_order: firstValue(
    row,
    ["sort_order", "display_order"],
    0
  ),

  allow_online_payment: firstValue(
    row,
    ["allow_online_payment"],
    1
  ),

  allow_manual_payment: firstValue(
    row,
    ["allow_manual_payment"],
    1
  ),

  is_active: 1,

  is_default: 1,
})
    };

    try {
      await requestFirst(
        [
          { method: "patch", endpoint: `/admin/membership-plans/${id}/default`, payload },
          { method: "put", endpoint: `/admin/membership-plans/${id}/default`, payload },
          { method: "patch", endpoint: `/admin/membership-plans/${id}`, payload },
          { method: "put", endpoint: `/admin/membership-plans/${id}`, payload },
          { method: "patch", endpoint: `/finance/dues-plans/${id}/default`, payload },
          { method: "put", endpoint: `/finance/dues-plans/${id}/default`, payload },
          { method: "patch", endpoint: `/finance/dues-plans/${id}`, payload },
          { method: "put", endpoint: `/finance/dues-plans/${id}`, payload },
        ],
        "Default plan endpoint is not available."
      );

      setSuccessText("Default membership plan updated.");
      await loadPlans();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to set default plan."
      );
    } finally {
      setActionLoading("");
    }
  }


  return (
    <div className="finance-page finance-dues-plans-page">
      <div className="finance-page-header">
        <div>
          <p className="finance-eyebrow">Membership Configuration</p>
          <h1>Dues Plans</h1>
          <p className="finance-page-subtitle">
            Configure enterprise membership dues for monthly, 3-month, 6-month,
            12-month, registration, renewal, Stripe checkout, and manual payment workflows.
          </p>
        </div>

        <div className="finance-page-actions">
          <button
            type="button"
            className="finance-btn finance-btn-light"
            onClick={loadPlans}
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? "finance-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={openCreate}
          >
            <Plus size={16} />
            Create Plan
          </button>
        </div>
      </div>

      {error ? (
        <div className="finance-alert finance-alert-danger">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      {successText ? (
        <div className="finance-alert finance-alert-success">
          <CheckCircle2 size={17} />
          <span>{successText}</span>
        </div>
      ) : null}

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <span>Total Plans</span>
          <strong>{summary.total}</strong>
          <small>Configured dues plans</small>
        </div>

        <div className="finance-summary-card">
          <span>Active</span>
          <strong>{summary.active}</strong>
          <small>Available to finance</small>
        </div>

        <div className="finance-summary-card">
          <span>Inactive</span>
          <strong>{summary.inactive}</strong>
          <small>Hidden or retired</small>
        </div>

        <div className="finance-summary-card">
          <span>Default Plan</span>
          <strong>{summary.defaultName}</strong>
          <small>Used when no plan is selected</small>
        </div>
      </div>

      <div className="finance-table-shell">
        <div className="finance-filter-bar">
          <label className="finance-search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plan name, description, cycle, or amount..."
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all-status"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="finance-table-scroll">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Cycle</th>
                <th>Coverage</th>
                <th>Plan Amount</th>
                <th>Registration Fee</th>
                <th>Grace</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Default</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>
                    <div className="finance-empty-row">
                      <RefreshCcw size={18} className="finance-spin" />
                      Loading membership plans...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !filteredRows.length ? (
                <tr>
                  <td colSpan={10}>
                    <div className="finance-empty-row">No membership plans found.</div>
                  </td>
                </tr>
              ) : null}

              {!loading &&
                filteredRows.map((row) => {
                  const id = planId(row);
                  const active = isActive(row);
                  const defaultPlan = isDefault(row);

                  return (
  <tr key={id || planName(row)}>
    <td>
      <div className="finance-cell-title">
        <strong>{planName(row)}</strong>
        <small>{planDescription(row) || "Membership dues plan"}</small>
      </div>
    </td>

    <td>{cycleLabel(billingCycle(row))}</td>
    <td>{durationMonths(row)} month(s)</td>
    <td>{money(planAmount(row))}</td>
    <td>{money(registrationFee(row))}</td>
    <td>{numberValue(firstValue(row, ["grace_period_days"], 0))} day(s)</td>

    <td>
      <div className="finance-cell-stack">
        <span>
          Online:{" "}
          {Number(firstValue(row, ["allow_online_payment"], 1)) === 1
            ? "Yes"
            : "No"}
        </span>
        <small>
          Manual:{" "}
          {Number(firstValue(row, ["allow_manual_payment"], 1)) === 1
            ? "Yes"
            : "No"}
        </small>
      </div>
    </td>

    <td>
      <span
        className={`finance-badge ${
          active ? "finance-badge-success" : "finance-badge-neutral"
        }`}
      >
        {active ? "Active" : "Inactive"}
      </span>
    </td>

    <td>
      <span
        className={`finance-badge ${
          defaultPlan ? "finance-badge-primary" : "finance-badge-neutral"
        }`}
      >
        {defaultPlan ? "Yes" : "No"}
      </span>
    </td>

    <td className="finance-action-cell">
      <FinanceActionMenu
        row={row}
        actions={[
          {
            key: "edit",
            label: "Edit",
            icon: Edit3,
            onClick: () => openEdit(row),
          },
          {
            key: active ? "deactivate" : "activate",
            label: active ? "Deactivate" : "Activate",
            icon: active ? EyeOff : Eye,
            tone: active ? "danger" : undefined,
            onClick: () => togglePlan(row),
            disabled: actionLoading === `toggle-${id}`,
          },
          {
            key: "default",
            label: "Default",
            icon: Star,
            onClick: () => setDefaultPlan(row),
            disabled: defaultPlan || actionLoading === `default-${id}`,
          },
        ]}
      />
    </td>
  </tr>
);
                })}
            </tbody>
          </table>
        </div>
      </div>

      <PlanModal
        open={modalOpen}
        plan={selectedPlan}
        onClose={() => {
          if (actionLoading) return;
          setModalOpen(false);
          setSelectedPlan(null);
        }}
        onSave={savePlan}
        saving={actionLoading === "save"}
      />
    </div>
  );
}