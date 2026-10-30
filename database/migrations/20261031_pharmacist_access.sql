BEGIN;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS pharmacist_license_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pharmacist_organization VARCHAR(200),
  ADD COLUMN IF NOT EXISTS pharmacist_application_status VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_pharmacist_license_number_key
  ON app_users (pharmacist_license_number);

CREATE INDEX IF NOT EXISTS app_users_pharmacist_applications_idx
  ON app_users (role, pharmacist_application_status, created_at DESC);

UPDATE app_users
SET is_active = FALSE
WHERE email IN (
  'olivia.carter@example.test',
  'liam.bennett@example.test',
  'ava.mitchell@example.test',
  'noah.pharmacist@example.test',
  'mia.admin@example.test'
);

COMMIT;
