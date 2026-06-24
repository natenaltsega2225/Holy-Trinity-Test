// frontend/src/components/FinanceDashboard/components/FinancePageHeader.jsx

import React from "react";
import {
  ArrowLeft,
  Download,
  Plus,
  RefreshCcw,
  Search,
  Settings,
} from "lucide-react";

import "../../../styles/finance-enterprise.css";

function clean(value) {
  return String(value ?? "").trim();
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function renderIcon(icon, size = 16) {
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

function HeaderButton({
  action,
  fallbackVariant = "ghost",
}) {
  if (!action || action.hidden) return null;

  const disabled =
    typeof action.disabled === "function"
      ? action.disabled()
      : Boolean(action.disabled);

  const content = (
    <>
      {renderIcon(action.icon, 16)}
      {action.label ? <span>{action.label}</span> : null}
    </>
  );

  const className = cx(
    "finance-btn",
    action.variant || fallbackVariant,
    action.danger ? "danger" : "",
    action.className || ""
  );

  if (action.href) {
    return (
      <a
        className={className}
        href={action.href}
        target={action.target || "_self"}
        rel={action.target === "_blank" ? "noreferrer" : undefined}
        aria-disabled={disabled}
        onClick={disabled ? (event) => event.preventDefault() : action.onClick}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={action.onClick}
      disabled={disabled}
      title={action.title}
    >
      {content}
    </button>
  );
}

function Breadcrumbs({ items = [] }) {
  const visible = items.filter(Boolean);

  if (!visible.length) return null;

  return (
    <nav className="finance-breadcrumbs" aria-label="Breadcrumb">
      {visible.map((item, index) => {
        const label = item.label || item.title || item;
        const isLast = index === visible.length - 1;

        if (item.href && !isLast) {
          return (
            <React.Fragment key={`${label}-${index}`}>
              <a href={item.href}>{label}</a>
              <span>/</span>
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={`${label}-${index}`}>
            <span className={isLast ? "active" : ""}>{label}</span>
            {!isLast ? <span>/</span> : null}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function HeaderMeta({ items = [] }) {
  const visible = items.filter((item) => item && clean(item.value || item.label));

  if (!visible.length) return null;

  return (
    <div className="finance-page-meta">
      {visible.map((item, index) => (
        <span
          key={`${item.label || item.value}-${index}`}
          className={cx("finance-meta-pill", item.tone ? `tone-${item.tone}` : "")}
          title={item.title}
        >
          {renderIcon(item.icon, 13)}
          {item.label ? <strong>{item.label}</strong> : null}
          {item.value ? <span>{item.value}</span> : null}
        </span>
      ))}
    </div>
  );
}

function HeaderSearch({
  value,
  onChange,
  placeholder = "Search...",
}) {
  if (typeof onChange !== "function") return null;

  return (
    <label className="finance-header-search">
      <Search size={16} />
      <input
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export default function FinancePageHeader({
  eyebrow = "Finance Dashboard",
  title,
  subtitle,
  description,

  icon,
  breadcrumbs = [],
  meta = [],

  search,
  onSearchChange,
  searchPlaceholder,

  onBack,
  backLabel = "Back",

  onRefresh,
  refreshDisabled = false,

  onExport,
  exportDisabled = false,

  primaryLabel,
  onPrimary,
  primaryIcon = Plus,
  primaryDisabled = false,

  secondaryActions = [],
  actions = [],

  settingsAction,
  compact = false,
  children,
}) {
  const hasTitle = clean(title);
  const allActions = [
    ...secondaryActions,
    ...actions,
  ];

  return (
    <header className={cx("finance-page-header", compact ? "compact" : "")}>
      <div className="finance-page-header-main">
        <Breadcrumbs items={breadcrumbs} />

        <div className="finance-title-row">
          {onBack ? (
            <button
              type="button"
              className="finance-icon-button"
              onClick={onBack}
              title={backLabel}
              aria-label={backLabel}
            >
              <ArrowLeft size={18} />
            </button>
          ) : null}

          {icon ? (
            <div className="finance-page-title-icon">
              {renderIcon(icon, 22)}
            </div>
          ) : null}

          <div>
            {eyebrow ? <p className="finance-eyebrow">{eyebrow}</p> : null}

            {hasTitle ? <h1>{title}</h1> : null}

            {subtitle || description ? (
              <span>{subtitle || description}</span>
            ) : null}
          </div>
        </div>

        <HeaderMeta items={meta} />

        {children ? (
          <div className="finance-page-header-extra">
            {children}
          </div>
        ) : null}
      </div>

      <div className="finance-page-header-side">
        <HeaderSearch
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />

        <div className="finance-page-actions">
          {onRefresh ? (
            <button
              type="button"
              className="finance-btn ghost"
              onClick={onRefresh}
              disabled={refreshDisabled}
            >
              <RefreshCcw size={16} />
              <span>Refresh</span>
            </button>
          ) : null}

          {onExport ? (
            <button
              type="button"
              className="finance-btn ghost"
              onClick={onExport}
              disabled={exportDisabled}
            >
              <Download size={16} />
              <span>Export</span>
            </button>
          ) : null}

          {allActions.map((action, index) => (
            <HeaderButton
              key={action.key || action.label || index}
              action={action}
            />
          ))}

          {settingsAction ? (
            <HeaderButton
              action={{
                icon: Settings,
                label: settingsAction.label || "Settings",
                variant: "ghost",
                ...settingsAction,
              }}
            />
          ) : null}

          {primaryLabel && onPrimary ? (
            <button
              type="button"
              className="finance-btn primary"
              onClick={onPrimary}
              disabled={primaryDisabled}
            >
              {renderIcon(primaryIcon, 16)}
              <span>{primaryLabel}</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export {
  Breadcrumbs as FinanceBreadcrumbs,
  HeaderMeta as FinanceHeaderMeta,
};