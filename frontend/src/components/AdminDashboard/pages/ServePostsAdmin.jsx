// //frontend\src\components\AdminDashboard\pages\ServePostsAdmin.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../api";
import VolunteerCertificateTemplate from "../../certificates/VolunteerCertificateTemplate";
import { generateCertificatePdf } from "../../../utils/generateCertificatePdf";
// import "../../../styles/admin-serve-center.css";
import "../../../styles/admin-enterprise.css";
import "../../../styles/admin-table.css";
const CATEGORY_OPTIONS = [
  "Sunday School",
  "Youth Mentorship",
  "Liturgical Assistance",
  "Welcoming / Ushering",
  "Parking Assistance",
  "Facility Setup & Maintenance",
  "Event Planning Team",
  "Community Outreach",
  "Media / Technology",
  "Hospitality",
  "Fundraising / Development",
];

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "request_info", label: "Request Info" },
];

const RECOGNITION_LEVELS = ["Bronze", "Silver", "Gold", "Platinum"];

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatDateTime(dateValue, startValue, endValue) {
  if (!dateValue && !startValue && !endValue) return "—";

  const parts = [];

  if (dateValue) {
    const d = new Date(dateValue);
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    } else {
      parts.push(dateValue);
    }
  }

  if (startValue || endValue) {
    parts.push(`${startValue || "TBD"} - ${endValue || "TBD"}`);
  }

  return parts.join(" • ");
}

function calculateHours(start, end) {
  if (!start || !end) return "";
  const [sh, sm] = String(start).split(":").map(Number);
  const [eh, em] = String(end).split(":").map(Number);

  if (![sh, sm, eh, em].every(Number.isFinite)) return "";

  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const diff = endMinutes - startMinutes;

  if (diff <= 0) return "";
  return (diff / 60).toFixed(2);
}

function suggestedLevel(hours) {
  const value = Number(hours || 0);
  if (value >= 100) return "Platinum";
  if (value >= 50) return "Gold";
  if (value >= 25) return "Silver";
  if (value >= 10) return "Bronze";
  return "Starter";
}

function getPageMeta(mode) {
  if (mode === "applications") {
    return {
      title: "Volunteer Applications",
      subtitle:
        "Review submitted volunteer applications, approve requests, and manage follow-up actions.",
    };
  }

  if (mode === "hours") {
    return {
      title: "Volunteer Hours",
      subtitle:
        "Track service hours for signed volunteers and maintain a clean service history.",
    };
  }

  if (mode === "summary") {
    return {
      title: "Volunteer Summary",
      subtitle:
        "View total hours, last served date, categories served, recognition readiness, and generate certificates.",
    };
  }

  if (mode === "recognition") {
    return {
      title: "Recognition",
      subtitle:
        "Manage volunteer recognition records, award levels, and board approvals.",
    };
  }

  return {
    title: "Serve Center",
    subtitle:
      "Create serve posts, review volunteer applications, track hours, and manage recognition from one center.",
  };
}

function StatusBadge({ status }) {
  const classes = {
    new: "asc-badge asc-badge--new",
    in_review: "asc-badge asc-badge--review",
    approved: "asc-badge asc-badge--approved",
    declined: "asc-badge asc-badge--declined",
    request_info: "asc-badge asc-badge--info",
  };

  const labels = {
    new: "New",
    in_review: "In Review",
    approved: "Approved",
    declined: "Declined",
    request_info: "Request Info",
  };

  return (
    <span className={classes[status] || "asc-badge"}>
      {labels[status] || status || "—"}
    </span>
  );
}

function SummaryLevelBadge({ level }) {
  const cls =
    level === "Platinum"
      ? "asc-level asc-level--platinum"
      : level === "Gold"
      ? "asc-level asc-level--gold"
      : level === "Silver"
      ? "asc-level asc-level--silver"
      : level === "Bronze"
      ? "asc-level asc-level--bronze"
      : "asc-level asc-level--starter";

  return <span className={cls}>{level}</span>;
}

function RowActionMenu({
  row,
  openMenuId,
  setOpenMenuId,
  actions = [],
  idKey = "id",
  label,
}) {
  const fallbackId = `${row.volunteer_name || row.full_name || "row"}-${row.email || row.title || ""}`;
  const rowId = row[idKey] ?? fallbackId;
  const isOpen = openMenuId === rowId;

  return (
    <div className="asc-row-actions">
      <button
        type="button"
        className="asc-kebab-btn"
        aria-label={label || "Row actions"}
        onClick={() => setOpenMenuId(isOpen ? null : rowId)}
      >
        ⋮
      </button>

      {isOpen && (
        <div className="asc-kebab-menu">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.danger ? "danger" : ""}
              onClick={() => action.onClick(row)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VolunteerModal({ item, open, onClose, onSave, saving }) {
  const [status, setStatus] = useState("new");
  const [adminNotes, setAdminNotes] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [leaderEmail, setLeaderEmail] = useState("");

  useEffect(() => {
    if (!item) return;
    setStatus(item.status || "new");
    setAdminNotes(item.admin_notes || "");
    setDeclineReason(item.decline_reason || "");
    setLeaderName(item.ministry_leader_name || "");
    setLeaderEmail(item.ministry_leader_email || "");
  }, [item]);

  if (!open || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave({
      id: item.id,
      status,
      admin_notes: adminNotes,
      decline_reason: declineReason,
      ministry_leader_name: leaderName,
      ministry_leader_email: leaderEmail,
    });
  };

  return (
    <div className="asc-modal-backdrop" onClick={onClose}>
      <div className="asc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="asc-modal-header">
          <div>
            <p className="asc-eyebrow">Volunteer Application</p>
            <h3>{item.full_name}</h3>
          </div>
          <button type="button" className="asc-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="asc-modal-body">
          <div className="asc-detail-grid">
            <div className="asc-detail-card">
              <h4>Applicant</h4>
              <div className="asc-detail-list">
                <div><span>Name</span><strong>{item.full_name || "—"}</strong></div>
                <div><span>Email</span><strong>{item.email || "—"}</strong></div>
                <div><span>Phone</span><strong>{item.phone || "—"}</strong></div>
                <div><span>Submitted</span><strong>{formatDate(item.created_at)}</strong></div>
              </div>
            </div>

            <div className="asc-detail-card">
              <h4>Volunteer Selection</h4>
              <div className="asc-detail-list">
                <div><span>Category</span><strong>{item.category || "—"}</strong></div>
                <div><span>Role</span><strong>{item.role || "—"}</strong></div>
                <div><span>Activity</span><strong>{item.activity_title || "General role application"}</strong></div>
                <div>
                  <span>Activity Schedule</span>
                  <strong>
                    {formatDateTime(
                      item.activity_date,
                      item.activity_start_time,
                      item.activity_end_time
                    )}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <form className="asc-form" onSubmit={handleSubmit}>
            <div className="asc-form-grid">
              <label>
                <span>Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Ministry Leader Name</span>
                <input
                  type="text"
                  value={leaderName}
                  onChange={(e) => setLeaderName(e.target.value)}
                  placeholder="Assigned leader name"
                />
              </label>

              <label>
                <span>Ministry Leader Email</span>
                <input
                  type="email"
                  value={leaderEmail}
                  onChange={(e) => setLeaderEmail(e.target.value)}
                  placeholder="leader@church.org"
                />
              </label>
            </div>

            {(status === "declined" || status === "request_info") && (
              <label className="asc-form-block">
                <span>{status === "declined" ? "Decline Reason" : "Request Details"}</span>
                <textarea
                  rows={4}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                />
              </label>
            )}

            <label className="asc-form-block">
              <span>Internal Admin Notes</span>
              <textarea
                rows={5}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </label>

            <div className="asc-modal-actions">
              <button type="button" className="asc-btn asc-btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="asc-btn asc-btn--primary" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ServePostModal({
  open,
  onClose,
  onSubmit,
  saving,
  form,
  setForm,
  editingId,
  onCancelEdit,
}) {
  if (!open) return null;

  return (
    <div className="asc-modal-backdrop" onClick={onClose}>
      <div className="asc-modal asc-modal--post" onClick={(e) => e.stopPropagation()}>
        <div className="asc-modal-header">
          <div>
            <p className="asc-eyebrow">Serve Post</p>
            <h3>{editingId ? "Edit Serve Post" : "Add New Serve Post"}</h3>
          </div>
          <button type="button" className="asc-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="asc-modal-body">
          <form className="asc-post-form" onSubmit={onSubmit}>
            <div className="asc-grid">
              <label>
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      category: e.target.value,
                      title: prev.title || e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select category</option>
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Title</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Serve post title"
                  required
                />
              </label>

              <label className="asc-full">
                <span>Description</span>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe the volunteer need"
                  required
                />
              </label>

              <label>
                <span>Date</span>
                <input
                  type="date"
                  value={form.activity_date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, activity_date: e.target.value }))
                  }
                  required
                />
              </label>

              <label>
                <span>Start Time</span>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, start_time: e.target.value }))
                  }
                  required
                />
              </label>

              <label>
                <span>End Time</span>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, end_time: e.target.value }))
                  }
                  required
                />
              </label>

              <label className="asc-full">
                <span>Location</span>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="Location"
                  required
                />
              </label>

              <label className="asc-full">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Optional notes"
                />
              </label>

              <label className="asc-check">
                <input
                  type="checkbox"
                  checked={!!form.is_published}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_published: e.target.checked,
                    }))
                  }
                />
                <span>Publish immediately</span>
              </label>
            </div>

            <div className="asc-actions">
              {editingId ? (
                <button
                  type="button"
                  className="asc-btn asc-btn--ghost"
                  onClick={onCancelEdit}
                >
                  Cancel Edit
                </button>
              ) : null}

              <button type="submit" className="asc-btn asc-btn--primary" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Post" : "Publish Post"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function VolunteerHoursModal({
  open,
  onClose,
  onSubmit,
  saving,
  form,
  setForm,
  volunteerOptions,
  servePostOptions,
  editingId,
}) {
  if (!open) return null;

  return (
    <div className="asc-modal-backdrop" onClick={onClose}>
      <div className="asc-modal asc-modal--post" onClick={(e) => e.stopPropagation()}>
        <div className="asc-modal-header">
          <div>
            <p className="asc-eyebrow">Volunteer Hours</p>
            <h3>{editingId ? "Edit Volunteer Hours" : "Add Volunteer Hours"}</h3>
          </div>
          <button type="button" className="asc-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="asc-modal-body">
          <form className="asc-post-form" onSubmit={onSubmit}>
            <div className="asc-grid">
              <label>
                <span>Volunteer Name</span>
                <select
                  value={form.volunteer_name}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const selectedVolunteer = volunteerOptions.find(
                      (item) => item.full_name === selectedName
                    );

                    setForm((prev) => ({
                      ...prev,
                      volunteer_name: selectedName,
                      email: selectedVolunteer?.email || prev.email || "",
                      category: selectedVolunteer?.category || prev.category || "",
                    }));
                  }}
                  required
                >
                  <option value="">Select signed volunteer</option>
                  {volunteerOptions.map((item, index) => (
                    <option key={`${item.full_name}-${item.email || index}`} value={item.full_name}>
                      {item.full_name}{item.email ? ` (${item.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </label>

              <label>
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                  required
                >
                  <option value="">Select category</option>
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Serve Post</span>
                <select
                  value={form.serve_post_id}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, serve_post_id: e.target.value }))
                  }
                >
                  <option value="">Optional</option>
                  {servePostOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Date Served</span>
                <input
                  type="date"
                  value={form.date_served}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, date_served: e.target.value }))
                  }
                  required
                />
              </label>

              <label>
                <span>Start Time</span>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) =>
                    setForm((prev) => {
                      const next = { ...prev, start_time: e.target.value };
                      next.total_hours =
                        calculateHours(next.start_time, next.end_time) || next.total_hours;
                      return next;
                    })
                  }
                />
              </label>

              <label>
                <span>End Time</span>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) =>
                    setForm((prev) => {
                      const next = { ...prev, end_time: e.target.value };
                      next.total_hours =
                        calculateHours(next.start_time, next.end_time) || next.total_hours;
                      return next;
                    })
                  }
                />
              </label>

              <label>
                <span>Total Hours</span>
                <input
                  type="number"
                  step="0.25"
                  value={form.total_hours}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, total_hours: e.target.value }))
                  }
                  required
                />
              </label>

              <label className="asc-full">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </label>
            </div>

            <div className="asc-actions">
              <button type="button" className="asc-btn asc-btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="asc-btn asc-btn--primary" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Hours" : "Save Hours"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function VolunteerRecognitionModal({
  open,
  onClose,
  onSubmit,
  saving,
  form,
  setForm,
  volunteerOptions,
  editingId,
}) {
  if (!open) return null;

  return (
    <div className="asc-modal-backdrop" onClick={onClose}>
      <div className="asc-modal asc-modal--post" onClick={(e) => e.stopPropagation()}>
        <div className="asc-modal-header">
          <div>
            <p className="asc-eyebrow">Recognition</p>
            <h3>{editingId ? "Edit Recognition" : "Add Recognition"}</h3>
          </div>
          <button type="button" className="asc-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="asc-modal-body">
          <form className="asc-post-form" onSubmit={onSubmit}>
            <div className="asc-grid">
              <label>
                <span>Volunteer Name</span>
                <select
                  value={form.volunteer_name}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const selectedVolunteer = volunteerOptions.find(
                      (item) => item.full_name === selectedName
                    );

                    setForm((prev) => ({
                      ...prev,
                      volunteer_name: selectedName,
                      email: selectedVolunteer?.email || prev.email || "",
                    }));
                  }}
                  required
                >
                  <option value="">Select signed volunteer</option>
                  {volunteerOptions.map((item, index) => (
                    <option key={`${item.full_name}-${item.email || index}`} value={item.full_name}>
                      {item.full_name}{item.email ? ` (${item.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </label>

              <label>
                <span>Total Hours</span>
                <input
                  type="number"
                  step="0.25"
                  value={form.total_hours}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      total_hours: e.target.value,
                      recognition_level:
                        prev.recognition_level || suggestedLevel(e.target.value),
                    }))
                  }
                  required
                />
              </label>

              <label>
                <span>Recognition Level</span>
                <select
                  value={form.recognition_level}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, recognition_level: e.target.value }))
                  }
                  required
                >
                  <option value="">Select level</option>
                  {RECOGNITION_LEVELS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Approval Date</span>
                <input
                  type="date"
                  value={form.approval_date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, approval_date: e.target.value }))
                  }
                />
              </label>

              <label className="asc-check">
                <input
                  type="checkbox"
                  checked={!!form.board_approved}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, board_approved: e.target.checked }))
                  }
                />
                <span>Board Approved</span>
              </label>

              <label className="asc-full">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </label>
            </div>

            <div className="asc-actions">
              <button type="button" className="asc-btn asc-btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="asc-btn asc-btn--primary" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Recognition" : "Save Recognition"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CertificateModal({ open, onClose, volunteer }) {
  const [downloading, setDownloading] = useState(false);

  if (!open || !volunteer) return null;

  const filename = `${String(volunteer.volunteer_name || "volunteer")
    .replace(/\s+/g, "-")
    .toLowerCase()}-certificate.pdf`;

  async function handleDownload() {
    try {
      setDownloading(true);
     await generateCertificatePdf({
  filename:
    "volunteer-certificate.pdf",
});
    } catch (error) {
      console.error("Failed to generate certificate PDF:", error);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="asc-modal-backdrop" onClick={onClose}>
      <div className="asc-modal asc-modal--certificate" onClick={(e) => e.stopPropagation()}>
        <div className="asc-modal-header">
          <div>
            <p className="asc-eyebrow">Volunteer Certificate</p>
            <h3>{volunteer.volunteer_name}</h3>
          </div>
          <button type="button" className="asc-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="asc-modal-body">
          <div className="asc-certificate-preview">
            <VolunteerCertificateTemplate
              volunteerName={volunteer.volunteer_name}
              totalHours={Number(volunteer.total_hours || 0).toFixed(2)}
              recognitionLevel={volunteer.recognition_level}
              dateIssued={new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })}
            />
          </div>

          <div className="asc-actions">
            <button type="button" className="asc-btn asc-btn--ghost" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="asc-btn asc-btn--primary"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? "Generating PDF..." : "Download Certificate PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServePostsAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const menuWrapRef = useRef(null);

  const isApplicationsRoute = location.pathname.includes("/volunteer-applications");
  const isHoursRoute = location.pathname.includes("/volunteer-hours");
  const isSummaryRoute = location.pathname.includes("/volunteer-summary");
  const isRecognitionRoute = location.pathname.includes("/volunteer-recognition");

  const [mode, setMode] = useState(
    isApplicationsRoute
      ? "applications"
      : isHoursRoute
      ? "hours"
      : isSummaryRoute
      ? "summary"
      : isRecognitionRoute
      ? "recognition"
      : "posts"
  );

  const pageMeta = getPageMeta(mode);

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postSaving, setPostSaving] = useState(false);
  const [postSearch, setPostSearch] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [postForm, setPostForm] = useState({
    category: "",
    title: "",
    description: "",
    activity_date: "",
    start_time: "",
    end_time: "",
    location: "",
    notes: "",
    is_published: true,
  });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);

  const [hoursRows, setHoursRows] = useState([]);
  const [hoursLoading, setHoursLoading] = useState(true);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSearch, setHoursSearch] = useState("");
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [editingHoursId, setEditingHoursId] = useState(null);
  const [hoursForm, setHoursForm] = useState({
    volunteer_name: "",
    email: "",
    category: "",
    serve_post_id: "",
    date_served: "",
    start_time: "",
    end_time: "",
    total_hours: "",
    notes: "",
  });

  const [recognitionRows, setRecognitionRows] = useState([]);
  const [recognitionLoading, setRecognitionLoading] = useState(true);
  const [recognitionSaving, setRecognitionSaving] = useState(false);
  const [recognitionSearch, setRecognitionSearch] = useState("");
  const [showRecognitionModal, setShowRecognitionModal] = useState(false);
  const [editingRecognitionId, setEditingRecognitionId] = useState(null);
  const [recognitionForm, setRecognitionForm] = useState({
    volunteer_name: "",
    email: "",
    total_hours: "",
    recognition_level: "",
    board_approved: false,
    approval_date: "",
    notes: "",
  });

  const [certificateVolunteer, setCertificateVolunteer] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    setMode(
      isApplicationsRoute
        ? "applications"
        : isHoursRoute
        ? "hours"
        : isSummaryRoute
        ? "summary"
        : isRecognitionRoute
        ? "recognition"
        : "posts"
    );
  }, [isApplicationsRoute, isHoursRoute, isSummaryRoute, isRecognitionRoute]);

  useEffect(() => {
    fetchPosts();
    fetchRows();
    fetchHours();
    fetchRecognition();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!menuWrapRef.current) return;
      if (!menuWrapRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  function goToMode(nextMode) {
    setMode(nextMode);

    if (nextMode === "posts") return navigate("/dash/admin/serve-posts");
    if (nextMode === "applications") return navigate("/dash/admin/volunteer-applications");
    if (nextMode === "hours") return navigate("/dash/admin/volunteer-hours");
    if (nextMode === "summary") return navigate("/dash/admin/volunteer-summary");
    if (nextMode === "recognition") return navigate("/dash/admin/volunteer-recognition");
  }

  function resetPostForm() {
    setPostForm({
      category: "",
      title: "",
      description: "",
      activity_date: "",
      start_time: "",
      end_time: "",
      location: "",
      notes: "",
      is_published: true,
    });
    setEditingPostId(null);
  }

  function resetHoursForm() {
    setHoursForm({
      volunteer_name: "",
      email: "",
      category: "",
      serve_post_id: "",
      date_served: "",
      start_time: "",
      end_time: "",
      total_hours: "",
      notes: "",
    });
    setEditingHoursId(null);
  }

  function resetRecognitionForm() {
    setRecognitionForm({
      volunteer_name: "",
      email: "",
      total_hours: "",
      recognition_level: "",
      board_approved: false,
      approval_date: "",
      notes: "",
    });
    setEditingRecognitionId(null);
  }

  function closePostModal() {
    setShowPostModal(false);
    resetPostForm();
  }

  function closeHoursModal() {
    setShowHoursModal(false);
    resetHoursForm();
  }

  function closeRecognitionModal() {
    setShowRecognitionModal(false);
    resetRecognitionForm();
  }

  async function fetchPosts() {
    try {
      setPostsLoading(true);
      const { data } = await api.get("/admin/serve-posts");
      setPosts(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      console.error("Failed to load serve posts:", err);
    } finally {
      setPostsLoading(false);
    }
  }

  async function fetchRows() {
    try {
      setLoading(true);
      const { data } = await api.get("/admin/volunteer-applications");
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      console.error("Failed to load volunteer applications:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHours() {
    try {
      setHoursLoading(true);
      const { data } = await api.get("/admin/volunteer-hours");
      setHoursRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      console.error("Failed to load volunteer hours:", err);
    } finally {
      setHoursLoading(false);
    }
  }

  async function fetchRecognition() {
    try {
      setRecognitionLoading(true);
      const { data } = await api.get("/admin/volunteer-recognition");
      setRecognitionRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      console.error("Failed to load volunteer recognition:", err);
    } finally {
      setRecognitionLoading(false);
    }
  }

  async function handlePostSubmit(e) {
    e.preventDefault();

    try {
      setPostSaving(true);

      if (editingPostId) {
        await api.patch(`/admin/serve-posts/${editingPostId}`, postForm);
      } else {
        await api.post("/admin/serve-posts", postForm);
      }

      await fetchPosts();
      closePostModal();
    } catch (err) {
      console.error("Failed to save serve post:", err);
    } finally {
      setPostSaving(false);
    }
  }

  async function handleDeletePost(id) {
    try {
      await api.delete(`/admin/serve-posts/${id}`);
      await fetchPosts();
    } catch (err) {
      console.error("Failed to delete serve post:", err);
    }
  }

  async function handleSaveApplication(payload) {
    try {
      setSaving(true);
      await api.patch(`/admin/volunteer-applications/${payload.id}`, payload);
      await fetchRows();
      setSelected((prev) => (prev ? { ...prev, ...payload } : prev));
    } catch (err) {
      console.error("Failed to update application:", err);
    } finally {
      setSaving(false);
    }
  }

  async function quickUpdateApplication(row, nextStatus) {
    try {
      setOpenMenuId(null);
      await api.patch(`/admin/volunteer-applications/${row.id}`, {
        status: nextStatus,
      });
      await fetchRows();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  async function handleHoursSubmit(e) {
    e.preventDefault();

    try {
      setHoursSaving(true);

      const payload = {
        ...hoursForm,
        serve_post_id: hoursForm.serve_post_id || null,
      };

      if (editingHoursId) {
        await api.patch(`/admin/volunteer-hours/${editingHoursId}`, payload);
      } else {
        await api.post("/admin/volunteer-hours", payload);
      }

      await fetchHours();
      closeHoursModal();
    } catch (err) {
      console.error("Failed to save volunteer hours:", err);
    } finally {
      setHoursSaving(false);
    }
  }

  async function handleDeleteHours(id) {
    try {
      await api.delete(`/admin/volunteer-hours/${id}`);
      await fetchHours();
    } catch (err) {
      console.error("Failed to delete volunteer hours:", err);
    }
  }

  async function handleRecognitionSubmit(e) {
    e.preventDefault();

    try {
      setRecognitionSaving(true);

      if (editingRecognitionId) {
        await api.patch(`/admin/volunteer-recognition/${editingRecognitionId}`, recognitionForm);
      } else {
        await api.post("/admin/volunteer-recognition", recognitionForm);
      }

      await fetchRecognition();
      closeRecognitionModal();
    } catch (err) {
      console.error("Failed to save volunteer recognition:", err);
    } finally {
      setRecognitionSaving(false);
    }
  }

  async function handleDeleteRecognition(id) {
    try {
      await api.delete(`/admin/volunteer-recognition/${id}`);
      await fetchRecognition();
    } catch (err) {
      console.error("Failed to delete volunteer recognition:", err);
    }
  }

  const filteredPosts = useMemo(() => {
    const q = postSearch.trim().toLowerCase();
    if (!q) return posts;

    return posts.filter((row) => {
      return (
        row.category?.toLowerCase().includes(q) ||
        row.title?.toLowerCase().includes(q) ||
        row.description?.toLowerCase().includes(q) ||
        row.location?.toLowerCase().includes(q)
      );
    });
  }, [posts, postSearch]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        row.full_name?.toLowerCase().includes(q) ||
        row.email?.toLowerCase().includes(q) ||
        row.category?.toLowerCase().includes(q) ||
        row.role?.toLowerCase().includes(q) ||
        row.activity_title?.toLowerCase().includes(q);

      const matchesStatus = !status || row.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, status]);

  const volunteerOptions = useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const key = `${row.full_name || ""}|${row.email || ""}`;
      if (!row.full_name || map.has(key)) return;
      map.set(key, {
        full_name: row.full_name,
        email: row.email || "",
        category: row.category || "",
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  }, [rows]);

  const filteredHoursRows = useMemo(() => {
    const q = hoursSearch.trim().toLowerCase();
    if (!q) return hoursRows;

    return hoursRows.filter((row) => {
      return (
        row.volunteer_name?.toLowerCase().includes(q) ||
        row.email?.toLowerCase().includes(q) ||
        row.category?.toLowerCase().includes(q)
      );
    });
  }, [hoursRows, hoursSearch]);

  const filteredRecognitionRows = useMemo(() => {
    const q = recognitionSearch.trim().toLowerCase();
    if (!q) return recognitionRows;

    return recognitionRows.filter((row) => {
      return (
        row.volunteer_name?.toLowerCase().includes(q) ||
        row.email?.toLowerCase().includes(q) ||
        row.recognition_level?.toLowerCase().includes(q)
      );
    });
  }, [recognitionRows, recognitionSearch]);

  const volunteerSummaryRows = useMemo(() => {
    const map = new Map();

    hoursRows.forEach((row) => {
      const key = `${row.volunteer_name || ""}|${row.email || ""}`;
      const existing = map.get(key) || {
        volunteer_name: row.volunteer_name || "—",
        email: row.email || "",
        total_hours: 0,
        last_served: row.date_served || null,
        categories: new Set(),
      };

      existing.total_hours += Number(row.total_hours || 0);

      if (row.date_served) {
        if (!existing.last_served || new Date(row.date_served) > new Date(existing.last_served)) {
          existing.last_served = row.date_served;
        }
      }

      if (row.category) {
        existing.categories.add(row.category);
      }

      map.set(key, existing);
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        total_hours: Number(item.total_hours.toFixed(2)),
        categories_served: Array.from(item.categories).join(", "),
        recognition_level: suggestedLevel(item.total_hours),
      }))
      .sort((a, b) => b.total_hours - a.total_hours);
  }, [hoursRows]);

  const totalSubmittedHours = useMemo(() => {
    return hoursRows.reduce((sum, row) => sum + Number(row.total_hours || 0), 0).toFixed(2);
  }, [hoursRows]);

  const activeVolunteersCount = useMemo(() => volunteerSummaryRows.length, [volunteerSummaryRows]);

  const topPerformer = useMemo(() => {
    return volunteerSummaryRows[0]?.volunteer_name || "—";
  }, [volunteerSummaryRows]);

  const categoryChartRows = useMemo(() => {
    const counts = {};

    hoursRows.forEach((row) => {
      const key = row.category || "Other";
      counts[key] = (counts[key] || 0) + Number(row.total_hours || 0);
    });

    const values = Object.entries(counts)
      .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const max = values[0]?.total || 1;

    return values.map((item) => ({
      ...item,
      width: `${Math.max(16, (item.total / max) * 100)}%`,
    }));
  }, [hoursRows]);

  return (
    <div className="asc-page" ref={menuWrapRef}>
      <section className="asc-hero">
        <div>
          <p className="asc-eyebrow">Administration</p>
          <h1 className="asc-title">{pageMeta.title}</h1>
          <p className="asc-subtitle">{pageMeta.subtitle}</p>
        </div>

        <div className="asc-hero-stats">
          <div className="asc-stat-card">
            <strong>{posts.length}</strong>
            <span>Serve Posts</span>
          </div>
          <div className="asc-stat-card">
            <strong>{rows.length}</strong>
            <span>Applications</span>
          </div>
          <div className="asc-stat-card">
            <strong>{rows.filter((r) => r.status === "new").length}</strong>
            <span>New</span>
          </div>
        </div>
      </section>

      <section className="asc-switcher">
        <button
          type="button"
          className={`asc-switch-btn ${mode === "posts" ? "active" : ""}`}
          onClick={() => goToMode("posts")}
        >
          Serve Posts
        </button>

        <button
          type="button"
          className={`asc-switch-btn ${mode === "applications" ? "active" : ""}`}
          onClick={() => goToMode("applications")}
        >
          Volunteer Applications
        </button>

        <button
          type="button"
          className={`asc-switch-btn ${mode === "hours" ? "active" : ""}`}
          onClick={() => goToMode("hours")}
        >
          Volunteer Hours
        </button>

        <button
          type="button"
          className={`asc-switch-btn ${mode === "summary" ? "active" : ""}`}
          onClick={() => goToMode("summary")}
        >
          Volunteer Summary
        </button>

        <button
          type="button"
          className={`asc-switch-btn ${mode === "recognition" ? "active" : ""}`}
          onClick={() => goToMode("recognition")}
        >
          Recognition
        </button>
      </section>

      {mode === "posts" && (
        <>
          <section className="asc-toolbar">
            <div className="asc-toolbar-left">
              <input
                type="text"
                className="asc-search"
                placeholder="Search posts..."
                value={postSearch}
                onChange={(e) => setPostSearch(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="asc-btn asc-btn--primary"
              onClick={() => {
                resetPostForm();
                setShowPostModal(true);
              }}
            >
              Add New Serve Post
            </button>
          </section>

          <section className="asc-card">
            <div className="asc-card-head">
              <h2>Existing Serve Posts</h2>
            </div>

            <div className="asc-table-wrap">
              <table className="asc-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Title</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Published</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {postsLoading ? (
                    <tr>
                      <td colSpan="7" className="asc-empty-cell">
                        Loading serve posts...
                      </td>
                    </tr>
                  ) : filteredPosts.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="asc-empty-cell">
                        No serve posts found.
                      </td>
                    </tr>
                  ) : (
                    filteredPosts.map((row) => (
                      <tr key={row.id}>
                        <td>{row.category}</td>
                        <td>{row.title}</td>
                        <td>{formatDate(row.activity_date)}</td>
                        <td>{row.start_time} - {row.end_time}</td>
                        <td>{row.location}</td>
                        <td>{row.is_published ? "Yes" : "No"}</td>
                        <td className="asc-actions-cell">
                          <RowActionMenu
                            row={row}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            label={`Actions for ${row.title}`}
                            actions={[
                              {
                                label: "Edit",
                                onClick: (item) => {
                                  setOpenMenuId(null);
                                  setEditingPostId(item.id);
                                  setPostForm({
                                    category: item.category || "",
                                    title: item.title || "",
                                    description: item.description || "",
                                    activity_date: item.activity_date || "",
                                    start_time: item.start_time || "",
                                    end_time: item.end_time || "",
                                    location: item.location || "",
                                    notes: item.notes || "",
                                    is_published: !!item.is_published,
                                  });
                                  setShowPostModal(true);
                                },
                              },
                              {
                                label: "Delete",
                                danger: true,
                                onClick: (item) => {
                                  setOpenMenuId(null);
                                  handleDeletePost(item.id);
                                },
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {mode === "applications" && (
        <>
          <section className="asc-toolbar">
            <div className="asc-toolbar-left">
              <input
                type="text"
                className="asc-search"
                placeholder="Search by applicant, category, role, activity, or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="asc-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button type="button" className="asc-btn asc-btn--primary" onClick={fetchRows}>
              Refresh
            </button>
          </section>

          <section className="asc-card">
            <div className="asc-table-wrap">
              <table className="asc-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Category</th>
                    <th>Role</th>
                    <th>Activity</th>
                    <th>Activity Date / Time</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th className="asc-actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="asc-empty-cell">
                        Loading volunteer applications...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="asc-empty-cell">
                        No volunteer applications found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="asc-person-cell">
                            <strong>{row.full_name || "—"}</strong>
                            <span>{row.email || "—"}</span>
                          </div>
                        </td>
                        <td>{row.category || "—"}</td>
                        <td>{row.role || "—"}</td>
                        <td>{row.activity_title || "General role application"}</td>
                        <td>
                          {formatDateTime(
                            row.activity_date,
                            row.activity_start_time,
                            row.activity_end_time
                          )}
                        </td>
                        <td>{formatDate(row.created_at)}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="asc-actions-cell">
                          <RowActionMenu
                            row={row}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            label={`Actions for ${row.full_name}`}
                            actions={[
                              {
                                label: "View details",
                                onClick: (item) => {
                                  setOpenMenuId(null);
                                  setSelected(item);
                                },
                              },
                              {
                                label: "Approve",
                                onClick: (item) => {
                                  setOpenMenuId(null);
                                  quickUpdateApplication(item, "approved");
                                },
                              },
                              {
                                label: "Request info",
                                onClick: (item) => {
                                  setOpenMenuId(null);
                                  setSelected({ ...item, status: "request_info" });
                                },
                              },
                              {
                                label: "Decline",
                                danger: true,
                                onClick: (item) => {
                                  setOpenMenuId(null);
                                  setSelected({ ...item, status: "declined" });
                                },
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {mode === "hours" && (
        <>
          <section className="asc-toolbar">
            <div className="asc-toolbar-left">
              <input
                type="text"
                className="asc-search"
                placeholder="Search volunteer hours..."
                value={hoursSearch}
                onChange={(e) => setHoursSearch(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="asc-btn asc-btn--primary"
              onClick={() => {
                resetHoursForm();
                setShowHoursModal(true);
              }}
            >
              Add Hours
            </button>
          </section>

          <section className="asc-card">
            <div className="asc-table-wrap">
              <table className="asc-table">
                <thead>
                  <tr>
                    <th>Volunteer</th>
                    <th>Category</th>
                    <th>Date Served</th>
                    <th>Time</th>
                    <th>Total Hours</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hoursLoading ? (
                    <tr>
                      <td colSpan="7" className="asc-empty-cell">
                        Loading volunteer hours...
                      </td>
                    </tr>
                  ) : filteredHoursRows.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="asc-empty-cell">
                        No volunteer hours found.
                      </td>
                    </tr>
                  ) : (
                    filteredHoursRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="asc-person-cell">
                            <strong>{row.volunteer_name}</strong>
                            <span>{row.email || "—"}</span>
                          </div>
                        </td>
                        <td>{row.category}</td>
                        <td>{formatDate(row.date_served)}</td>
                        <td>{(row.start_time || "—") + " - " + (row.end_time || "—")}</td>
                        <td>{Number(row.total_hours || 0).toFixed(2)}</td>
                        <td>{row.notes || "—"}</td>
                        <td className="asc-actions-cell">
                          <RowActionMenu
                            row={row}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            label={`Actions for ${row.volunteer_name}`}
                            actions={[
                              {
                                label: "Edit",
                                onClick: (item) => {
                                  setOpenMenuId(null);
                                  setEditingHoursId(item.id);
                                  setHoursForm({
                                    volunteer_name: item.volunteer_name || "",
                                    email: item.email || "",
                                    category: item.category || "",
                                    serve_post_id: item.serve_post_id || "",
                                    date_served: item.date_served || "",
                                    start_time: item.start_time || "",
                                    end_time: item.end_time || "",
                                    total_hours: String(item.total_hours || ""),
                                    notes: item.notes || "",
                                  });
                                  setShowHoursModal(true);
                                },
                              },
                              {
                                label: "Delete",
                                danger: true,
                                onClick: (item) => {
                                  setOpenMenuId(null);
                                  handleDeleteHours(item.id);
                                },
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {mode === "summary" && (
        <>
          <section className="asc-summary-grid">
            <div className="asc-summary-card">
              <span>Total Submitted Hours</span>
              <strong>{totalSubmittedHours}</strong>
              <small>All volunteer hour entries combined</small>
            </div>

            <div className="asc-summary-card">
              <span>Active Volunteers</span>
              <strong>{activeVolunteersCount}</strong>
              <small>Unique volunteers with submitted hours</small>
            </div>

            <div className="asc-summary-card">
              <span>Top Volunteer</span>
              <strong>{topPerformer}</strong>
              <small>Highest lifetime total so far</small>
            </div>

            <div className="asc-summary-card">
              <span>Recognition Ready</span>
              <strong>
                {volunteerSummaryRows.filter((row) => row.total_hours >= 10).length}
              </strong>
              <small>Volunteers with Bronze+ eligibility</small>
            </div>
          </section>

          <section className="asc-summary-layout">
            <div className="asc-card">
              <div className="asc-card-head">
                <h2>Hours by Category</h2>
              </div>

              <div className="asc-chart-list">
                {categoryChartRows.length === 0 ? (
                  <div className="asc-empty-cell">No chart data available yet.</div>
                ) : (
                  categoryChartRows.map((item) => (
                    <div key={item.category} className="asc-chart-row">
                      <div className="asc-chart-labels">
                        <span>{item.category}</span>
                        <strong>{item.total.toFixed(2)} hrs</strong>
                      </div>
                      <div className="asc-chart-track">
                        <div className="asc-chart-bar" style={{ width: item.width }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="asc-card">
              <div className="asc-card-head">
                <h2>Recognition Suggestions</h2>
              </div>

              <div className="asc-suggestion-list">
                {volunteerSummaryRows.slice(0, 6).map((row, idx) => (
                  <div key={`${row.volunteer_name}-${idx}`} className="asc-suggestion-item">
                    <div>
                      <strong>{row.volunteer_name}</strong>
                      <p>{row.total_hours.toFixed(2)} total hours</p>
                    </div>
                    <SummaryLevelBadge level={row.recognition_level} />
                  </div>
                ))}

                {!volunteerSummaryRows.length ? (
                  <div className="asc-empty-cell">No volunteer summary data available.</div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="asc-card">
            <div className="asc-card-head">
              <h2>Volunteer Leaderboard</h2>
            </div>

            <div className="asc-table-wrap">
              <table className="asc-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Volunteer</th>
                    <th>Email</th>
                    <th>Total Hours</th>
                    <th>Last Served</th>
                    <th>Categories Served</th>
                    <th>Suggested Level</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {volunteerSummaryRows.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="asc-empty-cell">
                        No summary records found.
                      </td>
                    </tr>
                  ) : (
                    volunteerSummaryRows.map((row, index) => (
                      <tr key={`${row.volunteer_name}-${index}`}>
                        <td>{index + 1}</td>
                        <td>{row.volunteer_name}</td>
                        <td>{row.email || "—"}</td>
                        <td>{row.total_hours.toFixed(2)}</td>
                        <td>{formatDate(row.last_served)}</td>
                        <td>{row.categories_served || "—"}</td>
                        <td>
                          <SummaryLevelBadge level={row.recognition_level} />
                        </td>
                        <td className="asc-actions-cell">
                          <RowActionMenu
                            row={row}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            idKey="volunteer_name"
                            label={`Actions for ${row.volunteer_name}`}
                            actions={[
                              {
                                label: "Generate Certificate",
                                onClick: (item) => {
                                  setOpenMenuId(null);
                                  setCertificateVolunteer(item);
                                },
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}


{mode === "recognition" && (
  <>
    <section className="asc-toolbar">
      <div className="asc-toolbar-left">
        <input
          type="text"
          className="asc-search"
          placeholder="Search recognition..."
          value={recognitionSearch}
          onChange={(e) => setRecognitionSearch(e.target.value)}
        />
      </div>

      <div className="asc-toolbar-right">
        <button
          type="button"
          className="asc-btn asc-btn--ghost"
          onClick={async () => {
            try {
              const { data } = await api.get(
                "/admin/volunteer-recognition/auto/preview"
              );

              const previewRows = Array.isArray(data?.rows) ? data.rows : [];
              const names = previewRows
                .slice(0, 10)
                .map(
                  (row) =>
                    `${row.volunteer_name} — ${Number(
                      row.total_hours || 0
                    ).toFixed(2)} hrs — ${row.recognition_level}`
                )
                .join("\n");

              window.alert(
                previewRows.length
                  ? `Eligible volunteers:\n\n${names}${
                      previewRows.length > 10
                        ? `\n\n+ ${previewRows.length - 10} more`
                        : ""
                    }`
                  : "No volunteers are currently eligible for auto recognition."
              );
            } catch (err) {
              console.error("Failed to preview recognition:", err);
              window.alert("Failed to preview eligible volunteers.");
            }
          }}
        >
          Preview Eligible
        </button>

        <button
          type="button"
          className="asc-btn asc-btn--ghost"
          onClick={async () => {
            try {
              await api.post("/admin/volunteer-recognition/auto/sync");
              await fetchRecognition();
              window.alert("Auto recognition sync completed.");
            } catch (err) {
              console.error("Failed to sync recognition:", err);
              window.alert("Failed to sync recognition.");
            }
          }}
        >
          Auto Sync Recognition
        </button>

        <button
          type="button"
          className="asc-btn asc-btn--ghost"
          onClick={fetchRecognition}
        >
          Refresh
        </button>

        <button
          type="button"
          className="asc-btn asc-btn--primary"
          onClick={() => {
            resetRecognitionForm();
            setShowRecognitionModal(true);
          }}
        >
          Add Recognition
        </button>
      </div>
    </section>

    <section className="asc-card">
      <div className="asc-card-head">
        <h2>Recognition Records</h2>
      </div>

      <div className="asc-table-wrap">
        <table className="asc-table">
          <thead>
            <tr>
              <th>Volunteer</th>
              <th>Total Hours</th>
              <th>Level</th>
              <th>Board Approved</th>
              <th>Approval Date</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recognitionLoading ? (
              <tr>
                <td colSpan="7" className="asc-empty-cell">
                  Loading recognition records...
                </td>
              </tr>
            ) : filteredRecognitionRows.length === 0 ? (
              <tr>
                <td colSpan="7" className="asc-empty-cell">
                  No recognition records found.
                </td>
              </tr>
            ) : (
              filteredRecognitionRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="asc-person-cell">
                      <strong>{row.volunteer_name}</strong>
                      <span>{row.email || "—"}</span>
                    </div>
                  </td>
                  <td>{Number(row.total_hours || 0).toFixed(2)}</td>
                  <td>{row.recognition_level}</td>
                  <td>{row.board_approved ? "Yes" : "No"}</td>
                  <td>{formatDate(row.approval_date)}</td>
                  <td>{row.notes || "—"}</td>
                  <td className="asc-actions-cell">
                    <RowActionMenu
                      row={row}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      label={`Actions for ${row.volunteer_name}`}
                      actions={[
                        {
                          label: "Edit",
                          onClick: (item) => {
                            setOpenMenuId(null);
                            setEditingRecognitionId(item.id);
                            setRecognitionForm({
                              volunteer_name: item.volunteer_name || "",
                              email: item.email || "",
                              total_hours: String(item.total_hours || ""),
                              recognition_level: item.recognition_level || "",
                              board_approved: !!item.board_approved,
                              approval_date: item.approval_date || "",
                              notes: item.notes || "",
                            });
                            setShowRecognitionModal(true);
                          },
                        },
                        {
                          label: "Generate Certificate",
                          onClick: (item) => {
                            setOpenMenuId(null);
                            setCertificateVolunteer({
                              volunteer_name: item.volunteer_name,
                              email: item.email,
                              total_hours: item.total_hours,
                              recognition_level:
                                item.recognition_level ||
                                suggestedLevel(item.total_hours),
                            });
                          },
                        },
                        {
                          label: "Delete",
                          danger: true,
                          onClick: async (item) => {
                            setOpenMenuId(null);
                            await handleDeleteRecognition(item.id);
                          },
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  </>
)}

      <ServePostModal
        open={showPostModal}
        onClose={closePostModal}
        onSubmit={handlePostSubmit}
        saving={postSaving}
        form={postForm}
        setForm={setPostForm}
        editingId={editingPostId}
        onCancelEdit={closePostModal}
      />

      <VolunteerModal
        item={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onSave={handleSaveApplication}
        saving={saving}
      />

      <VolunteerHoursModal
        open={showHoursModal}
        onClose={closeHoursModal}
        onSubmit={handleHoursSubmit}
        saving={hoursSaving}
        form={hoursForm}
        setForm={setHoursForm}
        volunteerOptions={volunteerOptions}
        servePostOptions={posts}
        editingId={editingHoursId}
      />

      <VolunteerRecognitionModal
        open={showRecognitionModal}
        onClose={closeRecognitionModal}
        onSubmit={handleRecognitionSubmit}
        saving={recognitionSaving}
        form={recognitionForm}
        setForm={setRecognitionForm}
        volunteerOptions={volunteerOptions}
        editingId={editingRecognitionId}
      />

      <CertificateModal
        open={!!certificateVolunteer}
        onClose={() => setCertificateVolunteer(null)}
        volunteer={certificateVolunteer}
      />
    </div>
  );
}