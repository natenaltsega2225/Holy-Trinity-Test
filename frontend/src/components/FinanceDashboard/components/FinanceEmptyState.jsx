// frontend/src/components/FinanceDashboard/components/FinanceEmptyState.jsx

import React from "react";
import {
  AlertTriangle,
  Archive,
  FileText,
  Inbox,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react";

import "../../../styles/finance-enterprise.css";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function renderIcon(icon, size = 28) {
  if (!icon) return null;

  if (React.isValidElement(icon)) {
    return icon;
  }

  if (typeof icon === "function") {
    const Icon = icon;
    return <Icon size={size} />;
  }

  return icon;
}

function defaultIcon(type) {
  const value = String(type || "").toLowerCase();

  if (value.includes("search")) return Search;
  if (value.includes("error")) return AlertTriangle;
  if (value.includes("archive")) return Archive;
  if (value.includes("document") || value.includes("invoice")) return FileText;

  return Inbox;
}

export default function FinanceEmptyState({
  type = "empty",
  icon,
  title = "No records found",
  message = "There are no finance records matching the current filters.",
  details,

  primaryLabel,
  onPrimary,
  primaryIcon = Plus,

  secondaryLabel,
  onSecondary,
  secondaryIcon = RefreshCcw,

  tertiaryLabel,
  onTertiary,
  tertiaryIcon,

  compact = false,
  bordered = true,
  className = "",
  children,
}) {
  const Icon = icon || defaultIcon(type);

  return (
    <div
      className={cx(
        "finance-empty-state",
        compact ? "compact" : "",
        bordered ? "bordered" : "",
        `finance-empty-${type}`,
        className
      )}
    >
      <div className="finance-empty-icon">
        {renderIcon(Icon)}
      </div>

      <div className="finance-empty-content">
        <h3>{title}</h3>

        {message ? <p>{message}</p> : null}

        {details ? (
          <small className="finance-empty-details">
            {details}
          </small>
        ) : null}

        {children ? (
          <div className="finance-empty-extra">
            {children}
          </div>
        ) : null}

        {primaryLabel || secondaryLabel || tertiaryLabel ? (
          <div className="finance-empty-actions">
            {primaryLabel && onPrimary ? (
              <button
                type="button"
                className="finance-btn primary"
                onClick={onPrimary}
              >
                {renderIcon(primaryIcon, 16)}
                <span>{primaryLabel}</span>
              </button>
            ) : null}

            {secondaryLabel && onSecondary ? (
              <button
                type="button"
                className="finance-btn ghost"
                onClick={onSecondary}
              >
                {renderIcon(secondaryIcon, 16)}
                <span>{secondaryLabel}</span>
              </button>
            ) : null}

            {tertiaryLabel && onTertiary ? (
              <button
                type="button"
                className="finance-btn ghost"
                onClick={onTertiary}
              >
                {renderIcon(tertiaryIcon, 16)}
                <span>{tertiaryLabel}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FinanceSearchEmptyState({
  search,
  onClear,
  onRefresh,
}) {
  return (
    <FinanceEmptyState
      type="search"
      icon={Search}
      title="No matching records"
      message={
        search
          ? `No finance records matched "${search}".`
          : "No finance records matched your current filters."
      }
      details="Try clearing filters, changing the date range, or refreshing the data."
      secondaryLabel={onClear ? "Clear Filters" : ""}
      onSecondary={onClear}
      tertiaryLabel={onRefresh ? "Refresh" : ""}
      onTertiary={onRefresh}
      tertiaryIcon={RefreshCcw}
    />
  );
}

export function FinanceErrorState({
  title = "Unable to load records",
  message = "The finance data could not be loaded.",
  error,
  onRetry,
}) {
  return (
    <FinanceEmptyState
      type="error"
      icon={AlertTriangle}
      title={title}
      message={message}
      details={error}
      primaryLabel={onRetry ? "Try Again" : ""}
      onPrimary={onRetry}
      primaryIcon={RefreshCcw}
    />
  );
}