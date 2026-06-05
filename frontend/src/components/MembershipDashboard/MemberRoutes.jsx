
// // src/components/MembershipDashoard/MemberRoutes.jsx

// import React from "react";
// import {
//   Routes,
//   Route,
//   Navigate,
// } from "react-router-dom";

// import MemberLayout from "./MemberLayout";


// import DashboardProfile from "../../pages/DashboardProfile";

// import MyPayments from "./pages/MyPayments";

// import GivingStatements from "./pages/GivingStatements";
// import FamilyDependents from "./pages/FamilyDependents";
// import Documents from "./pages/Documents";
// import MyRequests from "./pages/MyRequests";

// import ReceiptViewPage from "../../pages/ReceiptViewPage";
// import InvoiceViewPage from "../../pages/InvoiceViewPage";

// /* =========================================================
//    ENTERPRISE MEMBER ROUTES
// ========================================================= */

// export default function MemberRoutes() {

//   return (

//     <Routes>

//       <Route element={<MemberLayout />}>

//         {/* =================================================
//             DEFAULT
//         ================================================= */}

//         <Route
//           index
//           element={
//             <Navigate
//               to="/dash/membership/my-payments/make-payment"
//               replace
//             />
//           }
//         />

//         {/* =================================================
//             PROFILE
//         ================================================= */}

//         <Route
//           path="my-profile"
//           element={<DashboardProfile />}
//         />

//         {/* =================================================
//             PAYMENT CENTER
//         ================================================= */}

//         <Route
//           path="my-payments"
//           element={
//             <Navigate
//               to="/dash/membership/my-payments/make-payment"
//               replace
//             />
//           }
//         />

//         {/* =================================================
//             ENTERPRISE CHILD TABS
//         ================================================= */}

//         <Route
//           path="my-payments/:tab"
//           element={<MyPayments />}
//         />

//         {/* =================================================
//             LEGACY ROUTE REDIRECTS
//             Keeps old bookmarks working
//         ================================================= */}

//         <Route
//           path="ledger"
//           element={
//             <Navigate
//               to="/dash/membership/my-payments/ledger"
//               replace
//             />
//           }
//         />

//         <Route
//           path="invoices"
//           element={
//             <Navigate
//               to="/dash/membership/my-payments/invoices"
//               replace
//             />
//           }
//         />

//         <Route
//           path="renewal"
//           element={
//             <Navigate
//               to="/dash/membership/my-payments/renewal"
//               replace
//             />
//           }
//         />

//         <Route
//           path="payment-history"
//           element={
//             <Navigate
//               to="/dash/membership/my-payments/history"
//               replace
//             />
//           }
//         />

//         {/* =================================================
//             RECEIPTS
//         ================================================= */}

//         <Route
//           path="receipts/:receiptNumber"
//           element={<ReceiptViewPage />}
//         />

//         {/* =================================================
//             INVOICES
//         ================================================= */}

//         <Route
//           path="invoice/:invoiceNumber"
//           element={<InvoiceViewPage />}
//         />

//         <Route
//           path="invoices/:invoiceNumber"
//           element={<InvoiceViewPage />}
//         />

//         {/* =================================================
//             GIVING STATEMENTS
//         ================================================= */}

//         <Route
//           path="giving-statements"
//           element={<GivingStatements />}
//         />

//         {/* =================================================
//             FAMILY / DEPENDENTS
//         ================================================= */}

//         <Route
//           path="family"
//           element={<FamilyDependents />}
//         />

//         {/* =================================================
//             DOCUMENTS
//         ================================================= */}

//         <Route
//           path="documents"
//           element={<Documents />}
//         />

//         {/* =================================================
//             REQUESTS
//         ================================================= */}

//         <Route
//           path="myrequests"
//           element={<MyRequests />}
//         />

//         <Route
//           path="requests"
//           element={<MyRequests />}
//         />

//         {/* =================================================
//             FALLBACK
//         ================================================= */}

//         <Route
//           path="*"
//           element={
//             <Navigate
//               to="/dash/membership/my-payments/make-payment"
//               replace
//             />
//           }
//         />

//       </Route>

//     </Routes>
//   );
// }

// src/components/MembershipDashboard/MemberRoutes.jsx

import React from "react";

import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import MemberLayout
  from "./MemberLayout";

/* =========================================
   CORE PAGES
========================================= */

import DashboardProfile
  from "../../pages/DashboardProfile";

import ReceiptViewPage
  from "../../pages/ReceiptViewPage";

import InvoiceViewPage
  from "../../pages/InvoiceViewPage";

/* =========================================
   MEMBER ENTERPRISE PAGES
========================================= */

import DashboardHome
  from "./pages/DashboardHome";

import MyPayments
  from "./pages/MyPayments";

import MyMembershipCoverage
  from "./pages/MyMembershipCoverage";

import GivingStatements
  from "./pages/GivingStatements";

import FamilyDependents
  from "./pages/FamilyDependents";

import Documents
  from "./pages/Documents";

import MyRequests
  from "./pages/MyRequests";

/* =========================================
   MEMBER ROUTES
========================================= */

export default function MemberRoutes() {

  return (

    <Routes>

      <Route element={<MemberLayout />}>

        {/* =====================================
            DEFAULT
        ===================================== */}

        <Route
          index
          element={
            <Navigate
              to="/dash/membership/overview"
              replace
            />
          }
        />

        {/* =====================================
            OVERVIEW
        ===================================== */}

        <Route
          path="overview"
          element={<DashboardHome />}
        />

        {/* =====================================
            PROFILE
        ===================================== */}

        <Route
          path="my-profile"
          element={<DashboardProfile />}
        />

        {/* =====================================
            PAYMENT CENTER
        ===================================== */}

        <Route
          path="my-payments"
          element={
            <Navigate
              to="/dash/membership/my-payments/make-payment"
              replace
            />
          }
        />

        {/* =====================================
            ENTERPRISE PAYMENT TABS
        ===================================== */}

        <Route
          path="my-payments/:tab"
          element={<MyPayments />}
        />

        {/* =====================================
            MEMBERSHIP COVERAGE
        ===================================== */}

        <Route
          path="membership-coverage"
          element={<MyMembershipCoverage />}
        />

        {/* =====================================
            LEGACY REDIRECTS
        ===================================== */}

        <Route
          path="ledger"
          element={
            <Navigate
              to="/dash/membership/my-payments/ledger"
              replace
            />
          }
        />

        <Route
          path="invoices"
          element={
            <Navigate
              to="/dash/membership/my-payments/invoices"
              replace
            />
          }
        />

        <Route
          path="renewal"
          element={
            <Navigate
              to="/dash/membership/my-payments/renewal"
              replace
            />
          }
        />

        <Route
          path="payment-history"
          element={
            <Navigate
              to="/dash/membership/my-payments/history"
              replace
            />
          }
        />

        {/* =====================================
            RECEIPTS
        ===================================== */}

        <Route
          path="receipts/:receiptNumber"
          element={<ReceiptViewPage />}
        />

        {/* =====================================
            INVOICES
        ===================================== */}

        <Route
          path="invoice/:invoiceNumber"
          element={<InvoiceViewPage />}
        />

        <Route
          path="invoices/:invoiceNumber"
          element={<InvoiceViewPage />}
        />

        {/* =====================================
            GIVING STATEMENTS
        ===================================== */}

        <Route
          path="giving-statements"
          element={<GivingStatements />}
        />

        {/* =====================================
            FAMILY
        ===================================== */}

        <Route
          path="family"
          element={<FamilyDependents />}
        />

        {/* =====================================
            DOCUMENTS
        ===================================== */}

        <Route
          path="documents"
          element={<Documents />}
        />

        {/* =====================================
            REQUESTS
        ===================================== */}

        <Route
          path="myrequests"
          element={<MyRequests />}
        />

        <Route
          path="requests"
          element={<MyRequests />}
        />

        {/* =====================================
            FALLBACK
        ===================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/dash/membership/overview"
              replace
            />
          }
        />

      </Route>

    </Routes>
  );
}