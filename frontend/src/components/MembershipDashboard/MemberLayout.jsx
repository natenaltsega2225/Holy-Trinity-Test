
// // src/components/MembershipDashoard/MemberLayout.jsx

// import React from "react";

// import DashboardLayout from "../Shared/DashboardLayout";

// import "../../styles/member-dashboard.css";

// export default function MemberLayout() {
//   const nav = [
   
//     {
//       to: "/dash/membership/my-payments/make-payment",
//       fullPath: "/dash/membership/my-payments",
//       label: "My Payments",
//       icon: "💳",
//     },

//     {
//       to: "/dash/membership/giving-statements",
//       fullPath: "/dash/membership/giving-statements",
//       label: "Giving Statements",
//       icon: "📄",
//     },

//     {
//       to: "/dash/membership/family",
//       fullPath: "/dash/membership/family",
//       label: "Family / Dependents",
//       icon: "👨‍👩‍👧",
//     },

//     {
//       to: "/dash/membership/documents",
//       fullPath: "/dash/membership/documents",
//       label: "Documents",
//       icon: "🗂️",
//     },

//     {
//       to: "/dash/membership/myrequests",
//       fullPath: "/dash/membership/myrequests",
//       label: "My Requests",
//       icon: "📝",
//     },

//     {
//       to: "/dash/membership/my-profile",
//       fullPath: "/dash/membership/my-profile",
//       label: "My Profile",
//       icon: "👤",
//     },
//   ];

//   return (
//     <DashboardLayout
//       variant="member"
//       appName="Holy Trinity EOTC"
//       roleTitle="Member"
//       nav={nav}
//     />
//   );
// }

// src/components/MembershipDashboard/MemberLayout.jsx

import React from "react";

import DashboardLayout
  from "../Shared/DashboardLayout";

import "../../styles/member-dashboard.css";

export default function MemberLayout() {

  const nav = [

    /* =========================================
       OVERVIEW
    ========================================= */

    {
      to:
        "/dash/membership/overview",

      fullPath:
        "/dash/membership/overview",

      label:
        "Overview",

      icon:
        "🏠",
    },

    /* =========================================
       PAYMENTS
    ========================================= */

    {
      to:
        "/dash/membership/my-payments/make-payment",

      fullPath:
        "/dash/membership/my-payments",

      label:
        "My Payments",

      icon:
        "💳",
    },

    /* =========================================
       MEMBERSHIP COVERAGE
    ========================================= */

    {
      to:
        "/dash/membership/membership-coverage",

      fullPath:
        "/dash/membership/membership-coverage",

      label:
        "Membership Coverage",

      icon:
        "🛡️",
    },

    /* =========================================
       GIVING STATEMENTS
    ========================================= */

    {
      to:
        "/dash/membership/giving-statements",

      fullPath:
        "/dash/membership/giving-statements",

      label:
        "Giving Statements",

      icon:
        "📄",
    },

    /* =========================================
       FAMILY
    ========================================= */

    {
      to:
        "/dash/membership/family",

      fullPath:
        "/dash/membership/family",

      label:
        "Family / Dependents",

      icon:
        "👨‍👩‍👧",
    },

    /* =========================================
       DOCUMENTS
    ========================================= */

    {
      to:
        "/dash/membership/documents",

      fullPath:
        "/dash/membership/documents",

      label:
        "Documents",

      icon:
        "🗂️",
    },

    /* =========================================
       REQUESTS
    ========================================= */

    {
      to:
        "/dash/membership/myrequests",

      fullPath:
        "/dash/membership/myrequests",

      label:
        "My Requests",

      icon:
        "📝",
    },

    /* =========================================
       PROFILE
    ========================================= */

    {
      to:
        "/dash/membership/my-profile",

      fullPath:
        "/dash/membership/my-profile",

      label:
        "My Profile",

      icon:
        "👤",
    },
  ];

  return (

    <DashboardLayout
      variant="member"
      appName="Holy Trinity EOTC"
      roleTitle="Member"
      nav={nav}
    />

  );
}