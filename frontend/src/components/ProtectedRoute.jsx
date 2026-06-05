// //frontend\src\components\ProtectedRoute.jsx
// import React from "react";
// import { Navigate, Outlet, useLocation } from "react-router-dom";
// import { useAuth, landingForRole } from "../hooks/useAuth";

// export default function ProtectedRoute({ roles = [] }) {
//   const location = useLocation();
//   const { user, token, isAuthed, booting } = useAuth();

//   // ONLY block if nothing exists at all
//   if (booting && !token && !user) {
//     return <div className="dash-loading">Loading...</div>;
//   }

//   if (!isAuthed || !user) {
//     return (
//       <Navigate
//         to="/login"
//         replace
//         state={{ from: location.pathname }}
//       />
//     );
//   }

//   const currentRole = String(user.role || "").toLowerCase();
//   const allowedRoles = roles.map((r) => String(r || "").toLowerCase());

//   if (allowedRoles.length && !allowedRoles.includes(currentRole)) {
//     return <Navigate to={landingForRole(currentRole)} replace />;
//   }

//   return <Outlet />;
// }

// frontend/src/components/ProtectedRoute.jsx

import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, landingForRole } from "../hooks/useAuth";

export default function ProtectedRoute({ roles = [] }) {
  const location = useLocation();

  const {
    user,
    token,
    booting,
    hasRole,
  } = useAuth();

  // Wait for auth refresh
  if (booting) {
    return (
      <div
        className="dash-loading"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontSize: "18px",
          fontWeight: 600,
        }}
      >
        Loading...
      </div>
    );
  }

  // Not authenticated
  if (!token || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  // Role protection
  if (roles.length && !hasRole(...roles)) {
    return (
      <Navigate
        to={landingForRole(user.role)}
        replace
      />
    );
  }

  return <Outlet />;
}