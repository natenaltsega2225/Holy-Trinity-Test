// frontend/src/components/FinanceDashboard/components/FinanceLedgerFiltersDrawer.jsx

import React from "react";

import {
  X,
  Filter,
  Calendar,
  Scale,
  CheckCircle2,
} from "lucide-react";

import "../../../styles/shared-payment-components.css";
// import "../finance-dashboard.css";

export default function FinanceLedgerFiltersDrawer({

  open,
  onClose,

  filters = {},
  onChange,

  onApply,
  onReset,

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

  if (!open)
    return null;

  return (
    <div className="finance-drawer-overlay">

      <div className="finance-drawer finance-drawer-md">

        <div className="finance-drawer-header">

          <div>

            <h2>
              Advanced
              Ledger
              Filters
            </h2>

            <p>
              Enterprise
              accounting
              filtering,
              reconciliation,
              audit,
              and financial
              search tools.
            </p>

          </div>

          <button
            type="button"
            className="finance-icon-btn"
            onClick={
              onClose
            }
          >
            <X size={18} />
          </button>

        </div>

        <div className="finance-drawer-body">

          <div className="finance-section-card">

            <div className="finance-section-title">

              <Filter size={16} />

              <span>
                General
                Filters
              </span>

            </div>

            <div className="finance-grid finance-grid-2">

              <div className="finance-field">

                <label>
                  Search
                </label>

                <input
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

              <div className="finance-field">

                <label>
                  Status
                </label>

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

                  <option value="reversed">
                    Reversed
                  </option>

                  <option value="draft">
                    Draft
                  </option>

                </select>

              </div>

            </div>

          </div>

          <div className="finance-section-card">

            <div className="finance-section-title">

              <Scale size={16} />

              <span>
                Accounting
                Filters
              </span>

            </div>

            <div className="finance-grid finance-grid-2">

              <div className="finance-field">

                <label>
                  Entry Type
                </label>

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

                  <option value="donation">
                    Donation
                  </option>

                  <option value="membership">
                    Membership
                  </option>

                  <option value="adjustment">
                    Adjustment
                  </option>

                  <option value="refund">
                    Refund
                  </option>

                </select>

              </div>

              <div className="finance-field">

                <label>
                  Member ID
                </label>

                <input
                  value={
                    filters.member_id || ""
                  }
                  onChange={(e) =>
                    update(
                      "member_id",
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

          </div>

          <div className="finance-section-card">

            <div className="finance-section-title">

              <CheckCircle2
                size={16}
              />

              <span>
                Reconciliation
              </span>

            </div>

            <div className="finance-field">

              <label>
                Reconciliation
                Status
              </label>

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

          </div>

          <div className="finance-section-card">

            <div className="finance-section-title">

              <Calendar size={16} />

              <span>
                Date Range
              </span>

            </div>

            <div className="finance-grid finance-grid-2">

              <div className="finance-field">

                <label>
                  From
                </label>

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

              <div className="finance-field">

                <label>
                  To
                </label>

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

            </div>

          </div>

        </div>

        <div className="finance-drawer-footer">

          <button
            className="finance-btn finance-btn-secondary"
            onClick={
              onReset
            }
          >
            Reset
          </button>

          <button
            className="finance-btn finance-btn-primary"
            onClick={
              onApply
            }
          >
            Apply
            Filters
          </button>

        </div>

      </div>

    </div>
  );
}