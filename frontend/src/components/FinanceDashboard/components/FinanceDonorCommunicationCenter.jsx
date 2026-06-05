// frontend/src/components/FinanceDashboard/components/FinanceDonorCommunicationCenter.jsx

import React, {
  useMemo,
  useState,
} from "react";

import api from "../../api";

import {
  Mail,
  Send,
  Users,
  Clock,
  AlertTriangle,
} from "lucide-react";

// import "../finance-dashboard.css";

/* =========================================================
   COMPONENT
========================================================= */

export default function FinanceDonorCommunicationCenter({
  donors = [],
  history = [],
  onSuccess,
}) {

  const [group,
    setGroup] =
      useState("all");

  const [subject,
    setSubject] =
      useState("");

  const [message,
    setMessage] =
      useState("");

  const [sending,
    setSending] =
      useState(false);

  const [error,
    setError] =
      useState("");

  const filteredDonors =
    useMemo(() => {

      switch (group) {

        case "recurring":
          return donors.filter(
            (d) =>
              d.is_recurring
          );

        case "non_members":
          return donors.filter(
            (d) =>
              !d.member_no
          );

        case "major":
          return donors.filter(
            (d) =>
              Number(
                d.total_giving || 0
              ) >= 1000
          );

        case "overdue":
          return donors.filter(
            (d) =>
              d.has_overdue_pledge
          );

        default:
          return donors;
      }

    }, [
      donors,
      group,
    ]);

  async function handleSend() {

    try {

      setSending(true);

      setError("");

      await api.post(
        "/finance/donor-communications",
        {
          group,
          subject,
          message,
          recipients:
            filteredDonors.map(
              (d) => ({
                id: d.id,
                email:
                  d.email,
              })
            ),
        }
      );

      setSubject("");
      setMessage("");

      onSuccess?.();

    } catch (err) {

      setError(
        err?.response?.data
          ?.error ||
          "Unable to send communication."
      );

    } finally {

      setSending(false);
    }
  }

  return (

    <div className="finance-communication-center">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="finance-section-head">

        <div>

          <h2>
            Donor Communication Center
          </h2>

          <p>

            Enterprise donor CRM
            communication and
            fundraising outreach.

          </p>

        </div>

      </div>

      {/* =====================================
          ALERT
      ===================================== */}

      {error ? (

        <div className="finance-alert error">

          <AlertTriangle
            size={16}
          />

          {error}

        </div>

      ) : null}

      {/* =====================================
          FILTERS
      ===================================== */}

      <div className="finance-grid-2">

        <div className="finance-field">

          <label>
            Donor Group
          </label>

          <select
            value={group}
            onChange={(e) =>
              setGroup(
                e.target.value
              )
            }
          >

            <option value="all">
              All Donors
            </option>

            <option value="recurring">
              Recurring Donors
            </option>

            <option value="major">
              Major Donors
            </option>

            <option value="overdue">
              Overdue Pledges
            </option>

            <option value="non_members">
              Non Members
            </option>

          </select>

        </div>

        <div className="finance-field">

          <label>
            Recipients
          </label>

          <div className="finance-static-field">

            <Users size={16} />

            {
              filteredDonors.length
            }{" "}
            recipients

          </div>

        </div>

      </div>

      {/* =====================================
          SUBJECT
      ===================================== */}

      <div className="finance-field">

        <label>
          Subject
        </label>

        <input
          value={subject}
          onChange={(e) =>
            setSubject(
              e.target.value
            )
          }
        />

      </div>

      {/* =====================================
          MESSAGE
      ===================================== */}

      <div className="finance-field">

        <label>
          Message
        </label>

        <textarea
          rows="10"
          value={message}
          onChange={(e) =>
            setMessage(
              e.target.value
            )
          }
        />

      </div>

      {/* =====================================
          ACTIONS
      ===================================== */}

      <div className="finance-modal-footer">

        <button
          className="finance-btn primary"
          onClick={
            handleSend
          }
          disabled={sending}
        >

          <Send size={16} />

          {sending
            ? "Sending..."
            : "Send Communication"}

        </button>

      </div>

      {/* =====================================
          HISTORY
      ===================================== */}

      <div className="finance-section-head finance-section-head-tight">

        <h3>
          Communication History
        </h3>

      </div>

      <div className="finance-table-wrap">

        <table className="finance-table">

          <thead>

            <tr>

              <th>
                Subject
              </th>

              <th>
                Group
              </th>

              <th>
                Recipients
              </th>

              <th>
                Sent By
              </th>

              <th>
                Sent At
              </th>

            </tr>

          </thead>

          <tbody>

            {!history.length ? (

              <tr>

                <td
                  colSpan="5"
                  className="finance-empty-state"
                >

                  No communication
                  history found.

                </td>

              </tr>

            ) : null}

            {history.map(
              (
                row
              ) => (

                <tr
                  key={
                    row.id
                  }
                >

                  <td>

                    {
                      row.subject
                    }

                  </td>

                  <td>

                    {
                      row.group_name
                    }

                  </td>

                  <td>

                    {
                      row.recipient_count
                    }

                  </td>

                  <td>

                    {
                      row.sent_by_name
                    }

                  </td>

                  <td>

                    {new Date(
                      row.created_at
                    ).toLocaleString()}

                  </td>

                </tr>
              )
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}