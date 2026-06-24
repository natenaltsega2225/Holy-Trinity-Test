import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  FileText,
  Mail,
  MoreHorizontal,
  Printer,
  Receipt,
  RefreshCcw,
  Send,
  ShieldCheck,
  User,
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

function receiptId(row) {
  return row?.id || row?.receipt_id || row?.finance_receipt_id || "";
}

function receiptNumber(row) {
  return clean(row?.receipt_number || row?.receipt_no || row?.number);
}

function paymentNumber(row) {
  return clean(row?.payment_number || row?.payment_no || row?.transaction_number);
}

function invoiceNumber(row) {
  return clean(row?.invoice_number || row?.invoice_no);
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

function receiptAmount(row) {
  return numberValue(row?.amount || row?.receipt_amount || row?.payment_amount || row?.total_amount);
}

function receiptDate(row) {
  return row?.issued_at || row?.receipt_date || row?.sent_at || row?.created_at;
}

function categoryLabel(row) {
  const category =
    row?.category ||
    row?.payment_type ||
    row?.finance_category ||
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

function methodLabel(row) {
  const method = row?.method || row?.payment_method || row?.payment_method_type;

  const brand = row?.card_brand || row?.brand;
  const last4 = row?.card_last4 || row?.last4 || row?.card_last_4;

  if (brand && last4) return `${String(brand).toUpperCase()} **** ${last4}`;
  if (last4) return `**** ${last4}`;

  return pretty(method);
}

function receiptStatus(row) {
  return clean(row?.status || row?.receipt_status || "issued");
}

function emailStatus(row) {
  return clean(row?.email_status || row?.receipt_email_status || row?.delivery_status);
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();

  if (["issued", "sent", "delivered", "paid", "completed"].includes(status)) {
    return "success";
  }

  if (["pending", "queued", "draft", "open"].includes(status)) {
    return "warning";
  }

  if (["failed", "void", "cancelled", "bounced", "refunded"].includes(status)) {
    return "danger";
  }

  return "neutral";
}

function sortValue(row, key) {
  switch (key) {
    case "date":
      return receiptDate(row) ? new Date(receiptDate(row)).getTime() : 0;
    case "receipt":
      return receiptNumber(row);
    case "payer":
      return payerName(row);
    case "category":
      return categoryLabel(row);
    case "amount":
      return receiptAmount(row);
    case "method":
      return methodLabel(row);
    case "status":
      return receiptStatus(row);
    case "email":
      return emailStatus(row);
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

export default function FinanceReceiptTable({
  rows = [],
  loading = false,
  selectedIds = null,
  onSelectionChange,
  onOpenReceipt,
  onPreview,
  onDownloadPdf,
  onPrint,
  onEmail,
  onResend,
  onMarkSent,
  onOpenPayment,
  onOpenInvoice,
  emptyMessage = "No receipts found.",
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
    () => rows.filter((row) => selectedMap[receiptId(row)]),
    [rows, selectedMap]
  );

  const selectedTotal = selectedRows.reduce(
    (sum, row) => sum + receiptAmount(row),
    0
  );

  const allVisibleSelected =
    sortedRows.length > 0 &&
    sortedRows.every((row) => selectedMap[receiptId(row)]);

  function emitSelection(nextMap) {
    const nextIds = Object.entries(nextMap)
      .filter(([, checked]) => checked)
      .map(([id]) => id);

    const nextRows = rows.filter((row) => nextMap[receiptId(row)]);

    if (!controlled) {
      setInternalSelected(nextMap);
    }

    onSelectionChange?.(nextIds, nextRows);
  }

  function toggleRow(row, checked) {
    const id = receiptId(row);

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
      const id = receiptId(row);
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

  function actionButton(label, Icon, handler, row) {
    return (
      <button
        type="button"
        className="finance-mini-btn"
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
    <div className="finance-receipt-table-wrap">
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
              onClick={() => onEmail?.(selectedRows)}
            >
              <Mail size={15} />
              Email
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
              className="finance-btn"
              onClick={() => onMarkSent?.(selectedRows)}
            >
              <ShieldCheck size={15} />
              Mark Sent
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
                  aria-label="Select all visible receipts"
                />
              </th>

              <th>
                <SortButton label="Date" field="date" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Receipt #" field="receipt" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Member / Donor" field="payer" sort={sort} onSort={handleSort} />
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

              <th>Payment</th>
              <th>Invoice</th>

              <th>
                <SortButton label="Status" field="status" sort={sort} onSort={handleSort} />
              </th>

              <th>
                <SortButton label="Email" field="email" sort={sort} onSort={handleSort} />
              </th>

              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12}>
                  <div className="finance-audit-empty">Loading receipts...</div>
                </td>
              </tr>
            ) : null}

            {!loading && !sortedRows.length ? (
              <tr>
                <td colSpan={12}>
                  <div className="finance-audit-empty">{emptyMessage}</div>
                </td>
              </tr>
            ) : null}

            {!loading &&
              sortedRows.map((row) => {
                const id = receiptId(row);

                return (
                  <tr key={id || receiptNumber(row)}>
                    <td className="finance-check-col">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedMap[id])}
                        onChange={(event) => toggleRow(row, event.target.checked)}
                        aria-label={`Select receipt ${receiptNumber(row)}`}
                      />
                    </td>

                    <td>{formatDate(receiptDate(row))}</td>

                    <td>
                      <button
                        type="button"
                        className="finance-link-button"
                        onClick={() => onOpenReceipt?.(row)}
                      >
                        {receiptNumber(row)}
                      </button>
                      <small>{clean(row.receipt_type || row.type || "Official Receipt")}</small>
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
                      <strong>{money(receiptAmount(row))}</strong>
                    </td>

                    <td>{methodLabel(row)}</td>

                    <td>
                      {paymentNumber(row) !== "--" ? (
                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => onOpenPayment?.(row)}
                        >
                          <Receipt size={13} />
                          {paymentNumber(row)}
                        </button>
                      ) : (
                        "--"
                      )}
                    </td>

                    <td>
                      {invoiceNumber(row) !== "--" ? (
                        <button
                          type="button"
                          className="finance-mini-btn"
                          onClick={() => onOpenInvoice?.(row)}
                        >
                          <FileText size={13} />
                          {invoiceNumber(row)}
                        </button>
                      ) : (
                        "--"
                      )}
                    </td>

                    <td>
                      <StatusBadge status={receiptStatus(row)} />
                    </td>

                    <td>
                      <StatusBadge status={emailStatus(row)} />
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
                            {actionButton("View", Eye, onOpenReceipt, row)}
                            {actionButton("Preview", Receipt, onPreview, row)}
                            {actionButton("Download PDF", Download, onDownloadPdf, row)}
                            {actionButton("Print", Printer, onPrint, row)}
                            {actionButton("Email", Mail, onEmail, row)}
                            {actionButton("Resend", Send, onResend, row)}
                            {actionButton("Mark Sent", ShieldCheck, onMarkSent, row)}
                            {actionButton("Refresh", RefreshCcw, onOpenReceipt, row)}
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