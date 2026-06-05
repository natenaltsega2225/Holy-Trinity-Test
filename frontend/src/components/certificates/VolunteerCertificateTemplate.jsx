//frontend\src\components\certificates\VolunteerCertificateTemplate.jsx
import React from "react";

import {
  Award,
  Clock3,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import "../../styles/certificate-template.css";

export default function VolunteerCertificateTemplate({
  volunteerName,
  volunteerHours,
  recognitionLevel,
  issueDate,
  churchName,
  location,
  authorizedBy,
}) {

  return (

    <div className="certificate-template volunteer-certificate">

      {/* HEADER */}

      <div className="certificate-icon">
        <Award />
      </div>

      <div className="certificate-tagline">
        SERVICE • DEDICATION • COMMUNITY
      </div>

      <h1 className="certificate-main-title">
        Volunteer Certificate
      </h1>

      <div className="certificate-church-name">
        {
          churchName ||
          "Holy Trinity Ethiopian Orthodox Tewahedo Church"
        }
      </div>

      {/* BODY */}

      <div className="certificate-description">

        Presented in appreciation of faithful
        volunteer service, dedication, and
        meaningful contribution to the church
        and community.

      </div>

      <div className="certificate-recipient">
        {volunteerName || "Volunteer Name"}
      </div>

      <div className="certificate-description">

        This certificate is awarded in recognition
        of exceptional volunteer commitment,
        ministry participation, and dedicated
        support toward church activities and
        community service initiatives.

      </div>

      {/* DETAILS */}

      <div className="certificate-details-grid">

        <div className="certificate-detail-card">

          <div className="certificate-detail-label">
            Total Volunteer Hours
          </div>

          <div className="certificate-detail-value">
            {volunteerHours || "0 Hours"}
          </div>

        </div>

        <div className="certificate-detail-card">

          <div className="certificate-detail-label">
            Recognition Level
          </div>

          <div className="certificate-detail-value">
            {
              recognitionLevel ||
              "Gold Volunteer Recognition"
            }
          </div>

        </div>

        <div className="certificate-detail-card">

          <div className="certificate-detail-label">
            Issued Date
          </div>

          <div className="certificate-detail-value">
            {issueDate || "—"}
          </div>

        </div>

        <div className="certificate-detail-card">

          <div className="certificate-detail-label">
            Authorized By
          </div>

          <div className="certificate-detail-value">
            {
              authorizedBy ||
              "Church Administration"
            }
          </div>

        </div>

      </div>

      {/* FOOTER */}

      <div className="certificate-footer">

        <div className="certificate-signature-block">

          <div className="signature-line" />

          <div className="signature-title">
            Volunteer Ministry Director
          </div>

          <div className="signature-subtitle">
            Authorized Ministry Approval
          </div>

        </div>

        <div className="certificate-seal">

          COMMUNITY<br />
          SERVICE<br />
          AWARD

        </div>

        <div className="certificate-signature-block">

          <div className="signature-line" />

          <div className="signature-title">
            Church Administration
          </div>

          <div className="signature-subtitle">
            Official Church Seal
          </div>

        </div>

      </div>

      {/* BOTTOM */}

      <div className="certificate-bottom-meta">

        <div className="certificate-bottom-item">

          <MapPin size={16} />

          <span>
            {location || "Nashville, Tennessee"}
          </span>

        </div>

        <div className="certificate-bottom-item">

          <ShieldCheck size={16} />

          <span>
            Verified Church Recognition
          </span>

        </div>

      </div>

    </div>
  );
}