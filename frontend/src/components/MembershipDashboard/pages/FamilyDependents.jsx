 // frontend/src/components/MembershipDashoard/pages/FamilyDependents.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import MemberPageHeader from "../components/MemberPageHeader";
import MemberEmptyState from "../components/MemberEmptyState";
import MemberStatusBadge from "../components/MemberStatusBadge";
import "../../../styles/member-dashboard.css";
const RELATIONSHIP_OPTIONS = [
  { value: "", label: "Select relationship" },
  { value: "spouse", label: "Spouse", icon: "💍" },
  { value: "child", label: "Child", icon: "🧒" },
  { value: "father", label: "Father", icon: "👨" },
  { value: "mother", label: "Mother", icon: "👩" },
  { value: "brother", label: "Brother", icon: "👦" },
  { value: "sister", label: "Sister", icon: "👧" },
  { value: "grandparent", label: "Grandparent", icon: "🧓" },
  { value: "other", label: "Other", icon: "👥" },
];

const RELATIONSHIP_ICON_MAP = RELATIONSHIP_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.icon;
  return acc;
}, {});

const emptyDependent = {
  first_name: "",
  last_name: "",
  relationship: "",
  custom_relationship: "",
  dependent_type: "dependent",
  gender: "",
  date_of_birth: "",
  email: "",
  phone: "",
  is_student: 0,
  is_disabled: 0,
  is_active: 1,
  status: "active",
  notes: "",
};

function validateName(value) {
  return /^[A-Za-z][A-Za-z\s'-]{0,99}$/.test(String(value || "").trim());
}

function validateCustomRelationship(value) {
  return /^[A-Za-z][A-Za-z\s/&'-]{1,49}$/.test(String(value || "").trim());
}

function validateEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function validatePhone(value) {
  if (!value) return true;
  return /^[0-9+\-().\s]{7,25}$/.test(String(value).trim());
}

function getAge(dateValue) {
  if (!dateValue) return null;
  const dob = new Date(dateValue);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dob.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function formatDateMMDDYY(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

function formatRelationshipLabel(value, customValue = "") {
  if (!value) return "--";
  if (value === "other") {
    return customValue ? customValue : "Other";
  }
  const match = RELATIONSHIP_OPTIONS.find((item) => item.value === value);
  return match?.label || value;
}

function relationshipIcon(value) {
  return RELATIONSHIP_ICON_MAP[value] || "👥";
}

function resolveDependentTypeFromRelationship(value) {
  if (value === "spouse") return "spouse";
  if (value === "child") return "child";
  if (value === "father" || value === "mother" || value === "grandparent") {
    return "parent";
  }
  return "dependent";
}

function validateDependentForm(form) {
  const errors = {};

  if (!String(form.first_name || "").trim()) {
    errors.first_name = "First name is required.";
  } else if (!validateName(form.first_name)) {
    errors.first_name =
      "First name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
  }

  if (!String(form.last_name || "").trim()) {
    errors.last_name = "Last name is required.";
  } else if (!validateName(form.last_name)) {
    errors.last_name =
      "Last name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
  }

  if (!String(form.relationship || "").trim()) {
    errors.relationship = "Relationship is required.";
  } else if (
    !RELATIONSHIP_OPTIONS.map((item) => item.value).includes(form.relationship)
  ) {
    errors.relationship = "Select a valid relationship.";
  }

  if (form.relationship === "other") {
    if (!String(form.custom_relationship || "").trim()) {
      errors.custom_relationship = "Custom relationship is required.";
    } else if (!validateCustomRelationship(form.custom_relationship)) {
      errors.custom_relationship =
        "Custom relationship must contain letters only.";
    }
  }

  if (!form.date_of_birth) {
    errors.date_of_birth = "Date of birth is required.";
  } else {
    const age = getAge(form.date_of_birth);
    if (age === null) {
      errors.date_of_birth = "Date of birth is invalid.";
    } else if (age > 120) {
      errors.date_of_birth = "Age appears invalid.";
    }
  }

  if (form.email && !validateEmail(form.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (form.phone && !validatePhone(form.phone)) {
    errors.phone = "Enter a valid phone number.";
  }

  return errors;
}

function ErrorText({ text }) {
  if (!text) return null;
  return <div className="member-form-error">{text}</div>;
}

function RequiredLabel({ children }) {
  return (
    <label className="member-summary-label">
      {children} <span className="member-required">*</span>
    </label>
  );
}

function ModalShell({ open, title, onClose, children, maxWidth = 900 }) {
  if (!open) return null;

  return (
    <div className="member-modal-overlay" onClick={onClose}>
      <div
        className="member-modal-card"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="member-modal-head">
          <h3 className="member-modal-title">{title}</h3>
          <button
            type="button"
            className="member-btn member-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RelationshipBadge({ relationship, customRelationship }) {
  const label = formatRelationshipLabel(relationship, customRelationship);
  const icon = relationshipIcon(relationship);

  return (
    <span className="member-relationship-badge">
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function AgeBadge({ age }) {
  return <span className="member-age-badge">{age ?? "--"}</span>;
}

function FamilySummaryGrid({ items }) {
  return (
    <section className="member-family-summary-grid">
      {items.map((item, index) => (
        <article
          key={`${item.label}-${index}`}
          className={`member-family-stat-card ${item.featured ? "is-featured" : ""}`}
        >
          <div className="member-family-stat-label">{item.label}</div>
          <div className="member-family-stat-value">{item.value}</div>
          <div className="member-family-stat-sub">{item.sub}</div>
        </article>
      ))}
    </section>
  );
}

function RowActionsMenu({ row, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handleOutside(event) {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="member-row-menu" ref={menuRef}>
      <button
        type="button"
        className="member-kebab-btn"
        aria-label="Open actions"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        ⋯
      </button>

      {open ? (
        <div className="member-kebab-menu">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit(row);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="member-kebab-menu-danger"
            onClick={() => {
              setOpen(false);
              onDelete(row.id);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DependentFormModal({
  open,
  onClose,
  form,
  setForm,
  errors,
  onSave,
  saving,
  editingDependentId,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={editingDependentId ? "Edit Family Member" : "Add Family Member"}
    >
      <div className="member-form-grid">
        <div>
          <RequiredLabel>First Name</RequiredLabel>
          <input
            className="member-input"
            placeholder="Enter first name"
            value={form.first_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, first_name: e.target.value }))
            }
          />
          <ErrorText text={errors.first_name} />
        </div>

        <div>
          <RequiredLabel>Last Name</RequiredLabel>
          <input
            className="member-input"
            placeholder="Enter last name"
            value={form.last_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, last_name: e.target.value }))
            }
          />
          <ErrorText text={errors.last_name} />
        </div>

        <div>
          <RequiredLabel>Relationship</RequiredLabel>
          <select
            className="member-select"
            value={form.relationship}
            onChange={(e) => {
              const value = e.target.value;
              setForm((prev) => ({
                ...prev,
                relationship: value,
                dependent_type: resolveDependentTypeFromRelationship(value),
                custom_relationship:
                  value === "other" ? prev.custom_relationship : "",
              }));
            }}
          >
            {RELATIONSHIP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ErrorText text={errors.relationship} />
        </div>

        <div>
          <label className="member-summary-label">Type</label>
          <input
            className="member-input"
            value={
              form.dependent_type
                ? String(form.dependent_type).replaceAll("_", " ")
                : "--"
            }
            disabled
          />
        </div>

        {form.relationship === "other" ? (
          <div>
            <RequiredLabel>Custom Relationship</RequiredLabel>
            <input
              className="member-input"
              placeholder="Enter custom relationship"
              value={form.custom_relationship}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  custom_relationship: e.target.value,
                }))
              }
            />
            <ErrorText text={errors.custom_relationship} />
          </div>
        ) : null}

        <div>
          <RequiredLabel>Date of Birth</RequiredLabel>
          <input
            className="member-input"
            type="date"
            value={form.date_of_birth}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, date_of_birth: e.target.value }))
            }
          />
          <ErrorText text={errors.date_of_birth} />
        </div>

        <div>
          <label className="member-summary-label">Email</label>
          <input
            className="member-input"
            placeholder="Enter email (optional)"
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
          <ErrorText text={errors.email} />
        </div>

        <div>
          <label className="member-summary-label">Phone</label>
          <input
            className="member-input"
            placeholder="Enter phone number (optional)"
            value={form.phone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
          <ErrorText text={errors.phone} />
        </div>

        <div>
          <label className="member-summary-label">Status</label>
          <select
            className="member-select"
            value={form.status}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="member-form-actions">
        <button
          type="button"
          className="member-btn member-btn-secondary"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="member-btn member-btn-primary"
          disabled={saving}
          onClick={onSave}
        >
          {saving
            ? "Saving..."
            : editingDependentId
            ? "Update Family Member"
            : "Save Family Member"}
        </button>
      </div>
    </ModalShell>
  );
}

export default function FamilyDependents() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total_independent_members: 1,
    total_dependents: 0,
    total_members: 1,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState({ type: "", text: "" });
  const [form, setForm] = useState(emptyDependent);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [editingDependentId, setEditingDependentId] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setBanner({ type: "", text: "" });

      const { data } = await api.get("/members/me/dependents");
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setSummary(
        data?.summary || {
          total_independent_members: 1,
          total_dependents: 0,
          total_members: 1,
        }
      );
    } catch (err) {
      console.error(err);
      setBanner({
        type: "error",
        text: err?.response?.data?.error || "Failed to load family records.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) =>
      [
        row.full_name,
        formatRelationshipLabel(row.relationship, row.custom_relationship),
        row.dependent_type,
        row.email,
        row.phone,
        row.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const summaryItems = useMemo(
    () => [
      {
        label: "Independent Members",
        value: summary.total_independent_members || 1,
        sub: "Primary member record",
        featured: true,
      },
      {
        label: "Dependents",
        value: summary.total_dependents || 0,
        sub: "Active dependent records",
      },
      {
        label: "Total Members",
        value: summary.total_members || 1,
        sub: "Independent + dependents",
      },
      {
        label: "Children",
        value: rows.filter((row) => row.relationship === "child").length,
        sub: "Household children",
      },
    ],
    [summary, rows]
  );

  function resetForm() {
    setEditingDependentId(null);
    setForm(emptyDependent);
    setErrors({});
  }

  function openAddModal() {
    resetForm();
    setShowFormModal(true);
  }

  function openEditModal(row) {
    setEditingDependentId(row.id);
    setForm({
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      relationship: row.relationship || "",
      custom_relationship: row.custom_relationship || "",
      dependent_type: row.dependent_type || "dependent",
      gender: row.gender || "",
      date_of_birth: row.date_of_birth || "",
      email: row.email || "",
      phone: row.phone || "",
      is_student: Number(row.is_student || 0),
      is_disabled: Number(row.is_disabled || 0),
      is_active: Number(row.is_active ?? 1),
      status: row.status || "active",
      notes: row.notes || "",
    });
    setErrors({});
    setShowFormModal(true);
  }

  async function handleSave() {
    const nextErrors = validateDependentForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) return;

    const payload = {
      ...form,
      relationship: form.relationship,
      custom_relationship:
        form.relationship === "other"
          ? String(form.custom_relationship || "").trim()
          : "",
      dependent_type: resolveDependentTypeFromRelationship(form.relationship),
      email: form.email || "",
      phone: form.phone || "",
    };

    try {
      setSaving(true);
      setBanner({ type: "", text: "" });

      if (editingDependentId) {
        const { data } = await api.put(
          `/members/me/dependents/${editingDependentId}`,
          payload
        );
        setBanner({
          type: "success",
          text: data?.message || "Dependent updated successfully.",
        });
      } else {
        const { data } = await api.post("/members/me/dependents", payload);
        setBanner({
          type: "success",
          text: data?.message || "Dependent added successfully.",
        });
      }

      setShowFormModal(false);
      resetForm();
      await loadData();
    } catch (err) {
      console.error(err);
      setBanner({
        type: "error",
        text: err?.response?.data?.error || "Failed to save family record.",
      });

      if (err?.response?.data?.errors) {
        setErrors(err.response.data.errors);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("Delete this family / dependent record?");
    if (!confirmed) return;

    try {
      setBanner({ type: "", text: "" });
      await api.delete(`/members/me/dependents/${id}`);
      setBanner({
        type: "success",
        text: "Dependent deleted successfully.",
      });
      await loadData();
    } catch (err) {
      console.error(err);
      setBanner({
        type: "error",
        text: err?.response?.data?.error || "Failed to delete family record.",
      });
    }
  }

  return (
    <div className="member-page">
      <MemberPageHeader
        title="Family / Dependents"
        subtitle="Review and manage household members and dependent records linked to your account."
        actions={[
          {
            label: "Add Family Member",
            variant: "primary",
            onClick: openAddModal,
          },
        ]}
      />

      <DependentFormModal
        open={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          resetForm();
        }}
        form={form}
        setForm={setForm}
        errors={errors}
        onSave={handleSave}
        saving={saving}
        editingDependentId={editingDependentId}
      />

      {banner.text ? (
        <div
          className={`member-banner ${
            banner.type === "error"
              ? "member-banner-error"
              : "member-banner-success"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <FamilySummaryGrid items={summaryItems} />

      <section className="member-card">
        <div className="member-family-search-row">
          <input
            className="member-input"
            placeholder="Search family members, relationships, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="member-empty">
            <h3>Loading...</h3>
            <p>Please wait while we load your family records.</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <MemberEmptyState
            title="No family or dependent records yet"
            subtitle="Linked family and dependent records will appear here."
          />
        ) : (
          <div className="member-table-wrap">
            <table className="member-table member-family-table" style={{ minWidth: 1120 }}>
              <thead>
                <tr>
                  <th>Dependent No</th>
                  <th>Full Name</th>
                  <th>Relationship</th>
                  <th>Type</th>
                  <th>Age</th>
                  <th>Date of Birth</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th className="member-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.dependent_no || "--"}</td>
                    <td>{row.full_name || "--"}</td>
                    <td>
                      <RelationshipBadge
                        relationship={row.relationship}
                        customRelationship={row.custom_relationship}
                      />
                    </td>
                    <td>
                      {row.dependent_type
                        ? String(row.dependent_type).replaceAll("_", " ")
                        : "--"}
                    </td>
                    <td>
                      <AgeBadge age={row.age} />
                    </td>
                    <td>{formatDateMMDDYY(row.date_of_birth)}</td>
                    <td>{row.email || "--"}</td>
                    <td>{row.phone || "--"}</td>
                    <td>
                      <MemberStatusBadge status={row.status || "--"} />
                    </td>
                    <td className="member-col-actions">
                      <RowActionsMenu
                        row={row}
                        onEdit={openEditModal}
                        onDelete={handleDelete}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}