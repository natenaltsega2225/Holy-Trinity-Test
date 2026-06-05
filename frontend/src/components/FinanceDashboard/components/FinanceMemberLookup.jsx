// frontend/src/components/FinanceDashboard/components/FinanceMemberLookup.jsx

import React, { useEffect, useMemo, useState } from "react";

import api from "../../api";

//import "../../../styles/finance-dashboard.css";

/* =========================================================
   HELPERS
========================================================= */

function displayName(row) {
  return (
    row?.full_name ||
    row?.name ||
    row?.email ||
    "Unknown"
  );
}

function memberNo(row) {
  return (
    row?.member_no ||
    row?.membership_id ||
    row?.member_number ||
    "--"
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceMemberLookup({
  value,
  onChange,
  allowGuest = true,
  allowCreate = true,
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [guest, setGuest] = useState({
    full_name: "",
    email: "",
    phone: "",
  });
  const [mode, setMode] = useState("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* =====================================================
     SEARCH
  ===================================================== */

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === "member") {
        searchMembers();
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, mode]);

  async function searchMembers() {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get("/finance/members", {
        params: {
          search: query,
          limit: 10,
        },
      });

      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      console.error(err);
      setError("Unable to search members.");
    } finally {
      setLoading(false);
    }
  }

  function selectMember(row) {
    onChange?.({
      type: "member",
      member_id: row.id,
      member: row,
      guest: null,
    });
  }

  function updateGuest(key, val) {
    const next = {
      ...guest,
      [key]: val,
    };

    setGuest(next);

    onChange?.({
      type: "guest",
      member_id: null,
      member: null,
      guest: next,
    });
  }

  const selectedLabel = useMemo(() => {
    if (value?.type === "guest") {
      return value?.guest?.full_name || "Guest donor";
    }

    if (value?.member) {
      return `${displayName(value.member)} • ${memberNo(value.member)}`;
    }

    return "No payer selected";
  }, [value]);

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div className="finance-member-lookup">
      <div className="finance-lookup-head">
        <div>
          <h3>Payer / Member</h3>
          <p>
            Search existing members or record a walk-in guest donor/program payer.
          </p>
        </div>

        <span className="finance-lookup-selected">
          {selectedLabel}
        </span>
      </div>

      <div className="finance-lookup-tabs">
        <button
          type="button"
          className={mode === "member" ? "active" : ""}
          onClick={() => setMode("member")}
        >
          Existing Member
        </button>

        {allowGuest ? (
          <button
            type="button"
            className={mode === "guest" ? "active" : ""}
            onClick={() => setMode("guest")}
          >
            Guest / Walk-in
          </button>
        ) : null}
      </div>

      {mode === "member" ? (
        <>
          <div className="finance-field">
            <label>Search Member</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, phone, or member number"
            />
          </div>

          {error ? (
            <div className="finance-alert error">{error}</div>
          ) : null}

          <div className="finance-lookup-results">
            {loading ? (
              <div className="finance-lookup-empty">
                Searching members...
              </div>
            ) : null}

            {!loading && !rows.length ? (
              <div className="finance-lookup-empty">
                No members found.
              </div>
            ) : null}

            {!loading &&
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`finance-lookup-row ${
                    Number(value?.member_id) === Number(row.id)
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => selectMember(row)}
                >
                  <div>
                    <strong>{displayName(row)}</strong>
                    <span>
                      {memberNo(row)} • {row.email || "--"} • {row.phone || "--"}
                    </span>
                  </div>

                  <em>{row.membership_status || "member"}</em>
                </button>
              ))}
          </div>

          {allowCreate ? (
            <div className="finance-lookup-create-note">
              Need a new member? Use Finance → Members → Register New Member,
              then return here to record the first payment.
            </div>
          ) : null}
        </>
      ) : null}

      {mode === "guest" ? (
        <div className="finance-guest-box">
          <div className="finance-grid-2">
            <div className="finance-field">
              <label>Guest / Donor Name</label>
              <input
                value={guest.full_name}
                onChange={(e) => updateGuest("full_name", e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className="finance-field">
              <label>Email</label>
              <input
                value={guest.email}
                onChange={(e) => updateGuest("email", e.target.value)}
                placeholder="Email for receipt"
              />
            </div>
          </div>

          <div className="finance-field">
            <label>Phone</label>
            <input
              value={guest.phone}
              onChange={(e) => updateGuest("phone", e.target.value)}
              placeholder="Optional phone number"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}