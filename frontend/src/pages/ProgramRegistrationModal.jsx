

// // // frontend/src/pages/ProgramRegistrationModal.jsx

// import React, { useMemo, useState } from "react";
// import api from "../components/api";
// import "../styles/eventsNewsPage.css";
// const EMPTY_FORM = {
//   full_name: "",
//   email: "",
//   phone: "",
//   quantity: 1,
//   participants: [{ name: "", age: "" }],
//   notes: "",
//   cover_processing_fee: true,
// };

// function clean(value) {
//   return String(value || "").trim();
// }

// function isEmail(value) {
//   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
// }

// function priceOf(program) {
//   return Number(program?.price_per_person || program?.price || 0);
// }

// function categoryLabel(program) {
//   const c = String(program?.category || "").toLowerCase();
//   return c === "kids" || c === "school" ? "Kids School Program" : "Trip / Outing";
// }

// export default function ProgramRegistrationModal({ open, onClose, program }) {
//   const [form, setForm] = useState(EMPTY_FORM);
//   const [busy, setBusy] = useState(false);
//   const [err, setErr] = useState("");

//   const price = priceOf(program);
//   const quantity = Math.max(1, Number(form.quantity || 1));

//   const processingFee = useMemo(() => {
//     const base = price * quantity;
//     return form.cover_processing_fee
//       ? Number(((base * 0.029 + 0.3) / (1 - 0.029)).toFixed(2))
//       : 0;
//   }, [price, quantity, form.cover_processing_fee]);

//   const total = useMemo(
//     () => Number((price * quantity + processingFee).toFixed(2)),
//     [price, quantity, processingFee]
//   );

//   if (!open || !program) return null;

//   function setField(key, value) {
//     setForm((prev) => ({ ...prev, [key]: value }));
//   }

//   function setParticipant(index, key, value) {
//     setForm((prev) => {
//       const next = [...prev.participants];
//       next[index] = { ...next[index], [key]: value };
//       return { ...prev, participants: next };
//     });
//   }

//   function syncQuantity(value) {
//     const q = Math.max(1, Number(value || 1));

//     setForm((prev) => {
//       const next = [...prev.participants];
//       while (next.length < q) next.push({ name: "", age: "" });
//       while (next.length > q) next.pop();
//       return { ...prev, quantity: q, participants: next };
//     });
//   }

//   function validate() {
//     if (!clean(form.full_name)) return "Full name is required.";
//     if (!clean(form.email)) return "Email is required.";
//     if (!isEmail(form.email)) return "Invalid email.";
//     if (!program?.id) return "Program ID is missing.";
//     if (price <= 0) return "Invalid program price.";
//     return "";
//   }

//   async function submit(e) {
//     e.preventDefault();

//     const validation = validate();
//     if (validation) {
//       setErr(validation);
//       return;
//     }

//     setBusy(true);
//     setErr("");

//     try {
//       const { data } = await api.post("/checkout/create-session", {
//         kind: "program",
//         type: "program",
//         program_id: program.id,
//         quantity,
//         full_name: clean(form.full_name),
//         email: clean(form.email),
//         phone: clean(form.phone),
//         participants: form.participants,
//         note: clean(form.notes),
//         notes: clean(form.notes),
//         cover_processing_fee: form.cover_processing_fee,
//         processing_fee: processingFee,
//         success_url: `${window.location.origin}/payment-success?type=program`,
//         cancel_url: window.location.href,
//       });

//       if (!data?.url) throw new Error("Checkout URL missing.");

//       window.location.href = data.url;
//     } catch (error) {
//       console.error(error);
//       setErr(error?.response?.data?.error || "Checkout failed.");
//     } finally {
//       setBusy(false);
//     }
//   }

//   return (
//     <div className="terms-overlay">
//       <div className="finance-modal-card finance-modal-card-sm">
//         <div className="terms-head finance-modal-head">
//           <div>
//             <p className="finance-modal-eyebrow">{categoryLabel(program)}</p>
//             <h2>Register & Pay</h2>
//           </div>
//           <button type="button" className="terms-close" onClick={onClose}>
//             ×
//           </button>
//         </div>

//         <form className="finance-modal-form" onSubmit={submit}>
//           <div className="auth-banner">
//             <strong>{program.title || program.program_name || program.trip_name}</strong>
//             <br />
//             ${price.toFixed(2)} × {quantity}
//             {processingFee > 0 ? <> + Fee ${processingFee.toFixed(2)}</> : null}
//             <br />
//             <b>Total: ${total.toFixed(2)}</b>
//           </div>

//           {err ? <div className="auth-banner auth-banner-error">{err}</div> : null}

//           <div className="auth-field">
//             <label>Full Name *</label>
//             <input value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} />
//           </div>

//           <div className="auth-field">
//             <label>Email *</label>
//             <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
//           </div>

//           <div className="auth-field">
//             <label>Phone</label>
//             <input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
//           </div>

//           <div className="auth-field">
//             <label>Participants</label>
//             <input type="number" min="1" value={form.quantity} onChange={(e) => syncQuantity(e.target.value)} />
//           </div>

//           {form.participants.map((p, i) => (
//             <div key={i} className="auth-field">
//               <input
//                 placeholder={`Participant ${i + 1}`}
//                 value={p.name}
//                 onChange={(e) => setParticipant(i, "name", e.target.value)}
//               />
//             </div>
//           ))}

//           <div className="auth-field">
//             <label>
//               <input
//                 type="checkbox"
//                 checked={form.cover_processing_fee}
//                 onChange={(e) => setField("cover_processing_fee", e.target.checked)}
//               />
//               Cover processing fee
//             </label>
//           </div>

//           <div className="finance-modal-actions">
//             <button type="button" onClick={onClose}>Cancel</button>
//             <button type="submit" disabled={busy}>
//               {busy ? "Redirecting..." : `Pay $${total.toFixed(2)}`}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

// frontend/src/pages/ProgramRegistrationModal.jsx

import React, { useMemo, useState } from "react";
import api from "../components/api";
import "../styles/eventsNewsPage.css";

const EMPTY_FORM = {
  full_name: "",
  email: "",
  phone: "",
  quantity: 1,
  participants: [{ name: "", age: "" }],
  notes: "",
  cover_processing_fee: true,
};

function clean(value) {
  return String(value || "").trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function priceOf(program) {
  return Number(program?.price_per_person || program?.price || program?.amount || 0);
}

function getProgramKind(program) {
  const c = String(program?.category || "").toLowerCase();

  if (c === "kids" || c === "school" || c === "kids_school") {
    return "school";
  }

  return "trip";
}

function categoryLabel(program) {
  return getProgramKind(program) === "school"
    ? "Kids School Program"
    : "Trip / Outing";
}

function titleOf(program) {
  return (
    program?.title ||
    program?.program_name ||
    program?.trip_name ||
    program?.name ||
    "Program"
  );
}

export default function ProgramRegistrationModal({ open, onClose, program }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const kind = getProgramKind(program);
  const price = priceOf(program);
  const quantity = Math.max(1, Number(form.quantity || 1));

  const processingFee = useMemo(() => {
    const base = price * quantity;

    return form.cover_processing_fee
      ? Number(((base * 0.029 + 0.3) / (1 - 0.029)).toFixed(2))
      : 0;
  }, [price, quantity, form.cover_processing_fee]);

  const total = useMemo(
    () => Number((price * quantity + processingFee).toFixed(2)),
    [price, quantity, processingFee]
  );

  if (!open || !program) return null;

  function setField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function setParticipant(index, key, value) {
    setForm((prev) => {
      const next = [...prev.participants];

      next[index] = {
        ...next[index],
        [key]: value,
      };

      return {
        ...prev,
        participants: next,
      };
    });
  }

  function syncQuantity(value) {
    const q = Math.max(1, Number(value || 1));

    setForm((prev) => {
      const next = [...prev.participants];

      while (next.length < q) {
        next.push({
          name: "",
          age: "",
        });
      }

      while (next.length > q) {
        next.pop();
      }

      return {
        ...prev,
        quantity: q,
        participants: next,
      };
    });
  }

  function validate() {
    if (!clean(form.full_name)) return "Full name is required.";
    if (!clean(form.email)) return "Email is required.";
    if (!isEmail(form.email)) return "Invalid email address.";
    if (!program?.id) return "Program ID is missing.";
    if (price <= 0) return "Invalid program price.";
    if (quantity <= 0) return "Quantity must be at least 1.";

    return "";
  }

  async function submit(e) {
    e.preventDefault();

    const validation = validate();

    if (validation) {
      setErr(validation);
      return;
    }

    setBusy(true);
    setErr("");

    try {
      const { data } = await api.post("/checkout/create-session", {
        kind,
        type: kind,
        payment_kind: kind,

        program_id: program.id,
        news_event_id: program.id,
        related_entity_id: program.id,
        related_entity_type: "news_event",

        sub_category: titleOf(program),
        program_name: titleOf(program),

        quantity,
        amount: total,
        price_per_person: price,

        full_name: clean(form.full_name),
        email: clean(form.email),
        phone: clean(form.phone),

        participants: form.participants,
        participants_json: JSON.stringify(form.participants),

        note: clean(form.notes),
        notes: clean(form.notes),

        cover_processing_fee: form.cover_processing_fee,
        processing_fee: processingFee,

        success_url: `${window.location.origin}/payment-success?type=${kind}`,
        cancel_url: window.location.href,
      });

      if (!data?.url) {
        throw new Error("Checkout URL missing.");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error(error);

      setErr(
        error?.response?.data?.error ||
          error?.message ||
          "Checkout failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="terms-overlay">
      <div className="finance-modal-card finance-modal-card-sm">
        <div className="terms-head finance-modal-head">
          <div>
            <p className="finance-modal-eyebrow">{categoryLabel(program)}</p>
            <h2>Register & Pay</h2>
          </div>

          <button type="button" className="terms-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="finance-modal-form" onSubmit={submit}>
          <div className="auth-banner">
            <strong>{titleOf(program)}</strong>
            <br />
            ${price.toFixed(2)} × {quantity}
            {processingFee > 0 ? <> + Fee ${processingFee.toFixed(2)}</> : null}
            <br />
            <b>Total: ${total.toFixed(2)}</b>
          </div>

          {err ? (
            <div className="auth-banner auth-banner-error">
              {err}
            </div>
          ) : null}

          <div className="auth-field">
            <label>Full Name *</label>
            <input
              value={form.full_name}
              onChange={(e) => setField("full_name", e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label>Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label>
              {kind === "school"
                ? "Number of Students / Participants"
                : "Number of People"}
            </label>
            <input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => syncQuantity(e.target.value)}
            />
          </div>

          {form.participants.map((p, i) => (
            <div key={i} className="auth-field">
              <input
                placeholder={`Participant ${i + 1} Name`}
                value={p.name}
                onChange={(e) => setParticipant(i, "name", e.target.value)}
              />

              <input
                placeholder="Age"
                value={p.age}
                onChange={(e) => setParticipant(i, "age", e.target.value)}
              />
            </div>
          ))}

          <div className="auth-field">
            <label>Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Optional notes"
            />
          </div>

          <div className="auth-field">
            <label>
              <input
                type="checkbox"
                checked={form.cover_processing_fee}
                onChange={(e) =>
                  setField("cover_processing_fee", e.target.checked)
                }
              />
              Cover processing fee
            </label>
          </div>

          <div className="finance-modal-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>

            <button type="submit" disabled={busy}>
              {busy ? "Redirecting..." : `Pay $${total.toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}