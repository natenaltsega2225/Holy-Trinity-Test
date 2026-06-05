// src/components/common/StatusBadge.jsx
import React from "react";

const colors = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-200 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }) {
  const key = String(status || "").toLowerCase();
  const style = colors[key] || "bg-gray-100 text-gray-600";

  return (
    <span className={`px-2 py-1 rounded-full text-xs ${style}`}>
      {status}
    </span>
  );
}