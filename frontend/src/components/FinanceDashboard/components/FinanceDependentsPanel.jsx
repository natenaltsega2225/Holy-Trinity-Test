// frontend/src/components/FinanceDashboard/components/FinanceDependentsPanel.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Baby,
  CheckCircle2,
  Edit3,
  Plus,
  RefreshCcw,
  Trash2,
  Users,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

const RELATIONSHIP_OPTIONS = [
  { value: "", label: "Select Relationship" },
  { value: "child", label: "Child" },
  { value: "spouse", label: "Spouse" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Other" },
];

const GENDER_OPTIONS = [
  { value: "", label: "Select Gender" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function clean(value) {
  return String(value ?? "").trim();
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];

    if (value !== undefined && value !== null && clean(value) !== "") {
      return value;
    }
  }

  return fallback;
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.rows,
    payload?.data,
    payload?.dependents,
    payload?.items,
    payload?.results,
    payload?.data?.rows,
    payload?.data?.dependents,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function dateOnly(value) {
  if (!value) return "";

  const raw = clean(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  return d.toISOString().slice(0, 10);
}

function formatDate(value) {
  const date = dateOnly(value);

  if (!date) return "--";

  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}

function pretty(value) {
  const text = clean(value);
  if (!text) return "--";

  return text
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function calculateAge(value) {
  const date = dateOnly(value);

  if (!date) return "--";

  const dob = new Date(`${date}T00:00:00`);
  const now = new Date();

  if (Number.isNaN(dob.getTime())) return "--";

  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : "--";
}

function dependentId(row) {
  return firstValue(row, ["id", "dependent_id"], "");
}

function fullName(row) {
  return firstValue(row, ["full_name", "name"], [
    firstValue(row, ["first_name"], ""),
    firstValue(row, ["last_name"], ""),
  ].filter(Boolean).join(" "));
}

function statusTone(value) {
  const status = clean(value).toLowerCase();

  if (["active", "approved", "registered"].includes(status)) return "success";
  if (["inactive", "removed", "deleted"].includes(status)) return "danger";
  if (["pending"].includes(status)) return "warning";

  return "neutral";
}

function StatusBadge({ status }) {
  return (
    <span className={`finance-status-badge ${statusTone(status)}`}>
      {pretty(status || "active")}
    </span>
  );
}

function buildInitialForm(dependent = {}) {
  const existingFullName = fullName(dependent);
  const parts = existingFullName.split(/\s+/).filter(Boolean);

  return {
    first_name: firstValue(dependent, ["first_name"], parts[0] || ""),
    last_name: firstValue(dependent, ["last_name"], parts.slice(1).join(" ") || ""),
    relationship: firstValue(dependent, ["relationship"], "child"),
    gender: firstValue(dependent, ["gender"], ""),
    date_of_birth: dateOnly(firstValue(dependent, ["date_of_birth", "dob"], "")),
    email: firstValue(dependent, ["email"], ""),
    phone: firstValue(dependent, ["phone"], ""),
    school_grade: firstValue(dependent, ["school_grade", "grade"], ""),
    school_name: firstValue(dependent, ["school_name"], ""),
    medical_notes: firstValue(dependent, ["medical_notes", "allergies"], ""),
    emergency_contact_name: firstValue(dependent, ["emergency_contact_name"], ""),
    emergency_contact_phone: firstValue(dependent, ["emergency_contact_phone"], ""),
    status: firstValue(dependent, ["status", "is_active"], "active") === 0 ? "inactive" : firstValue(dependent, ["status"], "active"),
    notes: firstValue(dependent, ["notes"], ""),
  };
}

async function getFirst(endpoints, config = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint, config);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

async function postFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.post(endpoint, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

async function patchFirst(endpoints, payload) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.patch(endpoint, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

function DependentModal({
  open,
  memberId,
  memberNo,
  dependent,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(dependentId(dependent));
  const [form, setForm] = useState(buildInitialForm(dependent || {}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(dependent || {}));
      setError("");
      setSaving(false);
    }
  }, [open, dependent]);

  function setValue(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function close() {
    if (saving) return;
    onClose?.();
  }

  async function submit(event) {
    event.preventDefault();

    setError("");

    if (!clean(form.first_name)) {
      setError("First name is required.");
      return;
    }

    if (!clean(form.last_name)) {
      setError("Last name is required.");
      return;
    }

    if (!clean(form.relationship)) {
      setError("Relationship is required.");
      return;
    }

    const name = [clean(form.first_name), clean(form.last_name)]
      .filter(Boolean)
      .join(" ");

    const payload = {
      member_id: memberId,
      member_no: memberNo || null,

      first_name: clean(form.first_name),
      last_name: clean(form.last_name),
      full_name: name,
      relationship: form.relationship,
      gender: clean(form.gender) || null,
      date_of_birth: form.date_of_birth || null,
      dob: form.date_of_birth || null,

      email: clean(form.email) || null,
      phone: clean(form.phone) || null,

      school_grade: clean(form.school_grade) || null,
      grade: clean(form.school_grade) || null,
      school_name: clean(form.school_name) || null,

      medical_notes: clean(form.medical_notes) || null,
      allergies: clean(form.medical_notes) || null,
      emergency_contact_name: clean(form.emergency_contact_name) || null,
      emergency_contact_phone: clean(form.emergency_contact_phone) || null,

      status: form.status,
      is_active: form.status === "active" ? 1 : 0,
      notes: clean(form.notes) || null,

      source: "finance_dependents_panel",
    };

    setSaving(true);

    try {
      const id = dependentId(dependent);

      if (isEdit && id) {
        await patchFirst(
          [
            `/finance/members/${memberId}/dependents/${id}`,
            `/finance/member-dependents/${id}`,
            `/admin/member-dependents/${id}`,
          ],
          payload
        );
      } else {
        await postFirst(
          [
            `/finance/members/${memberId}/dependents`,
            "/finance/member-dependents",
            "/admin/member-dependents",
          ],
          payload
        );
      }

      onSaved?.();
      close();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save dependent."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="finance-modal-backdrop" role="presentation">
      <form className="finance-modal finance-modal-wide" onSubmit={submit}>
        <div className="finance-modal-head">
          <div>
            <p className="finance-eyebrow">Member Household</p>
            <h2>{isEdit ? "Edit Dependent" : "Add Dependent"}</h2>
            <span>
              Maintain dependent details for school, trip, family membership,
              emergency contact, and household reporting.
            </span>
          </div>

          <button
            type="button"
            className="finance-icon-button"
            onClick={close}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="finance-alert danger">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}

        <div className="finance-form-grid three">
          <label>
            First Name *
            <input
              value={form.first_name}
              onChange={(event) => setValue("first_name", event.target.value)}
              required
            />
          </label>

          <label>
            Last Name *
            <input
              value={form.last_name}
              onChange={(event) => setValue("last_name", event.target.value)}
              required
            />
          </label>

          <label>
            Relationship *
            <select
              value={form.relationship}
              onChange={(event) => setValue("relationship", event.target.value)}
              required
            >
              {RELATIONSHIP_OPTIONS.map((option) => (
                <option key={option.value || "blank"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Gender
            <select
              value={form.gender}
              onChange={(event) => setValue("gender", event.target.value)}
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value || "blank"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date of Birth
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(event) => setValue("date_of_birth", event.target.value)}
            />
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(event) => setValue("status", event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setValue("email", event.target.value)}
            />
          </label>

          <label>
            Phone
            <input
              value={form.phone}
              onChange={(event) => setValue("phone", event.target.value)}
            />
          </label>

          <label>
            School Grade
            <input
              value={form.school_grade}
              onChange={(event) => setValue("school_grade", event.target.value)}
              placeholder="Example: Grade 4"
            />
          </label>

          <label>
            School Name
            <input
              value={form.school_name}
              onChange={(event) => setValue("school_name", event.target.value)}
            />
          </label>

          <label>
            Emergency Contact
            <input
              value={form.emergency_contact_name}
              onChange={(event) =>
                setValue("emergency_contact_name", event.target.value)
              }
            />
          </label>

          <label>
            Emergency Phone
            <input
              value={form.emergency_contact_phone}
              onChange={(event) =>
                setValue("emergency_contact_phone", event.target.value)
              }
            />
          </label>
        </div>

        <label className="finance-field-full">
          Medical / Allergy Notes
          <textarea
            rows={3}
            value={form.medical_notes}
            onChange={(event) => setValue("medical_notes", event.target.value)}
            placeholder="Optional medical, allergy, or care notes"
          />
        </label>

        <label className="finance-field-full">
          Internal Notes
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => setValue("notes", event.target.value)}
            placeholder="Finance or admin notes"
          />
        </label>

        <div className="finance-modal-actions">
          <button type="button" className="finance-btn ghost" onClick={close}>
            Cancel
          </button>

          <button type="submit" className="finance-btn primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Dependent" : "Add Dependent"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function FinanceDependentsPanel({
  member,
  memberId: memberIdProp,
  memberNo: memberNoProp,
}) {
  const resolvedMemberId =
    memberIdProp || firstValue(member, ["id", "member_id"], "");
  const resolvedMemberNo =
    memberNoProp || firstValue(member, ["member_no", "member_number"], "");

  const [rows, setRows] = useState([]);
  const [selectedDependent, setSelectedDependent] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeCount = useMemo(
    () =>
      rows.filter((row) => {
        const value = firstValue(row, ["status"], "active");
        return clean(value).toLowerCase() !== "inactive";
      }).length,
    [rows]
  );

  const childrenCount = useMemo(
    () =>
      rows.filter(
        (row) => clean(firstValue(row, ["relationship"], "")).toLowerCase() === "child"
      ).length,
    [rows]
  );

  const loadRows = useCallback(async () => {
    if (!resolvedMemberId) return;

    setLoading(true);
    setError("");

    try {
      const payload = await getFirst([
        `/finance/members/${resolvedMemberId}/dependents`,
        `/finance/member-dependents?member_id=${resolvedMemberId}`,
        `/admin/member-dependents?member_id=${resolvedMemberId}`,
      ]);

      setRows(normalizeRows(payload));
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load dependents."
      );
    } finally {
      setLoading(false);
    }
  }, [resolvedMemberId]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function openCreate() {
    setSelectedDependent(null);
    setModalOpen(true);
  }

  function openEdit(row) {
    setSelectedDependent(row);
    setModalOpen(true);
  }

  async function deactivate(row) {
    const id = dependentId(row);

    if (!id || !resolvedMemberId) return;

    setActionLoading(id);
    setError("");
    setSuccess("");

    try {
      await patchFirst(
        [
          `/finance/members/${resolvedMemberId}/dependents/${id}`,
          `/finance/member-dependents/${id}`,
          `/admin/member-dependents/${id}`,
        ],
        {
          status: "inactive",
          is_active: 0,
          source: "finance_dependents_panel",
        }
      );

      setSuccess("Dependent marked inactive.");
      await loadRows();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update dependent."
      );
    } finally {
      setActionLoading("");
    }
  }

  return (
    <section className="finance-panel">
      <div className="finance-section-head">
        <div>
          <p className="finance-eyebrow">Household</p>
          <h2>
            <Users size={18} />
            Dependents
          </h2>
          <span>
            Manage household dependents used for school, trip, family records,
            and emergency contact workflows.
          </span>
        </div>

        <div className="finance-row-actions">
          <button
            type="button"
            className="finance-btn ghost"
            onClick={loadRows}
            disabled={loading || !resolvedMemberId}
          >
            <RefreshCcw size={16} />
            Refresh
          </button>

          <button
            type="button"
            className="finance-btn primary"
            onClick={openCreate}
            disabled={!resolvedMemberId}
          >
            <Plus size={16} />
            Add Dependent
          </button>
        </div>
      </div>

      {error ? (
        <div className="finance-alert danger">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="finance-alert success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      ) : null}

      <div className="finance-summary-grid compact">
        <div className="finance-summary-card">
          <span>Total Dependents</span>
          <strong>{rows.length}</strong>
          <small>Household records</small>
        </div>

        <div className="finance-summary-card">
          <span>Active</span>
          <strong>{activeCount}</strong>
          <small>Eligible dependents</small>
        </div>

        <div className="finance-summary-card">
          <span>Children</span>
          <strong>{childrenCount}</strong>
          <small>School/trip eligible</small>
        </div>
      </div>

      <div className="finance-table-wrap">
        <table className="finance-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Relationship</th>
              <th>Gender</th>
              <th>Date of Birth</th>
              <th>Age</th>
              <th>School / Grade</th>
              <th>Emergency Contact</th>
              <th>Status</th>
              <th className="finance-actions-col">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="finance-empty-cell">
                  Loading dependents...
                </td>
              </tr>
            ) : null}

            {!loading && !rows.length ? (
              <tr>
                <td colSpan="9" className="finance-empty-cell">
                  No dependents found.
                </td>
              </tr>
            ) : null}

            {!loading &&
              rows.map((row, index) => {
                const id = dependentId(row) || index;
                const rowStatus = firstValue(row, ["status"], "active");

                return (
                  <tr key={`${id}-${fullName(row)}`}>
                    <td>
                      <strong>{fullName(row)}</strong>
                      <small>{firstValue(row, ["email"], "") || "--"}</small>
                    </td>
                    <td>{pretty(firstValue(row, ["relationship"], "--"))}</td>
                    <td>{pretty(firstValue(row, ["gender"], "--"))}</td>
                    <td>{formatDate(firstValue(row, ["date_of_birth", "dob"], ""))}</td>
                    <td>{calculateAge(firstValue(row, ["date_of_birth", "dob"], ""))}</td>
                    <td>
                      <strong>
                        {firstValue(row, ["school_grade", "grade"], "--")}
                      </strong>
                      <small>{firstValue(row, ["school_name"], "") || "--"}</small>
                    </td>
                    <td>
                      <strong>
                        {firstValue(row, ["emergency_contact_name"], "--")}
                      </strong>
                      <small>
                        {firstValue(row, ["emergency_contact_phone"], "") || "--"}
                      </small>
                    </td>
                    <td>
                      <StatusBadge status={rowStatus} />
                    </td>
                    <td>
                      <div className="finance-row-actions">
                        <button
                          type="button"
                          className="finance-mini-button"
                          onClick={() => openEdit(row)}
                        >
                          <Edit3 size={14} />
                          Edit
                        </button>

                        {clean(rowStatus).toLowerCase() !== "inactive" ? (
                          <button
                            type="button"
                            className="finance-mini-button danger"
                            disabled={actionLoading === id}
                            onClick={() => deactivate(row)}
                          >
                            <Trash2 size={14} />
                            Deactivate
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <DependentModal
        open={modalOpen}
        memberId={resolvedMemberId}
        memberNo={resolvedMemberNo}
        dependent={selectedDependent}
        onClose={() => setModalOpen(false)}
        onSaved={loadRows}
      />
    </section>
  );
}

export { DependentModal as FinanceDependentModal };