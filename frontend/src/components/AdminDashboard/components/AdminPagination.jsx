import React from "react";

export default function AdminPagination({
  page = 1,
  totalPages = 1,
  onPageChange,
}) {
  const safePage = Math.max(1, Number(page || 1));
  const safeTotalPages = Math.max(1, Number(totalPages || 1));

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap",
        marginTop: 16,
      }}
    >
      <span style={{ color: "var(--dash-muted)", fontWeight: 700 }}>
        Page {safePage} of {safeTotalPages}
      </span>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn"
          disabled={safePage <= 1}
          onClick={() => onPageChange?.(safePage - 1)}
        >
          Prev
        </button>

        <button
          type="button"
          className="btn"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange?.(safePage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}