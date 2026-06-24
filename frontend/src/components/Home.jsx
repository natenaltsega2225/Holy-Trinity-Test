
//  // src/components/Home.jsx
// import React, { useEffect } from "react";
// import { useLocation, Link } from "react-router-dom";
// import { usePublicSettings } from "../context/PublicSettingsContext";

// import AboutUs from "./AboutUs";
// import Ministries from "./Ministries";
// import Serve from "./Serve";
// import Forms from "./Forms";
// import NewsEvents from "./NewsEvents";
// import GoogleMap from "./GoogleMap";
// import Payments from "./Payments";
// import Media_Resources from "./Media_Resources";
// import "../styles/Home.css";

// const DonateStrip = () => (
//   <section id="donate-section" className="ht-donate-strip" />
// );

// const Home = () => {
//   const location = useLocation();
//   const { settings: publicSettings } = usePublicSettings();

//   const churchName =
//     publicSettings?.general?.churchName || "Holy Trinity Ethiopian";

//   const heroMessage =
//     publicSettings?.branding?.publicBannerText ||
//     "A sacred community rooted in ancient traditions, united in faith, and committed to spiritual growth and service.";

//   useEffect(() => {
//     const targetId = location.state?.scrollTo;
//     if (!targetId) return;

//     const el = document.getElementById(targetId);
//     if (!el) return;

//     const headerOffset = 90;
//     const elementPosition = el.getBoundingClientRect().top + window.scrollY;
//     const offsetPosition = elementPosition - headerOffset;

//     window.scrollTo({
//       top: offsetPosition,
//       behavior: "smooth",
//     });
//   }, [location]);

//   return (
//     <>
//       <section id="home" className="ht-hero">
//         <div className="ht-hero-overlay" />
//         <div className="ht-container ht-hero-inner">
//           <h1 className="ht-hero-title">{churchName}</h1>
//           <h2 className="ht-hero-subtitle">Orthodox Tewahedo Church</h2>
//           <p className="ht-hero-text">{heroMessage}</p>

//           <div className="ht-hero-actions">
//             <Link
//               to="/news-events/holiday"
//               state={{ scrollTo: "holiday-calendar-section" }}
//               className="ht-btn ht-btn-gold"
//             >
//               Join Us for Worship
//             </Link>

//             <Link className="ht-btn ht-btn-ghost" to="/about-us/details">
//               Learn More
//             </Link>

//             <Link className="ht-btn ht-btn-dark" to="/donate">
//               Donate
//             </Link>
//           </div>
//         </div>
//         <div className="ht-hero-fade" />
//       </section>

//       <DonateStrip />

//       <AboutUs />
//       <Ministries />
//       <Serve />
//       <NewsEvents />
//       <Forms />
//       <Payments />
//       <Media_Resources />
//       <GoogleMap />
//     </>
//   );
// };

// export default Home;

import React, { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { usePublicSettings } from "../context/PublicSettingsContext";

import AboutUs from "./AboutUs";
import Ministries from "./Ministries";
import Serve from "./Serve";
import Forms from "./Forms";
import NewsEvents from "./NewsEvents";
import GoogleMap from "./GoogleMap";
import Payments from "./Payments";
import Media_Resources from "./Media_Resources";
import "../styles/Home.css";

const DonateStrip = () => (
  <section id="donate-section" className="ht-donate-strip" />
);

function scrollToSectionWithRetry(sectionId, attempt = 0) {
  const el = document.getElementById(sectionId);

  if (el) {
    const headerOffset = 90;
    const top =
      el.getBoundingClientRect().top +
      window.scrollY -
      headerOffset;

    window.scrollTo({
      top,
      behavior: "smooth",
    });

    return;
  }

  if (attempt < 20) {
    window.setTimeout(() => {
      scrollToSectionWithRetry(sectionId, attempt + 1);
    }, 75);
  }
}

const Home = () => {
  const location = useLocation();
  const { settings: publicSettings } = usePublicSettings();

  const churchName =
    publicSettings?.general?.churchName || "Holy Trinity Ethiopian";

  const heroMessage =
    publicSettings?.branding?.publicBannerText ||
    "A sacred community rooted in ancient traditions, united in faith, and committed to spiritual growth and service.";

  useEffect(() => {
    const targetId = location.state?.scrollTo;

    if (!targetId) return;

    scrollToSectionWithRetry(targetId);
  }, [location.key, location.state]);

  return (
    <>
      <section id="home" className="ht-hero">
        <div className="ht-hero-overlay" />

        <div className="ht-container ht-hero-inner">
          <h1 className="ht-hero-title">{churchName}</h1>
          <h2 className="ht-hero-subtitle">Orthodox Tewahedo Church</h2>
          <p className="ht-hero-text">{heroMessage}</p>

          <div className="ht-hero-actions">
            <Link
              to="/news-events/holiday"
              state={{ scrollTo: "holiday-calendar-section" }}
              className="ht-btn ht-btn-gold"
            >
              Join Us for Worship
            </Link>

            <Link className="ht-btn ht-btn-ghost" to="/about-us/details">
              Learn More
            </Link>

            <Link className="ht-btn ht-btn-dark" to="/donate">
              Donate
            </Link>
          </div>
        </div>

        <div className="ht-hero-fade" />
      </section>

      <DonateStrip />

      <AboutUs />
      <Ministries />
      <Serve />
      <NewsEvents />
      <Forms />
      <Payments />
      <Media_Resources />
      <GoogleMap />
    </>
  );
};

export default Home;