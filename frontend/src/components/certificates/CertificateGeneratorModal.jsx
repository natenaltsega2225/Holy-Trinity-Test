// frontend/src/components/certificates/CertificateGeneratorModal.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Award,
  CalendarDays,
  FileBadge,
  Plus,
  Search,
  ShieldCheck,
  User,
  X,
} from "lucide-react";

import api from "../api";

import "../../styles/certificate-generator.css";

/* =========================================================
   CERTIFICATE TYPES
========================================================= */

const CERTIFICATE_TYPES = [

  {
    value: "baptism_certificate",
    label: "Baptism Certificate",
  },

  {
    value: "engagement_certificate",
    label: "Engagement Certificate",
  },

  {
    value: "marriage_certificate",
    label: "Marriage Certificate",
  },

  {
    value: "participation_certificate",
    label: "Participation Certificate",
  },

  {
    value: "recognition_certificate",
    label: "Recognition Certificate",
  },

  {
    value: "volunteer_certificate",
    label: "Volunteer Certificate",
  },
];

/* =========================================================
   COMPONENT
========================================================= */

export default function CertificateGeneratorModal({
  open,
  onClose,
  onSuccess,
}) {

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    members,
    setMembers,
  ] = useState([]);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    form,
    setForm,
  ] = useState({

    memberId: "",

    type:
      "baptism_certificate",

    recipientName: "",

    brideName: "",

    priestName:
      "Church Priest",

    eventDate: "",

    dateIssued:
      new Date()
        .toISOString()
        .slice(0, 10),
  });

  /* =====================================================
     LOAD MEMBERS
  ===================================================== */

  useEffect(() => {

    if (!open) return;

    loadMembers();

  }, [open]);

  async function loadMembers() {

    try {

      const { data } =
        await api.get(
          "/admin/access-users",
          {
            params: {
              search,
              page: 1,
              pageSize: 200,
            },
          }
        );

      const rows =
        data?.rows || [];

      const normalized =
        rows.map((row) => ({

          id:
            row.member_id ||
            row.id,

          full_name:
            row.member_full_name ||
            row.full_name ||
            row.username ||
            "",

          email:
            row.email,
        }));

      setMembers(normalized);

    } catch (err) {

      console.error(
        "Load members failed:",
        err
      );

      setMembers([]);
    }
  }

  /* =====================================================
     MEMBER
  ===================================================== */

  const selectedMember =
    useMemo(() => {

      return members.find(
        (m) =>
          String(m.id) ===
          String(form.memberId)
      );

    }, [
      members,
      form.memberId,
    ]);

  /* =====================================================
     GENERATE
  ===================================================== */

  async function handleGenerate() {

    try {

      if (!form.memberId) {

        alert(
          "Please select a member."
        );

        return;
      }

      setLoading(true);

      const payload = {

        memberId:
          form.memberId,

        type:
          form.type,

        recipientName:
          form.recipientName,

        brideName:
          form.brideName,

        priestName:
          form.priestName,

        eventDate:
          form.eventDate,

        dateIssued:
          form.dateIssued,

        saveToMember: true,
      };

      const { data } =
        await api.post(
          "/certificates/generate",
          payload
        );

      alert(
        "Certificate generated successfully."
      );

      if (onSuccess) {

        onSuccess(data);
      }

      onClose();

    } catch (err) {

      console.error(err);

      alert(
        err?.response?.data?.error ||
        "Failed to generate certificate."
      );

    } finally {

      setLoading(false);
    }
  }

  /* =====================================================
     CLOSE
  ===================================================== */

  if (!open) return null;

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="certificate-generator-overlay">

      <div className="certificate-generator-modal">

        {/* =========================================
           HEADER
        ========================================== */}

        <div className="certificate-generator-header">

          <div>

            <span className="certificate-generator-badge">

              Certificate Center

            </span>

            <h2>
              Enterprise Certificate Generator
            </h2>

            <p>
              Generate official sacrament,
              recognition, volunteer, and
              church participation certificates.
            </p>

          </div>

          <button
            className="certificate-generator-close"
            onClick={onClose}
          >

            <X size={20} />

          </button>

        </div>

        {/* =========================================
           CONTENT
        ========================================== */}

        <div className="certificate-generator-layout">

          {/* =====================================
             FORM
          ====================================== */}

          <div className="certificate-generator-form">

            {/* SEARCH */}

            <label>

              <span>
                Search Member
              </span>

              <div className="certificate-search-box">

                <Search size={16} />

                <input
                  type="text"
                  placeholder="Search member..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                />

              </div>

            </label>

            {/* MEMBER */}

            <label>

              <span>
                Select Member
              </span>

              <select
                value={
                  form.memberId
                }
                onChange={(e) => {

                  const member =
                    members.find(
                      (m) =>
                        String(m.id) ===
                        e.target.value
                    );

                  setForm({

                    ...form,

                    memberId:
                      e.target.value,

                    recipientName:
                      member?.full_name ||
                      "",
                  });
                }}
              >

                <option value="">
                  Select Member
                </option>

                {
                  members.map(
                    (member) => (

                      <option
                        key={member.id}
                        value={member.id}
                      >

                        {member.full_name}

                      </option>
                    )
                  )
                }

              </select>

            </label>

            {/* TYPE */}

            <label>

              <span>
                Certificate Type
              </span>

              <select
                value={
                  form.type
                }
                onChange={(e) =>
                  setForm({

                    ...form,

                    type:
                      e.target.value,
                  })
                }
              >

                {
                  CERTIFICATE_TYPES.map(
                    (item) => (

                      <option
                        key={item.value}
                        value={item.value}
                      >

                        {item.label}

                      </option>
                    )
                  )
                }

              </select>

            </label>

            {/* RECIPIENT */}

            <label>

              <span>
                Recipient Name
              </span>

              <input
                type="text"
                value={
                  form.recipientName
                }
                onChange={(e) =>
                  setForm({

                    ...form,

                    recipientName:
                      e.target.value,
                  })
                }
              />

            </label>

            {/* BRIDE */}

            {
              (
                form.type ===
                  "marriage_certificate" ||

                form.type ===
                  "engagement_certificate"
              ) && (

                <label>

                  <span>
                    Bride Name
                  </span>

                  <input
                    type="text"
                    value={
                      form.brideName
                    }
                    onChange={(e) =>
                      setForm({

                        ...form,

                        brideName:
                          e.target.value,
                      })
                    }
                  />

                </label>
              )
            }

            {/* PRIEST */}

            <label>

              <span>
                Priest Name
              </span>

              <input
                type="text"
                value={
                  form.priestName
                }
                onChange={(e) =>
                  setForm({

                    ...form,

                    priestName:
                      e.target.value,
                  })
                }
              />

            </label>

            {/* DATE */}

            <label>

              <span>
                Ceremony Date
              </span>

              <input
                type="date"
                value={
                  form.eventDate
                }
                onChange={(e) =>
                  setForm({

                    ...form,

                    eventDate:
                      e.target.value,
                  })
                }
              />

            </label>

            {/* ISSUED */}

            <label>

              <span>
                Issued Date
              </span>

              <input
                type="date"
                value={
                  form.dateIssued
                }
                onChange={(e) =>
                  setForm({

                    ...form,

                    dateIssued:
                      e.target.value,
                  })
                }
              />

            </label>

            {/* ACTIONS */}

            <div className="certificate-generator-actions">

              <button
                className="certificate-btn-secondary"
                onClick={onClose}
              >

                Cancel

              </button>

              <button
                className="certificate-btn-primary"
                onClick={
                  handleGenerate
                }
                disabled={loading}
              >

                <Plus size={16} />

                {
                  loading
                    ? "Generating..."
                    : "Generate Certificate"
                }

              </button>

            </div>

          </div>

          {/* =====================================
             SUMMARY
          ====================================== */}

          <div className="certificate-generator-summary">

            <div className="certificate-summary-card">

              <div className="certificate-summary-icon">

                <ShieldCheck size={32} />

              </div>

              <h3>
                Certificate Summary
              </h3>

              <p>
                Enterprise church certificate
                generation workflow preview.
              </p>

              <div className="certificate-summary-list">

                <div className="certificate-summary-item">

                  <User size={18} />

                  <div>

                    <span>
                      Member
                    </span>

                    <strong>

                      {
                        selectedMember?.full_name ||
                        "Not selected"
                      }

                    </strong>

                  </div>

                </div>

                <div className="certificate-summary-item">

                  <Award size={18} />

                  <div>

                    <span>
                      Type
                    </span>

                    <strong>

                      {
                        CERTIFICATE_TYPES.find(
                          (x) =>
                            x.value ===
                            form.type
                        )?.label
                      }

                    </strong>

                  </div>

                </div>

                <div className="certificate-summary-item">

                  <CalendarDays size={18} />

                  <div>

                    <span>
                      Issued Date
                    </span>

                    <strong>

                      {
                        form.dateIssued
                      }

                    </strong>

                  </div>

                </div>

                <div className="certificate-summary-item">

                  <FileBadge size={18} />

                  <div>

                    <span>
                      Authorized By
                    </span>

                    <strong>

                      {
                        form.priestName ||
                        "Church Priest"
                      }

                    </strong>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}