

 //frontend\src\components\NewsEvents.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Home.css";

const MODULES = [
  {
    id: "kids",
    kicker: "Programs",
    title: "Kids Programs",
    text: "Explore faith-building kids programs with schedules, dates, and activity details.",
    cta: "See Kids Programs",
    link: "/news-events/kids",
  },
  {
    id: "holiday",
    kicker: "Seasonal",
    title: "Holiday Activities",
    text: "View holy days, fasting seasons, and special church holiday activities with calendar support.",
    cta: "See Holiday Activities",
    link: "/news-events/holiday",
  },
  {
    id: "trip",
    kicker: "Trips & Outings",
    title: "Trips & Outings",
    text: "Browse upcoming church trips and outings with location, dates, and event information.",
    cta: "Browse Trips",
    link: "/news-events/trip",
  },
  {
    id: "news",
    kicker: "Church Announcements",
    title: "Announcements",
    text: "Read the latest church announcements and open any item to view full details on its own page.",
    cta: "See Announcements",
    link: "/news-events/news",
  },
];

export default function NewsEvents() {
  const navigate = useNavigate();

  return (
    <section id="news-events" className="ht-section ht-section-alt">
      <div className="ht-container">
        <div className="ht-section-head">
          <h2 className="ht-section-title">News &amp; Events</h2>
          <p className="ht-section-subtitle">
            Stay informed about church announcements, seasonal activities,
            children’s programs, and upcoming trips and gatherings.
          </p>
        </div>

        <div className="ht-grid ht-grid-4">
          {MODULES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="ht-card ht-card-equal ht-card-button"
              onClick={() => navigate(item.link)}
            >
              <div className="ht-card-kicker">{item.kicker}</div>
              <h3 className="ht-card-title">{item.title}</h3>
              <p className="ht-card-text">{item.text}</p>
              <span className="ht-btn ht-btn-secondary">{item.cta}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}