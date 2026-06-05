// src/components/common/SearchToolbar.jsx
import React from "react";

export default function SearchToolbar({
  search,
  onSearchChange,
  filters,
}) {
  return (
    <div className="flex flex-col md:flex-row gap-3 mb-4">
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="border rounded-lg px-3 py-2 w-full md:w-80"
      />

      {filters && <div className="flex gap-2">{filters}</div>}
    </div>
  );
}