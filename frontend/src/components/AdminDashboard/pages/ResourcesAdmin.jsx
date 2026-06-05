//  //frontend\src\components\AdminDashboard\ResourcesAdmin.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import "../../../styles/admin-media-manager.css";

const emptyForm = {
  title: "",
  description: "",
  category: "Learning",
  is_published: 1,
};

const ROW_LIMIT_OPTIONS = [5, 10, 20, 50];

function PdfIcon({ className = "" }) {
  return (
    <div className={`amm-pdf-icon ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 80" role="img" aria-label="PDF file">
        <path d="M14 2h26l18 18v46c0 6.6-5.4 12-12 12H14C7.4 78 2 72.6 2 66V14C2 7.4 7.4 2 14 2z" />
        <path d="M40 2v18h18" className="amm-pdf-icon-fold" />
        <text x="32" y="50" textAnchor="middle">
          PDF
        </text>
      </svg>
    </div>
  );
}

function ResourcePreview({ resource }) {
  const isPdf =
    resource?.mime_type === "application/pdf" ||
    String(resource?.file_url || "").toLowerCase().endsWith(".pdf");

  if (resource?.thumbnail_url && !isPdf) {
    return (
      <img
        className="amm-thumb"
        src={resource.thumbnail_url}
        alt={resource.title}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  if (isPdf || !resource?.thumbnail_url) {
    return <PdfIcon className="amm-thumb-icon-wrap" />;
  }

  return (
    <img
      className="amm-thumb"
      src={resource.thumbnail_url}
      alt={resource.title}
    />
  );
}

function ActionsMenu({ onEdit, onView, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="amm-actions-menu" ref={menuRef}>
      <button
        type="button"
        className="amm-kebab-btn"
        aria-label="Open actions menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      {open && (
        <div className="amm-menu-popover">
          <button
            type="button"
            className="amm-menu-item"
            onClick={() => {
              setOpen(false);
              onView();
            }}
          >
            View
          </button>

          <button
            type="button"
            className="amm-menu-item"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </button>

          <button
            type="button"
            className="amm-menu-item amm-menu-item--danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function ResourcesAdmin() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [pdfFile, setPdfFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [showModal, setShowModal] = useState(false);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  async function load() {
    try {
      const { data } = await api.get("/admin/resources");
      setRows(data.rows || []);
    } catch (e) {
      console.error(e);
      setMsg("Could not load resources.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const updateField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  function resetForm() {
    setForm(emptyForm);
    setPdfFile(null);
    setEditingId(null);
  }

  function openCreateModal() {
    resetForm();
    setMsg("");
    setShowModal(true);
  }

  function closeModal() {
    resetForm();
    setShowModal(false);
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      title: row.title || "",
      description: row.description || "",
      category: row.category || "Learning",
      is_published: Number(row.is_published) ? 1 : 0,
    });
    setPdfFile(null);
    setMsg("");
    setShowModal(true);
  }

  async function save(e) {
    e.preventDefault();
    setMsg("");

    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("category", form.category);
      fd.append("is_published", String(form.is_published));

      if (pdfFile) fd.append("pdf_file", pdfFile);

      if (editingId) {
        await api.put(`/admin/resources/${editingId}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMsg("Resource updated successfully.");
      } else {
        await api.post("/admin/resources", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMsg("Resource uploaded successfully.");
      }

      closeModal();
      load();
    } catch (e2) {
      console.error(e2);
      setMsg(e2.response?.data?.error || "Save failed.");
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this resource?")) return;
    try {
      await api.delete(`/admin/resources/${id}`);
      setMsg("Resource deleted successfully.");
      load();
    } catch (e) {
      console.error(e);
      setMsg("Delete failed.");
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        String(r.title || "").toLowerCase().includes(q) ||
        String(r.description || "").toLowerCase().includes(q) ||
        String(r.category || "").toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "All Categories" || r.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [rows, search, categoryFilter]);

  const totalResources = rows.length;
  const publishedCount = rows.filter((r) => Number(r.is_published) === 1).length;
  const draftCount = rows.filter((r) => Number(r.is_published) !== 1).length;
  const categoryCount = new Set(rows.map((r) => r.category).filter(Boolean)).size;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="amm-page">
      <section className="amm-hero">
        <div>
          <h2>Resources Manager</h2>
          <p>
            Upload and manage PDFs, study materials, bulletins, books, and downloadable
            church resources.
          </p>
        </div>
      </section>

      {msg ? (
        <div
          className={`amm-alert ${
            msg.toLowerCase().includes("failed") ||
            msg.toLowerCase().includes("could not") ||
            msg.toLowerCase().includes("error")
              ? "amm-alert--error"
              : "amm-alert--success"
          }`}
        >
          {msg}
        </div>
      ) : null}

      <section className="amm-stats">
        <article className="amm-stat-card">
          <span>Total Resources</span>
          <strong>{totalResources}</strong>
        </article>
        <article className="amm-stat-card">
          <span>Published</span>
          <strong>{publishedCount}</strong>
        </article>
        <article className="amm-stat-card">
          <span>Drafts</span>
          <strong>{draftCount}</strong>
        </article>
        <article className="amm-stat-card">
          <span>Categories</span>
          <strong>{categoryCount}</strong>
        </article>
      </section>

      <section className="amm-panel">
        <div className="amm-toolbar">
          <div className="amm-toolbar-left">
            <input
              className="amm-search"
              type="text"
              placeholder="Search by title, description, or category..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />

            <select
              className="amm-filter"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option>All Categories</option>
              <option>Scripture</option>
              <option>Bulletins</option>
              <option>Books</option>
              <option>Learning</option>
              <option>Forms</option>
            </select>
          </div>

          <div className="amm-toolbar-right">
            <label className="amm-rows-label">
              Rows per page
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }}
              >
                {ROW_LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" className="amm-btn amm-btn--primary" onClick={openCreateModal}>
              Upload Resource
            </button>
          </div>
        </div>

        <div className="amm-table-wrap">
          <table className="amm-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Category</th>
                <th>Status</th>
                <th>Created</th>
                <th className="amm-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="amm-resource-main">
                      <ResourcePreview resource={r} />
                      <div className="amm-resource-copy">
                        <div className="amm-resource-title">{r.title}</div>
                        <div className="amm-resource-sub">{r.description || "No description"}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className={`amm-tag amm-tag--${String(r.category || "").toLowerCase()}`}>
                      {r.category}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`amm-status ${
                        Number(r.is_published) ? "amm-status--published" : "amm-status--draft"
                      }`}
                    >
                      {Number(r.is_published) ? "Published" : "Draft"}
                    </span>
                  </td>

                  <td>{new Date(r.created_at).toLocaleDateString()}</td>

                  <td className="amm-right">
                    <ActionsMenu
                      onEdit={() => startEdit(r)}
                      onView={() => window.open(r.file_url, "_blank")}
                      onDelete={() => remove(r.id)}
                    />
                  </td>
                </tr>
              ))}

              {!paginatedRows.length && (
                <tr>
                  <td colSpan="5" className="amm-empty-cell">
                    No resources found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length > 0 && (
          <div className="amm-pagination">
            <div className="amm-pagination-info">
              Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, filteredRows.length)} of{" "}
              {filteredRows.length}
            </div>

            <div className="amm-pagination-controls">
              <button
                className="amm-page-btn"
                disabled={safePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>

              <span className="amm-page-status">
                Page {safePage} of {totalPages}
              </span>

              <button
                className="amm-page-btn"
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {showModal && (
        <div className="amm-modal-backdrop" onClick={closeModal}>
          <div className="amm-modal amm-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="amm-modal-head">
              <h3>{editingId ? "Edit Resource" : "Upload Resource"}</h3>
              <button type="button" className="amm-modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <form onSubmit={save} className="amm-form">
              <div className="amm-grid amm-grid--2">
                <div className="amm-field">
                  <label>Resource Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    placeholder="e.g. Great Lent Reading Plan"
                    required
                  />
                </div>

                <div className="amm-field">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                  >
                    <option>Scripture</option>
                    <option>Bulletins</option>
                    <option>Books</option>
                    <option>Learning</option>
                    <option>Forms</option>
                  </select>
                </div>
              </div>

              <div className="amm-field">
                <label>Description</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Write a short summary for public users."
                />
              </div>

              <div className="amm-field">
                <label>PDF File {editingId ? "(optional when editing)" : ""}</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                />
                <small>Upload the main downloadable PDF file.</small>
              </div>

              <label className="amm-check">
                <input
                  type="checkbox"
                  checked={Number(form.is_published) === 1}
                  onChange={(e) => updateField("is_published", e.target.checked ? 1 : 0)}
                />
                <span>Publish immediately</span>
              </label>

              <div className="amm-actions">
                <button type="button" className="amm-btn amm-btn--ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="amm-btn amm-btn--primary">
                  {editingId ? "Update Resource" : "Upload Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}