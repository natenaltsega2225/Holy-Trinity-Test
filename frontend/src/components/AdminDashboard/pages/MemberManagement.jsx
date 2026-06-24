
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


import "../../../styles/admin-enterprise.css";
import "../../../styles/admin-table.css";
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

  // const [
  //   memberModalOpen,
  //   setMemberModalOpen,
  // ] = useState(false);

  // const [memberForm, setMemberForm] =
  //   useState(emptyMemberForm);

  // const [
  //   editingMemberId,
  //   setEditingMemberId,
  // ] = useState(null);

  // const [savingMember, setSavingMember] =
  //   useState(false);

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
async function toggleMemberStatus(
  row
) {
  try {
    const active =
      Number(row.is_active) === 1;

    const { data } =
      await api.patch(
        `/admin/users/${row.id}/status`,
        {
          is_active:
            active ? 0 : 1,
        }
      );

    setBanner({
      type: "success",
      text:
        data?.message ||
        "Account status updated.",
    });
  } catch (err) {
    console.error(err);

    setBanner({
      type: "error",
      text:
        err?.response?.data?.error ||
        "Failed to update account status.",
    });
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
    key: "role",
    label: "Role",

    render: (value) =>
      value || "Member",
  },

  {
    key: "is_active",
    label: "Account Status",

    render: (value, row, helpers) => (
      <helpers.AdminStatusBadge
        status={
          Number(value)
            ? "Active"
            : "Disabled"
        }
      />
    ),
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
    key: "last_login",
    label: "Last Login",

    render: (value) =>
      value
        ? new Date(
            value
          ).toLocaleDateString()
        : "--",
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
              label:
                Number(
                  row.is_active
                )
                  ? "Deactivate Account"
                  : "Activate Account",

              onClick: () =>
                toggleMemberStatus(
                  row
                ),
            },

            {
              label:
                "View Audit History",

              onClick: () =>
                navigate(
                  `/dash/admin/member-audit/${row.id}`
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
      title="Member Accounts"

subtitle="View member accounts, manage access, reset passwords, review documents, and monitor account activity. Member registration and profile maintenance are managed by the Finance Department."
        endpoint="/admin/users"
        pageSize={10}
        extraFilters={
          extraFilters
        }
        searchPlaceholder="Search by member number, member name, email, phone, or location..."
        columns={columns}
actions={[]}
        
        emptyTitle="No member records found"
       emptyMessage="No member accounts found. Member registrations are managed by the Finance Department."
      />

      
    </div>
  );
}