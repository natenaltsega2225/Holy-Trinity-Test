
// frontend/src/components/MembershipDashoard/pages/Documents.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Eye,
  Download,
  Search,
  FileBadge,
  CalendarDays,
  ShieldCheck,
  MoreVertical,
} from "lucide-react";

import api from "../../api";

import "../../../styles/member-documents.css";

/* =========================================================
   COMPONENT
========================================================= */

export default function Documents() {

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    documents,
    setDocuments,
  ] = useState([]);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    actionOpen,
    setActionOpen,
  ] = useState(null);

  /* =====================================================
     LOAD
  ===================================================== */

  async function loadDocuments() {

    try {

      setLoading(true);

      const res =
        await api.get(
          "/member/documents"
        );

      const items =
        Array.isArray(
          res.data?.items
        )
          ? res.data.items
          : [];

      items.sort(
        (a, b) =>
          String(
            a.title || ""
          ).localeCompare(
            String(
              b.title || ""
            )
          )
      );

      setDocuments(items);

    } catch (err) {

      console.error(err);

      alert(
        "Unable to load documents."
      );

    } finally {

      setLoading(false);
    }
  }

  useEffect(() => {

    loadDocuments();

  }, []);

  /* =====================================================
     FILTERED
  ===================================================== */

  const filteredDocuments =
    useMemo(() => {

      const q =
        search
          .toLowerCase()
          .trim();

      if (!q) {
        return documents;
      }

      return documents.filter(
        (doc) => {

          return (

            String(
              doc.title || ""
            )
              .toLowerCase()
              .includes(q)

            ||

            String(
              doc.type || ""
            )
              .toLowerCase()
              .includes(q)

            ||

            String(
              doc.certificate_number || ""
            )
              .toLowerCase()
              .includes(q)
          );
        }
      );

    }, [
      documents,
      search,
    ]);

  /* =====================================================
     VIEW
  ===================================================== */

  async function handleView(
    id
  ) {

    try {

      const response =
        await api.get(
          `/member/documents/${id}/view`,
          {
            responseType:
              "blob",
          }
        );

      const blob =
        new Blob(
          [response.data],
          {
            type:
              "application/pdf",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      window.open(
        url,
        "_blank"
      );

    } catch (err) {

      console.error(err);

      alert(
        "Unable to open certificate."
      );
    }
  }

  /* =====================================================
     DOWNLOAD
  ===================================================== */

  async function handleDownload(
    id
  ) {

    try {

      const response =
        await api.get(
          `/member/documents/${id}/download`,
          {
            responseType:
              "blob",
          }
        );

      const blob =
        new Blob(
          [response.data],
          {
            type:
              "application/pdf",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      link.download =
        "certificate.pdf";

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        url
      );

    } catch (err) {

      console.error(err);

      alert(
        "Unable to download certificate."
      );
    }
  }

  /* =====================================================
     FORMAT TYPE
  ===================================================== */

  function prettyType(
    type = ""
  ) {

    return String(type)
      .replaceAll(
        "_",
        " "
      )
      .replace(
        /\b\w/g,
        (m) =>
          m.toUpperCase()
      );
  }

  /* =====================================================
     EMPTY
  ===================================================== */

  const isEmpty =
    !loading &&
    filteredDocuments.length === 0;

  /* =====================================================
     UI
  ===================================================== */

  return (

    <div className="member-doc-page">

      {/* =================================================
         HEADER
      ================================================= */}

      <div className="member-doc-header">

        <div>

          <h1>
            My Certificates & Documents
          </h1>

          <p>
            Secure enterprise
            document center
            for your official
            church certificates.
          </p>

        </div>

      </div>

      {/* =================================================
         SEARCH
      ================================================= */}

      <div className="member-doc-search">

        <Search size={16} />

        <input
          type="text"
          placeholder="Search documents..."
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
        />

      </div>

      {/* =================================================
         TABLE
      ================================================= */}

      <div className="member-doc-table-wrap">

        <table className="member-doc-table">

          <thead>

            <tr>

              <th>
                Document
              </th>

              <th>
                Type
              </th>

              <th>
                Certificate #
              </th>

              <th>
                Issued
              </th>

              <th>
                Status
              </th>

              <th>
                Action
              </th>

            </tr>

          </thead>

          <tbody>

            {loading && (

              <tr>

                <td
                  colSpan="6"
                  className="member-doc-loading"
                >
                  Loading documents...
                </td>

              </tr>
            )}

            {isEmpty && (

              <tr>

                <td
                  colSpan="6"
                  className="member-doc-empty"
                >

                  <div className="member-doc-empty-box">

                    <FileBadge size={42} />

                    <h3>
                      No Documents Found
                    </h3>

                    <p>
                      Your certificates
                      and documents
                      will appear here.
                    </p>

                  </div>

                </td>

              </tr>
            )}

            {!loading &&
              filteredDocuments.map(
                (doc) => (

                  <tr key={doc.id}>

                    {/* =============================
                       DOC
                    ============================== */}
<td>

  <div className="member-doc-user">

    <div className="member-doc-icon">

      <FileBadge size={18} />

    </div>

    <div className="member-doc-title">

      {
        prettyType(
          doc.document_type ||
          doc.type
        )
      }

    </div>

  </div>

</td>
                    {/* =============================
                       TYPE
                    ============================== */}

                    <td>

                      <span className="member-doc-type">

                        {
                          prettyType(
                            doc.type
                          )
                        }

                      </span>

                    </td>

                    {/* =============================
                       CERT
                    ============================== */}

                    <td>

                      <span className="member-doc-cert">

                        {
                          doc.certificate_number
                        }

                      </span>

                    </td>

                    {/* =============================
                       DATE
                    ============================== */}

                    <td>

                      <div className="member-doc-date">

                        <CalendarDays size={14} />

                        {new Date(
                          doc.created_at
                        ).toLocaleDateString()}

                      </div>

                    </td>

                    {/* =============================
                       STATUS
                    ============================== */}

                    <td>

                      <div className="member-doc-status">

                        <ShieldCheck size={14} />

                        {
                          doc.status ||
                          "active"
                        }

                      </div>

                    </td>

                    {/* =============================
                       ACTIONS
                    ============================== */}

                    <td>

                      <div className="member-doc-actions-wrap">

                        <button
                          className="member-doc-action-btn"
                          onClick={() =>
                            setActionOpen(
                              actionOpen ===
                                doc.id
                                ? null
                                : doc.id
                            )
                          }
                        >
                          <MoreVertical size={16} />
                        </button>

                        {actionOpen ===
                          doc.id && (

                          <div className="member-doc-action-menu">

                            <button
                              onClick={() =>
                                handleView(
                                  doc.id
                                )
                              }
                            >
                              <Eye size={15} />
                              View
                            </button>

                            <button
                              onClick={() =>
                                handleDownload(
                                  doc.id
                                )
                              }
                            >
                              <Download size={15} />
                              Download
                            </button>

                          </div>
                        )}

                      </div>

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