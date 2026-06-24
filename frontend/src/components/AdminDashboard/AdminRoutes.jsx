// src/components/AdminDashboard/AdminRoutes.jsx

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import AdminLayout from "./AdminLayout";
import DashboardProfile from "../../pages/DashboardProfile";

import MemberManagement from "./pages/MemberManagement";
import CertificatesPage from "./pages/CertificatesPage";
import NewsEventsAdmin from "./pages/NewsEventsAdmin";
import ProgramRegistrations from "./pages/ProgramRegistrations";
import GalleryAdmin from "./pages/GalleryAdmin";
import ResourcesAdmin from "./pages/ResourcesAdmin";
import FormsAdmin from "./pages/FormsAdmin";
import ServePostsAdmin from "./pages/ServePostsAdmin";
import DashboardThemesAdmin from "./pages/DashboardThemesAdmin";
import Roles from "./pages/Roles";
import AuditLogs from "./pages/AuditLogs";
import SystemSettings from "./pages/SystemSettings";

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="members" replace />} />

        <Route path="members" element={<MemberManagement />} />
        <Route path="certificates" element={<CertificatesPage />} />

        <Route path="events" element={<NewsEventsAdmin />} />

        <Route
          path="program-registrations"
          element={<ProgramRegistrations />}
        />

        <Route
          path="registrations"
          element={<Navigate to="/dash/admin/program-registrations" replace />}
        />

        <Route
          path="events/registrations"
          element={<Navigate to="/dash/admin/program-registrations" replace />}
        />

        <Route path="gallery" element={<GalleryAdmin />} />
        <Route path="resources" element={<ResourcesAdmin />} />
        <Route path="forms" element={<FormsAdmin />} />

        <Route path="serve-posts" element={<ServePostsAdmin />} />
        <Route path="volunteer-applications" element={<ServePostsAdmin />} />
        <Route path="volunteer-hours" element={<ServePostsAdmin />} />
        <Route path="volunteer-summary" element={<ServePostsAdmin />} />
        <Route path="volunteer-recognition" element={<ServePostsAdmin />} />

        <Route path="themes" element={<DashboardThemesAdmin />} />
        <Route path="roles" element={<Roles />} />
        <Route path="audit" element={<AuditLogs />} />
        <Route path="profile" element={<DashboardProfile />} />
        <Route path="settings" element={<SystemSettings />} />

        <Route path="*" element={<Navigate to="members" replace />} />
      </Route>
    </Routes>
  );
}