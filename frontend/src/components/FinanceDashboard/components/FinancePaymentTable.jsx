import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CreditCard,
  Eye,
  FileText,
  Mail,
  MoreHorizontal,
  Receipt,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";

import "../../../styles/finance-enterprise.css";

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numberValue(value));
}

function clean(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function pretty(value) {
  return clean(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "--";

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[2]}/${match[3]}/${match[1]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function paymentId(row) {
  return row?.id || row?.payment_id || row?.finance_payment_id || "";
}

function paymentNumber(row) {
  return clean(row?.payment_number || row?.payment_no || row?.transaction_number);
}

function payerName(row) {
  return clean(
    row?.full_name_snapshot ||
      row?.payer_name ||
      row?.member_name ||
      row?.donor_name ||
      row?.guest_name ||
      row?.full_name,
    "Guest Donor"
  );
}

function payerEmail(row) {
  return clean(
    row?.email_snapshot ||
      row?.payer_email ||
      row?.member_email ||
      row?.donor_email ||
      row?.guest_email ||
      row?.email,
    ""
  );
}

function paymentAmount(row) {
  return numberValue(row?.amount || row?.payment_amount || row?.total_amount);
}

function paymentDate(row) {
  return row?.paid_at || row?.payment_date || row?.received_at || row?.created_at;
}

function paymentMethod(row) {
  return clean(row?.method || row?.payment_method || row?.payment_method_type);
}

function paymentReference(row) {
  return clean(
    row?.reference_no ||
      row?.reference_number ||
      row?.transaction_reference ||
      row?.stripe_payment_intent_id ||
      row?.stripe_charge_id ||
      row?.check_number ||
      row?.zelle_reference
  );
}

function paymentStatus(row) {
  return clean(row?.status || row?.payment_status || "pending");
}

function categoryLabel(row) {
  const category = row?.category || row?.payment_type || row?.finance_category;
  const sub = row?.sub_category || row?.donation_category || row?.program_name;

  if (sub) {
    return `${pretty(category)} / ${pretty(sub)}`;
  }

  return pretty(category || "finance");
}

function cardLabel(row) {
  const brand = row?.card_brand || row?.brand;
  const last4 = row?.card_last4 || row?.last4 || row?.card_last_4;

  if (brand && last4) return `${String(brand).toUpperCase()} **** ${last4}`;
  if (last4) return `**** ${last4}`;

  return clean(row?.payment_method_label || row?.provider || row?.gateway);
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["paid", "completed", "posted", "succeeded", "success"].includes(status)) {
    return "success";
  }

  if (["pending", "processing", "open", "review"].includes(status)) {
    return "warning";
  }

  if (["failed", "cancelled", "void", "refunded", "returned"].includes(status)) {
    return "danger";
  }

  return "neutral";
}

function methodClass(value) {
  const method = String(value || "").toLowerCase();

  if (["card", "ach"].includes(method)) return "success";
  if (["cash", "check", "zelle"].includes(method)) return "warning";

  return "neutral";
}

function sortValue(row, key) {
  switch (key) {
    case "date":
      return paymentDate(row) ? new Date(paymentDate(row)).getTime() : 0;
    case "payment":
      return paymentNumber(row);
    case "payer":
      return payerName(row);
    case "category":
      return categoryLabel(row);
    case "amount":
      return paymentAmount(row);
    case "method":
      return paymentMethod(row);
    case "status":
      return paymentStatus(row);
    case "receipt":
      return row.receipt_number || "";
    case "invoice":
      return row.invoice_number || "";
    default:
      return row?.[key] || "";
  }
}

function compareValues(a, b, direction) {
  const dir = direction === "asc" ? 1 : -1;

  if (typeof a === "number" || typeof b === "number") {
    return (numberValue(a) - numberValue(b)) * dir;
  }

  return String(a ?? "").localeCompare(String(b ?? "")) * dir;
}

function SortButton({ label, field, sort, onSort }) {
  const active = sort.field === field;
  const Icon = sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      className={`finance-table-sort ${active ? "active" : ""}`}
      onClick={() => onSort(field)}
    >
      <span>{label}</span>
      {active ? <Icon size={13} /> : null}
    </button>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`finance-status ${statusClass(status)}`}>
      {pretty(status)}
    </span>
  );
}

export default function FinancePaymentTable({
  rows = [],
  loading = false,
  selectedIds = null,
  onSelectionChange,
  onOpenPayment,
  onViewReceipt,
  onViewInvoice,
  onEmailReceipt,
  onRefund,
  onVoid,
  onReconcile,
  onRetry,
  emptyMessage = "No finance payments found.",
}) {
  const [internalSelected, setInternalSelected] = useState({});
  const [sort, setSort] = useState({
    field: "date",
    direction: "desc",
  });
  const [openActionId, setOpenActionId] = useState("");

  const controlled = Array.isArray(selectedIds);

  const selectedMap = useMemo(() => {
    if (!controlled) return internalSelected;

    return selectedIds.reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
  }, [controlled, selectedIds, internalSelected]);

  const sortedRows = useMemo(() => {
    const next = [...rows];

    next.sort((a, b) =>
      compareValues(
        sortValue(a, sort.field),
        sortValue(b, sort.field),
        sort.direction
      )
    );

    return next;
  }, [rows, sort]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedMap[paymentId(row)]),
    [rows, selectedMap]
  );

  const selectedTotal = selectedRows.reduce(
    (sum, row) => sum + paymentAmount(row),
    0
  );

  const allVisibleSelected =
    sortedRows.length > 0 &&
    sortedRows.every((row) => selectedMap[paymentId(row)]);

  function emitSelection(nextMap) {
    const nextIds = Object.entries(nextMap)
      .filter(([, checked]) => checked)
      .map(([id]) => id);

    const nextRows = rows.filter((row) => nextMap[paymentId(row)]);

    if (!controlled) {
      setInternalSelected(nextMap);
    }

    onSelectionChange?.(nextIds, nextRows);
  }

  function toggleRow(row, checked) {
    const id = paymentId(row);

    if (!id) return;

    emitSelection({
      ...selectedMap,
      [id]: checked,
    });
  }

  function toggleAll(checked) {
    if (!checked) {
      emitSelection({});
      return;
    }

    const next = { ...selectedMap };

    sortedRows.forEach((row) => {
      const id = paymentId(row);
      if (id) next[id] = true;
    });

    emitSelection(next);
  }

  function handleSort(field) {
    setSort((current) => {
      if (current.field === field) {
        return {
          field,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        field,
        direction: field === "date" || field === "amount" ? "desc" : "asc",
      };
    });
  }

  function actionButton(label, Icon, handler, row, danger = false) {
    return (
      <button
        type="button"
        className={`finance-mini-btn ${danger ? "danger" : ""}`}
        onClick={() => {
          setOpenActionId("");
          handler?.(row);
        }}
      >
        <Icon size={13} />
        {label}
      </button>
    );
  }

  return (
    <div className="finance-payment-table-wrap">
      {selectedRows.length ? (
        <div className="finance-bulk-bar">
          <div>
            <strong>{selectedRows.length}</strong> selected
            <span>{money(selectedTotal)}</span>
          </div>

          <div>
            <button
              type="button"
              className="finance-btn"
              onClick={() => onReconcile?.(selectedRows)}
            >
              <ShieldCheck size={15} />
              Reconcile
            </button>

            <button
              type="button"
              className="finance-btn"
              onClick={() => onEmailReceipt?.(selectedRows)}
            >
              <Mail size={15} />
              Email Receipts
            </button>

            <button
              type="button"
              className="finance-btn danger"
              onClick={() => onRefund?.(selectedRows)}
            >
              <RotateCcw size={15} />
              Refund
            </button>
          </div>
        </div>
      ) : null}

      <div className="finance-table-shell">
        <table className="finance-table">
          <thead>
            <tr>
              <th className="finance-check-col">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                  aria-label="Select all visible payments"
                />
              </th>

              <th>
                <SortButton label="Date" field="date" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Payment #" field="payment" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Member / Payer" field="payer" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Category" field="category" sort={sort} onSort={handleSort} />
              </th>

              <th className="text-right">
                <SortButton label="Amount" field="amount" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Method" field="method" sort={sort} onSort={handleSort} />
              </th>

              <th>Reference</th>

              <th>
                <SortButton label="Status" field="status" sort={sort} onSort={handleSort} />
              </th>

              <th>Invoice</th>
              <th>Receipt</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12}>
                  <div className="finance-audit-empty">Loading finance payments...</div>
                </td>
              </tr>
            ) : null}

            {!loading && !sortedRows.length ? (
              <tr>
                <td colSpan={12}>
                  <div className="finance-audit-empty">
                    <AlertTriangle size={16} />
                    {emptyMessage}
                  </div>
                </td>
              </tr>
            ) : null}

            {!loading &&
              sortedRows.map((row) => {
                const id = paymentId(row);
                const status = paymentStatus(row);

                return (
                  <tr key={id || paymentNumber(row)}>
                    <td className="finance-check-col">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedMap[id])}
                        onChange={(event) => toggleRow(row, event.target.checked)}
                        aria-label={`Select payment ${paymentNumber(row)}`}
                      />
                    </td>

                    <td>{formatDate(paymentDate(row))}</td>

                    <td>
                      <button
                        type="button"
                        className="finance-link-button"
                        onClick={() => onOpenPayment?.(row)}
                      >
                        {paymentNumber(row)}
                      </button>
                      <small>{clean(row.provider || row.gateway || row.source)}</small>
                    </td>

                    <td>
                      <div className="finance-cell-stack">
                        <strong>{payerName(row)}</strong>
                        <small>
                          <User size={12} />
                          {clean(row.member_no || payerEmail(row))}
                        </small>
                      </div>
                    </td>

                    <td>
                      <span className="finance-chip">{categoryLabel(row)}</span>
                    </td>

                    <td className="text-right">
                      <strong>{money(paymentAmount(row))}</strong>
                    </td>

                    <td>
                      <span className={`finance-status ${methodClass(paymentMethod(row))}`}>
                        <CreditCard size={13} />
                        {pretty(paymentMethod(row))}
                      </span>
                      <small>{cardLabel(row)}</small>
                    </td>

                    <td>
                      <span className="finance-mono">{paymentReference(row)}</span>
                    </td>

                    <td>
                      <StatusBadge status={status} />
                    </td>

                    <td>
                      {row.invoice_number ? (
                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => onViewInvoice?.(row)}
                        >
                          <FileText size={13} />
                          {row.invoice_number}
                        </button>
                      ) : (
                        "--"
                      )}
                    </td>

                    <td>
                      {row.receipt_number ? (
                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => onViewReceipt?.(row)}
                        >
                          <Receipt size={13} />
                          {row.receipt_number}
                        </button>
                      ) : (
                        "--"
                      )}
                    </td>

                    <td>
                      <div className="finance-row-action-menu">
                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() =>
                            setOpenActionId(openActionId === id ? "" : id)
                          }
                        >
                          <MoreHorizontal size={14} />
                          Actions
                        </button>

                        {openActionId === id ? (
                          <div className="finance-action-popover">
                            {actionButton("View", Eye, onOpenPayment, row)}
                            {actionButton("Invoice", FileText, onViewInvoice, row)}
                            {actionButton("Receipt", Receipt, onViewReceipt, row)}
                            {actionButton("Email Receipt", Mail, onEmailReceipt, row)}
                            {actionButton("Reconcile", ShieldCheck, onReconcile, row)}
                            {actionButton("Retry", RefreshCcw, onRetry, row)}
                            {actionButton("Refund", RotateCcw, onRefund, row, true)}
                            {actionButton("Void", XCircle, onVoid, row, true)}
                          </div>
                        ) : null}
                      </div>
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