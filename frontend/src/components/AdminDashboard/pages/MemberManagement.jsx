
// src/components/AdminDashboard/pages/MemberManagement.jsx

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import api from "../../api";

import AdminTablePage from "../components/AdminTablePage";

import "../../../styles/admin-members-roles.css";

const emptyMemberForm = {
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
  is_active: 1,
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

    document.addEventListener(
      "mousedown",
      handleOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutside
      );
    };
  }, []);

  return (
    <div
      className="admin-kebab-wrap"
      ref={wrapRef}
    >
      <button
        type="button"
        className="admin-kebab-btn"
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
              className={`admin-kebab-item ${
                item.danger
                  ? "admin-kebab-item-danger"
                  : ""
              }`}
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

function Modal({
  open,
  title,
  children,
  onClose,
}) {
  if (!open) return null;

  return (
    <div
      className="mr-modal-overlay"
      onClick={onClose}
    >
      <div
        className="mr-modal-card mr-modal-card-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mr-modal-head">
          <h3>{title}</h3>

          <button
            type="button"
            className="mr-btn mr-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <div>
      <label className="mr-label">
        {label}
      </label>

      {children}
    </div>
  );
}

function inputStyle() {
  return {
    width: "100%",
    border: "1px solid #d7dfeb",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    background: "#fff",
    color: "#122033",
  };
}

export default function MemberManagement() {
  const navigate = useNavigate();

  const [banner, setBanner] =
    useState({
      type: "",
      text: "",
    });

  const [
    memberModalOpen,
    setMemberModalOpen,
  ] = useState(false);

  const [memberForm, setMemberForm] =
    useState(emptyMemberForm);

  const [
    editingMemberId,
    setEditingMemberId,
  ] = useState(null);

  const [savingMember, setSavingMember] =
    useState(false);

  const [
    resettingPassword,
    setResettingPassword,
  ] = useState(false);

  const [
    householdType,
    setHouseholdType,
  ] = useState("");

  const extraFilters = useMemo(
    () => [
      {
        key: "householdType",
        value: householdType,
        onChange: setHouseholdType,
        options: [
          {
            value: "",
            label: "All Members",
          },
          {
            value: "independent",
            label:
              "Independent Members",
          },
          {
            value: "with_dependents",
            label:
              "Members with Dependents",
          },
        ],
      },
    ],
    [householdType]
  );

  function openMemberDocuments(
    memberId
  ) {
    navigate(
      `/dash/admin/member-documents/${memberId}`
    );
  }

  function resetMemberModal() {
    setEditingMemberId(null);

    setMemberForm(
      emptyMemberForm
    );

    setMemberModalOpen(false);
  }

  async function handleSaveMember() {
    try {
      setSavingMember(true);

      setBanner({
        type: "",
        text: "",
      });

      if (editingMemberId) {
        const { data } =
          await api.put(
            `/finance/members/${editingMemberId}`,
            memberForm
          );

        setBanner({
          type: "success",
          text:
            data?.message ||
            "Member updated successfully.",
        });
      } else {
        const { data } =
          await api.post(
            "/finance/members",
            memberForm
          );

        setBanner({
          type: "success",
          text:
            data?.message ||
            "Member created successfully.",
        });
      }

      resetMemberModal();
    } catch (err) {
      console.error(err);

      setBanner({
        type: "error",
        text:
          err?.response?.data?.error ||
          "Failed to save member.",
      });
    } finally {
      setSavingMember(false);
    }
  }

  async function handleDeleteMember(
    row
  ) {
    const confirmed =
      window.confirm(
        `Delete member "${row.full_name}"?`
      );

    if (!confirmed) return;

    try {
      const { data } =
        await api.delete(
          `/admin/users/${row.id}`
        );

      setBanner({
        type: "success",
        text:
          data?.message ||
          "Member deleted successfully.",
      });
    } catch (err) {
      console.error(err);

      setBanner({
        type: "error",
        text:
          err?.response?.data?.error ||
          "Failed to delete member.",
      });
    }
  }

  async function handleResetPassword(
    row
  ) {
    const confirmed =
      window.confirm(
        `Send password reset email to ${
          row.full_name ||
          row.email
        }?`
      );

    if (!confirmed) return;

    try {
      setResettingPassword(true);

      const { data } =
        await api.patch(
          `/admin/accounts/${row.id}/reset-password`,
          {
            send_email: true,
          }
        );

      setBanner({
        type: "success",
        text:
          data?.message ||
          "Password reset email sent successfully.",
      });
    } catch (err) {
      console.error(err);

      setBanner({
        type: "error",
        text:
          err?.response?.data?.error ||
          "Failed to send password reset.",
      });
    } finally {
      setResettingPassword(false);
    }
  }

  const columns = [
    {
      key: "member_no",
      label: "Member No",
    },

    {
      key: "full_name",
      label: "Full Name",
    },

    {
      key: "email",
      label: "Email",
    },

    {
      key: "phone",
      label: "Phone",
    },

    {
      key: "membership_status",
      label: "Membership Status",

      render: (
        value,
        row,
        helpers
      ) => (
        <helpers.AdminStatusBadge
          status={String(
            value ??
              row.membership_status ??
              "--"
          )}
        />
      ),
    },

    {
      key: "actions",

      label: "Actions",

      render: (_, row) => (
        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
          }}
        >
          <ActionMenu
            items={[
              {
                label: "Documents",

                onClick: () =>
                  openMemberDocuments(
                    row.id
                  ),
              },

              {
                label:
                  resettingPassword
                    ? "Sending Reset..."
                    : "Reset Password",

                onClick: () =>
                  handleResetPassword(
                    row
                  ),
              },

              {
                label: "Edit",

                onClick: () => {
                  setEditingMemberId(
                    row.id
                  );

                  setMemberForm({
                    first_name:
                      row.first_name ||
                      "",

                    last_name:
                      row.last_name ||
                      "",

                    email:
                      row.email || "",

                    phone:
                      row.phone || "",

                    address_line1:
                      row.address_line1 ||
                      "",

                    address_line2:
                      row.address_line2 ||
                      "",

                    city:
                      row.city || "",

                    state:
                      row.state || "",

                    zip:
                      row.zip || "",

                    member_type:
                      row.member_type ||
                      "existing",

                    status:
                      row.status ||
                      "active",

                    membership_status:
                      row.membership_status ||
                      "active",

                    is_active:
                      Number(
                        row.is_active || 0
                      ),
                  });

                  setMemberModalOpen(
                    true
                  );
                },
              },

              {
                label: "Delete",

                danger: true,

                onClick: () =>
                  handleDeleteMember(
                    row
                  ),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="mr-page">
      {banner.text ? (
        <div
          className={`mr-banner ${
            banner.type ===
            "error"
              ? "mr-banner-error"
              : ""
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <AdminTablePage
        title="Member Management"
        subtitle="Create, manage, reset passwords, and maintain linked church member accounts."
        endpoint="/admin/users"
        pageSize={10}
        extraFilters={
          extraFilters
        }
        searchPlaceholder="Search by member number, member name, email, phone, or location..."
        columns={columns}
        actions={[
          {
            label: "Add Member",

            variant: "primary",

            onClick: () => {
              setEditingMemberId(
                null
              );

              setMemberForm(
                emptyMemberForm
              );

              setMemberModalOpen(
                true
              );
            },
          },
        ]}
        emptyTitle="No member records found"
        emptyMessage="Members will appear here after registration or finance creation."
      />

      <Modal
        open={memberModalOpen}
        title={
          editingMemberId
            ? "Edit Member"
            : "Add Member"
        }
        onClose={
          resetMemberModal
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          <Field label="First Name">
            <input
              style={
                inputStyle()
              }
              value={
                memberForm.first_name
              }
              onChange={(e) =>
                setMemberForm(
                  (prev) => ({
                    ...prev,
                    first_name:
                      e.target.value,
                  })
                )
              }
            />
          </Field>

          <Field label="Last Name">
            <input
              style={
                inputStyle()
              }
              value={
                memberForm.last_name
              }
              onChange={(e) =>
                setMemberForm(
                  (prev) => ({
                    ...prev,
                    last_name:
                      e.target.value,
                  })
                )
              }
            />
          </Field>

          <Field label="Email">
            <input
              style={
                inputStyle()
              }
              value={
                memberForm.email
              }
              onChange={(e) =>
                setMemberForm(
                  (prev) => ({
                    ...prev,
                    email:
                      e.target.value,
                  })
                )
              }
            />
          </Field>

          <Field label="Phone">
            <input
              style={
                inputStyle()
              }
              value={
                memberForm.phone
              }
              onChange={(e) =>
                setMemberForm(
                  (prev) => ({
                    ...prev,
                    phone:
                      e.target.value,
                  })
                )
              }
            />
          </Field>

          <Field label="Address Line 1">
            <input
              style={
                inputStyle()
              }
              value={
                memberForm.address_line1
              }
              onChange={(e) =>
                setMemberForm(
                  (prev) => ({
                    ...prev,
                    address_line1:
                      e.target.value,
                  })
                )
              }
            />
          </Field>

          <Field label="Address Line 2">
            <input
              style={
                inputStyle()
              }
              value={
                memberForm.address_line2
              }
              onChange={(e) =>
                setMemberForm(
                  (prev) => ({
                    ...prev,
                    address_line2:
                      e.target.value,
                  })
                )
              }
            />
          </Field>

          <Field label="City">
            <input
              style={
                inputStyle()
              }
              value={
                memberForm.city
              }
              onChange={(e) =>
                setMemberForm(
                  (prev) => ({
                    ...prev,
                    city:
                      e.target.value,
                  })
                )
              }
            />
          </Field>

          <Field label="State">
            <input
              style={
                inputStyle()
              }
              value={
                memberForm.state
              }
              onChange={(e) =>
                setMemberForm(
                  (prev) => ({
                    ...prev,
                    state:
                      e.target.value,
                  })
                )
              }
            />
          </Field>

          <Field label="ZIP">
            <input
              style={
                inputStyle()
              }
              value={
                memberForm.zip
              }
              onChange={(e) =>
                setMemberForm(
                  (prev) => ({
                    ...prev,
                    zip:
                      e.target.value,
                  })
                )
              }
            />
          </Field>

          <Field label="Member Type">
            <select
              style={
                inputStyle()
              }
              value={
                memberForm.member_type
              }
              onChange={(e) =>
                setMemberForm(
                  (prev) => ({
                    ...prev,
                    member_type:
                      e.target.value,
                  })
                )
              }
            >
              <option value="existing">
                Existing
              </option>

              <option value="new">
                New
              </option>
            </select>
          </Field>
        </div>

        <div className="mr-form-actions">
          <button
            type="button"
            className="mr-btn mr-btn-secondary"
            onClick={
              resetMemberModal
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="mr-btn mr-btn-primary"
            onClick={
              handleSaveMember
            }
            disabled={
              savingMember
            }
          >
            {savingMember
              ? "Saving..."
              : editingMemberId
              ? "Update Member"
              : "Create Member"}
          </button>
        </div>
      </Modal>
    </div>
  );
}