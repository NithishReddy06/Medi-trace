-- MediTrace - PostgreSQL 15+ schema

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- One authentication table for all roles.
CREATE TABLE app_users (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE CHECK (email = LOWER(email)),
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','pharmacist','doctor','patient','auditor')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  date_of_birth DATE,
  doctor_license_number VARCHAR(100) UNIQUE,
  specialization VARCHAR(150),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT patient_profile_check CHECK ((role = 'patient' AND date_of_birth IS NOT NULL) OR (role <> 'patient' AND date_of_birth IS NULL)),
  CONSTRAINT doctor_profile_check CHECK ((role = 'doctor' AND doctor_license_number IS NOT NULL AND specialization IS NOT NULL) OR (role <> 'doctor' AND doctor_license_number IS NULL AND specialization IS NULL))
);

CREATE TABLE drug_classes (
  class_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_name VARCHAR(150) NOT NULL UNIQUE CHECK (BTRIM(class_name) <> ''),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE medicines (
  medicine_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  medicine_name VARCHAR(200) NOT NULL,
  generic_name VARCHAR(200) NOT NULL,
  strength VARCHAR(100) NOT NULL,
  dosage_form VARCHAR(100) NOT NULL,
  route VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(200) NOT NULL,
  class_id BIGINT REFERENCES drug_classes(class_id) ON DELETE RESTRICT,
  external_code VARCHAR(100) UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT medicines_identity_unique UNIQUE (generic_name, strength, dosage_form, route, manufacturer)
);

CREATE TABLE prescriptions (
  prescription_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prescription_number UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  patient_user_id BIGINT NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
  prescriber_user_id BIGINT NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
  uploaded_by_user_id BIGINT NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
  issue_date DATE NOT NULL,
  image_path TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','under_review','approved','rejected','escalated','finalized')),
  pharmacist_notes TEXT,
  reviewed_by_user_id BIGINT REFERENCES app_users(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT review_fields_check CHECK ((reviewed_by_user_id IS NULL AND reviewed_at IS NULL) OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE prescription_items (
  prescription_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prescription_id BIGINT NOT NULL REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
  medicine_id BIGINT NOT NULL REFERENCES medicines(medicine_id) ON DELETE RESTRICT,
  dose_amount NUMERIC(10,2) NOT NULL CHECK (dose_amount > 0),
  dose_unit VARCHAR(50) NOT NULL,
  frequency VARCHAR(100) NOT NULL,
  route VARCHAR(100) NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  instructions TEXT,
  CONSTRAINT prescription_items_unique_medicine UNIQUE (prescription_id, medicine_id)
);

CREATE TABLE ocr_results (
  ocr_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prescription_id BIGINT NOT NULL REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
  extracted_text TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  engine_name VARCHAR(100) NOT NULL DEFAULT 'Tesseract',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patient_allergies (
  allergy_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_user_id BIGINT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  allergen_name VARCHAR(200) NOT NULL,
  allergen_class_id BIGINT REFERENCES drug_classes(class_id) ON DELETE SET NULL,
  reaction_description TEXT,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('mild','moderate','severe','unknown')),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'self_reported' CHECK (verification_status IN ('self_reported','pharmacist_verified')),
  reported_by_user_id BIGINT NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
  verified_by_user_id BIGINT REFERENCES app_users(user_id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMPTZ,
  CONSTRAINT allergy_verification_check CHECK ((verification_status = 'self_reported' AND verified_by_user_id IS NULL AND verified_at IS NULL) OR (verification_status = 'pharmacist_verified' AND verified_by_user_id IS NOT NULL AND verified_at IS NOT NULL)),
  CONSTRAINT patient_allergies_unique_allergen UNIQUE (patient_user_id, allergen_name)
);

CREATE TABLE reaction_history (
  reaction_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_user_id BIGINT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  medicine_id BIGINT NOT NULL REFERENCES medicines(medicine_id) ON DELETE RESTRICT,
  reaction_description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('mild','moderate','severe','life_threatening','unknown')),
  reaction_date DATE NOT NULL,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'self_reported' CHECK (verification_status IN ('self_reported','pharmacist_verified')),
  reported_by_user_id BIGINT NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
  verified_by_user_id BIGINT REFERENCES app_users(user_id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMPTZ,
  CONSTRAINT reaction_verification_check CHECK ((verification_status = 'self_reported' AND verified_by_user_id IS NULL AND verified_at IS NULL) OR (verification_status = 'pharmacist_verified' AND verified_by_user_id IS NOT NULL AND verified_at IS NOT NULL)),
  CONSTRAINT reaction_history_unique_entry UNIQUE (patient_user_id, medicine_id, reaction_date, reaction_description)
);

CREATE TABLE drug_interactions (
  interaction_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  medicine_id_1 BIGINT NOT NULL REFERENCES medicines(medicine_id) ON DELETE CASCADE,
  medicine_id_2 BIGINT NOT NULL REFERENCES medicines(medicine_id) ON DELETE CASCADE,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('minor','moderate','major','contraindicated')),
  description TEXT NOT NULL,
  reference_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT interaction_distinct_medicines CHECK (medicine_id_1 < medicine_id_2),
  CONSTRAINT drug_interactions_unique_pair UNIQUE (medicine_id_1, medicine_id_2)
);

CREATE TABLE cross_reactivity (
  cross_reactivity_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_class_id BIGINT NOT NULL REFERENCES drug_classes(class_id) ON DELETE CASCADE,
  related_class_id BIGINT NOT NULL REFERENCES drug_classes(class_id) ON DELETE CASCADE,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('mild','moderate','severe')),
  note TEXT NOT NULL,
  reference_source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cross_reactivity_distinct_classes CHECK (source_class_id <> related_class_id),
  CONSTRAINT cross_reactivity_unique_pair UNIQUE (source_class_id, related_class_id)
);

CREATE TABLE fraud_risk_assessments (
  assessment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prescription_id BIGINT NOT NULL REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
  assessed_by_user_id BIGINT REFERENCES app_users(user_id) ON DELETE SET NULL,
  risk_score NUMERIC(5,2) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low','medium','high')),
  model_version VARCHAR(100) NOT NULL,
  explanation TEXT,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fraud_risk_unique_model_run UNIQUE (prescription_id, model_version)
);

CREATE TABLE safety_alerts (
  alert_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prescription_id BIGINT NOT NULL REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
  prescription_item_id BIGINT NOT NULL REFERENCES prescription_items(prescription_item_id) ON DELETE CASCADE,
  alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('drug_interaction','direct_allergy','cross_reactivity','reaction_history','repeat_exposure','dosage','duplicate')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low','moderate','high','critical')),
  source_basis VARCHAR(30) NOT NULL CHECK (source_basis IN ('self_reported','pharmacist_verified','reference_data')),
  message TEXT NOT NULL,
  patient_message TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by_user_id BIGINT REFERENCES app_users(user_id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT alert_resolution_check CHECK ((is_resolved = FALSE AND resolved_by_user_id IS NULL AND resolved_at IS NULL) OR (is_resolved = TRUE AND resolved_by_user_id IS NOT NULL AND resolved_at IS NOT NULL)),
  CONSTRAINT safety_alerts_unique_match UNIQUE (prescription_id, prescription_item_id, alert_type, source_basis)
);

CREATE TABLE audit_logs (
  audit_log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES app_users(user_id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE','VIEW','REVIEW')),
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT,
  event_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX medicines_class_idx ON medicines(class_id);
CREATE INDEX prescriptions_patient_issue_date_idx ON prescriptions(patient_user_id, issue_date DESC);
CREATE INDEX prescriptions_status_idx ON prescriptions(status);
CREATE INDEX prescription_items_medicine_idx ON prescription_items(medicine_id);
CREATE INDEX patient_allergies_patient_idx ON patient_allergies(patient_user_id);
CREATE INDEX reaction_history_patient_idx ON reaction_history(patient_user_id);
CREATE INDEX fraud_assessments_latest_idx ON fraud_risk_assessments(prescription_id, assessed_at DESC);
CREATE INDEX safety_alerts_open_idx ON safety_alerts(prescription_id, severity) WHERE NOT is_resolved;
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := CURRENT_TIMESTAMP; RETURN NEW; END; $$;
CREATE TRIGGER app_users_set_updated_at BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER prescriptions_set_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Required stored procedure: the final prescription decision remains with an
-- authenticated pharmacist or administrator, never an OCR/ML result.
CREATE OR REPLACE PROCEDURE review_prescription(
  p_prescription_id BIGINT,
  p_reviewer_user_id BIGINT,
  p_status VARCHAR(20),
  p_notes TEXT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE reviewer_role VARCHAR(20);
BEGIN
  SELECT role INTO reviewer_role
  FROM app_users
  WHERE user_id = p_reviewer_user_id AND is_active;

  IF reviewer_role NOT IN ('pharmacist', 'admin') THEN
    RAISE EXCEPTION 'Only an active pharmacist or admin can review a prescription';
  END IF;
  IF p_status NOT IN ('approved', 'rejected', 'escalated', 'finalized') THEN
    RAISE EXCEPTION 'Invalid review status: %', p_status;
  END IF;

  UPDATE prescriptions
  SET status = p_status,
      pharmacist_notes = COALESCE(p_notes, pharmacist_notes),
      reviewed_by_user_id = p_reviewer_user_id,
      reviewed_at = CURRENT_TIMESTAMP
  WHERE prescription_id = p_prescription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prescription % does not exist', p_prescription_id;
  END IF;

  INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, event_data)
  VALUES (p_reviewer_user_id, 'REVIEW', 'prescriptions', p_prescription_id,
          jsonb_build_object('status', p_status, 'notes_supplied', p_notes IS NOT NULL));
END;
$$;

CREATE OR REPLACE VIEW v_patient_medication_history AS
SELECT p.patient_user_id, p.prescription_id, p.issue_date, p.status, m.generic_name,
       m.medicine_name, pi.dose_amount, pi.dose_unit, pi.frequency, pi.duration_days
FROM prescriptions p JOIN prescription_items pi ON pi.prescription_id = p.prescription_id
JOIN medicines m ON m.medicine_id = pi.medicine_id;

CREATE OR REPLACE VIEW v_flagged_prescriptions AS
SELECT DISTINCT ON (p.prescription_id) p.prescription_id, p.prescription_number,
       p.issue_date, p.status, f.risk_score, f.risk_level, f.assessed_at
FROM prescriptions p JOIN fraud_risk_assessments f ON f.prescription_id = p.prescription_id
WHERE f.risk_level IN ('medium','high') ORDER BY p.prescription_id, f.assessed_at DESC;
COMMIT;
