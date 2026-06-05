

// frontend/src/components/MembershipDashboard/components/MemberTablePage.jsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../../api";

import MemberPageHeader from "./MemberPageHeader";
import MemberSummaryCards from "./MemberSummaryCards";
import MemberFilters from "./MemberFilters";
import MemberEmptyState from "./MemberEmptyState";
import MemberPagination from "./MemberPagination";
import MemberStatusBadge from "./MemberStatusBadge";

// import "../membership-dashboard.css";

/* =========================================================
   HELPERS
========================================================= */

function formatMoney(value) {
  const n = Number(value || 0);

  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "--";

  const raw = String(value).trim();
  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return raw || "--";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function pretty(value) {
  if (value === null || value === undefined || value === "") return "--";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeRows(data) {
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeMeta(data, fallbackPage, fallbackLimit) {
  const total =
    Number(
      data?.total ??
        data?.meta?.total ??
        data?.pagination?.total ??
        normalizeRows(data).length
    ) || 0;

  const page =
    Number(
      data?.page ??
        data?.meta?.page ??
        data?.pagination?.page ??
        fallbackPage
    ) || 1;

  const limit =
    Number(
      data?.limit ??
        data?.pageSize ??
        data?.meta?.limit ??
        data?.pagination?.limit ??
        fallbackLimit
    ) || fallbackLimit;

  const totalPages =
    Number(
      data?.totalPages ??
        data?.meta?.totalPages ??
        data?.pagination?.totalPages ??
        data?.pagination?.pages ??
        Math.max(1, Math.ceil(total / Math.max(1, limit)))
    ) || 1;

  return {
    total,
    page,
    limit,
    totalPages,
    summary: data?.summary || data?.meta?.summary || null,
  };
}

function getRowKey(row, endpoint, rowIndex) {
  return (
    row?.id ||
    row?.uuid ||
    row?.payment_number ||
    row?.invoice_number ||
    row?.receipt_number ||
    row?.ledger_uuid ||
    `${endpoint || "member-table"}-${rowIndex}`
  );
}

function defaultRenderValue(column, value, row, helpers) {
  if (column.status) {
    return (
      <helpers.MemberStatusBadge
        status={String(value ?? row.status ?? "--")}
      />
    );
  }

  if (column.money) {
    return helpers.formatMoney(value);
  }

  const key = String(column.key || "").toLowerCase();

  if (column.date || key.includes("date") || key.includes("_at")) {
    return helpers.formatDate(value);
  }

  if (
    [
      "category",
      "sub_category",
      "payment_method",
      "payment_source",
      "method",
      "provider",
      "status",
      "type",
    ].includes(key)
  ) {
    return pretty(value);
  }

  return value ?? "--";
}

function exportCsv(filename, rows, columns) {
  const safeColumns = columns.filter((c) => c.key && c.key !== "__actions");

  const header = safeColumns.map((c) => `"${String(c.label || c.key)}"`).join(",");

  const body = rows
    .map((row) =>
      safeColumns
        .map((c) => {
          const raw = row[c.key] ?? "";
          return `"${String(raw).replaceAll('"', '""')}"`;
        })
        .join(",")
    )
    .join("\n");

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

/* =========================================================
   COMPONENT
========================================================= */

export default function MemberTablePage({
  title = "",
  subtitle = "",

  endpoint,

  columns = [],
  actions = [],

  emptyTitle = "No records found",
  emptyMessage = "Try adjusting your filters.",

  summaryBuilder,
  extraFilters,

  pageSize = 10,
  defaultPeriod = "all",

  defaultSortKey = "",
  defaultSortDirection = "desc",

  searchPlaceholder = "Search records...",

  showSummary = false,
  showFilters = true,
  showExport = true,
  showReload = true,

  footerBuilder,
  belowTable,

  refreshKey = 0,
  autoLoad = true,

  rows: externalRows,
}) {
  const safeColumns = useMemo(
    () => (Array.isArray(columns) ? columns : []),
    [columns]
  );

  const safeActions = useMemo(
    () => (Array.isArray(actions) ? actions : []),
    [actions]
  );

  const stableExtraFilters = useMemo(
    () => (Array.isArray(extraFilters) ? extraFilters : []),
    [extraFilters]
  );

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: pageSize,
    totalPages: 1,
    summary: null,
  });

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState(defaultPeriod);
  const [page, setPage] = useState(1);

  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDirection, setSortDirection] = useState(defaultSortDirection);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    if (!endpoint) {
      if (Array.isArray(externalRows)) {
        setRows(externalRows);
        setMeta({
          total: externalRows.length,
          page: 1,
          limit: pageSize,
          totalPages: 1,
          summary: null,
        });
        return;
      }

      setError("Missing API endpoint.");
      setRows([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = {
        search,
        period,
        page,
        limit: pageSize,
        pageSize,
        sort: sortKey,
        sortKey,
        sort_direction: sortDirection,
        sortDirection,
      };

      stableExtraFilters.forEach((filter) => {
        if (filter?.key) {
          params[filter.key] = filter.value ?? "";
        }
      });

      const { data } = await api.get(endpoint, {
        params,
      });

      const nextRows = normalizeRows(data);
      const nextMeta = normalizeMeta(data, page, pageSize);

      setRows(nextRows);
      setMeta(nextMeta);
    } catch (err) {
      console.error(`${title || endpoint} load failed:`, err);

      if (err?.response?.status === 401) {
        setError("Your session expired. Please sign in again.");
      } else if (err?.response?.status === 403) {
        setError("You do not have permission to view these records.");
      } else if (err?.response?.status === 404) {
        setError("This member API endpoint was not found.");
      } else {
        setError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            "Failed to load records."
        );
      }

      setRows([]);
      setMeta({
        total: 0,
        page: 1,
        limit: pageSize,
        totalPages: 1,
        summary: null,
      });
    } finally {
      setLoading(false);
    }
  }, [
    endpoint,
    externalRows,
    filterSignature,
    page,
    pageSize,
    period,
    search,
    sortDirection,
    sortKey,
    stableExtraFilters,
    title,
  ]);

  useEffect(() => {
    if (Array.isArray(externalRows)) {
      setRows(externalRows);
      setMeta({
        total: externalRows.length,
        page: 1,
        limit: pageSize,
        totalPages: 1,
        summary: null,
      });
      return;
    }

    if (autoLoad) {
      loadRows();
    }
  }, [autoLoad, loadRows, refreshKey, externalRows, pageSize]);

  const helpers = useMemo(
    () => ({
      formatMoney,
      formatDate,
      pretty,
      MemberStatusBadge,
      reload: loadRows,
    }),
    [loadRows]
  );

  const headerActions = useMemo(() => {
    const builtIn = [];

    if (showReload) {
      builtIn.push({
        label: loading ? "Refreshing..." : "Refresh",
        variant: "secondary",
        disabled: loading,
        onClick: loadRows,
      });
    }

    if (showExport) {
      builtIn.push({
        label: "Export CSV",
        variant: "secondary",
        disabled: !rows.length,
        onClick: () =>
          exportCsv(
            `${String(title || "member-records")
              .toLowerCase()
              .replaceAll(" ", "-")}.csv`,
            rows,
            safeColumns
          ),
      });
    }

    return [...safeActions, ...builtIn];
  }, [
    safeActions,
    showReload,
    showExport,
    loading,
    loadRows,
    rows,
    safeColumns,
    title,
  ]);

  const showHeader = Boolean(
    String(title || "").trim() ||
      String(subtitle || "").trim() ||
      headerActions.length > 0
  );

  const summaryItems = useMemo(() => {
    if (typeof summaryBuilder === "function") {
      return summaryBuilder(rows, meta, formatMoney);
    }

    const visibleMoney = rows.reduce((sum, row) => {
      const amountCandidate =
        row.amount ??
        row.total_amount ??
        row.amount_due ??
        row.credit_amount ??
        row.paid_amount ??
        0;

      return sum + Number(amountCandidate || 0);
    }, 0);

    const successCount = rows.filter((row) =>
      ["paid", "posted", "completed", "approved", "issued"].includes(
        String(row.status || row.payment_status || "").toLowerCase()
      )
    ).length;

    const openCount = rows.filter((row) =>
      ["pending", "open", "draft", "overdue", "failed"].includes(
        String(row.status || row.payment_status || "").toLowerCase()
      )
    ).length;

    return [
      {
        label: "Records",
        value: meta.total,
        sub: "Returned from current query",
      },
      {
        label: "Visible Total",
        value: formatMoney(visibleMoney),
        sub: "Current page aggregate",
        featured: true,
      },
      {
        label: "Successful",
        value: successCount,
        sub: "Paid / posted records",
      },
      {
        label: "Open / Pending",
        value: openCount,
        sub: "Needs review or action",
      },
    ];
  }, [rows, meta, summaryBuilder]);

  const footerContent =
    typeof footerBuilder === "function"
      ? footerBuilder(rows, meta, helpers)
      : null;

  const afterTableContent =
    typeof belowTable === "function"
      ? belowTable(rows, meta, helpers)
      : null;

  function handleSort(column) {
    if (!column.sortable && !column.sort) return;

    const key = column.sortKey || column.key;

    if (!key) return;

    setPage(1);

    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <div className="member-page">
      {showHeader ? (
        <MemberPageHeader
          title={title}
          subtitle={subtitle}
          actions={headerActions}
        />
      ) : null}

      {error ? (
        <div className="member-banner member-banner-error">
          {error}
        </div>
      ) : null}

      {showSummary ? <MemberSummaryCards items={summaryItems} /> : null}

      {showFilters ? (
        <MemberFilters
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder={searchPlaceholder}
          period={period}
          onPeriodChange={(value) => {
            setPeriod(value);
            setPage(1);
          }}
          extraFilters={stableExtraFilters}
          onApply={loadRows}
        />
      ) : null}

      <section className="member-card member-card-compact">
        {loading ? (
          <div className="member-empty">
            <h3>Loading...</h3>
            <p>Please wait while we load your records.</p>
          </div>
        ) : rows.length === 0 ? (
          <MemberEmptyState title={emptyTitle} subtitle={emptyMessage} />
        ) : (
          <>
            <div className="member-table-wrap">
              <table className="member-table">
                <thead>
                  <tr>
                    {safeColumns.map((column) => {
                      const sortable = column.sortable || column.sort;
                      const currentSort =
                        sortKey === (column.sortKey || column.key);

                      return (
                        <th
                          key={column.key}
                          className={[
                            column.key === "__actions"
                              ? "member-col-actions"
                              : "",
                            sortable ? "member-sortable-th" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => handleSort(column)}
                        >
                          <span>
                            {column.label}
                            {sortable && currentSort
                              ? sortDirection === "asc"
                                ? " ↑"
                                : " ↓"
                              : ""}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={getRowKey(row, endpoint, rowIndex)}>
                      {safeColumns.map((column) => {
                        const value = row[column.key];

                        const rendered =
                          typeof column.render === "function"
                            ? column.render(value, row, helpers)
                            : defaultRenderValue(column, value, row, helpers);

                        return (
                          <td
                            key={column.key}
                            data-label={column.label}
                            className={
                              column.key === "__actions"
                                ? "member-col-actions"
                                : ""
                            }
                          >
                            {rendered}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>

                {footerContent ? (
                  <tfoot className="member-table-foot">
                    {footerContent}
                  </tfoot>
                ) : null}
              </table>
            </div>

            

            {afterTableContent ? (
              <div className="member-table-below">
                {afterTableContent}
              </div>
            ) : null}

            <MemberPagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(nextPage) => setPage(nextPage)}
            />
          </>
        )}
      </section>
    </div>
  );
}