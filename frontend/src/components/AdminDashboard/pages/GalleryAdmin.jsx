//frontend\src\components\AdminDashboard\GalleryAdmin.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
 import "../../../styles/admin-media-manager.css";
// import "../../../styles/admin-enterprise.css";
// import "../../../styles/admin-table.css";
const emptyAlbum = {
  title: "",
  description: "",
  is_published: 1,
};

const ROW_LIMIT_OPTIONS = [5, 10, 20, 50];
const PHOTO_LIMIT_OPTIONS = [8, 12, 24, 48];
const ALBUM_FALLBACK = "/images/placeholder.png";

function WysiwygEditor({ label, value, onChange, placeholder }) {
  const editorRef = useRef(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = value || "";
    if (el.innerHTML !== html) {
      el.innerHTML = html;
    }
  }, [value]);

  const exec = (cmd, arg = null) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand(cmd, false, arg);
      onChange(el.innerHTML);
    } catch (err) {
      console.warn("execCommand failed:", cmd, err);
    }
  };

  const setBlock = (tag) => exec("formatBlock", tag);

  const makeLink = () => {
    const url = window.prompt("Enter URL (https://...)");
    if (!url) return;
    exec("createLink", url);
  };

  const insertImage = () => {
    const url = window.prompt("Enter image URL (https://...)");
    if (!url) return;
    exec("insertImage", url);
  };

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    onChange(el.innerHTML);
  };

  return (
    <div className="amm-field amm-rte-field">
      {label ? <label>{label}</label> : null}

      <div className="amm-rte-shell">
        <div className="amm-rte-toolbar">
          <select
            className="amm-rte-select"
            defaultValue="p"
            onChange={(e) => setBlock(e.target.value)}
            aria-label="Text style"
          >
            <option value="p">Normal</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
            <option value="h5">Heading 5</option>
            <option value="h6">Heading 6</option>
          </select>

          <button type="button" onClick={() => exec("bold")} title="Bold">
            <strong>B</strong>
          </button>
          <button type="button" onClick={() => exec("italic")} title="Italic">
            <em>I</em>
          </button>
          <button type="button" onClick={() => exec("underline")} title="Underline">
            <u>U</u>
          </button>
          <button type="button" onClick={() => exec("strikeThrough")} title="Strike">
            <span style={{ textDecoration: "line-through" }}>S</span>
          </button>
          <button type="button" onClick={() => exec("formatBlock", "blockquote")} title="Quote">
            ❝
          </button>
          <button type="button" onClick={() => exec("insertOrderedList")} title="Numbered List">
            1.
          </button>
          <button type="button" onClick={() => exec("insertUnorderedList")} title="Bullet List">
            •
          </button>
          <button type="button" onClick={() => exec("outdent")} title="Outdent">
            ⇤
          </button>
          <button type="button" onClick={() => exec("indent")} title="Indent">
            ⇥
          </button>
          <button type="button" onClick={() => exec("justifyLeft")} title="Align Left">
            ≡
          </button>
          <button type="button" onClick={makeLink} title="Insert Link">
            🔗
          </button>
          <button type="button" onClick={insertImage} title="Insert Image URL">
            🖼️
          </button>
          <button type="button" onClick={() => exec("removeFormat")} title="Clear Formatting">
            T×
          </button>
        </div>

        <div
          ref={editorRef}
          className="amm-rte-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          data-placeholder={placeholder || ""}
        />
      </div>
    </div>
  );
}

function ActionsMenu({ items = [] }) {
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
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`amm-menu-item ${item.danger ? "amm-menu-item--danger" : ""}`}
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

export default function GalleryAdmin() {
  const [albums, setAlbums] = useState([]);
  const [albumForm, setAlbumForm] = useState(emptyAlbum);
  const [albumCover, setAlbumCover] = useState(null);
  const [editingAlbumId, setEditingAlbumId] = useState(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [msg, setMsg] = useState("");
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const [albumSearch, setAlbumSearch] = useState("");
  const [albumPage, setAlbumPage] = useState(1);
  const [albumsPerPage, setAlbumsPerPage] = useState(10);

  const [photoSearch, setPhotoSearch] = useState("");
  const [photoPage, setPhotoPage] = useState(1);
  const [photosPerPage, setPhotosPerPage] = useState(12);

  async function loadAlbums() {
    try {
      const { data } = await api.get("/admin/gallery/albums");
      setAlbums(data.rows || []);
    } catch (e) {
      console.error(e);
      setMsg("Could not load albums.");
    }
  }

  async function loadPhotos(albumId) {
    try {
      const { data } = await api.get(`/admin/gallery/albums/${albumId}/photos`);
      setPhotos(data.rows || []);
    } catch (e) {
      console.error(e);
      setPhotos([]);
      setMsg("Could not load photos.");
    }
  }

  useEffect(() => {
    loadAlbums();
  }, []);

  useEffect(() => {
    if (selectedAlbumId) {
      loadPhotos(selectedAlbumId);
    } else {
      setPhotos([]);
    }
  }, [selectedAlbumId]);

  const updateAlbumField = (k, v) => setAlbumForm((prev) => ({ ...prev, [k]: v }));

  function resetAlbumForm() {
    setAlbumForm(emptyAlbum);
    setAlbumCover(null);
    setEditingAlbumId(null);
  }

  function openAlbumModal() {
    resetAlbumForm();
    setShowAlbumModal(true);
  }

  function closeAlbumModal() {
    resetAlbumForm();
    setShowAlbumModal(false);
  }

  function startAlbumEdit(row) {
    setEditingAlbumId(row.id);
    setAlbumForm({
      title: row.title || "",
      description: row.description || "",
      is_published: Number(row.is_published) ? 1 : 0,
    });
    setAlbumCover(null);
    setShowAlbumModal(true);
  }

  function openPhotoModal(albumId) {
    setSelectedAlbumId(albumId);
    setPhotoFile(null);
    setCaption("");
    setShowPhotoModal(true);
  }

  function closePhotoModal() {
    setPhotoFile(null);
    setCaption("");
    setShowPhotoModal(false);
  }

  async function saveAlbum(e) {
    e.preventDefault();
    setMsg("");

    try {
      const fd = new FormData();
      fd.append("title", albumForm.title);
      fd.append("description", albumForm.description);
      fd.append("is_published", String(albumForm.is_published));
      if (albumCover) fd.append("cover_image", albumCover);

      if (editingAlbumId) {
        await api.put(`/admin/gallery/albums/${editingAlbumId}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMsg("Album updated successfully.");
      } else {
        await api.post("/admin/gallery/albums", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMsg("Album created successfully.");
      }

      closeAlbumModal();
      loadAlbums();
    } catch (e2) {
      console.error(e2);
      setMsg(e2.response?.data?.error || "Save album failed.");
    }
  }

  async function deleteAlbum(id) {
    if (!window.confirm("Delete this album and all photos?")) return;
    try {
      await api.delete(`/admin/gallery/albums/${id}`);
      if (selectedAlbumId === id) {
        setSelectedAlbumId(null);
        setPhotos([]);
      }
      setMsg("Album deleted successfully.");
      loadAlbums();
    } catch (e) {
      console.error(e);
      setMsg("Delete failed.");
    }
  }

  async function uploadPhoto(e) {
    e.preventDefault();
    if (!selectedAlbumId || !photoFile) return;

    try {
      const fd = new FormData();
      fd.append("image", photoFile);
      fd.append("caption", caption);

      await api.post(`/admin/gallery/albums/${selectedAlbumId}/photos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      closePhotoModal();
      setMsg("Photo uploaded successfully.");
      loadPhotos(selectedAlbumId);
      loadAlbums();
    } catch (e2) {
      console.error(e2);
      setMsg(e2.response?.data?.error || "Photo upload failed.");
    }
  }

  async function deletePhoto(photoId) {
    if (!window.confirm("Delete this photo?")) return;
    try {
      await api.delete(`/admin/gallery/photos/${photoId}`);
      setMsg("Photo deleted successfully.");
      loadPhotos(selectedAlbumId);
      loadAlbums();
    } catch (e) {
      console.error(e);
      setMsg("Delete photo failed.");
    }
  }

  const filteredAlbums = useMemo(() => {
    const q = albumSearch.trim().toLowerCase();
    return albums.filter((a) => {
      if (!q) return true;
      return (
        String(a.title || "").toLowerCase().includes(q) ||
        String(a.description || "").toLowerCase().includes(q)
      );
    });
  }, [albums, albumSearch]);

  const totalAlbumPages = Math.max(1, Math.ceil(filteredAlbums.length / albumsPerPage));
  const safeAlbumPage = Math.min(albumPage, totalAlbumPages);
  const albumStartIndex = (safeAlbumPage - 1) * albumsPerPage;
  const paginatedAlbums = filteredAlbums.slice(
    albumStartIndex,
    albumStartIndex + albumsPerPage
  );

  useEffect(() => {
    if (albumPage > totalAlbumPages) setAlbumPage(totalAlbumPages);
  }, [albumPage, totalAlbumPages]);

  const filteredPhotos = useMemo(() => {
    const q = photoSearch.trim().toLowerCase();
    return photos.filter((p) => {
      if (!q) return true;
      return String(p.caption || "").toLowerCase().includes(q);
    });
  }, [photos, photoSearch]);

  const totalPhotoPages = Math.max(1, Math.ceil(filteredPhotos.length / photosPerPage));
  const safePhotoPage = Math.min(photoPage, totalPhotoPages);
  const photoStartIndex = (safePhotoPage - 1) * photosPerPage;
  const paginatedPhotos = filteredPhotos.slice(
    photoStartIndex,
    photoStartIndex + photosPerPage
  );

  useEffect(() => {
    if (photoPage > totalPhotoPages) setPhotoPage(totalPhotoPages);
  }, [photoPage, totalPhotoPages]);

  const totalAlbums = albums.length;
  const publishedAlbums = albums.filter((a) => Number(a.is_published) === 1).length;
  const totalPhotos = albums.reduce((sum, a) => sum + Number(a.photo_count || 0), 0);

  return (
    <div className="amm-page">
      <section className="amm-hero">
        <div>
          <h2>Photo Gallery Manager</h2>
          <p>
            Create albums, upload cover images, organize gallery photos, and manage
            what is visible on the public gallery page.
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
          <span>Albums</span>
          <strong>{totalAlbums}</strong>
        </article>
        <article className="amm-stat-card">
          <span>Published Albums</span>
          <strong>{publishedAlbums}</strong>
        </article>
        <article className="amm-stat-card">
          <span>Total Photos</span>
          <strong>{totalPhotos}</strong>
        </article>
        <article className="amm-stat-card">
          <span>Selected Album Photos</span>
          <strong>{photos.length}</strong>
        </article>
      </section>

      <section className="amm-panel">
        <div className="amm-toolbar">
          <div className="amm-toolbar-left">
            <input
              className="amm-search"
              type="text"
              placeholder="Search albums by title or description..."
              value={albumSearch}
              onChange={(e) => {
                setAlbumSearch(e.target.value);
                setAlbumPage(1);
              }}
            />
          </div>

          <div className="amm-toolbar-right">
            <label className="amm-rows-label">
              Rows per page
              <select
                value={albumsPerPage}
                onChange={(e) => {
                  setAlbumsPerPage(Number(e.target.value));
                  setAlbumPage(1);
                }}
              >
                {ROW_LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" className="amm-btn amm-btn--primary" onClick={openAlbumModal}>
              Create Album
            </button>
          </div>
        </div>

        <div className="amm-table-wrap">
          <table className="amm-table">
            <thead>
              <tr>
                <th>Album</th>
                <th>Photos</th>
                <th>Status</th>
                <th>Created</th>
                <th className="amm-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAlbums.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="amm-resource-main">
                      <img
                        className="amm-thumb"
                        src={a.cover_image_url || ALBUM_FALLBACK}
                        alt={a.title}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = ALBUM_FALLBACK;
                        }}
                      />
                      <div className="amm-resource-copy">
                        <div className="amm-resource-title">{a.title}</div>
                        <div
                          className="amm-resource-sub"
                          dangerouslySetInnerHTML={{
                            __html: a.description || "No description",
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>{a.photo_count || 0}</td>
                  <td>
                    <span
                      className={`amm-status ${
                        Number(a.is_published) ? "amm-status--published" : "amm-status--draft"
                      }`}
                    >
                      {Number(a.is_published) ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "--"}</td>
                  <td className="amm-right">
                    <ActionsMenu
                      items={[
                        {
                          label: "View Photos",
                          onClick: () => {
                            setSelectedAlbumId(a.id);
                            setPhotoPage(1);
                          },
                        },
                        {
                          label: "Upload Photo",
                          onClick: () => openPhotoModal(a.id),
                        },
                        {
                          label: "Edit",
                          onClick: () => startAlbumEdit(a),
                        },
                        {
                          label: "Delete",
                          danger: true,
                          onClick: () => deleteAlbum(a.id),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}

              {!paginatedAlbums.length && (
                <tr>
                  <td colSpan="5" className="amm-empty-cell">
                    No albums found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredAlbums.length > 0 && (
          <div className="amm-pagination">
            <div className="amm-pagination-info">
              Showing {albumStartIndex + 1} to{" "}
              {Math.min(albumStartIndex + albumsPerPage, filteredAlbums.length)} of{" "}
              {filteredAlbums.length}
            </div>

            <div className="amm-pagination-controls">
              <button
                type="button"
                className="amm-page-btn"
                disabled={safeAlbumPage === 1}
                onClick={() => setAlbumPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>

              <span className="amm-page-status">
                Page {safeAlbumPage} of {totalAlbumPages}
              </span>

              <button
                type="button"
                className="amm-page-btn"
                disabled={safeAlbumPage === totalAlbumPages}
                onClick={() => setAlbumPage((p) => Math.min(totalAlbumPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {showAlbumModal && (
        <div className="amm-modal-backdrop" onClick={closeAlbumModal}>
          <div className="amm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="amm-modal-head">
              <h3>{editingAlbumId ? "Edit Album" : "Create Album"}</h3>
              <button type="button" className="amm-modal-close" onClick={closeAlbumModal}>
                ×
              </button>
            </div>

            <form onSubmit={saveAlbum} className="amm-form">
              <div className="amm-grid amm-grid--2">
                <div className="amm-field">
                  <label>Album Title</label>
                  <input
                    value={albumForm.title}
                    onChange={(e) => updateAlbumField("title", e.target.value)}
                    placeholder="e.g. Graduation – Class of 2025"
                    required
                  />
                </div>

                <div className="amm-field">
                  <label>Cover Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAlbumCover(e.target.files?.[0] || null)}
                  />
                  <small>Upload the album cover shown on the public gallery page.</small>
                </div>
              </div>

              <WysiwygEditor
                label="Description"
                value={albumForm.description}
                onChange={(html) => updateAlbumField("description", html)}
                placeholder="Enter detailed album description"
              />

              <label className="amm-check">
                <input
                  type="checkbox"
                  checked={Number(albumForm.is_published) === 1}
                  onChange={(e) => updateAlbumField("is_published", e.target.checked ? 1 : 0)}
                />
                <span>Publish immediately</span>
              </label>

              <div className="amm-actions">
                <button type="button" className="amm-btn amm-btn--ghost" onClick={closeAlbumModal}>
                  Cancel
                </button>

                <button type="submit" className="amm-btn amm-btn--primary">
                  {editingAlbumId ? "Update Album" : "Create Album"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPhotoModal && (
        <div className="amm-modal-backdrop" onClick={closePhotoModal}>
          <div className="amm-modal amm-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="amm-modal-head">
              <h3>Upload Photo</h3>
              <button type="button" className="amm-modal-close" onClick={closePhotoModal}>
                ×
              </button>
            </div>

            <form onSubmit={uploadPhoto} className="amm-form">
              <div className="amm-field">
                <label>Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  required
                />
              </div>

              <div className="amm-field">
                <label>Caption</label>
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Optional photo caption"
                />
              </div>

              <div className="amm-actions">
                <button type="button" className="amm-btn amm-btn--ghost" onClick={closePhotoModal}>
                  Cancel
                </button>
                <button type="submit" className="amm-btn amm-btn--primary">
                  Upload Photo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedAlbumId ? (
        <section className="amm-panel">
          <div className="amm-toolbar">
            <div className="amm-toolbar-left">
              <h3 className="amm-section-title">Manage Photos</h3>
            </div>

            <div className="amm-toolbar-right">
              <input
                className="amm-search"
                type="text"
                placeholder="Search photos by caption..."
                value={photoSearch}
                onChange={(e) => {
                  setPhotoSearch(e.target.value);
                  setPhotoPage(1);
                }}
              />

              <label className="amm-rows-label">
                Photos per page
                <select
                  value={photosPerPage}
                  onChange={(e) => {
                    setPhotosPerPage(Number(e.target.value));
                    setPhotoPage(1);
                  }}
                >
                  {PHOTO_LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="amm-photo-grid">
            {paginatedPhotos.map((p) => (
              <article key={p.id} className="amm-photo-card">
                <div className="amm-photo-preview-wrap">
                  <img
                    className="amm-photo-preview"
                    src={p.image_url}
                    alt={p.caption || "photo"}
                  />
                </div>

                <div className="amm-photo-body">
                  <div className="amm-photo-caption">{p.caption || "No caption"}</div>

                  <div className="amm-photo-actions">
                    <button
                      type="button"
                      className="amm-btn amm-btn--ghost"
                      onClick={() => window.open(p.image_url, "_blank")}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="amm-btn amm-btn--danger"
                      onClick={() => deletePhoto(p.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {!paginatedPhotos.length && (
              <div className="amm-empty-box">No photos in this album yet.</div>
            )}
          </div>

          {filteredPhotos.length > 0 && (
            <div className="amm-pagination">
              <div className="amm-pagination-info">
                Showing {photoStartIndex + 1} to{" "}
                {Math.min(photoStartIndex + photosPerPage, filteredPhotos.length)} of{" "}
                {filteredPhotos.length}
              </div>

              <div className="amm-pagination-controls">
                <button
                  type="button"
                  className="amm-page-btn"
                  disabled={safePhotoPage === 1}
                  onClick={() => setPhotoPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>

                <span className="amm-page-status">
                  Page {safePhotoPage} of {totalPhotoPages}
                </span>

                <button
                  type="button"
                  className="amm-page-btn"
                  disabled={safePhotoPage === totalPhotoPages}
                  onClick={() => setPhotoPage((p) => Math.min(totalPhotoPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}