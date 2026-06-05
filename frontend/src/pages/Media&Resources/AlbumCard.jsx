// //frontend\src\pages\Media&Resources\AlbumCard.jsx

import React from "react";
import "../../styles/MediaGallery.css";

export default function AlbumCard({
  title,
  description,
  coverImage,
  photoCount,
  onClick,
}) {
  const fallbackImage = "/images/placeholder.png";

  return (
    <button type="button" className="album-card" onClick={onClick}>
      <div className="album-cover-wrap">
        <img
          src={coverImage || fallbackImage}
          alt={title}
          className="album-cover"
        />
        <div className="album-cover-overlay">
          <span>View Photo</span>
        </div>
      </div>

      <div className="album-info">
        <h3>{title}</h3>
        <p>{description || "Church gallery memories and community moments."}</p>
        <div className="album-meta">
          <span className="photo-count">{photoCount || 0} photos</span>
        </div>
      </div>
    </button>
  );
}