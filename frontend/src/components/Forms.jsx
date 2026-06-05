

// frontend/src/components/Forms.jsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaPrayingHands,
  FaBookOpen,
  FaCross,
  FaRing,
  FaReceipt,
} from "react-icons/fa";
import "../styles/Home.css";

const formItems = [
  {
    title: "Prayer Request",
    desc: "Submit a prayer request for yourself, your family, or a loved one.",
    to: "/forms-page",
    state: { formType: "prayer" },
    icon: <FaPrayingHands size={24} />,
  },
  {
    title: "Confession Appointment",
    desc: "Request a confession appointment and spiritual guidance.",
    to: "/forms-page",
    state: { formType: "confession" },
    icon: <FaBookOpen size={24} />,
  },
  {
    title: "Baptism Registration",
    desc: "Register a child for baptism and submit parent information.",
    to: "/forms-page",
    state: { formType: "baptism" },
    icon: <FaCross size={24} />,
  },
  {
    title: "Engagement / Wedding Registration",
    desc: "Submit engagement or wedding registration details.",
    to: "/forms-page",
    state: { formType: "wedding" },
    icon: <FaRing size={24} />,
  },
  {
    title: "Reimbursement Request",
    desc: "Submit a reimbursement request with receipt attachment.",
    to: "/forms-page",
    state: { formType: "reimbursement" },
    icon: <FaReceipt size={24} />,
  },
];

export default function Forms() {
  const navigate = useNavigate();

  return (
    <section id="forms" className="ht-section ht-section-white">
      <div className="ht-container">
        <header className="ht-section-head">
          <h2 className="ht-section-title">Forms & Registrations</h2>
          <p className="ht-section-subtitle">
            Access important church forms and submit service requests online in
            a simple and organized way.
          </p>
        </header>

        <div className="ht-grid ht-grid-5">
          {formItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.to}
              state={item.state}
              className="ht-card ht-card-equal"
            >
              <div className="ht-icon-ring">{item.icon}</div>
              <h3 className="ht-card-title">{item.title}</h3>
              <p className="ht-card-text">{item.desc}</p>
            </NavLink>
          ))}
        </div>

        <div className="ht-section-actions">
          <button className="ht-btn ht-btn-gold" onClick={() => navigate("/forms-page")}>
            View All Forms
          </button>
        </div>
      </div>
    </section>
  );
}