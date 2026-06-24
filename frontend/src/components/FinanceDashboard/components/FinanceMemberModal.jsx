// frontend/src/components/FinanceDashboard/components/FinanceMemberModal.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Phone,
  Save,
  UserRound,
  X,
} from "lucide-react";
import api from "../../api";
import "../../../styles/finance-enterprise.css";

const HOUSEHOLD_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "family", label: "Family" },
  { value: "single_parent", label: "Single Parent" },
  { value: "couple", label: "Couple" },
];

const GENDER_OPTIONS = [
  { value: "", label: "Select Gender" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

const MEMBERSHIP_STATUSES = [
  { value: "active", label: "Active" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

const ACCOUNT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "pending_password_change", label: "Pending Password Change" },
  { value: "inactive", label: "Inactive" },
  { value: "locked", label: "Locked" },
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

function dateOnly(value) {
  if (!value) return "";

  const raw = clean(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  return d.toISOString().slice(0, 10);
}

function buildInitialForm(member = {}) {
  const firstName = firstValue(member, ["first_name"], "");
  const lastName = firstValue(member, ["last_name"], "");
  const fullName = firstValue(member, ["full_name", "name"], "");

  const split = fullName.split(/\s+/).filter(Boolean);

  return {
    member_no: firstValue(member, ["member_no", "member_number"], ""),

    first_name: firstName || split[0] || "",
    last_name: lastName || split.slice(1).join(" ") || "",
    middle_name: firstValue(member, ["middle_name"], ""),

    gender: firstValue(member, ["gender"], ""),
    date_of_birth: dateOnly(firstValue(member, ["date_of_birth", "dob"], "")),
    household_type: firstValue(member, ["household_type"], "individual"),

    email: firstValue(member, ["email", "member_email"], ""),
    phone: firstValue(member, ["phone", "mobile"], ""),
    alternate_phone: firstValue(member, ["alternate_phone"], ""),

    address: firstValue(member, ["address", "street_address"], ""),
    city: firstValue(member, ["city"], ""),
    state: firstValue(member, ["state"], ""),
    zip: firstValue(member, ["zip", "zipcode", "postal_code"], ""),

    membership_status: firstValue(member, ["membership_status"], "active"),
    account_status: firstValue(member, ["account_status"], "active"),
    start_date: dateOnly(firstValue(member, ["membership_start_date", "start_date", "created_at"], "")),
    end_date: dateOnly(firstValue(member, ["membership_end_date", "end_date"], "")),

    username: firstValue(member, ["username"], ""),
    must_change_password:
      Number(firstValue(member, ["must_change_password"], 0)) === 1,

    notes: firstValue(member, ["notes", "internal_notes"], ""),

    send_profile_email: false,
    reset_password: false,
  };
}

function normalizePayload(form) {
  const firstName = clean(form.first_name);
  const lastName = clean(form.last_name);
  const fullName = [firstName, clean(form.middle_name), lastName]
    .filter(Boolean)
    .join(" ");

  return {
    member_no: clean(form.member_no) || null,

    first_name: firstName,
    middle_name: clean(form.middle_name) || null,
    last_name: lastName,
    full_name: fullName,

    gender: clean(form.gender) || null,
    date_of_birth: form.date_of_birth || null,
    household_type: form.household_type || "individual",

    email: clean(form.email),
    phone: clean(form.phone),
    alternate_phone: clean(form.alternate_phone) || null,

    address: clean(form.address) || null,
    street_address: clean(form.address) || null,
    city: clean(form.city) || null,
    state: clean(form.state) || null,
    zip: clean(form.zip) || null,

    membership_status: form.membership_status || "active",
    status: form.membership_status || "active",
    account_status: form.account_status || "active",
    membership_start_date: form.start_date || null,
    membership_end_date: form.end_date || null,

    username: clean(form.username) || null,
    must_change_password: form.must_change_password ? 1 : 0,

    notes: clean(form.notes) || null,
    internal_notes: clean(form.notes) || null,

    send_profile_email: Boolean(form.send_profile_email),
    reset_password: Boolean(form.reset_password),

    source: "finance_member_modal",
  };
}

function Field({ label, children }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

export default function FinanceMemberModal({
  open,
  member = null,
  mode,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(member?.id || member?.member_id || mode === "edit");

  const [form, setForm] = useState(buildInitialForm(member || {}));
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const title = isEdit ? "Edit Member" : "Create Member";

  const fullNamePreview = useMemo(() => {
    return [form.first_name, form.middle_name, form.last_name]
      .map(clean)
      .filter(Boolean)
      .join(" ");
  }, [form]);

  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(member || {}));
      setError("");
      setSuccess("");
      setSaving(false);
    }
  }, [open, member]);

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
    setSuccess("");

    if (!clean(form.first_name)) {
      setError("First name is required.");
      return;
    }

    if (!clean(form.last_name)) {
      setError("Last name is required.");
      return;
    }

    if (!clean(form.email)) {
      setError("Email is required.");
      return;
    }

    if (!clean(form.phone)) {
      setError("Phone is required.");
      return;
    }

    const payload = normalizePayload(form);

    setSaving(true);

    try {
      const id = member?.id || member?.member_id;

      let response;

      if (isEdit && id) {
        response = await api.patch(`/finance/members/${id}`, payload);
      } else {
        response = await api.post("/finance/members", payload);
      }

      setSuccess(isEdit ? "Member profile updated." : "Member profile created.");
      onSaved?.(response.data);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save member profile."
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
            <p className="finance-eyebrow">Finance Member Management</p>
            <h2>{title}</h2>
            <span>
              Maintain member identity, contact, membership, portal, and audit
              details.
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

        {success ? (
          <div className="finance-alert success">
            <CheckCircle2 size={16} />
            {success}
          </div>
        ) : null}

        <section className="finance-modal-section">
          <div className="finance-section-head">
            <div>
              <h3>
                <UserRound size={17} />
                Member Information
              </h3>
              <p>
                Member ID is managed by the backend. Finance can update profile
                and household fields.
              </p>
            </div>

            {form.member_no ? (
              <span className="finance-status-badge neutral">{form.member_no}</span>
            ) : null}
          </div>

          <div className="finance-form-grid three">
            <Field label="Member ID">
              <input
                value={form.member_no}
                onChange={(event) => setValue("member_no", event.target.value)}
                placeholder="Auto assigned"
                disabled={isEdit}
              />
            </Field>

            <Field label="First Name *">
              <input
                value={form.first_name}
                onChange={(event) => setValue("first_name", event.target.value)}
                required
              />
            </Field>

            <Field label="Last Name *">
              <input
                value={form.last_name}
                onChange={(event) => setValue("last_name", event.target.value)}
                required
              />
            </Field>

            <Field label="Middle Name">
              <input
                value={form.middle_name}
                onChange={(event) => setValue("middle_name", event.target.value)}
              />
            </Field>

            <Field label="Gender">
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
            </Field>

            <Field label="Date of Birth">
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(event) => setValue("date_of_birth", event.target.value)}
              />
            </Field>

            <Field label="Household Type">
              <select
                value={form.household_type}
                onChange={(event) => setValue("household_type", event.target.value)}
              >
                {HOUSEHOLD_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="finance-calculated-box">
              <span>Display Name</span>
              <strong>{fullNamePreview || "--"}</strong>
            </div>
          </div>
        </section>

        <section className="finance-modal-section">
          <div className="finance-section-head">
            <div>
              <h3>
                <Mail size={17} />
                Contact
              </h3>
              <p>
                These fields are used for welcome email, invoice, receipt,
                statement, and reminder delivery.
              </p>
            </div>
          </div>

          <div className="finance-form-grid three">
            <Field label="Email *">
              <input
                type="email"
                value={form.email}
                onChange={(event) => setValue("email", event.target.value)}
                required
              />
            </Field>

            <Field label="Phone *">
              <input
                value={form.phone}
                onChange={(event) => setValue("phone", event.target.value)}
                required
              />
            </Field>

            <Field label="Alternate Phone">
              <input
                value={form.alternate_phone}
                onChange={(event) => setValue("alternate_phone", event.target.value)}
              />
            </Field>

            <Field label="Address">
              <input
                value={form.address}
                onChange={(event) => setValue("address", event.target.value)}
              />
            </Field>

            <Field label="City">
              <input
                value={form.city}
                onChange={(event) => setValue("city", event.target.value)}
              />
            </Field>

            <Field label="State">
              <input
                value={form.state}
                onChange={(event) => setValue("state", event.target.value)}
              />
            </Field>

            <Field label="ZIP">
              <input
                value={form.zip}
                onChange={(event) => setValue("zip", event.target.value)}
              />
            </Field>

            <div className="finance-calculated-box">
              <span>Primary Contact</span>
              <strong>
                <Phone size={14} />
                {form.phone || "--"}
              </strong>
            </div>
          </div>
        </section>

        <section className="finance-modal-section">
          <div className="finance-section-head">
            <div>
              <h3>Membership & Portal</h3>
              <p>
                Controls dashboard access, payment status display, reminders, and
                membership lifecycle.
              </p>
            </div>
          </div>

          <div className="finance-form-grid three">
            <Field label="Membership Status">
              <select
                value={form.membership_status}
                onChange={(event) =>
                  setValue("membership_status", event.target.value)
                }
              >
                {MEMBERSHIP_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Account Status">
              <select
                value={form.account_status}
                onChange={(event) => setValue("account_status", event.target.value)}
              >
                {ACCOUNT_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Username">
              <input
                value={form.username}
                onChange={(event) => setValue("username", event.target.value)}
                placeholder="Auto or existing username"
              />
            </Field>

            <Field label="Start Date">
              <input
                type="date"
                value={form.start_date}
                onChange={(event) => setValue("start_date", event.target.value)}
              />
            </Field>

            <Field label="End Date">
              <input
                type="date"
                value={form.end_date}
                onChange={(event) => setValue("end_date", event.target.value)}
              />
            </Field>
          </div>

          <div className="finance-check-grid">
            <label>
              <input
                type="checkbox"
                checked={form.must_change_password}
                onChange={(event) =>
                  setValue("must_change_password", event.target.checked)
                }
              />
              Require password change
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.reset_password}
                onChange={(event) => setValue("reset_password", event.target.checked)}
              />
              Reset temporary password
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.send_profile_email}
                onChange={(event) =>
                  setValue("send_profile_email", event.target.checked)
                }
              />
              Send profile email
            </label>
          </div>
        </section>

        <label className="finance-field-full">
          Internal Notes
          <textarea
            value={form.notes}
            onChange={(event) => setValue("notes", event.target.value)}
            rows={3}
            placeholder="Finance-only notes"
          />
        </label>

        <div className="finance-modal-actions">
          <button type="button" className="finance-btn ghost" onClick={close}>
            Cancel
          </button>

          <button type="submit" className="finance-btn primary" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save Member"}
          </button>
        </div>
      </form>
    </div>
  );
}