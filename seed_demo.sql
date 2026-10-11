-- Fictional demonstration data. Run after schema.sql.
BEGIN;
INSERT INTO app_users (email, password_hash, role, first_name, last_name, phone, date_of_birth, doctor_license_number, specialization)
VALUES
  ('olivia.carter@example.test', crypt('DemoPass123!', gen_salt('bf', 12)), 'doctor', 'Olivia', 'Carter', '+1-555-0100', NULL, 'DEMO-MED-1001', 'General Medicine'),
  ('liam.bennett@example.test', crypt('DemoPass123!', gen_salt('bf', 12)), 'patient', 'Liam', 'Bennett', '+1-555-0101', DATE '1988-04-12', NULL, NULL),
  ('ava.mitchell@example.test', crypt('DemoPass123!', gen_salt('bf', 12)), 'patient', 'Ava', 'Mitchell', '+1-555-0102', DATE '1995-09-23', NULL, NULL),
  ('noah.pharmacist@example.test', crypt('DemoPass123!', gen_salt('bf', 12)), 'pharmacist', 'Noah', 'Davis', '+1-555-0103', NULL, NULL, NULL),
  ('mia.admin@example.test', crypt('DemoPass123!', gen_salt('bf', 12)), 'admin', 'Mia', 'Admin', '+1-555-0104', NULL, NULL, NULL)
ON CONFLICT (email) DO NOTHING;

INSERT INTO drug_classes (class_name, description) VALUES
  ('Penicillins', 'Beta-lactam antibiotics in the penicillin family'),
  ('Statins', 'HMG-CoA reductase inhibitors'),
  ('Antihistamines', 'Histamine H1 receptor antagonists'),
  ('Macrolides', 'Macrolide antibiotics')
ON CONFLICT (class_name) DO NOTHING;

INSERT INTO medicines (medicine_name, generic_name, strength, dosage_form, route, manufacturer, class_id, external_code)
SELECT d.medicine_name, d.generic_name, d.strength, d.dosage_form, d.route, d.manufacturer, c.class_id, d.external_code
FROM (VALUES
  ('Amoxil', 'Amoxicillin', '500 mg', 'Capsule', 'Oral', 'Demo Pharmaceuticals', 'Penicillins', 'DEMO-AMOX-500'),
  ('Lipitor', 'Atorvastatin', '20 mg', 'Tablet', 'Oral', 'Demo Pharmaceuticals', 'Statins', 'DEMO-ATOR-020'),
  ('Zyrtec', 'Cetirizine', '10 mg', 'Tablet', 'Oral', 'Demo Pharmaceuticals', 'Antihistamines', 'DEMO-CETI-010'),
  ('Biaxin', 'Clarithromycin', '500 mg', 'Tablet', 'Oral', 'Demo Pharmaceuticals', 'Macrolides', 'DEMO-CLAR-500')
) AS d(medicine_name, generic_name, strength, dosage_form, route, manufacturer, class_name, external_code)
JOIN drug_classes c ON c.class_name = d.class_name
ON CONFLICT (external_code) DO NOTHING;

INSERT INTO drug_interactions (medicine_id_1, medicine_id_2, severity, description, reference_source)
SELECT LEAST(a.medicine_id, b.medicine_id), GREATEST(a.medicine_id, b.medicine_id), 'major',
       'Demonstration interaction: pharmacist review required.', 'Coursework demonstration dataset'
FROM medicines a JOIN medicines b ON b.external_code = 'DEMO-CLAR-500'
WHERE a.external_code = 'DEMO-ATOR-020'
ON CONFLICT (medicine_id_1, medicine_id_2) DO NOTHING;

INSERT INTO patient_allergies (patient_user_id, allergen_name, allergen_class_id, reaction_description, severity, reported_by_user_id)
SELECT p.user_id, 'Penicillin', c.class_id, 'Skin rash and itching', 'moderate', p.user_id
FROM app_users p JOIN drug_classes c ON c.class_name = 'Penicillins'
WHERE p.email = 'liam.bennett@example.test'
ON CONFLICT (patient_user_id, allergen_name) DO NOTHING;

INSERT INTO prescriptions (patient_user_id, prescriber_user_id, uploaded_by_user_id, issue_date, image_path, status)
SELECT patient.user_id, doctor.user_id, pharmacist.user_id, DATE '2026-10-10', 'demo/liam-bennett-2026-10-10.png', 'under_review'
FROM app_users patient CROSS JOIN app_users doctor CROSS JOIN app_users pharmacist
WHERE patient.email = 'liam.bennett@example.test' AND doctor.email = 'olivia.carter@example.test'
  AND pharmacist.email = 'noah.pharmacist@example.test'
  AND NOT EXISTS (SELECT 1 FROM prescriptions p WHERE p.patient_user_id = patient.user_id AND p.issue_date = DATE '2026-10-10');

INSERT INTO prescription_items (prescription_id, medicine_id, dose_amount, dose_unit, frequency, route, duration_days, quantity, instructions)
SELECT p.prescription_id, m.medicine_id, 500, 'mg', 'Three times daily', 'Oral', 5, 15, 'Take after food.'
FROM prescriptions p JOIN app_users patient ON patient.user_id = p.patient_user_id
JOIN medicines m ON m.external_code = 'DEMO-AMOX-500'
WHERE patient.email = 'liam.bennett@example.test' AND p.issue_date = DATE '2026-10-10'
ON CONFLICT (prescription_id, medicine_id) DO NOTHING;

INSERT INTO fraud_risk_assessments (prescription_id, assessed_by_user_id, risk_score, risk_level, model_version, explanation)
SELECT p.prescription_id, pharmacist.user_id, 18.50, 'low', 'demo-rules-v1', 'Demo assessment: readable OCR and valid prescriber registration.'
FROM prescriptions p JOIN app_users patient ON patient.user_id = p.patient_user_id
JOIN app_users pharmacist ON pharmacist.email = 'noah.pharmacist@example.test'
WHERE patient.email = 'liam.bennett@example.test' AND p.issue_date = DATE '2026-10-10'
ON CONFLICT (prescription_id, model_version) DO NOTHING;
COMMIT;
