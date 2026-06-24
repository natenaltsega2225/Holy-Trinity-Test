// frontend/src/components/FinanceDashboard/components/FinanceMemberLookup.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  User,
  UserRound,
  Users,
  X,
} from "lucide-react";

import api from "../../api";
import "../../../styles/finance-enterprise.css";

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.rows,
    payload?.data,
    payload?.members,
    payload?.items,
    payload?.results,
    payload?.data?.rows,
    payload?.data?.members,
    payload?.data?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];

    if (value !== undefined && value !== null && clean(value) !== "") {
      return value;
    }
  }

  return fallback;
}

function memberId(member) {
  return firstValue(member, ["id", "member_id"], "");
}

function memberNo(member) {
  return firstValue(member, ["member_no", "member_number"], "--");
}

function fullName(member) {
  return firstValue(
    member,
    ["full_name", "name", "display_name", "member_name"],
    "Unnamed Member"
  );
}

function email(member) {
  return firstValue(member, ["email", "member_email"], "");
}

function phone(member) {
  return firstValue(member, ["phone", "mobile", "member_phone"], "");
}

function status(member) {
  return firstValue(member, ["membership_status", "status", "member_status"], "");
}

function address(member) {
  const line = firstValue(member, ["address", "street_address"], "");
  const city = firstValue(member, ["city"], "");
  const state = firstValue(member, ["state"], "");
  const zip = firstValue(member, ["zip", "zipcode", "postal_code"], "");

  return [line, city, state, zip].filter(Boolean).join(", ");
}

function buildMemberSnapshot(member) {
  if (!member) return null;

  return {
    id: memberId(member),
    member_id: memberId(member),
    member_no: memberNo(member),
    full_name: fullName(member),
    email: email(member),
    phone: phone(member),
    status: status(member),
    address: address(member),
    raw: member,
  };
}

function StatusBadge({ value }) {
  const text = clean(value);

  if (!text) return null;

  const normalized = text.toLowerCase();
  const tone =
    normalized.includes("active") || normalized.includes("paid")
      ? "success"
      : normalized.includes("pending") || normalized.includes("open")
        ? "warning"
        : normalized.includes("inactive") || normalized.includes("overdue")
          ? "danger"
          : "neutral";

  return (
    <span className={`finance-status-badge ${tone}`}>
      {text.replaceAll("_", " ")}
    </span>
  );
}

export default function FinanceMemberLookup({
  value,
  onChange,
  onSelect,
  onGuestChange,

  label = "Member / Donor",
  placeholder = "Search by member ID, name, email, or phone...",
  required = false,

  allowGuest = true,
  defaultPayerType = "member",
  payerType,
  onPayerTypeChange,

  autoFocus = false,
  disabled = false,
  compact = false,

  endpoint = "/finance/members",
  minSearchLength = 2,
  limit = 10,
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(value || null);
  const [type, setType] = useState(payerType || defaultPayerType);

  const [guest, setGuest] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const wrapperRef = useRef(null);

  const selectedSnapshot = useMemo(
    () => buildMemberSnapshot(selected),
    [selected]
  );

  const effectiveType = payerType || type;

  const setEffectiveType = (nextType) => {
    setType(nextType);
    onPayerTypeChange?.(nextType);

    if (nextType === "guest") {
      setSelected(null);
      onChange?.(null);
      onSelect?.(null);
    }
  };

  const loadMembers = useCallback(
    async (nextQuery) => {
      const q = clean(nextQuery);

      if (q.length < minSearchLength) {
        setRows([]);
        setOpen(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await api.get(endpoint, {
          params: {
            q,
            search: q,
            page: 1,
            limit,
            pageSize: limit,
            active: "",
            status: "",
          },
        });

        const nextRows = normalizeRows(response.data);

        setRows(nextRows);
        setOpen(true);
      } catch (err) {
        setError(
          err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            "Failed to search members."
        );
      } finally {
        setLoading(false);
      }
    },
    [endpoint, limit, minSearchLength]
  );

  useEffect(() => {
    setSelected(value || null);
  }, [value]);

  useEffect(() => {
    if (payerType) {
      setType(payerType);
    }
  }, [payerType]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (effectiveType === "member") {
        loadMembers(query);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, effectiveType, loadMembers]);

  useEffect(() => {
    function handleClick(event) {
      if (!wrapperRef.current) return;

      if (!wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function chooseMember(member) {
    setSelected(member);
    setQuery("");
    setOpen(false);

    onChange?.(member);
    onSelect?.(buildMemberSnapshot(member), member);
  }

  function clearSelected() {
    setSelected(null);
    setQuery("");
    setRows([]);
    setOpen(false);

    onChange?.(null);
    onSelect?.(null);
  }

  function updateGuest(key, nextValue) {
    const nextGuest = {
      ...guest,
      [key]: nextValue,
    };

    setGuest(nextGuest);

    onGuestChange?.({
      payer_type: "guest",
      donor_type: "guest",
      full_name: clean(nextGuest.full_name),
      payer_name: clean(nextGuest.full_name),
      donor_name: clean(nextGuest.full_name),
      email: clean(nextGuest.email),
      payer_email: clean(nextGuest.email),
      donor_email: clean(nextGuest.email),
      phone: clean(nextGuest.phone),
    });
  }

  return (
    <div
      ref={wrapperRef}
      className={`finance-member-lookup ${compact ? "compact" : ""}`}
    >
      <div className="finance-lookup-head">
        <label>
          {label}
          {required ? <span> *</span> : null}
        </label>

        {allowGuest ? (
          <div className="finance-segmented-control">
            <button
              type="button"
              className={effectiveType === "member" ? "active" : ""}
              onClick={() => setEffectiveType("member")}
              disabled={disabled}
            >
              <UserRound size={14} />
              Member
            </button>

            <button
              type="button"
              className={effectiveType === "guest" ? "active" : ""}
              onClick={() => setEffectiveType("guest")}
              disabled={disabled}
            >
              <User size={14} />
              Non-Member
            </button>
          </div>
        ) : null}
      </div>

      {effectiveType === "member" ? (
        <>
          {selectedSnapshot ? (
            <div className="finance-selected-member">
              <div className="finance-selected-member-icon">
                <Users size={18} />
              </div>

              <div>
                <strong>{selectedSnapshot.full_name}</strong>
                <span>
                  {selectedSnapshot.member_no}
                  {selectedSnapshot.email ? ` - ${selectedSnapshot.email}` : ""}
                </span>
                <small>
                  {selectedSnapshot.phone || "--"}
                  {selectedSnapshot.status ? " - " : ""}
                  <StatusBadge value={selectedSnapshot.status} />
                </small>
              </div>

              <button
                type="button"
                className="finance-icon-button"
                onClick={clearSelected}
                disabled={disabled}
                aria-label="Clear selected member"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="finance-lookup-search">
              <Search size={16} />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                disabled={disabled}
                required={required}
                onFocus={() => {
                  if (rows.length) setOpen(true);
                }}
              />

              {loading ? <span className="finance-lookup-spinner">Searching</span> : null}
            </div>
          )}

          {error ? (
            <div className="finance-lookup-alert">
              <AlertTriangle size={14} />
              {error}
            </div>
          ) : null}

          {open && !selectedSnapshot ? (
            <div className="finance-lookup-results">
              {!loading && !rows.length ? (
                <div className="finance-lookup-empty">
                  No members found.
                </div>
              ) : null}

              {rows.map((member) => (
                <button
                  key={memberId(member) || memberNo(member)}
                  type="button"
                  className="finance-lookup-option"
                  onClick={() => chooseMember(member)}
                >
                  <div className="finance-lookup-option-icon">
                    <UserRound size={16} />
                  </div>

                  <div>
                    <strong>{fullName(member)}</strong>
                    <span>
                      {memberNo(member)}
                      {email(member) ? ` - ${email(member)}` : ""}
                    </span>
                    <small>
                      {phone(member) || "--"}
                      {status(member) ? " - " : ""}
                      <StatusBadge value={status(member)} />
                    </small>
                  </div>

                  <CheckCircle2 size={16} />
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="finance-form-grid three">
          <label>
            Non-Member Name {required ? "*" : ""}
            <input
              value={guest.full_name}
              onChange={(event) => updateGuest("full_name", event.target.value)}
              placeholder="Donor or payer full name"
              disabled={disabled}
              required={required}
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={guest.email}
              onChange={(event) => updateGuest("email", event.target.value)}
              placeholder="guest@email.com"
              disabled={disabled}
            />
          </label>

          <label>
            Phone
            <input
              value={guest.phone}
              onChange={(event) => updateGuest("phone", event.target.value)}
              placeholder="(615) 000-0000"
              disabled={disabled}
            />
          </label>
        </div>
      )}
    </div>
  );
}