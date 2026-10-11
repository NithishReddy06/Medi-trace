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

## Current implementation status

The OCR upload and extraction flow works. Authentication, role-based modules,
patient management, safety-rule execution, ML scoring, and dashboards are the
next implementation stages.
