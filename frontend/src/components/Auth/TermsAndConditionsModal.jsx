import React, { useEffect } from "react";

export default function TermsAndConditionsModal({
  open,
  onClose,
  onAccept,
  canAccept = true,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="terms-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      onClick={onClose}
    >
      <div className="terms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="terms-head">
          <h2 id="terms-modal-title">Terms and Conditions</h2>
          <button
            type="button"
            className="terms-close"
            onClick={onClose}
            aria-label="Close terms and conditions"
          >
            ×
          </button>
        </div>

        <div className="terms-body">
          <section className="terms-section">
            <h3>1. Acceptance of Terms</h3>
            <p>
              By creating an account for Holy Trinity Ethiopian Orthodox
              Tewahedo Church, you agree to provide accurate information and to
              use the church portal in a lawful and respectful manner.
            </p>
          </section>

          <section className="terms-section">
            <h3>2. Account Information</h3>
            <p>
              You are responsible for keeping your login credentials
              confidential. You must not share your account with another person
              or use another person&apos;s account.
            </p>
          </section>

          <section className="terms-section">
            <h3>3. Membership Registration</h3>
            <p>
              Existing church members may be activated immediately based on
              church registration rules. New church members may be required to
              complete registration fee payment before account activation.
            </p>
          </section>

          <section className="terms-section">
            <h3>4. Payments and Donations</h3>
            <p>
              Online payments are processed through secure third-party payment
              providers such as Stripe. The church does not store your full card
              information in its database.
            </p>
          </section>

          <section className="terms-section">
            <h3>5. Acceptable Use</h3>
            <p>
              You agree not to misuse the portal, submit false information,
              attempt unauthorized access, or disrupt church operations or other
              users.
            </p>
          </section>

          <section className="terms-section">
            <h3>6. Privacy</h3>
            <p>
              Your personal information will be used for church administration,
              communication, membership support, and financial recordkeeping as
              applicable.
            </p>
          </section>

          <section className="terms-section">
            <h3>7. Suspension or Termination</h3>
            <p>
              The church may suspend or disable an account for policy
              violations, misuse, fraudulent activity, or administrative
              reasons.
            </p>
          </section>

          <section className="terms-section">
            <h3>8. Changes</h3>
            <p>
              These terms may be updated from time to time. Continued use of the
              portal after updates means you accept the revised terms.
            </p>
          </section>

          <section className="terms-section">
            <h3>9. Contact</h3>
            <p>
              For account or membership questions, contact the church
              administration office.
            </p>
          </section>
        </div>

        <div className="terms-actions">
          <button
            type="button"
            className="terms-cancel"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="terms-accept"
            onClick={onAccept}
            disabled={!canAccept}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}