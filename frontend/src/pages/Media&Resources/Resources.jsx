//  // frontend/src/pages/Media&Resources/Resources.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../../styles/resources.module.css";
import api from "../../components/api";

function PdfIcon() {
  return (
    <div className={styles.pdfIconWrap} aria-hidden="true">
      <svg viewBox="0 0 64 80" className={styles.pdfIconSvg} role="img" aria-label="PDF file">
        <path d="M14 2h26l18 18v46c0 6.6-5.4 12-12 12H14C7.4 78 2 72.6 2 66V14C2 7.4 7.4 2 14 2z" />
        <path d="M40 2v18h18" className={styles.pdfFold} />
        <text x="32" y="50" textAnchor="middle">
          PDF
        </text>
      </svg>
    </div>
  );
}

function PreviewCell({ item }) {
  const isPdf =
    item?.mime_type === "application/pdf" ||
    String(item?.file_url || "").toLowerCase().endsWith(".pdf");

  if (item?.thumbnail_url && !isPdf) {
    return (
      <img
        src={item.thumbnail_url}
        alt={item.title}
        className={styles.thumbnail}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return <PdfIcon />;
}

export default function Resources() {
  const nav = useNavigate();

  const [allResources, setAllResources] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 4;
  const categories = ["All", "Scripture", "Bulletins", "Books", "Learning", "Forms"];

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get("/resources", {
          params: {
            category: activeCategory,
            search: searchTerm,
            page: 1,
            pageSize: 1000,
          },
        });

        setAllResources(data.rows || []);
        setCurrentPage(1);
      } catch (e) {
        console.error(e);
        setAllResources([]);
        setCurrentPage(1);
      }
    }

    load();
  }, [activeCategory, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(allResources.length / itemsPerPage));

  const visibleRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allResources.slice(start, start + itemsPerPage);
  }, [allResources, currentPage]);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={styles.resourcesPage}>
      <div className={styles.resourcesContainer}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => nav("/", { state: { scrollTo: "media-resources" } })}
        >
          ← Back to Media & Resources
        </button>

        <header className={styles.resourcesHeader}>
          <div className={styles.headerBadge}>Documents • Learning • Worship Materials</div>
          <h1>Church Resources</h1>
          <p>
            Access scripture, bulletins, books, forms, and learning materials
            for spiritual growth and personal study.
          </p>
        </header>

        <div className={styles.resourceTopBar}>
          <div className={styles.resourceSearch}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search resources..."
              className={styles.resourceSearchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.resourceFilters}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.filterChip} ${
                  activeCategory === cat ? styles.filterChipActive : ""
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.resourceTable}>
          <div className={styles.resourceTableHeader}>
            <div>Preview</div>
            <div>Title</div>
            <div>Category</div>
            <div>Uploaded</div>
            <div>Actions</div>
          </div>

          {visibleRows.length === 0 ? (
            <div className={styles.emptyState}>No resources found.</div>
          ) : (
            visibleRows.map((item) => (
              <div key={item.id} className={styles.resourceTableRow}>
                <div className={styles.resourceTableCell}>
                  <PreviewCell item={item} />
                </div>

                <div className={styles.resourceTableCell}>
                  <div className={styles.resourceTextBlock}>
                    <div className={styles.resourceTitle}>{item.title}</div>
                    <div className={styles.resourceDesc}>
                      {item.description || "Church resource document"}
                    </div>
                  </div>
                </div>

                <div className={styles.resourceTableCell}>
                  <span
                    className={`${styles.categoryBadge} ${
                      styles[`cat${String(item.category || "").replace(/\s/g, "")}`]
                    }`}
                  >
                    {item.category}
                  </span>
                </div>

                <div className={styles.resourceTableCell}>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleDateString()
                    : "--"}
                </div>

                <div className={styles.resourceActions}>
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.viewButton}
                  >
                    View
                  </a>

                  <a
                    href={item.file_url}
                    download
                    className={styles.downloadButton}
                  >
                    Download
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.mobileCards}>
          {visibleRows.length === 0 ? (
            <div className={styles.emptyState}>No resources found.</div>
          ) : (
            visibleRows.map((item) => (
              <div key={item.id} className={styles.resourceCard}>
                <div className={styles.resourceCardHeader}>
                  <PreviewCell item={item} />

                  <div className={styles.mobileCardText}>
                    <h3>{item.title}</h3>
                    <span
                      className={`${styles.cardCategory} ${
                        styles[`cat${String(item.category || "").replace(/\s/g, "")}`]
                      }`}
                    >
                      {item.category}
                    </span>
                  </div>
                </div>

                <p className={styles.resourceCardBody}>
                  {item.description || "Church resource document"}
                </p>

                <div className={styles.resourceCardFooter}>
                  <span className={styles.mobileDate}>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : "--"}
                  </span>

                  <div className={styles.resourceCardActions}>
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.viewButton}
                    >
                      View
                    </a>

                    <a
                      href={item.file_url}
                      download
                      className={styles.downloadButton}
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {allResources.length > 0 && (
          <div className={styles.paginationWrapper}>
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.paginationButton}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Prev
              </button>

              <div className={styles.paginationStatus}>
                <span className={styles.paginationLabel}>Page</span>
                <span className={styles.paginationCurrent}>{currentPage}</span>
                <span className={styles.paginationDivider}>of</span>
                <span className={styles.paginationTotal}>{totalPages}</span>
              </div>

              <button
                type="button"
                className={styles.paginationButton}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}