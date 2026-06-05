 // src/pages/ServePage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../components/api";
import VolunteerHoursPopup from "../components/modals/VolunteerHoursPopup";
import "../styles/servePage.css";

function formatDate(value) {
  if (!value) return "TBD";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
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

const FALLBACK_POSTS = [
  {
    id: 1,
    category: "Parking Assistance",
    title: "Sunday Parking Support",
    description:
      "Support safe parking flow before and after liturgy and help guests reach the main entrance.",
    activity_date: "2026-04-20",
    start_time: "08:00",
    end_time: "11:00",
    location: "Main Church Parking Lot",
    notes: "Please arrive 15 minutes early.",
  },
  {
    id: 2,
    category: "Sunday School",
    title: "Sunday School Class Support",
    description:
      "Assist children during Sunday School lessons, classroom setup, and scripture-based activities.",
    activity_date: "2026-04-20",
    start_time: "09:00",
    end_time: "11:30",
    location: "Education Wing - Room A",
    notes: "Please arrive early for setup.",
  },
  {
    id: 3,
    category: "Youth Mentorship",
    title: "Youth Fellowship Mentoring",
    description:
      "Serve during youth fellowship by leading encouragement, mentoring, and small-group support.",
    activity_date: "2026-04-25",
    start_time: "14:00",
    end_time: "16:00",
    location: "Youth Hall",
    notes: "Mentors should arrive before the session begins.",
  },
];

export default function ServePage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState(FALLBACK_POSTS);
  const [loading, setLoading] = useState(true);
  const [showHoursPopup, setShowHoursPopup] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchPosts() {
      try {
        const { data } = await api.get("/serve-posts");
        if (!mounted) return;
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        setPosts(rows.length ? rows : FALLBACK_POSTS);
      } catch (error) {
        console.error("Failed to load serve posts:", error);
        if (mounted) setPosts(FALLBACK_POSTS);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchPosts();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="sp-container">
      <div className="sp-hero">
        <div className="sp-hero-content">
          <span className="sp-hero-eyebrow">Serve With Us</span>
          <h1 className="sp-hero-title">Serve Opportunities</h1>
          <p className="sp-hero-desc">
            Browse volunteer needs posted by admin, apply to serve, and log your
            service hours after you complete your ministry work.
          </p>
        </div>

        <div className="sp-hero-actions">
          <button className="sp-back-btn" onClick={() => navigate("/")}>
            ← Back
          </button>

          <button
            className="sp-hours-btn"
            onClick={() => setShowHoursPopup(true)}
          >
            Log My Volunteer Hours
          </button>
        </div>
      </div>

      <section className="sp-section">
        <div className="sp-section-head">
          <div>
            <p className="sp-section-eyebrow">Volunteer Categories</p>
            <h2 className="sp-section-title">Current Serve Needs</h2>
          </div>
        </div>

        {loading ? (
          <div className="sp-empty">
            <span>⏳</span>
            <p>Loading serve posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="sp-empty">
            <span>📭</span>
            <p>We will notify you soon.</p>
          </div>
        ) : (
          <div className="sp-role-grid">
            {posts.map((item) => (
              <div key={item.id} className="sp-role-card">
                <div className="sp-card-top">
                  <span className="sp-card-badge">{item.category}</span>
                </div>

                <h3 className="sp-card-title">{item.title}</h3>
                <p className="sp-card-desc">{item.description}</p>

                <div className="sp-role-meta">
                  <div className="sp-role-meta-row">
                    <span>Date</span>
                    <strong>{formatDate(item.activity_date)}</strong>
                  </div>
                  <div className="sp-role-meta-row">
                    <span>Time</span>
                    <strong>
                      {formatTime(item.start_time)} – {formatTime(item.end_time)}
                    </strong>
                  </div>
                </div>

                <div className="sp-actions">
                  <button
                    type="button"
                    className="sp-learn-btn"
                    onClick={() =>
                      navigate(`/serve/activity/${item.id}`, {
                        state: { ...item },
                      })
                    }
                  >
                    Learn More
                  </button>

                  <button
                    type="button"
                    className="sp-apply-btn"
                    onClick={() =>
                      navigate("/volunteer-application", {
                        state: {
                          category: item.category,
                          title: item.title,
                          description: item.description,
                          activity_date: item.activity_date,
                          start_time: item.start_time,
                          end_time: item.end_time,
                          location: item.location,
                          notes: item.notes,
                        },
                      })
                    }
                  >
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <VolunteerHoursPopup
        open={showHoursPopup}
        onClose={() => setShowHoursPopup(false)}
      />
    </div>
  );
}