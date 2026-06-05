import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../components/api";
import "../styles/volunteerApplicationPage.css";

function normalizePhoneInput(v) {
  return String(v ?? "").replace(/\D/g, "").slice(0, 11);
}

function normalizeDateOnly(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTimeOnly(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.slice(0, 5);
  }

  return raw;
}

export default function VolunteerApplicationPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialDate = useMemo(
    () => normalizeDateOnly(location.state?.activity_date),
    [location.state]
  );

  const initialStart = useMemo(
    () => normalizeTimeOnly(location.state?.start_time),
    [location.state]
  );

  const initialEnd = useMemo(
    () => normalizeTimeOnly(location.state?.end_time),
    [location.state]
  );

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    category: location.state?.category || "",
    role: location.state?.category || "",
    activity_title: location.state?.title || "",
    activity_date: initialDate || "",
    activity_start_time: initialStart || "",
    activity_end_time: initialEnd || "",
    activity_location: location.state?.location || "",
    additional_notes: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState({ type: "", text: "" });

  useEffect(() => {
    const storedUser = localStorage.getItem("ht_user");
    if (!storedUser) return;

    try {
      const parsed = JSON.parse(storedUser);
      setForm((prev) => ({
        ...prev,
        full_name: parsed?.full_name || parsed?.name || "",
        email: parsed?.email || "",
        phone: parsed?.phone || "",
      }));
    } catch {
      // ignore
    }
  }, []);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert({ type: "", text: "" });

    if (!form.full_name.trim()) {
      setAlert({ type: "error", text: "Full name is required." });
      return;
    }

    if (!form.category.trim()) {
      setAlert({ type: "error", text: "Category is required." });
      return;
    }

    try {
      setSubmitting(true);

      await api.post("/volunteer-applications", {
        ...form,
        activity_date: normalizeDateOnly(form.activity_date),
        activity_start_time: normalizeTimeOnly(form.activity_start_time),
        activity_end_time: normalizeTimeOnly(form.activity_end_time),
      });

      setAlert({
        type: "success",
        text: `Your application for ${form.category} was submitted successfully.`,
      });

      setTimeout(() => {
        navigate("/serve");
      }, 1200);
    } catch (err) {
      setAlert({
        type: "error",
        text: err?.response?.data?.message || "Failed to submit application.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="vap-page">
      <div className="vap-shell">
        <div className="vap-hero">
          <p className="vap-eyebrow">Volunteer Application</p>
          <h1 className="vap-title">{form.category || "Volunteer Application"}</h1>
          <p className="vap-subtitle">
            Review the selected opportunity and submit your application.
          </p>
        </div>

        <div className="vap-card vap-card--context">
          <div className="vap-context-grid">
            <div className="vap-context-item">
              <span>Category</span>
              <strong>{form.category || "—"}</strong>
            </div>
            <div className="vap-context-item">
              <span>Activity</span>
              <strong>{form.activity_title || "—"}</strong>
            </div>
            <div className="vap-context-item">
              <span>Date</span>
              <strong>{form.activity_date || "TBD"}</strong>
            </div>
            <div className="vap-context-item">
              <span>Time</span>
              <strong>
                {form.activity_start_time || "TBD"}
                {form.activity_end_time ? ` - ${form.activity_end_time}` : ""}
              </strong>
            </div>
            <div className="vap-context-item vap-context-item--full">
              <span>Location</span>
              <strong>{form.activity_location || "TBD"}</strong>
            </div>
          </div>
        </div>

        <form className="vap-card" onSubmit={handleSubmit}>
          {alert.text ? (
            <div
              className={`vap-alert ${
                alert.type === "success" ? "vap-alert--success" : "vap-alert--error"
              }`}
            >
              {alert.text}
            </div>
          ) : null}

          <div className="vap-grid">
            <label>
              <span>Full Name</span>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                placeholder="Full Name"
              />
            </label>

            <label>
              <span>Email Address</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="Email Address (optional)"
              />
            </label>

            <label>
              <span>Phone Number</span>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => updateField("phone", normalizePhoneInput(e.target.value))}
                placeholder="Phone Number (optional)"
                inputMode="numeric"
                maxLength={11}
              />
            </label>

            <label>
              <span>Category</span>
              <input type="text" value={form.category} readOnly />
            </label>

            <label className="vap-full">
              <span>Additional Notes</span>
              <textarea
                rows={5}
                value={form.additional_notes}
                onChange={(e) => updateField("additional_notes", e.target.value)}
                placeholder="Anything the admin should know"
              />
            </label>
          </div>

          <div className="vap-actions">
            <button
              type="button"
              className="vap-btn vap-btn--ghost"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="vap-btn vap-btn--primary"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}