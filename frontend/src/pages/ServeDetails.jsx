// // src/pages/ServeDetails.jsx 
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/servePage.css";

function formatDate(value) {
  if (!value) return "TBD";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "TBD";
  const [hour, minute] = String(value).split(":");
  const h = Number(hour);
  if (!Number.isFinite(h)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minute || "00"} ${suffix}`;
}

export default function ServeDetails() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state) {
    return (
      <div className="sp-container">
        <div className="sp-empty">
          <span>📭</span>
          <p>No serve category selected.</p>
          <button className="sp-clear-btn-lg" onClick={() => navigate("/serve")}>
            Back to Serve Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-container">
      <div className="sp-hero">
        <div className="sp-hero-content">
          <span className="sp-hero-eyebrow">Serve Details</span>
          <h1 className="sp-hero-title">{state.category}</h1>
          <p className="sp-hero-desc">{state.description}</p>
        </div>

        <button className="sp-back-btn" onClick={() => navigate("/serve")}>
          ← Back to Serve
        </button>
      </div>

      <section className="sp-section">
        <div className="sp-detail-card">
          <div className="sp-detail-grid">
            <div className="sp-detail-item">
              <span>Category</span>
              <strong>{state.category || "—"}</strong>
            </div>

            <div className="sp-detail-item">
              <span>Activity</span>
              <strong>{state.title || "—"}</strong>
            </div>

            <div className="sp-detail-item">
              <span>Date</span>
              <strong>{formatDate(state.activity_date)}</strong>
            </div>

            <div className="sp-detail-item">
              <span>Time</span>
              <strong>
                {formatTime(state.start_time)} – {formatTime(state.end_time)}
              </strong>
            </div>

            <div className="sp-detail-item">
              <span>Location</span>
              <strong>{state.location || "TBD"}</strong>
            </div>

            <div className="sp-detail-item sp-detail-item--full">
              <span>Notes</span>
              <strong>{state.notes || "No additional notes."}</strong>
            </div>
          </div>

          <div className="sp-detail-actions">
            <button
              className="sp-apply-btn"
              onClick={() =>
                navigate("/volunteer-application", {
                  state: {
                    category: state.category,
                    title: state.title,
                    description: state.description,
                    activity_date: state.activity_date,
                    start_time: state.start_time,
                    end_time: state.end_time,
                    location: state.location,
                    notes: state.notes,
                  },
                })
              }
            >
              Apply for {state.category}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}