import React from "react";
import { FINANCE_CATEGORIES } from "../../../constants/financeCategories";

export default function CategoryBadge({ value }) {
  const item = FINANCE_CATEGORIES.find(
    (c) => c.value === String(value || "").toLowerCase()
  );

  if (!item) {
    return <span className="badge badge-gray">{value || "--"}</span>;
  }

  return (
    <span className={`badge badge-${item.color}`}>
      <span className="badge-icon">{item.icon}</span>
      <span className="badge-text">
        <span className="amharic">{item.amharic}</span>
        <span className="english">{item.english}</span>
      </span>
    </span>
  );
}