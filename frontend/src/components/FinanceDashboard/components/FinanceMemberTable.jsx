// frontend/src/components/FinanceDashboard/components/FinanceMemberTable.jsx

import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CreditCard,
  Eye,
  FileText,
  Mail,
  MoreHorizontal,
  Receipt,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

import "../../../styles/finance-enterprise.css";

function valueOf(row, keys, fallback = "--") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function numberValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return numberValue(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value) {
  if (!value) return "--";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function pretty(value) {
  return String(value || "--")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function rowId(row) {
  return String(valueOf(row, ["id", "member_id", "memberId"], ""));
}

function memberNo(row) {
  return valueOf(row, ["member_no", "member_number", "member_id_no"], "--");
}

function memberName(row) {
  const full = valueOf(row, ["full_name", "member_name", "name"], "");

  if (full) return full;

  return [row?.first_name, row?.last_name].filter(Boolean).join(" ") || "--";
}

function memberEmail(row) {
  return valueOf(row, ["email", "member_email", "email_snapshot"], "--");
}

function memberPhone(row) {
  return valueOf(row, ["phone", "member_phone", "phone_snapshot"], "--");
}

function membershipStatus(row) {
  return valueOf(
    row,
    ["membership_status", "member_status", "status"],
    "unknown"
  );
}

function accountStatus(row) {
  return valueOf(
    row,
    ["account_status", "user_status", "login_status"],
    row?.user_id ? "active" : "not_created"
  );
}

function paymentStatus(row) {
  return valueOf(
    row,
    ["payment_status", "registration_fee_status", "dues_status"],
    "unknown"
  );
}

function balanceDue(row) {
  return numberValue(
    valueOf(
      row,
      [
        "balance_due",
        "outstanding_balance",
        "remaining_balance",
        "open_balance",
      ],
      0
    )
  );
}

function totalPaid(row) {
  return numberValue(
    valueOf(row, ["total_paid", "paid_total", "lifetime_paid"], 0)
  );
}

function dependentsCount(row) {
  return numberValue(
    valueOf(row, ["dependents_count", "dependent_count", "children_count"], 0)
  );
}

function registeredDate(row) {
  return valueOf(row, ["registered_at", "created_at", "membership_start_date"], "");
}

function statusTone(value) {
  const status = String(value || "").toLowerCase();

  if (
    ["active", "paid", "completed", "approved", "cleared", "current"].includes(
      status
    )
  ) {
    return "success";
  }

  if (
    [
      "pending",
      "pending_payment",
      "partial",
      "processing",
      "open",
      "draft",
    ].includes(status)
  ) {
    return "warning";
  }

  if (
    ["inactive", "failed", "cancelled", "void", "overdue", "expired"].includes(
      status
    )
  ) {
    return "danger";
  }

  return "neutral";
}

function FinanceStatusPill({ value }) {
  const label = pretty(value);

  return (
    <span className={`finance-status ${statusTone(value)}`}>
      {label}
    </span>
  );
}

function SortButton({ active, direction, children, onClick }) {
  return (
    <button
      type="button"
      className={`finance-table-sort ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span>{children}</span>
      {active ? (
        direction === "asc" ? (
          <ArrowUp size={13} />
        ) : (
          <ArrowDown size={13} />
        )
      ) : null}
    </button>
  );
}

function sortValue(row, key) {
  if (key === "member_no") return memberNo(row);
  if (key === "name") return memberName(row);
  if (key === "membership") return membershipStatus(row);
  if (key === "account") return accountStatus(row);
  if (key === "payment") return paymentStatus(row);
  if (key === "dependents") return dependentsCount(row);
  if (key === "balance") return balanceDue(row);
  if (key === "total_paid") return totalPaid(row);
  if (key === "registered") return registeredDate(row);

  return valueOf(row, [key], "");
}

function compareRows(a, b, key, direction) {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);

  const an = Number(av);
  const bn = Number(bv);

  let result;

  if (Number.isFinite(an) && Number.isFinite(bn)) {
    result = an - bn;
  } else {
    result = String(av || "").localeCompare(String(bv || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  return direction === "asc" ? result : -result;
}

export default function FinanceMemberTable({
  rows = [],
  loading = false,
  error = "",
  selectedIds,
  onSelectionChange,
  onOpenMember,
  onEditMember,
  onCreatePayment,
  onCreateInvoice,
  onOpenReceipts,
  onOpenLedger,
  onOpenCoverage,
  onAddDependent,
  onStatement,
  onLinkedAccount,
  onSendWelcome,
  onDeactivate,
  onReactivate,
  emptyMessage = "No members found.",
}) {
  const [localSelected, setLocalSelected] = useState([]);
  const [sort, setSort] = useState({
    key: "registered",
    direction: "desc",
  });
  const [openMenu, setOpenMenu] = useState("");

  const controlled = Array.isArray(selectedIds);
  const selected = controlled ? selectedIds : localSelected;

  const selectedSet = useMemo(() => new Set(selected.map(String)), [selected]);

  const visibleRows = useMemo(() => {
    return [...rows].sort((a, b) => compareRows(a, b, sort.key, sort.direction));
  }, [rows, sort]);

  const allVisibleSelected =
    visibleRows.length > 0 &&
    visibleRows.every((row) => selectedSet.has(rowId(row)));

  function setSelected(next) {
    const clean = Array.from(new Set(next.map(String)));

    if (!controlled) {
      setLocalSelected(clean);
    }

    onSelectionChange?.(clean);
  }

  function toggleOne(id) {
    if (!id) return;

    const next = new Set(selectedSet);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    setSelected(Array.from(next));
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visible = new Set(visibleRows.map(rowId));
      setSelected(selected.filter((id) => !visible.has(String(id))));
      return;
    }

    setSelected([...selected, ...visibleRows.map(rowId)]);
  }

  function changeSort(key) {
    setSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: key === "registered" ? "desc" : "asc",
      };
    });
  }

  function run(action, row) {
    setOpenMenu("");
    action?.(row);
  }

  const columns = [
    ["member_no", "Member ID"],
    ["name", "Member"],
    ["membership", "Membership"],
    ["account", "Account"],
    ["payment", "Payment"],
    ["dependents", "Dependents"],
    ["balance", "Balance"],
    ["total_paid", "Total Paid"],
    ["registered", "Registered"],
  ];

  if (error) {
    return (
      <div className="finance-table-shell">
        <div className="finance-alert danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="finance-table-shell">
      {selected.length ? (
        <div className="finance-bulk-bar">
          <strong>{selected.length} selected</strong>

          <div className="finance-bulk-actions">
            <button
              type="button"
              className="finance-btn secondary"
              onClick={() => onStatement?.(selected)}
            >
              <FileText size={16} />
              Statement
            </button>

            <button
              type="button"
              className="finance-btn secondary"
              onClick={() => onCreatePayment?.(selected)}
            >
              <Wallet size={16} />
              Payment
            </button>

            <button
              type="button"
              className="finance-btn secondary"
              onClick={() => onCreateInvoice?.(selected)}
            >
              <CreditCard size={16} />
              Invoice
            </button>

            <button
              type="button"
              className="finance-btn ghost"
              onClick={() => setSelected([])}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <div className="finance-table-scroll">
        <table className="finance-table finance-member-table">
          <thead>
            <tr>
              <th className="finance-check-col">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible members"
                />
              </th>

              {columns.map(([key, label]) => (
                <th key={key}>
                  <SortButton
                    active={sort.key === key}
                    direction={sort.direction}
                    onClick={() => changeSort(key)}
                  >
                    {label}
                  </SortButton>
                </th>
              ))}

              <th className="finance-actions-col">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + 2}>
                  <div className="finance-audit-empty">Loading members...</div>
                </td>
              </tr>
            ) : null}

            {!loading && !visibleRows.length ? (
              <tr>
                <td colSpan={columns.length + 2}>
                  <div className="finance-audit-empty">{emptyMessage}</div>
                </td>
              </tr>
            ) : null}

            {!loading &&
              visibleRows.map((row) => {
                const id = rowId(row);
                const isSelected = selectedSet.has(id);
                const menuOpen = openMenu === id;
                const inactive =
                  String(membershipStatus(row)).toLowerCase() === "inactive";

                return (
                  <tr key={id || memberNo(row)} className={isSelected ? "is-selected" : ""}>
                    <td className="finance-check-col">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(id)}
                        aria-label={`Select ${memberName(row)}`}
                      />
                    </td>

                    <td>
                      <button
                        type="button"
                        className="finance-link-button"
                        onClick={() => run(onOpenMember, row)}
                      >
                        {memberNo(row)}
                      </button>
                    </td>

                    <td>
                      <div className="finance-cell-stack">
                        <strong>{memberName(row)}</strong>
                        <span>{memberEmail(row)}</span>
                        <small>{memberPhone(row)}</small>
                      </div>
                    </td>

                    <td>
                      <div className="finance-cell-stack">
                        <FinanceStatusPill value={membershipStatus(row)} />
                        <small>
                          Start:{" "}
                          {formatDate(
                            valueOf(
                              row,
                              ["membership_start_date", "start_date", "joined_at"],
                              ""
                            )
                          )}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div className="finance-cell-stack">
                        <FinanceStatusPill value={accountStatus(row)} />
                        <small>
                          {valueOf(row, ["username", "login_username"], "--")}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div className="finance-cell-stack">
                        <FinanceStatusPill value={paymentStatus(row)} />
                        <small>
                          Due:{" "}
                          {formatDate(
                            valueOf(row, ["next_due_at", "due_date"], "")
                          )}
                        </small>
                      </div>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="finance-mini-btn"
                        onClick={() => run(onAddDependent, row)}
                      >
                        <Users size={14} />
                        {dependentsCount(row)}
                      </button>
                    </td>

                    <td>
                      <strong className={balanceDue(row) > 0 ? "finance-danger-text" : ""}>
                        {money(balanceDue(row))}
                      </strong>
                    </td>

                    <td>
                      <strong>{money(totalPaid(row))}</strong>
                    </td>

                    <td>{formatDate(registeredDate(row))}</td>

                    <td className="finance-row-actions">
                      <button
                        type="button"
                        className="finance-icon-btn"
                        onClick={() => run(onOpenMember, row)}
                        title="View member"
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        type="button"
                        className="finance-icon-btn"
                        onClick={() => setOpenMenu(menuOpen ? "" : id)}
                        title="More actions"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {menuOpen ? (
                        <div className="finance-action-popover">
                          <button type="button" onClick={() => run(onEditMember, row)}>
                            <UserCog size={15} />
                            Edit profile
                          </button>

                          <button type="button" onClick={() => run(onCreatePayment, row)}>
                            <Wallet size={15} />
                            Create payment
                          </button>

                          <button type="button" onClick={() => run(onCreateInvoice, row)}>
                            <CreditCard size={15} />
                            Create invoice
                          </button>

                          <button type="button" onClick={() => run(onOpenReceipts, row)}>
                            <Receipt size={15} />
                            Receipts
                          </button>

                          <button type="button" onClick={() => run(onOpenLedger, row)}>
                            <FileText size={15} />
                            Ledger
                          </button>

                          <button type="button" onClick={() => run(onOpenCoverage, row)}>
                            <ShieldCheck size={15} />
                            Coverage
                          </button>

                          <button type="button" onClick={() => run(onAddDependent, row)}>
                            <UserPlus size={15} />
                            Add dependent
                          </button>

                          <button type="button" onClick={() => run(onStatement, row)}>
                            <FileText size={15} />
                            Statement
                          </button>

                          <button type="button" onClick={() => run(onLinkedAccount, row)}>
                            <UserCog size={15} />
                            Login account
                          </button>

                          <button type="button" onClick={() => run(onSendWelcome, row)}>
                            <Mail size={15} />
                            Send welcome
                          </button>

                          {inactive ? (
                            <button type="button" onClick={() => run(onReactivate, row)}>
                              <ShieldCheck size={15} />
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="danger"
                              onClick={() => run(onDeactivate, row)}
                            >
                              <XCircle size={15} />
                              Deactivate
                            </button>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}