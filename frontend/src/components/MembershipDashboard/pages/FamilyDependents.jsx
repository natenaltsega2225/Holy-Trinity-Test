
// frontend/src/components/MembershipDashoard/pages/FamilyDependents.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Edit3,
  Mail,
  Phone,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/member-dashboard.css";

const LIST_ENDPOINTS = [
  "/membership/family",
  "/membership/me/family",
  "/member/family",
  "/members/me/family",
  "/membership/dependents",
  "/members/me/dependents",
];

const CREATE_ENDPOINTS = [
  "/membership/dependents",
  "/membership/me/dependents",
  "/member/dependents",
  "/members/me/dependents",
];

const RELATIONSHIP_OPTIONS = [
  "Child",
  "Spouse",
  "Parent",
  "Sibling",
  "Other",
];

const GENDER_OPTIONS = [
  "Female",
  "Male",
  "Other",
  "Prefer not to say",
];

const EMPTY_FORM = {
  id: "",
  first_name: "",
  last_name: "",
  relationship: "Child",
  gender: "",
  date_of_birth: "",
  school_grade: "",
  email: "",
  phone: "",
  notes: "",
};

function clean(value, fallback = "--") {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function arrayFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.dependents)) return payload.dependents;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.family)) return payload.family;
  return [];
}

function normalizePayload(payload) {
  const rows = arrayFromPayload(payload).map((row) => ({
    ...row,
    id: row.id || row.dependent_id || row.member_dependent_id || "",
    first_name: row.first_name || row.firstName || "",
    last_name: row.last_name || row.lastName || "",
    full_name:
      row.full_name ||
      row.name ||
      [row.first_name || row.firstName, row.last_name || row.lastName]
        .filter(Boolean)
        .join(" "),
    relationship: row.relationship || row.relation || "Child",
    gender: row.gender || "",
    date_of_birth: row.date_of_birth || row.dob || "",
    school_grade: row.school_grade || row.grade || row.school || "",
    email: row.email || "",
    phone: row.phone || "",
    status: row.status || row.dependent_status || "active",
    notes: row.notes || "",
    created_at: row.created_at || row.createdAt || "",
  }));

  return {
    rows,
    member:
      payload?.member ||
      payload?.profile ||
      payload?.summary?.member ||
      payload?.data?.member ||
      {},
  };
}

async function requestFirstAvailable(endpoints, options = {}) {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response =
        options.method === "post"
          ? await api.post(endpoint, options.data || {})
          : options.method === "put"
            ? await api.put(endpoint, options.data || {})
            : options.method === "patch"
              ? await api.patch(endpoint, options.data || {})
              : options.method === "delete"
                ? await api.delete(endpoint)
                : await api.get(endpoint, options.config || {});

      return {
        endpoint,
        data: response?.data,
      };
    } catch (error) {
      lastError = error;

      const status = error?.response?.status;
      if (![404, 405].includes(Number(status))) {
        throw error;
      }
    }
  }

  throw lastError || new Error("No available family endpoint.");
}

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return clean(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function yearsOld(value) {
  if (!value) return "--";
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return "--";

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age}` : "--";
}

function dependentName(row) {
  return clean(
    row.full_name ||
      [row.first_name, row.last_name].filter(Boolean).join(" "),
    "Dependent"
  );
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (["active", "approved"].includes(value)) return "member-badge-success";
  if (["inactive", "removed", "deleted"].includes(value)) return "member-badge-neutral";
  if (["pending"].includes(value)) return "member-badge-warning";
  return "member-badge-neutral";
}

function toForm(row = {}) {
  return {
    id: row.id || row.dependent_id || "",
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    relationship: row.relationship || "Child",
    gender: row.gender || "",
    date_of_birth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : "",
    school_grade: row.school_grade || "",
    email: row.email || "",
    phone: row.phone || "",
    notes: row.notes || "",
  };
}

export default function FamilyDependents() {
  const [rows, setRows] = useState([]);
  const [member, setMember] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [relationship, setRelationship] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await requestFirstAvailable(LIST_ENDPOINTS);
      const normalized = normalizePayload(result.data);
      setRows(normalized.rows);
      setMember(normalized.member || {});
    } catch (err) {
      console.error("Unable to load family dependents:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to load family dependents."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesRelationship =
        relationship === "all" ||
        String(row.relationship || "").toLowerCase() === relationship;

      const haystack = [
        row.full_name,
        row.first_name,
        row.last_name,
        row.relationship,
        row.gender,
        row.email,
        row.phone,
        row.school_grade,
        row.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesRelationship && (!q || haystack.includes(q));
    });
  }, [rows, search, relationship]);

  const activeCount = rows.filter(
    (row) => String(row.status || "active").toLowerCase() === "active"
  ).length;

  const childCount = rows.filter(
    (row) => String(row.relationship || "").toLowerCase() === "child"
  ).length;

  const hasEmailCount = rows.filter((row) => row.email).length;

  function openCreate() {
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEdit(row) {
    setForm(toForm(row));
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setForm(EMPTY_FORM);
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validateForm() {
    if (!form.first_name.trim()) return "First name is required.";
    if (!form.last_name.trim()) return "Last name is required.";
    if (!form.relationship.trim()) return "Relationship is required.";
    return "";
  }

  async function saveDependent(event) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      relationship: form.relationship,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      school_grade: form.school_grade.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };

    try {
      if (form.id) {
        const id = encodeURIComponent(form.id);
        await requestFirstAvailable(
          [
            `/membership/dependents/${id}`,
            `/membership/me/dependents/${id}`,
            `/member/dependents/${id}`,
            `/members/me/dependents/${id}`,
          ],
          {
            method: "put",
            data: payload,
          }
        );
        setSuccess("Dependent updated successfully.");
      } else {
        await requestFirstAvailable(CREATE_ENDPOINTS, {
          method: "post",
          data: payload,
        });
        setSuccess("Dependent added successfully.");
      }

      setShowModal(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      console.error("Unable to save dependent:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to save dependent."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeDependent(row) {
    const id = row.id || row.dependent_id;
    if (!id) return;

    const confirmed = window.confirm(
      `Remove ${dependentName(row)} from your family records?`
    );

    if (!confirmed) return;

    setActionLoading(`remove-${id}`);
    setError("");
    setSuccess("");

    try {
      const encoded = encodeURIComponent(id);

      await requestFirstAvailable(
        [
          `/membership/dependents/${encoded}`,
          `/membership/me/dependents/${encoded}`,
          `/member/dependents/${encoded}`,
          `/members/me/dependents/${encoded}`,
        ],
        {
          method: "delete",
        }
      );

      setSuccess("Dependent removed successfully.");
      await load();
    } catch (err) {
      console.error("Unable to remove dependent:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to remove dependent."
      );
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="membership-dashboard-page member-page-stack">
      <section className="member-page-hero">
        <div>
          <span className="member-eyebrow">Member Family</span>
          <h1>Family & Dependents</h1>
          <p className="member-page-subtitle">
            Manage household dependents for membership coverage, school programs,
            trip registration, and church records.
          </p>
        </div>

        <div className="member-page-actions">
          <button type="button" className="member-btn member-btn-light" onClick={load}>
            <RefreshCcw size={17} className={loading ? "member-spin" : ""} />
            Refresh
          </button>

          <button type="button" className="member-btn member-btn-primary" onClick={openCreate}>
            <Plus size={17} />
            Add Dependent
          </button>
        </div>
      </section>

      {error ? (
        <div className="member-alert member-alert-danger">
          <AlertTriangle size={17} />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="member-alert member-alert-success">
          <Save size={17} />
          {success}
        </div>
      ) : null}

      <section className="member-summary-grid">
        <div className="member-summary-card">
          <span>Total Dependents</span>
          <strong>{rows.length}</strong>
          <small>Household records</small>
        </div>

        <div className="member-summary-card">
          <span>Active</span>
          <strong>{activeCount}</strong>
          <small>Current family records</small>
        </div>

        <div className="member-summary-card">
          <span>Children</span>
          <strong>{childCount}</strong>
          <small>Child dependents</small>
        </div>

        <div className="member-summary-card">
          <span>Email Contacts</span>
          <strong>{hasEmailCount}</strong>
          <small>Dependents with email</small>
        </div>
      </section>

      <section className="member-card">
        <div className="member-section-header">
          <div>
            <h2>Family Register</h2>
            <p>
              {clean(member.full_name || member.name, "Your membership profile")} family
              records are listed below.
            </p>
          </div>
        </div>

        <div className="member-filter-grid">
          <label>
            <span>Search</span>
            <div className="member-input-icon">
              <Users size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, phone, grade, notes..."
              />
            </div>
          </label>

          <label>
            <span>Relationship</span>
            <select
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
            >
              <option value="all">All Relationships</option>
              {RELATIONSHIP_OPTIONS.map((option) => (
                <option key={option} value={option.toLowerCase()}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="member-table-wrap">
          <table className="member-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Relationship</th>
                <th>Age</th>
                <th>School / Grade</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="member-empty-state">
                      <RefreshCcw size={18} className="member-spin" />
                      Loading family records...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && !filteredRows.length ? (
                <tr>
                  <td colSpan={8}>
                    <div className="member-empty-state">
                      No dependents found for this view.
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading
                ? filteredRows.map((row) => {
                    const id = row.id || row.dependent_id || dependentName(row);
                    const status = row.status || "active";

                    return (
                      <tr key={id}>
                        <td>
                          <strong>{dependentName(row)}</strong>
                          <small>{clean(row.gender)}</small>
                        </td>

                        <td>{clean(row.relationship)}</td>
                        <td>
                          <strong>{yearsOld(row.date_of_birth)}</strong>
                          <small>{formatDate(row.date_of_birth)}</small>
                        </td>

                        <td>{clean(row.school_grade)}</td>

                        <td>
                          <div className="member-detail-grid">
                            <span>
                              <Mail size={14} />
                              {clean(row.email)}
                            </span>
                            <span>
                              <Phone size={14} />
                              {clean(row.phone)}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className={`member-badge ${statusClass(status)}`}>
                            {clean(status)}
                          </span>
                        </td>

                        <td>
                          <CalendarDays size={14} />
                          {formatDate(row.created_at)}
                        </td>

                        <td>
                          <div className="member-row-actions">
                            <button
                              type="button"
                              className="member-btn member-btn-light member-btn-sm"
                              onClick={() => openEdit(row)}
                            >
                              <Edit3 size={15} />
                              Edit
                            </button>

                            <button
                              type="button"
                              className="member-btn member-btn-light member-btn-sm"
                              onClick={() => removeDependent(row)}
                              disabled={actionLoading === `remove-${row.id}`}
                            >
                              <Trash2 size={15} />
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>
      </section>

      {showModal ? (
        <div className="member-modal-backdrop" role="presentation">
          <div className="member-modal" role="dialog" aria-modal="true">
            <div className="member-modal-header">
              <div>
                <UserRound size={22} />
                <h2>{form.id ? "Edit Dependent" : "Add Dependent"}</h2>
                <p>Add or update a household dependent on your member profile.</p>
              </div>

              <button
                type="button"
                className="member-icon-button"
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveDependent}>
              <div className="member-modal-body">
                <div className="member-filter-grid member-form-grid">
                  <label>
                    <span>First Name *</span>
                    <input
                      value={form.first_name}
                      onChange={(event) => updateForm("first_name", event.target.value)}
                      autoComplete="given-name"
                    />
                  </label>

                  <label>
                    <span>Last Name *</span>
                    <input
                      value={form.last_name}
                      onChange={(event) => updateForm("last_name", event.target.value)}
                      autoComplete="family-name"
                    />
                  </label>

                  <label>
                    <span>Relationship *</span>
                    <select
                      value={form.relationship}
                      onChange={(event) => updateForm("relationship", event.target.value)}
                    >
                      {RELATIONSHIP_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Gender</span>
                    <select
                      value={form.gender}
                      onChange={(event) => updateForm("gender", event.target.value)}
                    >
                      <option value="">Select Gender</option>
                      {GENDER_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Date Of Birth</span>
                    <input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(event) => updateForm("date_of_birth", event.target.value)}
                    />
                  </label>

                  <label>
                    <span>School / Grade</span>
                    <input
                      value={form.school_grade}
                      onChange={(event) => updateForm("school_grade", event.target.value)}
                      placeholder="Example: Grade 4"
                    />
                  </label>

                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => updateForm("email", event.target.value)}
                      autoComplete="email"
                    />
                  </label>

                  <label>
                    <span>Phone</span>
                    <input
                      value={form.phone}
                      onChange={(event) => updateForm("phone", event.target.value)}
                      autoComplete="tel"
                    />
                  </label>

                  <label className="member-field-full">
                    <span>Notes</span>
                    <textarea
                      value={form.notes}
                      onChange={(event) => updateForm("notes", event.target.value)}
                      rows={4}
                    />
                  </label>
                </div>
              </div>

              <div className="member-modal-footer">
                <button
                  type="button"
                  className="member-btn member-btn-light"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="member-btn member-btn-primary"
                  disabled={saving}
                >
                  {saving ? <RefreshCcw size={17} className="member-spin" /> : <Plus size={17} />}
                  {form.id ? "Save Dependent" : "Add Dependent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}