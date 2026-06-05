 //frontend\src\pages\DashboardProfile.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../components/api";
import { useAuth } from "../hooks/useAuth";
import "../styles/admin-members-roles.css";

const EMPTY_PROFILE = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  username: "",
  role: "",
  member_id: null,
  member_no: "",
  membership_status: "",
  status: "",
  next_due_at: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip: "",
  total_dependents: 0,
  total_members: 1,
  profile_photo_url: "",
  profile_photo_name: "",
  profile_photo_size: null,
  full_name: "",
};

function clean(value) {
  return String(value || "").trim();
}

function validateName(value) {
  return /^[A-Za-z][A-Za-z\s'-]{0,99}$/.test(clean(value));
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function validatePhone(value) {
  if (!clean(value)) return true;
  return /^[0-9+\-().\s]{7,25}$/.test(clean(value));
}

function validateCityState(value, max = 100) {
  if (!clean(value)) return true;
  const pattern = new RegExp(`^[A-Za-z][A-Za-z\\s.'-]{0,${max - 1}}$`);
  return pattern.test(clean(value));
}

function validateZip(value) {
  if (!clean(value)) return true;
  return /^[A-Za-z0-9 -]{3,20}$/.test(clean(value));
}

function formatDateMMDDYYYY(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function roleLabel(role) {
  const r = String(role || "").toLowerCase();
  if (r === "member") return "Member";
  if (r === "finance") return "Finance";
  if (r === "admin") return "Admin";
  if (r === "reconciliation") return "Reconciliation";
  if (r === "super_admin") return "Super Admin";
  return "User";
}

function roleBadgeClass(role) {
  const r = String(role || "").toLowerCase();
  if (r === "member") return "mr-role-badge mr-role-member";
  if (r === "finance") return "mr-role-badge mr-role-finance";
  if (r === "admin") return "mr-role-badge mr-role-admin";
  if (r === "reconciliation") return "mr-role-badge mr-role-recon";
  if (r === "super_admin") return "mr-role-badge mr-role-super";
  return "mr-role-badge";
}

function buildInitials(profile) {
  const base =
    clean(profile.full_name) ||
    `${clean(profile.first_name)} ${clean(profile.last_name)}`.trim() ||
    clean(profile.username) ||
    clean(profile.email) ||
    "U";

  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() || "")
    .join("");
}

function formatFileSize(value) {
  const size = Number(value || 0);
  if (!size) return "--";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DashboardProfile() {
  const auth = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [draft, setDraft] = useState(EMPTY_PROFILE);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  function syncAuthUser(row) {
    if (!auth?.setUser || !row) return;

    auth.setUser({
      ...(auth.user || {}),
      full_name:
        row.full_name || `${row.first_name || ""} ${row.last_name || ""}`.trim(),
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      email: row.email || "",
      phone: row.phone || "",
      username: row.username || "",
      role: row.role || auth?.user?.role || "",
      member_id: row.member_id ?? null,
      member_no: row.member_no || null,
      membership_status: row.membership_status || null,
      status: row.status || null,
      next_due_at: row.next_due_at || null,
      profile_photo_url: row.profile_photo_url || "",
      profile_photo_name: row.profile_photo_name || "",
      profile_photo_size: row.profile_photo_size ?? null,
      total_dependents: Number(row.total_dependents || 0),
      total_members: Number(row.total_members || 1),
    });
  }

  function normalizeProfile(row) {
    return {
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      full_name: row.full_name || "",
      email: row.email || "",
      phone: row.phone || "",
      username: row.username || "",
      role: row.role || "",
      member_id: row.member_id ?? null,
      member_no: row.member_no || "",
      membership_status: row.membership_status || "",
      status: row.status || "",
      next_due_at: row.next_due_at || "",
      address_line1: row.address_line1 || "",
      address_line2: row.address_line2 || "",
      city: row.city || "",
      state: row.state || "",
      zip: row.zip || "",
      total_dependents: Number(row.total_dependents || 0),
      total_members: Number(row.total_members || 1),
      profile_photo_url: row.profile_photo_url || "",
      profile_photo_name: row.profile_photo_name || "",
      profile_photo_size: row.profile_photo_size ?? null,
    };
  }

  async function loadProfile() {
    try {
      setLoading(true);
      setBanner({ type: "", text: "" });

      const { data } = await api.get("/account/me");
      const row = data?.user || EMPTY_PROFILE;
      const next = normalizeProfile(row);

      setProfile(next);
      setDraft(next);
      syncAuthUser(row);
    } catch (err) {
      console.error(err);
      setBanner({
        type: "error",
        text: err?.response?.data?.error || "Failed to load profile.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const summaryCards = useMemo(() => {
    const items = [
      {
        label: "Role",
        value: roleLabel(profile.role),
       
      },
      {
        label: "Account Status",
        value: Number(auth?.user?.is_active ?? 1) === 1 ? "Active" : "Inactive",
        
      },
    ];

    if (profile.member_id) {
      items.push(
        {
          label: "Membership Status",
          value: profile.membership_status || "--",
         
        },
        {
          label: "Next Renewal Due",
          value: formatDateMMDDYYYY(profile.next_due_at),
          
        },
        {
          label: " Family Dependents",
          value: profile.total_dependents || 0,
          
        },
        {
          label: "Household Total",
          value: profile.total_members || 1,
          sub: "Independent + dependents",
        }
      );
    } else {
      items.push({
        label: "Linked Member",
        value: "No",
        sub: "This account is not tied to a member profile",
      });
    }

    return items;
  }, [profile, auth?.user?.is_active]);

  function validateForm() {
    const next = {};

    if (!clean(draft.first_name)) {
      next.first_name = "First name is required.";
    } else if (!validateName(draft.first_name)) {
      next.first_name =
        "First name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
    }

    if (!clean(draft.last_name)) {
      next.last_name = "Last name is required.";
    } else if (!validateName(draft.last_name)) {
      next.last_name =
        "Last name must contain letters only. Spaces, apostrophes, and hyphens are allowed.";
    }

    if (!clean(draft.email)) {
      next.email = "Email is required.";
    } else if (!validateEmail(draft.email)) {
      next.email = "Enter a valid email address.";
    }

    if (!validatePhone(draft.phone)) {
      next.phone = "Enter a valid phone number.";
    }

    if (!validateCityState(draft.city, 100)) {
      next.city = "City must contain letters only.";
    }

    if (!validateCityState(draft.state, 80)) {
      next.state = "State must contain letters only.";
    }

    if (!validateZip(draft.zip)) {
      next.zip = "ZIP / postal code format is invalid.";
    }

    return next;
  }

  async function handleSave(e) {
    e.preventDefault();

    const nextErrors = validateForm();
    setErrors(nextErrors);
    setBanner({ type: "", text: "" });

    if (Object.keys(nextErrors).length) return;

    try {
      setSaving(true);

      const payload = {
        first_name: clean(draft.first_name),
        last_name: clean(draft.last_name),
        email: clean(draft.email),
        phone: clean(draft.phone),
        address_line1: clean(draft.address_line1),
        address_line2: clean(draft.address_line2),
        city: clean(draft.city),
        state: clean(draft.state),
        zip: clean(draft.zip),
        profile_photo_url: clean(profile.profile_photo_url),
        profile_photo_name: clean(profile.profile_photo_name),
        profile_photo_size: profile.profile_photo_size || null,
        clear_photo: !clean(profile.profile_photo_url),
      };

      const { data } = await api.put("/account/me", payload);
      const row = data?.user || null;

      if (row) {
        const next = normalizeProfile(row);
        setProfile(next);
        setDraft(next);
        syncAuthUser(row);
      }

      setBanner({
        type: "success",
        text: data?.message || "Profile updated successfully.",
      });
    } catch (err) {
      console.error(err);
      setBanner({
        type: "error",
        text:
          err?.response?.data?.error ||
          err?.response?.data?.errors?.email ||
          "Failed to update profile.",
      });

      if (err?.response?.data?.errors) {
        setErrors(err.response.data.errors);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleChoosePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBanner({ type: "", text: "" });

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setBanner({
        type: "error",
        text: "Only JPG, PNG, and WEBP images are allowed.",
      });
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBanner({
        type: "error",
        text: "Profile photo must be 5 MB or smaller.",
      });
      event.target.value = "";
      return;
    }

    try {
      setUploadingPhoto(true);

      const formData = new FormData();
      formData.append("photo", file);

      const { data } = await api.post("/account/me/photo", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const row = data?.user || null;
      if (row) {
        const next = normalizeProfile(row);
        setProfile(next);
        setDraft(next);
        syncAuthUser(row);
      }

      setBanner({
        type: "success",
        text: data?.message || "Profile photo uploaded successfully.",
      });
    } catch (err) {
      console.error(err);
      setBanner({
        type: "error",
        text: err?.response?.data?.error || "Failed to upload profile photo.",
      });
    } finally {
      setUploadingPhoto(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  async function handleRemovePhoto() {
    try {
      setUploadingPhoto(true);
      setBanner({ type: "", text: "" });

      const { data } = await api.delete("/account/me/photo");
      const row = data?.user || null;

      if (row) {
        const next = normalizeProfile(row);
        setProfile(next);
        setDraft(next);
        syncAuthUser(row);
      }

      setBanner({
        type: "success",
        text: data?.message || "Profile photo removed successfully.",
      });
    } catch (err) {
      console.error(err);
      setBanner({
        type: "error",
        text: err?.response?.data?.error || "Failed to remove profile photo.",
      });
    } finally {
      setUploadingPhoto(false);
    }
  }

  const initials = buildInitials(profile);

  return (
    <div className="mr-page">
      <section className="mr-card mr-profile-hero">
        <div className="mr-profile-hero-copy">
          <p className="mr-eyebrow">Account</p>
          <h1 className="mr-title">My Profile</h1>
          <p className="mr-subtitle">
            View and update your dashboard account profile. Profile photo is optional.
          </p>
        </div>

        {/* <div className="mr-profile-hero-actions">
          <button
            type="button"
            className="mr-btn mr-btn-secondary"
            onClick={() => navigate("/forgot-password")}
          >
            Change Password
          </button>
        </div> */}
      </section>

      {banner.text ? (
        <div className={`mr-banner ${banner.type === "error" ? "mr-banner-error" : ""}`}>
          {banner.text}
        </div>
      ) : null}

      {loading ? (
        <section className="mr-card mr-profile-main-card">
          Loading profile...
        </section>
      ) : (
        <section className="mr-profile-layout">
          <article className="mr-card mr-profile-photo-card">
            <div className="mr-profile-photo-stack">
              {profile.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt="Profile"
                  className="mr-profile-avatar-image"
                />
              ) : (
                <div className="mr-profile-avatar-fallback">{initials || "U"}</div>
              )}

              <div className="mr-profile-identity">
                <div className="mr-profile-name">
                  {profile.full_name ||
                    `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
                    "--"}
                </div>

                <div className="mr-profile-role-wrap">
                  <span className={roleBadgeClass(profile.role)}>
                    {roleLabel(profile.role)}
                  </span>
                </div>

                <div className="mr-profile-email">{profile.email || "--"}</div>
                <div className="mr-profile-username">@{profile.username || "--"}</div>
              </div>
            </div>

            <div className="mr-profile-upload-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="mr-profile-hidden-file"
                onChange={handleChoosePhoto}
              />

              <button
                type="button"
                className="mr-btn mr-btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? "Uploading..." : "Upload Profile Photo"}
              </button>

              {profile.profile_photo_url ? (
                <button
                  type="button"
                  className="mr-btn mr-btn-danger"
                  onClick={handleRemovePhoto}
                  disabled={uploadingPhoto}
                >
                  Remove Photo
                </button>
              ) : null}

              
            </div>

            <div className="mr-profile-meta-grid">
              <div className="mr-profile-meta-item">
                <div className="mr-profile-meta-label">Member Number</div>
                <div className="mr-profile-meta-value">{profile.member_no || "--"}</div>
              </div>

              <div className="mr-profile-meta-item">
                <div className="mr-profile-meta-label">Membership Status</div>
                <div className="mr-profile-meta-value">
                  {profile.membership_status || "--"}
                </div>
              </div>

              <div className="mr-profile-meta-item">
                <div className="mr-profile-meta-label">Renewal Due</div>
                <div className="mr-profile-meta-value">
                  {formatDateMMDDYYYY(profile.next_due_at)}
                </div>
              </div>

              <div className="mr-profile-meta-item">
                <div className="mr-profile-meta-label">Photo File</div>
                <div className="mr-profile-meta-value">
                  {profile.profile_photo_name || "--"}
                </div>
              </div>
            </div>
          </article>

          <article className="mr-card mr-profile-main-card">
            <div className="mr-profile-summary-grid">
              {summaryCards.map((item) => (
                <div key={item.label} className="mr-profile-summary-card">
                  <div className="mr-profile-summary-label">{item.label}</div>
                  <div className="mr-profile-summary-value">{item.value}</div>
                  <div className="mr-profile-summary-sub">{item.sub}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSave} className="mr-profile-form">
              <div className="mr-form-grid mr-grid-2">
                <div className="mr-field">
                  <label className="mr-label">First Name</label>
                  <input
                    className="mr-input-plain"
                    value={draft.first_name}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, first_name: e.target.value }))
                    }
                  />
                  {errors.first_name ? (
                    <div className="mr-profile-error-text">{errors.first_name}</div>
                  ) : null}
                </div>

                <div className="mr-field">
                  <label className="mr-label">Last Name</label>
                  <input
                    className="mr-input-plain"
                    value={draft.last_name}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, last_name: e.target.value }))
                    }
                  />
                  {errors.last_name ? (
                    <div className="mr-profile-error-text">{errors.last_name}</div>
                  ) : null}
                </div>

                <div className="mr-field">
                  <label className="mr-label">Email</label>
                  <input
                    className="mr-input-plain"
                    value={draft.email}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                  {errors.email ? (
                    <div className="mr-profile-error-text">{errors.email}</div>
                  ) : null}
                </div>

                <div className="mr-field">
                  <label className="mr-label">Phone</label>
                  <input
                    className="mr-input-plain"
                    value={draft.phone}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                  {errors.phone ? (
                    <div className="mr-profile-error-text">{errors.phone}</div>
                  ) : null}
                </div>

                <div className="mr-field">
                  <label className="mr-label">Username</label>
                  <input className="mr-input-plain" value={draft.username} disabled />
                </div>

                <div className="mr-field">
                  <label className="mr-label">Role</label>
                  <input className="mr-input-plain" value={roleLabel(draft.role)} disabled />
                </div>

                {draft.member_id ? (
                  <>
                    <div className="mr-field">
                      <label className="mr-label">Address Line 1</label>
                      <input
                        className="mr-input-plain"
                        value={draft.address_line1}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, address_line1: e.target.value }))
                        }
                      />
                    </div>

                    <div className="mr-field">
                      <label className="mr-label">Address Line 2</label>
                      <input
                        className="mr-input-plain"
                        value={draft.address_line2}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, address_line2: e.target.value }))
                        }
                      />
                    </div>

                    <div className="mr-field">
                      <label className="mr-label">City</label>
                      <input
                        className="mr-input-plain"
                        value={draft.city}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, city: e.target.value }))
                        }
                      />
                      {errors.city ? (
                        <div className="mr-profile-error-text">{errors.city}</div>
                      ) : null}
                    </div>

                    <div className="mr-field">
                      <label className="mr-label">State</label>
                      <input
                        className="mr-input-plain"
                        value={draft.state}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, state: e.target.value }))
                        }
                      />
                      {errors.state ? (
                        <div className="mr-profile-error-text">{errors.state}</div>
                      ) : null}
                    </div>

                    <div className="mr-field">
                      <label className="mr-label">ZIP</label>
                      <input
                        className="mr-input-plain"
                        value={draft.zip}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, zip: e.target.value }))
                        }
                      />
                      {errors.zip ? (
                        <div className="mr-profile-error-text">{errors.zip}</div>
                      ) : null}
                    </div>

                    <div className="mr-field">
                      <label className="mr-label">Renewal Due</label>
                      <input
                        className="mr-input-plain"
                        value={formatDateMMDDYYYY(draft.next_due_at)}
                        disabled
                      />
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mr-form-actions">
                <button
                  type="button"
                  className="mr-btn mr-btn-secondary"
                  onClick={() => {
                    setDraft(profile);
                    setErrors({});
                  }}
                  disabled={saving}
                >
                  Reset
                </button>

                <button type="submit" className="mr-btn mr-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </article>
        </section>
      )}
    </div>
  );
}