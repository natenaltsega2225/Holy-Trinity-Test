
// //frontend\src\pages\news-events\HolidayActivitiesPage.jsx
import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LiturgicalCalendar from "../../components/LiturgicalCalendar";
import "../../styles/eventsNewsPage.css";

export default function HolidayActivitiesPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const targetId = location.state?.scrollTo;
    if (!targetId) return;

    const el = document.getElementById(targetId);
    if (!el) return;

    const headerOffset = 90;
    const elementPosition = el.getBoundingClientRect().top + window.scrollY;
    const offsetPosition = elementPosition - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
    // optional: clear state effect on refresh-less navigation
    // window.history.replaceState({}, document.title);
  }, [location]);

  return (
    <div className="cat-page-wrap">
      <div className="cat-page-header">
        <div>
          <div className="cat-eyebrow">Seasonal</div>
          <h1>Holiday Activities</h1>
          <p>
            Fun and spiritually uplifting activities held during yearly holidays.
          </p>
        </div>

        <div className="cat-header-actions">
          <button
            type="button"
            className="cat-back-btn"
            onClick={() => navigate("/", { state: { scrollTo: "news-events" } })}
          >
            ← Back to News &amp; Events
          </button>
        </div>
      </div>

      <div id="holiday-calendar-section">
        <LiturgicalCalendar />
      </div>
    </div>
  );
}