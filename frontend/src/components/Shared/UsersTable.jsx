
// // src/components/Shared/UsersTable.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
// import "../../styles/admin-members-roles.css";
import "../../styles/admin-enterprise.css";
import "../../styles/admin-table.css";
function clean(value) {
  return String(value || "").trim();
}

function fmtDate(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US");
}

function yesNo(value) {
  return Number(value) === 1 ? "Yes" : "No";
}

const EMPTY_MEMBER_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip: "",
  member_type: "existing",
  status: "active",
  membership_status: "active",
  is_active: true,
  create_login_account: true,
  auto_generate_password: true,
  temp_password: "",
};

const EMPTY_ACCESS_FORM = {
  member_id: "",
  username: "",
  email: "",
  phone: "",
  role: "finance",
  temp_password: "",
  auto_generate_password: true,
  is_active: true,
};

const ACCESS_ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "finance", label: "Finance" },
  { value: "admin", label: "Admin" },
  { value: "reconciliation", label: "Reconciliation" },
  { value: "super_admin", label: "Super Admin" },
];

const ROLE_FILTERS = [
  { value: "all", label: "All" },
  { value: "member", label: "Member" },
  { value: "finance", label: "Finance" },
  { value: "admin", label: "Admin" },
  { value: "reconciliation", label: "Reconciliation" },
  { value: "super_admin", label: "Super Admin" },
];

function formatRoleLabel(role) {
  const value = String(role || "").toLowerCase();
  const found = ACCESS_ROLE_OPTIONS.find((item) => item.value === value);
  return found ? found.label : value ? value.replaceAll("_", " ") : "--";
}

function roleBadgeClass(role) {
  const value = String(role || "").toLowerCase();

  if (value === "member") return "mr-role-badge mr-role-member";
  if (value === "finance") return "mr-role-badge mr-role-finance";
  if (value === "admin") return "mr-role-badge mr-role-admin";
  if (value === "reconciliation") return "mr-role-badge mr-role-recon";
  if (value === "super_admin") return "mr-role-badge mr-role-super";

  return "mr-role-badge";
}

function Modal({ open, title, subtitle, children, onClose, wide = false }) {
  useEffect(() => {
    if (!open) return;

    function onEsc(e) {
      if (e.key === "Escape") onClose?.();
    }

    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mr-modal-backdrop" onClick={onClose}>
      <div
        className={`mr-modal ${wide ? "mr-modal-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mr-modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p className="mr-modal-subtitle">{subtitle}</p> : null}
          </div>

          <button
            type="button"
            className="mr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

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
    <div className="mr-action-menu" ref={wrapRef}>
      <button
        type="button"
        className="mr-kebab-btn"
        aria-label="Open actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      {open ? (
        <div className="mr-kebab-menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`mr-kebab-item ${item.danger ? "danger" : ""}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function UsersTable({
  canCreate = false,
  canEditRole = false,
  canDelete = false,
  showAddress = false,
  showBilling = false,
  stickyHeader = true,
  mode = "members",
}) {
  const isRolesMode = mode === "roles";

  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roleFilter, setRoleFilter] = useState("all");
  const [summary, setSummary] = useState({
    all: 0,
    member: 0,
    finance: 0,
    admin: 0,
    reconciliation: 0,
    super_admin: 0,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [banner, setBanner] = useState("");
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM);
  const [accessForm, setAccessForm] = useState(EMPTY_ACCESS_FORM);

  const [editingRoleRow, setEditingRoleRow] = useState(null);
  const [editRole, setEditRole] = useState("finance");
  const [editActive, setEditActive] = useState(true);

  const [resetRow, setResetRow] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetAutoGenerate, setResetAutoGenerate] = useState(true);

  // const endpoint = isRolesMode ? "/admin/access-users" : "/admin/users";
  const endpoint = isRolesMode
  ? "/admin/access-users"
  : "/finance/members";

  async function loadRows() {
    setLoading(true);
    setError("");

    try {
      const params = {
        search: query,
        page,
        pageSize,
      };

      if (isRolesMode && roleFilter !== "all") {
        params.role = roleFilter;
      }

      const { data } = await api.get(endpoint, { params });

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setSummary(
        isRolesMode
          ? {
              all: Number(data?.summary?.all || 0),
              member: Number(data?.summary?.member || 0),
              finance: Number(data?.summary?.finance || 0),
              admin: Number(data?.summary?.admin || 0),
              reconciliation: Number(data?.summary?.reconciliation || 0),
              super_admin: Number(data?.summary?.super_admin || 0),
            }
          : summary
      );
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || "Failed to load records.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMembersForRoleCreate() {
    if (!isRolesMode) return;

    try {
      // const { data } = await api.get("/admin/users", {
      //   params: {
      //     search: "",
      //     page: 1,
      //     pageSize: 200,
      //   },
      // });
      const { data } = await api.get("/admin/access-users", {
  params: {
    search: "",
    page: 1,
    pageSize: 200,
  },
});

      setMembers(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      console.error("loadMembersForRoleCreate error", err);
    }
  }

  useEffect(() => {
    loadRows();
  }, [query, page, pageSize, endpoint, roleFilter]);

  useEffect(() => {
    loadMembersForRoleCreate();
  }, [mode]);

  const memberOptions = useMemo(() => {
    return members.map((m) => ({
      value: String(m.id),
      label: `${m.member_no || "—"} — ${m.full_name || m.email || "Member"}`,
    }));
  }, [members]);

  function openCreate() {
    setBanner("");
    setError("");

    if (isRolesMode) {
      setAccessForm({
        ...EMPTY_ACCESS_FORM,
        role: roleFilter !== "all" && roleFilter !== "member" ? roleFilter : "finance",
      });
    } else {
      setMemberForm(EMPTY_MEMBER_FORM);
    }

    setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false);
    setMemberForm(EMPTY_MEMBER_FORM);
    setAccessForm(EMPTY_ACCESS_FORM);
  }

  async function submitCreateMember(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setBanner("");

    try {
      const payload = {
        ...memberForm,
        create_login_account: memberForm.create_login_account ? 1 : 0,
        auto_generate_password: memberForm.auto_generate_password ? 1 : 0,
        is_active: memberForm.is_active ? 1 : 0,
      };

      // const { data } = await api.post("/admin/users", payload);
      const { data } = await api.post("/finance/members", payload);

      setBanner(
        data?.temp_password
          ? `Member created. Temporary password: ${data.temp_password}`
          : "Member created successfully."
      );

      closeCreate();
      await loadRows();
      await loadMembersForRoleCreate();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || "Failed to create member.");
    } finally {
      setSaving(false);
    }
  }

  async function submitCreateAccessAccount(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setBanner("");

    try {
      const memberId = Number(accessForm.member_id);

      if (!memberId) {
        setError("Please select a member.");
        setSaving(false);
        return;
      }

      const payload = {
        username: clean(accessForm.username),
        email: clean(accessForm.email),
        phone: clean(accessForm.phone),
        role: clean(accessForm.role),
        password: clean(accessForm.temp_password),
        auto_generate_password: !!accessForm.auto_generate_password,
        is_active: accessForm.is_active ? 1 : 0,
      };

      const { data } = await api.post(
        `/admin/members/${memberId}/accounts`,
        payload
      );

      setBanner(
        data?.temp_password
          ? `Linked account created. Temporary password: ${data.temp_password}`
          : "Linked account created successfully."
      );

      closeCreate();
      await loadRows();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error || "Failed to create linked access account."
      );
    } finally {
      setSaving(false);
    }
  }


  function openRoleEditor(row) {
    setEditingRoleRow(row);
    setEditRole(String(row.role || "finance").toLowerCase());
    setEditActive(Number(row.is_active) === 1);
  }

  function closeRoleEditor() {
    setEditingRoleRow(null);
    setEditRole("finance");
    setEditActive(true);
  }

async function saveRoleEditor(e) {
  e.preventDefault();

  if (!editingRoleRow) return;

  setSaving(true);
  setError("");
  setBanner("");

  try {
    await api.patch(
      `/admin/access-users/${editingRoleRow.id}/role`,
      {
        role: editRole,
      }
    );

    await api.patch(
      `/admin/access-users/${editingRoleRow.id}/status`,
      {
        is_active: editActive ? 1 : 0,
      }
    );

    setBanner("Linked account updated successfully.");

    closeRoleEditor();

    await loadRows();
  } catch (err) {
    console.error(err);

    setError(
      err?.response?.data?.error ||
      "Failed to update access role."
    );
  } finally {
    setSaving(false);
  }
}
  function openResetPassword(row) {
    setResetRow(row);
    setResetPassword("");
    setResetAutoGenerate(true);
  }

  function closeResetPassword() {
    setResetRow(null);
    setResetPassword("");
    setResetAutoGenerate(true);
  }

  async function submitResetPassword(e) {
  e.preventDefault();

  if (!resetRow) return;

  setSaving(true);
  setError("");
  setBanner("");

  try {
    const payload = {
      password: clean(resetPassword),
      auto_generate_password: resetAutoGenerate,
    };

    const { data } = await api.patch(
      `/admin/access-users/${resetRow.id}/reset-password`,
      payload
    );

    setBanner(
      data?.temp_password
        ? `Password reset complete. Temporary password: ${data.temp_password}`
        : "Password reset successfully."
    );

    closeResetPassword();

    await loadRows();
  } catch (err) {
    console.error(err);

    setError(
      err?.response?.data?.error ||
      "Failed to reset password."
    );
  } finally {
    setSaving(false);
  }
}

  async function deleteRow(row) {
    const ok = window.confirm(
      isRolesMode
        ? "Delete this linked access account?"
        : "Delete this member record and linked accounts?"
    );
    if (!ok) return;

    setSaving(true);
    setError("");
    setBanner("");

    try {
      if (isRolesMode) {
        await api.delete(`/admin/accounts/${row.id}`);
        setBanner("Linked access account deleted.");
      } else {
        // await api.delete(`/admin/users/${row.id}`);
        await api.delete(`/finance/members/${row.id}`);
        setBanner("Member deleted successfully.");
      }

      await loadRows();
      await loadMembersForRoleCreate();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || "Delete failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mr-users-table-page">
      {(banner || error) && (
        <div className={`mr-banner ${error ? "mr-banner-error" : ""}`}>
          {error || banner}
        </div>
      )}

      {isRolesMode ? (
        <div className="mr-role-filter-tabs">
          {ROLE_FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`mr-role-tab ${roleFilter === item.value ? "active" : ""}`}
              onClick={() => {
                setPage(1);
                setRoleFilter(item.value);
              }}
            >
              {item.label}
              <span style={{ marginLeft: 8, opacity: 0.8 }}>
                {item.value === "all"
                  ? summary.all
                  : item.value === "member"
                  ? summary.member
                  : item.value === "finance"
                  ? summary.finance
                  : item.value === "admin"
                  ? summary.admin
                  : item.value === "reconciliation"
                  ? summary.reconciliation
                  : summary.super_admin}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mr-toolbar">
        <div className="mr-toolbar-left">
          <input
            className="mr-search"
            type="text"
            placeholder={
              isRolesMode
                ? "Search linked user accounts..."
                : "Search members by name, email, member number..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="mr-btn mr-btn-secondary"
            onClick={() => {
              setPage(1);
              setQuery(clean(search));
            }}
          >
            Search
          </button>
        </div>

        <div className="mr-toolbar-right">
          <select
            className="mr-select"
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>

          {canCreate && (
            <button
              type="button"
              className="mr-btn mr-btn-primary"
              onClick={openCreate}
            >
              {isRolesMode ? "Add Linked Access Account" : "Add Member"}
            </button>
          )}
        </div>
      </div>


<div className="mr-table-wrap">
  <div className="mr-table-scroll">
    <table
      className={`mr-table ${
        stickyHeader ? "mr-sticky" : ""
      }`}
    >
      <thead>
        <tr>
          {isRolesMode ? (
            <>
              <th>Member ID</th>
              <th>Member Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Active</th>
              <th>Password Change</th>
              <th>Created</th>
              <th style={{ textAlign: "right" }}>
                Actions
              </th>
            </>
          ) : (
            <>
              <th>Member No</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Phone</th>

              {showAddress && (
                <th>Address</th>
              )}

              <th>Status</th>
              <th>Membership</th>
              <th>Linked Accounts</th>

              <th
                style={{
                  textAlign: "right",
                }}
              >
                Actions
              </th>
            </>
          )}
        </tr>
      </thead>

      <tbody>
        {loading ? (
          <tr>
            <td
              colSpan={
                isRolesMode
                  ? 9
                  : showAddress
                  ? 9
                  : 8
              }
              className="mr-empty-cell"
            >
              Loading...
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td
              colSpan={
                isRolesMode
                  ? 9
                  : showAddress
                  ? 9
                  : 8
              }
              className="mr-empty-cell"
            >
              No records found.
            </td>
          </tr>
        ) : (
          rows.map((row) =>
            isRolesMode ? (
              <tr key={row.id}>
                {/* Member ID */}
                <td className="mr-member-id">
                  {row.member_no || "--"}
                </td>

                {/* Member Name */}
                <td className="mr-member-name">
                  {row.member_full_name ||
                    row.full_name ||
                    "--"}
                </td>

                {/* Username */}
                <td>
                  {row.username || "--"}
                </td>

                {/* Email */}
                <td className="mr-email-cell">
                  {row.email || "--"}
                </td>

                {/* Role */}
                <td>
                  <span
                    className={roleBadgeClass(
                      row.role
                    )}
                  >
                    {formatRoleLabel(
                      row.role
                    )}
                  </span>
                </td>

                {/* Active */}
                <td>
                  <span
                    className={`mr-status-pill ${
                      Number(
                        row.is_active
                      ) === 1
                        ? "active"
                        : "inactive"
                    }`}
                  >
                    {yesNo(
                      row.is_active
                    )}
                  </span>
                </td>

                {/* Must Change Password */}
                <td>
                  {yesNo(
                    row.must_change_password
                  )}
                </td>

                {/* Created */}
                <td>
                  {fmtDate(
                    row.created_at
                  )}
                </td>

                {/* Actions */}
                <td>
                  <div className="mr-actions-cell">
                    <ActionMenu
                      items={[
                        ...(canEditRole
                          ? [
                              {
                                label:
                                  "Edit Access",
                                onClick:
                                  () =>
                                    openRoleEditor(
                                      row
                                    ),
                              },
                              {
                                label:
                                  "Reset Password",
                                onClick:
                                  () =>
                                    openResetPassword(
                                      row
                                    ),
                              },
                            ]
                          : []),

                        ...(canDelete
                          ? [
                              {
                                label:
                                  "Delete",
                                danger: true,
                                onClick:
                                  () =>
                                    deleteRow(
                                      row
                                    ),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={row.id}>
                <td>
                  {row.member_no ||
                    "--"}
                </td>

                <td>
                  {row.full_name ||
                    "--"}
                </td>

                <td>
                  {row.email ||
                    "--"}
                </td>

                <td>
                  {row.phone ||
                    "--"}
                </td>

                {showAddress && (
                  <td>
                    {[
                      row.address_line1,
                      row.city,
                      row.state,
                      row.zip,
                    ]
                      .filter(Boolean)
                      .join(", ") ||
                      "--"}
                  </td>
                )}

                <td>
                  {row.status ||
                    "--"}
                </td>

                <td>
                  {row.membership_status ||
                    "--"}
                </td>

                <td>
                  {row.linked_accounts_count ??
                    0}
                </td>

                <td>
                  <div className="mr-actions-cell">
                    <ActionMenu
                      items={[
                        ...(canDelete
                          ? [
                              {
                                label:
                                  "Delete",
                                danger: true,
                                onClick:
                                  () =>
                                    deleteRow(
                                      row
                                    ),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </td>
              </tr>
            )
          )
        )}
      </tbody>
    </table>
  </div>
</div>

      <div className="mr-pagination">
        <button
          type="button"
          className="mr-btn mr-btn-secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span className="mr-page-indicator">Page {page}</span>
        <button
          type="button"
          className="mr-btn mr-btn-secondary"
          disabled={rows.length < pageSize}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      <Modal
        open={showCreate && !isRolesMode}
        title="Add Member"
        subtitle="Create a member record and optionally create a portal account."
        onClose={closeCreate}
        wide
      >
        <form className="mr-form" onSubmit={submitCreateMember}>
          <div className="mr-form-grid mr-grid-2">
            <div className="mr-field">
              <label className="mr-label">First Name</label>
              <input
                className="mr-input mr-input-plain"
                value={memberForm.first_name}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...p, first_name: e.target.value }))
                }
                required
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">Last Name</label>
              <input
                className="mr-input mr-input-plain"
                value={memberForm.last_name}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...p, last_name: e.target.value }))
                }
                required
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">Email</label>
              <input
                className="mr-input mr-input-plain"
                type="email"
                value={memberForm.email}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...p, email: e.target.value }))
                }
                required
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">Phone</label>
              <input
                className="mr-input mr-input-plain"
                value={memberForm.phone}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">Address Line 1</label>
              <input
                className="mr-input mr-input-plain"
                value={memberForm.address_line1}
                onChange={(e) =>
                  setMemberForm((p) => ({
                    ...p,
                    address_line1: e.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">Address Line 2</label>
              <input
                className="mr-input mr-input-plain"
                value={memberForm.address_line2}
                onChange={(e) =>
                  setMemberForm((p) => ({
                    ...p,
                    address_line2: e.target.value,
                  }))
                }
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">City</label>
              <input
                className="mr-input mr-input-plain"
                value={memberForm.city}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...p, city: e.target.value }))
                }
                required
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">State</label>
              <input
                className="mr-input mr-input-plain"
                value={memberForm.state}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...p, state: e.target.value }))
                }
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">ZIP</label>
              <input
                className="mr-input mr-input-plain"
                value={memberForm.zip}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...p, zip: e.target.value }))
                }
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">Member Type</label>
              <select
                className="mr-select"
                value={memberForm.member_type}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...p, member_type: e.target.value }))
                }
              >
                <option value="existing">Existing</option>
                <option value="new">New</option>
              </select>
            </div>
          </div>

          <div className="mr-section-title">Member Portal Login</div>

          <div className="mr-form-grid mr-grid-2">
            <div className="mr-field">
              <label className="mr-label">Create login account</label>
              <select
                className="mr-select"
                value={memberForm.create_login_account ? "1" : "0"}
                onChange={(e) =>
                  setMemberForm((p) => ({
                    ...p,
                    create_login_account: e.target.value === "1",
                  }))
                }
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>

            {memberForm.create_login_account ? (
              <div className="mr-field">
                <label className="mr-label">Auto generate temp password</label>
                <select
                  className="mr-select"
                  value={memberForm.auto_generate_password ? "1" : "0"}
                  onChange={(e) =>
                    setMemberForm((p) => ({
                      ...p,
                      auto_generate_password: e.target.value === "1",
                    }))
                  }
                >
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
            ) : null}

            {memberForm.create_login_account &&
            !memberForm.auto_generate_password ? (
              <div className="mr-field">
                <label className="mr-label">Temporary Password</label>
                <input
                  className="mr-input mr-input-plain"
                  type="text"
                  value={memberForm.temp_password}
                  onChange={(e) =>
                    setMemberForm((p) => ({
                      ...p,
                      temp_password: e.target.value,
                    }))
                  }
                  placeholder="At least 12 chars, upper/lower/number/special"
                />
              </div>
            ) : null}
          </div>

          <div className="mr-form-actions">
            <button
              type="button"
              className="mr-btn mr-btn-secondary"
              onClick={closeCreate}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="mr-btn mr-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Create Member"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showCreate && isRolesMode}
        title="Add Linked Access Account"
        subtitle="Create a linked elevated account for finance, admin, reconciliation, or super admin access."
        onClose={closeCreate}
        wide
      >
        <form className="mr-form" onSubmit={submitCreateAccessAccount}>
          <div className="mr-form-grid mr-grid-2">
            <div className="mr-field">
              <label className="mr-label">Member</label>
              <select
                className="mr-select"
                value={accessForm.member_id}
                onChange={(e) =>
                  setAccessForm((p) => ({ ...p, member_id: e.target.value }))
                }
                required
              >
                <option value="">Select member</option>
                {memberOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mr-field">
              <label className="mr-label">Role</label>
              <select
                className="mr-select"
                value={accessForm.role}
                onChange={(e) =>
                  setAccessForm((p) => ({ ...p, role: e.target.value }))
                }
              >
                {ACCESS_ROLE_OPTIONS.filter((r) => r.value !== "member").map(
                  (role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="mr-field">
              <label className="mr-label">Username</label>
              <input
                className="mr-input mr-input-plain"
                value={accessForm.username}
                onChange={(e) =>
                  setAccessForm((p) => ({ ...p, username: e.target.value }))
                }
                placeholder="Enter username"
                required
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">Email</label>
              <input
                className="mr-input mr-input-plain"
                type="email"
                value={accessForm.email}
                onChange={(e) =>
                  setAccessForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="Enter email"
                required
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">Phone</label>
              <input
                className="mr-input mr-input-plain"
                value={accessForm.phone}
                onChange={(e) =>
                  setAccessForm((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="Enter phone"
              />
            </div>

            <div className="mr-field">
              <label className="mr-label">Auto Generate Temp Password</label>
              <select
                className="mr-select"
                value={accessForm.auto_generate_password ? "1" : "0"}
                onChange={(e) =>
                  setAccessForm((p) => ({
                    ...p,
                    auto_generate_password: e.target.value === "1",
                  }))
                }
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>

            {!accessForm.auto_generate_password ? (
              <div className="mr-field">
                <label className="mr-label">Temporary Password</label>
                <input
                  className="mr-input mr-input-plain"
                  type="text"
                  value={accessForm.temp_password}
                  onChange={(e) =>
                    setAccessForm((p) => ({
                      ...p,
                      temp_password: e.target.value,
                    }))
                  }
                  placeholder="At least 12 chars, upper/lower/number/special"
                />
              </div>
            ) : null}

            <div className="mr-field">
              <label className="mr-label">Active</label>
              <select
                className="mr-select"
                value={accessForm.is_active ? "1" : "0"}
                onChange={(e) =>
                  setAccessForm((p) => ({
                    ...p,
                    is_active: e.target.value === "1",
                  }))
                }
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mr-form-actions">
            <button
              type="button"
              className="mr-btn mr-btn-secondary"
              onClick={closeCreate}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="mr-btn mr-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Create Linked Account"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editingRoleRow}
        title="Edit Access"
        subtitle="Update the access role and account status."
        onClose={closeRoleEditor}
      >
        <form className="mr-form" onSubmit={saveRoleEditor}>
          <div className="mr-form-grid mr-grid-2">
            <div className="mr-field">
              <label className="mr-label">Role</label>
              <select
                className="mr-select"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              >
                {ACCESS_ROLE_OPTIONS.map((role) => (
                  <option
                    key={role.value}
                    value={role.value}
                    disabled={role.value === "member"}
                  >
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mr-field">
              <label className="mr-label">Status</label>
              <select
                className="mr-select"
                value={editActive ? "1" : "0"}
                onChange={(e) => setEditActive(e.target.value === "1")}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mr-form-actions">
            <button
              type="button"
              className="mr-btn mr-btn-secondary"
              onClick={closeRoleEditor}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="mr-btn mr-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!resetRow}
        title="Reset Password"
        subtitle="Generate a secure temporary password or set one manually."
        onClose={closeResetPassword}
      >
        <form className="mr-form" onSubmit={submitResetPassword}>
          <div className="mr-form-grid mr-grid-1">
            <div className="mr-field">
              <label className="mr-label">Auto generate password</label>
              <select
                className="mr-select"
                value={resetAutoGenerate ? "1" : "0"}
                onChange={(e) => setResetAutoGenerate(e.target.value === "1")}
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>

            {!resetAutoGenerate ? (
              <div className="mr-field">
                <label className="mr-label">Temporary Password</label>
                <input
                  className="mr-input mr-input-plain"
                  type="text"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="At least 12 chars, upper/lower/number/special"
                />
              </div>
            ) : null}
          </div>

          <div className="mr-form-actions">
            <button
              type="button"
              className="mr-btn mr-btn-secondary"
              onClick={closeResetPassword}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="mr-btn mr-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Reset Password"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}