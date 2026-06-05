// //frontend\src\pages\Media&Resources\Lightbox.jsx

import React from "react";
import "../../styles/MediaGallery.css";

export default function Lightbox({
  isOpen,
  onClose,
  photos,
  currentIndex,
  onNavigate,
  albumTitle,
}) {
  if (!isOpen || !photos || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  const goPrev = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const goNext = () => {
    if (currentIndex < photos.length - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="lightbox-close" onClick={onClose}>
          ×
        </button>

        <div className="lightbox-header">
          <h2 className="lightbox-title">{albumTitle}</h2>
          <div className="lightbox-counter">
            {currentIndex + 1} / {photos.length}
          </div>
        </div>

        <div className="lightbox-image-wrap">
          <img
            src={currentPhoto?.url}
            alt={currentPhoto?.caption || currentPhoto?.title || "Gallery photo"}
            className="lightbox-image"
          />
        </div>

        <p className="lightbox-caption">
          {currentPhoto?.caption || currentPhoto?.description || "Gallery photo"}
        </p>

        <div className="lightbox-controls">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIndex === 0}
          >
            Previous
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={currentIndex === photos.length - 1}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}


