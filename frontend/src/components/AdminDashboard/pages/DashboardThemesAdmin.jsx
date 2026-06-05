
// frontend/src/components/AdminDashboard/DashboardThemesAdmin.jsx


import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import "../../../styles/admin-dashboard-themes.css";

const ROLE_OPTIONS = ["all", "admin", "finance", "member"];
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

const emptyForm = {
  id: null,
  theme_key: "",
  role_name: "admin",
  theme_name: "",

  page_bg: "#edf3fb",
  surface_bg: "#ffffff",
  border_color: "#d7e3f3",

  text_color: "#15263f",
  muted_text_color: "#687995",
  desktop_text_color: "#0f172a",

  sidebar_bg: "#0f1d34",
  sidebar_text_color: "#eef4ff",

  header_bg: "#0f1e36",
  header_text_color: "#ffffff",

  active_nav_bg: "#3a6de8",
  active_nav_text_color: "#ffffff",

  button_bg: "#315bcb",
  button_text: "#ffffff",

  highlight_bg: "#eef4ff",
  highlight_text: "#315bcb",

  shadow_color: "#0f172a",

  is_active: 1,
  is_default: 0,
};

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

function normalizeHex(value, fallback = "#000000") {
  const v = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(v) ? v : fallback.toLowerCase();
}

function safeText(v) {
  return v == null || String(v).trim() === "" ? "--" : String(v);
}

function toBoolNumber(v) {
  return Number(v) ? 1 : 0;
}

function buildPayload(form) {
  return {
    theme_key: String(form.theme_key || "").trim(),
    role_name: String(form.role_name || "").trim().toLowerCase(),
    theme_name: String(form.theme_name || "").trim(),

    page_bg: normalizeHex(form.page_bg, "#edf3fb"),
    surface_bg: normalizeHex(form.surface_bg, "#ffffff"),
    border_color: normalizeHex(form.border_color, "#d7e3f3"),

    text_color: normalizeHex(form.text_color, "#15263f"),
    muted_text_color: normalizeHex(form.muted_text_color, "#687995"),
    desktop_text_color: normalizeHex(form.desktop_text_color, "#0f172a"),

    sidebar_bg: normalizeHex(form.sidebar_bg, "#0f1d34"),
    sidebar_text_color: normalizeHex(form.sidebar_text_color, "#eef4ff"),

    header_bg: normalizeHex(form.header_bg, "#0f1e36"),
    header_text_color: normalizeHex(form.header_text_color, "#ffffff"),

    active_nav_bg: normalizeHex(form.active_nav_bg, "#3a6de8"),
    active_nav_text_color: normalizeHex(form.active_nav_text_color, "#ffffff"),

    button_bg: normalizeHex(form.button_bg, "#315bcb"),
    button_text: normalizeHex(form.button_text, "#ffffff"),

    highlight_bg: normalizeHex(form.highlight_bg, "#eef4ff"),
    highlight_text: normalizeHex(form.highlight_text, "#315bcb"),

    shadow_color: normalizeHex(form.shadow_color, "#0f172a"),

    is_active: toBoolNumber(form.is_active),
    is_default: toBoolNumber(form.is_default),
  };
}

function ColorSwatch({ label, value, onClick }) {
  const hex = normalizeHex(value, "#d7e3f3");

  return (
    <button
      type="button"
      className="dtt-color-chip"
      onClick={onClick}
      title={`Edit ${label}`}
    >
      <span
        className="dtt-color-chip-swatch"
        style={{ backgroundColor: hex }}
      />
      <span className="dtt-color-chip-text">{hex}</span>
    </button>
  );
}

function ColorField({ label, name, value, onChange }) {
  const safeValue = normalizeHex(value, "#315bcb");

  return (
    <div className="dtt-field">
      <label>{label}</label>

      <div className="dtt-color-field-row">
        <input
          type="color"
          className="dtt-color-picker"
          value={safeValue}
          onChange={(e) => onChange(name, e.target.value)}
        />

        <input
          type="text"
          className="dtt-input"
          value={value || ""}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder="#ffffff"
        />
      </div>
    </div>
  );
}

export default function DashboardThemesAdmin() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyingId, setCopyingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function showMessage(text, type = "success") {
    setMsg(text || "");
    setMsgType(type);
  }

  function clearMessage() {
    setMsg("");
    setMsgType("success");
  }

  async function loadRows({ keepMessage = true } = {}) {
    setLoading(true);

    if (!keepMessage) {
      clearMessage();
    }

    try {
      const { data } = await api.get("/admin/dashboard-themes", {
        params: {
          search: search.trim(),
          role: roleFilter,
        },
      });

      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      console.error("Failed to load themes:", err);
      setRows([]);
      showMessage(
        err?.response?.data?.error || "Failed to load dashboard themes.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows({ keepMessage: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      return (
        String(row.theme_key || "").toLowerCase().includes(q) ||
        String(row.theme_name || "").toLowerCase().includes(q) ||
        String(row.role_name || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function setField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function openCreate() {
    setForm({
      ...emptyForm,
      id: null,
      theme_key: "",
      theme_name: "",
      role_name: "admin",
      is_active: 1,
      is_default: 0,
    });
    clearMessage();
    setShowModal(true);
  }

  function openEdit(row) {
    setForm({
      ...emptyForm,
      ...row,

      page_bg: normalizeHex(row.page_bg, emptyForm.page_bg),
      surface_bg: normalizeHex(row.surface_bg, emptyForm.surface_bg),
      border_color: normalizeHex(row.border_color, emptyForm.border_color),

      text_color: normalizeHex(row.text_color, emptyForm.text_color),
      muted_text_color: normalizeHex(
        row.muted_text_color,
        emptyForm.muted_text_color
      ),
      desktop_text_color: normalizeHex(
        row.desktop_text_color,
        emptyForm.desktop_text_color
      ),

      sidebar_bg: normalizeHex(row.sidebar_bg, emptyForm.sidebar_bg),
      sidebar_text_color: normalizeHex(
        row.sidebar_text_color,
        emptyForm.sidebar_text_color
      ),

      header_bg: normalizeHex(row.header_bg, emptyForm.header_bg),
      header_text_color: normalizeHex(
        row.header_text_color,
        emptyForm.header_text_color
      ),

      active_nav_bg: normalizeHex(row.active_nav_bg, emptyForm.active_nav_bg),
      active_nav_text_color: normalizeHex(
        row.active_nav_text_color,
        emptyForm.active_nav_text_color
      ),

      button_bg: normalizeHex(row.button_bg, emptyForm.button_bg),
      button_text: normalizeHex(row.button_text, emptyForm.button_text),

      highlight_bg: normalizeHex(row.highlight_bg, emptyForm.highlight_bg),
      highlight_text: normalizeHex(row.highlight_text, emptyForm.highlight_text),

      shadow_color: normalizeHex(row.shadow_color, emptyForm.shadow_color),

      is_active: toBoolNumber(row.is_active),
      is_default: toBoolNumber(row.is_default),
    });

    clearMessage();
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setForm(emptyForm);
  }

  async function saveTheme(e) {
    e.preventDefault();
    if (saving) return;

    const payload = buildPayload(form);

    if (!payload.theme_key) {
      showMessage("Theme key is required.", "error");
      return;
    }

    if (!payload.theme_name) {
      showMessage("Theme name is required.", "error");
      return;
    }

    try {
      setSaving(true);
      clearMessage();

      if (form.id) {
        await api.put(`/admin/dashboard-themes/${form.id}`, payload);
        showMessage("Theme updated successfully.");
      } else {
        await api.post("/admin/dashboard-themes", payload);
        showMessage("Theme created successfully.");
      }

      setShowModal(false);
      setForm(emptyForm);

      await loadRows({ keepMessage: true });

      window.dispatchEvent(new Event("dashboard-theme-updated"));
    } catch (err) {
      console.error("Failed to save theme:", err);
      showMessage(
        err?.response?.data?.error || "Failed to save theme.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy(id) {
    try {
      setCopyingId(id);
      clearMessage();

      await api.post(`/admin/dashboard-themes/${id}/copy`);

      showMessage("Theme copied successfully.");
      await loadRows({ keepMessage: true });
    } catch (err) {
      console.error("Failed to copy theme:", err);
      showMessage(
        err?.response?.data?.error || "Failed to copy theme.",
        "error"
      );
    } finally {
      setCopyingId(null);
    }
  }

  async function handleDelete(row) {
    if (!row?.id) return;

    if (Number(row.is_default) === 1) {
      showMessage("Default themes cannot be deleted.", "error");
      return;
    }

    const ok = window.confirm(
      `Delete theme "${row.theme_name}" (${row.theme_key})?`
    );
    if (!ok) return;

    try {
      setDeletingId(row.id);
      clearMessage();

      await api.delete(`/admin/dashboard-themes/${row.id}`);

      showMessage("Theme deleted successfully.");
      await loadRows({ keepMessage: true });

      if (page > 1 && pageRows.length === 1) {
        setPage((prev) => Math.max(1, prev - 1));
      }

      window.dispatchEvent(new Event("dashboard-theme-updated"));
    } catch (err) {
      console.error("Failed to delete theme:", err);
      showMessage(
        err?.response?.data?.error || "Failed to delete theme.",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="dtt-page">
      <section className="dtt-hero">
        <div>
          <h2>Dashboard Themes</h2>
          <p>
            Manage admin, finance, and member dashboard colors. Edit a theme,
            save it, and the active dashboard theme will reflect the latest
            change.
          </p>
        </div>

        <div className="dtt-hero-actions">
          <button
            type="button"
            className="dtt-btn dtt-btn-primary"
            onClick={openCreate}
          >
            + Create Theme
          </button>
        </div>
      </section>

      {msg ? (
        <div
          className="dtt-alert"
          style={
            msgType === "error"
              ? {
                  background: "#fff4f2",
                  color: "#bf3f2b",
                  border: "1px solid #f2c2bb",
                }
              : undefined
          }
        >
          {msg}
        </div>
      ) : null}

      <section className="dtt-toolbar-card">
        <div className="dtt-toolbar">
          <input
            type="text"
            className="dtt-input dtt-search"
            placeholder="Search theme key, name, or role..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          <select
            className="dtt-select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            {ROLE_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All Roles" : item}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="dtt-btn dtt-btn-secondary"
            onClick={() => loadRows({ keepMessage: true })}
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="dtt-table-card">
        <div className="dtt-table-topbar">
          <div className="dtt-page-size">
            <label htmlFor="themeRowsPerPage">Rows per page</label>
            <select
              id="themeRowsPerPage"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="dtt-order-note">Order: Role / Default / Name</div>
        </div>

        <div className="dtt-table-wrap">
          <table className="dtt-table">
            <thead>
              <tr>
                <th>Theme</th>
                <th>Role</th>
                <th>Header</th>
                <th>Sidebar</th>
                <th>Page</th>
                <th>Button</th>
                <th>Status</th>
                <th className="dtt-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="dtt-empty">
                    Loading themes...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="dtt-empty">
                    No themes found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const isDefault = Number(row.is_default) === 1;
                  const isDeleting = deletingId === row.id;
                  const isCopying = copyingId === row.id;

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="dtt-theme-meta">
                          <strong>{safeText(row.theme_name)}</strong>
                          <span>{safeText(row.theme_key)}</span>
                        </div>
                      </td>

                      <td>
                        <span className={`dtt-role-pill dtt-role-${row.role_name}`}>
                          {safeText(row.role_name)}
                        </span>
                      </td>

                      <td>
                        <ColorSwatch
                          label="Header BG"
                          value={row.header_bg}
                          onClick={() => openEdit(row)}
                        />
                      </td>

                      <td>
                        <ColorSwatch
                          label="Sidebar BG"
                          value={row.sidebar_bg}
                          onClick={() => openEdit(row)}
                        />
                      </td>

                      <td>
                        <ColorSwatch
                          label="Page BG"
                          value={row.page_bg}
                          onClick={() => openEdit(row)}
                        />
                      </td>

                      <td>
                        <ColorSwatch
                          label="Button BG"
                          value={row.button_bg}
                          onClick={() => openEdit(row)}
                        />
                      </td>

                      <td>
                        <div className="dtt-status-stack">
                          <span
                            className={`dtt-status ${
                              Number(row.is_active)
                                ? "dtt-status-active"
                                : "dtt-status-inactive"
                            }`}
                          >
                            {Number(row.is_active) ? "Active" : "Inactive"}
                          </span>

                          {isDefault ? (
                            <span className="dtt-status dtt-status-default">
                              Default
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="dtt-right">
                        <div className="dtt-actions">
                          <ActionMenu
                            items={[
                              { label: "Edit", onClick: () => openEdit(row) },
                              {
                                label: isCopying ? "Copying..." : "Copy",
                                onClick: () => {
                                  if (!isCopying) handleCopy(row.id);
                                },
                              },
                              {
                                label: isDeleting ? "Deleting..." : "Delete",
                                danger: true,
                                onClick: () => {
                                  if (!isDefault && !isDeleting) handleDelete(row);
                                },
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="dtt-cards">
          {loading ? (
            <div className="dtt-empty-card">Loading themes...</div>
          ) : pageRows.length === 0 ? (
            <div className="dtt-empty-card">No themes found.</div>
          ) : (
            pageRows.map((row) => {
              const isDefault = Number(row.is_default) === 1;
              const isDeleting = deletingId === row.id;
              const isCopying = copyingId === row.id;

              return (
                <article className="dtt-card" key={row.id}>
                  <div className="dtt-card-head">
                    <div className="dtt-theme-meta">
                      <strong>{safeText(row.theme_name)}</strong>
                      <span>{safeText(row.theme_key)}</span>
                    </div>

                    <span className={`dtt-role-pill dtt-role-${row.role_name}`}>
                      {safeText(row.role_name)}
                    </span>
                  </div>

                  <div className="dtt-card-grid">
                    <div>
                      <span className="dtt-card-label">Header</span>
                      <ColorSwatch
                        label="Header BG"
                        value={row.header_bg}
                        onClick={() => openEdit(row)}
                      />
                    </div>

                    <div>
                      <span className="dtt-card-label">Sidebar</span>
                      <ColorSwatch
                        label="Sidebar BG"
                        value={row.sidebar_bg}
                        onClick={() => openEdit(row)}
                      />
                    </div>

                    <div>
                      <span className="dtt-card-label">Page</span>
                      <ColorSwatch
                        label="Page BG"
                        value={row.page_bg}
                        onClick={() => openEdit(row)}
                      />
                    </div>

                    <div>
                      <span className="dtt-card-label">Button</span>
                      <ColorSwatch
                        label="Button BG"
                        value={row.button_bg}
                        onClick={() => openEdit(row)}
                      />
                    </div>
                  </div>

                  <div className="dtt-status-stack dtt-status-stack-mobile">
                    <span
                      className={`dtt-status ${
                        Number(row.is_active)
                          ? "dtt-status-active"
                          : "dtt-status-inactive"
                      }`}
                    >
                      {Number(row.is_active) ? "Active" : "Inactive"}
                    </span>

                    {isDefault ? (
                      <span className="dtt-status dtt-status-default">
                        Default
                      </span>
                    ) : null}
                  </div>

                  <div className="dtt-actions dtt-actions-mobile">
                    <ActionMenu
                      items={[
                        { label: "Edit", onClick: () => openEdit(row) },
                        {
                          label: isCopying ? "Copying..." : "Copy",
                          onClick: () => {
                            if (!isCopying) handleCopy(row.id);
                          },
                        },
                        {
                          label: isDeleting ? "Deleting..." : "Delete",
                          danger: true,
                          onClick: () => {
                            if (!isDefault && !isDeleting) handleDelete(row);
                          },
                        },
                      ]}
                    />
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="dtt-pagination">
          <button
            type="button"
            className="dtt-pagination-btn"
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>

          <div className="dtt-pagination-status">
            Page {safePage} of {totalPages}
          </div>

          <button
            type="button"
            className="dtt-pagination-btn"
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </section>

      {showModal && (
        <div className="dtt-modal-overlay" onClick={closeModal}>
          <div className="dtt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dtt-modal-head">
              <div>
                <h3>{form.id ? "Edit Theme" : "Create Theme"}</h3>
                <p>
                  Save your changes to update the selected role theme. If this
                  theme is active, the dashboard will reflect the change after
                  save.
                </p>
              </div>

              <button
                type="button"
                className="dtt-close-btn"
                onClick={closeModal}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <form className="dtt-form" onSubmit={saveTheme}>
              <div className="dtt-grid dtt-grid-3">
                <div className="dtt-field">
                  <label>Theme Key</label>
                  <input
                    className="dtt-input"
                    type="text"
                    value={form.theme_key}
                    onChange={(e) => setField("theme_key", e.target.value)}
                    required
                  />
                </div>

                <div className="dtt-field">
                  <label>Role</label>
                  <select
                    className="dtt-select"
                    value={form.role_name}
                    onChange={(e) => setField("role_name", e.target.value)}
                  >
                    <option value="admin">admin</option>
                    <option value="finance">finance</option>
                    <option value="member">member</option>
                  </select>
                </div>

                <div className="dtt-field">
                  <label>Theme Name</label>
                  <input
                    className="dtt-input"
                    type="text"
                    value={form.theme_name}
                    onChange={(e) => setField("theme_name", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="dtt-section-title">Base Layout</div>
              <div className="dtt-grid dtt-grid-3">
                <ColorField
                  label="Page BG"
                  name="page_bg"
                  value={form.page_bg}
                  onChange={setField}
                />
                <ColorField
                  label="Surface BG"
                  name="surface_bg"
                  value={form.surface_bg}
                  onChange={setField}
                />
                <ColorField
                  label="Border Color"
                  name="border_color"
                  value={form.border_color}
                  onChange={setField}
                />
              </div>

              <div className="dtt-section-title">Text</div>
              <div className="dtt-grid dtt-grid-3">
                <ColorField
                  label="Text Color"
                  name="text_color"
                  value={form.text_color}
                  onChange={setField}
                />
                <ColorField
                  label="Muted Text"
                  name="muted_text_color"
                  value={form.muted_text_color}
                  onChange={setField}
                />
                <ColorField
                  label="Desktop Text"
                  name="desktop_text_color"
                  value={form.desktop_text_color}
                  onChange={setField}
                />
              </div>

              <div className="dtt-section-title">Sidebar</div>
              <div className="dtt-grid dtt-grid-2">
                <ColorField
                  label="Sidebar BG"
                  name="sidebar_bg"
                  value={form.sidebar_bg}
                  onChange={setField}
                />
                <ColorField
                  label="Sidebar Text"
                  name="sidebar_text_color"
                  value={form.sidebar_text_color}
                  onChange={setField}
                />
              </div>

              <div className="dtt-section-title">Header</div>
              <div className="dtt-grid dtt-grid-2">
                <ColorField
                  label="Header BG"
                  name="header_bg"
                  value={form.header_bg}
                  onChange={setField}
                />
                <ColorField
                  label="Header Text"
                  name="header_text_color"
                  value={form.header_text_color}
                  onChange={setField}
                />
              </div>

              <div className="dtt-section-title">Active Navigation</div>
              <div className="dtt-grid dtt-grid-2">
                <ColorField
                  label="Active Nav BG"
                  name="active_nav_bg"
                  value={form.active_nav_bg}
                  onChange={setField}
                />
                <ColorField
                  label="Active Nav Text"
                  name="active_nav_text_color"
                  value={form.active_nav_text_color}
                  onChange={setField}
                />
              </div>

              <div className="dtt-section-title">Buttons / Highlight</div>
              <div className="dtt-grid dtt-grid-2">
                <ColorField
                  label="Button BG"
                  name="button_bg"
                  value={form.button_bg}
                  onChange={setField}
                />
                <ColorField
                  label="Button Text"
                  name="button_text"
                  value={form.button_text}
                  onChange={setField}
                />
                <ColorField
                  label="Highlight BG"
                  name="highlight_bg"
                  value={form.highlight_bg}
                  onChange={setField}
                />
                <ColorField
                  label="Highlight Text"
                  name="highlight_text"
                  value={form.highlight_text}
                  onChange={setField}
                />
              </div>

              <div className="dtt-section-title">Effects / Flags</div>
              <div className="dtt-grid dtt-grid-3">
                <ColorField
                  label="Shadow Color"
                  name="shadow_color"
                  value={form.shadow_color}
                  onChange={setField}
                />

                <label className="dtt-check">
                  <input
                    type="checkbox"
                    checked={Number(form.is_active) === 1}
                    onChange={(e) =>
                      setField("is_active", e.target.checked ? 1 : 0)
                    }
                  />
                  <span>Active theme</span>
                </label>

                <label className="dtt-check">
                  <input
                    type="checkbox"
                    checked={Number(form.is_default) === 1}
                    onChange={(e) =>
                      setField("is_default", e.target.checked ? 1 : 0)
                    }
                  />
                  <span>Default theme</span>
                </label>
              </div>

              <div className="dtt-modal-actions">
                <button
                  type="button"
                  className="dtt-btn dtt-btn-secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="dtt-btn dtt-btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : form.id
                    ? "Save Changes"
                    : "Create Theme"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}