
// // // frontend/src/pages/news-events/KidsProgramsPage.jsx



import React from "react";
import CategoryEventsPage from "./CategoryEventsPage";

export default function KidsProgramsPage() {
  return (
    <CategoryEventsPage
      category="kids"
      eyebrow="Kids Programs"
      title="Kids Programs"
      description="Explore kids programs. Members and non-members can register and pay securely."
      emptyText="No kids programs are available right now."
      enableRegister
    />
  );
}