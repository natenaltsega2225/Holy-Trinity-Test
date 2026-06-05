

 //frontend\src\components\FinanceDashboard\components\FinanceTablePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import FinancePageHeader from "./FinancePageHeader";
//  import FinanceFilters from "./FinanceFilters";
import FinancePagination from "./FinancePagination";
import FinanceSummaryCards from "./FinanceSummaryCards";
import FinanceEmptyState from "./FinanceEmptyState";
import FinanceStatusBadge from "./FinanceStatusBadge";

function formatMoney(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function getValueByPath(obj, path) {
  if (!obj || !path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeMeta(data, rows, currentPage, currentPageSize) {
  const total = Number(data?.total ?? data?.meta?.total ?? rows.length ?? 0);
  const limit = Number(
    data?.limit ??
      data?.pageSize ??
      data?.meta?.limit ??
      data?.meta?.pageSize ??
      currentPageSize
  );
  const totalPages = Number(
    data?.totalPages ??
      data?.meta?.totalPages ??
      Math.max(1, Math.ceil(total / Math.max(1, limit)))
  );
  const page = Number(data?.page ?? data?.meta?.page ?? currentPage);

  return { total, totalPages, page, limit };
}

export default function FinanceTablePage({
  title,
  subtitle,
  endpoint,
  columns = [],
  actions = [],
  rowActions = [],
  pageSize: defaultPageSize = 10,
  defaultPeriod = "all",
  extraFilters = [],
  summaryBuilder,
  requestParams = {},
  rowKey = "id",
  showPeriodFilter = true,
  searchPlaceholder = "Search...",
  topContent = null,
}) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState(defaultPeriod);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 1,
    page: 1,
    limit: defaultPageSize,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData(signalIgnore = { ignore: false }) {
    try {
      setLoading(true);
      setError("");

      const filterParams = Object.fromEntries(
        extraFilters.map((filter) => [filter.key, filter.value ?? ""])
      );

      const params = {
        q: search,
        search,
        period,
        page,
        limit: pageSize,
        pageSize,
        ...requestParams,
        ...filterParams,
      };
const safeEndpoint = endpoint.startsWith("/api")
  ? endpoint.replace(/^\/api/, "")
  : endpoint;
    const { data } = await api.get(safeEndpoint, { params });
      if (signalIgnore.ignore) return;

      const nextRows = normalizeRows(data);
      const nextMeta = normalizeMeta(data, nextRows, page, pageSize);

      setRows(nextRows);
      setMeta(nextMeta);
    } catch (err) {
      if (signalIgnore.ignore) return;
      console.error(`${title} load failed:`, err);
      setRows([]);
      setMeta({
        total: 0,
        totalPages: 1,
        page: 1,
        limit: pageSize,
      });
      setError(err?.response?.data?.error || "Failed to load data.");
    } finally {
      if (!signalIgnore.ignore) setLoading(false);
    }
  }

  useEffect(() => {
    const signalIgnore = { ignore: false };
    loadData(signalIgnore);
    return () => {
      signalIgnore.ignore = true;
    };
  }, [
    endpoint,
    title,
    search,
    period,
    page,
    pageSize,
    JSON.stringify(requestParams),
    JSON.stringify(extraFilters.map((f) => [f.key, f.value])),
  ]);

  const resolvedColumns = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      render:
        typeof column.render === "function"
          ? column.render
          : (value) => value ?? "--",
    }));
  }, [columns]);

  const summaryItems = useMemo(() => {
    if (typeof summaryBuilder === "function") {
      return summaryBuilder(rows, meta, formatMoney);
    }

    const totalAmount = rows.reduce((sum, row) => {
      const candidate =
        row.amount ??
        row.total_amount ??
        row.balance_due ??
        row.open_balance ??
        row.balance ??
        row.credit ??
        row.grand_total ??
        0;
      return sum + Number(candidate || 0);
    }, 0);

    const successCount = rows.filter((row) =>
      [
        "paid",
        "succeeded",
        "active",
        "verified",
        "matched",
        "approved",
        "completed",
        "cleared",
        "posted",
        "deposited",
      ].includes(
        String(
          row.status || row.membership_status || row.deposit_status || ""
        ).toLowerCase()
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
        value: formatMoney(totalAmount),
        sub: "Current page aggregate",
      },
      {
        label: "Successful",
        value: successCount,
        sub: "Completed or approved rows",
      },
      {
        label: "Period",
        value: showPeriodFilter ? period : "all",
        sub: "Current filter",
      },
    ];
  }, [rows, meta, period, summaryBuilder, showPeriodFilter]);

  const hasRowActions = Array.isArray(rowActions) && rowActions.length > 0;

  async function handleRowAction(action, row) {
    try {
      if (typeof action.onClick === "function") {
        await action.onClick(row, {
          reload: () => loadData({ ignore: false }),
          api,
        });
        await loadData({ ignore: false });
        return;
      }

      if (action.endpoint && action.method) {
        const url =
          typeof action.endpoint === "function"
            ? action.endpoint(row)
            : String(action.endpoint).replace(":id", row.id);

        const payload =
          typeof action.payload === "function"
            ? action.payload(row)
            : action.payload || {};

        await api.request({
          url,
          method: action.method,
          data: payload,
        });

        await loadData({ ignore: false });
      }
    } catch (err) {
      console.error(`Row action failed for ${title}:`, err);
      setError(err?.response?.data?.error || "Action failed.");
    }
  }

  return (
    <div className="finance-page-shell">
      <FinancePageHeader title={title} subtitle={subtitle} actions={actions} />

      {topContent ? (
        <section className="finance-card finance-inline-nav-card">
          {topContent}
        </section>
      ) : null}

      <FinanceSummaryCards items={summaryItems} />

      {/* <FinanceFilters
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        period={period}
        onPeriodChange={(value) => {
          setPeriod(value);
          setPage(1);
        }}
        extraFilters={extraFilters}
        pageSize={pageSize}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
        showPeriodFilter={showPeriodFilter}
        searchPlaceholder={searchPlaceholder}
      /> */}

      {error ? (
        <section className="finance-alert finance-alert-error">{error}</section>
      ) : null}

      {loading ? (
        <section className="finance-card finance-loading-card">Loading...</section>
      ) : rows.length === 0 ? (
        <FinanceEmptyState
          title={`No ${String(title || "records").toLowerCase()} found`}
          description="Try adjusting your search or filters."
        />
      ) : (
        <section className="finance-card finance-table-card">
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  {resolvedColumns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  {hasRowActions ? <th>Actions</th> : null}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => {
                  const key =
                    row?.[rowKey] ??
                    row?.id ??
                    row?.code ??
                    row?.invoice_number ??
                    row?.receipt_number ??
                    row?.reference_no ??
                    index;

                  return (
                    <tr key={key}>
                      {resolvedColumns.map((column) => {
                        const rawValue = getValueByPath(row, column.key);

                        return (
                          <td key={column.key}>
                            {column.render(rawValue, row, {
                              formatMoney,
                              FinanceStatusBadge,
                            })}
                          </td>
                        );
                      })}

                      {hasRowActions ? (
                        <td>
                          <div className="finance-row-actions">
                            {rowActions.map((action, idx) => {
                              const visible =
                                typeof action.visible === "function"
                                  ? action.visible(row)
                                  : true;

                              if (!visible) return null;

                              const disabled =
                                typeof action.disabled === "function"
                                  ? action.disabled(row)
                                  : false;

                              const btnClass =
                                action.variant === "primary"
                                  ? "finance-btn finance-btn-primary"
                                  : "finance-btn finance-btn-secondary";

                              return (
                                <button
                                  key={`${action.label}-${idx}`}
                                  type="button"
                                  className={btnClass}
                                  disabled={disabled}
                                  onClick={() => handleRowAction(action, row)}
                                >
                                  {typeof action.label === "function"
                                    ? action.label(row)
                                    : action.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <FinancePagination
            page={meta.page || page}
            totalPages={meta.totalPages || 1}
            total={meta.total || 0}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </section>
      )}
    </div>
  );
}