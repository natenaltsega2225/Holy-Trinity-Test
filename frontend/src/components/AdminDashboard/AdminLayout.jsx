// // // src/components/AdminDashboard/AdminLayout.jsx
import React from "react";
import DashboardLayout from "../Shared/DashboardLayout";

export default function AdminLayout() {
  const nav = [
    {
      to: "/dash/admin/members",
      fullPath: "/dash/admin/members",
      label: "Members",
      icon: "👥",
    },
   
   {
  to: "/dash/admin/certificates",
  fullPath: "/dash/admin/certificates",
  label: "Certificates",
  icon: "🏆",
},

    {
      to: "/dash/admin/events",
      fullPath: "/dash/admin/events",
      label: "Events",
      icon: "📅",
    },
    {
      to: "/dash/admin/gallery",
      fullPath: "/dash/admin/gallery",
      label: "Photo Gallery",
      icon: "🖼️",
    },
    {
      to: "/dash/admin/resources",
      fullPath: "/dash/admin/resources",
      label: "Resources",
      icon: "📚",
    },
    {
      to: "/dash/admin/forms",
      fullPath: "/dash/admin/forms",
      label: "Forms",
      icon: "📝",
    },
    {
      to: "/dash/admin/serve-posts",
      fullPath: "/dash/admin/serve-posts",
      label: "Serve Center",
      icon: "📢",
    },
    {
      to: "/dash/admin/themes",
      fullPath: "/dash/admin/themes",
      label: "Themes",
      icon: "🎨",
    },
    {
      to: "/dash/admin/roles",
      fullPath: "/dash/admin/roles",
      label: "Roles",
      icon: "🛡️",
    },
    {
      to: "/dash/admin/audit",
      fullPath: "/dash/admin/audit",
      label: "Audit Logs",
      icon: "🧾",
    },
    {
      to: "/dash/admin/settings",
      fullPath: "/dash/admin/settings",
      label: "System Settings",
      icon: "⚙️",
    },
  ];

  return (
    <DashboardLayout
      variant="admin"
      appName="Holy Trinity EOTC"
      roleTitle="Admin"
      nav={nav}
    />
  );
}