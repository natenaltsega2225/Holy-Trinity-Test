

// src/App.jsx

import React from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Header from "./components/Header";
import Footer from "./components/Footer";

import Home from "./components/Home";
import AboutUs from "./components/AboutUs";
import Ministries from "./components/Ministries";
import NewsEvents from "./components/NewsEvents";
import Login from "./components/Login";
import Register from "./components/Register";
import ResetPassword from "./components/ResetPassword";
import ForgotPassword from "./components/ForgotPassword";
import ResetTempPassword from "./components/ResetTempPassword";
import MfaVerify from "./components/MfaVerify";
import Forms from "./components/Forms";
import Payments from "./components/Payments";
import CheckoutPage from "./components/Checkout";
import FormsPage from "./pages/FormsPage";
import Donate from "./pages/Donate";
import Membership from "./pages/Membership";

import KidsProgramsPage from "./pages/news-events/KidsProgramsPage";
import HolidayActivitiesPage from "./pages/news-events/HolidayActivitiesPage";
import TripsOutingsPage from "./pages/news-events/TripsOutingsPage";
import EventDetailPage from "./pages/EventDetailPage";

import ProtectedRoute from "./components/ProtectedRoute";

/* DASHBOARDS */
import MemberRoutes from "./components/MembershipDashboard/MemberRoutes";
import AdminRoutes from "./components/AdminDashboard/AdminRoutes";
import FinanceRoutes from "./components/FinanceDashboard/FinanceRoutes";
import ReconciliationRoutes from "./components/ReconciliationDashboard/ReconciliationRoutes";

function AppContent() {
  const location = useLocation();

  const isDashboardRoute =
    location.pathname.startsWith("/dash/");

  return (
    <div className="app-container">
      {!isDashboardRoute && <Header />}

      <main className="main-content">
        <Routes>

          {/* PUBLIC */}
          <Route path="/" element={<Home />} />

          <Route path="/about-us" element={<AboutUs />} />

          <Route path="/ministries" element={<Ministries />} />

          <Route path="/forms" element={<Forms />} />

          {/* NEWS */}
          <Route path="/news-events" element={<NewsEvents />} />

          <Route
            path="/news-events/kids"
            element={<KidsProgramsPage />}
          />

          <Route
            path="/news-events/holiday"
            element={<HolidayActivitiesPage />}
          />

          <Route
            path="/news-events/trip"
            element={<TripsOutingsPage />}
          />

          <Route
            path="/news-events/:id"
            element={<EventDetailPage />}
          />

          {/* PAYMENTS */}
          <Route path="/membership" element={<Membership />} />
<Route
  path="/forms-page"
  element={<FormsPage />}
/>
          <Route path="/payments" element={<Payments />} />

          <Route path="/checkout" element={<CheckoutPage />} />

          <Route path="/donate" element={<Donate />} />

                  {/* AUTH */}
          <Route
            path="/login"
            element={<Login />}
          />
<Route
  path="/mfa-verify"
  element={<MfaVerify />}
/>
          <Route
            path="/register"
            element={<Register />}
          />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          <Route
            path="/reset-password"
            element={<ResetPassword />}
          />

        <Route
  path="/reset-temp-password"
  element={<ResetTempPassword />}
/>
          {/* =========================
             PROTECTED ROUTES
          ========================= */}

          {/* MEMBER */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/dash/membership/*"
              element={<MemberRoutes />}
            />
          </Route>

          {/* ADMIN */}
          <Route
            element={
              <ProtectedRoute
                roles={["admin", "super_admin"]}
              />
            }
          >
            <Route
              path="/dash/admin/*"
              element={<AdminRoutes />}
            />
          </Route>

          {/* FINANCE */}
          <Route
            element={
              <ProtectedRoute
                roles={[
                  "finance",
                  "admin",
                  "super_admin",
                ]}
              />
            }
          >
            <Route
              path="/dash/finance/*"
              element={<FinanceRoutes />}
            />
          </Route>

          {/* RECONCILIATION */}
          <Route
            element={
              <ProtectedRoute
                roles={[
                  "reconciliation",
                  "admin",
                  "super_admin",
                ]}
              />
            }
          >
            <Route
              path="/dash/reconciliation/*"
              element={<ReconciliationRoutes />}
            />
          </Route>

          {/* FALLBACK */}
         <Route path="*" element={<Navigate to="/login" replace />}/>

        </Routes>
      </main>

      {!isDashboardRoute && <Footer />}
    </div>
  );
}

export default function App() {
  return <AppContent />;
}