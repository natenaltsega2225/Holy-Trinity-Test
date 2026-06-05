//frontend\src\components\FinanceDashboard\components\FinancePagination.jsx
import React from "react";

export default function FinancePagination({
  page = 1,
  totalPages = 1,
  total = 0,
  pageSize = 10,
  onPageChange,
}) {
  const safePage = Math.max(1, Number(page || 1));
  const safeTotalPages = Math.max(1, Number(totalPages || 1));
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  return (
    <div className="finance-pagination">
      <div className="finance-pagination-meta">
        Showing <strong>{start}</strong> to <strong>{end}</strong> of{" "}
        <strong>{total}</strong> records
      </div>

      <div className="finance-pagination-actions">
        <button
          type="button"
          className="finance-btn finance-btn-secondary"
          disabled={safePage <= 1}
          onClick={() => onPageChange?.(safePage - 1)}
        >
          Prev
        </button>

        <span className="finance-pagination-page">
          Page {safePage} of {safeTotalPages}
        </span>

        <button
          type="button"
          className="finance-btn finance-btn-secondary"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange?.(safePage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}