// //src/components/AdminDashboard/SystemSettings.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api";
import { usePublicSettings } from "../../../context/PublicSettingsContext";

const FALLBACK_SETTINGS = {
  general: {
    churchName: "Holy Trinity EOTC",
    systemName: "Holy Trinity Admin Portal",
    supportEmail: "support@holytrinityeotc.org",
    contactPhone: "+1 (555) 555-5555",
    address: "123 Church Street, Nashville, TN",
    timezone: "America/Chicago",
    dateFormat: "MM/DD/YYYY",
    language: "English",
  },
  branding: {
    primaryColor: "#2563eb",
    secondaryColor: "#0f172a",
    accentColor: "#f59e0b",
    footerText: "© Holy Trinity EOTC. All rights reserved.",
    loginWelcomeText: "Welcome back to the Holy Trinity EOTC admin portal.",
    showPublicBanner: true,
    publicBannerText: "Serving faith, family, and community with excellence.",
    logoUrl: "/src/assets/images/church logo.jpeg",
    faviconUrl: "/favicon.ico",
  },
  access: {
    allowSelfRegistration: true,
    requireEmailVerification: false,
    defaultRole: "member",
    forceStrongPassword: true,
    passwordMinLength: 12,
    sessionTimeoutMinutes: 30,
    enableMfaForAdmins: false,
    maxLoginAttempts: 5,
    allowFinanceRoleCreation: true,
    allowAdminRoleCreation: true,
  },
  membership: {
    registrationFee: 50,
    monthlyDefault: 50,
    approvalWorkflow: "manual",
    allowDependents: true,
    memberIdPrefix: "M-",
    gracePeriodDays: 7,
    renewalReminderDays: 14,
    customHigherAmountAllowed: true,
    planMode: "settings_driven",
  },
  finance: {
    currency: "USD",
    enableCardPayments: true,
    enableApplePay: true,
    enableAch: false,
    coverProcessingFeeDefault: false,
    receiptPrefix: "RCT-",
    invoicePrefix: "INV-",
    lateFeeEnabled: false,
    lateFeeAmount: 0,
    autoGenerateReceipts: true,
  },
  notifications: {
    senderName: "Holy Trinity EOTC",
    senderEmail: "noreply@holytrinityeotc.org",
    replyToEmail: "admin@holytrinityeotc.org",
    sendWelcomeEmail: true,
    sendPaymentReceiptEmail: true,
    sendAdminAlerts: true,
    newMemberAlertEmail: "admin@holytrinityeotc.org",
    backupAlertEmail: "tech@holytrinityeotc.org",
  },
  integrations: {
    stripeEnabled: true,
    stripePublishableKey: "pk_live_************************",
    stripeSecretKeyStatus: "Configured",
    googleMapsEnabled: true,
    googleCalendarEnabled: false,
    smtpStatus: "Connected",
    webhookStatus: "Healthy",
  },
  maintenance: {
    maintenanceMode: false,
    maintenanceMessage:
      "We are performing scheduled maintenance. Please check back soon.",
    autoBackupEnabled: true,
    backupFrequency: "daily",
    backupRetentionDays: 30,
    allowRestore: false,
    clearCacheOnDeploy: true,
  },
  system: {
    environment: "development",
    appVersion: "v1.0.0",
    database: "Connected",
    storage: "Healthy",
    lastBackup: "Unknown",
  },
};

const SECTIONS = [
  { key: "general", label: "General" },
  { key: "branding", label: "Branding" },
  { key: "access", label: "Access & Security" },
  { key: "membership", label: "Membership" },
  { key: "finance", label: "Finance" },
  { key: "notifications", label: "Notifications" },
  { key: "integrations", label: "Integrations" },
  { key: "maintenance", label: "Backups & Maintenance" },
  { key: "system", label: "System Info" },
];

function mergeSettings(base, incoming) {
  const merged = { ...base };
  Object.keys(base).forEach((section) => {
    merged[section] = {
      ...base[section],
      ...(incoming?.[section] || {}),
    };
  });
  return merged;
}

function Card({ title, description, rightSlot, children }) {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
        border: "1px solid #e5edf7",
        borderRadius: 22,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
        overflow: "hidden",
      }}
    >
      <div
        className="ss-card-head"
        style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid #edf2f7",
          background: "linear-gradient(180deg, #fbfdff 0%, #f4f8ff 100%)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
            {title}
          </h3>
          {description ? (
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
              {description}
            </p>
          ) : null}
        </div>
        {rightSlot}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontSize: 13, fontWeight: 900, color: "#334155" }}>
        {label}
      </label>
      {children}
      {hint ? <span style={{ fontSize: 12, color: "#64748b" }}>{hint}</span> : null}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        height: 44,
        borderRadius: 14,
        border: "1px solid #dbe4f0",
        background: "#fff",
        color: "#0f172a",
        fontSize: 14,
        padding: "0 14px",
        outline: "none",
        boxSizing: "border-box",
        ...(props.style || {}),
      }}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        minHeight: 110,
        borderRadius: 14,
        border: "1px solid #dbe4f0",
        background: "#fff",
        color: "#0f172a",
        fontSize: 14,
        padding: "12px 14px",
        outline: "none",
        boxSizing: "border-box",
        resize: "vertical",
        ...(props.style || {}),
      }}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        height: 44,
        borderRadius: 14,
        border: "1px solid #dbe4f0",
        background: "#fff",
        color: "#0f172a",
        fontSize: 14,
        padding: "0 14px",
        outline: "none",
        boxSizing: "border-box",
        ...(props.style || {}),
      }}
    />
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 52,
        padding: "12px 14px",
        border: "1px solid #e7edf6",
        borderRadius: 16,
        background: checked ? "#f4f8ff" : "#fff",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{label}</span>
      <span
        style={{
          width: 48,
          height: 28,
          borderRadius: 999,
          background: checked ? "#2563eb" : "#cbd5e1",
          position: "relative",
          flex: "0 0 auto",
          transition: "all 0.2s ease",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 3,
            left: checked ? 23 : 3,
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.15)",
            transition: "all 0.2s ease",
          }}
        />
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ display: "none" }} />
    </label>
  );
}

function StatPill({ label, value, color = "#2563eb", bg = "#eef4ff" }) {
  return (
    <div
      className="ss-stat-pill"
      style={{
        borderRadius: 16,
        border: "1px solid #e5edf7",
        background: "#fff",
        padding: 16,
        minWidth: 180,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 28,
          padding: "0 10px",
          borderRadius: 999,
          background: bg,
          color,
          fontSize: 12,
          fontWeight: 900,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

export default function SystemSettings() {
  const [activeSection, setActiveSection] = useState("general");
  const [settings, setSettings] = useState(FALLBACK_SETTINGS);
  const [initialSettings, setInitialSettings] = useState(FALLBACK_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [savingSection, setSavingSection] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { applyLocalSettings, refreshSettings } = usePublicSettings();

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        setLoading(true);
        setErrorMessage("");

        const { data } = await api.get("/admin/system-settings");
        const merged = mergeSettings(FALLBACK_SETTINGS, data?.settings || {});
        if (!mounted) return;

        setSettings(merged);
        setInitialSettings(merged);
      } catch (error) {
        console.error("Failed to load system settings:", error);
        if (!mounted) return;
        setErrorMessage(
          error?.response?.data?.error ||
            "Failed to load system settings. Showing fallback values."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    applyLocalSettings({
      general: settings.general,
      branding: settings.branding,
    });
  }, [settings.general, settings.branding, applyLocalSettings]);

  function updateSection(section, key, value) {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  }

  function changeSection(key) {
    setActiveSection(key);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleLogoUpload(file) {
    if (!file) return;

    try {
      setUploadingLogo(true);
      setErrorMessage("");
      setSaveMessage("");

      const formData = new FormData();
      formData.append("logo", file);

      const { data } = await api.post("/admin/system-settings/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const nextUrl = data?.logoUrl || "";
      if (!nextUrl) throw new Error("Upload did not return logo URL.");

      setSettings((prev) => ({
        ...prev,
        branding: {
          ...prev.branding,
          logoUrl: nextUrl,
        },
      }));

      setInitialSettings((prev) => ({
        ...prev,
        branding: {
          ...prev.branding,
          logoUrl: nextUrl,
        },
      }));

      await refreshSettings();
      setSaveMessage("Logo uploaded successfully.");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("Logo upload failed:", error);
      setErrorMessage(
        error?.response?.data?.error || error?.message || "Failed to upload logo."
      );
    } finally {
      setUploadingLogo(false);
    }
  }

  async function saveCurrentSection() {
    if (activeSection === "system") return;

    try {
      setSavingSection(activeSection);
      setSaveMessage("");
      setErrorMessage("");

      const payload = settings[activeSection] || {};
      const { data } = await api.put(`/admin/system-settings/${activeSection}`, payload);

      const nextSettings = mergeSettings(settings, {
        [activeSection]: data?.data || payload,
      });

      setSettings(nextSettings);
      setInitialSettings(nextSettings);

      if (activeSection === "general" || activeSection === "branding") {
        await refreshSettings();
      }

      setSaveMessage("Section saved successfully.");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("Failed to save section:", error);
      setErrorMessage(
        error?.response?.data?.error || "Failed to save system settings."
      );
    } finally {
      setSavingSection("");
    }
  }

  async function saveAll() {
    try {
      setSavingAll(true);
      setSaveMessage("");
      setErrorMessage("");

      const payload = {};
      SECTIONS.filter((s) => s.key !== "system").forEach((section) => {
        payload[section.key] = settings[section.key];
      });

      const { data } = await api.put("/admin/system-settings", payload);
      const merged = mergeSettings(FALLBACK_SETTINGS, data?.settings || payload);

      setSettings(merged);
      setInitialSettings(merged);
      await refreshSettings();

      setSaveMessage("All system settings saved successfully.");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("Failed to save all settings:", error);
      setErrorMessage(
        error?.response?.data?.error || "Failed to save system settings."
      );
    } finally {
      setSavingAll(false);
    }
  }

  function resetSection(section) {
    if (!initialSettings[section]) return;

    setSettings((prev) => ({
      ...prev,
      [section]: { ...initialSettings[section] },
    }));
  }

  const systemInfo = useMemo(
    () => [
      { label: "Environment", value: settings.system.environment },
      { label: "App Version", value: settings.system.appVersion },
      { label: "Database", value: settings.system.database },
      { label: "Storage", value: settings.system.storage },
      { label: "Last Backup", value: settings.system.lastBackup },
      { label: "Server Timezone", value: settings.general.timezone },
    ],
    [settings]
  );

  const sectionTitleMap = {
    general: "General Settings",
    branding: "Branding",
    access: "Access & Security",
    membership: "Membership Defaults",
    finance: "Finance & Payments",
    notifications: "Notifications & Email",
    integrations: "Integrations",
    maintenance: "Backups & Maintenance",
    system: "System Information",
  };

  const sectionDescriptionMap = {
    general:
      "Manage organization identity, contact details, timezone, and language defaults.",
    branding:
      "Control colors, logo, footer text, public banner text, and login page branding.",
    access:
      "Define registration rules, password policy, MFA, session limits, and role creation permissions.",
    membership:
      "Configure registration fee, membership defaults, dependents, reminder timing, and approval workflow.",
    finance:
      "Manage payment methods, document prefixes, late fees, and receipt behavior.",
    notifications:
      "Configure sender details, reply handling, and email alert behavior.",
    integrations:
      "Monitor service connections and configure third-party provider flags.",
    maintenance:
      "Manage maintenance mode, backup schedule, restore permissions, and retention.",
    system:
      "Read-only operational summary for environment, storage, database health, and backup visibility.",
  };

  function renderCurrentSection() {
    const rightSlot =
      activeSection !== "system" ? (
        <div className="ss-card-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="mr-btn mr-btn-secondary"
            onClick={() => resetSection(activeSection)}
          >
            Reset Section
          </button>
          <button
            type="button"
            className="mr-btn mr-btn-primary"
            onClick={saveCurrentSection}
            disabled={savingSection === activeSection || uploadingLogo}
          >
            {savingSection === activeSection ? "Saving..." : "Save Section"}
          </button>
        </div>
      ) : null;

    if (activeSection === "general") {
      return (
        <Card
          title={sectionTitleMap.general}
          description={sectionDescriptionMap.general}
          rightSlot={rightSlot}
        >
          <div className="mr-form-grid mr-grid-2">
            <Field label="Church Name">
              <TextInput
                value={settings.general.churchName}
                onChange={(e) => updateSection("general", "churchName", e.target.value)}
              />
            </Field>
            <Field label="System Name">
              <TextInput
                value={settings.general.systemName}
                onChange={(e) => updateSection("general", "systemName", e.target.value)}
              />
            </Field>
            <Field label="Support Email">
              <TextInput
                value={settings.general.supportEmail}
                onChange={(e) => updateSection("general", "supportEmail", e.target.value)}
              />
            </Field>
            <Field label="Contact Phone">
              <TextInput
                value={settings.general.contactPhone}
                onChange={(e) => updateSection("general", "contactPhone", e.target.value)}
              />
            </Field>
            <Field label="Address">
              <TextInput
                value={settings.general.address}
                onChange={(e) => updateSection("general", "address", e.target.value)}
              />
            </Field>
            <Field label="Timezone">
              <Select
                value={settings.general.timezone}
                onChange={(e) => updateSection("general", "timezone", e.target.value)}
              >
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="UTC">UTC</option>
              </Select>
            </Field>
            <Field label="Date Format">
              <Select
                value={settings.general.dateFormat}
                onChange={(e) => updateSection("general", "dateFormat", e.target.value)}
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </Select>
            </Field>
            <Field label="Language">
              <Select
                value={settings.general.language}
                onChange={(e) => updateSection("general", "language", e.target.value)}
              >
                <option value="English">English</option>
                <option value="Amharic">Amharic</option>
              </Select>
            </Field>
          </div>
        </Card>
      );
    }

    if (activeSection === "branding") {
      return (
        <Card
          title={sectionTitleMap.branding}
          description={sectionDescriptionMap.branding}
          rightSlot={rightSlot}
        >
          <div className="mr-form-grid mr-grid-3">
            <Field label="Primary Color">
              <TextInput
                type="color"
                style={{ padding: 4 }}
                value={settings.branding.primaryColor}
                onChange={(e) => updateSection("branding", "primaryColor", e.target.value)}
              />
            </Field>
            <Field label="Secondary Color">
              <TextInput
                type="color"
                style={{ padding: 4 }}
                value={settings.branding.secondaryColor}
                onChange={(e) => updateSection("branding", "secondaryColor", e.target.value)}
              />
            </Field>
            <Field label="Accent Color">
              <TextInput
                type="color"
                style={{ padding: 4 }}
                value={settings.branding.accentColor}
                onChange={(e) => updateSection("branding", "accentColor", e.target.value)}
              />
            </Field>
          </div>

          <div className="mr-form-grid" style={{ marginTop: 16 }}>
            <Field
              label="Logo URL"
              hint="Use a public URL, uploaded image, or keep your local fallback path."
            >
              <TextInput
                value={settings.branding.logoUrl}
                onChange={(e) => updateSection("branding", "logoUrl", e.target.value)}
              />
            </Field>

            <Field label="Upload Logo Image">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                style={{ fontSize: 14 }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {uploadingLogo ? "Uploading..." : "Upload PNG, JPG, WEBP, GIF, or SVG."}
              </span>
            </Field>

            <Field label="Footer Text">
              <TextInput
                value={settings.branding.footerText}
                onChange={(e) => updateSection("branding", "footerText", e.target.value)}
              />
            </Field>

            <Field label="Login Welcome Text">
              <TextArea
                value={settings.branding.loginWelcomeText}
                onChange={(e) => updateSection("branding", "loginWelcomeText", e.target.value)}
              />
            </Field>

            <Field label="Public Banner Text">
              <TextArea
                value={settings.branding.publicBannerText}
                onChange={(e) => updateSection("branding", "publicBannerText", e.target.value)}
              />
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <Toggle
              checked={settings.branding.showPublicBanner}
              onChange={(e) =>
                updateSection("branding", "showPublicBanner", e.target.checked)
              }
              label="Show public website banner"
            />
          </div>
        </Card>
      );
    }

    if (activeSection === "access") {
      return (
        <Card
          title={sectionTitleMap.access}
          description={sectionDescriptionMap.access}
          rightSlot={rightSlot}
        >
          <div className="mr-form-grid mr-grid-2">
            <Field label="Default Role After Registration">
              <Select
                value={settings.access.defaultRole}
                onChange={(e) => updateSection("access", "defaultRole", e.target.value)}
              >
                <option value="member">Member</option>
                <option value="pending">Pending</option>
              </Select>
            </Field>
            <Field label="Password Minimum Length">
              <TextInput
                type="number"
                value={settings.access.passwordMinLength}
                onChange={(e) =>
                  updateSection("access", "passwordMinLength", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Session Timeout (Minutes)">
              <TextInput
                type="number"
                value={settings.access.sessionTimeoutMinutes}
                onChange={(e) =>
                  updateSection("access", "sessionTimeoutMinutes", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Max Login Attempts">
              <TextInput
                type="number"
                value={settings.access.maxLoginAttempts}
                onChange={(e) =>
                  updateSection("access", "maxLoginAttempts", Number(e.target.value))
                }
              />
            </Field>
          </div>

          <div className="mr-form-grid mr-grid-2" style={{ marginTop: 16 }}>
            <Toggle
              checked={settings.access.allowSelfRegistration}
              onChange={(e) =>
                updateSection("access", "allowSelfRegistration", e.target.checked)
              }
              label="Allow self registration"
            />
            <Toggle
              checked={settings.access.requireEmailVerification}
              onChange={(e) =>
                updateSection("access", "requireEmailVerification", e.target.checked)
              }
              label="Require email verification"
            />
            <Toggle
              checked={settings.access.forceStrongPassword}
              onChange={(e) =>
                updateSection("access", "forceStrongPassword", e.target.checked)
              }
              label="Enforce strong password policy"
            />
            <Toggle
              checked={settings.access.enableMfaForAdmins}
              onChange={(e) =>
                updateSection("access", "enableMfaForAdmins", e.target.checked)
              }
              label="Enable MFA for admins"
            />
            <Toggle
              checked={settings.access.allowFinanceRoleCreation}
              onChange={(e) =>
                updateSection("access", "allowFinanceRoleCreation", e.target.checked)
              }
              label="Allow finance role creation"
            />
            <Toggle
              checked={settings.access.allowAdminRoleCreation}
              onChange={(e) =>
                updateSection("access", "allowAdminRoleCreation", e.target.checked)
              }
              label="Allow admin role creation"
            />
          </div>
        </Card>
      );
    }

    if (activeSection === "membership") {
      return (
        <Card
          title={sectionTitleMap.membership}
          description={sectionDescriptionMap.membership}
          rightSlot={rightSlot}
        >
          <div className="mr-form-grid mr-grid-3">
            <Field label="Registration Fee">
              <TextInput
                type="number"
                value={settings.membership.registrationFee}
                onChange={(e) =>
                  updateSection("membership", "registrationFee", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Default Monthly Amount">
              <TextInput
                type="number"
                value={settings.membership.monthlyDefault}
                onChange={(e) =>
                  updateSection("membership", "monthlyDefault", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Member ID Prefix">
              <TextInput
                value={settings.membership.memberIdPrefix}
                onChange={(e) =>
                  updateSection("membership", "memberIdPrefix", e.target.value)
                }
              />
            </Field>
            <Field label="Approval Workflow">
              <Select
                value={settings.membership.approvalWorkflow}
                onChange={(e) =>
                  updateSection("membership", "approvalWorkflow", e.target.value)
                }
              >
                <option value="manual">Manual</option>
                <option value="automatic">Automatic</option>
              </Select>
            </Field>
            <Field label="Grace Period (Days)">
              <TextInput
                type="number"
                value={settings.membership.gracePeriodDays}
                onChange={(e) =>
                  updateSection("membership", "gracePeriodDays", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Renewal Reminder (Days Before)">
              <TextInput
                type="number"
                value={settings.membership.renewalReminderDays}
                onChange={(e) =>
                  updateSection(
                    "membership",
                    "renewalReminderDays",
                    Number(e.target.value)
                  )
                }
              />
            </Field>
            <Field label="Plan Mode">
              <Select
                value={settings.membership.planMode}
                onChange={(e) => updateSection("membership", "planMode", e.target.value)}
              >
                <option value="settings_driven">Settings Driven</option>
                <option value="membership_plans_table">Membership Plans Table</option>
              </Select>
            </Field>
          </div>

          <div className="mr-form-grid mr-grid-2" style={{ marginTop: 16 }}>
            <Toggle
              checked={settings.membership.allowDependents}
              onChange={(e) =>
                updateSection("membership", "allowDependents", e.target.checked)
              }
              label="Allow dependent records"
            />
            <Toggle
              checked={settings.membership.customHigherAmountAllowed}
              onChange={(e) =>
                updateSection(
                  "membership",
                  "customHigherAmountAllowed",
                  e.target.checked
                )
              }
              label="Allow custom higher membership amount"
            />
          </div>
        </Card>
      );
    }

    if (activeSection === "finance") {
      return (
        <Card
          title={sectionTitleMap.finance}
          description={sectionDescriptionMap.finance}
          rightSlot={rightSlot}
        >
          <div className="mr-form-grid mr-grid-3">
            <Field label="Currency">
              <Select
                value={settings.finance.currency}
                onChange={(e) => updateSection("finance", "currency", e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
              </Select>
            </Field>
            <Field label="Receipt Prefix">
              <TextInput
                value={settings.finance.receiptPrefix}
                onChange={(e) => updateSection("finance", "receiptPrefix", e.target.value)}
              />
            </Field>
            <Field label="Invoice Prefix">
              <TextInput
                value={settings.finance.invoicePrefix}
                onChange={(e) => updateSection("finance", "invoicePrefix", e.target.value)}
              />
            </Field>
            <Field label="Late Fee Amount">
              <TextInput
                type="number"
                value={settings.finance.lateFeeAmount}
                onChange={(e) =>
                  updateSection("finance", "lateFeeAmount", Number(e.target.value))
                }
              />
            </Field>
          </div>

          <div className="mr-form-grid mr-grid-2" style={{ marginTop: 16 }}>
            <Toggle
              checked={settings.finance.enableCardPayments}
              onChange={(e) =>
                updateSection("finance", "enableCardPayments", e.target.checked)
              }
              label="Enable card payments"
            />
            <Toggle
              checked={settings.finance.enableApplePay}
              onChange={(e) =>
                updateSection("finance", "enableApplePay", e.target.checked)
              }
              label="Enable Apple Pay"
            />
            <Toggle
              checked={settings.finance.enableAch}
              onChange={(e) => updateSection("finance", "enableAch", e.target.checked)}
              label="Enable ACH"
            />
            <Toggle
              checked={settings.finance.coverProcessingFeeDefault}
              onChange={(e) =>
                updateSection(
                  "finance",
                  "coverProcessingFeeDefault",
                  e.target.checked
                )
              }
              label="Default donor covers processing fee"
            />
            <Toggle
              checked={settings.finance.lateFeeEnabled}
              onChange={(e) =>
                updateSection("finance", "lateFeeEnabled", e.target.checked)
              }
              label="Enable late fees"
            />
            <Toggle
              checked={settings.finance.autoGenerateReceipts}
              onChange={(e) =>
                updateSection(
                  "finance",
                  "autoGenerateReceipts",
                  e.target.checked
                )
              }
              label="Auto generate receipts"
            />
          </div>
        </Card>
      );
    }

    if (activeSection === "notifications") {
      return (
        <Card
          title={sectionTitleMap.notifications}
          description={sectionDescriptionMap.notifications}
          rightSlot={rightSlot}
        >
          <div className="mr-form-grid mr-grid-2">
            <Field label="Sender Name">
              <TextInput
                value={settings.notifications.senderName}
                onChange={(e) =>
                  updateSection("notifications", "senderName", e.target.value)
                }
              />
            </Field>
            <Field label="Sender Email">
              <TextInput
                value={settings.notifications.senderEmail}
                onChange={(e) =>
                  updateSection("notifications", "senderEmail", e.target.value)
                }
              />
            </Field>
            <Field label="Reply-To Email">
              <TextInput
                value={settings.notifications.replyToEmail}
                onChange={(e) =>
                  updateSection("notifications", "replyToEmail", e.target.value)
                }
              />
            </Field>
            <Field label="New Member Alert Email">
              <TextInput
                value={settings.notifications.newMemberAlertEmail}
                onChange={(e) =>
                  updateSection("notifications", "newMemberAlertEmail", e.target.value)
                }
              />
            </Field>
            <Field label="Backup Alert Email">
              <TextInput
                value={settings.notifications.backupAlertEmail}
                onChange={(e) =>
                  updateSection("notifications", "backupAlertEmail", e.target.value)
                }
              />
            </Field>
          </div>

          <div className="mr-form-grid mr-grid-2" style={{ marginTop: 16 }}>
            <Toggle
              checked={settings.notifications.sendWelcomeEmail}
              onChange={(e) =>
                updateSection("notifications", "sendWelcomeEmail", e.target.checked)
              }
              label="Send welcome email"
            />
            <Toggle
              checked={settings.notifications.sendPaymentReceiptEmail}
              onChange={(e) =>
                updateSection(
                  "notifications",
                  "sendPaymentReceiptEmail",
                  e.target.checked
                )
              }
              label="Send payment receipt email"
            />
            <Toggle
              checked={settings.notifications.sendAdminAlerts}
              onChange={(e) =>
                updateSection("notifications", "sendAdminAlerts", e.target.checked)
              }
              label="Send admin alerts"
            />
          </div>
        </Card>
      );
    }

    if (activeSection === "integrations") {
      return (
        <Card
          title={sectionTitleMap.integrations}
          description={sectionDescriptionMap.integrations}
          rightSlot={rightSlot}
        >
          <div className="mr-form-grid mr-grid-2">
            <Field label="Stripe Publishable Key">
              <TextInput
                value={settings.integrations.stripePublishableKey}
                onChange={(e) =>
                  updateSection("integrations", "stripePublishableKey", e.target.value)
                }
              />
            </Field>
            <Field label="Stripe Secret Key Status">
              <Select
                value={settings.integrations.stripeSecretKeyStatus}
                onChange={(e) =>
                  updateSection(
                    "integrations",
                    "stripeSecretKeyStatus",
                    e.target.value
                  )
                }
              >
                <option value="Configured">Configured</option>
                <option value="Missing">Missing</option>
              </Select>
            </Field>
            <Field label="SMTP Status">
              <Select
                value={settings.integrations.smtpStatus}
                onChange={(e) =>
                  updateSection("integrations", "smtpStatus", e.target.value)
                }
              >
                <option value="Connected">Connected</option>
                <option value="Disconnected">Disconnected</option>
              </Select>
            </Field>
            <Field label="Webhook Status">
              <Select
                value={settings.integrations.webhookStatus}
                onChange={(e) =>
                  updateSection("integrations", "webhookStatus", e.target.value)
                }
              >
                <option value="Healthy">Healthy</option>
                <option value="Warning">Warning</option>
                <option value="Down">Down</option>
              </Select>
            </Field>
          </div>

          <div className="mr-form-grid mr-grid-2" style={{ marginTop: 16 }}>
            <Toggle
              checked={settings.integrations.stripeEnabled}
              onChange={(e) =>
                updateSection("integrations", "stripeEnabled", e.target.checked)
              }
              label="Enable Stripe"
            />
            <Toggle
              checked={settings.integrations.googleMapsEnabled}
              onChange={(e) =>
                updateSection("integrations", "googleMapsEnabled", e.target.checked)
              }
              label="Enable Google Maps"
            />
            <Toggle
              checked={settings.integrations.googleCalendarEnabled}
              onChange={(e) =>
                updateSection(
                  "integrations",
                  "googleCalendarEnabled",
                  e.target.checked
                )
              }
              label="Enable Google Calendar"
            />
          </div>
        </Card>
      );
    }

    if (activeSection === "maintenance") {
      return (
        <Card
          title={sectionTitleMap.maintenance}
          description={sectionDescriptionMap.maintenance}
          rightSlot={rightSlot}
        >
          <div className="mr-form-grid mr-grid-3">
            <Field label="Backup Frequency">
              <Select
                value={settings.maintenance.backupFrequency}
                onChange={(e) =>
                  updateSection("maintenance", "backupFrequency", e.target.value)
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </Field>
            <Field label="Backup Retention (Days)">
              <TextInput
                type="number"
                value={settings.maintenance.backupRetentionDays}
                onChange={(e) =>
                  updateSection(
                    "maintenance",
                    "backupRetentionDays",
                    Number(e.target.value)
                  )
                }
              />
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <Field label="Maintenance Message">
              <TextArea
                value={settings.maintenance.maintenanceMessage}
                onChange={(e) =>
                  updateSection("maintenance", "maintenanceMessage", e.target.value)
                }
              />
            </Field>
          </div>

          <div className="mr-form-grid mr-grid-2" style={{ marginTop: 16 }}>
            <Toggle
              checked={settings.maintenance.maintenanceMode}
              onChange={(e) =>
                updateSection("maintenance", "maintenanceMode", e.target.checked)
              }
              label="Enable maintenance mode"
            />
            <Toggle
              checked={settings.maintenance.autoBackupEnabled}
              onChange={(e) =>
                updateSection("maintenance", "autoBackupEnabled", e.target.checked)
              }
              label="Enable automatic backups"
            />
            <Toggle
              checked={settings.maintenance.allowRestore}
              onChange={(e) =>
                updateSection("maintenance", "allowRestore", e.target.checked)
              }
              label="Allow restore actions"
            />
            <Toggle
              checked={settings.maintenance.clearCacheOnDeploy}
              onChange={(e) =>
                updateSection(
                  "maintenance",
                  "clearCacheOnDeploy",
                  e.target.checked
                )
              }
              label="Clear cache after deploy"
            />
          </div>
        </Card>
      );
    }

    return (
      <Card
        title={sectionTitleMap.system}
        description={sectionDescriptionMap.system}
      >
        <div
          className="ss-system-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {systemInfo.map((item) => (
            <div
              key={item.label}
              style={{
                border: "1px solid #e5edf7",
                borderRadius: 18,
                padding: 18,
                background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 10,
                }}
              >
                {item.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="mr-page">
        <section className="mr-hero">
          <div>
            <p className="mr-eyebrow">Administration</p>
            <h2 className="mr-title">System Settings</h2>
            <p className="mr-subtitle">Loading settings...</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mr-page">
      <section
        className="mr-hero ss-hero"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 720px" }}>
          <p className="mr-eyebrow">Administration</p>
          <h2 className="mr-title">System Settings</h2>
          <p className="mr-subtitle">
            Configure branding, user access policies, membership defaults, finance
            options, notifications, integrations, backups, and core system behavior.
          </p>
        </div>

        <div className="ss-stats" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignSelf: "flex-end" }}>
          <StatPill label="System" value="Healthy" />
          <StatPill label="Backups" value="Enabled" color="#047857" bg="#ecfdf5" />
          <StatPill label="Security" value="Standard" color="#b45309" bg="#fff7ed" />
        </div>
      </section>

      {saveMessage ? (
        <div className="mr-banner" style={{ color: "#047857", background: "#ecfdf5", borderColor: "#bbf7d0" }}>
          {saveMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mr-banner" style={{ color: "#b42318", background: "#fff1f2", borderColor: "#fecdd3" }}>
          {errorMessage}
        </div>
      ) : null}

      <div className="ss-layout" style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: 18 }}>
        <aside
          className="ss-sidebar"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
            border: "1px solid #e5edf7",
            borderRadius: 22,
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
            padding: 16,
            alignSelf: "start",
            position: "sticky",
            top: 18,
          }}
        >
          <div
            style={{
              marginBottom: 12,
              fontSize: 12,
              fontWeight: 900,
              color: "#2563eb",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Settings Sections
          </div>

          <button
            type="button"
            className="ss-mobile-section-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            <span>{SECTIONS.find((s) => s.key === activeSection)?.label || "Select Section"}</span>
            <span>{mobileMenuOpen ? "−" : "+"}</span>
          </button>

          <div className={`ss-section-list ${mobileMenuOpen ? "open" : ""}`} style={{ display: "grid", gap: 8 }}>
            {SECTIONS.map((section) => {
              const active = activeSection === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => changeSection(section.key)}
                  style={{
                    height: 46,
                    borderRadius: 14,
                    border: active ? "1px solid #2563eb" : "1px solid #e5edf7",
                    background: active
                      ? "linear-gradient(135deg, #2563eb 0%, #4f7df3 100%)"
                      : "#fff",
                    color: active ? "#fff" : "#0f172a",
                    fontSize: 14,
                    fontWeight: 800,
                    textAlign: "left",
                    padding: "0 14px",
                    cursor: "pointer",
                  }}
                >
                  {section.label}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="ss-main" style={{ display: "grid", gap: 18, minWidth: 0 }}>
          {renderCurrentSection()}

          <div
            className="ss-savebar"
            style={{
              position: "sticky",
              bottom: 12,
              zIndex: 10,
              background: "rgba(255,255,255,0.88)",
              backdropFilter: "blur(10px)",
              border: "1px solid #e5edf7",
              borderRadius: 18,
              padding: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 15 }}>
                Ready to save changes
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Save the current section or save everything at once.
              </div>
            </div>

            <div className="ss-savebar-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="mr-btn mr-btn-secondary"
                onClick={() => {
                  setSettings(initialSettings);
                }}
              >
                Reset All
              </button>
              <button
                type="button"
                className="mr-btn mr-btn-primary"
                onClick={saveAll}
                disabled={savingAll || uploadingLogo}
              >
                {savingAll ? "Saving..." : "Save All Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .ss-mobile-section-toggle {
          display: none;
          width: 100%;
          min-height: 48px;
          border-radius: 14px;
          border: 1px solid #dbe4f0;
          background: #fff;
          color: #0f172a;
          font-size: 14px;
          font-weight: 800;
          padding: 0 14px;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          margin-bottom: 8px;
        }

        @media (max-width: 1200px) {
          .ss-stats {
            width: 100%;
          }

          .ss-stat-pill {
            flex: 1 1 180px;
            min-width: 0 !important;
          }
        }

        @media (max-width: 1024px) {
          .ss-layout {
            grid-template-columns: 1fr !important;
          }

          .ss-sidebar {
            position: static !important;
            top: auto !important;
          }

          .ss-mobile-section-toggle {
            display: flex;
          }

          .ss-section-list {
            display: none !important;
          }

          .ss-section-list.open {
            display: grid !important;
          }
        }

        @media (max-width: 900px) {
          .mr-page .mr-grid-3,
          .mr-page .mr-grid-2,
          .ss-system-grid {
            grid-template-columns: 1fr !important;
          }

          .ss-card-head {
            flex-direction: column;
            align-items: stretch !important;
          }

          .ss-card-actions {
            width: 100%;
          }

          .ss-card-actions .mr-btn {
            width: 100%;
          }
        }

        @media (max-width: 768px) {
          .ss-hero {
            gap: 14px !important;
          }

          .ss-stats {
            display: grid !important;
            grid-template-columns: 1fr;
            gap: 10px !important;
          }

          .ss-main {
            min-width: 0;
          }

          .ss-savebar {
            position: static !important;
          }

          .ss-savebar-actions {
            width: 100%;
            display: grid !important;
            grid-template-columns: 1fr;
          }

          .ss-savebar-actions .mr-btn {
            width: 100%;
          }
        }

        @media (max-width: 560px) {
          .ss-sidebar {
            padding: 12px !important;
          }

          .mr-page .mr-hero,
          .ss-main section {
            overflow: hidden;
          }
        }
      `}</style>
    </div>
  );
}