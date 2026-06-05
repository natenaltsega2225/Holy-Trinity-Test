//frontend\src\components\VolunteerHoursModal.jsx
import React, { useMemo, useState } from "react";
import api from "./api";
import "../styles/volunteerApplicationPage.css";

const CATEGORY_OPTIONS = [
  "Sunday School",
  "Youth Mentorship",
  "Liturgical Assistance",
  "Welcoming / Ushering",
  "Parking Assistance",
  "Facility Setup & Maintenance",
  "Event Planning Team",
  "Community Outreach",
  "Media / Technology",
  "Hospitality",
  "Fundraising / Development",
];

function calculateHours(start, end) {
  if (!start || !end) return "";
  const [sh, sm] = String(start).split(":").map(Number);
  const [eh, em] = String(end).split(":").map(Number);

  if (![sh, sm, eh, em].every(Number.isFinite)) return "";
  const diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) return "";
  return (diff / 60).toFixed(2);
}

export default function VolunteerHoursModal({ open, onClose }) {
  const [form, setForm] = useState({
    volunteer_name: "",
    email: "",
    category: "",
    date_served: "",
    start_time: "",
    end_time: "",
    total_hours: "",
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState({ type: "", text: "" });

  const hoursPreview = useMemo(() => {
    return calculateHours(form.start_time, form.end_time);
  }, [form.start_time, form.end_time]);

  function updateField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      next.total_hours = calculateHours(next.start_time, next.end_time);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert({ type: "", text: "" });

    if (!form.volunteer_name.trim()) {
      setAlert({ type: "error", text: "Full name is required." });
      return;
    }

    if (!form.category.trim()) {
      setAlert({ type: "error", text: "Category is required." });
      return;
    }

    if (!form.date_served) {
      setAlert({ type: "error", text: "Date served is required." });
      return;
    }

    const totalHours = calculateHours(form.start_time, form.end_time);
    if (!totalHours) {
      setAlert({
        type: "error",
        text: "End time must be later than start time.",
      });
      return;
    }

    try {
      setSubmitting(true);

      await api.post("/volunteer-hours", {
        ...form,
        total_hours: totalHours,
      });

      setAlert({
        type: "success",
        text: "Your volunteer hours were submitted successfully.",
      });

      setForm({
        volunteer_name: "",
        email: "",
        category: "",
        date_served: "",
        start_time: "",
        end_time: "",
        total_hours: "",
        notes: "",
      });
    } catch (err) {
      setAlert({
        type: "error",
        text: err?.response?.data?.message || "Failed to submit volunteer hours.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="vap-modal-backdrop" onClick={onClose}>
      <div className="vap-modal-shell" onClick={(e) => e.stopPropagation()}>
        <div className="vap-modal-header">
          <div>
            <p className="vap-eyebrow">Holy Trinity Ethiopian Orthodox Church</p>
            <h2 className="vap-title vap-title--modal">Log My Volunteer Hours</h2>
            <p className="vap-subtitle vap-subtitle--modal">
              Submit the hours you served so the church can maintain an accurate
              volunteer service record and recognition history.
            </p>
          </div>

          <button type="button" className="vap-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="vap-card vap-card--context">
          <div className="vap-context-grid">
            <div className="vap-context-item">
              <span>Purpose</span>
              <strong>Volunteer Hour Submission</strong>
            </div>
            <div className="vap-context-item">
              <span>Tracking</span>
              <strong>Hours are calculated automatically</strong>
            </div>
            <div className="vap-context-item vap-context-item--full">
              <span>Current Hours Preview</span>
              <strong>{hoursPreview || "Enter start and end time"}</strong>
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
                value={form.volunteer_name}
                onChange={(e) => updateField("volunteer_name", e.target.value)}
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
              <span>Category</span>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
              >
                <option value="">Select category</option>
                {CATEGORY_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Date Served</span>
              <input
                type="date"
                value={form.date_served}
                onChange={(e) => updateField("date_served", e.target.value)}
              />
            </label>

            <label>
              <span>Start Time</span>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => updateField("start_time", e.target.value)}
              />
            </label>

            <label>
              <span>End Time</span>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => updateField("end_time", e.target.value)}
              />
            </label>

            <label>
              <span>Total Hours</span>
              <input
                type="text"
                value={form.total_hours}
                readOnly
                placeholder="Auto calculated"
              />
            </label>

            <label className="vap-full">
              <span>Notes</span>
              <textarea
                rows={5}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Optional notes about your service"
              />
            </label>
          </div>

          <div className="vap-actions">
            <button
              type="button"
              className="vap-btn vap-btn--ghost"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="vap-btn vap-btn--primary"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Hours"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}