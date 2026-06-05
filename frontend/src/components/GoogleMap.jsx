//src/components/GoogleMap.jsx
import React from "react";
import "../styles/GoogleMap.css";

const GoogleMap = () => {
  const q = encodeURIComponent(
    "Debre Birhan Holy Trinity Ethiopian Orthodox Church, Nashville TN"
  );

  return (
    <section
      id="google-map"
      className="map-section"
      aria-label="Church location on Google Maps"
    >
      <div className="map-container">
        <iframe
          className="map-iframe"
          title="Holy Trinity Location"
          src={`https://maps.google.com/maps?q=${q}&output=embed`}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </section>
  );
};

export default GoogleMap;
