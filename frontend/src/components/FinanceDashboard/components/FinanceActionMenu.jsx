// frontend/src/components/FinanceDashboard/components/FinanceActionMenu.jsx

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DEFAULT_ACTIONS = {
  view: { label: "View / Open", symbol: "VIEW" },
  open: { label: "Open", symbol: "VIEW" },
  profile: { label: "Profile", symbol: "USER" },
  preview: { label: "Preview", symbol: "VIEW" },

  pay: { label: "Pay", symbol: "$" },
  openPayment: { label: "Open Payment", symbol: "$" },
  markPaid: { label: "Mark Paid", symbol: "OK" },
  paid: { label: "Paid", symbol: "OK" },

  invoice: { label: "Invoice", symbol: "INV" },
  openInvoice: { label: "Open Invoice", symbol: "INV" },
  viewInvoice: { label: "View Invoice", symbol: "INV" },
  invoicePdf: { label: "Invoice PDF", symbol: "PDF" },
  generatePdf: { label: "Generate PDF", symbol: "PDF" },
  paymentLink: { label: "Payment Link", symbol: "LINK" },

  receipt: { label: "Receipt", symbol: "RCP" },
  viewReceipt: { label: "View Receipt", symbol: "RCP" },
  receiptPdf: { label: "Receipt PDF", symbol: "PDF" },
  resendReceipt: { label: "Resend Receipt", symbol: "MAIL" },

  sendEmail: { label: "Send Email", symbol: "MAIL" },
  email: { label: "Email", symbol: "MAIL" },
  resendEmail: { label: "Resend Email", symbol: "MAIL" },
  markSent: { label: "Mark Sent", symbol: "OK" },

  download: { label: "Download", symbol: "DL" },
  downloadPdf: { label: "Download PDF", symbol: "PDF" },
  exportCsv: { label: "Export CSV", symbol: "CSV" },
  csv: { label: "CSV", symbol: "CSV" },
  pdf: { label: "PDF", symbol: "PDF" },
  print: { label: "Print", symbol: "PRN" },

  pledge: { label: "Pledge", symbol: "PLG" },
  family: { label: "Family", symbol: "FAM" },

  edit: { label: "Edit", symbol: "EDIT" },
  default: { label: "Default", symbol: "STAR" },

  approve: { label: "Approve", symbol: "OK" },
  verify: { label: "Verify", symbol: "OK" },
  post: { label: "Post", symbol: "POST" },
  deposit: { label: "Deposit", symbol: "$" },
  clear: { label: "Clear", symbol: "OK" },
  activate: { label: "Activate", symbol: "OK" },

  refund: { label: "Refund", symbol: "REF", tone: "danger" },
  cancelVoid: { label: "Cancel / Void", symbol: "X", tone: "danger" },
  cancel: { label: "Cancel", symbol: "X", tone: "danger" },
  void: { label: "Void", symbol: "X", tone: "danger" },
  deactivate: { label: "Deactivate", symbol: "X", tone: "danger" },
  fail: { label: "Fail", symbol: "X", tone: "danger" },
  return: { label: "Return", symbol: "RET", tone: "danger" },
};

function safeResolve(value, row, action, fallback = undefined) {
  try {
    return typeof value === "function" ? value(row, action) : value ?? fallback;
  } catch {
    return fallback;
  }
}

function prettyLabel(value) {
  return String(value || "Action")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeAction(action) {
  if (typeof action === "string") {
    const base = DEFAULT_ACTIONS[action] || {};

    return {
      key: action,
      label: base.label || prettyLabel(action),
      symbol: base.symbol || "...",
      tone: base.tone || "default",
    };
  }

  const key = action?.key || action?.id || action?.label || "action";
  const base = DEFAULT_ACTIONS[key] || {};

  return {
    ...action,
    key,
    label: action?.label || base.label || prettyLabel(key),
    symbol: action?.symbol || base.symbol || "...",
    tone: action?.tone || base.tone || "default",
  };
}

function normalizeActions(actions, row) {
  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .filter(Boolean)
    .map(normalizeAction)
    .filter((action) => safeResolve(action.visible, row, action, true) !== false);
}

function KebabIcon() {
  return <span className="finance-action-kebab" aria-hidden="true" />;
}

function ActionSymbol({ action }) {
  const Icon = action.icon;

  if (React.isValidElement(Icon)) {
    return React.cloneElement(Icon, {
      size: Icon.props?.size || 15,
      strokeWidth: Icon.props?.strokeWidth || 2.2,
    });
  }

  if (typeof Icon === "function") {
    return <Icon size={15} strokeWidth={2.2} />;
  }

  return <span className="finance-action-symbol-text">{action.symbol}</span>;
}

export default function FinanceActionMenu({
  row,
  actions = [],
  label = "Actions",
  className = "",
}) {
  const id = useId();
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const menuActions = useMemo(
    () => normalizeActions(actions, row),
    [actions, row]
  );

  function updatePosition() {
    if (typeof window === "undefined") {
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const width = 232;
    const gap = 8;
    const margin = 12;
    const estimatedHeight = Math.min(420, 44 + menuActions.length * 42);

    let left = rect.right - width;
    left = Math.max(margin, left);
    left = Math.min(left, window.innerWidth - width - margin);

    let top = rect.bottom + gap;

    if (top + estimatedHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - estimatedHeight - gap);
    }

    setPos({ top, left });
  }

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return undefined;
    }

    updatePosition();

    function closeOnOutside(event) {
      if (
        buttonRef.current?.contains(event.target) ||
        panelRef.current?.contains(event.target)
      ) {
        return;
      }

      setOpen(false);
    }

    function onKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, menuActions.length]);

  useEffect(() => {
    if (open && !menuActions.length) {
      setOpen(false);
    }
  }, [open, menuActions.length]);

  function run(event, action) {
    event.preventDefault();
    event.stopPropagation();

    if (safeResolve(action.disabled, row, action, false)) {
      return;
    }

    setOpen(false);

    const href = safeResolve(action.href, row, action, "");

    if (href && typeof window !== "undefined") {
      window.open(href, action.target || "_blank", "noopener,noreferrer");
      return;
    }

    if (typeof action.onClick === "function") {
      action.onClick(row, action);
    }
  }

  if (!menuActions.length) {
    return <span className="finance-action-empty">--</span>;
  }

  return (
    <span className={`finance-action-menu ${className}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        className={`finance-action-trigger ${open ? "active" : ""}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          updatePosition();
          setOpen((value) => !value);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        title={label}
      >
        <KebabIcon />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={`${id}-panel`}
              className="finance-action-panel"
              role="menu"
              style={{
                position: "fixed",
                top: `${pos.top}px`,
                left: `${pos.left}px`,
                width: "232px",
                zIndex: 99999,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="finance-action-title">{label}</div>

              {menuActions.map((action) => {
                const disabled = safeResolve(action.disabled, row, action, false);
                const danger = action.tone === "danger" || action.danger;

                return (
                  <button
                    key={action.key || action.label}
                    type="button"
                    role="menuitem"
                    className={`finance-action-item ${danger ? "danger" : ""}`}
                    disabled={disabled}
                    onClick={(event) => run(event, action)}
                  >
                    <span className="finance-action-symbol">
                      <ActionSymbol action={action} />
                    </span>
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}