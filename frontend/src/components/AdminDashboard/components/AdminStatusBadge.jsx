import React from "react";

export default function AdminStatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  let className = "badge";

  if (
    ["active", "published", "enabled", "approved", "success"].includes(normalized)
  ) {
    className = "pill pill-ok";
  } else if (
    ["pending", "draft", "review", "inactive"].includes(normalized)
  ) {
    className = "pill pill-warn";
  } else if (
    ["failed", "disabled", "rejected", "deleted", "archived"].includes(normalized)
  ) {
    className = "btn btn-danger";
  }

  return <span className={className}>{status || "--"}</span>;
}