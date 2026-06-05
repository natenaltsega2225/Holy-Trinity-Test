// frontend/src/components/FinanceDashboard/components/FinanceLedgerToolbar.jsx

import React from "react";

import {
  Search,
  RefreshCcw,
  Download,
  Filter,
  Calendar,
  Plus,
  Scale,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

import "../../../styles/shared-payment-components.css";
// import "../finance-dashboard.css";

export default function FinanceLedgerToolbar({
  filters = {},
  onChange,
  onApply,
  onRefresh,
  onExport,
  onAdjustment,
  onManualEntry,
  onBatchReconcile,
  onBatchUnreconcile,
  selectedCount = 0,
}) {

  function update(
    key,
    value
  ) {

    onChange?.({
      ...filters,
      [key]: value,
    });
  }

  return (
    <div className="finance-toolbar-card">

      <div className="finance-toolbar-top">

        <div className="finance-toolbar-search">

          <Search size={16} />

          <input
            placeholder="Search ledger, payment, invoice, receipt, member..."
            value={
              filters.search || ""
            }
            onChange={(e) =>
              update(
                "search",
                e.target.value
              )
            }
          />

        </div>

        <div className="finance-toolbar-actions">

          <button
            className="finance-btn finance-btn-secondary"
            onClick={onRefresh}
          >
            <RefreshCcw size={16} />
            Refresh
          </button>

          <button
            className="finance-btn finance-btn-secondary"
            onClick={onExport}
          >
            <Download size={16} />
            Export
          </button>

          <button
            className="finance-btn finance-btn-secondary"
            onClick={onManualEntry}
          >
            <Scale size={16} />
            Manual Entry
          </button>

          <button
            className="finance-btn finance-btn-primary"
            onClick={onAdjustment}
          >
            <Plus size={16} />
            Adjustment
          </button>

        </div>

      </div>

      <div className="finance-toolbar-filters">

        <div className="finance-filter-group">

          <div className="finance-filter-label">
            <Filter size={14} />
            <span>Status</span>
          </div>

          <select
            value={
              filters.status || ""
            }
            onChange={(e) =>
              update(
                "status",
                e.target.value
              )
            }
          >
            <option value="">
              All
            </option>

            <option value="posted">
              Posted
            </option>

            <option value="draft">
              Draft
            </option>

            <option value="reversed">
              Reversed
            </option>

            <option value="void">
              Void
            </option>

          </select>

        </div>

        <div className="finance-filter-group">

          <div className="finance-filter-label">
            <CheckCircle2 size={14} />
            <span>
              Reconciliation
            </span>
          </div>

          <select
            value={
              filters.reconciliation_status || ""
            }
            onChange={(e) =>
              update(
                "reconciliation_status",
                e.target.value
              )
            }
          >
            <option value="">
              All
            </option>

            <option value="matched">
              Matched
            </option>

            <option value="pending">
              Pending
            </option>

          </select>

        </div>

        <div className="finance-filter-group">

          <div className="finance-filter-label">
            <Scale size={14} />
            <span>
              Entry Type
            </span>
          </div>

          <select
            value={
              filters.entry_type || ""
            }
            onChange={(e) =>
              update(
                "entry_type",
                e.target.value
              )
            }
          >
            <option value="">
              All
            </option>

            <option value="payment">
              Payment
            </option>

            <option value="membership">
              Membership
            </option>

            <option value="donation">
              Donation
            </option>

            <option value="refund">
              Refund
            </option>

            <option value="adjustment">
              Adjustment
            </option>

            <option value="pledge">
              Pledge
            </option>

          </select>

        </div>

        <div className="finance-filter-group">

          <div className="finance-filter-label">
            <Calendar size={14} />
            <span>
              From
            </span>
          </div>

          <input
            type="date"
            value={
              filters.date_from || ""
            }
            onChange={(e) =>
              update(
                "date_from",
                e.target.value
              )
            }
          />

        </div>

        <div className="finance-filter-group">

          <div className="finance-filter-label">
            <Calendar size={14} />
            <span>
              To
            </span>
          </div>

          <input
            type="date"
            value={
              filters.date_to || ""
            }
            onChange={(e) =>
              update(
                "date_to",
                e.target.value
              )
            }
          />

        </div>

        <div className="finance-toolbar-apply">

          <button
            className="finance-btn finance-btn-primary"
            onClick={onApply}
          >
            Apply Filters
          </button>

        </div>

      </div>

      {selectedCount > 0 && (

        <div className="finance-toolbar-batch">

          <div className="finance-toolbar-batch-info">

            <AlertTriangle size={16} />

            <span>
              {selectedCount} selected
            </span>

          </div>

          <div className="finance-toolbar-batch-actions">

            <button
              className="finance-btn finance-btn-success finance-btn-xs"
              onClick={onBatchReconcile}
            >
              <CheckCircle2 size={14} />
              Batch Reconcile
            </button>

            <button
              className="finance-btn finance-btn-warning finance-btn-xs"
              onClick={onBatchUnreconcile}
            >
              <XCircle size={14} />
              Batch Unreconcile
            </button>

          </div>

        </div>

      )}

    </div>
  );
}