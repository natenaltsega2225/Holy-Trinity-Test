// frontend/src/components/FinanceDashboard/components/FinancePagination.jsx

import React, { useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import "../../../styles/finance-enterprise.css";

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildPages(currentPage, totalPages) {
  const pages = [];

  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  pages.push(1);

  if (currentPage > 4) {
    pages.push("left-ellipsis");
  }

  const start = clamp(currentPage - 1, 2, totalPages - 3);
  const end = clamp(currentPage + 1, 4, totalPages - 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (currentPage < totalPages - 3) {
    pages.push("right-ellipsis");
  }

  pages.push(totalPages);

  return pages;
}

export default function FinancePagination({
  page = 1,
  total = 0,
  pageSize = 25,
  totalPages,
  onPageChange,
  onPageSizeChange,

  pageSizeOptions = [10, 25, 50, 100],
  loading = false,
  showPageSize = true,
  showRange = true,
  compact = false,
}) {
  const safePageSize = Math.max(1, numberValue(pageSize, 25));
  const calculatedTotalPages = Math.max(
    1,
    numberValue(totalPages, Math.ceil(numberValue(total, 0) / safePageSize))
  );

  const currentPage = clamp(numberValue(page, 1), 1, calculatedTotalPages);

  const range = useMemo(() => {
    const totalRecords = numberValue(total, 0);

    if (!totalRecords) {
      return {
        from: 0,
        to: 0,
      };
    }

    return {
      from: (currentPage - 1) * safePageSize + 1,
      to: Math.min(currentPage * safePageSize, totalRecords),
    };
  }, [currentPage, safePageSize, total]);

  const pages = useMemo(
    () => buildPages(currentPage, calculatedTotalPages),
    [currentPage, calculatedTotalPages]
  );

  function go(nextPage) {
    if (loading || typeof onPageChange !== "function") return;

    const safeNext = clamp(numberValue(nextPage, currentPage), 1, calculatedTotalPages);

    if (safeNext !== currentPage) {
      onPageChange(safeNext);
    }
  }

  return (
    <div className={`finance-pagination ${compact ? "compact" : ""}`}>
      <div className="finance-pagination-info">
        {showRange ? (
          <span>
            Showing <strong>{range.from}</strong> to <strong>{range.to}</strong>{" "}
            of <strong>{numberValue(total, 0).toLocaleString("en-US")}</strong>
          </span>
        ) : (
          <span>
            Page <strong>{currentPage}</strong> of{" "}
            <strong>{calculatedTotalPages}</strong>
          </span>
        )}

        {showPageSize && typeof onPageSizeChange === "function" ? (
          <label>
            Rows
            <select
              value={safePageSize}
              disabled={loading}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="finance-pagination-actions">
        <button
          type="button"
          className="finance-mini-button"
          disabled={loading || currentPage <= 1}
          onClick={() => go(1)}
          aria-label="First page"
        >
          <ChevronsLeft size={15} />
        </button>

        <button
          type="button"
          className="finance-mini-button"
          disabled={loading || currentPage <= 1}
          onClick={() => go(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>

        <div className="finance-pagination-pages">
          {pages.map((item) =>
            typeof item === "number" ? (
              <button
                key={item}
                type="button"
                className={`finance-page-number ${
                  item === currentPage ? "active" : ""
                }`}
                disabled={loading || item === currentPage}
                onClick={() => go(item)}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="finance-page-ellipsis">
                ...
              </span>
            )
          )}
        </div>

        <button
          type="button"
          className="finance-mini-button"
          disabled={loading || currentPage >= calculatedTotalPages}
          onClick={() => go(currentPage + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>

        <button
          type="button"
          className="finance-mini-button"
          disabled={loading || currentPage >= calculatedTotalPages}
          onClick={() => go(calculatedTotalPages)}
          aria-label="Last page"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
}