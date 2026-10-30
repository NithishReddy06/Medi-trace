# MediTrace

MediTrace is a DBMS project for prescription review, medication-safety alerts,
and suspicious-prescription risk assessment. It is a coursework prototype, not
clinical decision software; a pharmacist always makes the final decision.

## Stack

- React + Vite frontend
- Node.js + Express backend
- PostgreSQL 16 database
- Prisma ORM for application CRUD
- Tesseract OCR for prescription-image text extraction
- Prometheus + Grafana monitoring configuration

## Database setup

The PostgreSQL schema and Prisma ORM schema are aligned around the same tables.
The database contains users, medicines, prescriptions, OCR results, allergies,
reaction history, interaction reference data, risk assessments, safety alerts,
and audit events.

1. Start PostgreSQL from `database/`:

   ```bash
   docker compose up -d
   ```

   On a new Docker volume, this automatically runs `schema.sql` and
   `seed_demo.sql`.

2. Configure the backend:

   ```bash
   cd backend
   copy .env.example .env
   npm install
   npx prisma generate
   npx prisma db push
   npm run dev
   ```

   Set `JWT_SECRET` in `backend/.env` to a long, unique local secret before
   starting the backend. The server intentionally refuses to start with the
   placeholder value from `.env.example`.

3. Start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Test the database connection at `http://localhost:5000/api/db-test`.

## Important coursework features

- 13 related database tables, foreign keys, constraints, 3NF design, and indexes
- Views: `v_patient_medication_history` and `v_flagged_prescriptions`
- Trigger: automatically updates modified timestamps
- Stored procedure: `review_prescription(...)`
- Seed data is fictional; seeded accounts receive random, undisclosed passwords
- Bcrypt password verification, time-limited JWT sessions, and backend role
  checks for patient, pharmacist, doctor, admin, and auditor accounts
- Public patient registration with password hashing, duplicate-email handling,
  automatic sign-in, and an audit record
- Pharmacists can submit license and organization details for review; access
  remains disabled until an administrator verifies and approves the request
- Patient module: profile maintenance, patient-owned allergy and reaction
  history CRUD, patient-only prescription visibility, and audit-log entries
  for every patient data change
- Pharmacist module: patient search, patient safety-profile review, and
  database-backed rule checks for direct allergies, cross-reactivity, prior
  medicine reactions, and drug interactions
- Synthetic coursework ML baseline: trained logistic regression returns a
  0–100 advisory risk score, level, reasons, model version, and assessment time
- End-to-end prescription workflow: pharmacist-created prescription items,
  attached source image with stored OCR output, persistent safety alerts, and
  final pharmacist decisions through the `review_prescription(...)` procedure

## Account registration and access

The sign-in page offers patient registration and pharmacist access requests.
Patients can create an account with their name, date of birth, optional phone,
email, and an 8+ character password. `POST /api/auth/register` always creates
the `patient` role. Pharmacists submit a license number and organization;
their account remains inactive until an administrator verifies the license
and approves it in the Admin workspace. Doctor accounts remain provisioned.

Create the first administrator using the one-time setup values in
`backend/.env` (`ADMIN_EMAIL`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`, and a
unique `ADMIN_PASSWORD` of at least 12 characters), then run
`npm run admin:create` from `backend/`. Remove `ADMIN_PASSWORD` from `.env`
after setup. Seeded coursework accounts no longer have a shared demo password.

## Current implementation status

The OCR upload and extraction flow works. Authentication, role-based access,
the patient module, the pharmacist prescription workflow, and synthetic ML
scoring are implemented. Live monitoring dashboards remain to be built.

## Patient API routes

All routes below require a valid patient JWT. The server derives the patient
identity from that token, so a patient cannot request another patient's data.

- `GET` / `PATCH` `/api/patient/profile`
- `GET` / `POST` `/api/patient/allergies`
- `PATCH` / `DELETE` `/api/patient/allergies/:allergyId`
- `GET` / `POST` `/api/patient/reactions`
- `PATCH` / `DELETE` `/api/patient/reactions/:reactionId`
- `GET` `/api/patient/prescriptions`
- `GET` `/api/patient/medicines`

Patients can change only self-reported allergy and reaction entries. A
pharmacist-verified entry is intentionally protected from patient edits and
deletion, preserving the review trail.

## Pharmacist safety workflow

All pharmacist routes require a pharmacist or administrator JWT. Opening a
patient safety profile writes a `VIEW` audit event; running the checks writes a
`REVIEW` audit event and persists matching records in `safety_alerts`.

- `GET` `/api/pharmacist/patients?query=liam`
- `GET` `/api/pharmacist/patients/:patientId/safety-profile`
- `POST` `/api/pharmacist/prescriptions/:prescriptionId/safety-check`
- `POST` `/api/pharmacist/prescriptions/:prescriptionId/fraud-risk`

The `safety-rules-v1` check compares prescription items with the patient's
allergy class, reference cross-reactivity records, previous reactions, and
medicine-pair interactions. It only creates review alerts; it never approves
or rejects a prescription. The seeded Liam Bennett example includes a
Penicillin-class allergy and an Amoxicillin prescription, which demonstrates a
direct-allergy alert.

The separate fraud-risk assessment is a logistic-regression coursework model
trained on the generated labeled dataset in `backend/ml/`. It considers
quantity, recent repeat prescriptions, configured medicine-category labels,
and earlier rejected or escalated records. Its saved assessment includes a
0–100 score, Low/Medium/High level, reasons, model version, and timestamp. The
training data and evaluation are synthetic; the model is advisory and a
pharmacist always makes the final decision. Rebuild the model with
`cd backend && npm run ml:train`.

## Prescription creation and final review

From the pharmacist workspace, search for and select a patient, then use
**Create prescription**. The workflow validates medicine details and writes
the prescription plus all medicine items in one transaction.

- `GET` `/api/pharmacist/prescribers`
- `GET` `/api/pharmacist/medicines`
- `POST` `/api/pharmacist/prescriptions`
- `PATCH` `/api/pharmacist/alerts/:alertId/resolve`
- `POST` `/api/pharmacist/prescriptions/:prescriptionId/review`

The upload endpoint now records the original image path on `prescriptions` and
the extraction in `ocr_results`. Before approving or finalizing, every open
safety alert must be marked addressed or the prescription must be escalated.
The final endpoint calls PostgreSQL's `review_prescription(...)` procedure,
which saves the status, pharmacist notes, reviewer, timestamp, and audit log.
