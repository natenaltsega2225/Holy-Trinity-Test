// // //src/components/AdminDashboard/MembershipPlans.jsx
// // import React, { useEffect, useMemo, useState } from "react";
// // import api from "../../api";
// // import "../../../styles/admin-members-roles.css";

// // const EMPTY_FORM = {
// //   id: null,
// //   code: "",
// //   name: "",
// //   description: "",
// //   duration_months: 1,
// //   amount: "",
// //   registration_fee: "",
// //   member_type: "both",
// //   is_active: true,
// //   sort_order: 1,
// //   allow_custom_amount: false,
// // };

// // function money(value) {
// //   const n = Number(value || 0);
// //   if (Number.isNaN(n)) return "$0.00";
// //   return `$${n.toLocaleString(undefined, {
// //     minimumFractionDigits: 2,
// //     maximumFractionDigits: 2,
// //   })}`;
// // }

// // function PlanModal({ open, title, subtitle, children, onClose }) {
// //   if (!open) return null;

// //   return (
// //     <div className="mr-plan-modal-overlay" onClick={onClose}>
// //       <div className="mr-plan-modal" onClick={(e) => e.stopPropagation()}>
// //         <div className="mr-plan-modal-head">
// //           <div>
// //             <h3 className="mr-plan-modal-title">{title}</h3>
// //             {subtitle ? (
// //               <p className="mr-plan-modal-subtitle">{subtitle}</p>
// //             ) : null}
// //           </div>

// //           <button
// //             type="button"
// //             className="mr-plan-modal-close"
// //             onClick={onClose}
// //             aria-label="Close modal"
// //           >
// //             ×
// //           </button>
// //         </div>

// //         <div className="mr-plan-modal-body">{children}</div>
// //       </div>
// //     </div>
// //   );
// // }

// // function planStatusMeta(row) {
// //   return row.is_active
// //     ? {
// //         label: "Active",
// //         className: "mr-plan-status mr-plan-status-active",
// //       }
// //     : {
// //         label: "Inactive",
// //         className: "mr-plan-status mr-plan-status-inactive",
// //       };
// // }

// // function ActionsMenu({ onEdit, onDelete, deleting }) {
// //   const [open, setOpen] = useState(false);

// //   useEffect(() => {
// //     function handleDocClick() {
// //       setOpen(false);
// //     }

// //     if (open) {
// //       document.addEventListener("click", handleDocClick);
// //     }

// //     return () => {
// //       document.removeEventListener("click", handleDocClick);
// //     };
// //   }, [open]);

// //   return (
// //     <div
// //       className="mr-action-menu"
// //       onClick={(e) => e.stopPropagation()}
// //     >
// //       <button
// //         type="button"
// //         className="mr-kebab-btn"
// //         aria-label="Open actions"
// //         onClick={() => setOpen((prev) => !prev)}
// //       >
// //         <span />
// //         <span />
// //         <span />
// //       </button>

// //       {open ? (
// //         <div className="mr-kebab-menu">
// //           <button
// //             type="button"
// //             className="mr-kebab-item"
// //             onClick={() => {
// //               setOpen(false);
// //               onEdit();
// //             }}
// //           >
// //             Edit
// //           </button>

// //           <button
// //             type="button"
// //             className="mr-kebab-item danger"
// //             onClick={() => {
// //               setOpen(false);
// //               onDelete();
// //             }}
// //             disabled={deleting}
// //           >
// //             {deleting ? "Deleting..." : "Delete"}
// //           </button>
// //         </div>
// //       ) : null}
// //     </div>
// //   );
// // }

// // export default function MembershipPlans() {
// //   const [rows, setRows] = useState([]);
// //   const [form, setForm] = useState(EMPTY_FORM);
// //   const [loading, setLoading] = useState(true);
// //   const [saving, setSaving] = useState(false);
// //   const [deletingId, setDeletingId] = useState(null);
// //   const [error, setError] = useState("");
// //   const [success, setSuccess] = useState("");
// //   const [formOpen, setFormOpen] = useState(false);

// //   const [monthlyFee, setMonthlyFee] = useState("");
// //   const [registrationFee, setRegistrationFee] = useState("50");

// //   const preview = useMemo(() => {
// //     const m = Number(monthlyFee || 0);
// //     const reg = Number(registrationFee || 0);

// //     return {
// //       monthly: m,
// //       semiAnnual: Number((m * 6).toFixed(2)),
// //       annual: Number((m * 12).toFixed(2)),
// //       registration: reg,
// //       customMinimum: m,
// //     };
// //   }, [monthlyFee, registrationFee]);

// //   async function loadPlans() {
// //     setLoading(true);
// //     setError("");

// //     try {
// //       const { data } = await api.get("/admin/membership-plans");
// //       const plans = Array.isArray(data?.rows) ? data.rows : [];
// //       setRows(plans);

// //       const monthly = plans.find(
// //         (p) =>
// //           !p.allow_custom_amount &&
// //           (Number(p.duration_months) === 1 ||
// //             String(p.code || p.plan_code || "").toUpperCase() === "MEM-1")
// //       );

// //       if (monthly) {
// //         setMonthlyFee(String(monthly.amount ?? ""));
// //         setRegistrationFee(String(monthly.registration_fee ?? "50"));
// //       }
// //     } catch (err) {
// //       console.error(err);
// //       setError(err?.response?.data?.error || "Failed to load membership plans.");
// //     } finally {
// //       setLoading(false);
// //     }
// //   }

// //   useEffect(() => {
// //     loadPlans();
// //   }, []);

// //   const sortedRows = useMemo(() => {
// //     return [...rows].sort((a, b) => {
// //       const aOrder = Number(a.sort_order ?? 0);
// //       const bOrder = Number(b.sort_order ?? 0);
// //       if (aOrder !== bOrder) return aOrder - bOrder;
// //       return Number(a.duration_months ?? 0) - Number(b.duration_months ?? 0);
// //     });
// //   }, [rows]);

// //   const stats = useMemo(() => {
// //     const activeCount = rows.filter((r) => Number(r.is_active) === 1).length;
// //     const customCount = rows.filter((r) => Boolean(r.allow_custom_amount)).length;
// //     const highestPlan = rows.reduce((max, row) => {
// //       const amount = Number(row.amount || 0);
// //       return amount > max ? amount : max;
// //     }, 0);

// //     return {
// //       total: rows.length,
// //       active: activeCount,
// //       custom: customCount,
// //       highestPlan,
// //     };
// //   }, [rows]);

// //   function updateField(key, value) {
// //     setForm((prev) => ({ ...prev, [key]: value }));
// //   }

// //   function startCreate(defaults = {}) {
// //     setError("");
// //     setSuccess("");
// //     setForm({ ...EMPTY_FORM, ...defaults });
// //     setFormOpen(true);
// //   }

// //   function startEdit(plan) {
// //     setError("");
// //     setSuccess("");
// //     setForm({
// //       id: plan.id,
// //       code: plan.code ?? plan.plan_code ?? "",
// //       name: plan.name ?? plan.plan_name ?? "",
// //       description: plan.description ?? "",
// //       duration_months: Number(plan.duration_months ?? 1),
// //       amount: Number(plan.amount ?? 0),
// //       registration_fee: Number(plan.registration_fee ?? 0),
// //       member_type: plan.member_type ?? "both",
// //       is_active: Boolean(plan.is_active),
// //       sort_order: Number(plan.sort_order ?? 1),
// //       allow_custom_amount: Boolean(plan.allow_custom_amount),
// //     });
// //     setFormOpen(true);
// //   }

// //   function resetForm() {
// //     setForm(EMPTY_FORM);
// //   }

// //   function closeFormModal() {
// //     if (saving) return;
// //     resetForm();
// //     setFormOpen(false);
// //   }

// //   function validateForm() {
// //     if (!String(form.code || "").trim()) return "Plan code is required.";
// //     if (!String(form.name || "").trim()) return "Plan name is required.";
// //     if (![1, 6, 12].includes(Number(form.duration_months))) {
// //       return "Duration must be 1, 6, or 12 months.";
// //     }
// //     if (Number(form.amount) < 0) return "Plan amount cannot be negative.";
// //     if (Number(form.registration_fee) < 0) {
// //       return "Registration fee cannot be negative.";
// //     }
// //     return "";
// //   }

// //   async function handleSubmit(e) {
// //     e.preventDefault();
// //     setError("");
// //     setSuccess("");

// //     const validation = validateForm();
// //     if (validation) {
// //       setError(validation);
// //       return;
// //     }

// //     const payload = {
// //       code: String(form.code).trim(),
// //       name: String(form.name).trim(),
// //       description: String(form.description || "").trim(),
// //       duration_months: Number(form.duration_months),
// //       amount: Number(form.amount || 0),
// //       registration_fee: Number(form.registration_fee || 0),
// //       member_type: form.member_type,
// //       is_active: Boolean(form.is_active),
// //       sort_order: Number(form.sort_order || 0),
// //       allow_custom_amount: Boolean(form.allow_custom_amount),
// //     };

// //     try {
// //       setSaving(true);

// //       if (form.id) {
// //         await api.put(`/admin/membership-plans/${form.id}`, payload);
// //         setSuccess("Membership plan updated successfully.");
// //       } else {
// //         await api.post("/admin/membership-plans", payload);
// //         setSuccess("Membership plan created successfully.");
// //       }

// //       await loadPlans();
// //       closeFormModal();
// //     } catch (err) {
// //       console.error(err);
// //       setError(err?.response?.data?.error || "Failed to save membership plan.");
// //     } finally {
// //       setSaving(false);
// //     }
// //   }

// //   async function handleDelete(id) {
// //     const ok = window.confirm("Delete this membership plan?");
// //     if (!ok) return;

// //     setError("");
// //     setSuccess("");

// //     try {
// //       setDeletingId(id);
// //       await api.delete(`/admin/membership-plans/${id}`);
// //       setSuccess("Membership plan deleted successfully.");
// //       await loadPlans();

// //       if (form.id === id) resetForm();
// //     } catch (err) {
// //       console.error(err);
// //       setError(
// //         err?.response?.data?.error || "Failed to delete membership plan."
// //       );
// //     } finally {
// //       setDeletingId(null);
// //     }
// //   }

// //   async function handleSeedCalculatedPlans() {
// //     setError("");
// //     setSuccess("");

// //     const monthly = Number(monthlyFee);
// //     const reg = Number(registrationFee);

// //     if (!Number.isFinite(monthly) || monthly <= 0) {
// //       setError("Monthly membership fee must be greater than 0.");
// //       return;
// //     }

// //     if (!Number.isFinite(reg) || reg < 0) {
// //       setError("Initial registration fee is invalid.");
// //       return;
// //     }

// //     try {
// //       setSaving(true);
// //       await api.post("/admin/membership-plans/seed", {
// //         monthly_fee: monthly,
// //         registration_fee: reg,
// //       });
// //       setSuccess(
// //         "Monthly, 6-month, 12-month, and custom membership plans were updated."
// //       );
// //       await loadPlans();
// //     } catch (err) {
// //       console.error(err);
// //       setError(
// //         err?.response?.data?.error || "Failed to calculate membership plans."
// //       );
// //     } finally {
// //       setSaving(false);
// //     }
// //   }

// //   return (
// //     <div className="mr-page">
// //       <section className="mr-plan-hero-v2">
// //         <div className="mr-plan-hero-v2__content">
// //           <div className="mr-plan-hero-v2__eyebrow">Administration</div>
// //           <h1 className="mr-plan-hero-v2__title">Membership Plans</h1>
// //           <p className="mr-plan-hero-v2__subtitle">
// //             Configure dues structures, registration fees, and custom payment
// //             rules with a clean enterprise-grade setup for member billing.
// //           </p>
// //         </div>

// //         <div className="mr-plan-hero-v2__actions">
// //           <button
// //             type="button"
// //             className="mr-btn mr-btn-primary"
// //             onClick={() => startCreate()}
// //           >
// //             + Create Membership Plan
// //           </button>
// //         </div>
// //       </section>

// //       {error ? <div className="mr-banner mr-banner-error">{error}</div> : null}

// //       {success ? (
// //         <div className="mr-banner mr-plan-success-banner">{success}</div>
// //       ) : null}

// //       <section className="mr-plan-stats-grid">
// //         <article className="mr-plan-stat-card">
// //           <span className="mr-plan-stat-label">Total Plans</span>
// //           <strong className="mr-plan-stat-value">{stats.total}</strong>
// //           <p className="mr-plan-stat-sub">Configured membership plans</p>
// //         </article>

// //         <article className="mr-plan-stat-card">
// //           <span className="mr-plan-stat-label">Active Plans</span>
// //           <strong className="mr-plan-stat-value">{stats.active}</strong>
// //           <p className="mr-plan-stat-sub">Currently available for use</p>
// //         </article>

// //         <article className="mr-plan-stat-card">
// //           <span className="mr-plan-stat-label">Custom Plans</span>
// //           <strong className="mr-plan-stat-value">{stats.custom}</strong>
// //           <p className="mr-plan-stat-sub">Allow higher custom payment</p>
// //         </article>

// //         <article className="mr-plan-stat-card mr-plan-stat-card--accent">
// //           <span className="mr-plan-stat-label">Highest Plan Value</span>
// //           <strong className="mr-plan-stat-value">{money(stats.highestPlan)}</strong>
// //           <p className="mr-plan-stat-sub">Largest configured amount</p>
// //         </article>
// //       </section>

// //       <section className="mr-plan-builder-grid">
// //         <section className="mr-card mr-plan-panel">
// //           <div className="mr-plan-panel-head">
// //             <div>
// //               <div className="mr-section-title">Plan Auto Builder</div>
// //               <div className="mr-section-subtitle">
// //                 Build 1-month, 6-month, 12-month, and custom minimum values from
// //                 a single monthly fee.
// //               </div>
// //             </div>
// //             <span className="mr-plan-panel-badge">Auto Calculation</span>
// //           </div>

// //           <div className="mr-plan-builder-fields">
// //             <div className="mr-field">
// //               <label className="mr-label">Monthly Membership Fee</label>
// //               <input
// //                 className="mr-input mr-input-plain"
// //                 type="number"
// //                 min="0"
// //                 step="0.01"
// //                 value={monthlyFee}
// //                 onChange={(e) => setMonthlyFee(e.target.value)}
// //                 placeholder="50.00"
// //               />
// //             </div>

// //             <div className="mr-field">
// //               <label className="mr-label">Initial Registration Fee</label>
// //               <input
// //                 className="mr-input mr-input-plain"
// //                 type="number"
// //                 min="0"
// //                 step="0.01"
// //                 value={registrationFee}
// //                 onChange={(e) => setRegistrationFee(e.target.value)}
// //                 placeholder="50.00"
// //               />
// //             </div>
// //           </div>

// //           <div className="mr-plan-builder-actions">
// //             <button
// //               type="button"
// //               className="mr-btn mr-btn-primary"
// //               onClick={handleSeedCalculatedPlans}
// //               disabled={saving}
// //             >
// //               {saving ? "Calculating..." : "Calculate & Update Plans"}
// //             </button>
// //           </div>
// //         </section>

// //         <section className="mr-card mr-plan-panel">
// //           <div className="mr-plan-panel-head">
// //             <div>
// //               <div className="mr-section-title">Calculation Preview</div>
// //               <div className="mr-section-subtitle">
// //                 Preview expected plan values before updating the stored plans.
// //               </div>
// //             </div>
// //           </div>

// //           <div className="mr-plan-preview-grid-v2">
// //             <article className="mr-plan-preview-box">
// //               <span>Monthly Plan</span>
// //               <strong>{money(preview.monthly)}</strong>
// //             </article>

// //             <article className="mr-plan-preview-box">
// //               <span>6-Month Plan</span>
// //               <strong>{money(preview.semiAnnual)}</strong>
// //             </article>

// //             <article className="mr-plan-preview-box">
// //               <span>12-Month Plan</span>
// //               <strong>{money(preview.annual)}</strong>
// //             </article>

// //             <article className="mr-plan-preview-box">
// //               <span>Registration Fee</span>
// //               <strong>{money(preview.registration)}</strong>
// //             </article>

// //             <article className="mr-plan-preview-box mr-plan-preview-box--highlight">
// //               <span>Custom Minimum</span>
// //               <strong>{money(preview.customMinimum)}</strong>
// //             </article>
// //           </div>
// //         </section>
// //       </section>

// //       <section className="mr-card mr-plan-table-panel">
// //         <div className="mr-plan-panel-head mr-plan-panel-head--table">
// //           <div>
// //             <div className="mr-section-title">Configured Plans</div>
// //             <div className="mr-section-subtitle">
// //               Review, edit, and manage all active and inactive membership plans.
// //             </div>
// //           </div>

// //           <button
// //             type="button"
// //             className="mr-btn mr-btn-secondary"
// //             onClick={() => startCreate()}
// //           >
// //             Add Plan
// //           </button>
// //         </div>

// //         {loading ? (
// //           <div className="mr-plan-empty-state">Loading membership plans...</div>
// //         ) : sortedRows.length === 0 ? (
// //           <div className="mr-plan-empty-state">No membership plans found.</div>
// //         ) : (
// //           <div className="mr-table-wrap">
// //             <div className="mr-table-scroll">
// //               <table className="mr-table mr-sticky">
// //                 <thead>
// //                   <tr>
// //                     <th>Code</th>
// //                     <th>Plan</th>
// //                     <th>Months</th>
// //                     <th>Amount</th>
// //                     <th>Registration Fee</th>
// //                     <th>Member Type</th>
// //                     <th>Custom</th>
// //                     <th>Status</th>
// //                     <th style={{ textAlign: "right" }}>Actions</th>
// //                   </tr>
// //                 </thead>
// //                 <tbody>
// //                   {sortedRows.map((row) => {
// //                     const status = planStatusMeta(row);

// //                     return (
// //                       <tr key={row.id}>
// //                         <td>
// //                           <span className="mr-plan-code-pill">
// //                             {row.code ?? row.plan_code ?? "--"}
// //                           </span>
// //                         </td>
// //                         <td>
// //                           <div className="mr-plan-name-cell">
// //                             <strong>{row.name ?? row.plan_name ?? "--"}</strong>
// //                             <span>
// //                               {row.description
// //                                 ? row.description
// //                                 : "Membership billing configuration"}
// //                             </span>
// //                           </div>
// //                         </td>
// //                         <td>{row.duration_months ?? "--"}</td>
// //                         <td>{money(row.amount)}</td>
// //                         <td>{money(row.registration_fee)}</td>
// //                         <td className="mr-uppercase-lite">
// //                           {row.member_type || "both"}
// //                         </td>
// //                         <td>{row.allow_custom_amount ? "Yes" : "No"}</td>
// //                         <td>
// //                           <span className={status.className}>{status.label}</span>
// //                         </td>
// //                         <td className="mr-actions-cell">
// //                           <ActionsMenu
// //                             onEdit={() => startEdit(row)}
// //                             onDelete={() => handleDelete(row.id)}
// //                             deleting={deletingId === row.id}
// //                           />
// //                         </td>
// //                       </tr>
// //                     );
// //                   })}
// //                 </tbody>
// //               </table>
// //             </div>
// //           </div>
// //         )}
// //       </section>

// //       <PlanModal
// //         open={formOpen}
// //         title={form.id ? "Edit Membership Plan" : "Create Membership Plan"}
// //         subtitle="Create or update a structured membership billing plan."
// //         onClose={closeFormModal}
// //       >
// //         <form className="mr-form" onSubmit={handleSubmit}>
// //           <div className="mr-form-grid mr-grid-3">
// //             <div className="mr-field">
// //               <label className="mr-label">Plan Code</label>
// //               <input
// //                 className="mr-input mr-input-plain"
// //                 value={form.code}
// //                 onChange={(e) => updateField("code", e.target.value)}
// //                 placeholder="MEM-1"
// //               />
// //             </div>

// //             <div className="mr-field">
// //               <label className="mr-label">Plan Name</label>
// //               <input
// //                 className="mr-input mr-input-plain"
// //                 value={form.name}
// //                 onChange={(e) => updateField("name", e.target.value)}
// //                 placeholder="Monthly Membership"
// //               />
// //             </div>

// //             <div className="mr-field">
// //               <label className="mr-label">Duration (Months)</label>
// //               <select
// //                 className="mr-select"
// //                 value={String(form.duration_months)}
// //                 onChange={(e) =>
// //                   updateField("duration_months", Number(e.target.value))
// //                 }
// //               >
// //                 <option value="1">1 Month</option>
// //                 <option value="6">6 Months</option>
// //                 <option value="12">12 Months</option>
// //               </select>
// //             </div>

// //             <div className="mr-field">
// //               <label className="mr-label">Plan Amount</label>
// //               <input
// //                 className="mr-input mr-input-plain"
// //                 type="number"
// //                 min="0"
// //                 step="0.01"
// //                 value={form.amount}
// //                 onChange={(e) => updateField("amount", e.target.value)}
// //                 placeholder="50.00"
// //               />
// //             </div>

// //             <div className="mr-field">
// //               <label className="mr-label">Initial Registration Fee</label>
// //               <input
// //                 className="mr-input mr-input-plain"
// //                 type="number"
// //                 min="0"
// //                 step="0.01"
// //                 value={form.registration_fee}
// //                 onChange={(e) => updateField("registration_fee", e.target.value)}
// //                 placeholder="50.00"
// //               />
// //             </div>

// //             <div className="mr-field">
// //               <label className="mr-label">Member Type</label>
// //               <select
// //                 className="mr-select"
// //                 value={form.member_type}
// //                 onChange={(e) => updateField("member_type", e.target.value)}
// //               >
// //                 <option value="both">Both</option>
// //                 <option value="existing">Existing Members</option>
// //                 <option value="new">New Members</option>
// //               </select>
// //             </div>

// //             <div className="mr-field">
// //               <label className="mr-label">Sort Order</label>
// //               <input
// //                 className="mr-input mr-input-plain"
// //                 type="number"
// //                 min="0"
// //                 value={form.sort_order}
// //                 onChange={(e) => updateField("sort_order", e.target.value)}
// //               />
// //             </div>

// //             <div className="mr-field">
// //               <label className="mr-label">Status</label>
// //               <select
// //                 className="mr-select"
// //                 value={String(form.is_active)}
// //                 onChange={(e) =>
// //                   updateField("is_active", e.target.value === "true")
// //                 }
// //               >
// //                 <option value="true">Active</option>
// //                 <option value="false">Inactive</option>
// //               </select>
// //             </div>

// //             <div className="mr-field">
// //               <label className="mr-label">Allow Custom Higher Amount</label>
// //               <select
// //                 className="mr-select"
// //                 value={String(form.allow_custom_amount)}
// //                 onChange={(e) =>
// //                   updateField("allow_custom_amount", e.target.value === "true")
// //                 }
// //               >
// //                 <option value="false">No</option>
// //                 <option value="true">Yes</option>
// //               </select>
// //             </div>
// //           </div>

// //           <div className="mr-field">
// //             <label className="mr-label">Description</label>
// //             <textarea
// //               className="mr-input mr-input-plain mr-plan-textarea"
// //               rows="4"
// //               value={form.description}
// //               onChange={(e) => updateField("description", e.target.value)}
// //               placeholder="Short plan description..."
// //             />
// //           </div>

// //           <div className="mr-form-actions">
// //             <button
// //               type="button"
// //               className="mr-btn mr-btn-secondary"
// //               onClick={closeFormModal}
// //               disabled={saving}
// //             >
// //               Cancel
// //             </button>

// //             <button
// //               type="submit"
// //               className="mr-btn mr-btn-primary"
// //               disabled={saving}
// //             >
// //               {saving ? "Saving..." : form.id ? "Update Plan" : "Create Plan"}
// //             </button>
// //           </div>
// //         </form>
// //       </PlanModal>
// //     </div>
// //   );
// // }



// //src/components/AdminDashboard/MembershipPlans.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import api from "../../api";
// import "../../../styles/admin-members-roles.css";

// const EMPTY_FORM = {
//   id: null,
//   code: "",
//   name: "",
//   description: "",
//   billing_cycle: "monthly",
//   duration_months: 1,
//   minimum_amount: "",
//   preset_amounts_text: "",
//   registration_fee: "50",
//   member_type: "both",
//   is_active: true,
//   sort_order: 1,
//   allow_custom_amount: true,
// };

// function money(value) {
//   const n = Number(value || 0);
//   return `$${n.toLocaleString(undefined, {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;
// }

// function normalizeOption(value) {
//   const v = String(value || "monthly").toLowerCase();
//   if (["monthly", "3_month", "6_month", "12_month"].includes(v)) return v;
//   return "monthly";
// }

// function durationFromOption(option) {
//   const v = normalizeOption(option);
//   if (v === "3_month") return 3;
//   if (v === "6_month") return 6;
//   if (v === "12_month") return 12;
//   return 1;
// }

// function labelFromOption(option) {
//   const v = normalizeOption(option);
//   if (v === "3_month") return "3-Month";
//   if (v === "6_month") return "6-Month";
//   if (v === "12_month") return "Yearly";
//   return "Monthly";
// }

// function defaultCodeFromOption(option) {
//   const v = normalizeOption(option);
//   if (v === "3_month") return "MEM-3";
//   if (v === "6_month") return "MEM-6";
//   if (v === "12_month") return "MEM-12";
//   return "MEM-1";
// }

// function parsePresetAmounts(value) {
//   const raw = String(value || "").trim();
//   if (!raw) return [];

//   const parts = raw
//     .split(",")
//     .map((item) => Number(String(item).trim()))
//     .filter((n) => Number.isFinite(n) && n > 0);

//   return Array.from(new Set(parts.map((n) => Number(n.toFixed(2))))).sort(
//     (a, b) => a - b
//   );
// }

// function presetTextFromRow(row) {
//   const source = row?.preset_amounts ?? row?.preset_amounts_json ?? [];
//   try {
//     const parsed = Array.isArray(source)
//       ? source
//       : typeof source === "string"
//       ? JSON.parse(source)
//       : [];
//     return parsed.join(", ");
//   } catch {
//     return "";
//   }
// }

// function PlanModal({ open, title, subtitle, children, onClose }) {
//   if (!open) return null;

//   return (
//     <div className="mr-plan-modal-overlay" onClick={onClose}>
//       <div className="mr-plan-modal" onClick={(e) => e.stopPropagation()}>
//         <div className="mr-plan-modal-head">
//           <div>
//             <h3 className="mr-plan-modal-title">{title}</h3>
//             {subtitle ? (
//               <p className="mr-plan-modal-subtitle">{subtitle}</p>
//             ) : null}
//           </div>

//           <button
//             type="button"
//             className="mr-plan-modal-close"
//             onClick={onClose}
//             aria-label="Close modal"
//           >
//             ×
//           </button>
//         </div>

//         <div className="mr-plan-modal-body">{children}</div>
//       </div>
//     </div>
//   );
// }

// function planStatusMeta(row) {
//   return Number(row.is_active) === 1
//     ? {
//         label: "Active",
//         className: "mr-plan-status mr-plan-status-active",
//       }
//     : {
//         label: "Inactive",
//         className: "mr-plan-status mr-plan-status-inactive",
//       };
// }

// function ActionsMenu({ onEdit, onDelete, deleting }) {
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
//     <div className="mr-action-menu" onClick={(e) => e.stopPropagation()}>
//       <button
//         type="button"
//         className="mr-kebab-btn"
//         aria-label="Open actions"
//         onClick={() => setOpen((prev) => !prev)}
//       >
//         <span />
//         <span />
//         <span />
//       </button>

//       {open ? (
//         <div className="mr-kebab-menu">
//           <button
//             type="button"
//             className="mr-kebab-item"
//             onClick={() => {
//               setOpen(false);
//               onEdit();
//             }}
//           >
//             Edit
//           </button>

//           <button
//             type="button"
//             className="mr-kebab-item danger"
//             onClick={() => {
//               setOpen(false);
//               onDelete();
//             }}
//             disabled={deleting}
//           >
//             {deleting ? "Deleting..." : "Delete"}
//           </button>
//         </div>
//       ) : null}
//     </div>
//   );
// }

// function StatCard({ label, value, sub, accent = false }) {
//   return (
//     <article
//       className={`mr-plan-stat-card ${accent ? "mr-plan-stat-card--accent" : ""}`}
//     >
//       <span className="mr-plan-stat-label">{label}</span>
//       <strong className="mr-plan-stat-value">{value}</strong>
//       <p className="mr-plan-stat-sub">{sub}</p>
//     </article>
//   );
// }

// export default function MembershipPlans() {
//   const [rows, setRows] = useState([]);
//   const [form, setForm] = useState(EMPTY_FORM);
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [deletingId, setDeletingId] = useState(null);
//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState("");
//   const [formOpen, setFormOpen] = useState(false);

//   async function loadPlans() {
//     setLoading(true);
//     setError("");

//     try {
//       const { data } = await api.get("/admin/membership-plans");
//       setRows(Array.isArray(data?.rows) ? data.rows : []);
//     } catch (err) {
//       console.error(err);
//       setError(err?.response?.data?.error || "Failed to load membership plans.");
//     } finally {
//       setLoading(false);
//     }
//   }

//   useEffect(() => {
//     loadPlans();
//   }, []);

//   const sortedRows = useMemo(() => {
//     return [...rows].sort((a, b) => {
//       const aOrder = Number(a.sort_order ?? 0);
//       const bOrder = Number(b.sort_order ?? 0);
//       if (aOrder !== bOrder) return aOrder - bOrder;
//       return Number(a.duration_months ?? 0) - Number(b.duration_months ?? 0);
//     });
//   }, [rows]);

//   const stats = useMemo(() => {
//     const activeCount = rows.filter((r) => Number(r.is_active) === 1).length;
//     const customCount = rows.filter((r) => Boolean(r.allow_custom_amount)).length;
//     const highestMinimum = rows.reduce((max, row) => {
//       const amount = Number(row.minimum_amount || 0);
//       return amount > max ? amount : max;
//     }, 0);

//     return {
//       total: rows.length,
//       active: activeCount,
//       custom: customCount,
//       highestMinimum,
//     };
//   }, [rows]);

//   function updateField(key, value) {
//     setForm((prev) => {
//       const next = { ...prev, [key]: value };

//       if (key === "billing_cycle") {
//         const months = durationFromOption(value);
//         next.duration_months = months;

//         if (!next.code || next.code === defaultCodeFromOption(prev.billing_cycle)) {
//           next.code = defaultCodeFromOption(value);
//         }

//         if (!next.name) {
//           next.name = `${labelFromOption(value)} Membership`;
//         }
//       }

//       return next;
//     });
//   }

//   function startCreate(defaults = {}) {
//     setError("");
//     setSuccess("");
//     setForm({
//       ...EMPTY_FORM,
//       ...defaults,
//       duration_months: durationFromOption(defaults.billing_cycle || "monthly"),
//       code: defaults.code || defaultCodeFromOption(defaults.billing_cycle || "monthly"),
//     });
//     setFormOpen(true);
//   }

//   function startEdit(plan) {
//     setError("");
//     setSuccess("");
//     const option = normalizeOption(plan.billing_cycle || "monthly");

//     setForm({
//       id: plan.id,
//       code: plan.code ?? plan.plan_code ?? "",
//       name: plan.name ?? plan.plan_name ?? "",
//       description: plan.description ?? "",
//       billing_cycle: option,
//       duration_months: Number(plan.duration_months ?? durationFromOption(option)),
//       minimum_amount: String(plan.minimum_amount ?? ""),
//       preset_amounts_text: presetTextFromRow(plan),
//       registration_fee: String(plan.registration_fee ?? "50"),
//       member_type: plan.member_type ?? "both",
//       is_active: Boolean(plan.is_active),
//       sort_order: Number(plan.sort_order ?? 1),
//       allow_custom_amount: Boolean(plan.allow_custom_amount),
//     });
//     setFormOpen(true);
//   }

//   function resetForm() {
//     setForm(EMPTY_FORM);
//   }

//   function closeFormModal() {
//     if (saving) return;
//     resetForm();
//     setFormOpen(false);
//   }

//   function validateForm() {
//     if (!String(form.code || "").trim()) return "Plan code is required.";
//     if (!String(form.name || "").trim()) return "Plan name is required.";

//     const option = normalizeOption(form.billing_cycle);
//     if (!["monthly", "3_month", "6_month", "12_month"].includes(option)) {
//       return "Billing cycle must be monthly, 3-month, 6-month, or 12-month.";
//     }

//     const minimum = Number(form.minimum_amount || 0);
//     if (!Number.isFinite(minimum) || minimum <= 0) {
//       return "Minimum amount must be greater than zero.";
//     }

//     const registrationFee = Number(form.registration_fee || 0);
//     if (!Number.isFinite(registrationFee) || registrationFee < 0) {
//       return "Registration fee cannot be negative.";
//     }

//     const presets = parsePresetAmounts(form.preset_amounts_text);
//     if (presets.length === 0) {
//       return "Please enter at least one preset amount.";
//     }

//     if (presets.some((amount) => amount < minimum)) {
//       return "All preset amounts must be greater than or equal to the minimum amount.";
//     }

//     return "";
//   }

//   async function handleSubmit(e) {
//     e.preventDefault();
//     setError("");
//     setSuccess("");

//     const validation = validateForm();
//     if (validation) {
//       setError(validation);
//       return;
//     }

//     const option = normalizeOption(form.billing_cycle);
//     const presets = parsePresetAmounts(form.preset_amounts_text);

//     const payload = {
//       code: String(form.code).trim(),
//       name: String(form.name).trim(),
//       description: String(form.description || "").trim(),
//       billing_cycle: option,
//       duration_months: durationFromOption(option),
//       minimum_amount: Number(form.minimum_amount || 0),
//       preset_amounts_json: presets,
//       registration_fee: Number(form.registration_fee || 0),
//       member_type: form.member_type,
//       is_active: Boolean(form.is_active),
//       sort_order: Number(form.sort_order || 0),
//       allow_custom_amount: Boolean(form.allow_custom_amount),
//     };

//     try {
//       setSaving(true);

//       if (form.id) {
//         await api.put(`/admin/membership-plans/${form.id}`, payload);
//         setSuccess("Membership plan updated successfully.");
//       } else {
//         await api.post("/admin/membership-plans", payload);
//         setSuccess("Membership plan created successfully.");
//       }

//       await loadPlans();
//       closeFormModal();
//     } catch (err) {
//       console.error(err);
//       setError(err?.response?.data?.error || "Failed to save membership plan.");
//     } finally {
//       setSaving(false);
//     }
//   }

//   async function handleDelete(id) {
//     const ok = window.confirm("Delete this membership plan?");
//     if (!ok) return;

//     setError("");
//     setSuccess("");

//     try {
//       setDeletingId(id);
//       await api.delete(`/admin/membership-plans/${id}`);
//       setSuccess("Membership plan deleted successfully.");
//       await loadPlans();

//       if (form.id === id) resetForm();
//     } catch (err) {
//       console.error(err);
//       setError(err?.response?.data?.error || "Failed to delete membership plan.");
//     } finally {
//       setDeletingId(null);
//     }
//   }

//   return (
//     <div className="mr-page">
//       <section className="mr-plan-hero-v2">
//         <div className="mr-plan-hero-v2__content">
//           <div className="mr-plan-hero-v2__eyebrow">Plan Management</div>
//           <h1 className="mr-plan-hero-v2__title">Membership Plans</h1>
//           <p className="mr-plan-hero-v2__subtitle">
//             Configure one row per billing interval with minimum amount, preset
//             buttons, registration fee, and custom amount rules.
//           </p>
//         </div>

//         <div className="mr-plan-hero-v2__actions">
//           <button
//             type="button"
//             className="mr-btn mr-btn-primary"
//             onClick={() => startCreate()}
//           >
//             + Create Membership Plan
//           </button>
//         </div>
//       </section>

//       {error ? <div className="mr-banner mr-banner-error">{error}</div> : null}
//       {success ? <div className="mr-banner mr-plan-success-banner">{success}</div> : null}

//       <section className="mr-plan-stats-grid">
//         <StatCard
//           label="Total Plans"
//           value={stats.total}
//           sub="Configured interval plans"
//         />
//         <StatCard
//           label="Active Plans"
//           value={stats.active}
//           sub="Currently available for use"
//         />
//         <StatCard
//           label="Custom Allowed"
//           value={stats.custom}
//           sub="Plans allowing custom member amount"
//         />
//         <StatCard
//           label="Highest Minimum"
//           value={money(stats.highestMinimum)}
//           sub="Largest configured minimum amount"
//           accent
//         />
//       </section>

//       <section className="mr-card mr-plan-table-panel">
//         <div className="mr-plan-panel-head mr-plan-panel-head--table">
//           <div>
//             <div className="mr-section-title">Configured Plans</div>
//             <div className="mr-section-subtitle">
//               Review each billing interval row, its minimum amount, preset
//               buttons, registration fee, and custom amount settings.
//             </div>
//           </div>

//           <button
//             type="button"
//             className="mr-btn mr-btn-secondary"
//             onClick={() => startCreate()}
//           >
//             Add Plan
//           </button>
//         </div>

//         {loading ? (
//           <div className="mr-plan-empty-state">Loading membership plans...</div>
//         ) : sortedRows.length === 0 ? (
//           <div className="mr-plan-empty-state">No membership plans found.</div>
//         ) : (
//           <div className="mr-table-wrap">
//             <div className="mr-table-scroll">
//               <table className="mr-table mr-sticky">
//                 <thead>
//                   <tr>
//                     <th>Code</th>
//                     <th>Plan</th>
//                     <th>Cycle</th>
//                     <th>Min Amount</th>
//                     <th>Presets</th>
//                     <th>Registration Fee</th>
//                     <th>Custom</th>
//                     <th>Status</th>
//                     <th style={{ textAlign: "right" }}>Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {sortedRows.map((row) => {
//                     const status = planStatusMeta(row);

//                     return (
//                       <tr key={row.id}>
//                         <td>
//                           <span className="mr-plan-code-pill">
//                             {row.code ?? row.plan_code ?? "--"}
//                           </span>
//                         </td>

//                         <td>
//                           <div className="mr-plan-name-cell">
//                             <strong>{row.name ?? row.plan_name ?? "--"}</strong>
//                             <span>
//                               {row.description || "Membership billing configuration"}
//                             </span>
//                           </div>
//                         </td>

//                         <td>{labelFromOption(row.billing_cycle)}</td>
//                         <td>{money(row.minimum_amount)}</td>
//                         <td>{presetTextFromRow(row) || "--"}</td>
//                         <td>{money(row.registration_fee)}</td>
//                         <td>{Number(row.allow_custom_amount) ? "Yes" : "No"}</td>

//                         <td>
//                           <span className={status.className}>{status.label}</span>
//                         </td>

//                         <td style={{ textAlign: "right" }}>
//                           <ActionsMenu
//                             onEdit={() => startEdit(row)}
//                             onDelete={() => handleDelete(row.id)}
//                             deleting={deletingId === row.id}
//                           />
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         )}
//       </section>

//       <PlanModal
//         open={formOpen}
//         title={form.id ? "Edit Membership Plan" : "Create Membership Plan"}
//         subtitle="Configure one interval plan with minimum amount, preset buttons, registration fee, and custom amount support."
//         onClose={closeFormModal}
//       >
//         <form className="mr-plan-form" onSubmit={handleSubmit}>
//           <div className="mr-plan-form-grid">
//             <label className="mr-field">
//               <span className="mr-label">Billing Cycle</span>
//               <select
//                 className="mr-input mr-input-plain"
//                 value={form.billing_cycle}
//                 onChange={(e) => updateField("billing_cycle", e.target.value)}
//               >
//                 <option value="monthly">Monthly</option>
//                 <option value="3_month">3-Month</option>
//                 <option value="6_month">6-Month</option>
//                 <option value="12_month">12-Month</option>
//               </select>
//             </label>

//             <label className="mr-field">
//               <span className="mr-label">Duration Months</span>
//               <input
//                 className="mr-input mr-input-plain"
//                 value={durationFromOption(form.billing_cycle)}
//                 readOnly
//               />
//             </label>

//             <label className="mr-field">
//               <span className="mr-label">Code</span>
//               <input
//                 className="mr-input mr-input-plain"
//                 value={form.code}
//                 onChange={(e) => updateField("code", e.target.value)}
//                 placeholder="MEM-1 / MEM-3 / MEM-6 / MEM-12"
//                 required
//               />
//             </label>

//             <label className="mr-field">
//               <span className="mr-label">Name</span>
//               <input
//                 className="mr-input mr-input-plain"
//                 value={form.name}
//                 onChange={(e) => updateField("name", e.target.value)}
//                 placeholder="Monthly Membership"
//                 required
//               />
//             </label>

//             <label className="mr-field">
//               <span className="mr-label">Minimum Amount</span>
//               <input
//                 className="mr-input mr-input-plain"
//                 type="number"
//                 min="0"
//                 step="0.01"
//                 value={form.minimum_amount}
//                 onChange={(e) => updateField("minimum_amount", e.target.value)}
//                 required
//               />
//             </label>

//             <label className="mr-field">
//               <span className="mr-label">Registration Fee</span>
//               <input
//                 className="mr-input mr-input-plain"
//                 type="number"
//                 min="0"
//                 step="0.01"
//                 value={form.registration_fee}
//                 onChange={(e) => updateField("registration_fee", e.target.value)}
//               />
//             </label>

//             <label className="mr-field mr-field-span-2">
//               <span className="mr-label">Preset Amounts</span>
//               <input
//                 className="mr-input mr-input-plain"
//                 value={form.preset_amounts_text}
//                 onChange={(e) => updateField("preset_amounts_text", e.target.value)}
//                 placeholder="50, 100, 150"
//                 required
//               />
//             </label>

//             <label className="mr-field">
//               <span className="mr-label">Member Type</span>
//               <select
//                 className="mr-input mr-input-plain"
//                 value={form.member_type}
//                 onChange={(e) => updateField("member_type", e.target.value)}
//               >
//                 <option value="both">Both</option>
//                 <option value="existing">Existing</option>
//                 <option value="new">New</option>
//               </select>
//             </label>

//             <label className="mr-field">
//               <span className="mr-label">Sort Order</span>
//               <input
//                 className="mr-input mr-input-plain"
//                 type="number"
//                 min="1"
//                 value={form.sort_order}
//                 onChange={(e) => updateField("sort_order", e.target.value)}
//               />
//             </label>

//             <label className="mr-check-row">
//               <input
//                 type="checkbox"
//                 checked={form.allow_custom_amount}
//                 onChange={(e) =>
//                   updateField("allow_custom_amount", e.target.checked)
//                 }
//               />
//               <span>Allow Custom Amount</span>
//             </label>

//             <label className="mr-check-row">
//               <input
//                 type="checkbox"
//                 checked={form.is_active}
//                 onChange={(e) => updateField("is_active", e.target.checked)}
//               />
//               <span>Active</span>
//             </label>

//             <label className="mr-field mr-field-span-2">
//               <span className="mr-label">Description</span>
//               <textarea
//                 className="mr-input mr-input-plain"
//                 rows="4"
//                 value={form.description}
//                 onChange={(e) => updateField("description", e.target.value)}
//                 placeholder="Plan details..."
//               />
//             </label>
//           </div>

//           <div className="mr-plan-form-actions">
//             <button
//               type="button"
//               className="mr-btn mr-btn-secondary"
//               onClick={closeFormModal}
//               disabled={saving}
//             >
//               Cancel
//             </button>
//             <button
//               type="submit"
//               className="mr-btn mr-btn-primary"
//               disabled={saving}
//             >
//               {saving ? "Saving..." : form.id ? "Update Plan" : "Create Plan"}
//             </button>
//           </div>
//         </form>
//       </PlanModal>
//     </div>
//   );
// }