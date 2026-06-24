import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  Download,
  Eye,
  FileText,
  Link2,
  Mail,
  MoreHorizontal,
  Printer,
  Receipt,
  RefreshCcw,
  Send,
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

function invoiceId(row) {
  return row?.id || row?.invoice_id || row?.finance_invoice_id || "";
}

function invoiceNumber(row) {
  return clean(row?.invoice_number || row?.invoice_no || row?.number);
}

function paymentNumber(row) {
  return clean(row?.payment_number || row?.payment_no || row?.transaction_number);
}

function receiptNumber(row) {
  return clean(row?.receipt_number || row?.receipt_no);
}

function billTo(row) {
  return clean(
    row?.full_name_snapshot ||
      row?.bill_to ||
      row?.payer_name ||
      row?.member_name ||
      row?.donor_name ||
      row?.guest_name ||
      row?.full_name,
    "Guest Donor"
  );
}

function billEmail(row) {
  return clean(
    row?.email_snapshot ||
      row?.recipient_email ||
      row?.payer_email ||
      row?.member_email ||
      row?.donor_email ||
      row?.guest_email ||
      row?.email,
    ""
  );
}

function totalAmount(row) {
  return numberValue(row?.total_amount || row?.amount || row?.invoice_amount);
}

function paidAmount(row) {
  const paid = numberValue(row?.paid_amount || row?.amount_paid || row?.collected_amount);
  const total = totalAmount(row);

  if (!total) return paid;

  return Math.min(Math.max(paid, 0), total);
}

function balanceDue(row) {
  const explicit =
    row?.balance_due ??
    row?.remaining_amount ??
    row?.outstanding_amount;

  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== "") {
    return Math.max(0, numberValue(explicit));
  }

  return Math.max(0, totalAmount(row) - paidAmount(row));
}

function invoiceDate(row) {
  return row?.invoice_date || row?.issued_at || row?.created_at || row?.date;
}

function dueDate(row) {
  return row?.due_date || row?.invoice_due_date;
}

function invoiceStatus(row) {
  return clean(row?.status || row?.invoice_status || "open");
}

function categoryLabel(row) {
  const category =
    row?.category ||
    row?.invoice_type ||
    row?.payment_type ||
    row?.donation_category;

  const sub =
    row?.sub_category ||
    row?.donation_category ||
    row?.program_name ||
    row?.campaign_name ||
    row?.coverage_label;

  if (category && sub && String(category).toLowerCase() !== String(sub).toLowerCase()) {
    return `${pretty(category)} / ${pretty(sub)}`;
  }

  return pretty(category || "finance");
}

function emailStatus(row) {
  return clean(row?.email_status || row?.invoice_email_status || row?.delivery_status);
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["paid", "sent", "delivered", "completed"].includes(status)) return "success";
  if (["open", "partial", "pending", "draft", "queued"].includes(status)) return "warning";
  if (["overdue", "cancelled", "void", "failed", "bounced"].includes(status)) return "danger";

  return "neutral";
}

function sortValue(row, key) {
  switch (key) {
    case "date":
      return invoiceDate(row) ? new Date(invoiceDate(row)).getTime() : 0;
    case "due":
      return dueDate(row) ? new Date(dueDate(row)).getTime() : 0;
    case "invoice":
      return invoiceNumber(row);
    case "bill_to":
      return billTo(row);
    case "category":
      return categoryLabel(row);
    case "total":
      return totalAmount(row);
    case "paid":
      return paidAmount(row);
    case "balance":
      return balanceDue(row);
    case "status":
      return invoiceStatus(row);
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

export default function FinanceInvoiceTable({
  rows = [],
  loading = false,
  selectedIds = null,
  onSelectionChange,
  onOpenInvoice,
  onPreview,
  onDownloadPdf,
  onPrint,
  onEmail,
  onResend,
  onPaymentLink,
  onMarkPaid,
  onVoid,
  onRefund,
  onOpenPayment,
  onOpenReceipt,
  emptyMessage = "No invoices found.",
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
    () => rows.filter((row) => selectedMap[invoiceId(row)]),
    [rows, selectedMap]
  );

  const selectedTotal = selectedRows.reduce((sum, row) => sum + totalAmount(row), 0);
  const selectedBalance = selectedRows.reduce((sum, row) => sum + balanceDue(row), 0);

  const allVisibleSelected =
    sortedRows.length > 0 &&
    sortedRows.every((row) => selectedMap[invoiceId(row)]);

  function emitSelection(nextMap) {
    const nextIds = Object.entries(nextMap)
      .filter(([, checked]) => checked)
      .map(([id]) => id);

    const nextRows = rows.filter((row) => nextMap[invoiceId(row)]);

    if (!controlled) {
      setInternalSelected(nextMap);
    }

    onSelectionChange?.(nextIds, nextRows);
  }

  function toggleRow(row, checked) {
    const id = invoiceId(row);

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
      const id = invoiceId(row);
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
        direction: ["date", "due", "total", "paid", "balance"].includes(field)
          ? "desc"
          : "asc",
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
    <div className="finance-invoice-table-wrap">
      {selectedRows.length ? (
        <div className="finance-bulk-bar">
          <div>
            <strong>{selectedRows.length}</strong> selected
            <span>Total {money(selectedTotal)}</span>
            <span>Balance {money(selectedBalance)}</span>
          </div>

          <div>
            <button
              type="button"
              className="finance-btn"
              onClick={() => onEmail?.(selectedRows)}
            >
              <Mail size={15} />
              Email
            </button>

            <button
              type="button"
              className="finance-btn"
              onClick={() => onPaymentLink?.(selectedRows)}
            >
              <Link2 size={15} />
              Payment Link
            </button>

            <button
              type="button"
              className="finance-btn"
              onClick={() => onDownloadPdf?.(selectedRows)}
            >
              <Download size={15} />
              PDF
            </button>

            <button
              type="button"
              className="finance-btn success"
              onClick={() => onMarkPaid?.(selectedRows)}
            >
              <ShieldCheck size={15} />
              Mark Paid
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
                  aria-label="Select all visible invoices"
                />
              </th>

              <th>
                <SortButton label="Date" field="date" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Invoice #" field="invoice" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Bill To" field="bill_to" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Category" field="category" sort={sort} onSort={handleSort} />
              </th>

              <th className="text-right">
                <SortButton label="Total" field="total" sort={sort} onSort={handleSort} />
              </th>

              <th className="text-right">
                <SortButton label="Paid" field="paid" sort={sort} onSort={handleSort} />
              </th>

              <th className="text-right">
                <SortButton label="Balance" field="balance" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Due" field="due" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Status" field="status" sort={sort} onSort={handleSort} />
              </th>

              <th>Email</th>
              <th>Payment / Receipt</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13}>
                  <div className="finance-audit-empty">Loading invoices...</div>
                </td>
              </tr>
            ) : null}

            {!loading && !sortedRows.length ? (
              <tr>
                <td colSpan={13}>
                  <div className="finance-audit-empty">{emptyMessage}</div>
                </td>
              </tr>
            ) : null}

            {!loading &&
              sortedRows.map((row) => {
                const id = invoiceId(row);

                return (
                  <tr key={id || invoiceNumber(row)}>
                    <td className="finance-check-col">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedMap[id])}
                        onChange={(event) => toggleRow(row, event.target.checked)}
                        aria-label={`Select invoice ${invoiceNumber(row)}`}
                      />
                    </td>

                    <td>{formatDate(invoiceDate(row))}</td>

                    <td>
                      <button
                        type="button"
                        className="finance-link-button"
                        onClick={() => onOpenInvoice?.(row)}
                      >
                        {invoiceNumber(row)}
                      </button>
                      <small>{clean(row.invoice_type || row.type || "Finance Invoice")}</small>
                    </td>

                    <td>
                      <div className="finance-cell-stack">
                        <strong>{billTo(row)}</strong>
                        <small>
                          <User size={12} />
                          {clean(row.member_no || billEmail(row))}
                        </small>
                      </div>
                    </td>

                    <td>
                      <span className="finance-chip">{categoryLabel(row)}</span>
                    </td>

                    <td className="text-right">
                      <strong>{money(totalAmount(row))}</strong>
                    </td>

                    <td className="text-right">
                      <strong>{money(paidAmount(row))}</strong>
                    </td>

                    <td className="text-right">
                      <strong>{money(balanceDue(row))}</strong>
                    </td>

                    <td>{formatDate(dueDate(row))}</td>

                    <td>
                      <StatusBadge status={invoiceStatus(row)} />
                    </td>

                    <td>
                      <StatusBadge status={emailStatus(row)} />
                    </td>

                    <td>
                      <div className="finance-inline-actions">
                        {paymentNumber(row) !== "--" ? (
                          <button
                            type="button"
                            className="finance-mini-btn"
                            onClick={() => onOpenPayment?.(row)}
                          >
                            <BadgeDollarSign size={13} />
                            Payment
                          </button>
                        ) : null}

                        {receiptNumber(row) !== "--" ? (
                          <button
                            type="button"
                            className="finance-mini-btn"
                            onClick={() => onOpenReceipt?.(row)}
                          >
                            <Receipt size={13} />
                            Receipt
                          </button>
                        ) : null}

                        {paymentNumber(row) === "--" && receiptNumber(row) === "--" ? "--" : null}
                      </div>
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
                            {actionButton("View", Eye, onOpenInvoice, row)}
                            {actionButton("Preview", FileText, onPreview, row)}
                            {actionButton("Download PDF", Download, onDownloadPdf, row)}
                            {actionButton("Print", Printer, onPrint, row)}
                            {actionButton("Email", Mail, onEmail, row)}
                            {actionButton("Resend", Send, onResend, row)}
                            {actionButton("Payment Link", Link2, onPaymentLink, row)}
                            {actionButton("Mark Paid", ShieldCheck, onMarkPaid, row)}
                            {actionButton("Refresh", RefreshCcw, onOpenInvoice, row)}
                            {actionButton("Refund", Receipt, onRefund, row, true)}
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