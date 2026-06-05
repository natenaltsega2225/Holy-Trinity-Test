//frontend\src\pages\Media&Resources\MediaGallery.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/MediaGallery.css";
import AlbumCard from "./AlbumCard";
import Lightbox from "./Lightbox";
import api from "../../components/api";

export default function MediaGallery() {
  const nav = useNavigate();
  const [galleryItems, setGalleryItems] = useState([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 6;

  useEffect(() => {
    async function loadAlbums() {
      try {
        const { data } = await api.get("/gallery/albums");
        const rows = data?.rows || [];

        const normalized = rows.map((album) => ({
          id: album.id,
          title: album.title,
          description: album.description,
          url: album.cover_image_url || "/images/placeholder.png",
          caption: album.description || album.title || "Gallery photo",
          photoCount: album.photo_count || 0,
        }));

        setGalleryItems(normalized);
      } catch (e) {
        console.error(e);
        setGalleryItems([]);
      }
    }

    loadAlbums();
  }, []);

  const totalPages = Math.max(1, Math.ceil(galleryItems.length / itemsPerPage));

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return galleryItems.slice(start, start + itemsPerPage);
  }, [galleryItems, currentPage]);

  const openPhoto = (globalIndex) => {
    setCurrentPhotoIndex(globalIndex);
    setLightboxOpen(true);
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="gallery-page">
      <div className="gallery-container">
        <button
          type="button"
          className="gallery-back-btn"
          onClick={() => nav("/", { state: { scrollTo: "media-resources" } })}
        >
          ← Back to Media & Resources
        </button>

        <div className="gallery-hero">
          <div className="gallery-hero-badge">Faith • Fellowship • Celebration</div>
          <h1>Media Gallery</h1>
          <p>
            Explore memorable moments from feast days, worship, celebrations,
            and community gatherings.
          </p>
        </div>

        {paginatedItems.length === 0 ? (
          <div className="gallery-empty-state">
            <h3>No photos available</h3>
            <p>Uploaded gallery photos will appear here once they are published.</p>
          </div>
        ) : (
          <>
            <div className="albums-grid">
              {paginatedItems.map((item, index) => {
                const globalIndex = (currentPage - 1) * itemsPerPage + index;

                return (
                  <AlbumCard
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    coverImage={item.url}
                    photoCount={item.photoCount}
                    onClick={() => openPhoto(globalIndex)}
                  />
                );
              })}
            </div>

            {galleryItems.length > 0 && (
              <div className="gallery-pagination-wrap">
                <div className="gallery-pagination">
                  <button
                    type="button"
                    className="gallery-page-btn"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </button>

                  <div className="gallery-page-status">
                    <span>Page</span>
                    <strong>{currentPage}</strong>
                    <span>of</span>
                    <strong>{totalPages}</strong>
                  </div>

                  <button
                    type="button"
                    className="gallery-page-btn"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <Lightbox
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          photos={galleryItems}
          currentIndex={currentPhotoIndex}
          onNavigate={(index) => setCurrentPhotoIndex(index)}
          albumTitle={galleryItems[currentPhotoIndex]?.title || "Gallery"}
        />
      </div>
    </div>
  );
}

