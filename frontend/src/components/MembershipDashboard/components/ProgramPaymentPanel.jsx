// frontend/src/components/MembershipDashboard/components/ProgramPaymentPanel.jsx

import React from "react";

import "../../../styles/membership-dashboard.css";

/* =========================================================
   HELPERS
========================================================= */

function money(value) {

  return `$${Number(
    value || 0
  ).toLocaleString(undefined, {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {

  if (!value) {

    return "--";
  }

  const d =
    new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {

    return "--";
  }

  return d.toLocaleDateString(
    "en-US"
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ProgramPaymentPanel({

  selectedType,

  programs = [],

  selectedProgram,

  setSelectedProgram,

  programQuantity,

  setProgramQuantity,
}) {

  const selectedRow =
    programs.find(

      (p) =>

        Number(p.id) ===
        Number(
          selectedProgram
        )
    ) || null;

  return (

    <div className="payx-panel">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="payx-section-head">

        <div>

          <h3 className="payx-section-title">

            {selectedType ===
            "school"

              ? "Kids School Programs"

              : "Trip Programs"}

          </h3>

          <p className="payx-section-subtitle">

            Register participants
            and securely pay online
            for church programs
            and activities.

          </p>

        </div>

      </div>

      {/* =====================================
          PROGRAM GRID
      ===================================== */}

      <div className="payx-program-grid">

        {programs.map((program) => {

          const active =

            Number(
              selectedProgram
            ) ===
            Number(
              program.id
            );

          return (

            <button
              key={program.id}
              type="button"
              className={`
                payx-program-card
                ${
                  active
                    ? "active"
                    : ""
                }
              `}
              onClick={() =>
                setSelectedProgram(
                  program.id
                )
              }
            >

              {/* =========================
                  TOP
              ========================= */}

              <div className="payx-program-top">

                <span className="payx-program-category">

                  {selectedType ===
                  "school"

                    ? "Kids School"

                    : "Trip"}

                </span>

              </div>

              {/* =========================
                  TITLE
              ========================= */}

              <h4>
                {program.title}
              </h4>

              {/* =========================
                  SUMMARY
              ========================= */}

              <p>
                {program.summary ||
                  "Church community program"}
              </p>

              {/* =========================
                  META
              ========================= */}

              <div className="payx-program-meta">

                <div className="payx-program-meta-row">

                  <span>
                    Date
                  </span>

                  <strong>

                    {formatDate(
                      program.start_date
                    )}

                  </strong>

                </div>

                <div className="payx-program-meta-row">

                  <span>
                    Price
                  </span>

                  <strong>

                    {money(
                      program.price_per_person
                    )}

                  </strong>

                </div>

              </div>

              {/* =========================
                  ACTIVE
              ========================= */}

              {active ? (

                <div className="payx-program-selected">

                  ✓ Selected Program

                </div>

              ) : null}

            </button>
          );
        })}

      </div>

      {/* =====================================
          QUANTITY
      ===================================== */}

      {selectedRow ? (

        <div className="payx-program-checkout">

          <label className="payx-field-label">

            Number of Participants

          </label>

          <input
            className="payx-input"
            type="number"
            min="1"
            value={programQuantity}
            onChange={(e) =>
              setProgramQuantity(
                e.target.value
              )
            }
          />

          {/* =========================
              TOTAL
          ========================= */}

          <div className="payx-program-total">

            <span>
              Total
            </span>

            <strong>

              {money(

                Number(
                  selectedRow.price_per_person ||
                    0
                ) *

                Number(
                  programQuantity || 1
                )
              )}

            </strong>

          </div>

        </div>

      ) : null}

    </div>
  );
}