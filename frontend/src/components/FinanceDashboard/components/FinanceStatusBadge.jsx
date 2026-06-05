import React from "react";

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

export default function FinanceStatusBadge({ status }) {
  const value = normalizeStatus(status);

  let cls = "finance-badge finance-badge-neutral";

  if (
    [
      "active",
      "approved",
      "paid",
      "completed",
      "verified",
      "matched",
      "posted",
      "cleared",
      "deposited",
      "succeeded",
      "sent",
      "issued",
    ].includes(value)
  ) {
    cls = "finance-badge finance-badge-success";
  } else if (
    ["pending", "received", "processing", "review", "reviewing"].includes(value)
  ) {
    cls = "finance-badge finance-badge-warning";
  } else if (
    ["failed", "voided", "returned", "inactive", "delinquent"].includes(value)
  ) {
    cls = "finance-badge finance-badge-danger";
  }

  return <span className={cls}>{status || "--"}</span>;
}