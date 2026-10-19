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
- Seed data is fictional and uses a local demo password only
- Bcrypt password verification, time-limited JWT sessions, and backend role
  checks for patient, pharmacist, doctor, admin, and auditor accounts
- Patient module: profile maintenance, patient-owned allergy and reaction
  history CRUD, patient-only prescription visibility, and audit-log entries
  for every patient data change
- Pharmacist module: patient search, patient safety-profile review, and
  database-backed rule checks for direct allergies, cross-reactivity, prior
  medicine reactions, and drug interactions

## Demo sign-in

All seeded coursework users use the password `DemoPass123!`. For the
pharmacist review workflow, sign in as `noah.pharmacist@example.test`; for the
patient workspace, sign in as `liam.bennett@example.test`.
These credentials are fictional and must never be used outside this local
coursework prototype.

## Current implementation status

The OCR upload and extraction flow works. Authentication, role-based access,
the patient module, and the pharmacist safety-review module are complete.
ML scoring, prescription creation/review completion, and live monitoring
dashboards remain to be built.

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

The `safety-rules-v1` check compares prescription items with the patient's
allergy class, reference cross-reactivity records, previous reactions, and
medicine-pair interactions. It only creates review alerts; it never approves
or rejects a prescription. The seeded Liam Bennett example includes a
Penicillin-class allergy and an Amoxicillin prescription, which demonstrates a
direct-allergy alert.
