import React from "react";
import api from "../../api";

export default function MatchModal({ row, onClose, reload }) {
  async function handleApprove() {
    await api.post(`/reconciliation/approve/${row.id}`);
    reload?.();
    onClose?.();
  }

  if (!row) return null;

  return (
    <div className="recon-modal-overlay" role="dialog" aria-modal="true">
      <div className="recon-modal">
        <div className="recon-modal-head">
          <h2>Side-by-Side Match Review</h2>
          <button type="button" className="recon-btn recon-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="recon-compare-grid">
          <section className="recon-compare-card">
            <h3>Database Payment</h3>
            <div className="recon-compare-row"><span>ID</span><strong>{row.id}</strong></div>
            <div className="recon-compare-row"><span>Name</span><strong>{row.full_name || "--"}</strong></div>
            <div className="recon-compare-row"><span>Amount</span><strong>${Number(row.amount || 0).toFixed(2)}</strong></div>
            <div className="recon-compare-row"><span>Reference</span><strong>{row.reference || "--"}</strong></div>
            <div className="recon-compare-row"><span>Status</span><strong>{row.reconciliation_status || "unmatched"}</strong></div>
          </section>

          <section className="recon-compare-card">
            <h3>External Source</h3>
            <div className="recon-placeholder-box">
              Connect Stripe or bank import rows here for side-by-side matching.
            </div>
          </section>
        </div>

        <div className="recon-modal-actions">
          <button type="button" className="recon-btn recon-btn-primary" onClick={handleApprove}>
            Approve Match
          </button>
        </div>
      </div>
    </div>
  );
}