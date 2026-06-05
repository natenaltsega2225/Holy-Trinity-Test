// //frontend\src\components\AdminDashboard\components\AdminTablePage.jsx


import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api";

function formatMoney(value) {
  const n = Number(value || 0);
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function AdminStatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  let style = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 92,
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#4b5563",
  };

  if (
    ["active", "paid", "approved", "posted", "available", "verified"].includes(
      normalized
    )
  ) {
    style = {
      ...style,
      background: "#ecfdf3",
      color: "#027a48",
      border: "1px solid #abefc6",
    };
  } else if (
    ["pending", "draft", "open", "manual_renewal"].includes(normalized)
  ) {
    style = {
      ...style,
      background: "#fffaeb",
      color: "#b54708",
      border: "1px solid #fedf89",
    };
  } else if (
    ["inactive", "delinquent", "failed", "archived", "cancelled", "voided"].includes(
      normalized
    )
  ) {
    style = {
      ...style,
      background: "#fef3f2",
      color: "#b42318",
      border: "1px solid #fecdca",
    };
  }

  return <span style={style}>{status || "--"}</span>;
}

function SummaryCards({ items = [] }) {
  if (!items.length) return null;

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 16,
        marginBottom: 16,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            padding: 16,
          }}
        >
          <div style={{ color: "#555", fontSize: 13, fontWeight: 700 }}>
            {item.label}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 30,
              lineHeight: 1,
              fontWeight: 800,
              color: "#1a1a1a",
            }}
          >
            {item.value}
          </div>
          {item.sub ? (
            <div style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
              {item.sub}
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function PageHeader({ title, subtitle, actions = [] }) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        padding: 20,
        marginBottom: 16,
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            color: "#1a1a1a",
            fontSize: 30,
            fontWeight: 800,
          }}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            style={{
              margin: "8px 0 0",
              color: "#555",
              maxWidth: 920,
              lineHeight: 1.6,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {actions.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              style={{
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 14,
                fontWeight: 700,
                cursor: action.disabled ? "not-allowed" : "pointer",
                border:
                  action.variant === "primary"
                    ? "1px solid #0A7CFF"
                    : action.variant === "danger"
                    ? "1px solid #ef4444"
                    : "1px solid #e5e7eb",
                background:
                  action.variant === "primary"
                    ? "#0A7CFF"
                    : action.variant === "danger"
                    ? "#fff1f2"
                    : "#fff",
                color:
                  action.variant === "primary"
                    ? "#fff"
                    : action.variant === "danger"
                    ? "#b42318"
                    : "#1a1a1a",
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FiltersBar({
  search,
  onSearchChange,
  searchPlaceholder,
  extraFilters = [],
}) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 1.4fr) repeat(3, minmax(180px, .8fr))",
          gap: 12,
        }}
      >
        <input
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 14,
          }}
        />

        {extraFilters.map((filter) => (
          <select
            key={filter.key}
            value={filter.value ?? ""}
            onChange={(e) => filter.onChange?.(e.target.value)}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 14,
              background: "#fff",
            }}
          >
            {(filter.options || []).map((option) => (
              <option key={String(option.value)} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ title, message }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: 30,
        color: "#555",
      }}
    >
      <h3 style={{ margin: 0, color: "#1a1a1a" }}>{title}</h3>
      <p style={{ marginTop: 8 }}>{message}</p>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }) {
  return (
    <div
      style={{
        marginTop: 16,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "#555", fontWeight: 700 }}>
        Page {page} of {totalPages}
      </span>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 12,
            padding: "10px 14px",
            cursor: page <= 1 ? "not-allowed" : "pointer",
          }}
        >
          Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 12,
            padding: "10px 14px",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function AdminTablePage({
  title,
  subtitle,
  endpoint,
  columns = [],
  extraFilters = [],
  pageSize = 10,
  searchPlaceholder = "Search...",
  summaryBuilder,
  emptyTitle = "No records found",
  emptyMessage = "Nothing to display.",
  actions = [],
}) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    pageSize,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stableExtraFilters = useMemo(
    () => (Array.isArray(extraFilters) ? extraFilters : []),
    [extraFilters]
  );

  const helperBag = useMemo(
    () => ({
      formatMoney,
      AdminStatusBadge,
    }),
    []
  );

  const filterSignature = useMemo(
    () =>
      JSON.stringify(
        stableExtraFilters.map((filter) => ({
          key: filter?.key ?? "",
          value: filter?.value ?? "",
        }))
      ),
    [stableExtraFilters]
  );

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        search,
        page,
        pageSize,
      };

      stableExtraFilters.forEach((filter) => {
        if (filter?.key) params[filter.key] = filter.value ?? "";
      });

      const { data } = await api.get(endpoint, { params });

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setMeta({
        total: Number(data?.total || 0),
        page: Number(data?.page || page),
        pageSize: Number(data?.pageSize || pageSize),
        totalPages: Math.max(
          1,
          Number(data?.totalPages || Math.ceil(Number(data?.total || 0) / pageSize))
        ),
      });
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || "Failed to load records.");
      setRows([]);
      setMeta({
        total: 0,
        page: 1,
        pageSize,
        totalPages: 1,
      });
    } finally {
      setLoading(false);
    }
  }, [endpoint, search, page, pageSize, stableExtraFilters]);

  useEffect(() => {
    loadRows();
  }, [loadRows, filterSignature]);

  const summaryItems = useMemo(() => {
    if (typeof summaryBuilder === "function") {
      return summaryBuilder(rows, meta, formatMoney);
    }

    return [
      {
        label: "Records",
        value: meta.total,
        sub: "Returned from current query",
      },
    ];
  }, [rows, meta, summaryBuilder]);

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />

      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 12,
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#b42318",
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      ) : null}

      <SummaryCards items={summaryItems} />

      <FiltersBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder={searchPlaceholder}
        extraFilters={stableExtraFilters}
      />

      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          padding: 16,
        }}
      >
        {loading ? (
          <EmptyState title="Loading..." message="Please wait while records load." />
        ) : rows.length === 0 ? (
          <EmptyState title={emptyTitle} message={emptyMessage} />
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 960,
                  borderCollapse: "separate",
                  borderSpacing: 0,
                }}
              >
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        style={{
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                          textAlign: "left",
                          background: "#f8fafc",
                          borderBottom: "1px solid #e5e7eb",
                          padding: "14px 12px",
                          color: "#1a1a1a",
                          fontWeight: 800,
                          fontSize: 14,
                        }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr
                      key={row.id || rowIndex}
                      style={{
                        background: rowIndex % 2 === 0 ? "#fff" : "#fafcff",
                      }}
                    >
                      {columns.map((column) => {
                        const value = row[column.key];
                        const rendered = column.render
                          ? column.render(value, row, helperBag)
                          : value ?? "--";

                        return (
                          <td
                            key={column.key}
                            style={{
                              padding: "14px 12px",
                              borderBottom: "1px solid #edf2f7",
                              color: "#1a1a1a",
                              fontSize: 14,
                              verticalAlign: "top",
                            }}
                          >
                            {rendered}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}