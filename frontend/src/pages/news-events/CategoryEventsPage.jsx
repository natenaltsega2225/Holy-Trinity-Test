// // //frontend\src\pages\news-events\CategoryEventsPage.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import api from "../../components/api";
// import "../../styles/eventsNewsPage.css";

// const PLACEHOLDER_IMG = "https://placehold.co/900x540?text=Church+Event";
// const INITIAL_LIMIT = 3;
// const VIEW_ALL_LIMIT = 100;

// function stripHtml(html) {
//   if (!html) return "";
//   return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
// }

// function buildPreview(item) {
//   const text = stripHtml(item.summary || item.body_html || "");
//   if (!text) return "";
//   return text.length > 150 ? `${text.slice(0, 150)}…` : text;
// }

// function formatDateRange(startDate, endDate) {
//   if (!startDate && !endDate) return null;

//   const fmt = (value) =>
//     new Date(value).toLocaleDateString(undefined, {
//       month: "long",
//       day: "numeric",
//       year: "numeric",
//     });

//   if (startDate && endDate && startDate !== endDate) {
//     return `${fmt(startDate)} – ${fmt(endDate)}`;
//   }

//   return fmt(startDate || endDate);
// }

// function getCategoryBadge(category) {
//   if (category === "kids") return "Kids Program";
//   if (category === "trip") return "Trip / Outing";
//   if (category === "news") return "Announcement";
//   return "Event";
// }

// function getViewAllLabel(category) {
//   if (category === "kids") return "View all kids programs";
//   if (category === "trip") return "View all trips & outings";
//   if (category === "news") return "View all announcements";
//   return "View all";
// }

// function EventCard({ item, category, onClick }) {
//   const flyerUrl = item.flyer_url || PLACEHOLDER_IMG;
//   const dateRange = formatDateRange(item.start_date, item.end_date);
//   const preview = buildPreview(item);

//   return (
//     <article
//       className="cat-event-card cat-event-card--clickable"
//       onClick={() => onClick(item.id)}
//       role="button"
//       tabIndex={0}
//       onKeyDown={(e) => {
//         if (e.key === "Enter" || e.key === " ") {
//           e.preventDefault();
//           onClick(item.id);
//         }
//       }}
//     >
//       <div className="cat-event-media">
//         <img
//           src={flyerUrl}
//           alt={item.title}
//           className="cat-event-img"
//           loading="lazy"
//           onError={(e) => {
//             e.currentTarget.src = PLACEHOLDER_IMG;
//           }}
//         />
//       </div>

//       <div className="cat-event-body">
//         <div className="cat-event-header">
//           <div className="cat-event-header-main">
//             <div className="cat-category-mini-badge">
//               {getCategoryBadge(category)}
//             </div>

//             <h2>{item.title}</h2>

//             {item.subtitle ? (
//               <div className="cat-event-subtitle">{item.subtitle}</div>
//             ) : null}

//             {dateRange ? (
//               <div className="cat-event-date">
//                 📅 {dateRange}
//                 {item.time_text ? <span> · ⏰ {item.time_text}</span> : null}
//               </div>
//             ) : item.time_text ? (
//               <div className="cat-event-date">⏰ {item.time_text}</div>
//             ) : null}

//             {item.location ? (
//               <div className="cat-event-location">📍 {item.location}</div>
//             ) : null}

//             {item.audience ? (
//               <div className="cat-event-audience">👥 {item.audience}</div>
//             ) : null}
//           </div>
//         </div>

//         {preview ? (
//           <div className="cat-event-text">
//             <p className="cat-event-summary">{preview}</p>
//           </div>
//         ) : null}
//       </div>
//     </article>
//   );
// }

// export default function CategoryEventsPage({
//   category,
//   eyebrow,
//   title,
//   description,
//   emptyText,
// }) {
//   const navigate = useNavigate();
//   const [items, setItems] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [err, setErr] = useState("");
//   const [showAll, setShowAll] = useState(false);

//   const requestLimit = showAll ? VIEW_ALL_LIMIT : INITIAL_LIMIT;

//   useEffect(() => {
//     async function load() {
//       setLoading(true);
//       setErr("");

//       try {
//         const { data } = await api.get("/news-events", {
//           params: {
//             category,
//             published: "1",
//             page: 1,
//             limit: requestLimit,
//           },
//         });

//         setItems(Array.isArray(data?.items) ? data.items : []);
//       } catch (error) {
//         console.error(error);
//         setErr("Could not load events. Please try again later.");
//       } finally {
//         setLoading(false);
//       }
//     }

//     load();
//   }, [category, requestLimit]);

//   const showToggle = useMemo(() => {
//     if (showAll) return true;
//     return items.length >= INITIAL_LIMIT;
//   }, [items.length, showAll]);

//   return (
//     <div className="cat-page-wrap">
//       <div className="cat-page-header">
//         <div>
//           <div className="cat-eyebrow">{eyebrow}</div>
//           <h1>{title}</h1>
//           <p>{description}</p>
//         </div>

//         <div className="cat-header-actions">
//           <button
//             type="button"
//             className="cat-back-btn"
//             onClick={() => navigate("/", { state: { scrollTo: "news-events" } })}
//           >
//             ← Back to News &amp; Events
//           </button>
//         </div>
//       </div>

//       {err ? <div className="cat-error">{err}</div> : null}
//       {loading ? <div className="cat-loading">Loading events…</div> : null}

//       {!loading && (
//         <div className="section">
//           {items.length ? (
//             <>
//               <div className="cat-events-list cat-events-list--three-up">
//                 {items.map((item) => (
//                   <EventCard
//                     key={item.id}
//                     item={item}
//                     category={category}
//                     onClick={(id) =>
//                       navigate(`/news-events/${id}`, {
//                         state: { from: `/news-events/${category}` },
//                       })
//                     }
//                   />
//                 ))}
//               </div>

//               {showToggle ? (
//                 <div className="cat-list-actions">
//                   <button
//                     type="button"
//                     className="cat-action-btn cat-action-btn-secondary"
//                     onClick={() => setShowAll((prev) => !prev)}
//                   >
//                     {showAll ? "Show fewer" : getViewAllLabel(category)}
//                   </button>
//                 </div>
//               ) : null}
//             </>
//           ) : (
//             !err && <div className="cat-empty">{emptyText}</div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

// // frontend/src/pages/news-events/CategoryEventsPage.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import api from "../../components/api";
// import ProgramRegistrationModal from "../ProgramRegistrationModal";
// import "../../styles/eventsNewsPage.css";

// const PLACEHOLDER_IMG = "https://placehold.co/900x540?text=Church+Event";
// const INITIAL_LIMIT = 3;
// const VIEW_ALL_LIMIT = 100;

// function stripHtml(html) {
//   if (!html) return "";
//   return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
// }

// function buildPreview(item) {
//   const text = stripHtml(item.summary || item.body_html || "");
//   if (!text) return "";
//   return text.length > 150 ? `${text.slice(0, 150)}…` : text;
// }

// function formatDateRange(startDate, endDate) {
//   if (!startDate && !endDate) return null;

//   const fmt = (value) =>
//     new Date(value).toLocaleDateString(undefined, {
//       month: "long",
//       day: "numeric",
//       year: "numeric",
//     });

//   if (startDate && endDate && startDate !== endDate) {
//     return `${fmt(startDate)} – ${fmt(endDate)}`;
//   }

//   return fmt(startDate || endDate);
// }

// function getCategoryBadge(category) {
//   if (category === "kids") return "Kids Program";
//   if (category === "trip") return "Trip / Outing";
//   if (category === "news") return "Announcement";
//   return "Event";
// }

// function getViewAllLabel(category) {
//   if (category === "kids") return "View all kids programs";
//   if (category === "trip") return "View all trips & outings";
//   if (category === "news") return "View all announcements";
//   return "View all";
// }

// function canRegister(item, category) {
//   return (
//     (category === "kids" || category === "trip") &&
//     Number(item.registration_enabled || 0) === 1 &&
//     Number(item.price_per_person || 0) > 0
//   );
// }

// function EventCard({ item, category, onClick, onRegister }) {
//   const flyerUrl = item.flyer_url || PLACEHOLDER_IMG;
//   const dateRange = formatDateRange(item.start_date, item.end_date);
//   const preview = buildPreview(item);

//   return (
//     <article className="cat-event-card">
//       <div
//         className="cat-event-card--clickable"
//         onClick={() => onClick(item.id)}
//         role="button"
//         tabIndex={0}
//         onKeyDown={(e) => {
//           if (e.key === "Enter" || e.key === " ") {
//             e.preventDefault();
//             onClick(item.id);
//           }
//         }}
//       >
//         <div className="cat-event-media">
//           <img
//             src={flyerUrl}
//             alt={item.title}
//             className="cat-event-img"
//             loading="lazy"
//             onError={(e) => {
//               e.currentTarget.src = PLACEHOLDER_IMG;
//             }}
//           />
//         </div>

//         <div className="cat-event-body">
//           <div className="cat-category-mini-badge">
//             {getCategoryBadge(category)}
//           </div>

//           <h2>{item.title}</h2>

//           {item.subtitle ? (
//             <div className="cat-event-subtitle">{item.subtitle}</div>
//           ) : null}

//           {dateRange ? (
//             <div className="cat-event-date">
//               📅 {dateRange}
//               {item.time_text ? <span> · ⏰ {item.time_text}</span> : null}
//             </div>
//           ) : item.time_text ? (
//             <div className="cat-event-date">⏰ {item.time_text}</div>
//           ) : null}

//           {item.location ? (
//             <div className="cat-event-location">📍 {item.location}</div>
//           ) : null}

//           {item.audience ? (
//             <div className="cat-event-audience">👥 {item.audience}</div>
//           ) : null}

//           {preview ? (
//             <p className="cat-event-summary">{preview}</p>
//           ) : null}
//         </div>
//       </div>

//       <div className="cat-event-actions-row">
//         <button
//           type="button"
//           className="cat-action-btn"
//           onClick={() => onClick(item.id)}
//         >
//           View Details
//         </button>

//         {canRegister(item, category) ? (
//           <button
//             type="button"
//             className="cat-action-btn cat-action-btn-primary"
//             onClick={() => onRegister(item)}
//           >
//             Register &amp; Pay · ${Number(item.price_per_person || 0).toFixed(2)}
//           </button>
//         ) : null}
//       </div>
//     </article>
//   );
// }

// export default function CategoryEventsPage({
//   category,
//   eyebrow,
//   title,
//   description,
//   emptyText,
// }) {
//   const navigate = useNavigate();

//   const [items, setItems] = useState([]);
//   const [selectedProgram, setSelectedProgram] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [err, setErr] = useState("");
//   const [showAll, setShowAll] = useState(false);

//   const requestLimit = showAll ? VIEW_ALL_LIMIT : INITIAL_LIMIT;

//   useEffect(() => {
//     async function load() {
//       setLoading(true);
//       setErr("");

//       try {
//         const { data } = await api.get("/news-events", {
//           params: {
//             category,
//             published: "1",
//             page: 1,
//             limit: requestLimit,
//           },
//         });

//         setItems(Array.isArray(data?.items) ? data.items : []);
//       } catch (error) {
//         console.error(error);
//         setErr("Could not load events. Please try again later.");
//       } finally {
//         setLoading(false);
//       }
//     }

//     load();
//   }, [category, requestLimit]);

//   const showToggle = useMemo(() => {
//     if (showAll) return true;
//     return items.length >= INITIAL_LIMIT;
//   }, [items.length, showAll]);

//   return (
//     <div className="cat-page-wrap">
//       <div className="cat-page-header">
//         <div>
//           <div className="cat-eyebrow">{eyebrow}</div>
//           <h1>{title}</h1>
//           <p>{description}</p>
//         </div>

//         <div className="cat-header-actions">
//           <button
//             type="button"
//             className="cat-back-btn"
//             onClick={() => navigate("/", { state: { scrollTo: "news-events" } })}
//           >
//             ← Back to News &amp; Events
//           </button>
//         </div>
//       </div>

//       {err ? <div className="cat-error">{err}</div> : null}
//       {loading ? <div className="cat-loading">Loading events…</div> : null}

//       {!loading ? (
//         <div className="section">
//           {items.length ? (
//             <>
//               <div className="cat-events-list cat-events-list--three-up">
//                 {items.map((item) => (
//                   <EventCard
//                     key={item.id}
//                     item={item}
//                     category={category}
//                     onRegister={setSelectedProgram}
//                     onClick={(eventId) =>
//                       navigate(`/news-events/${eventId}`, {
//                         state: { from: `/news-events/${category}` },
//                       })
//                     }
//                   />
//                 ))}
//               </div>

//               {showToggle ? (
//                 <div className="cat-list-actions">
//                   <button
//                     type="button"
//                     className="cat-action-btn cat-action-btn-secondary"
//                     onClick={() => setShowAll((prev) => !prev)}
//                   >
//                     {showAll ? "Show fewer" : getViewAllLabel(category)}
//                   </button>
//                 </div>
//               ) : null}
//             </>
//           ) : (
//             !err && <div className="cat-empty">{emptyText}</div>
//           )}
//         </div>
//       ) : null}

//       <ProgramRegistrationModal
//         open={!!selectedProgram}
//         onClose={() => setSelectedProgram(null)}
//         program={selectedProgram}
//       />
//     </div>
//   );
// }


// frontend/src/pages/news-events/CategoryEventsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../components/api";
import "../../styles/eventsNewsPage.css";

const PLACEHOLDER_IMG = "https://placehold.co/900x540?text=Church+Event";
const INITIAL_LIMIT = 3;
const VIEW_ALL_LIMIT = 100;

function stripHtml(html) {
  if (!html) return "";
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function buildPreview(item) {
  const text = stripHtml(item.summary || item.body_html || "");
  if (!text) return "";
  return text.length > 150 ? `${text.slice(0, 150)}…` : text;
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return null;

  const fmt = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (startDate && endDate && startDate !== endDate) {
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  }

  return fmt(startDate || endDate);
}

function priceOf(item) {
  return Number(item?.price_per_person || item?.price || item?.amount || 0);
}

function canRegister(item, category, enableRegister) {
  return (
    enableRegister &&
    ["kids", "trip"].includes(String(category || "").toLowerCase()) &&
    Number(item.registration_enabled || 0) === 1 &&
    priceOf(item) > 0
  );
}

function EventCard({ item, category, enableRegister, onViewDetails, onRegister }) {
  const flyerUrl = item.flyer_url || item.image_url || PLACEHOLDER_IMG;
  const dateRange = formatDateRange(item.start_date, item.end_date);
  const preview = buildPreview(item);
  const price = priceOf(item);
  const registerable = canRegister(item, category, enableRegister);

  return (
    <article className="cat-event-card">
      <button
        type="button"
        className="cat-event-media"
        onClick={() => onViewDetails(item)}
        aria-label={`View details for ${item.title}`}
      >
        <img
          src={flyerUrl}
          alt={item.title || "Event"}
          className="cat-event-img"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER_IMG;
          }}
        />
      </button>

      <div className="cat-event-body">
        <div className="cat-event-meta-row">
          <span className="cat-event-pill">
            {category === "kids" ? "Kids Program" : "Trip"}
          </span>
          {registerable ? (
            <span className="cat-event-price">${price.toFixed(2)} / person</span>
          ) : null}
        </div>

        <h2>{item.title}</h2>

        {dateRange ? (
          <div className="cat-event-date">
            📅 {dateRange}
            {item.time_text ? <span> · ⏰ {item.time_text}</span> : null}
          </div>
        ) : null}

        {item.location ? (
          <div className="cat-event-location">📍 {item.location}</div>
        ) : null}

        {preview ? <p>{preview}</p> : null}
      </div>

      <div className="cat-event-actions-row">
        <button
          type="button"
          className="cat-action-btn"
          onClick={() => onViewDetails(item)}
        >
          View Details
        </button>

        {registerable ? (
          <button
            type="button"
            className="cat-action-btn cat-action-btn-primary"
            onClick={() => onRegister(item)}
          >
            Register & Pay
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function CategoryEventsPage({
  category,
  eyebrow,
  title,
  description,
  emptyText,
  enableRegister = false,
}) {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(false);

  const requestLimit = showAll ? VIEW_ALL_LIMIT : INITIAL_LIMIT;

  const detailBasePath = useMemo(() => {
    return category === "kids" ? "/news-events/kids" : "/news-events/trip";
  }, [category]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const { data } = await api.get("/news-events", {
          params: {
            category,
            published: "1",
            page: 1,
            limit: requestLimit,
          },
        });

        const rows = data?.items || data?.rows || [];
        if (mounted) setItems(Array.isArray(rows) ? rows : []);
      } catch (error) {
        console.error("Load category events error:", error);
        if (mounted) setErr("Could not load programs. Please try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [category, requestLimit]);

  function openDetails(item) {
    navigate(`/news-events/${item.id}`, {
      state: {
        event: item,
        from: detailBasePath,
      },
    });
  }

  function openRegister(item) {
    navigate(`/news-events/${item.id}`, {
      state: {
        event: item,
        from: detailBasePath,
        autoOpenRegister: true,
      },
    });
  }

  return (
    <div className="cat-page-wrap">
      <div className="cat-page-header">
        <div>
          {eyebrow ? <div className="cat-eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>

      {err ? <div className="cat-error">{err}</div> : null}
      {loading ? <div className="cat-loading">Loading...</div> : null}

      {!loading && items.length === 0 ? (
        <div className="cat-empty">{emptyText || "No items available."}</div>
      ) : null}

      <div className="cat-events-list">
        {items.map((item) => (
          <EventCard
            key={item.id}
            item={item}
            category={category}
            enableRegister={enableRegister}
            onViewDetails={openDetails}
            onRegister={openRegister}
          />
        ))}
      </div>

      {items.length >= INITIAL_LIMIT ? (
        <button
          type="button"
          className="cat-view-all-btn"
          onClick={() => setShowAll((x) => !x)}
        >
          {showAll ? "Show less" : `View all ${title?.toLowerCase() || ""}`}
        </button>
      ) : null}
    </div>
  );
}