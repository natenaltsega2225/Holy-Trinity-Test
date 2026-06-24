
////src/components/AboutUs.jsx
import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Church, Heart, Users, BookOpen } from "lucide-react";
import "../styles/Home.css";

const iconProps = {
  size: 24,
  strokeWidth: 2.2,
};

const AboutUs = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleVisitClick = (e) => {
    e.preventDefault();

    if (location.pathname === "/") {
      const section = document.getElementById("google-map");
      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate("/", { state: { scrollTo: "google-map" } });
    }
  };

  return (
    <>
      <section id="about-us" className="ht-section ht-section-white">
        <div className="ht-container">
          <div className="ht-section-head">
            <h2 className="ht-section-title">About Our Church</h2>
            <p className="ht-section-subtitle">
              Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant
              spiritual community dedicated to preserving our ancient faith
              while serving our modern world. We welcome all who seek to grow
              in their relationship with God through the rich traditions of
              Ethiopian Orthodoxy.
            </p>
          </div>

          <div className="ht-grid ht-grid-4">
            <div className="ht-card ht-card-equal">
              <div className="ht-icon-ring" aria-hidden="true">
                <Church {...iconProps} />
              </div>
              <h3 className="ht-card-title">Sacred Tradition</h3>
              <p className="ht-card-text">
                Preserving over 1,600 years of Ethiopian Orthodox Tewahedo
                Church tradition and liturgy.
              </p>
            </div>

            <div className="ht-card ht-card-equal">
              <div className="ht-icon-ring" aria-hidden="true">
                <Heart {...iconProps} />
              </div>
              <h3 className="ht-card-title">Community Love</h3>
              <p className="ht-card-text">
                Building a loving, supportive community that cares for one
                another in Christ&apos;s name.
              </p>
            </div>

            <div className="ht-card ht-card-equal">
              <div className="ht-icon-ring" aria-hidden="true">
                <Users {...iconProps} />
              </div>
              <h3 className="ht-card-title">Fellowship</h3>
              <p className="ht-card-text">
                Bringing together families and individuals in worship, service,
                and spiritual growth.
              </p>
            </div>

            <div className="ht-card ht-card-equal">
              <div className="ht-icon-ring" aria-hidden="true">
                <BookOpen {...iconProps} />
              </div>
              <h3 className="ht-card-title">Teaching</h3>
              <p className="ht-card-text">
                Providing biblical education and spiritual guidance for all ages
                and backgrounds.
              </p>
            </div>
          </div>

          <div className="ht-section-actions">
            <Link to="/about-us/details" className="ht-btn ht-btn-gold">
              More About Our Church
            </Link>
          </div>
        </div>
      </section>

      <section
        id="visit"
        className="ht-section ht-section-white ht-section-cta-compact"
      >
        <div className="ht-container">
          <div className="ht-banner ht-banner-compact">
            <h2 className="ht-banner-title">Join Our Sacred Community</h2>
            <p className="ht-banner-text">
              Whether you&apos;re seeking spiritual guidance, community
              fellowship, or a deeper understanding of Ethiopian Orthodox
              traditions, we invite you to be part of our family.
            </p>
            <button className="ht-btn ht-btn-gold" onClick={handleVisitClick}>
              Visit Us This Sunday
            </button>
          </div>
        </div>
      </section>
    </>
  );
};

export default AboutUs;