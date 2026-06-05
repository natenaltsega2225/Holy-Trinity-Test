

// // frontend/src/pages/EventDetailPage.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import { useLocation, useNavigate, useParams } from "react-router-dom";
// import api from "../components/api";
// import ProgramRegistrationModal from "./ProgramRegistrationModal";
// import "../styles/eventsNewsPage.css";

// const PLACEHOLDER_IMG = "https://placehold.co/1200x700?text=Church+Event";

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

// function stripHtml(html) {
//   if (!html) return "";
//   return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
// }

// function getBackPath(category, fallbackState) {
//   if (fallbackState?.from) return fallbackState.from;
//   if (category === "kids") return "/news-events/kids";
//   if (category === "trip") return "/news-events/trip";
//   if (category === "news") return "/news-events/news";
//   if (category === "holiday") return "/news-events/holiday";
//   return "/";
// }

// function getBackLabel(category) {
//   if (category === "kids") return "Back to Kids Programs";
//   if (category === "trip") return "Back to Trips & Outings";
//   if (category === "news") return "Back to Announcements";
//   if (category === "holiday") return "Back to Calendar";
//   return "Back";
// }

// function getCategoryLabel(category) {
//   if (category === "kids") return "Kids School Program";
//   if (category === "trip") return "Trip / Outing";
//   if (category === "news") return "Church Announcement";
//   if (category === "holiday") return "Holiday / Calendar";
//   return "News & Events";
// }

// function canRegister(item) {
//   return (
//     (item?.category === "kids" || item?.category === "trip") &&
//     Number(item?.registration_enabled || 0) === 1 &&
//     Number(item?.price_per_person || 0) > 0
//   );
// }

// export default function EventDetailPage() {
//   const { id } = useParams();
//   const navigate = useNavigate();
//   const location = useLocation();

//   const [item, setItem] = useState(null);
//   const [selectedProgram, setSelectedProgram] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [err, setErr] = useState("");

//   useEffect(() => {
//     async function load() {
//       setLoading(true);
//       setErr("");

//       try {
//         const { data } = await api.get(`/news-events/${id}`, {
//           params: { published: "1" },
//         });

//         setItem(data?.item || null);
//       } catch (error) {
//         console.error(error);
//         setErr("Could not load event details. Please try again later.");
//       } finally {
//         setLoading(false);
//       }
//     }

//     if (id) load();
//   }, [id]);

//   const flyerUrl = useMemo(() => item?.flyer_url || PLACEHOLDER_IMG, [item]);

//   const dateRange = useMemo(
//     () => (item ? formatDateRange(item.start_date, item.end_date) : null),
//     [item]
//   );

//   const backPath = useMemo(
//     () => getBackPath(item?.category, location.state),
//     [item, location.state]
//   );

//   const backLabel = useMemo(() => getBackLabel(item?.category), [item]);

//   return (
//     <div className="cat-page-wrap">
//       <div className="cat-page-header">
//         <div>
//           <div className="cat-eyebrow">News &amp; Events</div>
//           <h1>Event Details</h1>
//           <p>Read the full announcement, calendar activity, program, or trip details.</p>
//         </div>

//         <button
//           type="button"
//           className="cat-back-btn"
//           onClick={() => navigate(backPath)}
//         >
//           ← {backLabel}
//         </button>
//       </div>

//       {loading ? <div className="cat-loading">Loading event details…</div> : null}
//       {err ? <div className="cat-error">{err}</div> : null}

//       {!loading && !err && item ? (
//         <section className="event-detail-page">
//           <div className="event-detail-card">
//             <div className="event-detail-image-wrap desktop-only">
//               <img
//                 src={flyerUrl}
//                 alt={item.title}
//                 className="event-detail-image"
//                 onError={(e) => {
//                   e.currentTarget.src = PLACEHOLDER_IMG;
//                 }}
//               />
//             </div>

//             <div className="event-detail-copy">
//               <div className="event-detail-category-badge">
//                 {getCategoryLabel(item.category)}
//               </div>

//               <h2 className="event-detail-title">{item.title}</h2>

//               {item.subtitle ? (
//                 <div className="event-detail-subtitle">{item.subtitle}</div>
//               ) : null}

//               {dateRange || item.time_text || item.location || item.audience ? (
//                 <div className="event-detail-meta">
//                   {dateRange ? (
//                     <div className="event-detail-meta-item">📅 {dateRange}</div>
//                   ) : null}

//                   {item.time_text ? (
//                     <div className="event-detail-meta-item">⏰ {item.time_text}</div>
//                   ) : null}

//                   {item.location ? (
//                     <div className="event-detail-meta-item">📍 {item.location}</div>
//                   ) : null}

//                   {item.audience ? (
//                     <div className="event-detail-meta-item">👥 {item.audience}</div>
//                   ) : null}
//                 </div>
//               ) : null}

//               {canRegister(item) ? (
//                 <div className="event-register-box">
//                   <div>
//                     <strong>Registration is open</strong>
//                     <p>
//                       Members and non-members are welcome. Price per participant:{" "}
//                       <strong>
//                         ${Number(item.price_per_person || 0).toFixed(2)}
//                       </strong>
//                     </p>

//                     {item.capacity ? <p>Capacity: {item.capacity} participants</p> : null}

//                     {item.registration_notes ? (
//                       <p>{item.registration_notes}</p>
//                     ) : null}
//                   </div>

//                   <button
//                     type="button"
//                     className="cat-action-btn cat-action-btn-primary"
//                     onClick={() => setSelectedProgram(item)}
//                   >
//                     Register &amp; Pay
//                   </button>
//                 </div>
//               ) : null}

//               <div className="event-detail-image-wrap mobile-only">
//                 <img
//                   src={flyerUrl}
//                   alt={item.title}
//                   className="event-detail-image"
//                   onError={(e) => {
//                     e.currentTarget.src = PLACEHOLDER_IMG;
//                   }}
//                 />
//               </div>

//               {item.body_html ? (
//                 <div
//                   className="event-detail-content"
//                   dangerouslySetInnerHTML={{ __html: item.body_html }}
//                 />
//               ) : item.summary ? (
//                 <div className="event-detail-content">
//                   <p>{stripHtml(item.summary)}</p>
//                 </div>
//               ) : (
//                 <div className="event-detail-content">
//                   <p>No additional details available.</p>
//                 </div>
//               )}
//             </div>
//           </div>
//         </section>
//       ) : null}

//       {!loading && !err && !item ? (
//         <div className="cat-empty">Event not found.</div>
//       ) : null}

//       <ProgramRegistrationModal
//         open={!!selectedProgram}
//         onClose={() => setSelectedProgram(null)}
//         program={selectedProgram}
//       />
//     </div>
//   );
// }

// // // frontend/src/pages/EventDetailPage.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import { useLocation, useNavigate, useParams } from "react-router-dom";
// import api from "../components/api";
// import ProgramRegistrationModal from "./ProgramRegistrationModal";
// import "../styles/eventsNewsPage.css";

// const PLACEHOLDER_IMG = "https://placehold.co/1200x700?text=Church+Event";

// function formatDateRange(startDate, endDate) {
//   if (!startDate && !endDate) return null;

//   const fmt = (value) =>
//     new Date(value).toLocaleDateString(undefined, {
//       month: "long",
//       day: "numeric",
//       year: "numeric",
//     });

//   if (startDate && endDate && startDate !== endDate) return `${fmt(startDate)} – ${fmt(endDate)}`;
//   return fmt(startDate || endDate);
// }

// function stripHtml(html) {
//   if (!html) return "";
//   return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
// }

// function getBackPath(category, fallbackState) {
//   if (fallbackState?.from) return fallbackState.from;
//   if (category === "kids") return "/news-events/kids";
//   if (category === "trip") return "/news-events/trip";
//   if (category === "news") return "/news-events/news";
//   if (category === "holiday") return "/news-events/holiday";
//   return "/";
// }

// function getBackLabel(category) {
//   if (category === "kids") return "Back to Kids Programs";
//   if (category === "trip") return "Back to Trips & Outings";
//   if (category === "news") return "Back to Announcements";
//   if (category === "holiday") return "Back to Calendar";
//   return "Back";
// }

// function getCategoryLabel(category) {
//   if (category === "kids") return "Kids School Program";
//   if (category === "trip") return "Trip / Outing";
//   if (category === "news") return "Church Announcement";
//   if (category === "holiday") return "Holiday / Calendar";
//   return "News & Events";
// }

// function isProgram(item) {
//   return item?.category === "kids" || item?.category === "trip";
// }

// function canRegister(item) {
//   return (
//     isProgram(item) &&
//     Number(item?.registration_enabled || 0) === 1 &&
//     Number(item?.price_per_person || 0) > 0
//   );
// }

// export default function EventDetailPage() {
//   const { id } = useParams();
//   const navigate = useNavigate();
//   const location = useLocation();

//   const [item, setItem] = useState(null);
//   const [selectedProgram, setSelectedProgram] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [err, setErr] = useState("");

//   useEffect(() => {
//     async function load() {
//       setLoading(true);
//       setErr("");

//       try {
//         const { data } = await api.get(`/news-events/${id}`, {
//           params: { published: "1" },
//         });

//         setItem(data?.item || null);
//       } catch (error) {
//         console.error(error);
//         setErr("Could not load event details. Please try again later.");
//       } finally {
//         setLoading(false);
//       }
//     }
// const eventData = data?.item || null;
// setItem(eventData);

// // ✅ AUTO OPEN REGISTER
// if (location.state?.autoOpenRegister && eventData) {
//   setSelectedProgram(eventData);
// }
//     if (id) load();
//   }, [id]);

//   const flyerUrl = useMemo(() => item?.flyer_url || PLACEHOLDER_IMG, [item]);
//   const dateRange = useMemo(() => (item ? formatDateRange(item.start_date, item.end_date) : null), [item]);
//   const backPath = useMemo(() => getBackPath(item?.category, location.state), [item, location.state]);
//   const backLabel = useMemo(() => getBackLabel(item?.category), [item]);

//   return (
//     <div className="cat-page-wrap">
//       <div className="cat-page-header">
//         <div>
//           <div className="cat-eyebrow">News &amp; Events</div>
//           <h1>Event Details</h1>
//           <p>Read the full announcement, calendar activity, program, or trip details.</p>
//         </div>

//         <button type="button" className="cat-back-btn" onClick={() => navigate(backPath)}>
//           ← {backLabel}
//         </button>
//       </div>

//       {loading ? <div className="cat-loading">Loading event details…</div> : null}
//       {err ? <div className="cat-error">{err}</div> : null}

//       {!loading && !err && item ? (
//         <section className="event-detail-page">
//           <div className="event-detail-card">
//             <div className="event-detail-image-wrap desktop-only">
//               <img
//                 src={flyerUrl}
//                 alt={item.title}
//                 className="event-detail-image"
//                 onError={(e) => {
//                   e.currentTarget.src = PLACEHOLDER_IMG;
//                 }}
//               />
//             </div>

//             <div className="event-detail-copy">
//               <div className="event-detail-category-badge">{getCategoryLabel(item.category)}</div>

//               <h2 className="event-detail-title">{item.title}</h2>

//               {item.subtitle ? <div className="event-detail-subtitle">{item.subtitle}</div> : null}

//               {dateRange || item.time_text || item.location || item.audience ? (
//                 <div className="event-detail-meta">
//                   {dateRange ? <div className="event-detail-meta-item">📅 {dateRange}</div> : null}
//                   {item.time_text ? <div className="event-detail-meta-item">⏰ {item.time_text}</div> : null}
//                   {item.location ? <div className="event-detail-meta-item">📍 {item.location}</div> : null}
//                   {item.audience ? <div className="event-detail-meta-item">👥 {item.audience}</div> : null}
//                 </div>
//               ) : null}

//               {isProgram(item) ? (
//                 <div className="event-register-box">
//                   <div>
//                     <strong>{canRegister(item) ? "Registration is open" : "Registration information"}</strong>

//                     <p>
//                       Members and non-members are welcome. Price per participant:{" "}
//                       <strong>${Number(item.price_per_person || 0).toFixed(2)}</strong>
//                     </p>

//                     {item.capacity ? <p>Capacity: {item.capacity} participants</p> : null}

//                     {Number(item.registration_enabled || 0) !== 1 ? (
//                       <p>Registration is not open yet.</p>
//                     ) : null}

//                     {Number(item.registration_enabled || 0) === 1 &&
//                     Number(item.price_per_person || 0) <= 0 ? (
//                       <p>Registration price is not configured yet.</p>
//                     ) : null}

//                     {item.registration_notes ? <p>{item.registration_notes}</p> : null}
//                   </div>

//                   {canRegister(item) ? (
//                     <button
//                       type="button"
//                       className="cat-action-btn cat-action-btn-primary"
//                       onClick={() => setSelectedProgram(item)}
//                     >
//                       Register &amp; Pay
//                     </button>
//                   ) : null}
//                 </div>
//               ) : null}

//               <div className="event-detail-image-wrap mobile-only">
//                 <img
//                   src={flyerUrl}
//                   alt={item.title}
//                   className="event-detail-image"
//                   onError={(e) => {
//                     e.currentTarget.src = PLACEHOLDER_IMG;
//                   }}
//                 />
//               </div>

//               {item.body_html ? (
//                 <div className="event-detail-content" dangerouslySetInnerHTML={{ __html: item.body_html }} />
//               ) : item.summary ? (
//                 <div className="event-detail-content">
//                   <p>{stripHtml(item.summary)}</p>
//                 </div>
//               ) : (
//                 <div className="event-detail-content">
//                   <p>No additional details available.</p>
//                 </div>
//               )}
//             </div>
//           </div>
//         </section>
//       ) : null}

//       {!loading && !err && !item ? <div className="cat-empty">Event not found.</div> : null}

//       <ProgramRegistrationModal
//         open={!!selectedProgram}
//         onClose={() => setSelectedProgram(null)}
//         program={selectedProgram}
//       />
//     </div>
//   );
// }



// frontend/src/pages/EventDetailPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../components/api";
import ProgramRegistrationModal from "./ProgramRegistrationModal";
import "../styles/eventsNewsPage.css";

const PLACEHOLDER_IMG = "https://placehold.co/1200x720?text=Church+Event";

function stripHtml(html) {
  if (!html) return "";
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return "--";

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

function isProgram(item) {
  const category = String(item?.category || "").toLowerCase();
  return ["kids", "trip"].includes(category);
}

function canRegister(item) {
  return (
    isProgram(item) &&
    Number(item?.registration_enabled || 0) === 1 &&
    priceOf(item) > 0
  );
}

export default function EventDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [item, setItem] = useState(location.state?.event || null);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [loading, setLoading] = useState(!location.state?.event);
  const [err, setErr] = useState("");

  const flyerUrl = item?.flyer_url || item?.image_url || PLACEHOLDER_IMG;
  const preview = useMemo(
    () => stripHtml(item?.summary || item?.body_html || ""),
    [item]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setErr("");

        const { data } = await api.get(`/news-events/${id}`);
        const eventData = data?.item || data?.row || data;

        if (!mounted) return;

        setItem(eventData || null);

        if (location.state?.autoOpenRegister && canRegister(eventData)) {
          setSelectedProgram(eventData);
        }
      } catch (error) {
        console.error("Load event detail error:", error);
        if (mounted) setErr("Could not load this event.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [id, location.state?.autoOpenRegister]);

  if (loading) {
    return (
      <div className="cat-page-wrap">
        <div className="cat-loading">Loading event details...</div>
      </div>
    );
  }

  if (err || !item) {
    return (
      <div className="cat-page-wrap">
        <div className="cat-error">{err || "Event not found."}</div>
        <button type="button" className="cat-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="cat-page-wrap">
      <div className="event-detail-shell">
        <button
          type="button"
          className="cat-back-btn"
          onClick={() => navigate(location.state?.from || -1)}
        >
          ← Back
        </button>

        <article className="event-detail-card">
          <div className="event-detail-media">
            <img
              src={flyerUrl}
              alt={item.title || "Event"}
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER_IMG;
              }}
            />
          </div>

          <div className="event-detail-content">
            <div className="cat-eyebrow">
              {item.category === "kids"
                ? "Kids Program"
                : item.category === "trip"
                ? "Trip / Outing"
                : "Church Event"}
            </div>

            <h1>{item.title}</h1>

            <div className="event-detail-meta-grid">
              <div>
                <span>Date</span>
                <strong>{formatDateRange(item.start_date, item.end_date)}</strong>
              </div>

              <div>
                <span>Time</span>
                <strong>{item.time_text || "--"}</strong>
              </div>

              <div>
                <span>Location</span>
                <strong>{item.location || "--"}</strong>
              </div>

              {isProgram(item) ? (
                <div>
                  <span>Price</span>
                  <strong>${priceOf(item).toFixed(2)} / person</strong>
                </div>
              ) : null}
            </div>

            {preview ? <p className="event-detail-summary">{preview}</p> : null}

            {item.body_html ? (
              <div
                className="event-detail-body"
                dangerouslySetInnerHTML={{ __html: item.body_html }}
              />
            ) : null}

            {canRegister(item) ? (
              <div className="event-detail-actions">
                <button
                  type="button"
                  className="cat-action-btn cat-action-btn-primary"
                  onClick={() => setSelectedProgram(item)}
                >
                  Register & Pay
                </button>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <ProgramRegistrationModal
        open={!!selectedProgram}
        program={selectedProgram}
        onClose={() => setSelectedProgram(null)}
      />
    </div>
  );
}