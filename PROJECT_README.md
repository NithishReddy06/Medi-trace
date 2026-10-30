# MediTrace — Project Overview

This document is a project-focused overview of the problem MediTrace addresses,
the end-to-end workflow, and the work implemented so far. For installation
commands and the detailed API route list, see the repository [README](./README.md).

## Problem statement

Prescription review requires checking the written order against the patient's
identity, medication history, allergies, prior reactions, and possible
medicine-to-medicine interactions. When these details are recorded in separate
places, a reviewer can miss important context, and manual transcription of a
prescription image can introduce errors.

MediTrace is a database-backed coursework prototype for organizing this review.
It provides a traceable place to capture prescription information, preserve
the source image and OCR text, compare medicines with a patient's recorded
safety profile, and record a human review decision. The system is intended to
support—not replace—a pharmacist's judgement. OCR and rule-based alerts are
advisory and do not establish that a prescription is safe.

## Project goals

- Keep patient, medicine, prescription, and review information in a
  relational database with defined relationships and constraints.
- Reduce repeated manual entry by extracting candidate information from
  prescription images.
- Bring allergy, reaction-history, cross-reactivity, and interaction context
  into the pharmacist's review.
- Protect patient information with authenticated, role-checked API access.
- Keep important data changes and review decisions auditable.
- Keep the source and extracted text visible so a person can verify the
  machine-assisted result.

## End-to-end workflow

1. **Start and configure the system.** PostgreSQL stores application and
   reference data. The React frontend communicates with the Express API, which
   accesses PostgreSQL through Prisma.
2. **Sign in or register.** A user signs in to receive a time-limited JWT.
   Public registration creates patient accounts only; privileged roles are
   provisioned separately. Passwords are stored as bcrypt hashes.
3. **Maintain a patient safety profile.** A patient can maintain their own
   profile, self-reported allergies, and past medicine reactions. Patient
   routes derive the patient identity from the authenticated token, and
   pharmacist-verified records cannot be edited or removed by the patient.
4. **The prescriber writes the order; the pharmacist records it.** In a
   real-world workflow, the doctor or other authorized prescriber creates and
   signs the prescription. In the current MediTrace prototype, the pharmacist
   searches for the patient, reviews their safety profile, selects the
   prescriber, and enters the existing order and its medicine details for
   review. MediTrace does not let a pharmacist act as the prescriber.
5. **Upload and read the source image.** A JPG or PNG prescription image is
   validated and passed through Tesseract OCR. Rule-based extraction proposes
   fields such as patient and doctor names, date, medicine, dosage, frequency,
   duration, and quantity. The original image path and OCR result can be
   associated with the prescription.
6. **Check for safety findings.** The pharmacist can run the database-backed
   `safety-rules-v1` checks. They compare the prescription with allergy drug
   classes, configured cross-reactivity data, recorded reaction history, and
   medicine interaction reference data. Findings are saved as safety alerts
   with severity, source basis, and review messages.
7. **Review and record a decision.** The pharmacist reviews the original
   prescription, extracted fields, patient context, and alerts. Open alerts
   must be addressed or the prescription escalated before approval/final
   review. The database `review_prescription(...)` procedure records the
   status, reviewer, timestamp, notes, and audit event. The automated checks
   do not make the final decision.
8. **Follow the prescription as a patient.** A patient can view only their
   own prescription and medication history, along with their safety profile.

## Pharmacist module workflow

The pharmacist module guides a signed-in pharmacist through a patient-centered
review:

1. **Search for a patient.** Enter at least two characters of the patient's
   name or email, then select the matching patient record.
2. **Review the safety profile.** Check the patient's allergies, their
   severity and verification status, and any recorded medicine reactions.
   Opening the profile is recorded as an audit event.
3. **Record the prescriber's order.** The doctor or other authorized
   prescriber writes and signs the prescription. In the current prototype, the
   pharmacist chooses that prescriber and enters the existing order and issue
   date, then adds each medicine with its dose, unit, frequency, route,
   duration, quantity, and instructions. The prescription record and medicine
   items are saved together; this data-entry step does not make the pharmacist
   the prescriber.
4. **Attach the source prescription.** Upload a JPG or PNG image (up to 5 MB).
   The server validates the image, stores it, runs Tesseract OCR, and saves the
   extracted text. Review the OCR output against the source and the
   prescription details entered in the system; extraction is not treated as
   authoritative.
5. **Run safety rules.** From the pharmacist workspace, run checks for direct
   allergy matches, configured cross-reactivity, recorded reactions to a
   medicine, and interactions between prescribed medicines. Matching results
   are stored as alerts with severity and source information, and the review is
   audit logged.
6. **Assess each alert.** Review the finding in the context of the source
   prescription and patient profile. Mark an alert addressed when it has been
   assessed, or escalate the prescription when further review is needed.
   Automated findings do not make clinical decisions.
7. **Save the pharmacist's decision.** Select the applicable outcome
   (approved, rejected, escalated, or finalized) and add review notes. Open
   alerts must be addressed before approval/finalization or the prescription
   must be escalated. The database procedure records the reviewer, decision,
   timestamp, notes, and audit event.
8. **Patient follow-up.** The patient's own workspace displays their
   prescription status, medicine information, pharmacist notes, and
   patient-facing safety messages when available.

### Worked example: allergy alert during prescription review

This is a fictional demonstration based on the local seed data, not a real
patient record or a treatment recommendation.

1. The pharmacist signs in and searches for **Liam Bennett**.
2. The profile shows a recorded **Penicillin-class allergy**.
3. A prescriber writes Liam's order for **Amoxicillin**. In the prototype, the
   pharmacist records that existing order in MediTrace and checks its details
   against the source prescription.
4. The pharmacist runs the safety rules. Because the medicine is in the
   allergy class recorded on the profile, MediTrace saves a **direct allergy**
   alert and displays it for review.
5. The pharmacist assesses the alert and source information. The alert itself
   does not decide whether to dispense: the pharmacist records the appropriate
   outcome, or escalates the prescription for further review, with notes.
6. The final status and patient-facing message can then be seen in the
   patient's own prescription workspace.

This example demonstrates how patient history becomes a reviewable,
auditable signal while leaving the clinical decision with the pharmacist.

## Work completed so far

### Frontend

- React and Vite application with a product landing page and prescription
  review presentation.
- Sign-in and patient registration screens.
- Role-aware navigation and protected patient and pharmacist workspaces.
- Patient profile, allergy, reaction-history, and prescription views.
- Pharmacist patient search, safety-profile review, prescription creation,
  image/OCR review, safety-alert handling, and final review interactions.
- OCR results are presented as candidate data with missing-field warnings and
  explicit human-verification messaging.
- Pharmacist-only logistic-regression risk assessment trained on a labeled,
  generated coursework dataset, with score, level, reasons, model version, and
  saved assessment date shown in the prescription review panel.

### Backend

- Express API with health check, authentication, registration, and session
  identity endpoints.
- Bcrypt password verification and hashing; JWT access tokens with an
  expiration; middleware for identity and role checks.
- Patient APIs for profile, allergy and reaction-history management,
  medicines, and patient-owned prescriptions.
- Pharmacist APIs for patient search and profile review, medicine/prescriber
  lookup, prescription creation, safety checks, alert resolution, and final
  prescription review.
- JPG/PNG upload validation, Tesseract OCR, and rule-based prescription-field
  extraction with warnings for incomplete data.
- Security headers, request logging, input validation, and audit events for
  important patient and pharmacist actions.

### Database

- PostgreSQL schema with 13 related tables covering users, drug classes,
  medicines, prescriptions and items, OCR results, allergies, reaction
  history, drug interactions, cross-reactivity, risk assessments, safety
  alerts, and audit logs.
- Foreign keys, uniqueness and check constraints, indexes, and timestamps to
  enforce data integrity and support common lookups.
- Seed data for local coursework demonstrations.
- `v_patient_medication_history` and `v_flagged_prescriptions` views.
- `set_updated_at()` triggers and the `review_prescription(...)` stored
  procedure.
- Prisma schema/client for backend database access.

### Development and operations support

- Docker Compose configuration for PostgreSQL, with schema and seed scripts
  mounted for first-time database initialization.
- Prometheus and Grafana provisioning/configuration files are present in
  `monitoring/`.
- Setup, API details, and demo-account instructions are documented in the
  repository [README](./README.md).

## Current limitations and next work

- OCR and field extraction are implemented, but OCR can be inaccurate and
  still requires a person to verify every field.
- Safety checks are deterministic rules over configured reference data; they
  are not a clinical decision engine.
- Fraud-risk scoring uses a logistic-regression model trained on the generated
  `backend/ml/synthetic_training_data.csv` dataset. The dataset, labels,
  coefficients, and displayed reasons are synthetic and are not validated for
  real fraud detection or clinical use. Rebuild the reproducible model with
  `cd backend && npm run ml:train`. The holdout metrics describe only this
  generated dataset and should not be read as real-world model performance.
- Monitoring configuration exists, but a complete live application metrics
  and dashboard workflow still needs implementation and validation.
- The application is a coursework prototype and has not been established as
  suitable for real patient care or production deployment.

## Technology summary

| Layer | Technology |
| --- | --- |
| User interface | React, Vite |
| API | Node.js, Express |
| Database | PostgreSQL |
| Data access | Prisma |
| Image text extraction | Tesseract.js |
| Authentication | bcrypt, JSON Web Tokens |
| Local database runtime | Docker Compose |
| Monitoring configuration | Prometheus, Grafana |
