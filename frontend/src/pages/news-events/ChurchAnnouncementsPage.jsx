// //frontend\src\pages\news-events\ChurchAnnouncementsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../components/api";
import "../../styles/eventsNewsPage.css";

const INITIAL_LIMIT = 3;
const VIEW_ALL_LIMIT = 100;

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function buildPreview(item) {
  const text = stripHtml(item.summary || item.body_html || "");
  if (!text) return "";
  return text.length > 165 ? `${text.slice(0, 165)}…` : text;
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return null;

  const fmt = (value) =>
    new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  if (startDate && endDate && startDate !== endDate) {
    return `${fmt(startDate)} - ${fmt(endDate)}`;
  }
  return fmt(startDate || endDate);
}

function AnnouncementCard({ item, onClick }) {
  return (
    <button type="button" className="ann-card clean-ann-card" onClick={() => onClick(item.id)}>
      <div className="ann-card-body">
        <div className="ann-card-topline">
          <span className="ann-card-badge">Announcement</span>
          {formatDateRange(item.start_date, item.end_date) ? (
            <span className="ann-card-date">
              {formatDateRange(item.start_date, item.end_date)}
            </span>
          ) : null}
        </div>

        <h3 className="ann-card-title">{item.title}</h3>

        {item.location ? <div className="ann-card-location">📍 {item.location}</div> : null}
        {item.time_text ? <div className="ann-card-time">⏰ {item.time_text}</div> : null}
        {buildPreview(item) ? <p className="ann-card-summary">{buildPreview(item)}</p> : null}
      </div>
    </button>
  );
}

export default function ChurchAnnouncementsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(false);

  const requestLimit = showAll ? VIEW_ALL_LIMIT : INITIAL_LIMIT;

  useEffect(() => {
    async function loadAnnouncements() {
      setLoading(true);
      setErr("");

      try {
        const { data } = await api.get("/news-events", {
          params: {
            category: "news",
            published: "1",
            page: 1,
            limit: requestLimit,
          },
        });

        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (error) {
        console.error(error);
        setErr("Could not load announcements. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    loadAnnouncements();
  }, [requestLimit]);

  const showToggle = useMemo(() => {
    if (showAll) return true;
    return items.length >= INITIAL_LIMIT;
  }, [items.length, showAll]);

  return (
    <div className="cat-page-wrap">
      <div className="cat-page-header">
        <div>
          <div className="cat-eyebrow">Church Announcements</div>
          <h1>Announcements</h1>
          <p>Stay updated with the latest announcements from our church community.</p>
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

      {err ? <div className="cat-error">{err}</div> : null}
      {loading ? <div className="cat-loading">Loading announcements…</div> : null}

      {!loading && (
        <>
          {items.length ? (
            <>
              <div className="ann-grid clean-ann-grid">
                {items.map((item) => (
                  <AnnouncementCard
                    key={item.id}
                    item={item}
                    onClick={(eventId) =>
                      navigate(`/news-events/${eventId}`, {
                        state: { from: "/news-events/news" },
                      })
                    }
                  />
                ))}
              </div>

              <div className="cat-list-actions">
                {showToggle ? (
                  <button
                    type="button"
                    className="cat-action-btn cat-action-btn-secondary"
                    onClick={() => setShowAll((prev) => !prev)}
                  >
                    {showAll ? "Show fewer" : "View all announcements"}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="ann-view-all-btn"
                  onClick={() => navigate("/news-events/announcements/all")}
                >
                  Open paged announcements →
                </button>
              </div>
            </>
          ) : (
            !err && <div className="cat-empty">No announcements at this time. Check back soon.</div>
          )}
        </>
      )}
    </div>
  );
}