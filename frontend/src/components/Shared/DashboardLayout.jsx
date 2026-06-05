
// // src/components/Shared/DashboardLayout.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../api";
import churchLogo from "../../assets/images/church logo.jpeg";
import "../../styles/dashboard.css";

function findActiveItem(nav, pathname) {
  for (const item of nav) {
    if (
      item.fullPath &&
      (pathname === item.fullPath || pathname.startsWith(item.fullPath + "/"))
    ) {
      return item;
    }

    if (Array.isArray(item.children)) {
      for (const child of item.children) {
        if (
          child.fullPath &&
          (pathname === child.fullPath ||
            pathname.startsWith(child.fullPath + "/"))
        ) {
          return child;
        }
      }
    }
  }

  return null;
}

function getPageTitle(nav, pathname, fallback) {
  const match = findActiveItem(nav, pathname);
  return match?.label || fallback;
}

function applyThemeVariables(theme = {}) {
  const root = document.documentElement;

  root.style.setProperty("--dash-page-bg", theme.page_bg || "#edf3fb");
  root.style.setProperty("--dash-surface", theme.surface_bg || "#ffffff");
  root.style.setProperty("--dash-border", theme.border_color || "#d7e3f3");
  root.style.setProperty("--dash-text", theme.text_color || "#15263f");
  root.style.setProperty("--dash-muted", theme.muted_text_color || "#687995");
  root.style.setProperty(
    "--dash-desktop-text",
    theme.desktop_text_color || "#0f172a"
  );
  root.style.setProperty("--dash-sidebar-bg", theme.sidebar_bg || "#0f1d34");
  root.style.setProperty(
    "--dash-sidebar-text",
    theme.sidebar_text_color || "#eef4ff"
  );
  root.style.setProperty("--dash-header-bg", theme.header_bg || "#0f1e36");
  root.style.setProperty(
    "--dash-header-text",
    theme.header_text_color || "#ffffff"
  );
  root.style.setProperty("--dash-active-nav-bg", theme.active_nav_bg || "#3a6de8");
  root.style.setProperty(
    "--dash-active-nav-text",
    theme.active_nav_text_color || "#ffffff"
  );
  root.style.setProperty("--dash-button-bg", theme.button_bg || "#315bcb");
  root.style.setProperty("--dash-button-text", theme.button_text || "#ffffff");
  root.style.setProperty("--dash-highlight-bg", theme.highlight_bg || "#eef4ff");
  root.style.setProperty(
    "--dash-highlight-text",
    theme.highlight_text || "#315bcb"
  );
  root.style.setProperty("--dash-shadow-color", theme.shadow_color || "#0f172a");
}

function normalizeDashboardRole(value) {
  const v = String(value || "").trim().toLowerCase();

  if (
    ["admin", "finance", "member", "reconciliation", "super_admin"].includes(v)
  ) {
    return v;
  }

  return "admin";
}

function getRoleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "finance") return "Finance";
  if (role === "member") return "Member";
  if (role === "reconciliation") return "Reconciliation";
  if (role === "super_admin") return "Super Admin";
  return "Dashboard";
}

function getDashboardProfilePath(role) {
  const r = String(role || "").toLowerCase();

  if (r === "member") return "/dash/membership/my-profile";
  if (r === "finance") return "/dash/finance/profile";
  if (r === "reconciliation") return "/dash/reconciliation/profile";
  if (r === "admin") return "/dash/admin/profile";
  if (r === "super_admin") return "/dash/admin/profile";

  return "/dash/membership/my-profile";
}

function itemMatchesQuery(item, q) {
  if (!q) return true;

  const labelMatch = String(item.label || "").toLowerCase().includes(q);
  const childMatch = Array.isArray(item.children)
    ? item.children.some((child) =>
        String(child.label || "").toLowerCase().includes(q)
      )
    : false;

  return labelMatch || childMatch;
}

function childMatchesQuery(child, q) {
  if (!q) return true;
  return String(child.label || "").toLowerCase().includes(q);
}

function resolveAssetUrl(value) {
  const src = String(value || "").trim();
  if (!src) return "";

  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("data:")) return src;
  if (src.startsWith("blob:")) return src;

  const base = String(api?.defaults?.baseURL || "").trim();
  if (base && src.startsWith("/")) {
    try {
      const url = new URL(base, window.location.origin);
      return `${url.origin}${src}`;
    } catch {
      return src;
    }
  }

  return src;
}

function buildInitials(displayName) {
  return String(displayName || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() || "")
    .join("");
}

export default function DashboardLayout({
  variant = "admin",
  appName = "Holy Trinity EOTC",
  roleTitle = "Dashboard",
  nav = [],
}) {
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const profileRef = useRef(null);

  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const effectiveVariant =
    variant === "auto" ? auth?.user?.role || "admin" : variant;

  const activeDashboardRole = useMemo(() => {
    return normalizeDashboardRole(effectiveVariant || auth?.user?.role || "admin");
  }, [effectiveVariant, auth?.user?.role]);

  const filteredNav = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    return nav.filter((item) => itemMatchesQuery(item, q));
  }, [menuQuery, nav]);

  const pageTitle = getPageTitle(nav, location.pathname, roleTitle);

  const displayName =
    auth?.user?.full_name ||
    `${auth?.user?.first_name || ""} ${auth?.user?.last_name || ""}`.trim() ||
    auth?.user?.username ||
    auth?.user?.email ||
    roleTitle;

  const roleLabel = getRoleLabel(activeDashboardRole);
  const initials = buildInitials(displayName);
  const profilePath = getDashboardProfilePath(auth?.user?.role);
  const avatarSrc = resolveAssetUrl(auth?.user?.profile_photo_url);
  const showPhoto = !!avatarSrc && !avatarError;

  async function logout() {
    try {
      await auth?.logout?.();
    } catch {}
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    let alive = true;

    async function loadActiveTheme() {
      try {
        const themeRole =
          activeDashboardRole === "super_admin" ? "admin" : activeDashboardRole;

        const { data } = await api.get("/admin/dashboard-themes/active", {
          params: { role: themeRole },
        });

        if (!alive) return;
        applyThemeVariables(data?.row || {});
      } catch (err) {
        console.error("Failed to load active dashboard theme:", err);
        if (!alive) return;
        applyThemeVariables({});
      }
    }

    loadActiveTheme();

    function handleThemeUpdated() {
      loadActiveTheme();
    }

    window.addEventListener("dashboard-theme-updated", handleThemeUpdated);

    return () => {
      alive = false;
      window.removeEventListener("dashboard-theme-updated", handleThemeUpdated);
    };
  }, [activeDashboardRole]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setAvatarError(false);
  }, [avatarSrc]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    const body = document.body;

    if (mobileOpen) {
      body.classList.add("dash-body-lock");
    } else {
      body.classList.remove("dash-body-lock");
    }

    return () => {
      body.classList.remove("dash-body-lock");
    };
  }, [mobileOpen]);

  const q = menuQuery.trim().toLowerCase();

  return (
    <div
      className={`dashboard-main-root dash-shell dash-shell--${activeDashboardRole} ${
        sidebarHidden ? "sidebar-hidden" : ""
      }`}
    >
      {mobileOpen ? (
        <button
          type="button"
          className="dash-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      ) : null}

      <aside
        className={`dash-sidebar ${mobileOpen ? "mobile-open" : ""}`}
        aria-label="Dashboard sidebar"
      >
        <div className="dash-brand">
          <img
            src={churchLogo}
            alt="Holy Trinity Ethiopian Orthodox Tewahedo Church logo"
            className="dash-brand-logo"
          />

          <div className="dash-brand-text">
            <h2>{roleLabel}</h2>
            <p>{appName}</p>
          </div>
        </div>

        <div className="dash-search-wrap">
          <input
            type="text"
            placeholder="Search menu..."
            value={menuQuery}
            onChange={(e) => setMenuQuery(e.target.value)}
          />
        </div>

        <div className="dash-menu-wrap">
          <nav className="dash-nav">
            {filteredNav.map((item) => {
              const hasChildren =
                Array.isArray(item.children) && item.children.length > 0;

              const parentActive =
                !!item.fullPath &&
                (location.pathname === item.fullPath ||
                  location.pathname.startsWith(item.fullPath + "/"));

              const childActive = hasChildren
                ? item.children.some(
                    (child) =>
                      child.fullPath &&
                      (location.pathname === child.fullPath ||
                        location.pathname.startsWith(child.fullPath + "/"))
                  )
                : false;

              const showChildren =
                hasChildren && (childActive || parentActive || !!q);

              return (
                <div
                  key={item.fullPath || item.to || item.label}
                  className={`dash-nav-group ${showChildren ? "open" : ""}`}
                >
                  <NavLink
                    to={item.to || item.fullPath}
                    end={item.end}
                    className={({ isActive }) =>
                      `dash-nav-link ${isActive || childActive ? "active" : ""}`
                    }
                  >
                    <span className="dash-nav-icon">{item.icon || "•"}</span>
                    <span className="dash-nav-text">{item.label}</span>
                  </NavLink>

                  {hasChildren && showChildren ? (
                    <div className="dash-subnav">
                      {item.children
                        .filter((child) => childMatchesQuery(child, q))
                        .map((child) => (
                          <NavLink
                            key={child.fullPath || child.to || child.label}
                            to={child.to || child.fullPath}
                            end={child.end}
                            className={({ isActive }) =>
                              `dash-subnav-link ${isActive ? "active" : ""}`
                            }
                          >
                            <span className="dash-subnav-icon">
                              {child.icon || "•"}
                            </span>
                            <span className="dash-subnav-text">
                              {child.label}
                            </span>
                          </NavLink>
                        ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="dash-main-area">
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            <button
              type="button"
              className="dash-toggle desktop-toggle"
              onClick={() => setSidebarHidden((prev) => !prev)}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>

            <button
              type="button"
              className="dash-toggle mobile-toggle"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>

            <div className="dash-page-heading">
              <h1>{pageTitle}</h1>
            </div>
          </div>

          <div className="dash-topbar-right">
            <div className="dash-profile-menu" ref={profileRef}>
              <button
                type="button"
                className={`dash-user-trigger ${profileOpen ? "is-open" : ""}`}
                onClick={() => setProfileOpen((prev) => !prev)}
                aria-expanded={profileOpen}
                aria-label="Open profile menu"
              >
                {showPhoto ? (
                  <img
                    src={avatarSrc}
                    alt="Profile"
                    className="dash-user-avatar"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <span className="dash-user-avatar">{initials || "U"}</span>
                )}

                <span className="dash-user-meta">
                  <strong title={displayName}>{displayName}</strong>
                  <small>
                    {getRoleLabel(normalizeDashboardRole(auth?.user?.role))}
                  </small>
                </span>
              </button>

              {profileOpen ? (
                <div className="dash-profile-dropdown">
                  <div className="dash-profile-card">
                    {showPhoto ? (
                      <img
                        src={avatarSrc}
                        alt="Profile"
                        className="dash-avatar dash-avatar--large"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <div className="dash-avatar dash-avatar--large">
                        {initials || "U"}
                      </div>
                    )}

                    <div className="dash-profile-meta">
                      <strong title={displayName}>{displayName}</strong>
                      <span>
                        {getRoleLabel(normalizeDashboardRole(auth?.user?.role))}
                      </span>
                      {auth?.user?.email ? (
                        <span title={auth.user.email}>{auth.user.email}</span>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="dash-dropdown-action"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate(profilePath);
                    }}
                  >
                    View Profile
                  </button>

                  <button
                    type="button"
                    className="dash-dropdown-action dash-profile-action--danger"
                    onClick={logout}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="dash-page-content">
          <div className="dash-content-inner">
            <Outlet />
          </div>
        </section>
      </main>
    </div>
  );
}