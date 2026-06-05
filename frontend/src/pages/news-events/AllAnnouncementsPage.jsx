// //frontend\src\pages\news-events\AllAnnouncementsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../components/api";
import "../../styles/eventsNewsPage.css";

const PAGE_LIMIT = 9;

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function buildPreview(item) {
  const text = stripHtml(item.summary || item.body_html || "");
  if (!text) return "";
  return text.length > 170 ? `${text.slice(0, 170)}…` : text;
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return null;

  const fmt = (value) =>
    new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  if (startDate && endDate && startDate !== endDate) return `${fmt(startDate)} - ${fmt(endDate)}`;
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

export default function AllAnnouncementsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function loadAnnouncements() {
      setLoading(true);
      setErr("");

      try {
        const { data } = await api.get("/news-events", {
          params: {
            category: "news",
            published: "1",
            page,
            limit: PAGE_LIMIT,
          },
        });

        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotalPages(Number(data?.totalPages || 1));
      } catch (error) {
        console.error(error);
        setErr("Could not load announcements. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    loadAnnouncements();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  return (
    <div className="cat-page-wrap">
      <div className="cat-page-header">
        <div>
          <div className="cat-eyebrow">Church Announcements</div>
          <h1>All Announcements</h1>
          <p>Browse past and present announcements from our church community.</p>
        </div>

        <button
          type="button"
          className="cat-back-btn"
          onClick={() => navigate("/news-events/news")}
        >
          ← Back to Announcements
        </button>
      </div>

      {err ? <div className="cat-error">{err}</div> : null}
      {loading ? <div className="cat-loading">Loading…</div> : null}

      {!loading && (
        <>
          {items.length ? (
            <div className="ann-grid clean-ann-grid">
              {items.map((item) => (
                <AnnouncementCard
                  key={item.id}
                  item={item}
                  onClick={(eventId) =>
                    navigate(`/news-events/${eventId}`, {
                      state: { from: "/news-events/announcements/all" },
                    })
                  }
                />
              ))}
            </div>
          ) : (
            !err && <div className="cat-empty">No announcements found.</div>
          )}

          {totalPages > 1 ? (
            <div className="ann-pagination">
              <button
                type="button"
                className="ann-page-btn"
                disabled={page === 1}
                onClick={() => setPage((prev) => prev - 1)}
              >
                ← Previous
              </button>

              <span className="ann-page-info">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                className="ann-page-btn"
                disabled={page === totalPages}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next →
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}