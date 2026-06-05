// src/components/AdminDashboard/AdminRoutes.jsx

import React from "react";
import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import AdminLayout from "./AdminLayout";

import DashboardProfile from "../../pages/DashboardProfile";

import MemberManagement from "./pages/MemberManagement";

import Roles from "./pages/Roles";
import AuditLogs from "./pages/AuditLogs";
import SystemSettings from "./pages/SystemSettings";

import NewsEventsAdmin from "./pages/NewsEventsAdmin";
import GalleryAdmin from "./pages/GalleryAdmin";
import ResourcesAdmin from "./pages/ResourcesAdmin";
import FormsAdmin from "./pages/FormsAdmin";

import DashboardThemesAdmin from "./pages/DashboardThemesAdmin";

import ServePostsAdmin from "./pages/ServePostsAdmin";

import CertificatesPage from "./pages/CertificatesPage";

export default function AdminRoutes() {

  return (

    <Routes>

      <Route element={<AdminLayout />}>

        {/* =====================================================
            DEFAULT
        ===================================================== */}

        <Route
          index
          element={
            <Navigate
              to="members"
              replace
            />
          }
        />

        {/* =====================================================
            MEMBERS
        ===================================================== */}

        <Route
          path="members"
          element={<MemberManagement />}
        />

        {/* =====================================================
            CERTIFICATES
        ===================================================== */}

        <Route
          path="certificates"
          element={<CertificatesPage />}
        />

        {/* =====================================================
            EVENTS
        ===================================================== */}

        <Route
          path="events"
          element={<NewsEventsAdmin />}
        />

        {/* =====================================================
            GALLERY
        ===================================================== */}

        <Route
          path="gallery"
          element={<GalleryAdmin />}
        />

        {/* =====================================================
            RESOURCES
        ===================================================== */}

        <Route
          path="resources"
          element={<ResourcesAdmin />}
        />

        {/* =====================================================
            FORMS
        ===================================================== */}

        <Route
          path="forms"
          element={<FormsAdmin />}
        />

        {/* =====================================================
            SERVE CENTER
        ===================================================== */}

        <Route
          path="serve-posts"
          element={<ServePostsAdmin />}
        />

        <Route
          path="volunteer-applications"
          element={<ServePostsAdmin />}
        />

        <Route
          path="volunteer-hours"
          element={<ServePostsAdmin />}
        />

        <Route
          path="volunteer-summary"
          element={<ServePostsAdmin />}
        />

        <Route
          path="volunteer-recognition"
          element={<ServePostsAdmin />}
        />

        {/* =====================================================
            THEMES
        ===================================================== */}

        <Route
          path="themes"
          element={<DashboardThemesAdmin />}
        />

        {/* =====================================================
            ROLES
        ===================================================== */}

        <Route
          path="roles"
          element={<Roles />}
        />

        {/* =====================================================
            AUDIT
        ===================================================== */}

        <Route
          path="audit"
          element={<AuditLogs />}
        />

        {/* =====================================================
            PROFILE
        ===================================================== */}

        <Route
          path="profile"
          element={<DashboardProfile />}
        />

        {/* =====================================================
            SETTINGS
        ===================================================== */}

        <Route
          path="settings"
          element={<SystemSettings />}
        />

        {/* =====================================================
            FALLBACK
        ===================================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="members"
              replace
            />
          }
        />

      </Route>

    </Routes>
  );
}