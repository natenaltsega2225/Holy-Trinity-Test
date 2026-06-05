
// // src/components/AdminDashboard/pages/NewsEventsAdmin.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import api from "../../api";
// import "../../../styles/newsEventsAdmin.css";
// import "../../../styles/auth.css";

// const CATEGORY_OPTIONS = [
//   { value: "holiday", label: "Holiday Activities" },
//   { value: "trip", label: "Trips & Outings" },
//   { value: "kids", label: "Kids Programs" },
//   { value: "news", label: "Church Announcements" },
// ];

// const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

// const TABS = [
//   { key: "events", label: "Add New Event" },
//   { key: "posted", label: "Posted Events" },
//   { key: "registrations", label: "Registrations" },
// ];

// const INITIAL_FORM = {
//   id: null,
//   category: "news",
//   title: "",
//   subtitle: "",
//   summary: "",
//   body_html: "",
//   start_date: "",
//   end_date: "",
//   start_time: "",
//   end_time: "",
//   location: "",
//   audience: "",
//   flyer_url: "",
//   holiday_color: "#4A75E6",
//   is_published: 1,

//   registration_enabled: 0,
//   price_per_person: "",
//   capacity: "",
//   registration_notes: "",
// };

// function stripHtml(html) {
//   if (!html) return "";
//   return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
// }

// function fmtDateRange(row) {
//   if (row.start_date || row.end_date) {
//     return `${row.start_date || "—"} → ${row.end_date || "—"}`;
//   }
//   return "—";
// }

// function statCount(rows, category) {
//   return rows.filter((r) => r.category === category).length;
// }

// function money(value) {
//   return `$${Number(value || 0).toLocaleString(undefined, {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;
// }

// function parseTimeText(timeText) {
//   const raw = String(timeText || "").trim();
//   if (!raw) return { start_time: "", end_time: "" };

//   const normalized = raw.replace(/\s+to\s+/i, " - ");
//   const parts = normalized.split(" - ").map((x) => x.trim());

//   if (parts.length >= 2) {
//     return {
//       start_time: parts[0],
//       end_time: parts[1],
//     };
//   }

//   return {
//     start_time: raw,
//     end_time: "",
//   };
// }

// function buildTimeText(startTime, endTime) {
//   const start = String(startTime || "").trim();
//   const end = String(endTime || "").trim();

//   if (start && end) return `${start} - ${end}`;
//   if (start) return start;
//   if (end) return end;
//   return "";
// }

// function parseParticipants(value) {
//   if (!value) return [];
//   if (Array.isArray(value)) return value;

//   try {
//     const parsed = JSON.parse(value);
//     return Array.isArray(parsed) ? parsed : [];
//   } catch {
//     return [];
//   }
// }

// function RowActionsMenu({ onEdit, onDelete, onViewImage, hasImage }) {
//   const [open, setOpen] = useState(false);

//   useEffect(() => {
//     function handleDocClick() {
//       setOpen(false);
//     }

//     if (open) {
//       document.addEventListener("click", handleDocClick);
//     }

//     return () => {
//       document.removeEventListener("click", handleDocClick);
//     };
//   }, [open]);

//   return (
//     <div className="nea-action-menu" onClick={(e) => e.stopPropagation()}>
//       <button
//         type="button"
//         className="nea-kebab-btn"
//         aria-label="Open actions"
//         onClick={() => setOpen((prev) => !prev)}
//       >
//         <span />
//         <span />
//         <span />
//       </button>

//       {open ? (
//         <div className="nea-kebab-menu">
//           {hasImage ? (
//             <button
//               type="button"
//               className="nea-kebab-item"
//               onClick={() => {
//                 setOpen(false);
//                 onViewImage();
//               }}
//             >
//               View Image
//             </button>
//           ) : null}

//           <button
//             type="button"
//             className="nea-kebab-item"
//             onClick={() => {
//               setOpen(false);
//               onEdit();
//             }}
//           >
//             Edit
//           </button>

//           <button
//             type="button"
//             className="nea-kebab-item danger"
//             onClick={() => {
//               setOpen(false);
//               onDelete();
//             }}
//           >
//             Delete
//           </button>
//         </div>
//       ) : null}
//     </div>
//   );
// }

// function CapacityBar({ used = 0, capacity = 0 }) {
//   const cap = Number(capacity || 0);
//   const count = Number(used || 0);
//   const percent = cap > 0 ? Math.min(100, Math.round((count / cap) * 100)) : 0;

//   return (
//     <div className="nea-capacity-cell">
//       <div className="nea-capacity-track">
//         <div className="nea-capacity-fill" style={{ width: `${percent}%` }} />
//       </div>
//       <span>
//         {cap > 0 ? `${count}/${cap} (${percent}%)` : `${count} registered`}
//       </span>
//     </div>
//   );
// }

// export default function NewsEventsAdmin() {
//   const [activeTab, setActiveTab] = useState("events");

//   const [rows, setRows] = useState([]);
//   const [registrations, setRegistrations] = useState([]);

//   const [search, setSearch] = useState("");
//   const [categoryFilter, setCategoryFilter] = useState("all");
//   const [publishedFilter, setPublishedFilter] = useState("all");
//   const [registrationCategoryFilter, setRegistrationCategoryFilter] =
//     useState("all");
//   const [registrationStatusFilter, setRegistrationStatusFilter] =
//     useState("all");

//   const [loading, setLoading] = useState(false);
//   const [registrationsLoading, setRegistrationsLoading] = useState(false);

//   const [page, setPage] = useState(1);
//   const [pageSize, setPageSize] = useState(10);

//   const [showModal, setShowModal] = useState(false);
//   const [form, setForm] = useState(INITIAL_FORM);
//   const [err, setErr] = useState("");

//   const [imageFile, setImageFile] = useState(null);
//   const [imagePreview, setImagePreview] = useState("");
//   const [removeExistingFlyer, setRemoveExistingFlyer] = useState(false);

//   async function load() {
//     setLoading(true);
//     try {
//       const params = {
//         page: 1,
//         limit: 100,
//       };

//       if (categoryFilter !== "all") params.category = categoryFilter;
//       if (publishedFilter === "published") params.published = "1";
//       if (search.trim()) params.search = search.trim();

//       const { data } = await api.get("/news-events/admin/list", { params });
//       setRows(Array.isArray(data?.items) ? data.items : []);
//       setPage(1);
//     } catch (e) {
//       console.error(e);
//       setRows([]);
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function loadRegistrations() {
//     setRegistrationsLoading(true);

//     try {
//       const params = {};
//       if (registrationCategoryFilter !== "all") {
//         params.category = registrationCategoryFilter;
//       }
//       if (registrationStatusFilter !== "all") {
//         params.status = registrationStatusFilter;
//       }
//       if (search.trim()) {
//         params.search = search.trim();
//       }

//       const { data } = await api.get("/program-registrations/admin", {
//         params,
//       });

//       setRegistrations(Array.isArray(data?.rows) ? data.rows : []);
//     } catch (error) {
//       console.error(error);
//       setRegistrations([]);
//     } finally {
//       setRegistrationsLoading(false);
//     }
//   }

//   useEffect(() => {
//     load();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [categoryFilter, publishedFilter]);

//   useEffect(() => {
//     if (activeTab === "registrations") {
//       loadRegistrations();
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [activeTab, registrationCategoryFilter, registrationStatusFilter]);

//   function setField(key, value) {
//     setForm((prev) => ({ ...prev, [key]: value }));
//   }

//   function resetModal() {
//     if (imagePreview && imagePreview.startsWith("blob:")) {
//       URL.revokeObjectURL(imagePreview);
//     }

//     setForm(INITIAL_FORM);
//     setImageFile(null);
//     setImagePreview("");
//     setRemoveExistingFlyer(false);
//     setErr("");
//     setShowModal(false);
//   }

//   function openCreate(category = "news") {
//     setForm({
//       ...INITIAL_FORM,
//       category,
//       registration_enabled: category === "kids" || category === "trip" ? 1 : 0,
//     });

//     setImageFile(null);
//     setImagePreview("");
//     setRemoveExistingFlyer(false);
//     setErr("");
//     setShowModal(true);
//   }

//   function openEdit(row) {
//     const parsed = parseTimeText(row.time_text);

//     setForm({
//       id: row.id,
//       category: row.category || "news",
//       title: row.title || "",
//       subtitle: row.subtitle || "",
//       summary: row.summary || "",
//       body_html: row.body_html || "",
//       start_date: row.start_date || "",
//       end_date: row.end_date || "",
//       start_time: parsed.start_time,
//       end_time: parsed.end_time,
//       location: row.location || "",
//       audience: row.audience || "",
//       flyer_url: row.flyer_url || "",
//       holiday_color: row.holiday_color || "#4A75E6",
//       is_published: Number(row.is_published) ? 1 : 0,

//       registration_enabled: Number(row.registration_enabled || 0),
//       price_per_person: row.price_per_person || "",
//       capacity: row.capacity || "",
//       registration_notes: row.registration_notes || "",
//     });

//     setImageFile(null);
//     setImagePreview(row.flyer_url || "");
//     setRemoveExistingFlyer(false);
//     setErr("");
//     setShowModal(true);
//   }

//   function handleImageChange(e) {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
//       setErr("Only jpg, jpeg, png, and webp image files are allowed.");
//       return;
//     }

//     if (imagePreview && imagePreview.startsWith("blob:")) {
//       URL.revokeObjectURL(imagePreview);
//     }

//     setErr("");
//     setImageFile(file);
//     setRemoveExistingFlyer(false);

//     const preview = URL.createObjectURL(file);
//     setImagePreview(preview);
//   }

//   function clearImage() {
//     if (imagePreview && imagePreview.startsWith("blob:")) {
//       URL.revokeObjectURL(imagePreview);
//     }

//     setImageFile(null);
//     setImagePreview("");
//     setRemoveExistingFlyer(true);
//     setField("flyer_url", "");
//   }

// function validateAdminEventForm(form) {
//   const isProgram = form.category === "kids" || form.category === "trip";

//   if (!String(form.title || "").trim()) return "Title is required.";

//   if (isProgram) {
//     if (!form.start_date) return "Start date is required.";
//     if (!String(form.location || "").trim()) return "Location is required.";

//     if (Number(form.registration_enabled || 0)) {
//       if (!form.price_per_person || Number(form.price_per_person) <= 0) {
//         return "Price must be greater than 0.";
//       }
//     }
//   }

//   return "";
// }


//   async function handleSave(e) {
//     e.preventDefault();
//     setErr("");
// const validationError = validateAdminEventForm(form);
// if (validationError) {
//   setErr(validationError);
//   return;
// }
//     try {
//       const formData = new FormData();

//       formData.append("category", form.category);
//       formData.append("title", form.title);
//       formData.append("subtitle", form.subtitle || "");
//       formData.append("summary", form.summary || "");
//       formData.append("body_html", form.body_html || "");
//       formData.append("start_date", form.start_date || "");
//       formData.append("end_date", form.end_date || "");
//       formData.append("time_text", buildTimeText(form.start_time, form.end_time));
//       formData.append("location", form.location || "");
//       formData.append("audience", form.audience || "");
//       formData.append("is_published", String(form.is_published ? 1 : 0));

//       if (form.category === "holiday") {
//         formData.append("holiday_color", form.holiday_color || "#4A75E6");
//       } else {
//         formData.append("holiday_color", "");
//       }

//       if (form.category === "kids" || form.category === "trip") {
//         formData.append(
//           "registration_enabled",
//           String(form.registration_enabled ? 1 : 0)
//         );
//         formData.append("price_per_person", form.price_per_person || "0");
//         formData.append("capacity", form.capacity || "");
//         formData.append("registration_notes", form.registration_notes || "");
//       } else {
//         formData.append("registration_enabled", "0");
//         formData.append("price_per_person", "0");
//         formData.append("capacity", "");
//         formData.append("registration_notes", "");
//       }

//       if (form.flyer_url && !imageFile) {
//         formData.append("flyer_url", form.flyer_url);
//       }

//       if (imageFile) {
//         formData.append("flyer_image", imageFile);
//       }

//       if (removeExistingFlyer) {
//         formData.append("remove_flyer", "1");
//       }

//       const config = {
//         headers: {
//           "Content-Type": "multipart/form-data",
//         },
//       };

//       if (form.id) {
//         await api.put(`/news-events/admin/${form.id}`, formData, config);
//       } else {
//         await api.post("/news-events/admin", formData, config);
//       }

//       resetModal();
//       load();
//     } catch (e2) {
//       console.error(e2);
//       setErr(e2?.response?.data?.error || "Save failed");
//     }
//   }

//   async function handleDelete(id) {
//     const ok = window.confirm("Are you sure you want to delete this item?");
//     if (!ok) return;

//     try {
//       await api.delete(`/news-events/admin/${id}`);
//       load();
//     } catch (e) {
//       console.error(e);
//       alert(e?.response?.data?.error || "Delete failed");
//     }
//   }

//   function exportRegistrationsCSV() {
//     const headers = [
//       "Program",
//       "Category",
//       "Registrant",
//       "Email",
//       "Phone",
//       "Participants",
//       "Participant Names",
//       "Total Amount",
//       "Status",
//       "Payment Number",
//       "Receipt Number",
//       "Created At",
//     ];

//     const lines = registrations.map((row) => {
//       const participants = parseParticipants(row.participants_json);
//       const participantNames = participants
//         .map((p) => `${p.name || ""}${p.age ? ` (${p.age})` : ""}`)
//         .join(" | ");

//       return [
//         row.program_title || "",
//         row.category || "",
//         row.full_name || "",
//         row.email || "",
//         row.phone || "",
//         row.quantity || "",
//         participantNames,
//         row.total_amount || "",
//         row.status || "",
//         row.payment_number || "",
//         row.receipt_number || "",
//         row.created_at || "",
//       ];
//     });

//     const csv = [headers, ...lines]
//       .map((line) =>
//         line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
//       )
//       .join("\n");

//     const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
//     const url = URL.createObjectURL(blob);

//     const a = document.createElement("a");
//     a.href = url;
//     a.download = "program-registrations.csv";
//     a.click();

//     URL.revokeObjectURL(url);
//   }

//   const visibleRows = useMemo(() => {
//     let next = [...rows];

//     if (activeTab === "posted") {
//       next = next.filter((r) => Number(r.is_published));
//     }

//     if (search.trim()) {
//       const q = search.trim().toLowerCase();
//       next = next.filter((r) =>
//         [r.title, r.subtitle, r.summary, r.location, r.audience]
//           .filter(Boolean)
//           .some((v) => String(v).toLowerCase().includes(q))
//       );
//     }

//     if (publishedFilter === "draft") {
//       next = next.filter((r) => !Number(r.is_published));
//     } else if (publishedFilter === "published") {
//       next = next.filter((r) => Number(r.is_published));
//     }

//     return next;
//   }, [rows, search, publishedFilter, activeTab]);

//   const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));

//   const pagedRows = useMemo(() => {
//     const start = (page - 1) * pageSize;
//     return visibleRows.slice(start, start + pageSize);
//   }, [visibleRows, page, pageSize]);

//   useEffect(() => {
//     if (page > totalPages) setPage(1);
//   }, [page, totalPages]);

//   const registrationSummary = useMemo(() => {
//     const revenue = registrations.reduce(
//       (sum, row) => sum + Number(row.total_amount || 0),
//       0
//     );
//     const participants = registrations.reduce(
//       (sum, row) => sum + Number(row.quantity || 0),
//       0
//     );
//     const paid = registrations.filter((row) => row.status === "paid").length;

//     return {
//       total: registrations.length,
//       paid,
//       participants,
//       revenue,
//     };
//   }, [registrations]);

//   return (
//     <>
//       <div className="nea-page">
//         <section className="nea-hero">
//           <div>
//             <p className="nea-eyebrow">Administration</p>
//             <h2>News &amp; Events Manager</h2>
//             <p>
//               Manage church calendar, announcements, kids school programs, trips,
//               registration payments, capacity, and participant records.
//             </p>
//           </div>

//           <div className="nea-hero-actions">
//             <button
//               type="button"
//               className="nea-primary-btn"
//               onClick={() => openCreate("news")}
//             >
//               + Add Announcement
//             </button>

//             <button
//               type="button"
//               className="nea-primary-btn"
//               onClick={() => openCreate("holiday")}
//             >
//               + Add Calendar
//             </button>

//             <button
//               type="button"
//               className="nea-primary-btn"
//               onClick={() => openCreate("kids")}
//             >
//               + Add Kids Program
//             </button>

//             <button
//               type="button"
//               className="nea-primary-btn"
//               onClick={() => openCreate("trip")}
//             >
//               + Add Trip
//             </button>
//           </div>
//         </section>

//         <section className="nea-tabs">
//           {TABS.map((tab) => (
//             <button
//               key={tab.key}
//               type="button"
//               className={activeTab === tab.key ? "active" : ""}
//               onClick={() => setActiveTab(tab.key)}
//             >
//               {tab.label}
//             </button>
//           ))}
//         </section>

//         {activeTab !== "registrations" ? (
//           <>
//             <section className="nea-stats-grid">
//               <article className="nea-stat-card">
//                 <span>Total</span>
//                 <strong>{rows.length}</strong>
//               </article>
//               <article className="nea-stat-card">
//                 <span>Church Holidays</span>
//                 <strong>{statCount(rows, "holiday")}</strong>
//               </article>
//               <article className="nea-stat-card">
//                 <span>Trips</span>
//                 <strong>{statCount(rows, "trip")}</strong>
//               </article>
//               <article className="nea-stat-card">
//                 <span>Kids</span>
//                 <strong>{statCount(rows, "kids")}</strong>
//               </article>
//             </section>

//             <section className="nea-toolbar-card">
//               <form
//                 className="nea-toolbar"
//                 onSubmit={(e) => {
//                   e.preventDefault();
//                   setPage(1);
//                   load();
//                 }}
//               >
//                 <input
//                   className="nea-input"
//                   type="text"
//                   placeholder="Search title, summary, details, location..."
//                   value={search}
//                   onChange={(e) => setSearch(e.target.value)}
//                 />
// <input
//   type="number"
//   min="0.01"
//   step="0.01"
//   required={Boolean(form.registration_enabled)}
//   value={form.price_per_person}
//   onChange={(e) => setField("price_per_person", e.target.value)}
//   placeholder="Example: 25.00"
// />
//                 <select
//                   className="nea-select"
//                   value={categoryFilter}
//                   onChange={(e) => setCategoryFilter(e.target.value)}
//                 >
//                   <option value="all">All Categories</option>
//                   {CATEGORY_OPTIONS.map((item) => (
//                     <option key={item.value} value={item.value}>
//                       {item.label}
//                     </option>
//                   ))}
//                 </select>

//                 <select
//                   className="nea-select"
//                   value={publishedFilter}
//                   onChange={(e) => setPublishedFilter(e.target.value)}
//                 >
//                   <option value="all">All Status</option>
//                   <option value="published">Published Only</option>
//                   <option value="draft">Draft Only</option>
//                 </select>

//                 <button type="submit" className="nea-primary-btn">
//                   Search
//                 </button>
//               </form>
//             </section>

//             <section className="nea-table-card">
//               <div className="nea-table-topbar">
//                 <div className="nea-page-size">
//                   <label htmlFor="rowsPerPage">Rows per page</label>
//                   <select
//                     id="rowsPerPage"
//                     value={pageSize}
//                     onChange={(e) => setPageSize(Number(e.target.value))}
//                   >
//                     {PAGE_SIZE_OPTIONS.map((n) => (
//                       <option key={n} value={n}>
//                         {n}
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//               </div>

//               <div className="nea-table-wrap desktop-table">
//                 <table className="nea-table">
//                   <thead>
//                     <tr>
//                       <th>Category</th>
//                       <th>Name</th>
//                       <th>Dates</th>
//                       <th>Location</th>
//                       <th>Price</th>
//                       <th>Capacity</th>
//                       <th>Image</th>
//                       <th>Status</th>
//                       <th>Summary</th>
//                       <th>Actions</th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     {loading ? (
//                       <tr>
//                         <td colSpan={10} className="nea-empty-cell">
//                           Loading…
//                         </td>
//                       </tr>
//                     ) : null}

//                     {!loading &&
//                       pagedRows.map((r) => (
//                         <tr key={r.id}>
//                           <td>
//                             {CATEGORY_OPTIONS.find((x) => x.value === r.category)
//                               ?.label || r.category}
//                           </td>
//                           <td className="nea-title-cell">
//                             <strong>{r.title}</strong>
//                             {(r.category === "kids" || r.category === "trip") &&
//                             Number(r.registration_enabled || 0) ? (
//                               <div className="nea-muted">Registration enabled</div>
//                             ) : null}
//                           </td>
//                           <td>{fmtDateRange(r)}</td>
//                           <td>{r.location || "—"}</td>
//                           <td>
//                             {r.category === "kids" || r.category === "trip"
//                               ? money(r.price_per_person)
//                               : "—"}
//                           </td>
//                           <td>
//                             {r.category === "kids" || r.category === "trip"
//                               ? r.capacity || "Unlimited"
//                               : "—"}
//                           </td>
//                           <td>
//                             <div className="nea-media-actions">
//                               {r.flyer_url ? (
//                                 <button
//                                   type="button"
//                                   className="nea-mini-btn"
//                                   onClick={() =>
//                                     window.open(r.flyer_url, "_blank", "noopener")
//                                   }
//                                 >
//                                   Image
//                                 </button>
//                               ) : (
//                                 <span>—</span>
//                               )}
//                             </div>
//                           </td>
//                           <td>
//                             {r.is_published ? (
//                               <span className="nea-pill nea-pill-published">
//                                 Published
//                               </span>
//                             ) : (
//                               <span className="nea-pill nea-pill-draft">Draft</span>
//                             )}
//                           </td>
//                           <td>{stripHtml(r.summary || "").slice(0, 60) || "—"}</td>
//                           <td className="nea-actions-cell">
//                             <RowActionsMenu
//                               hasImage={!!r.flyer_url}
//                               onViewImage={() =>
//                                 window.open(r.flyer_url, "_blank", "noopener")
//                               }
//                               onEdit={() => openEdit(r)}
//                               onDelete={() => handleDelete(r.id)}
//                             />
//                           </td>
//                         </tr>
//                       ))}

//                     {!loading && !pagedRows.length ? (
//                       <tr>
//                         <td colSpan={10} className="nea-empty-cell">
//                           No items found.
//                         </td>
//                       </tr>
//                     ) : null}
//                   </tbody>
//                 </table>
//               </div>

//               <div className="nea-pagination">
//                 <button
//                   type="button"
//                   className="nea-pagination-btn"
//                   onClick={() => setPage((p) => Math.max(1, p - 1))}
//                   disabled={page <= 1}
//                 >
//                   ← Previous
//                 </button>

//                 <div className="nea-pagination-status">
//                   Page {page} of {totalPages}
//                 </div>

//                 <button
//                   type="button"
//                   className="nea-pagination-btn"
//                   onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
//                   disabled={page >= totalPages}
//                 >
//                   Next →
//                 </button>
//               </div>
//             </section>
//           </>
//         ) : (
//           <>
//             <section className="nea-stats-grid">
//               <article className="nea-stat-card">
//                 <span>Registrations</span>
//                 <strong>{registrationSummary.total}</strong>
//               </article>
//               <article className="nea-stat-card">
//                 <span>Paid</span>
//                 <strong>{registrationSummary.paid}</strong>
//               </article>
//               <article className="nea-stat-card">
//                 <span>Participants</span>
//                 <strong>{registrationSummary.participants}</strong>
//               </article>
//               <article className="nea-stat-card">
//                 <span>Revenue</span>
//                 <strong>{money(registrationSummary.revenue)}</strong>
//               </article>
//             </section>

//             <section className="nea-toolbar-card">
//               <form
//                 className="nea-toolbar"
//                 onSubmit={(e) => {
//                   e.preventDefault();
//                   loadRegistrations();
//                 }}
//               >
//                 <input
//                   className="nea-input"
//                   type="text"
//                   placeholder="Search registrant, email, phone, or program..."
//                   value={search}
//                   onChange={(e) => setSearch(e.target.value)}
//                 />

//                 <select
//                   className="nea-select"
//                   value={registrationCategoryFilter}
//                   onChange={(e) => setRegistrationCategoryFilter(e.target.value)}
//                 >
//                   <option value="all">All Programs</option>
//                   <option value="kids">Kids School</option>
//                   <option value="trip">Trips</option>
//                 </select>

//                 <select
//                   className="nea-select"
//                   value={registrationStatusFilter}
//                   onChange={(e) => setRegistrationStatusFilter(e.target.value)}
//                 >
//                   <option value="all">All Status</option>
//                   <option value="pending">Pending</option>
//                   <option value="paid">Paid</option>
//                   <option value="failed">Failed</option>
//                   <option value="cancelled">Cancelled</option>
//                 </select>

//                 <button type="submit" className="nea-primary-btn">
//                   Search
//                 </button>

//                 <button
//                   type="button"
//                   className="nea-primary-btn"
//                   onClick={exportRegistrationsCSV}
//                   disabled={!registrations.length}
//                 >
//                   Export CSV
//                 </button>
//               </form>
//             </section>

//             <section className="nea-table-card">
//               <div className="nea-table-wrap desktop-table">
//                 <table className="nea-table">
//                   <thead>
//                     <tr>
//                       <th>Program</th>
//                       <th>Registrant</th>
//                       <th>Participants</th>
//                       <th>Revenue</th>
//                       <th>Capacity</th>
//                       <th>Status</th>
//                       <th>Payment</th>
//                       <th>Receipt</th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     {registrationsLoading ? (
//                       <tr>
//                         <td colSpan={8} className="nea-empty-cell">
//                           Loading registrations…
//                         </td>
//                       </tr>
//                     ) : null}

//                     {!registrationsLoading &&
//                       registrations.map((r) => {
//                         const participants = parseParticipants(r.participants_json);

//                         return (
//                           <tr key={r.id}>
//                             <td>
//                               <strong>{r.program_title || "—"}</strong>
//                               <div className="nea-muted">
//                                 {r.category === "kids" ? "Kids School" : "Trip"}
//                               </div>
//                             </td>
//                             <td>
//                               <strong>{r.full_name}</strong>
//                               <div>{r.email}</div>
//                               <div className="nea-muted">{r.phone || "—"}</div>
//                             </td>
//                             <td>
//                               <strong>{r.quantity}</strong>
//                               <div className="nea-muted">
//                                 {participants.length
//                                   ? participants
//                                       .map((p) =>
//                                         `${p.name || ""}${
//                                           p.age ? ` (${p.age})` : ""
//                                         }`
//                                       )
//                                       .join(", ")
//                                   : "—"}
//                               </div>
//                             </td>
//                             <td>
//                               <strong>{money(r.total_amount)}</strong>
//                               <div className="nea-muted">
//                                 {money(r.price_per_person)} / person
//                               </div>
//                             </td>
//                             <td>
//                               <CapacityBar
//                                 used={r.total_paid_participants || r.quantity}
//                                 capacity={r.capacity}
//                               />
//                             </td>
//                             <td>
//                               <span
//                                 className={
//                                   r.status === "paid"
//                                     ? "nea-pill nea-pill-published"
//                                     : "nea-pill nea-pill-draft"
//                                 }
//                               >
//                                 {r.status || "pending"}
//                               </span>
//                             </td>
//                             <td>{r.payment_number || "—"}</td>
//                             <td>{r.receipt_number || "—"}</td>
//                           </tr>
//                         );
//                       })}

//                     {!registrationsLoading && !registrations.length ? (
//                       <tr>
//                         <td colSpan={8} className="nea-empty-cell">
//                           No registrations found.
//                         </td>
//                       </tr>
//                     ) : null}
//                   </tbody>
//                 </table>
//               </div>
//             </section>
//           </>
//         )}
//       </div>

//       {showModal ? (
//         <div className="nea-modal-overlay" onClick={resetModal}>
//           <div
//             className="nea-modal nea-modal-wide"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="nea-modal-head">
//               <h2>{form.id ? "Edit News / Event" : "Add News / Event"}</h2>
//               <button type="button" className="nea-close-btn" onClick={resetModal}>
//                 ×
//               </button>
//             </div>

//             <div className="nea-modal-body">
//               {err ? <div className="auth-banner">{err}</div> : null}

//               <form className="nea-form-screen" onSubmit={handleSave}>
//                 <div className="nea-image-upload-wrap">
//                   <label className="nea-circle-upload">
//                     <input
//                       type="file"
//                       accept="image/png,image/jpeg,image/jpg,image/webp"
//                       onChange={handleImageChange}
//                       hidden
//                     />
//                     {imagePreview ? (
//                       <img
//                         src={imagePreview}
//                         alt="Preview"
//                         className="nea-circle-preview"
//                       />
//                     ) : (
//                       <span>
//                         Click here
//                         <br />
//                         to add image
//                       </span>
//                     )}
//                   </label>

//                   {imagePreview ? (
//                     <button
//                       type="button"
//                       className="nea-remove-image-btn"
//                       onClick={clearImage}
//                     >
//                       Remove image
//                     </button>
//                   ) : null}
//                 </div>

//                 <div className="nea-form-grid">
//                   <div className="nea-field">
//                     <label>Category</label>
//                     <select
//                       value={form.category}
//                       onChange={(e) => setField("category", e.target.value)}
//                     >
//                       {CATEGORY_OPTIONS.map((item) => (
//                         <option key={item.value} value={item.value}>
//                           {item.label}
//                         </option>
//                       ))}
//                     </select>
//                   </div>

//                   <div className="nea-field">
//                     <label>Title</label>
//                     <input
//                       value={form.title}
//                       onChange={(e) => setField("title", e.target.value)}
//                       placeholder="Enter title"
//                       required
//                     />
//                   </div>

//                   <div className="nea-field">
//                     <label>Subtitle</label>
//                     <input
//                       value={form.subtitle}
//                       onChange={(e) => setField("subtitle", e.target.value)}
//                       placeholder="Optional subtitle"
//                     />
//                   </div>

//                   <div className="nea-field">
//                     <label>Start Date</label>
//                     <input
//                       type="date"
//                       value={form.start_date || ""}
//                       onChange={(e) => setField("start_date", e.target.value)}
//                     />
//                   </div>

//                   <div className="nea-field">
//                     <label>End Date</label>
//                     <input
//                       type="date"
//                       value={form.end_date || ""}
//                       onChange={(e) => setField("end_date", e.target.value)}
//                     />
//                   </div>

//                   <div className="nea-field">
//                     <label>Start Time</label>
//                     <input
//                       type="time"
//                       value={form.start_time || ""}
//                       onChange={(e) => setField("start_time", e.target.value)}
//                     />
//                   </div>

//                   <div className="nea-field">
//                     <label>End Time</label>
//                     <input
//                       type="time"
//                       value={form.end_time || ""}
//                       onChange={(e) => setField("end_time", e.target.value)}
//                     />
//                   </div>

//                   <div className="nea-field nea-form-col-full">
//                     <label>Location</label>
//                     <input
//                       value={form.location}
//                       onChange={(e) => setField("location", e.target.value)}
//                       placeholder="Required for kids school and trip programs"
//                     />
//                   </div>

//                   <div className="nea-field nea-form-col-full">
//                     <label>Audience</label>
//                     <input
//                       value={form.audience}
//                       onChange={(e) => setField("audience", e.target.value)}
//                       placeholder="Optional audience"
//                     />
//                   </div>

//                   <div className="nea-field nea-form-col-full">
//                     <label>Image URL fallback</label>
//                     <input
//                       value={form.flyer_url}
//                       onChange={(e) => {
//                         setField("flyer_url", e.target.value);
//                         if (!imageFile && !removeExistingFlyer) {
//                           setImagePreview(e.target.value);
//                         }
//                       }}
//                       placeholder="Optional image URL if you are not uploading a file"
//                     />
//                   </div>

//                   {form.category === "holiday" ? (
//                     <div className="nea-field">
//                       <label>Holiday Color</label>
//                       <input
//                         type="color"
//                         value={form.holiday_color || "#4A75E6"}
//                         onChange={(e) =>
//                           setField("holiday_color", e.target.value)
//                         }
//                         className="nea-color-input"
//                       />
//                     </div>
//                   ) : null}

//                   {form.category === "kids" || form.category === "trip" ? (
//                     <>
//                       <div className="nea-field">
//                         <label>Price Per Person</label>
                        
//                         <input
//                           type="number"
//                           min="0"
//                           step="0.01"
//                           value={form.price_per_person}
//                           onChange={(e) =>
//                             setField("price_per_person", e.target.value)
//                           }
//                           placeholder="0.00"
//                         />
//                       </div>

//                       <div className="nea-field">
//                         <label>Capacity</label>
//                         <input
//                           type="number"
//                           min="1"
//                           value={form.capacity}
//                           onChange={(e) => setField("capacity", e.target.value)}
//                           placeholder="Optional capacity"
//                         />
//                       </div>

//                       <div className="nea-field nea-form-col-full">
//                         <label>
//                           <input
//                             type="checkbox"
//                             checked={Boolean(form.registration_enabled)}
//                             onChange={(e) =>
//                               setField(
//                                 "registration_enabled",
//                                 e.target.checked ? 1 : 0
//                               )
//                             }
//                             style={{ width: "16px", marginRight: "8px" }}
//                           />
//                           Enable public registration and payment
//                         </label>
//                       </div>

//                       <div className="nea-field nea-form-col-full">
//                         <label>Registration Notes</label>
//                         <textarea
//                           className="rte-textarea"
//                           value={form.registration_notes}
//                           onChange={(e) =>
//                             setField("registration_notes", e.target.value)
//                           }
//                           placeholder="Optional instructions for parents or participants"
//                         />
//                       </div>
//                     </>
//                   ) : null}

//                   <div className="nea-field nea-form-col-full">
//                     <label>Summary</label>
//                     <input
//                       value={form.summary}
//                       onChange={(e) => setField("summary", e.target.value)}
//                       placeholder="Short summary"
//                     />
//                   </div>

//                   <div className="nea-field nea-form-col-full">
//                     <label>Description</label>
//                     <textarea
//                       className="rte-textarea"
//                       value={form.body_html}
//                       onChange={(e) => setField("body_html", e.target.value)}
//                       placeholder="Enter detailed description"
//                     />
//                   </div>

//                   <div className="nea-field nea-form-col-full">
//                     <label>
//                       <input
//                         type="checkbox"
//                         checked={Boolean(form.is_published)}
//                         onChange={(e) =>
//                           setField("is_published", e.target.checked ? 1 : 0)
//                         }
//                         style={{ width: "16px", marginRight: "8px" }}
//                       />
//                       Publish now
//                     </label>
//                   </div>
//                 </div>

//                 <div className="nea-modal-actions nea-modal-actions-left">
//                   <button type="submit" className="nea-add-btn">
//                     {form.id ? "Update Event" : "Add Event"}
//                   </button>
//                 </div>
//               </form>
//             </div>
//           </div>
//         </div>
//       ) : null}
//     </>
//   );
// }


// src/components/AdminDashboard/pages/NewsEventsAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "../../../styles/newsEventsAdmin.css";
import "../../../styles/auth.css";

const CATEGORY_OPTIONS = [
  { value: "holiday", label: "Holiday Activities" },
  { value: "trip", label: "Trips & Outings" },
  { value: "kids", label: "Kids Programs" },
  { value: "news", label: "Church Announcements" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

const TABS = [
  { key: "events", label: "Add New Event" },
  { key: "posted", label: "Posted Events" },
  { key: "registrations", label: "Registrations" },
];

const INITIAL_FORM = {
  id: null,
  category: "news",
  title: "",
  subtitle: "",
  summary: "",
  body_html: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  location: "",
  audience: "",
  flyer_url: "",
  holiday_color: "#4A75E6",
  is_published: 1,

  registration_enabled: 0,
  price_per_person: "",
  capacity: "",
  registration_notes: "",
};

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function fmtDateRange(row) {
  if (row.start_date || row.end_date) {
    return `${row.start_date || "—"} → ${row.end_date || "—"}`;
  }
  return "—";
}

function statCount(rows, category) {
  return rows.filter((r) => r.category === category).length;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseTimeText(timeText) {
  const raw = String(timeText || "").trim();
  if (!raw) return { start_time: "", end_time: "" };

  const normalized = raw.replace(/\s+to\s+/i, " - ");
  const parts = normalized.split(" - ").map((x) => x.trim());

  if (parts.length >= 2) {
    return {
      start_time: parts[0],
      end_time: parts[1],
    };
  }

  return {
    start_time: raw,
    end_time: "",
  };
}

function buildTimeText(startTime, endTime) {
  const start = String(startTime || "").trim();
  const end = String(endTime || "").trim();

  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return end;
  return "";
}

function parseParticipants(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function RowActionsMenu({
  onEdit,
  onDelete,
  onViewImage,
  onViewApplicants,
  hasImage,
  canViewApplicants,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleDocClick() {
      setOpen(false);
    }

    if (open) document.addEventListener("click", handleDocClick);

    return () => {
      document.removeEventListener("click", handleDocClick);
    };
  }, [open]);

  return (
    <div className="nea-action-menu" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="nea-kebab-btn"
        aria-label="Open actions"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span />
        <span />
        <span />
      </button>

      {open ? (
        <div className="nea-kebab-menu">
          {canViewApplicants ? (
            <button
              type="button"
              className="nea-kebab-item"
              onClick={() => {
                setOpen(false);
                onViewApplicants();
              }}
            >
              View Applicants
            </button>
          ) : null}

          {hasImage ? (
            <button
              type="button"
              className="nea-kebab-item"
              onClick={() => {
                setOpen(false);
                onViewImage();
              }}
            >
              View Image
            </button>
          ) : null}

          <button
            type="button"
            className="nea-kebab-item"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </button>

          <button
            type="button"
            className="nea-kebab-item danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CapacityBar({ used = 0, capacity = 0 }) {
  const cap = Number(capacity || 0);
  const count = Number(used || 0);
  const percent = cap > 0 ? Math.min(100, Math.round((count / cap) * 100)) : 0;

  return (
    <div className="nea-capacity-cell">
      <div className="nea-capacity-track">
        <div className="nea-capacity-fill" style={{ width: `${percent}%` }} />
      </div>
      <span>
        {cap > 0 ? `${count}/${cap} (${percent}%)` : `${count} registered`}
      </span>
    </div>
  );
}

export default function NewsEventsAdmin() {
  const [activeTab, setActiveTab] = useState("events");

  const [rows, setRows] = useState([]);
  const [registrations, setRegistrations] = useState([]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [publishedFilter, setPublishedFilter] = useState("all");
  const [registrationCategoryFilter, setRegistrationCategoryFilter] = useState("all");
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [err, setErr] = useState("");

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeExistingFlyer, setRemoveExistingFlyer] = useState(false);

  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [eventParticipants, setEventParticipants] = useState([]);
  const [participantsTitle, setParticipantsTitle] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = { page: 1, limit: 100 };

      if (categoryFilter !== "all") params.category = categoryFilter;
      if (publishedFilter === "published") params.published = "1";
      if (search.trim()) params.search = search.trim();

      const { data } = await api.get("/news-events/admin/list", { params });
      setRows(Array.isArray(data?.items) ? data.items : Array.isArray(data?.rows) ? data.rows : []);
      setPage(1);
    } catch (e) {
      console.error(e);
      setRows([]);
      alert(e?.response?.data?.details || e?.response?.data?.error || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRegistrations(extraParams = {}) {
    setRegistrationsLoading(true);

    try {
      const params = { ...extraParams };

      if (!params.event_id && registrationCategoryFilter !== "all") {
        params.category = registrationCategoryFilter;
      }

      if (registrationStatusFilter !== "all") {
        params.status = registrationStatusFilter;
      }

      if (search.trim()) params.search = search.trim();

      const { data } = await api.get("/program-registrations/admin", { params });
      const nextRows = Array.isArray(data?.rows) ? data.rows : [];

      if (params.event_id) {
        setEventParticipants(nextRows);
      } else {
        setRegistrations(nextRows);
      }
    } catch (error) {
      console.error(error);
      if (extraParams.event_id) {
        setEventParticipants([]);
      } else {
        setRegistrations([]);
      }
      alert(error?.response?.data?.error || "Failed to load registrations.");
    } finally {
      setRegistrationsLoading(false);
    }
  }

  async function openApplicants(row) {
    setParticipantsTitle(row.title || "Applicants");
    setEventParticipants([]);
    setShowParticipantsModal(true);
    await loadRegistrations({ event_id: row.id });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, publishedFilter]);

  useEffect(() => {
    if (activeTab === "registrations") {
      loadRegistrations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, registrationCategoryFilter, registrationStatusFilter]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetModal() {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setForm(INITIAL_FORM);
    setImageFile(null);
    setImagePreview("");
    setRemoveExistingFlyer(false);
    setErr("");
    setShowModal(false);
  }

  function openCreate(category = "news") {
    setForm({
      ...INITIAL_FORM,
      category,
      registration_enabled: category === "kids" || category === "trip" ? 1 : 0,
    });

    setImageFile(null);
    setImagePreview("");
    setRemoveExistingFlyer(false);
    setErr("");
    setShowModal(true);
  }

  function openEdit(row) {
    const parsed = parseTimeText(row.time_text);

    setForm({
      id: row.id,
      category: row.category || "news",
      title: row.title || "",
      subtitle: row.subtitle || "",
      summary: row.summary || "",
      body_html: row.body_html || "",
      start_date: row.start_date || "",
      end_date: row.end_date || "",
      start_time: parsed.start_time,
      end_time: parsed.end_time,
      location: row.location || "",
      audience: row.audience || "",
      flyer_url: row.flyer_url || "",
      holiday_color: row.holiday_color || "#4A75E6",
      is_published: Number(row.is_published) ? 1 : 0,

      registration_enabled: Number(row.registration_enabled || 0),
      price_per_person: row.price_per_person || "",
      capacity: row.capacity || "",
      registration_notes: row.registration_notes || "",
    });

    setImageFile(null);
    setImagePreview(row.flyer_url || "");
    setRemoveExistingFlyer(false);
    setErr("");
    setShowModal(true);
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErr("Only jpg, jpeg, png, and webp image files are allowed.");
      return;
    }

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setErr("");
    setImageFile(file);
    setRemoveExistingFlyer(false);

    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
  }

  function clearImage() {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);
    setImagePreview("");
    setRemoveExistingFlyer(true);
    setField("flyer_url", "");
  }

  function validateAdminEventForm(nextForm) {
    const isProgram = nextForm.category === "kids" || nextForm.category === "trip";

    if (!String(nextForm.title || "").trim()) return "Title is required.";

    if (isProgram) {
      if (!nextForm.start_date) return "Start date is required.";
      if (!String(nextForm.location || "").trim()) return "Location is required.";

      if (Number(nextForm.registration_enabled || 0)) {
        if (!nextForm.price_per_person || Number(nextForm.price_per_person) <= 0) {
          return "Price must be greater than 0.";
        }
      }
    }

    return "";
  }

  async function handleSave(e) {
    e.preventDefault();
    setErr("");

    const validationError = validateAdminEventForm(form);
    if (validationError) {
      setErr(validationError);
      return;
    }

    try {
      const formData = new FormData();
      const isProgram = form.category === "kids" || form.category === "trip";

      formData.append("category", form.category);
      formData.append("title", form.title);
      formData.append("subtitle", form.subtitle || "");
      formData.append("summary", form.summary || "");
      formData.append("body_html", form.body_html || "");
      formData.append("start_date", form.start_date || "");
      formData.append("end_date", form.end_date || "");
      formData.append("time_text", buildTimeText(form.start_time, form.end_time));
      formData.append("location", form.location || "");
      formData.append("audience", form.audience || "");
      formData.append("is_published", String(form.is_published ? 1 : 0));

      if (form.category === "holiday") {
        formData.append("holiday_color", form.holiday_color || "#4A75E6");
      } else {
        formData.append("holiday_color", "");
      }

      if (isProgram) {
        formData.append("registration_enabled", String(form.registration_enabled ? 1 : 0));
        formData.append("price_per_person", String(Number(form.price_per_person || 0)));
        formData.append("capacity", form.capacity || "");
        formData.append("registration_notes", form.registration_notes || "");
      } else {
        formData.append("registration_enabled", "0");
        formData.append("price_per_person", "0");
        formData.append("capacity", "");
        formData.append("registration_notes", "");
      }

      if (form.flyer_url && !imageFile) {
        formData.append("flyer_url", form.flyer_url);
      }

      if (imageFile) {
        formData.append("flyer_image", imageFile);
      }

      if (removeExistingFlyer) {
        formData.append("remove_flyer", "1");
      }

      const config = {
        headers: { "Content-Type": "multipart/form-data" },
      };

      if (form.id) {
        await api.put(`/news-events/admin/${form.id}`, formData, config);
      } else {
        await api.post("/news-events/admin", formData, config);
      }

      resetModal();
      load();
    } catch (e2) {
      console.error(e2);
      setErr(e2?.response?.data?.details || e2?.response?.data?.error || "Save failed");
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm("Are you sure you want to delete this item?");
    if (!ok) return;

    try {
      await api.delete(`/news-events/admin/${id}`);
      load();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || "Delete failed");
    }
  }

  function exportRegistrationsCSV() {
    const headers = [
      "Program",
      "Category",
      "Registrant",
      "Email",
      "Phone",
      "Participants",
      "Participant Names",
      "Total Amount",
      "Status",
      "Payment Number",
      "Receipt Number",
      "Created At",
    ];

    const lines = registrations.map((row) => {
      const participants = parseParticipants(row.participants_json);
      const participantNames = participants
        .map((p) => `${p.name || ""}${p.age ? ` (${p.age})` : ""}`)
        .join(" | ");

      return [
        row.program_title || "",
        row.category || "",
        row.full_name || "",
        row.email || "",
        row.phone || "",
        row.quantity || "",
        participantNames,
        row.total_amount || "",
        row.status || "",
        row.payment_number || "",
        row.receipt_number || "",
        row.created_at || "",
      ];
    });

    const csv = [headers, ...lines]
      .map((line) =>
        line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "program-registrations.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  const visibleRows = useMemo(() => {
    let next = [...rows];

    if (activeTab === "posted") {
      next = next.filter((r) => Number(r.is_published));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      next = next.filter((r) =>
        [r.title, r.subtitle, r.summary, r.location, r.audience]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    if (publishedFilter === "draft") {
      next = next.filter((r) => !Number(r.is_published));
    } else if (publishedFilter === "published") {
      next = next.filter((r) => Number(r.is_published));
    }

    return next;
  }, [rows, search, publishedFilter, activeTab]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [visibleRows, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const registrationSummary = useMemo(() => {
    const revenue = registrations.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const participants = registrations.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const paid = registrations.filter((row) => row.status === "paid").length;

    return {
      total: registrations.length,
      paid,
      participants,
      revenue,
    };
  }, [registrations]);

  function renderRegistrationsTable(sourceRows, loadingMessage = "Loading registrations…") {
    return (
      <div className="nea-table-wrap desktop-table">
        <table className="nea-table">
          <thead>
            <tr>
              <th>Program</th>
              <th>Registrant</th>
              <th>Participants</th>
              <th>Revenue</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Receipt</th>
            </tr>
          </thead>

          <tbody>
            {registrationsLoading ? (
              <tr>
                <td colSpan={8} className="nea-empty-cell">
                  {loadingMessage}
                </td>
              </tr>
            ) : null}

            {!registrationsLoading &&
              sourceRows.map((r) => {
                const participants = parseParticipants(r.participants_json);

                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.program_title || "—"}</strong>
                      <div className="nea-muted">
                        {r.category === "kids" ? "Kids School" : "Trip"}
                      </div>
                    </td>
                    <td>
                      <strong>{r.full_name}</strong>
                      <div>{r.email}</div>
                      <div className="nea-muted">{r.phone || "—"}</div>
                    </td>
                    <td>
                      <strong>{r.quantity}</strong>
                      <div className="nea-muted">
                        {participants.length
                          ? participants
                              .map((p) => `${p.name || ""}${p.age ? ` (${p.age})` : ""}`)
                              .join(", ")
                          : "—"}
                      </div>
                    </td>
                    <td>
                      <strong>{money(r.total_amount)}</strong>
                      <div className="nea-muted">{money(r.price_per_person)} / person</div>
                    </td>
                    <td>
                      <CapacityBar
                        used={r.total_paid_participants || r.quantity}
                        capacity={r.capacity}
                      />
                    </td>
                    <td>
                      <span
                        className={
                          r.status === "paid"
                            ? "nea-pill nea-pill-published"
                            : "nea-pill nea-pill-draft"
                        }
                      >
                        {r.status || "pending"}
                      </span>
                    </td>
                    <td>{r.payment_number || "—"}</td>
                    <td>{r.receipt_number || "—"}</td>
                  </tr>
                );
              })}

            {!registrationsLoading && !sourceRows.length ? (
              <tr>
                <td colSpan={8} className="nea-empty-cell">
                  No registrations found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="nea-page">
        <section className="nea-hero">
          <div>
            <p className="nea-eyebrow">Administration</p>
            <h2>News &amp; Events Manager</h2>
            <p>
              Manage church calendar, announcements, kids school programs, trips,
              registration payments, capacity, and participant records.
            </p>
          </div>

          <div className="nea-hero-actions">
            <button type="button" className="nea-primary-btn" onClick={() => openCreate("news")}>
              + Add Announcement
            </button>

            <button type="button" className="nea-primary-btn" onClick={() => openCreate("holiday")}>
              + Add Calendar
            </button>

            <button type="button" className="nea-primary-btn" onClick={() => openCreate("kids")}>
              + Add Kids Program
            </button>

            <button type="button" className="nea-primary-btn" onClick={() => openCreate("trip")}>
              + Add Trip
            </button>
          </div>
        </section>

        <section className="nea-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "active" : ""}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </section>

        {activeTab !== "registrations" ? (
          <>
            <section className="nea-stats-grid">
              <article className="nea-stat-card">
                <span>Total</span>
                <strong>{rows.length}</strong>
              </article>
              <article className="nea-stat-card">
                <span>Church Holidays</span>
                <strong>{statCount(rows, "holiday")}</strong>
              </article>
              <article className="nea-stat-card">
                <span>Trips</span>
                <strong>{statCount(rows, "trip")}</strong>
              </article>
              <article className="nea-stat-card">
                <span>Kids</span>
                <strong>{statCount(rows, "kids")}</strong>
              </article>
            </section>

            <section className="nea-toolbar-card">
              <form
                className="nea-toolbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  load();
                }}
              >
                <input
                  className="nea-input"
                  type="text"
                  placeholder="Search title, summary, details, location..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  className="nea-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <select
                  className="nea-select"
                  value={publishedFilter}
                  onChange={(e) => setPublishedFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="published">Published Only</option>
                  <option value="draft">Draft Only</option>
                </select>

                <button type="submit" className="nea-primary-btn">
                  Search
                </button>
              </form>
            </section>

            <section className="nea-table-card">
              <div className="nea-table-topbar">
                <div className="nea-page-size">
                  <label htmlFor="rowsPerPage">Rows per page</label>
                  <select
                    id="rowsPerPage"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="nea-table-wrap desktop-table">
                <table className="nea-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Name</th>
                      <th>Dates</th>
                      <th>Location</th>
                      <th>Price</th>
                      <th>Capacity</th>
                      <th>Image</th>
                      <th>Status</th>
                      <th>Summary</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="nea-empty-cell">
                          Loading…
                        </td>
                      </tr>
                    ) : null}

                    {!loading &&
                      pagedRows.map((r) => {
                        const isProgram = r.category === "kids" || r.category === "trip";

                        return (
                          <tr key={r.id}>
                            <td>
                              {CATEGORY_OPTIONS.find((x) => x.value === r.category)?.label || r.category}
                            </td>
                            <td className="nea-title-cell">
                              <strong>{r.title}</strong>
                              {isProgram && Number(r.registration_enabled || 0) ? (
                                <div className="nea-muted">Registration enabled</div>
                              ) : null}
                            </td>
                            <td>{fmtDateRange(r)}</td>
                            <td>{r.location || "—"}</td>
                            <td>{isProgram ? money(r.price_per_person) : "—"}</td>
                            <td>{isProgram ? r.capacity || "Unlimited" : "—"}</td>
                            <td>
                              <div className="nea-media-actions">
                                {r.flyer_url ? (
                                  <button
                                    type="button"
                                    className="nea-mini-btn"
                                    onClick={() => window.open(r.flyer_url, "_blank", "noopener")}
                                  >
                                    Image
                                  </button>
                                ) : (
                                  <span>—</span>
                                )}
                              </div>
                            </td>
                            <td>
                              {r.is_published ? (
                                <span className="nea-pill nea-pill-published">Published</span>
                              ) : (
                                <span className="nea-pill nea-pill-draft">Draft</span>
                              )}
                            </td>
                            <td>{stripHtml(r.summary || "").slice(0, 60) || "—"}</td>
                            <td className="nea-actions-cell">
                              <RowActionsMenu
                                hasImage={!!r.flyer_url}
                                canViewApplicants={isProgram}
                                onViewApplicants={() => openApplicants(r)}
                                onViewImage={() => window.open(r.flyer_url, "_blank", "noopener")}
                                onEdit={() => openEdit(r)}
                                onDelete={() => handleDelete(r.id)}
                              />
                            </td>
                          </tr>
                        );
                      })}

                    {!loading && !pagedRows.length ? (
                      <tr>
                        <td colSpan={10} className="nea-empty-cell">
                          No items found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="nea-pagination">
                <button
                  type="button"
                  className="nea-pagination-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  ← Previous
                </button>

                <div className="nea-pagination-status">
                  Page {page} of {totalPages}
                </div>

                <button
                  type="button"
                  className="nea-pagination-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next →
                </button>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="nea-stats-grid">
              <article className="nea-stat-card">
                <span>Registrations</span>
                <strong>{registrationSummary.total}</strong>
              </article>
              <article className="nea-stat-card">
                <span>Paid</span>
                <strong>{registrationSummary.paid}</strong>
              </article>
              <article className="nea-stat-card">
                <span>Participants</span>
                <strong>{registrationSummary.participants}</strong>
              </article>
              <article className="nea-stat-card">
                <span>Revenue</span>
                <strong>{money(registrationSummary.revenue)}</strong>
              </article>
            </section>

            <section className="nea-toolbar-card">
              <form
                className="nea-toolbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  loadRegistrations();
                }}
              >
                <input
                  className="nea-input"
                  type="text"
                  placeholder="Search registrant, email, phone, or program..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  className="nea-select"
                  value={registrationCategoryFilter}
                  onChange={(e) => setRegistrationCategoryFilter(e.target.value)}
                >
                  <option value="all">All Programs</option>
                  <option value="kids">Kids School</option>
                  <option value="trip">Trips</option>
                </select>

                <select
                  className="nea-select"
                  value={registrationStatusFilter}
                  onChange={(e) => setRegistrationStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <button type="submit" className="nea-primary-btn">
                  Search
                </button>

                <button
                  type="button"
                  className="nea-primary-btn"
                  onClick={exportRegistrationsCSV}
                  disabled={!registrations.length}
                >
                  Export CSV
                </button>
              </form>
            </section>

            <section className="nea-table-card">
              {renderRegistrationsTable(registrations)}
            </section>
          </>
        )}
      </div>

      {showParticipantsModal ? (
        <div className="nea-modal-overlay" onClick={() => setShowParticipantsModal(false)}>
          <div className="nea-modal nea-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="nea-modal-head">
              <h2>{participantsTitle} Applicants</h2>
              <button
                type="button"
                className="nea-close-btn"
                onClick={() => setShowParticipantsModal(false)}
              >
                ×
              </button>
            </div>

            <div className="nea-modal-body">
              {renderRegistrationsTable(eventParticipants, "Loading applicants…")}
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="nea-modal-overlay" onClick={resetModal}>
          <div className="nea-modal nea-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="nea-modal-head">
              <h2>{form.id ? "Edit News / Event" : "Add News / Event"}</h2>
              <button type="button" className="nea-close-btn" onClick={resetModal}>
                ×
              </button>
            </div>

            <div className="nea-modal-body">
              {err ? <div className="auth-banner">{err}</div> : null}

              <form className="nea-form-screen" onSubmit={handleSave}>
                <div className="nea-image-upload-wrap">
                  <label className="nea-circle-upload">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleImageChange}
                      hidden
                    />
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="nea-circle-preview" />
                    ) : (
                      <span>
                        Click here
                        <br />
                        to add image
                      </span>
                    )}
                  </label>

                  {imagePreview ? (
                    <button type="button" className="nea-remove-image-btn" onClick={clearImage}>
                      Remove image
                    </button>
                  ) : null}
                </div>

                <div className="nea-form-grid">
                  <div className="nea-field">
                    <label>Category</label>
                    <select value={form.category} onChange={(e) => setField("category", e.target.value)}>
                      {CATEGORY_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="nea-field">
                    <label>Title</label>
                    <input
                      value={form.title}
                      onChange={(e) => setField("title", e.target.value)}
                      placeholder="Enter title"
                      required
                    />
                  </div>

                  <div className="nea-field">
                    <label>Subtitle</label>
                    <input
                      value={form.subtitle}
                      onChange={(e) => setField("subtitle", e.target.value)}
                      placeholder="Optional subtitle"
                    />
                  </div>

                  <div className="nea-field">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={form.start_date || ""}
                      onChange={(e) => setField("start_date", e.target.value)}
                    />
                  </div>

                  <div className="nea-field">
                    <label>End Date</label>
                    <input
                      type="date"
                      value={form.end_date || ""}
                      onChange={(e) => setField("end_date", e.target.value)}
                    />
                  </div>

                  <div className="nea-field">
                    <label>Start Time</label>
                    <input
                      type="time"
                      value={form.start_time || ""}
                      onChange={(e) => setField("start_time", e.target.value)}
                    />
                  </div>

                  <div className="nea-field">
                    <label>End Time</label>
                    <input
                      type="time"
                      value={form.end_time || ""}
                      onChange={(e) => setField("end_time", e.target.value)}
                    />
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <label>Location</label>
                    <input
                      value={form.location}
                      onChange={(e) => setField("location", e.target.value)}
                      placeholder="Required for kids school and trip programs"
                    />
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <label>Audience</label>
                    <input
                      value={form.audience}
                      onChange={(e) => setField("audience", e.target.value)}
                      placeholder="Optional audience"
                    />
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <label>Image URL fallback</label>
                    <input
                      value={form.flyer_url}
                      onChange={(e) => {
                        setField("flyer_url", e.target.value);
                        if (!imageFile && !removeExistingFlyer) setImagePreview(e.target.value);
                      }}
                      placeholder="Optional image URL if you are not uploading a file"
                    />
                  </div>

                  {form.category === "holiday" ? (
                    <div className="nea-field">
                      <label>Holiday Color</label>
                      <input
                        type="color"
                        value={form.holiday_color || "#4A75E6"}
                        onChange={(e) => setField("holiday_color", e.target.value)}
                        className="nea-color-input"
                      />
                    </div>
                  ) : null}

                  {form.category === "kids" || form.category === "trip" ? (
                    <>
                      <div className="nea-field">
                        <label>Price Per Person</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={form.price_per_person}
                          onChange={(e) => setField("price_per_person", e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="nea-field">
                        <label>Capacity</label>
                        <input
                          type="number"
                          min="1"
                          value={form.capacity}
                          onChange={(e) => setField("capacity", e.target.value)}
                          placeholder="Optional capacity"
                        />
                      </div>

                      <div className="nea-field nea-form-col-full">
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(form.registration_enabled)}
                            onChange={(e) =>
                              setField("registration_enabled", e.target.checked ? 1 : 0)
                            }
                            style={{ width: "16px", marginRight: "8px" }}
                          />
                          Enable public registration and payment
                        </label>
                      </div>

                      <div className="nea-field nea-form-col-full">
                        <label>Registration Notes</label>
                        <textarea
                          className="rte-textarea"
                          value={form.registration_notes}
                          onChange={(e) => setField("registration_notes", e.target.value)}
                          placeholder="Optional instructions for parents or participants"
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="nea-field nea-form-col-full">
                    <label>Summary</label>
                    <input
                      value={form.summary}
                      onChange={(e) => setField("summary", e.target.value)}
                      placeholder="Short summary"
                    />
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <label>Description</label>
                    <textarea
                      className="rte-textarea"
                      value={form.body_html}
                      onChange={(e) => setField("body_html", e.target.value)}
                      placeholder="Enter detailed description"
                    />
                  </div>

                  <div className="nea-field nea-form-col-full">
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(form.is_published)}
                        onChange={(e) => setField("is_published", e.target.checked ? 1 : 0)}
                        style={{ width: "16px", marginRight: "8px" }}
                      />
                      Publish now
                    </label>
                  </div>
                </div>

                <div className="nea-modal-actions nea-modal-actions-left">
                  <button type="submit" className="nea-add-btn">
                    {form.id ? "Update Event" : "Add Event"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}