

//  // src/components/Header.jsx

// import React, { useState } from "react";
// import { useNavigate, useLocation } from "react-router-dom";
// import { useAuth } from "../hooks/useAuth";
// import churchLogo from "../assets/images/church logo.jpeg";
// import "../styles/header.css";

// export default function Header() {
//   const auth = useAuth();
//   const nav = useNavigate();
//   const location = useLocation();
//   const [mobileOpen, setMobileOpen] = useState(false);

//   const scrollToId = (sectionId) => {
//     const el = document.getElementById(sectionId);
//     if (el) {
//       const headerOffset = 90;
//       const elementPosition = el.getBoundingClientRect().top + window.scrollY;
//       const offsetPosition = elementPosition - headerOffset;

//       window.scrollTo({
//         top: offsetPosition,
//         behavior: "smooth",
//       });
//       return true;
//     }
//     return false;
//   };

//   const goHome = () => {
//     setMobileOpen(false);

//     if (location.pathname === "/") {
//       if (!scrollToId("home")) {
//         window.scrollTo({ top: 0, behavior: "smooth" });
//       }
//     } else {
//       nav("/", { state: { scrollTo: "home" } });
//     }
//   };

//   const goToSection = (sectionId) => {
//     setMobileOpen(false);

//     if (location.pathname === "/") {
//       if (scrollToId(sectionId)) return;
//     }
//     nav("/", { state: { scrollTo: sectionId } });
//   };

//   const goToRoute = (to) => {
//     setMobileOpen(false);
//     nav(to);
//   };

//   const renderNavButtons = () => (
//     <>
//       <button className="ht-nav-link as-btn" onClick={goHome}>
//         HOME
//       </button>
//       <button
//         className="ht-nav-link as-btn"
//         onClick={() => goToSection("about-us")}
//       >
//         About Us
//       </button>
//       <button
//         className="ht-nav-link as-btn"
//         onClick={() => goToSection("ministries")}
//       >
//         Ministries
//       </button>
//       <button
//         className="ht-nav-link as-btn"
//         onClick={() => goToSection("serve-section")}
//       >
//         Serve
//       </button>
//       <button
//         className="ht-nav-link as-btn"
//         onClick={() => goToSection("news-events")}
//       >
//         News &amp; Events
//       </button>
//       <button
//         className="ht-nav-link as-btn"
//         onClick={() => goToSection("forms")}
//       >
//         Forms
//       </button>
//       <button
//         className="ht-nav-link as-btn"
//         onClick={() => goToSection("payments")}
//       >
//         Payments
//       </button>
//       <button
//         className="ht-nav-link as-btn ht-nav-donate-link"
//         onClick={() => goToRoute("/donate")}
//       >
//         Donate
//       </button>
//       <button
//         className="ht-nav-link as-btn"
//         onClick={() => goToSection("media-resources")}
//       >
//         Media &amp; Resources
//       </button>
//     </>
//   );

//   const renderAuthButtons = () => {
//     if (!auth) {
//       return (
//         <button
//           className="ht-auth-btn ht-auth-solid"
//           onClick={() => {
//             setMobileOpen(false);
//             nav("/login", { state: { from: location.pathname } });
//           }}
//         >
//           Login
//         </button>
//       );
//     }

//     const { token, setToken, user } = auth;

//     const logout = () => {
//       setToken("");
//       setMobileOpen(false);
//       nav("/login", { state: { from: location.pathname } });
//     };

//     if (token) {
//       return (
//         <>
//           <span className="ht-user-greet">
//             Hi, {user?.first_name || user?.username || "Member"}
//           </span>
//           <button className="ht-auth-btn ht-auth-solid" onClick={logout}>
//             Logout
//           </button>
//         </>
//       );
//     }

//     return (
//       <button
//         className="ht-auth-btn ht-auth-solid"
//         onClick={() => {
//           setMobileOpen(false);
//           nav("/login", { state: { from: location.pathname } });
//         }}
//       >
//         Login
//       </button>
//     );
//   };

//   return (
//     <header className="ht-header">
//       <div className="ht-header-row">
//         <button className="ht-brand" onClick={goHome} type="button">
//           <img
//             src={churchLogo}
//             alt="Holy Trinity Ethiopian Orthodox Tewahedo Church logo"
//             className="ht-brand-logo"
//           />
//           <div className="ht-brand-text">
//             <strong>Holy Trinity EOTC</strong>
//             <span>Orthodox Tewahedo Church</span>
//           </div>
//         </button>

//         <nav className="ht-nav">{renderNavButtons()}</nav>

//         <div className="ht-auth-group desktop-only">{renderAuthButtons()}</div>

//         <button
//           type="button"
//           className={`ht-burger ${mobileOpen ? "active" : ""}`}
//           onClick={() => setMobileOpen((prev) => !prev)}
//           aria-label="Toggle navigation menu"
//         >
//           <span></span>
//           <span></span>
//           <span></span>
//         </button>
//       </div>

//       <div className={`ht-nav-mobile ${mobileOpen ? "active" : ""}`}>
//         <div className="ht-nav-mobile-brand">
//           <img
//             src={churchLogo}
//             alt="Holy Trinity Ethiopian Orthodox Tewahedo Church logo"
//             className="ht-nav-mobile-logo"
//           />
//           <div>
//             <strong>Holy Trinity EOTC</strong>
//             <span>Orthodox Tewahedo Church</span>
//           </div>
//         </div>

//         {renderNavButtons()}

//         <div className="ht-auth-group ht-auth-group-mobile">
//           {renderAuthButtons()}
//         </div>
//       </div>
//     </header>
//   );
// }

import React, { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePublicSettings } from "../context/PublicSettingsContext";
import churchLogo from "../assets/images/church logo.jpeg";
import "../styles/header.css";

function resolveLogoSrc(configuredLogoUrl) {
  const raw = String(configuredLogoUrl || "").trim();

  if (!raw) return churchLogo;

  if (
    raw.includes("church logo.jpeg") ||
    raw.startsWith("/src/assets/") ||
    raw.startsWith("src/assets/")
  ) {
    return churchLogo;
  }

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("/uploads/") ||
    raw.startsWith("/")
  ) {
    return raw;
  }

  return churchLogo;
}

export default function Header() {
  const auth = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { settings: publicSettings } = usePublicSettings();

  const brandName =
    publicSettings?.general?.churchName || "Holy Trinity EOTC";

  const brandLogo = useMemo(
    () => resolveLogoSrc(publicSettings?.branding?.logoUrl),
    [publicSettings]
  );

  const scrollToId = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      const headerOffset = 90;
      const elementPosition = el.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      return true;
    }
    return false;
  };

  const goHome = () => {
    setMobileOpen(false);

    if (location.pathname === "/") {
      if (!scrollToId("home")) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else {
      nav("/", { state: { scrollTo: "home" } });
    }
  };

  const goToSection = (sectionId) => {
    setMobileOpen(false);

    if (location.pathname === "/") {
      if (scrollToId(sectionId)) return;
    }
    nav("/", { state: { scrollTo: sectionId } });
  };

  const goToRoute = (to) => {
    setMobileOpen(false);
    nav(to);
  };

  const renderNavButtons = () => (
    <>
      <button className="ht-nav-link as-btn" onClick={goHome}>
        HOME
      </button>
      <button className="ht-nav-link as-btn" onClick={() => goToSection("about-us")}>
        About Us
      </button>
      <button className="ht-nav-link as-btn" onClick={() => goToSection("ministries")}>
        Ministries
      </button>
      <button className="ht-nav-link as-btn" onClick={() => goToSection("serve-section")}>
        Serve
      </button>
      <button className="ht-nav-link as-btn" onClick={() => goToSection("news-events")}>
        News &amp; Events
      </button>
      <button className="ht-nav-link as-btn" onClick={() => goToSection("forms")}>
        Forms
      </button>
      <button className="ht-nav-link as-btn" onClick={() => goToSection("payments")}>
        Payments
      </button>
      <button className="ht-nav-link as-btn ht-nav-donate-link" onClick={() => goToRoute("/donate")}>
        Donate
      </button>
      <button className="ht-nav-link as-btn" onClick={() => goToSection("media-resources")}>
        Media &amp; Resources
      </button>
    </>
  );

  const renderAuthButtons = () => {
    if (!auth) {
      return (
        <button
          className="ht-auth-btn ht-auth-solid"
          onClick={() => {
            setMobileOpen(false);
            nav("/login", { state: { from: location.pathname } });
          }}
        >
          Login
        </button>
      );
    }

    const { token, setToken, user } = auth;

    const logout = () => {
      setToken("");
      setMobileOpen(false);
      nav("/login", { state: { from: location.pathname } });
    };

    if (token) {
      return (
        <>
          <span className="ht-user-greet">
            Hi, {user?.first_name || user?.username || "Member"}
          </span>
          <button className="ht-auth-btn ht-auth-solid" onClick={logout}>
            Logout
          </button>
        </>
      );
    }

    return (
      <button
        className="ht-auth-btn ht-auth-solid"
        onClick={() => {
          setMobileOpen(false);
          nav("/login", { state: { from: location.pathname } });
        }}
      >
        Login
      </button>
    );
  };

  return (
    <header className="ht-header">
      <div className="ht-header-row">
        <button className="ht-brand" onClick={goHome} type="button">
          <img
            src={brandLogo}
            alt={`${brandName} logo`}
            className="ht-brand-logo"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = churchLogo;
            }}
          />
          <div className="ht-brand-text">
            <strong>{brandName}</strong>
            <span>Orthodox Tewahedo Church</span>
          </div>
        </button>

        <nav className="ht-nav">{renderNavButtons()}</nav>

        <div className="ht-auth-group desktop-only">{renderAuthButtons()}</div>

        <button
          type="button"
          className={`ht-burger ${mobileOpen ? "active" : ""}`}
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      <div className={`ht-nav-mobile ${mobileOpen ? "active" : ""}`}>
        <div className="ht-nav-mobile-brand">
          <img
            src={brandLogo}
            alt={`${brandName} logo`}
            className="ht-nav-mobile-logo"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = churchLogo;
            }}
          />
          <div>
            <strong>{brandName}</strong>
            <span>Orthodox Tewahedo Church</span>
          </div>
        </div>

        {renderNavButtons()}

        <div className="ht-auth-group ht-auth-group-mobile">
          {renderAuthButtons()}
        </div>
      </div>
    </header>
  );
}