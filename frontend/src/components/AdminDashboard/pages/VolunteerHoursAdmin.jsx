//frontend\src\components\AdminDashboard\pages\VolunteerHoursAdmin.jsx
import React, { useMemo, useState } from "react";
import "../../../styles/admin-serve-center.css";

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

const INITIAL_ROWS = [
  {
    id: 1,
    volunteer_name: "Nati Tsega",
    email: "nat12@gmail.com",
    category: "Liturgical Assistance",
    date_served: "2026-04-10",
    start_time: "09:30",
    end_time: "12:30",
    total_hours: 3,
    notes: "Helped with service support",
  },
];

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function calculateHours(start, end) {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return "";
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const diff = endMinutes - startMinutes;
  if (diff <= 0) return "";
  return (diff / 60).toFixed(2);
}

export default function VolunteerHoursAdmin() {
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [search, setSearch] = useState("");
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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      return (
        row.volunteer_name?.toLowerCase().includes(q) ||
        row.email?.toLowerCase().includes(q) ||
        row.category?.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  function updateField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "start_time" || key === "end_time") {
        next.total_hours = calculateHours(
          key === "start_time" ? value : next.start_time,
          key === "end_time" ? value : next.end_time
        );
      }
      return next;
    });
  }

  function resetForm() {
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
  }

  function handleSubmit(e) {
    e.preventDefault();

    const newRow = {
      id: Date.now(),
      ...form,
      total_hours: Number(form.total_hours || 0),
    };

    setRows((prev) => [newRow, ...prev]);
    resetForm();
  }

  return (
    <div className="asc-page">
      <section className="asc-hero">
        <div>
          <p className="asc-eyebrow">Administration</p>
          <h1 className="asc-title">Volunteer Hours</h1>
          <p className="asc-subtitle">
            Track service hours separately from volunteer applications. This keeps
            actual service records clean and flexible.
          </p>
        </div>

        <div className="asc-hero-stats">
          <div className="asc-stat-card">
            <strong>{rows.length}</strong>
            <span>Entries</span>
          </div>
          <div className="asc-stat-card">
            <strong>
              {rows.reduce((sum, row) => sum + Number(row.total_hours || 0), 0).toFixed(2)}
            </strong>
            <span>Total Hours</span>
          </div>
        </div>
      </section>

      <section className="asc-card">
        <div className="asc-card-head">
          <h2>Add Volunteer Hours</h2>
        </div>

        <form className="asc-post-form" onSubmit={handleSubmit}>
          <div className="asc-grid">
            <label>
              <span>Volunteer Name</span>
              <input
                type="text"
                value={form.volunteer_name}
                onChange={(e) => updateField("volunteer_name", e.target.value)}
                required
              />
            </label>

            <label>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </label>

            <label>
              <span>Category</span>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                required
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
                required
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
                type="number"
                step="0.25"
                value={form.total_hours}
                onChange={(e) => updateField("total_hours", e.target.value)}
                required
              />
            </label>

            <label className="asc-full">
              <span>Notes</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </label>
          </div>

          <div className="asc-actions">
            <button type="button" className="asc-btn asc-btn--ghost" onClick={resetForm}>
              Reset
            </button>
            <button type="submit" className="asc-btn asc-btn--primary">
              Save Hours
            </button>
          </div>
        </form>
      </section>

      <section className="asc-toolbar">
        <div className="asc-toolbar-left">
          <input
            type="text"
            className="asc-search"
            placeholder="Search volunteer hours..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      <section className="asc-card">
        <div className="asc-table-wrap">
          <table className="asc-table">
            <thead>
              <tr>
                <th>Volunteer</th>
                <th>Category</th>
                <th>Date Served</th>
                <th>Time</th>
                <th>Total Hours</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="asc-empty-cell">
                    No volunteer hours found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="asc-person-cell">
                        <strong>{row.volunteer_name}</strong>
                        <span>{row.email || "—"}</span>
                      </div>
                    </td>
                    <td>{row.category}</td>
                    <td>{formatDate(row.date_served)}</td>
                    <td>
                      {(row.start_time || "—") + " - " + (row.end_time || "—")}
                    </td>
                    <td>{Number(row.total_hours || 0).toFixed(2)}</td>
                    <td>{row.notes || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}