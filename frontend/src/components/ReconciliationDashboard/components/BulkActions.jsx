import React from "react";
import api from "../../api";

export default function BulkActions({ selected = [], reload }) {
  async function handleBulkMatch() {
    if (!selected.length) return;
    await api.post("/reconciliation/bulk-match", { ids: selected });
    reload?.();
  }

  return (
    <div className="recon-bulk-actions">
      <button
        type="button"
        className="recon-btn recon-btn-primary"
        onClick={handleBulkMatch}
        disabled={!selected.length}
      >
        Match Selected ({selected.length})
      </button>
    </div>
  );
}