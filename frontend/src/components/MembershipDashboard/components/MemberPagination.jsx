//frontend\src\components\MembershipDashoard\components\MemberPagination.jsx
import React from "react";

export default function MemberPagination({
  page = 1,
  totalPages = 1,
  onPageChange,
}) {

  const safePage = Math.max(
    1,
    Number(page || 1)
  );

  const safeTotalPages = Math.max(
    1,
    Number(totalPages || 1)
  );

  function goTo(next) {

    if (
      next < 1 ||
      next > safeTotalPages
    ) {
      return;
    }

    onPageChange?.(next);
  }

  const pages = [];

  for (
    let i = 1;
    i <= safeTotalPages;
    i += 1
  ) {

    if (
      i === 1 ||
      i === safeTotalPages ||
      Math.abs(i - safePage) <= 1
    ) {
      pages.push(i);
    }
  }

  return (
    <div className="member-pagination">

      <div className="member-pagination-left">

        <span className="member-pagination-label">
          Page {safePage} of {safeTotalPages}
        </span>

      </div>

      <div className="member-pagination-right">

        <button
          type="button"
          className="member-page-btn"
          disabled={safePage <= 1}
          onClick={() =>
            goTo(safePage - 1)
          }
        >
          Prev
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`member-page-btn ${
              p === safePage
                ? "is-active"
                : ""
            }`}
            onClick={() => goTo(p)}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          className="member-page-btn"
          disabled={
            safePage >= safeTotalPages
          }
          onClick={() =>
            goTo(safePage + 1)
          }
        >
          Next
        </button>

      </div>

    </div>
  );
}