// frontend/src/components/FinanceDashboard/pages/MemberManagement.jsx

import React, {
  useMemo,
  useState,
} from "react";

import FinanceTablePage from "../components/FinanceTablePage";
import FinanceMemberModal from "../components/FinanceMemberModal";
import FinanceManualEntryModal from "../components/FinanceManualEntryModal";

import api from "../../../components/api";
import "../../../styles/finance-members-table.css";
export default function MemberManagement() {

  const [status, setStatus] =
    useState("");

  const [active, setActive] =
    useState("");

  const [
    householdType,
    setHouseholdType,
  ] = useState("");

  const [
    showMemberModal,
    setShowMemberModal,
  ] = useState(false);

  const [
    showPaymentModal,
    setShowPaymentModal,
  ] = useState(false);

  const [editRow, setEditRow] =
    useState(null);

  const [
    paymentRow,
    setPaymentRow,
  ] = useState(null);

  const [refreshKey, setRefreshKey] =
    useState(0);

  /* ======================================================
     FILTERS
  ====================================================== */

  const extraFilters = useMemo(
    () => [
      {
        key: "status",

        value: status,

        onChange: setStatus,

        options: [
          {
            value: "",
            label: "All statuses",
          },

          {
            value: "active",
            label: "Active",
          },

          {
            value: "pending",
            label: "Pending",
          },

          {
            value: "inactive",
            label: "Inactive",
          },

          {
            value: "delinquent",
            label: "Delinquent",
          },

          {
            value: "suspended",
            label: "Suspended",
          },
        ],
      },

      {
        key: "active",

        value: active,

        onChange: setActive,

        options: [
          {
            value: "",
            label: "All accounts",
          },

          {
            value: "1",
            label: "Active accounts",
          },

          {
            value: "0",
            label: "Inactive accounts",
          },
        ],
      },

      {
        key: "householdType",

        value: householdType,

        onChange:
          setHouseholdType,

        options: [
          {
            value: "",
            label: "All members",
          },

          {
            value: "independent",
            label: "Independent",
          },

          {
            value:
              "with_dependents",
            label:
              "With dependents",
          },
        ],
      },
    ],

    [
      status,
      active,
      householdType,
    ]
  );

  /* ======================================================
     HELPERS
  ====================================================== */

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(
    row
  ) {

    if (
      !window.confirm(
        `Delete ${row.full_name}?`
      )
    ) {
      return;
    }

    try {

      await api.delete(
        `/finance/members/${row.id}`
      );

      refresh();

    } catch (err) {

      alert(
        err?.response?.data?.error ||
        "Failed to delete member."
      );
    }
  }

  function openRegister() {
    setEditRow(null);

    setShowMemberModal(true);
  }

  function openEdit(row) {
    setEditRow(row);

    setShowMemberModal(true);
  }

  function openPayment(row) {
    setPaymentRow(row);

    setShowPaymentModal(true);
  }

function formatPhone(phone) {

  if (!phone) {
    return "--";
  }

  const digits =
    String(phone)
      .replace(/\D/g, "");

  if (digits.length === 10) {

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {

    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone;
}
  
  /* ======================================================
     TABLE COLUMNS
  ====================================================== */
const columns = [

  {
    key: "member_no",

    label: "Member ID",

    width: 140,

    render: (v) => (
      <div className="finance-member-no">
        {v || "--"}
      </div>
    ),
  },

  {
    key: "full_name",

    label: "Full Name",

    width: 220,

    render: (v) => (
      <div className="finance-member-name">
        {v || "--"}
      </div>
    ),
  },

  {
    key: "email",

    label: "Email",

    width: 260,

    render: (v) => (
      <div className="finance-member-email">
        {v || "--"}
      </div>
    ),
  },

  {
  key: "phone",

  label: "Phone",

  width: 170,

  render: (v) => (

    <div className="finance-member-phone">
      {formatPhone(v)}
    </div>
  ),
},

  {
    key: "membership_status",

    label: "Membership",

    width: 150,

    render: (v, _r, h) => (
      <h.FinanceStatusBadge
        status={String(v || "--")}
      />
    ),
  },

  {
    key: "status",

    label: "Account",

    width: 140,

    render: (v, _r, h) => (
      <h.FinanceStatusBadge
        status={String(v || "--")}
      />
    ),
  },

  {
    key: "payment_status",

    label: "Payment",

    width: 140,

    render: (v, _r, h) => (
      <h.FinanceStatusBadge
        status={String(v || "current")}
      />
    ),
  },

  {
    key: "dependents_count",

    label: "Dependents",

    width: 120,

    render: (v, row) => (
      <div className="finance-dependent-pill">
        {Number(
          v ||
          row.dependents_count ||
          0
        )}
      </div>
    ),
  },

  {
    key: "open_balance",

    label: "Balance",

    width: 140,

    render: (v, _r, h) =>
      h.formatMoney(v || 0),
  },

  {
    key: "total_paid",

    label: "Total Paid",

    width: 140,

    render: (v, _r, h) =>
      h.formatMoney(v || 0),
  },

  {
    key: "created_at",

    label: "Registered",

    width: 170,

    render: (v, _r, h) =>
      h.formatDate
        ? h.formatDate(v)
        : v || "--",
  },

  {
    key: "actions",

    label: "",

    width: 80,

    render: (_, row) => (

      <div className="finance-row-menu-wrap">

        <button
          type="button"
          className="finance-row-menu-btn"
        >
          ⋮
        </button>

        <div className="finance-row-menu-dropdown">

          <button
            type="button"
            className="finance-row-menu-item"
            onClick={() => {
              window.location.href =
                `/dash/finance/members/${row.id}`;
            }}
          >
            View Profile
          </button>

          <button
            type="button"
            className="finance-row-menu-item"
            onClick={() =>
              openPayment(row)
            }
          >
            Collect Payment
          </button>

          <button
            type="button"
            className="finance-row-menu-item"
            onClick={() => {
              window.location.href =
                `/dash/finance/payments?member_id=${row.id}`;
            }}
          >
            Payment History
          </button>

          <button
            type="button"
            className="finance-row-menu-item"
            onClick={() => {
              window.location.href =
                `/dash/finance/member-ledger?member_id=${row.id}`;
            }}
          >
            Ledger
          </button>

          <button
            type="button"
            className="finance-row-menu-item"
            onClick={() => {
              window.location.href =
                `/dash/finance/members/${row.id}?tab=dependents`;
            }}
          >
            Dependents
          </button>

          <button
            type="button"
            className="finance-row-menu-item"
            onClick={() =>
              openEdit(row)
            }
          >
            Edit
          </button>

          <button
            type="button"
            className="
              finance-row-menu-item
              finance-row-menu-danger
            "
            onClick={() =>
              handleDelete(row)
            }
          >
            Delete
          </button>

        </div>

      </div>
    ),
  },
];

  /* ======================================================
     UI
  ====================================================== */

  return (
    <>

      <FinanceTablePage

        key={refreshKey}

        title="Members"

  subtitle="Finance-managed members with registration, Stripe checkout, invoices, receipts, dependents, payment history, membership coverage, and ledger visibility."

        endpoint="/finance/members"

        columns={columns}

        extraFilters={extraFilters}

        pageSize={10}
searchPlaceholder="Search member number, name, email, phone, dependent, invoice, receipt, or payment..."
        defaultSortKey="created_at"

        defaultSortDirection="desc"

        actions={[

          {
            label:
              "Register New Member + Payment",

            variant: "primary",

            onClick:
              openRegister,
          },

          {
            label:
              "Record In-Person Payment",

            variant:
              "secondary",

            onClick: () => {

              setPaymentRow(
                null
              );

              setShowPaymentModal(
                true
              );
            },
          },
        ]}
      />

      <FinanceMemberModal
        mode={
          editRow
            ? "edit"
            : "register"
        }

        open={
          showMemberModal
        }

        onClose={() =>
          setShowMemberModal(
            false
          )
        }

        row={editRow}

        onSuccess={() => {

          setShowMemberModal(
            false
          );

          refresh();
        }}
      />

      <FinanceManualEntryModal

        open={
          showPaymentModal
        }

        member={paymentRow}

        defaultMemberId={
          paymentRow?.id || ""
        }

        defaultFullName={
          paymentRow?.full_name ||
          ""
        }

        defaultEmail={
          paymentRow?.email ||
          ""
        }

        onClose={() => {

          setShowPaymentModal(
            false
          );

          setPaymentRow(
            null
          );
        }}

        onSaved={() => {

          setShowPaymentModal(
            false
          );

          setPaymentRow(
            null
          );

          refresh();
        }}
      />

    </>
  );
}