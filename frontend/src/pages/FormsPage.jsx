// frontend\src\pages\FormsPage.jsx


import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../components/api";
import "../styles/FormsPage.css";
import { FiSearch } from "react-icons/fi";

const FORM_OPTIONS = [
  { key: "prayer", label: "Prayer Request", category: "Spiritual" },
  { key: "confession", label: "Confession Appointment Request Form", category: "Spiritual" },
  { key: "baptism", label: "Baptism Registration Form", category: "Spiritual" },
  { key: "wedding", label: "Engagement / Wedding Registration Form (ጋብቻ / ቀለበት)", category: "Spiritual" },
  { key: "memorial", label: "Memorial / Funeral Service Request Form (ፍታት)", category: "Spiritual" },
  { key: "houseBlessing", label: "House Blessing Request Form", category: "Spiritual" },

  { key: "facility", label: "Facility Use Request", category: "Service" },

  { key: "choir", label: "Choir Registration", category: "Service" },
  { key: "teacher", label: "Sunday School Teacher / Assistant", category: "Service" },

  { key: "kids", label: "Kids Program Registration", category: "Programs" },
  { key: "youth", label: "Youth Trip / Outing", category: "Programs" },

  { key: "lost", label: "Lost & Found", category: "Incident" },
  { key: "incident", label: "Incident Report", category: "Incident" },

  { key: "reimbursement", label: "Reimbursement Request", category: "Finance" },
];

const categories = ["All", "Spiritual", "Service", "Programs", "Incident", "Finance"];

const NAME_FIELDS = new Set([
  "fullName",
  "baptismalName",
  "childFullName",
  "fatherFullName",
  "fatherBaptismalName",
  "motherFullName",
  "motherBaptismalName",
  "godparentFullName",
  "godparentBaptismalName",
  "groomFullName",
  "groomBaptismalName",
  "brideFullName",
  "brideBaptismalName",
  "deceasedFullName",
  "deceasedBaptismalName",
  "contactPersonName",
  "headOfHouseholdName",
  "familyBaptismalName",
  "personsBaptismalName",
]);

function text(v) {
  return String(v ?? "").trim();
}

function cleanNameInput(v) {
  return String(v ?? "")
    .replace(/[0-9]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 180);
}

function normalizePhoneInput(v) {
  return String(v ?? "").replace(/\D/g, "").slice(0, 11);
}

function normalizeEmailInput(v) {
  return String(v ?? "").trim().toLowerCase().slice(0, 190);
}

function isEmail(v) {
  const value = text(v);
  if (!value) return false;
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
}

function isRepeatedDigitsPhone(v) {
  const digits = String(v ?? "").replace(/\D/g, "");
  return /^(\d)\1+$/.test(digits);
}

function isPhone(v) {
  const digits = String(v ?? "").replace(/\D/g, "");
  if (!/^\d{7,11}$/.test(digits)) return false;
  if (isRepeatedDigitsPhone(digits)) return false;
  return true;
}

function isPositive(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function isValidName(v) {
  const value = text(v);
  if (!value) return false;
  if (/\d/.test(value)) return false;
  return /^[A-Za-zÀ-ÿ\u1200-\u137F'`.\- ]+$/.test(value);
}

function requiredName(errors, key, label, values) {
  if (!text(values[key])) {
    errors[key] = `${label} is required.`;
  } else if (!isValidName(values[key])) {
    errors[key] = `${label} must not contain numbers.`;
  }
}

function optionalName(errors, key, label, values) {
  if (text(values[key]) && !isValidName(values[key])) {
    errors[key] = `${label} must not contain numbers.`;
  }
}

function requiredEmail(errors, key, label, values) {
  if (!text(values[key])) {
    errors[key] = `${label} is required.`;
  } else if (!isEmail(values[key])) {
    errors[key] = `Enter a valid ${label.toLowerCase()}.`;
  }
}

function optionalEmail(errors, key, label, values) {
  if (text(values[key]) && !isEmail(values[key])) {
    errors[key] = `Enter a valid ${label.toLowerCase()}.`;
  }
}

function requiredPhone(errors, key, label, values) {
  if (!text(values[key])) {
    errors[key] = `${label} is required.`;
  } else if (!isPhone(values[key])) {
    errors[key] = `${label} must be 7 to 11 digits and cannot be repeated digits like 11111111111.`;
  }
}

function optionalPhone(errors, key, label, values) {
  if (text(values[key]) && !isPhone(values[key])) {
    errors[key] = `${label} must be 7 to 11 digits and cannot be repeated digits like 11111111111.`;
  }
}

function requiredText(errors, key, label, values) {
  if (!text(values[key])) {
    errors[key] = `${label} is required.`;
  }
}

function renderYesNoOptions() {
  return (
    <>
      <option value="">Select</option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </>
  );
}

function renderMemberOptions() {
  return (
    <>
      <option value="">Select</option>
      <option value="Member">Member</option>
      <option value="Non-Member">Non-Member</option>
    </>
  );
}

function getDefaults(formKey) {
  switch (formKey) {
    case "baptism":
      return {
        childFullName: "",
        childGender: "",
        childDateOfBirth: "",
        childPlaceOfBirth: "",

        fatherFullName: "",
        fatherBaptismalName: "",
        fatherPhone: "",
        fatherEmail: "",
        fatherMembershipStatus: "",

        motherFullName: "",
        motherBaptismalName: "",
        motherPhone: "",
        motherEmail: "",
        motherMembershipStatus: "",

        includeGodparent: "",
        godparentRole: "",
        godparentFullName: "",
        godparentBaptismalName: "",
        godparentPhone: "",
        godparentEmail: "",
        godparentOrthodox: "",
        godparentChurch: "",

        preferredBaptismDate: "",
        alternateDate: "",
        additionalNotes: "",
        specialRequests: "",
        additionalComments: "",
        attachment: null,
      };

    case "confession":
      return {
        fullName: "",
        baptismalName: "",
        phone: "",
        email: "",
        churchMember: "",
        preferredDate: "",
        preferredTime: "",
        priestPreference: "",
        firstConfession: "",
        notes: "",
        attachment: null,
      };

    case "wedding":
      return {
        groomFullName: "",
        groomBaptismalName: "",
        groomDateOfBirth: "",
        groomPhone: "",
        groomEmail: "",
        groomOrthodox: "",
        groomMembershipStatus: "",

        brideFullName: "",
        brideBaptismalName: "",
        brideDateOfBirth: "",
        bridePhone: "",
        brideEmail: "",
        brideOrthodox: "",
        brideMembershipStatus: "",

        groomBaptized: "",
        brideBaptized: "",

        requestedWeddingDate: "",
        alternateDate: "",
        weddingLocation: "",
        completedCounseling: "",
        scheduleCounseling: "",
        guestCount: "",
        additionalNotes: "",
        specialRequests: "",
        culturalRequests: "",
        attachment: null,
      };

    case "memorial":
      return {
        deceasedFullName: "",
        deceasedBaptismalName: "",
        dateOfBirth: "",
        dateOfPassing: "",
        placeOfPassing: "",

        contactPersonName: "",
        relationshipToDeceased: "",
        phone: "",
        email: "",

        requestedServiceType: "",
        preferredDate: "",
        preferredTime: "",
        additionalRequests: "",
        memorialDonation: "",
        attachment: null,
      };

    case "houseBlessing":
      return {
        headOfHouseholdName: "",
        familyBaptismalName: "",
        phone: "",
        email: "",
        streetAddress: "",
        city: "",
        state: "",
        zipCode: "",
        preferredBlessingDate: "",
        preferredTime: "",
        familyMembersPresent: "",
        additionalNotes: "",
        parkingInstructions: "",
        specialRequests: "",
        attachment: null,
      };

    case "prayer":
      return {
        fullName: "",
        baptismalName: "",
        phone: "",
        email: "",
        prayerRequestType: "",
        namesToPrayFor: "",
        personsBaptismalName: "",
        message: "",
        anonymous: false,
        attachment: null,
      };

    case "reimbursement":
      return {
        fullName: "",
        email: "",
        phone: "",
        purchaseDate: "",
        itemCategory: "",
        totalAmount: "",
        itemDescription: "",
        reimbursementMethod: "",
        attachment: null,
      };

    default:
      return {
        fullName: "",
        baptismalName: "",
        phone: "",
        email: "",
        preferredDate: "",
        preferredTime: "",
        notes: "",
        attachment: null,
      };
  }
}

function validate(formKey, values) {
  const errors = {};

  if (formKey === "prayer") {
    requiredName(errors, "fullName", "Full Name", values);
    optionalName(errors, "baptismalName", "Baptismal name", values);
    optionalName(errors, "personsBaptismalName", "Person’s Name", values);
    optionalPhone(errors, "phone", "Phone Number", values);
    requiredEmail(errors, "email", "Email Address", values);
    requiredText(errors, "prayerRequestType", "Prayer Request Type", values);
    requiredText(errors, "message", "Message / Request", values);
    return errors;
  }

  if (formKey === "confession") {
    requiredName(errors, "fullName", "Full Name", values);
    optionalName(errors, "baptismalName", "Baptismal name", values);
    requiredPhone(errors, "phone", "Phone Number", values);
    requiredEmail(errors, "email", "Email Address", values);
    requiredText(errors, "churchMember", "Church Member", values);
    requiredText(errors, "preferredDate", "Preferred Date", values);
    requiredText(errors, "preferredTime", "Preferred Time", values);
    requiredText(errors, "firstConfession", "First confession selection", values);
    return errors;
  }

  if (formKey === "baptism") {
    requiredName(errors, "childFullName", "Child’s Full Name", values);
    requiredText(errors, "childGender", "Gender", values);
    requiredText(errors, "childDateOfBirth", "Date of Birth", values);
    requiredText(errors, "childPlaceOfBirth", "Place of Birth", values);

    requiredName(errors, "fatherFullName", "Father Full Name", values);
    optionalName(errors, "fatherBaptismalName", "Father Baptismal name", values);
    requiredPhone(errors, "fatherPhone", "Father Phone Number", values);
    requiredEmail(errors, "fatherEmail", "Father Email Address", values);
    requiredText(errors, "fatherMembershipStatus", "Father membership status", values);

    requiredName(errors, "motherFullName", "Mother Full Name", values);
    optionalName(errors, "motherBaptismalName", "Mother Baptismal name", values);
    requiredPhone(errors, "motherPhone", "Mother Phone Number", values);
    requiredEmail(errors, "motherEmail", "Mother Email Address", values);
    requiredText(errors, "motherMembershipStatus", "Mother membership status", values);

    requiredText(errors, "preferredBaptismDate", "Preferred Baptism Date", values);

    if (values.includeGodparent === "Yes") {
      requiredText(errors, "godparentRole", "Godfather / Godmother", values);
      requiredName(errors, "godparentFullName", "Godparent Full Name", values);
      optionalName(errors, "godparentBaptismalName", "Godparent Baptismal name", values);
      requiredPhone(errors, "godparentPhone", "Godparent Phone Number", values);
      requiredEmail(errors, "godparentEmail", "Godparent Email Address", values);
      requiredText(errors, "godparentOrthodox", "Orthodox Christian selection", values);
      requiredText(errors, "godparentChurch", "Church they belong to", values);
    }

    return errors;
  }

  if (formKey === "wedding") {
    requiredName(errors, "groomFullName", "Groom Full Name", values);
    optionalName(errors, "groomBaptismalName", "Groom Baptismal name", values);
    requiredText(errors, "groomDateOfBirth", "Groom Date of Birth", values);
    requiredPhone(errors, "groomPhone", "Groom Phone Number", values);
    requiredEmail(errors, "groomEmail", "Groom Email Address", values);
    requiredText(errors, "groomOrthodox", "Groom Orthodox Christian selection", values);
    requiredText(errors, "groomMembershipStatus", "Groom membership status", values);

    requiredName(errors, "brideFullName", "Bride Full Name", values);
    optionalName(errors, "brideBaptismalName", "Bride Baptismal name", values);
    requiredText(errors, "brideDateOfBirth", "Bride Date of Birth", values);
    requiredPhone(errors, "bridePhone", "Bride Phone Number", values);
    requiredEmail(errors, "brideEmail", "Bride Email Address", values);
    requiredText(errors, "brideOrthodox", "Bride Orthodox Christian selection", values);
    requiredText(errors, "brideMembershipStatus", "Bride membership status", values);

    requiredText(errors, "groomBaptized", "Groom Baptized selection", values);
    requiredText(errors, "brideBaptized", "Bride Baptized selection", values);
    requiredText(errors, "requestedWeddingDate", "Requested Wedding Date", values);
    requiredText(errors, "weddingLocation", "Wedding Location", values);
    requiredText(errors, "completedCounseling", "Premarital counseling status", values);

    return errors;
  }

  if (formKey === "memorial") {
    requiredName(errors, "deceasedFullName", "Full Name of Deceased", values);
    optionalName(errors, "deceasedBaptismalName", "Deceased Baptismal name", values);
    requiredText(errors, "dateOfBirth", "Date of Birth", values);
    requiredText(errors, "dateOfPassing", "Date of Passing", values);
    requiredText(errors, "placeOfPassing", "Place of Passing", values);

    requiredName(errors, "contactPersonName", "Contact Person Name", values);
    requiredText(errors, "relationshipToDeceased", "Relationship to Deceased", values);
    requiredPhone(errors, "phone", "Phone Number", values);
    requiredEmail(errors, "email", "Email Address", values);

    requiredText(errors, "requestedServiceType", "Requested Service Type", values);
    requiredText(errors, "preferredDate", "Preferred Date", values);
    requiredText(errors, "preferredTime", "Preferred Time", values);

    return errors;
  }

  if (formKey === "houseBlessing") {
    requiredName(errors, "headOfHouseholdName", "Head of Household Name", values);
    optionalName(errors, "familyBaptismalName", "Baptismal name of family", values);
    requiredPhone(errors, "phone", "Phone Number", values);
    requiredEmail(errors, "email", "Email Address", values);
    requiredText(errors, "streetAddress", "Street Address", values);
    requiredText(errors, "city", "City", values);
    requiredText(errors, "state", "State", values);
    requiredText(errors, "zipCode", "Zip Code", values);
    requiredText(errors, "preferredBlessingDate", "Preferred Blessing Date", values);
    requiredText(errors, "preferredTime", "Preferred Time", values);
    return errors;
  }

  if (formKey === "reimbursement") {
    requiredName(errors, "fullName", "Full Name", values);
    requiredEmail(errors, "email", "Email Address", values);
    requiredPhone(errors, "phone", "Phone Number", values);
    requiredText(errors, "purchaseDate", "Date of Purchase", values);
    requiredText(errors, "itemCategory", "Item Category", values);
    requiredText(errors, "totalAmount", "Total Amount", values);
    if (text(values.totalAmount) && !isPositive(values.totalAmount)) {
      errors.totalAmount = "Amount must be positive.";
    }
    requiredText(errors, "itemDescription", "Item Description", values);
    requiredText(errors, "reimbursementMethod", "Preferred Reimbursement Method", values);
    if (!values.attachment) errors.attachment = "Receipt image or PDF is required.";
    return errors;
  }

  requiredName(errors, "fullName", "Full Name", values);
  optionalName(errors, "baptismalName", "Baptismal Name", values);
  requiredPhone(errors, "phone", "Phone Number", values);
  requiredEmail(errors, "email", "Email Address", values);

  return errors;
}

function successMessage(formKey) {
  const map = {
    prayer: "Prayer request submitted successfully.",
    confession: "Confession appointment request submitted successfully.",
    baptism: "Baptism registration submitted successfully.",
    wedding: "Engagement / wedding registration submitted successfully.",
    memorial: "Memorial / funeral service request submitted successfully.",
    houseBlessing: "House blessing request submitted successfully.",
    facility: "Facility use request submitted successfully.",
   
    choir: "Choir registration submitted successfully.",
    teacher: "Sunday School teacher / assistant form submitted successfully.",
    kids: "Kids program registration submitted successfully.",
    youth: "Youth trip / outing submitted successfully.",
    lost: "Lost & Found form submitted successfully.",
    incident: "Incident report submitted successfully.",
    reimbursement: "Reimbursement request submitted successfully.",
  };
  return map[formKey] || "Form submitted successfully.";
}

export default function FormsPage() {
  const location = useLocation();
  const [formType, setFormType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [values, setValues] = useState(getDefaults(""));
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (location.state?.formType) {
      const nextType = location.state.formType;
      const item = FORM_OPTIONS.find((f) => f.key === nextType);
      if (item) {
        setFormType(nextType);
        setSearchTerm(item.label);
      }
    }
  }, [location.state]);

  useEffect(() => {
    setValues(getDefaults(formType));
    setErrors({});
    setAlert({ type: "", text: "" });
  }, [formType]);

  useEffect(() => {
    function onClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filteredForms = useMemo(() => {
    return FORM_OPTIONS.filter((item) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      const matchesSearch =
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [searchTerm, activeCategory]);

  const searchResults = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return [];
    return FORM_OPTIONS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchTerm]);

  const selectedMeta = FORM_OPTIONS.find((f) => f.key === formType);

  function openForm(item) {
    setFormType(item.key);
    setSearchTerm(item.label);
    setShowSearchResults(false);

    setTimeout(() => {
      document
        .getElementById("selected-form-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function closeForm() {
    setFormType("");
    setSearchTerm("");
    setActiveCategory("All");
    setShowSearchResults(false);
    setValues(getDefaults(""));
    setErrors({});
    setAlert({ type: "", text: "" });
  }

  function clearSearch() {
    setSearchTerm("");
    setFormType("");
    setActiveCategory("All");
    setShowSearchResults(false);
    setValues(getDefaults(""));
    setErrors({});
    setAlert({ type: "", text: "" });
  }

  function handleChange(e) {
    const { name, value, type, checked, files } = e.target;

    if (type === "file") {
      setValues((prev) => ({ ...prev, [name]: files?.[0] || null }));
      return;
    }

    if (type === "checkbox") {
      setValues((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    if (NAME_FIELDS.has(name)) {
      setValues((prev) => ({ ...prev, [name]: cleanNameInput(value) }));
      return;
    }

    if (name.toLowerCase().includes("phone")) {
      setValues((prev) => ({ ...prev, [name]: normalizePhoneInput(value) }));
      return;
    }

    if (name.toLowerCase().includes("email")) {
      setValues((prev) => ({ ...prev, [name]: normalizeEmailInput(value) }));
      return;
    }

    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function buildPayload() {
    const payload = { ...values };
    delete payload.attachment;
    return payload;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const nextErrors = validate(formType, values);
    setErrors(nextErrors);
    setAlert({ type: "", text: "" });

    if (Object.keys(nextErrors).length) return;

    try {
      setSubmitting(true);

      const payload = buildPayload();

      if (formType === "reimbursement" && values.attachment) {
        const fd = new FormData();
        fd.append("form_key", formType);
        fd.append("payload_json", JSON.stringify(payload));
        fd.append("attachment", values.attachment);

        await api.post("/forms/submit", fd, {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        });
      } else {
        await api.post(
          "/forms/submit",
          {
            form_key: formType,
            payload_json: payload,
          },
          {
            withCredentials: true,
          }
        );
      }

      setAlert({
        type: "success",
        text:
          "Request submitted successfully. If your email matches a member account, it will appear in My Requests.",
      });
      setValues(getDefaults(formType));
      setErrors({});
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        (Array.isArray(err?.response?.data?.errors)
          ? err.response.data.errors.join(" ")
          : "") ||
        "Failed to submit form.";

      setAlert({ type: "error", text: message });
    } finally {
      setSubmitting(false);
    }
  }

  function renderDefaultSimpleForm() {
    return (
      <>
        <Field label="Full Name" error={errors.fullName}>
          <input
            name="fullName"
            value={values.fullName || ""}
            onChange={handleChange}
            placeholder="Full Name"
          />
        </Field>

        <Field label="Baptismal Name" error={errors.baptismalName}>
          <input
            name="baptismalName"
            value={values.baptismalName || ""}
            onChange={handleChange}
            placeholder="Baptismal Name (Optional)"
          />
        </Field>

        <Field label="Phone Number" error={errors.phone}>
          <input
            name="phone"
            value={values.phone || ""}
            onChange={handleChange}
            placeholder="Phone Number"
            inputMode="numeric"
            maxLength={11}
          />
        </Field>

        <Field label="Email Address" error={errors.email}>
          <input
            type="email"
            name="email"
            value={values.email || ""}
            onChange={handleChange}
            placeholder="Email Address"
          />
        </Field>

        <Field label="Preferred Date">
          <input
            type="date"
            name="preferredDate"
            value={values.preferredDate || ""}
            onChange={handleChange}
          />
        </Field>

        <Field label="Preferred Time">
          <input
            type="time"
            name="preferredTime"
            value={values.preferredTime || ""}
            onChange={handleChange}
          />
        </Field>

        <Field label="Additional Details" full>
          <textarea
            name="notes"
            value={values.notes || ""}
            onChange={handleChange}
            placeholder="Additional Details"
          />
        </Field>
      </>
    );
  }

  return (
    <div className="forms-page">
      <div className="forms-page-wrapper">
        <div className="forms-page-hero">
          <div className="forms-page-badge">Requests • Registration • Church Services</div>
          <h1 className="forms-page-title">Church Forms & Requests</h1>
          <p className="forms-page-subtitle">
            Select a form below to submit your request, registration, or church service inquiry.
          </p>
        </div>

        <div id="forms-selector-section" className="forms-toolbar">
          <div className="forms-search-wrap" ref={searchRef}>
            <div className="forms-search">

              <span className="forms-search-icon">
  <FiSearch />
</span>
              <input
                type="text"
                placeholder="Search forms..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
              />
              {searchTerm ? (
                <button
                  type="button"
                  className="forms-search-clear"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  ×
                </button>
              ) : null}
            </div>

            {showSearchResults && searchResults.length > 0 && (
              <div className="forms-search-dropdown">
                {searchResults.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="forms-search-result"
                    onClick={() => openForm(item)}
                  >
                    <span className="forms-search-result-title">{item.label}</span>
                    <span className="forms-search-result-category">{item.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="forms-filters">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`forms-filter-chip ${
                  activeCategory === cat ? "forms-filter-chip-active" : ""
                }`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="forms-button-list">
          {filteredForms.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`forms-open-button ${
                formType === item.key ? "forms-open-button-active" : ""
              }`}
              onClick={() => openForm(item)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {!filteredForms.length && (
          <div className="forms-empty-state">No forms matched your search.</div>
        )}

        {selectedMeta && (
          <div id="selected-form-section" className="selected-form-shell">
            <div className="selected-form-header">
              <button type="button" className="selected-form-close" onClick={closeForm}>
                Close
              </button>
              <span className="selected-form-category">{selectedMeta.category}</span>
              <h2>{selectedMeta.label}</h2>
              <p>Complete the form below and submit.</p>
            </div>

            <form className="church-form" onSubmit={handleSubmit} noValidate>
              {formType === "prayer" && (
                <>
                  <SectionTitle title="Person Requesting Prayer" />

                  <Field label="Full Name" error={errors.fullName}>
                    <input
                      name="fullName"
                      value={values.fullName || ""}
                      onChange={handleChange}
                      placeholder="Full Name"
                    />
                  </Field>

                  <Field label="Baptismal name (ክርስትና ስም) (optional)" error={errors.baptismalName}>
                    <input
                      name="baptismalName"
                      value={values.baptismalName || ""}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </Field>

                  <Field label="Phone Number (optional)" error={errors.phone}>
                    <input
                      name="phone"
                      value={values.phone || ""}
                      onChange={handleChange}
                      placeholder="Phone Number"
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </Field>

                  <Field label="Email Address" error={errors.email}>
                    <input
                      type="email"
                      name="email"
                      value={values.email || ""}
                      onChange={handleChange}
                      placeholder="Email Address"
                    />
                  </Field>

                  <SectionTitle title="Prayer Request Details" />

                  <Field label="Prayer Request Type" error={errors.prayerRequestType}>
                    <select
                      name="prayerRequestType"
                      value={values.prayerRequestType || ""}
                      onChange={handleChange}
                    >
                      <option value="">Select</option>
                      <option value="Health">Health</option>
                      <option value="Family">Family</option>
                      <option value="Thanksgiving">Thanksgiving</option>
                      <option value="Memorial">Memorial</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>

                  <Field label="Name(s) to Pray For">
                    <input
                      name="namesToPrayFor"
                      value={values.namesToPrayFor || ""}
                      onChange={handleChange}
                      placeholder="Name(s) to Pray For"
                    />
                  </Field>

                  <Field label="Person’s Name (ክርስትና ስም) (optional)" error={errors.personsBaptismalName}>
                    <input
                      name="personsBaptismalName"
                      value={values.personsBaptismalName || ""}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </Field>

                  <Field label="Request to remain anonymous">
                    <label className="checkbox-line">
                      <input
                        type="checkbox"
                        name="anonymous"
                        checked={Boolean(values.anonymous)}
                        onChange={handleChange}
                      />
                      <span>Request to remain anonymous</span>
                    </label>
                  </Field>

                  <Field label="Message / Request" error={errors.message} full>
                    <textarea
                      name="message"
                      value={values.message || ""}
                      onChange={handleChange}
                      placeholder="Message / Request"
                    />
                  </Field>
                </>
              )}

              {formType === "confession" && (
                <>
                  <SectionTitle title="Personal Information" />

                  <Field label="Full Name" error={errors.fullName}>
                    <input
                      name="fullName"
                      value={values.fullName || ""}
                      onChange={handleChange}
                      placeholder="Full Name"
                    />
                  </Field>

                  <Field label="Baptismal name (ክርስትና ስም) Optional" error={errors.baptismalName}>
                    <input
                      name="baptismalName"
                      value={values.baptismalName || ""}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </Field>

                  <Field label="Phone Number" error={errors.phone}>
                    <input
                      name="phone"
                      value={values.phone || ""}
                      onChange={handleChange}
                      placeholder="Phone Number"
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </Field>

                  <Field label="Email Address" error={errors.email}>
                    <input
                      type="email"
                      name="email"
                      value={values.email || ""}
                      onChange={handleChange}
                      placeholder="Email Address"
                    />
                  </Field>

                  <Field label="Church Member? (Yes / No)" error={errors.churchMember}>
                    <select
                      name="churchMember"
                      value={values.churchMember || ""}
                      onChange={handleChange}
                    >
                      {renderYesNoOptions()}
                    </select>
                  </Field>

                  <div />

                  <SectionTitle title="Confession Appointment" />

                  <Field label="Preferred Date" error={errors.preferredDate}>
                    <input
                      type="date"
                      name="preferredDate"
                      value={values.preferredDate || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Preferred Time" error={errors.preferredTime}>
                    <input
                      type="time"
                      name="preferredTime"
                      value={values.preferredTime || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Priest Preference (optional)">
                    <input
                      name="priestPreference"
                      value={values.priestPreference || ""}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </Field>

                  <div />

                  <SectionTitle title="Spiritual Preparation" />

                  <Field label="Is this your first confession? (Yes / No)" error={errors.firstConfession}>
                    <select
                      name="firstConfession"
                      value={values.firstConfession || ""}
                      onChange={handleChange}
                    >
                      {renderYesNoOptions()}
                    </select>
                  </Field>

                  <div />

                  <Field label="Notes / Additional information for the priest (optional)" full>
                    <textarea
                      name="notes"
                      value={values.notes || ""}
                      onChange={handleChange}
                      placeholder="Additional information for the priest"
                    />
                  </Field>
                </>
              )}

              {formType === "baptism" && (
                <>
                  <SectionTitle title="Child Information" />

                  <Field label="Child’s Full Name" error={errors.childFullName}>
                    <input
                      name="childFullName"
                      value={values.childFullName || ""}
                      onChange={handleChange}
                      placeholder="Child’s Full Name"
                    />
                  </Field>

                  <Field label="Gender" error={errors.childGender}>
                    <select
                      name="childGender"
                      value={values.childGender || ""}
                      onChange={handleChange}
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </Field>

                  <Field label="Date of Birth" error={errors.childDateOfBirth}>
                    <input
                      type="date"
                      name="childDateOfBirth"
                      value={values.childDateOfBirth || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Place of Birth" error={errors.childPlaceOfBirth}>
                    <input
                      name="childPlaceOfBirth"
                      value={values.childPlaceOfBirth || ""}
                      onChange={handleChange}
                      placeholder="Place of Birth"
                    />
                  </Field>

                  <SectionTitle title="Parent Information — Father" />

                  <Field label="Full Name" error={errors.fatherFullName}>
                    <input
                      name="fatherFullName"
                      value={values.fatherFullName || ""}
                      onChange={handleChange}
                      placeholder="Father Full Name"
                    />
                  </Field>

                  <Field label="Baptismal name (ክርስትና ስም)" error={errors.fatherBaptismalName}>
                    <input
                      name="fatherBaptismalName"
                      value={values.fatherBaptismalName || ""}
                      onChange={handleChange}
                      placeholder="Baptismal name"
                    />
                  </Field>

                  <Field label="Phone Number" error={errors.fatherPhone}>
                    <input
                      name="fatherPhone"
                      value={values.fatherPhone || ""}
                      onChange={handleChange}
                      placeholder="Phone Number"
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </Field>

                  <Field label="Email Address" error={errors.fatherEmail}>
                    <input
                      type="email"
                      name="fatherEmail"
                      value={values.fatherEmail || ""}
                      onChange={handleChange}
                      placeholder="Email Address"
                    />
                  </Field>

                  <Field label="Church Membership Status" error={errors.fatherMembershipStatus}>
                    <select
                      name="fatherMembershipStatus"
                      value={values.fatherMembershipStatus || ""}
                      onChange={handleChange}
                    >
                      {renderMemberOptions()}
                    </select>
                  </Field>

                  <div />

                  <SectionTitle title="Parent Information — Mother" />

                  <Field label="Full Name" error={errors.motherFullName}>
                    <input
                      name="motherFullName"
                      value={values.motherFullName || ""}
                      onChange={handleChange}
                      placeholder="Mother Full Name"
                    />
                  </Field>

                  <Field label="Baptismal name (ክርስትና ስም)" error={errors.motherBaptismalName}>
                    <input
                      name="motherBaptismalName"
                      value={values.motherBaptismalName || ""}
                      onChange={handleChange}
                      placeholder="Baptismal name"
                    />
                  </Field>

                  <Field label="Phone Number" error={errors.motherPhone}>
                    <input
                      name="motherPhone"
                      value={values.motherPhone || ""}
                      onChange={handleChange}
                      placeholder="Phone Number"
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </Field>

                  <Field label="Email Address" error={errors.motherEmail}>
                    <input
                      type="email"
                      name="motherEmail"
                      value={values.motherEmail || ""}
                      onChange={handleChange}
                      placeholder="Email Address"
                    />
                  </Field>

                  <Field label="Church Membership Status" error={errors.motherMembershipStatus}>
                    <select
                      name="motherMembershipStatus"
                      value={values.motherMembershipStatus || ""}
                      onChange={handleChange}
                    >
                      {renderMemberOptions()}
                    </select>
                  </Field>

                  <div />

                  <SectionTitle title="Godparent Information (Optional)" />

                  <Field label="Include Godparent Information?">
                    <select
                      name="includeGodparent"
                      value={values.includeGodparent || ""}
                      onChange={handleChange}
                    >
                      {renderYesNoOptions()}
                    </select>
                  </Field>

                  <div />

                  {values.includeGodparent === "Yes" && (
                    <>
                      <Field label="Godfather / Godmother Name" error={errors.godparentRole}>
                        <select
                          name="godparentRole"
                          value={values.godparentRole || ""}
                          onChange={handleChange}
                        >
                          <option value="">Select</option>
                          <option value="Godfather">Godfather</option>
                          <option value="Godmother">Godmother</option>
                        </select>
                      </Field>

                      <Field label="Full Name" error={errors.godparentFullName}>
                        <input
                          name="godparentFullName"
                          value={values.godparentFullName || ""}
                          onChange={handleChange}
                          placeholder="Full Name"
                        />
                      </Field>

                      <Field label="Baptimal name (ክርስትና ስም) Optional" error={errors.godparentBaptismalName}>
                        <input
                          name="godparentBaptismalName"
                          value={values.godparentBaptismalName || ""}
                          onChange={handleChange}
                          placeholder="Optional"
                        />
                      </Field>

                      <Field label="Phone Number" error={errors.godparentPhone}>
                        <input
                          name="godparentPhone"
                          value={values.godparentPhone || ""}
                          onChange={handleChange}
                          placeholder="Phone Number"
                          inputMode="numeric"
                          maxLength={11}
                        />
                      </Field>

                      <Field label="Email Address" error={errors.godparentEmail}>
                        <input
                          type="email"
                          name="godparentEmail"
                          value={values.godparentEmail || ""}
                          onChange={handleChange}
                          placeholder="Email Address"
                        />
                      </Field>

                      <Field label="Orthodox Christian? (Yes / No)" error={errors.godparentOrthodox}>
                        <select
                          name="godparentOrthodox"
                          value={values.godparentOrthodox || ""}
                          onChange={handleChange}
                        >
                          {renderYesNoOptions()}
                        </select>
                      </Field>

                      <Field label="Church they belong to" error={errors.godparentChurch} full>
                        <input
                          name="godparentChurch"
                          value={values.godparentChurch || ""}
                          onChange={handleChange}
                          placeholder="Church they belong to"
                        />
                      </Field>
                    </>
                  )}

                  <SectionTitle title="Baptism Details" />

                  <Field label="Preferred Baptism Date" error={errors.preferredBaptismDate}>
                    <input
                      type="date"
                      name="preferredBaptismDate"
                      value={values.preferredBaptismDate || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Alternate Date">
                    <input
                      type="date"
                      name="alternateDate"
                      value={values.alternateDate || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Additional Notes" full>
                    <textarea
                      name="additionalNotes"
                      value={values.additionalNotes || ""}
                      onChange={handleChange}
                      placeholder="Additional Notes"
                    />
                  </Field>

                  <Field label="Special requests" full>
                    <textarea
                      name="specialRequests"
                      value={values.specialRequests || ""}
                      onChange={handleChange}
                      placeholder="Special requests"
                    />
                  </Field>

                  <Field label="Additional comments" full>
                    <textarea
                      name="additionalComments"
                      value={values.additionalComments || ""}
                      onChange={handleChange}
                      placeholder="Additional comments"
                    />
                  </Field>
                </>
              )}

              {formType === "wedding" && (
                <>
                  <SectionTitle title="Groom Information" />

                  <Field label="Full Name" error={errors.groomFullName}>
                    <input
                      name="groomFullName"
                      value={values.groomFullName || ""}
                      onChange={handleChange}
                      placeholder="Groom Full Name"
                    />
                  </Field>

                  <Field label="Baptismal name (ክርስትና ስም) Optional" error={errors.groomBaptismalName}>
                    <input
                      name="groomBaptismalName"
                      value={values.groomBaptismalName || ""}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </Field>

                  <Field label="Date of Birth" error={errors.groomDateOfBirth}>
                    <input
                      type="date"
                      name="groomDateOfBirth"
                      value={values.groomDateOfBirth || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Phone Number" error={errors.groomPhone}>
                    <input
                      name="groomPhone"
                      value={values.groomPhone || ""}
                      onChange={handleChange}
                      placeholder="Phone Number"
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </Field>

                  <Field label="Email Address" error={errors.groomEmail}>
                    <input
                      type="email"
                      name="groomEmail"
                      value={values.groomEmail || ""}
                      onChange={handleChange}
                      placeholder="Email Address"
                    />
                  </Field>

                  <Field label="Orthodox Christian? (Yes / No)" error={errors.groomOrthodox}>
                    <select
                      name="groomOrthodox"
                      value={values.groomOrthodox || ""}
                      onChange={handleChange}
                    >
                      {renderYesNoOptions()}
                    </select>
                  </Field>

                  <Field label="Church Membership Status" error={errors.groomMembershipStatus}>
                    <select
                      name="groomMembershipStatus"
                      value={values.groomMembershipStatus || ""}
                      onChange={handleChange}
                    >
                      {renderMemberOptions()}
                    </select>
                  </Field>

                  <div />

                  <SectionTitle title="Bride Information" />

                  <Field label="Full Name" error={errors.brideFullName}>
                    <input
                      name="brideFullName"
                      value={values.brideFullName || ""}
                      onChange={handleChange}
                      placeholder="Bride Full Name"
                    />
                  </Field>

                  <Field label="Baptismal name (ክርስትና ስም) Optional" error={errors.brideBaptismalName}>
                    <input
                      name="brideBaptismalName"
                      value={values.brideBaptismalName || ""}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </Field>

                  <Field label="Date of Birth" error={errors.brideDateOfBirth}>
                    <input
                      type="date"
                      name="brideDateOfBirth"
                      value={values.brideDateOfBirth || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Phone Number" error={errors.bridePhone}>
                    <input
                      name="bridePhone"
                      value={values.bridePhone || ""}
                      onChange={handleChange}
                      placeholder="Phone Number"
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </Field>

                  <Field label="Email Address" error={errors.brideEmail}>
                    <input
                      type="email"
                      name="brideEmail"
                      value={values.brideEmail || ""}
                      onChange={handleChange}
                      placeholder="Email Address"
                    />
                  </Field>

                  <Field label="Orthodox Christian? (Yes / No)" error={errors.brideOrthodox}>
                    <select
                      name="brideOrthodox"
                      value={values.brideOrthodox || ""}
                      onChange={handleChange}
                    >
                      {renderYesNoOptions()}
                    </select>
                  </Field>

                  <Field label="Church Membership Status" error={errors.brideMembershipStatus}>
                    <select
                      name="brideMembershipStatus"
                      value={values.brideMembershipStatus || ""}
                      onChange={handleChange}
                    >
                      {renderMemberOptions()}
                    </select>
                  </Field>

                  <div />

                  <SectionTitle title="Sacramental Status" />

                  <Field label="Groom Baptized? (Yes / No)" error={errors.groomBaptized}>
                    <select
                      name="groomBaptized"
                      value={values.groomBaptized || ""}
                      onChange={handleChange}
                    >
                      {renderYesNoOptions()}
                    </select>
                  </Field>

                  <Field label="Bride Baptized? (Yes / No)" error={errors.brideBaptized}>
                    <select
                      name="brideBaptized"
                      value={values.brideBaptized || ""}
                      onChange={handleChange}
                    >
                      {renderYesNoOptions()}
                    </select>
                  </Field>

                  <SectionTitle title="Wedding Details" />

                  <Field label="Requested Wedding Date" error={errors.requestedWeddingDate}>
                    <input
                      type="date"
                      name="requestedWeddingDate"
                      value={values.requestedWeddingDate || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Alternate Date">
                    <input
                      type="date"
                      name="alternateDate"
                      value={values.alternateDate || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Wedding Location" error={errors.weddingLocation}>
                    <select
                      name="weddingLocation"
                      value={values.weddingLocation || ""}
                      onChange={handleChange}
                    >
                      <option value="">Select</option>
                      <option value="Holy Trinity Church">Holy Trinity Church</option>
                      <option value="Other Location">Other Location</option>
                    </select>
                  </Field>

                  <div />

                  <SectionTitle title="Pre-Marriage Preparation" />

                  <Field label="Have you completed premarital counseling? (Yes / No)" error={errors.completedCounseling}>
                    <select
                      name="completedCounseling"
                      value={values.completedCounseling || ""}
                      onChange={handleChange}
                    >
                      {renderYesNoOptions()}
                    </select>
                  </Field>

                  <Field label="Would you like to schedule counseling with the priest?">
                    <select
                      name="scheduleCounseling"
                      value={values.scheduleCounseling || ""}
                      onChange={handleChange}
                    >
                      {renderYesNoOptions()}
                    </select>
                  </Field>

                  <SectionTitle title="Estimated Attendance" />

                  <Field label="Number of guests expected">
                    <input
                      type="number"
                      min="0"
                      name="guestCount"
                      value={values.guestCount || ""}
                      onChange={handleChange}
                      placeholder="Number of guests expected"
                    />
                  </Field>

                  <div />

                  <Field label="Additional Notes" full>
                    <textarea
                      name="additionalNotes"
                      value={values.additionalNotes || ""}
                      onChange={handleChange}
                      placeholder="Additional Notes"
                    />
                  </Field>

                  <Field label="Special requests" full>
                    <textarea
                      name="specialRequests"
                      value={values.specialRequests || ""}
                      onChange={handleChange}
                      placeholder="Special requests"
                    />
                  </Field>

                  <Field label="Cultural or liturgical requests" full>
                    <textarea
                      name="culturalRequests"
                      value={values.culturalRequests || ""}
                      onChange={handleChange}
                      placeholder="Cultural or liturgical requests"
                    />
                  </Field>
                </>
              )}

              {formType === "memorial" && (
                <>
                  <SectionTitle title="Deceased Information" />

                  <Field label="Full Name of Deceased" error={errors.deceasedFullName}>
                    <input
                      name="deceasedFullName"
                      value={values.deceasedFullName || ""}
                      onChange={handleChange}
                      placeholder="Full Name of Deceased"
                    />
                  </Field>

                  <Field label="Baptismal name (ክርስትና ስም) Optional" error={errors.deceasedBaptismalName}>
                    <input
                      name="deceasedBaptismalName"
                      value={values.deceasedBaptismalName || ""}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </Field>

                  <Field label="Date of Birth" error={errors.dateOfBirth}>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={values.dateOfBirth || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Date of Passing" error={errors.dateOfPassing}>
                    <input
                      type="date"
                      name="dateOfPassing"
                      value={values.dateOfPassing || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Place of Passing" error={errors.placeOfPassing} full>
                    <input
                      name="placeOfPassing"
                      value={values.placeOfPassing || ""}
                      onChange={handleChange}
                      placeholder="Place of Passing"
                    />
                  </Field>

                  <SectionTitle title="Family Contact Information" />

                  <Field label="Contact Person Name" error={errors.contactPersonName}>
                    <input
                      name="contactPersonName"
                      value={values.contactPersonName || ""}
                      onChange={handleChange}
                      placeholder="Contact Person Name"
                    />
                  </Field>

                  <Field label="Relationship to Deceased" error={errors.relationshipToDeceased}>
                    <input
                      name="relationshipToDeceased"
                      value={values.relationshipToDeceased || ""}
                      onChange={handleChange}
                      placeholder="Relationship to Deceased"
                    />
                  </Field>

                  <Field label="Phone Number" error={errors.phone}>
                    <input
                      name="phone"
                      value={values.phone || ""}
                      onChange={handleChange}
                      placeholder="Phone Number"
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </Field>

                  <Field label="Email Address" error={errors.email}>
                    <input
                      type="email"
                      name="email"
                      value={values.email || ""}
                      onChange={handleChange}
                      placeholder="Email Address"
                    />
                  </Field>

                  <SectionTitle title="Service Details" />

                  <Field label="Requested Service Type" error={errors.requestedServiceType}>
                    <select
                      name="requestedServiceType"
                      value={values.requestedServiceType || ""}
                      onChange={handleChange}
                    >
                      <option value="">Select</option>
                      <option value="Funeral Service (የፍታት ጸሎት)">Funeral Service (የፍታት ጸሎት)</option>
                      <option value="Memorial Prayer (የመታሰቢያ ጸሎት)">Memorial Prayer (የመታሰቢያ ጸሎት)</option>
                      <option value="Annual Memorial (አመታዊ መታሰቢያ)">Annual Memorial (አመታዊ መታሰቢያ)</option>
                    </select>
                  </Field>

                  <Field label="Preferred Date" error={errors.preferredDate}>
                    <input
                      type="date"
                      name="preferredDate"
                      value={values.preferredDate || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Preferred Time" error={errors.preferredTime}>
                    <input
                      type="time"
                      name="preferredTime"
                      value={values.preferredTime || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <div />

                  <Field label="Additional Requests" full>
                    <textarea
                      name="additionalRequests"
                      value={values.additionalRequests || ""}
                      onChange={handleChange}
                      placeholder="Additional Requests"
                    />
                  </Field>

                  <Field label="Donation Option — Optional memorial donation to the church" full>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="memorialDonation"
                      value={values.memorialDonation || ""}
                      onChange={handleChange}
                      placeholder="Optional memorial donation amount"
                    />
                  </Field>
                </>
              )}

              {formType === "houseBlessing" && (
                <>
                  <SectionTitle title="Family Information" />

                  <Field label="Head of Household Name" error={errors.headOfHouseholdName}>
                    <input
                      name="headOfHouseholdName"
                      value={values.headOfHouseholdName || ""}
                      onChange={handleChange}
                      placeholder="Head of Household Name"
                    />
                  </Field>

                  <Field label="Baptismal name of family (ክርስትና ስም) Optional" error={errors.familyBaptismalName}>
                    <input
                      name="familyBaptismalName"
                      value={values.familyBaptismalName || ""}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </Field>

                  <Field label="Phone Number" error={errors.phone}>
                    <input
                      name="phone"
                      value={values.phone || ""}
                      onChange={handleChange}
                      placeholder="Phone Number"
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </Field>

                  <Field label="Email Address" error={errors.email}>
                    <input
                      type="email"
                      name="email"
                      value={values.email || ""}
                      onChange={handleChange}
                      placeholder="Email Address"
                    />
                  </Field>

                  <SectionTitle title="Address" />

                  <Field label="Street Address" error={errors.streetAddress} full>
                    <input
                      name="streetAddress"
                      value={values.streetAddress || ""}
                      onChange={handleChange}
                      placeholder="Street Address"
                    />
                  </Field>

                  <Field label="City" error={errors.city}>
                    <input
                      name="city"
                      value={values.city || ""}
                      onChange={handleChange}
                      placeholder="City"
                    />
                  </Field>

                  <Field label="State" error={errors.state}>
                    <input
                      name="state"
                      value={values.state || ""}
                      onChange={handleChange}
                      placeholder="State"
                    />
                  </Field>

                  <Field label="Zip Code" error={errors.zipCode}>
                    <input
                      name="zipCode"
                      value={values.zipCode || ""}
                      onChange={handleChange}
                      placeholder="Zip Code"
                    />
                  </Field>

                  <SectionTitle title="Blessing Details" />

                  <Field label="Preferred Blessing Date" error={errors.preferredBlessingDate}>
                    <input
                      type="date"
                      name="preferredBlessingDate"
                      value={values.preferredBlessingDate || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Preferred Time" error={errors.preferredTime}>
                    <input
                      type="time"
                      name="preferredTime"
                      value={values.preferredTime || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Number of family members present">
                    <input
                      type="number"
                      min="0"
                      name="familyMembersPresent"
                      value={values.familyMembersPresent || ""}
                      onChange={handleChange}
                      placeholder="Number of family members present"
                    />
                  </Field>

                  <div />

                  <Field label="Additional Notes" full>
                    <textarea
                      name="additionalNotes"
                      value={values.additionalNotes || ""}
                      onChange={handleChange}
                      placeholder="Additional Notes"
                    />
                  </Field>

                  <Field label="Parking instructions" full>
                    <textarea
                      name="parkingInstructions"
                      value={values.parkingInstructions || ""}
                      onChange={handleChange}
                      placeholder="Parking instructions"
                    />
                  </Field>

                  <Field label="Special requests" full>
                    <textarea
                      name="specialRequests"
                      value={values.specialRequests || ""}
                      onChange={handleChange}
                      placeholder="Special requests"
                    />
                  </Field>
                </>
              )}

              {formType === "reimbursement" ? (
                <>
                  <Field label="Full Name" error={errors.fullName}>
                    <input
                      name="fullName"
                      value={values.fullName || ""}
                      onChange={handleChange}
                      placeholder="Full Name"
                    />
                  </Field>

                  <Field label="Email Address" error={errors.email}>
                    <input
                      type="email"
                      name="email"
                      value={values.email || ""}
                      onChange={handleChange}
                      placeholder="Email Address"
                    />
                  </Field>

                  <Field label="Phone Number" error={errors.phone}>
                    <input
                      name="phone"
                      value={values.phone || ""}
                      onChange={handleChange}
                      placeholder="Phone Number"
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </Field>

                  <Field label="Date of Purchase" error={errors.purchaseDate}>
                    <input
                      type="date"
                      name="purchaseDate"
                      value={values.purchaseDate || ""}
                      onChange={handleChange}
                    />
                  </Field>

                  <Field label="Item Category" error={errors.itemCategory}>
                    <input
                      name="itemCategory"
                      value={values.itemCategory || ""}
                      onChange={handleChange}
                      placeholder="Item Category"
                    />
                  </Field>

                  <Field label="Total Amount" error={errors.totalAmount}>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      name="totalAmount"
                      value={values.totalAmount || ""}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </Field>

                  <Field label="Preferred Reimbursement Method" error={errors.reimbursementMethod}>
                    <select
                      name="reimbursementMethod"
                      value={values.reimbursementMethod || ""}
                      onChange={handleChange}
                    >
                      <option value="">Select</option>
                      <option value="Check">Check</option>
                      <option value="Zelle">Zelle</option>
                      <option value="ACH">ACH</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </Field>

                  <div />

                  <Field label="Item Description" error={errors.itemDescription} full>
                    <textarea
                      name="itemDescription"
                      value={values.itemDescription || ""}
                      onChange={handleChange}
                      placeholder="Item Description"
                    />
                  </Field>

                  <Field label="Receipt / Invoice / Supporting Document" error={errors.attachment} full>
                    <input
                      type="file"
                      name="attachment"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleChange}
                    />
                  </Field>
                </>
              ) : ["facility", "volunteer", "choir", "teacher", "kids", "youth", "lost", "incident"].includes(formType) ? (
                renderDefaultSimpleForm()
              ) : null}

              {alert.text ? (
                <div
                  className={`form-alert ${
                    alert.type === "success"
                      ? "form-alert-success"
                      : "form-alert-error"
                  }`}
                >
                  {alert.text}
                </div>
              ) : null}

              <div className="church-form-actions">
                <button type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Form"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ title }) {
  return (
    <div className="form-section-title">
      <h3>{title}</h3>
    </div>
  );
}

function Field({ label, children, error, full = false }) {
  return (
    <div className={`form-group ${full ? "full-width" : ""}`}>
      <label>{label}</label>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}