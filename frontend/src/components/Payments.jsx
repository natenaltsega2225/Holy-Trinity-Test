
// src/components/Payments.jsx

import React from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Heart, School, Map } from "lucide-react";
import "../styles/Home.css";

export default function Payments() {
  const nav = useNavigate();

  return (
    <section id="payments" className="ht-section ht-section-alt">
      <div className="ht-container">
        <div className="ht-section-head">
          <h2 className="ht-section-title">Payments & Registration</h2>
          <p className="ht-section-subtitle">
            Membership, donations, kids school, and trip registrations — all in one place.
          </p>
        </div>

        <div className="ht-grid ht-grid-4">
          <div className="ht-card ht-card-equal">
            <div className="ht-icon-ring">
              <CreditCard size={22} />
            </div>
            <h3 className="ht-card-title">Membership</h3>
            <p className="ht-card-text">
              Members can sign in, pay dues, and manage their membership plans.
            </p>
            <div className="ht-card-action">
              <button className="ht-btn ht-btn-gold" onClick={() => nav("/membership")}>
                Pay Membership
              </button>
            </div>
          </div>

          <div className="ht-card ht-card-equal">
            <div className="ht-icon-ring">
              <Heart size={22} />
            </div>
            <h3 className="ht-card-title">Donate</h3>
            <p className="ht-card-text">
              Members and guests can give offerings, tithe, pledge, or support funds.
            </p>
            <div className="ht-card-action">
              <button className="ht-btn ht-btn-gold" onClick={() => nav("/donate")}>
                Give Now
              </button>
            </div>
          </div>

          <div className="ht-card ht-card-equal">
            <div className="ht-icon-ring">
              <School size={22} />
            </div>
            <h3 className="ht-card-title">Kids School</h3>
            <p className="ht-card-text">
              Members and guests can register children for church school programs.
            </p>
            <div className="ht-card-action">
              <button className="ht-btn ht-btn-gold" onClick={() => nav("/news-events/kids")}>
                View Programs
              </button>
            </div>
          </div>

          <div className="ht-card ht-card-equal">
            <div className="ht-icon-ring">
              <Map size={22} />
            </div>
            <h3 className="ht-card-title">Trips & Events</h3>
            <p className="ht-card-text">
              Members and guests can join trips, outings, and church events.
            </p>
            <div className="ht-card-action">
              <button className="ht-btn ht-btn-gold" onClick={() => nav("/news-events/trip")}>
                Explore Trips
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}