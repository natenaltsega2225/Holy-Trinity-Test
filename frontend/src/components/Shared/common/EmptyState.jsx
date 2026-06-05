// src/components/common/EmptyState.jsx
import React from "react";

export default function EmptyState({
  title = "No data",
  description = "Nothing to display here yet.",
}) {
  return (
    <div className="text-center py-10">
      <p className="text-lg font-semibold text-gray-700">{title}</p>
      <p className="text-sm text-gray-500 mt-2">{description}</p>
    </div>
  );
}