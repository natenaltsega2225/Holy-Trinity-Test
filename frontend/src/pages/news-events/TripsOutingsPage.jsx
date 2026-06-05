//  // frontend/src/pages/news-events/TripsOutingsPage.jsx


import React from "react";
import CategoryEventsPage from "./CategoryEventsPage";

export default function TripsOutingsPage() {
  return (
    <CategoryEventsPage
      category="trip"
      eyebrow="Trips & Outings"
      title="Trips & Outings"
      description="Register for church trips and outings. Members and non-members are welcome."
      emptyText="No trips are available right now."
      enableRegister
    />
  );
}