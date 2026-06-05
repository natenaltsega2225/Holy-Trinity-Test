 //frontend\src\components\AdminDashboard\FormsAdmin.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import "../../../styles/admin-forms-manager.css";

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const rowStatusOptions = statusOptions.filter((item) => item.value);

const categoryOptions = [
  { value: "", label: "All" },
  { value: "spiritual", label: "Spiritual" },
  { value: "service", label: "Service" },
  { value: "programs", label: "Programs" },
  { value: "incident", label: "Incident" },
  { value: "finance", label: "Finance" },
];

function ActionMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleOutside(event) {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="admin-kebab-wrap" ref={wrapRef}>
      <button
        type="button"
        className="admin-kebab-btn"
        aria-label="Open actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <div className="admin-kebab-menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`admin-kebab-item ${item.danger ? "admin-kebab-item-danger" : ""}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  if (!value) return "";
  const raw = String(value).slice(0, 10);
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw || String(value);
  return d.toLocaleDateString("en-US");
}

function formatTimeOnly(value) {
  if (!value) return "";
  const raw = String(value).slice(0, 5);
  const parts = raw.split(":");
  if (parts.length < 2) return raw;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return raw;

  const temp = new Date();
  temp.setHours(hours, minutes, 0, 0);

  return temp.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtSchedule(date, time) {
  const formattedDate = formatDateOnly(date);
  const formattedTime = formatTimeOnly(time);

  if (!formattedDate && !formattedTime) return "--";
  if (formattedDate && formattedTime) return `${formattedDate} ${formattedTime}`;
  return formattedDate || formattedTime || "--";
}

function statusClass(status) {
  const v = String(status || "").toLowerCase();
  if (v === "pending") return "forms-admin-status forms-admin-status-new";
  if (v === "in_review") return "forms-admin-status forms-admin-status-in_review";
  if (v === "approved") return "forms-admin-status forms-admin-status-approved";
  if (v === "scheduled") return "forms-admin-status forms-admin-status-approved";
  if (v === "rejected") return "forms-admin-status forms-admin-status-rejected";
  if (v === "completed" || v === "cancelled") {
    return "forms-admin-status forms-admin-status-closed";
  }
  return "forms-admin-status forms-admin-status-new";
}

function normalizePhoneInput(v) {
  return String(v ?? "").replace(/\D/g, "").slice(0, 11);
}

export default function FormsAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [savingRowId, setSavingRowId] = useState(null);
  const [editForm, setEditForm] = useState({
    submitted_by: "",
    email: "",
    phone: "",
    status: "pending",
    notes: "",
    admin_notes: "",
    admin_explanation: "",
    scheduled_date: "",
    scheduled_time: "",
  });

  const [filters, setFilters] = useState({
    search: "",
    category: "",
    status: "",
    page: 1,
    pageSize: 10,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(filters.page));
    p.set("pageSize", String(filters.pageSize));
    if (filters.search) p.set("search", filters.search);
    if (filters.category) p.set("category", filters.category);
    if (filters.status) p.set("status", filters.status);
    return p.toString();
  }, [filters]);

  async function loadRows() {
    try {
      setLoading(true);
      const { data } = await api.get(`/forms/admin/submissions?${queryString}`);
      setRows(data.rows || []);
      setPagination(
        data.pagination || {
          page: Number(data.page || 1),
          pageSize: Number(data.limit || filters.pageSize || 10),
          total: Number(data.total || 0),
          totalPages: Number(data.totalPages || 1),
        }
      );
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id) {
    try {
      const { data } = await api.get(`/forms/admin/submissions/${id}`);
      setDetailItem(data.row || null);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to load details.");
    }
  }

  async function openEdit(id) {
    try {
      const { data } = await api.get(`/forms/admin/submissions/${id}`);
      const row = data.row || null;

      const normalizedDate =
        row?.scheduled_date ? String(row.scheduled_date).slice(0, 10) : "";

      const normalizedTime =
        row?.scheduled_time ? String(row.scheduled_time).slice(0, 5) : "";

      setEditItem(row);
      setEditForm({
        submitted_by: row?.submitted_by || "",
        email: row?.email || "",
        phone: row?.phone || "",
        status: row?.status || "pending",
        notes: row?.notes || "",
        admin_notes: row?.admin_notes || "",
        admin_explanation: row?.admin_explanation || "",
        scheduled_date: normalizedDate,
        scheduled_time: normalizedTime,
      });
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to load edit data.");
    }
  }

  async function saveEdit() {
    if (!editItem?.id) return;

    try {
      await api.patch(`/forms/admin/submissions/${editItem.id}`, editForm);
      setEditItem(null);
      await loadRows();
      if (detailItem?.id === editItem.id) {
        await openDetail(editItem.id);
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to save changes.");
    }
  }

  async function updateStatus(id, status) {
    try {
      setSavingRowId(id);
      await api.patch(`/forms/admin/submissions/${id}/status`, { status });

      setRows((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, status } : row
        )
      );

      if (detailItem?.id === id) {
        setDetailItem((prev) => (prev ? { ...prev, status } : prev));
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to update status.");
      await loadRows();
    } finally {
      setSavingRowId(null);
    }
  }

  async function deleteRow(id) {
    const ok = window.confirm("Delete this submission?");
    if (!ok) return;

    try {
      await api.delete(`/forms/admin/submissions/${id}`);
      if (detailItem?.id === id) setDetailItem(null);
      if (editItem?.id === id) setEditItem(null);
      await loadRows();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to delete submission.");
    }
  }

  useEffect(() => {
    loadRows();
  }, [queryString]);

  return (
    <div className="forms-admin-page">
      <div className="forms-admin-shell">
        <div className="forms-admin-header">
          <div>
            <h1>Submitted Forms</h1>
            <p>
              Review submitted church requests, update status, add notes,
              explanations, and scheduling details.
            </p>
          </div>
        </div>

        <div className="forms-admin-toolbar">
          <div className="forms-admin-search">
            <span>🔍</span>
            <input
              value={filters.search}
              onChange={(e) =>
                setFilters((s) => ({ ...s, search: e.target.value, page: 1 }))
              }
              placeholder="Search by form, member, email, phone, notes..."
            />
          </div>

          <div className="forms-admin-filters">
            {categoryOptions.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`forms-admin-chip ${
                  filters.category === item.value ? "forms-admin-chip-active" : ""
                }`}
                onClick={() =>
                  setFilters((s) => ({ ...s, category: item.value, page: 1 }))
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="forms-admin-filters">
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((s) => ({ ...s, status: e.target.value, page: 1 }))
              }
              className="forms-admin-chip"
            >
              {statusOptions.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="forms-admin-table-wrap">
          <div className="forms-admin-topbar-row">
            <div className="forms-admin-page-size">
              <label>Rows per page</label>
              <select
                value={filters.pageSize}
                onChange={(e) =>
                  setFilters((s) => ({
                    ...s,
                    pageSize: Number(e.target.value),
                    page: 1,
                  }))
                }
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="forms-admin-order-note">
              Showing newest submissions first
            </div>
          </div>

          <table className="forms-admin-table">
            <thead>
              <tr>
                <th className="col-form">Form</th>
                <th className="col-category">Category</th>
                <th className="col-name">Name</th>
                <th className="col-email">Email</th>
                <th className="col-phone">Phone</th>
                <th className="col-date">Submitted</th>
                <th className="col-status">Status</th>
                <th className="col-date">Schedule</th>
                <th className="col-attachment">Attachment</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="forms-admin-empty" colSpan={10}>
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="forms-admin-empty" colSpan={10}>
                    No submissions found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.form_name}</strong>
                      <div>{row.form_key}</div>
                    </td>
                    <td>
                      <span className="forms-admin-category">{row.category}</span>
                    </td>
                    <td>{row.submitted_by || "--"}</td>
                    <td>{row.email || "--"}</td>
                    <td>{row.phone || "--"}</td>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td>
                      <select
                        value={row.status || "pending"}
                        disabled={savingRowId === row.id}
                        onChange={(e) => updateStatus(row.id, e.target.value)}
                        style={{
                          minWidth: "140px",
                          border: "1px solid #cfd9e7",
                          borderRadius: "10px",
                          padding: "8px 10px",
                          background: "#fff",
                          color: "#133a74",
                          fontWeight: 700,
                        }}
                      >
                        {rowStatusOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{fmtSchedule(row.scheduled_date, row.scheduled_time)}</td>
                    <td>
                      {row.attachment_url ? (
                        <a href={row.attachment_url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        "--"
                      )}
                    </td>
                    <td>
                      <div className="forms-admin-actions">
                        <ActionMenu
                          items={[
                            { label: "View", onClick: () => openDetail(row.id) },
                            { label: "Edit Details", onClick: () => openEdit(row.id) },
                            {
                              label: "Delete",
                              danger: true,
                              onClick: () => deleteRow(row.id),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="forms-admin-cards">
            {loading ? (
              <div className="forms-admin-empty-card">Loading...</div>
            ) : rows.length === 0 ? (
              <div className="forms-admin-empty-card">No submissions found.</div>
            ) : (
              rows.map((row) => (
                <div className="forms-admin-card" key={row.id}>
                  <div className="forms-admin-card-head">
                    <div>
                      <h3>{row.form_name}</h3>
                    </div>
                    <select
                      value={row.status || "pending"}
                      disabled={savingRowId === row.id}
                      onChange={(e) => updateStatus(row.id, e.target.value)}
                      style={{
                        minWidth: "140px",
                        border: "1px solid #cfd9e7",
                        borderRadius: "10px",
                        padding: "8px 10px",
                        background: "#fff",
                        color: "#133a74",
                        fontWeight: 700,
                      }}
                    >
                      {rowStatusOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="forms-admin-card-grid">
                    <div>
                      <span className="forms-admin-card-label">Category</span>
                      <span className="forms-admin-category">{row.category}</span>
                    </div>
                    <div>
                      <span className="forms-admin-card-label">Name</span>
                      <div>{row.submitted_by || "--"}</div>
                    </div>
                    <div>
                      <span className="forms-admin-card-label">Email</span>
                      <div>{row.email || "--"}</div>
                    </div>
                    <div>
                      <span className="forms-admin-card-label">Phone</span>
                      <div>{row.phone || "--"}</div>
                    </div>
                    <div>
                      <span className="forms-admin-card-label">Submitted</span>
                      <div>{formatDateTime(row.created_at)}</div>
                    </div>
                    <div>
                      <span className="forms-admin-card-label">Schedule</span>
                      <div>{fmtSchedule(row.scheduled_date, row.scheduled_time)}</div>
                    </div>
                    <div>
                      <span className="forms-admin-card-label">Attachment</span>
                      <div>
                        {row.attachment_url ? (
                          <a href={row.attachment_url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        ) : (
                          "--"
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="forms-admin-actions forms-admin-actions-mobile">
                    <ActionMenu
                      items={[
                        { label: "View", onClick: () => openDetail(row.id) },
                        { label: "Edit Details", onClick: () => openEdit(row.id) },
                        {
                          label: "Delete",
                          danger: true,
                          onClick: () => deleteRow(row.id),
                        },
                      ]}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="forms-admin-pagination">
            <button
              className="forms-admin-pagination-btn"
              disabled={pagination.page <= 1}
              onClick={() =>
                setFilters((s) => ({ ...s, page: Math.max(1, s.page - 1) }))
              }
            >
              Previous
            </button>

            <div className="forms-admin-pagination-status">
              {pagination.page} / {pagination.totalPages || 1}
            </div>

            <button
              className="forms-admin-pagination-btn"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                setFilters((s) => ({
                  ...s,
                  page: Math.min(pagination.totalPages || 1, s.page + 1),
                }))
              }
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {detailItem ? (
        <>
          <div
            className="forms-admin-drawer-backdrop"
            onClick={() => setDetailItem(null)}
          />
          <aside className="forms-admin-drawer">
            <div className="forms-admin-drawer-head">
              <div>
                <span className="forms-admin-drawer-label">{detailItem.category}</span>
                <h2>{detailItem.form_name}</h2>
              </div>
              <button
                type="button"
                className="forms-admin-close"
                onClick={() => setDetailItem(null)}
              >
                ×
              </button>
            </div>

            <div className="forms-admin-drawer-section">
              <div className="forms-admin-detail-grid">
                <div><strong>Name:</strong> {detailItem.submitted_by || "--"}</div>
                <div><strong>Email:</strong> {detailItem.email || "--"}</div>
                <div><strong>Phone:</strong> {detailItem.phone || "--"}</div>
                <div><strong>Status:</strong> {detailItem.status || "--"}</div>
                <div><strong>Created At:</strong> {formatDateTime(detailItem.created_at)}</div>
                <div><strong>Scheduled:</strong> {fmtSchedule(detailItem.scheduled_date, detailItem.scheduled_time)}</div>
                <div><strong>Admin Notes:</strong> {detailItem.admin_notes || "--"}</div>
                <div><strong>Admin Explanation:</strong> {detailItem.admin_explanation || "--"}</div>
                <div>
                  <strong>Attachment:</strong>{" "}
                  {detailItem.attachment_url ? (
                    <a href={detailItem.attachment_url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : (
                    "--"
                  )}
                </div>
              </div>
            </div>

            <div className="forms-admin-payload">
              <h3>Submission Payload</h3>
              <pre>{JSON.stringify(detailItem.payload_json || {}, null, 2)}</pre>
            </div>
          </aside>
        </>
      ) : null}

      {editItem ? (
        <div className="forms-admin-modal-overlay">
          <div className="forms-admin-modal forms-admin-edit-modal">
            <div className="forms-admin-modal-head">
              <div>
                <h2>Edit Submission</h2>
                <p>Update request status, admin notes, explanation, and schedule.</p>
              </div>
              <button
                type="button"
                className="forms-admin-close"
                onClick={() => setEditItem(null)}
              >
                ×
              </button>
            </div>

            <div className="forms-admin-edit-grid">
              <div>
                <label>Submitted By</label>
                <input
                  value={editForm.submitted_by}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, submitted_by: e.target.value }))
                  }
                />
              </div>

              <div>
                <label>Email</label>
                <input
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, email: e.target.value }))
                  }
                />
              </div>

              <div>
                <label>Phone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((s) => ({
                      ...s,
                      phone: normalizePhoneInput(e.target.value),
                    }))
                  }
                  inputMode="numeric"
                  maxLength={11}
                />
              </div>

              <div>
                <label>Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, status: e.target.value }))
                  }
                >
                  {rowStatusOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Scheduled Date</label>
                <input
                  type="date"
                  value={editForm.scheduled_date}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, scheduled_date: e.target.value }))
                  }
                />
              </div>

              <div>
                <label>Scheduled Time</label>
                <input
                  type="time"
                  value={editForm.scheduled_time}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, scheduled_time: e.target.value }))
                  }
                />
              </div>

              <div className="full-span">
                <label>Internal Notes</label>
                <textarea
                  rows="3"
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, notes: e.target.value }))
                  }
                />
              </div>

              <div className="full-span">
                <label>Admin Notes</label>
                <textarea
                  rows="4"
                  value={editForm.admin_notes}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, admin_notes: e.target.value }))
                  }
                />
              </div>

              <div className="full-span">
                <label>Admin Explanation / Response</label>
                <textarea
                  rows="4"
                  value={editForm.admin_explanation}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, admin_explanation: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="forms-admin-modal-actions">
              <button type="button" onClick={() => setEditItem(null)}>
                Cancel
              </button>
              <button type="button" className="forms-admin-primary" onClick={saveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}