# MediTrace ER Diagram

```mermaid
erDiagram
    APP_USERS {
        bigint user_id PK
        varchar email UK
        varchar role
        varchar first_name
        varchar last_name
        date date_of_birth
        varchar doctor_license_number UK
        boolean is_active
    }

    DRUG_CLASSES {
        bigint class_id PK
        varchar class_name UK
    }

    MEDICINES {
        bigint medicine_id PK
        bigint class_id FK
        varchar generic_name
        varchar strength
        varchar external_code UK
    }

    PRESCRIPTIONS {
        bigint prescription_id PK
        uuid prescription_number UK
        bigint patient_user_id FK
        bigint prescriber_user_id FK
        bigint uploaded_by_user_id FK
        bigint reviewed_by_user_id FK
        date issue_date
        varchar status
    }

    PRESCRIPTION_ITEMS {
        bigint prescription_item_id PK
        bigint prescription_id FK
        bigint medicine_id FK
        numeric dose_amount
        varchar frequency
        integer duration_days
    }

    OCR_RESULTS {
        bigint ocr_id PK
        bigint prescription_id FK
        numeric confidence
        varchar engine_name
    }

    PATIENT_ALLERGIES {
        bigint allergy_id PK
        bigint patient_user_id FK
        bigint allergen_class_id FK
        bigint reported_by_user_id FK
        bigint verified_by_user_id FK
        varchar allergen_name
        varchar severity
    }

    REACTION_HISTORY {
        bigint reaction_id PK
        bigint patient_user_id FK
        bigint medicine_id FK
        bigint reported_by_user_id FK
        bigint verified_by_user_id FK
        varchar severity
        date reaction_date
    }

    DRUG_INTERACTIONS {
        bigint interaction_id PK
        bigint medicine_id_1 FK
        bigint medicine_id_2 FK
        varchar severity
    }

    CROSS_REACTIVITY {
        bigint cross_reactivity_id PK
        bigint source_class_id FK
        bigint related_class_id FK
        varchar severity
    }

    FRAUD_RISK_ASSESSMENTS {
        bigint assessment_id PK
        bigint prescription_id FK
        bigint assessed_by_user_id FK
        numeric risk_score
        varchar risk_level
        varchar model_version
    }

    SAFETY_ALERTS {
        bigint alert_id PK
        bigint prescription_id FK
        bigint prescription_item_id FK
        bigint resolved_by_user_id FK
        varchar alert_type
        varchar severity
        boolean is_resolved
    }

    AUDIT_LOGS {
        bigint audit_log_id PK
        bigint actor_user_id FK
        varchar action
        varchar entity_type
        bigint entity_id
    }

    DRUG_CLASSES o|--o{ MEDICINES : classifies
    APP_USERS ||--o{ PRESCRIPTIONS : patient
    APP_USERS ||--o{ PRESCRIPTIONS : prescriber
    APP_USERS ||--o{ PRESCRIPTIONS : uploader
    APP_USERS o|--o{ PRESCRIPTIONS : reviewer
    PRESCRIPTIONS ||--|{ PRESCRIPTION_ITEMS : contains
    MEDICINES ||--o{ PRESCRIPTION_ITEMS : prescribed_as
    PRESCRIPTIONS ||--o{ OCR_RESULTS : has

    APP_USERS ||--o{ PATIENT_ALLERGIES : owns
    DRUG_CLASSES o|--o{ PATIENT_ALLERGIES : allergen_class
    APP_USERS ||--o{ PATIENT_ALLERGIES : reports
    APP_USERS o|--o{ PATIENT_ALLERGIES : verifies

    APP_USERS ||--o{ REACTION_HISTORY : experiences
    MEDICINES ||--o{ REACTION_HISTORY : causes
    APP_USERS ||--o{ REACTION_HISTORY : reports
    APP_USERS o|--o{ REACTION_HISTORY : verifies

    MEDICINES ||--o{ DRUG_INTERACTIONS : medicine_one
    MEDICINES ||--o{ DRUG_INTERACTIONS : medicine_two
    DRUG_CLASSES ||--o{ CROSS_REACTIVITY : source_class
    DRUG_CLASSES ||--o{ CROSS_REACTIVITY : related_class

    PRESCRIPTIONS ||--o{ FRAUD_RISK_ASSESSMENTS : assessed_by_model
    APP_USERS o|--o{ FRAUD_RISK_ASSESSMENTS : requests_or_reviews
    PRESCRIPTIONS ||--o{ SAFETY_ALERTS : produces
    PRESCRIPTION_ITEMS ||--o{ SAFETY_ALERTS : triggers
    APP_USERS o|--o{ SAFETY_ALERTS : resolves
    APP_USERS o|--o{ AUDIT_LOGS : performs
```

## How to explain it in the viva

- **`app_users` is the central identity table.** Roles decide whether a user acts as a patient, doctor, pharmacist, administrator, or auditor; duplicated account tables are avoided.
- **A prescription links one patient, one prescriber, and an uploader.** It can later be reviewed by a pharmacist or admin.
- **`prescription_items` resolves the many-to-many relationship** between prescriptions and medicines, while storing dose and frequency only once per prescribed medicine.
- **Safety data is separate from the prescription.** Allergies, prior reactions, known drug interactions, and class cross-reactivity generate `safety_alerts` for a specific prescription item.
- **AI/ML results are advisory.** `fraud_risk_assessi ments` stores the score, model version, and explanation, but a pharmacist/admin makes the final decision.
- **`audit_logs` records accountable actions** such as viewing, updating, and reviewing records.
