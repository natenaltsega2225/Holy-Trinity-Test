INSERT INTO `tbl_system_settings`
(`section`, `setting_key`, `setting_value`, `value_type`, `description`)
VALUES
-- =========================================================
-- GENERAL
-- =========================================================
('general', 'churchName', JSON_QUOTE('Holy Trinity EOTC'), 'string', 'Church display name'),
('general', 'systemName', JSON_QUOTE('Holy Trinity Admin Portal'), 'string', 'Admin system name'),
('general', 'supportEmail', JSON_QUOTE('support@holytrinityeotc.org'), 'string', 'Support email'),
('general', 'contactPhone', JSON_QUOTE('+1 (555) 555-5555'), 'string', 'Contact phone'),
('general', 'address', JSON_QUOTE('123 Church Street, Nashville, TN'), 'string', 'Church address'),
('general', 'timezone', JSON_QUOTE('America/Chicago'), 'string', 'Default timezone'),
('general', 'dateFormat', JSON_QUOTE('MM/DD/YYYY'), 'string', 'Date format'),
('general', 'language', JSON_QUOTE('English'), 'string', 'Default language'),

-- =========================================================
-- BRANDING
-- =========================================================
('branding', 'primaryColor', JSON_QUOTE('#2563eb'), 'string', 'Primary brand color'),
('branding', 'secondaryColor', JSON_QUOTE('#0f172a'), 'string', 'Secondary brand color'),
('branding', 'accentColor', JSON_QUOTE('#f59e0b'), 'string', 'Accent brand color'),
('branding', 'footerText', JSON_QUOTE('© Holy Trinity EOTC. All rights reserved.'), 'string', 'Footer text'),
('branding', 'loginWelcomeText', JSON_QUOTE('Welcome back to the Holy Trinity EOTC admin portal.'), 'string', 'Login page welcome text'),
('branding', 'showPublicBanner', CAST('true' AS JSON), 'boolean', 'Show public banner'),
('branding', 'publicBannerText', JSON_QUOTE('Serving faith, family, and community with excellence.'), 'string', 'Public banner text'),
('branding', 'logoUrl', JSON_QUOTE('/src\assets\images\church logo.jpeg'), 'string', 'Logo path or URL'),
('branding', 'faviconUrl', JSON_QUOTE('/favicon.ico'), 'string', 'Favicon path or URL'),

-- =========================================================
-- ACCESS
-- =========================================================
('access', 'allowSelfRegistration', CAST('true' AS JSON), 'boolean', 'Allow self registration'),
('access', 'requireEmailVerification', CAST('false' AS JSON), 'boolean', 'Require email verification'),
('access', 'defaultRole', JSON_QUOTE('member'), 'string', 'Default role'),
('access', 'forceStrongPassword', CAST('true' AS JSON), 'boolean', 'Force strong password'),
('access', 'passwordMinLength', CAST('12' AS JSON), 'number', 'Minimum password length'),
('access', 'sessionTimeoutMinutes', CAST('30' AS JSON), 'number', 'Session timeout minutes'),
('access', 'enableMfaForAdmins', CAST('false' AS JSON), 'boolean', 'Enable MFA for admins'),
('access', 'maxLoginAttempts', CAST('5' AS JSON), 'number', 'Max login attempts'),
('access', 'allowFinanceRoleCreation', CAST('true' AS JSON), 'boolean', 'Allow finance role creation'),
('access', 'allowAdminRoleCreation', CAST('true' AS JSON), 'boolean', 'Allow admin role creation'),

-- =========================================================
-- MEMBERSHIP
-- =========================================================
('membership', 'registrationFee', CAST('50' AS JSON), 'number', 'Registration fee'),
('membership', 'monthlyDefault', CAST('50' AS JSON), 'number', 'Default monthly fee'),
('membership', 'approvalWorkflow', JSON_QUOTE('manual'), 'string', 'Approval workflow'),
('membership', 'allowDependents', CAST('true' AS JSON), 'boolean', 'Allow dependents'),
('membership', 'memberIdPrefix', JSON_QUOTE('M-'), 'string', 'Member ID prefix'),
('membership', 'gracePeriodDays', CAST('7' AS JSON), 'number', 'Grace period days'),
('membership', 'renewalReminderDays', CAST('14' AS JSON), 'number', 'Renewal reminder days'),
('membership', 'customHigherAmountAllowed', CAST('true' AS JSON), 'boolean', 'Allow custom higher amount'),
('membership', 'planMode', JSON_QUOTE('settings_driven'), 'string', 'How membership payment page should determine default amounts'),

-- =========================================================
-- FINANCE
-- =========================================================
('finance', 'currency', JSON_QUOTE('USD'), 'string', 'Currency'),
('finance', 'enableCardPayments', CAST('true' AS JSON), 'boolean', 'Enable card payments'),
('finance', 'enableApplePay', CAST('true' AS JSON), 'boolean', 'Enable Apple Pay'),
('finance', 'enableAch', CAST('false' AS JSON), 'boolean', 'Enable ACH'),
('finance', 'coverProcessingFeeDefault', CAST('false' AS JSON), 'boolean', 'Cover fee default'),
('finance', 'receiptPrefix', JSON_QUOTE('RCT-'), 'string', 'Receipt prefix'),
('finance', 'invoicePrefix', JSON_QUOTE('INV-'), 'string', 'Invoice prefix'),
('finance', 'lateFeeEnabled', CAST('false' AS JSON), 'boolean', 'Enable late fee'),
('finance', 'lateFeeAmount', CAST('0' AS JSON), 'number', 'Late fee amount'),
('finance', 'autoGenerateReceipts', CAST('true' AS JSON), 'boolean', 'Auto generate receipts'),

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
('notifications', 'senderName', JSON_QUOTE('Holy Trinity EOTC'), 'string', 'Sender name'),
('notifications', 'senderEmail', JSON_QUOTE('noreply@holytrinityeotc.org'), 'string', 'Sender email'),
('notifications', 'replyToEmail', JSON_QUOTE('admin@holytrinityeotc.org'), 'string', 'Reply-to email'),
('notifications', 'sendWelcomeEmail', CAST('true' AS JSON), 'boolean', 'Send welcome email'),
('notifications', 'sendPaymentReceiptEmail', CAST('true' AS JSON), 'boolean', 'Send payment receipt email'),
('notifications', 'sendAdminAlerts', CAST('true' AS JSON), 'boolean', 'Send admin alerts'),
('notifications', 'newMemberAlertEmail', JSON_QUOTE('admin@holytrinityeotc.org'), 'string', 'New member alert email'),
('notifications', 'backupAlertEmail', JSON_QUOTE('tech@holytrinityeotc.org'), 'string', 'Backup alert email'),

-- =========================================================
-- INTEGRATIONS
-- =========================================================
('integrations', 'stripeEnabled', CAST('true' AS JSON), 'boolean', 'Enable Stripe'),
('integrations', 'stripePublishableKey', JSON_QUOTE('pk_live_************************'), 'string', 'Stripe publishable key'),
('integrations', 'stripeSecretKeyStatus', JSON_QUOTE('Configured'), 'string', 'Stripe secret key status'),
('integrations', 'googleMapsEnabled', CAST('true' AS JSON), 'boolean', 'Enable Google Maps'),
('integrations', 'googleCalendarEnabled', CAST('false' AS JSON), 'boolean', 'Enable Google Calendar'),
('integrations', 'smtpStatus', JSON_QUOTE('Connected'), 'string', 'SMTP status'),
('integrations', 'webhookStatus', JSON_QUOTE('Healthy'), 'string', 'Webhook status'),

-- =========================================================
-- MAINTENANCE
-- =========================================================
('maintenance', 'maintenanceMode', CAST('false' AS JSON), 'boolean', 'Enable maintenance mode'),
('maintenance', 'maintenanceMessage', JSON_QUOTE('We are performing scheduled maintenance. Please check back soon.'), 'string', 'Maintenance message'),
('maintenance', 'autoBackupEnabled', CAST('true' AS JSON), 'boolean', 'Automatic backups'),
('maintenance', 'backupFrequency', JSON_QUOTE('daily'), 'string', 'Backup frequency'),
('maintenance', 'backupRetentionDays', CAST('30' AS JSON), 'number', 'Backup retention'),
('maintenance', 'allowRestore', CAST('false' AS JSON), 'boolean', 'Allow restore'),
('maintenance', 'clearCacheOnDeploy', CAST('true' AS JSON), 'boolean', 'Clear cache on deploy')

ON DUPLICATE KEY UPDATE
  `setting_value` = VALUES(`setting_value`),
  `value_type` = VALUES(`value_type`),
  `description` = VALUES(`description`);

  