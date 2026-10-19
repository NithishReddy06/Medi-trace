const express = require("express");
const prisma = require("../config/prisma");
const { ALERT_TYPES, buildSafetyFindings } = require("../services/safetyCheckService");

const router = express.Router();
const MAX_PAGE_SIZE = 25;
const REVIEW_STATUSES = new Set(["approved", "rejected", "escalated", "finalized"]);

class PharmacistInputError extends Error {}

function toId(value, label = "ID") {
  const normalized = String(value || "").trim();
  if (!/^\d+$/.test(normalized) || normalized === "0") {
    throw new PharmacistInputError(`Invalid ${label}.`);
  }
  return BigInt(normalized);
}

function positiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new PharmacistInputError(`Value must be a whole number between 1 and ${maximum}.`);
  }
  return parsed;
}

function cleanRequiredText(value, fieldName, maximumLength = 200) {
  if (typeof value !== "string") throw new PharmacistInputError(`${fieldName} is required.`);
  const cleaned = value.trim();
  if (!cleaned) throw new PharmacistInputError(`${fieldName} is required.`);
  if (cleaned.length > maximumLength) {
    throw new PharmacistInputError(`${fieldName} must be ${maximumLength} characters or fewer.`);
  }
  return cleaned;
}

function cleanOptionalText(value, fieldName, maximumLength = 2000) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new PharmacistInputError(`${fieldName} must be text.`);
  const cleaned = value.trim();
  if (cleaned.length > maximumLength) {
    throw new PharmacistInputError(`${fieldName} must be ${maximumLength} characters or fewer.`);
  }
  return cleaned || null;
}

function parseDateOnly(value, fieldName) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PharmacistInputError(`${fieldName} must use YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new PharmacistInputError(`${fieldName} is not a valid date.`);
  }
  if (date.getTime() > Date.now()) {
    throw new PharmacistInputError(`${fieldName} cannot be in the future.`);
  }
  return date;
}

function positiveDecimal(value, fieldName) {
  const normalized = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0) {
    throw new PharmacistInputError(`${fieldName} must be a positive number with up to two decimal places.`);
  }
  if (Number(normalized) > 1000000) {
    throw new PharmacistInputError(`${fieldName} is too large.`);
  }
  return normalized;
}

function requiredPositiveInteger(value, fieldName, maximum = 1000000) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new PharmacistInputError(`${fieldName} must be a whole number between 1 and ${maximum}.`);
  }
  return parsed;
}

function dateOnly(value) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function alertDto(alert) {
  return {
    id: alert.alertId.toString(),
    alertType: alert.alertType,
    severity: alert.severity,
    sourceBasis: alert.sourceBasis,
    message: alert.message,
    patientMessage: alert.patientMessage,
    isResolved: alert.isResolved,
    createdAt: alert.createdAt.toISOString(),
  };
}

function prescriptionDto(prescription) {
  return {
    id: prescription.prescriptionId.toString(),
    prescriptionNumber: prescription.prescriptionNumber,
    issueDate: dateOnly(prescription.issueDate),
    status: prescription.status,
    imagePath: prescription.imagePath,
    uploadedAt: prescription.uploadedAt.toISOString(),
    pharmacistNotes: prescription.pharmacistNotes,
    reviewedAt: prescription.reviewedAt ? prescription.reviewedAt.toISOString() : null,
    prescriber: prescription.prescriber
      ? {
        firstName: prescription.prescriber.firstName,
        lastName: prescription.prescriber.lastName,
        specialization: prescription.prescriber.specialization,
      }
      : null,
    items: prescription.items.map((item) => ({
      id: item.prescriptionItemId.toString(),
      medicineId: item.medicineId.toString(),
      doseAmount: item.doseAmount.toString(),
      doseUnit: item.doseUnit,
      frequency: item.frequency,
      route: item.route,
      durationDays: item.durationDays,
      quantity: item.quantity,
      instructions: item.instructions,
      medicine: {
        id: item.medicine.medicineId.toString(),
        name: item.medicine.medicineName,
        genericName: item.medicine.genericName,
        strength: item.medicine.strength,
        dosageForm: item.medicine.dosageForm,
        className: item.medicine.drugClass?.className || null,
      },
      safetyAlerts: item.safetyAlerts.map(alertDto),
    })),
  };
}

function patientProfileDto(patient) {
  return {
    id: patient.userId.toString(),
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
    phone: patient.phone,
    dateOfBirth: dateOnly(patient.dateOfBirth),
    allergies: patient.allergies.map((allergy) => ({
      id: allergy.allergyId.toString(),
      allergenName: allergy.allergenName,
      reactionDescription: allergy.reactionDescription,
      severity: allergy.severity,
      verificationStatus: allergy.verificationStatus,
      recordedAt: allergy.recordedAt.toISOString(),
      allergenClass: allergy.allergenClass
        ? { id: allergy.allergenClass.classId.toString(), name: allergy.allergenClass.className }
        : null,
    })),
    reactions: patient.reactions.map((reaction) => ({
      id: reaction.reactionId.toString(),
      reactionDescription: reaction.reactionDescription,
      severity: reaction.severity,
      reactionDate: dateOnly(reaction.reactionDate),
      verificationStatus: reaction.verificationStatus,
      medicine: {
        id: reaction.medicine.medicineId.toString(),
        name: reaction.medicine.medicineName,
        genericName: reaction.medicine.genericName,
        strength: reaction.medicine.strength,
      },
    })),
    prescriptions: patient.patientPrescriptions.map(prescriptionDto),
  };
}

function reportError(error, response, fallbackMessage) {
  if (error instanceof PharmacistInputError) {
    return response.status(400).json({ status: "error", message: error.message });
  }
  console.error(fallbackMessage, error);
  return response.status(500).json({ status: "error", message: fallbackMessage });
}

async function logAudit(client, { actorUserId, action, entityType, entityId, eventData }) {
  return client.auditLog.create({
    data: { actorUserId, action, entityType, entityId, eventData },
  });
}

function parsePrescriptionItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 20) {
    throw new PharmacistInputError("Add between one and twenty medicine items.");
  }

  const medicineIds = new Set();
  return items.map((item, index) => {
    const itemNumber = `Medicine item ${index + 1}`;
    const medicineId = toId(item?.medicineId, `${itemNumber} medicine ID`);
    if (medicineIds.has(medicineId.toString())) {
      throw new PharmacistInputError("The same medicine can be added only once to a prescription.");
    }
    medicineIds.add(medicineId.toString());
    return {
      medicineId,
      doseAmount: positiveDecimal(item?.doseAmount, `${itemNumber} dose amount`),
      doseUnit: cleanRequiredText(item?.doseUnit, `${itemNumber} dose unit`, 50),
      frequency: cleanRequiredText(item?.frequency, `${itemNumber} frequency`, 100),
      route: cleanRequiredText(item?.route, `${itemNumber} route`, 100),
      durationDays: requiredPositiveInteger(item?.durationDays, `${itemNumber} duration`, 3650),
      quantity: requiredPositiveInteger(item?.quantity, `${itemNumber} quantity`, 100000),
      instructions: cleanOptionalText(item?.instructions, `${itemNumber} instructions`),
    };
  });
}

async function getPrescriptionResponse(client, prescriptionId) {
  return client.prescription.findUnique({
    where: { prescriptionId },
    include: prescriptionDetailInclude,
  });
}

const prescriptionDetailInclude = {
  prescriber: { select: { firstName: true, lastName: true, specialization: true } },
  items: {
    include: {
      medicine: {
        include: { drugClass: { select: { className: true } } },
      },
      safetyAlerts: {
        select: {
          alertId: true,
          alertType: true,
          severity: true,
          sourceBasis: true,
          message: true,
          patientMessage: true,
          isResolved: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  },
};

const patientProfileInclude = {
  allergies: {
    include: { allergenClass: { select: { classId: true, className: true } } },
    orderBy: [{ severity: "desc" }, { recordedAt: "desc" }],
  },
  reactions: {
    include: {
      medicine: { select: { medicineId: true, medicineName: true, genericName: true, strength: true } },
    },
    orderBy: [{ reactionDate: "desc" }, { recordedAt: "desc" }],
  },
  patientPrescriptions: {
    include: prescriptionDetailInclude,
    orderBy: [{ issueDate: "desc" }, { uploadedAt: "desc" }],
  },
};

router.get("/prescribers", async (request, response) => {
  try {
    const query = typeof request.query.query === "string" ? request.query.query.trim().slice(0, 100) : "";
    const prescribers = await prisma.user.findMany({
      where: {
        role: "doctor",
        isActive: true,
        ...(query ? {
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        } : {}),
      },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        specialization: true,
        doctorLicenseNumber: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: MAX_PAGE_SIZE,
    });
    response.json({
      status: "ok",
      prescribers: prescribers.map((prescriber) => ({
        id: prescriber.userId.toString(),
        firstName: prescriber.firstName,
        lastName: prescriber.lastName,
        specialization: prescriber.specialization,
        licenseNumber: prescriber.doctorLicenseNumber,
      })),
    });
  } catch (error) {
    return reportError(error, response, "Could not load prescribers.");
  }
});

router.get("/medicines", async (request, response) => {
  try {
    const query = typeof request.query.query === "string" ? request.query.query.trim().slice(0, 100) : "";
    const medicines = await prisma.medicine.findMany({
      where: {
        isActive: true,
        ...(query ? {
          OR: [
            { medicineName: { contains: query, mode: "insensitive" } },
            { genericName: { contains: query, mode: "insensitive" } },
          ],
        } : {}),
      },
      select: {
        medicineId: true,
        medicineName: true,
        genericName: true,
        strength: true,
        dosageForm: true,
        route: true,
      },
      orderBy: [{ medicineName: "asc" }, { strength: "asc" }],
      take: 100,
    });
    response.json({
      status: "ok",
      medicines: medicines.map((medicine) => ({
        id: medicine.medicineId.toString(),
        name: medicine.medicineName,
        genericName: medicine.genericName,
        strength: medicine.strength,
        dosageForm: medicine.dosageForm,
        route: medicine.route,
      })),
    });
  } catch (error) {
    return reportError(error, response, "Could not load medicines.");
  }
});

router.post("/prescriptions", async (request, response) => {
  try {
    const body = request.body || {};
    const patientUserId = toId(body.patientId, "patient ID");
    const prescriberUserId = toId(body.prescriberId, "prescriber ID");
    const issueDate = parseDateOnly(body.issueDate, "Issue date");
    const items = parsePrescriptionItems(body.items);
    const pharmacistUserId = BigInt(request.user.id);

    const [patient, prescriber, medicines] = await Promise.all([
      prisma.user.findFirst({
        where: { userId: patientUserId, role: "patient", isActive: true },
        select: { userId: true },
      }),
      prisma.user.findFirst({
        where: { userId: prescriberUserId, role: "doctor", isActive: true },
        select: { userId: true },
      }),
      prisma.medicine.findMany({
        where: { medicineId: { in: items.map((item) => item.medicineId) }, isActive: true },
        select: { medicineId: true },
      }),
    ]);
    if (!patient) return response.status(404).json({ status: "error", message: "Patient not found." });
    if (!prescriber) return response.status(404).json({ status: "error", message: "Active prescriber not found." });
    if (medicines.length !== items.length) {
      return response.status(404).json({ status: "error", message: "One or more selected medicines are unavailable." });
    }

    const prescription = await prisma.$transaction(async (transaction) => {
      const created = await transaction.prescription.create({
        data: {
          patientUserId,
          prescriberUserId,
          uploadedByUserId: pharmacistUserId,
          issueDate,
          status: "uploaded",
          items: { create: items },
        },
        include: prescriptionDetailInclude,
      });
      await logAudit(transaction, {
        actorUserId: pharmacistUserId,
        action: "INSERT",
        entityType: "prescriptions",
        entityId: created.prescriptionId,
        eventData: {
          source: "pharmacist_module",
          patientUserId: patientUserId.toString(),
          prescriberUserId: prescriberUserId.toString(),
          medicineItemCount: items.length,
        },
      });
      return created;
    });

    response.status(201).json({
      status: "ok",
      message: "Prescription created. Upload the source image, run safety checks, then record the pharmacist decision.",
      prescription: prescriptionDto(prescription),
    });
  } catch (error) {
    return reportError(error, response, "Could not create the prescription.");
  }
});

router.get("/patients", async (request, response) => {
  try {
    const query = typeof request.query.query === "string" ? request.query.query.trim() : "";
    const page = positiveInteger(request.query.page, 1, 10000);
    const limit = positiveInteger(request.query.limit, 10, MAX_PAGE_SIZE);
    if (query && query.length < 2) {
      throw new PharmacistInputError("Enter at least two characters to search patients.");
    }

    const where = {
      role: "patient",
      isActive: true,
      ...(query ? {
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      } : {}),
    };
    const [total, patients] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
          dateOfBirth: true,
          _count: { select: { allergies: true, reactions: true, patientPrescriptions: true } },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    response.json({
      status: "ok",
      patients: patients.map((patient) => ({
        id: patient.userId.toString(),
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        dateOfBirth: dateOnly(patient.dateOfBirth),
        counts: {
          allergies: patient._count.allergies,
          reactions: patient._count.reactions,
          prescriptions: patient._count.patientPrescriptions,
        },
      })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return reportError(error, response, "Could not search patients.");
  }
});

router.get("/patients/:patientId/safety-profile", async (request, response) => {
  try {
    const patientId = toId(request.params.patientId, "patient ID");
    const patient = await prisma.user.findFirst({
      where: { userId: patientId, role: "patient", isActive: true },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        ...patientProfileInclude,
      },
    });
    if (!patient) {
      return response.status(404).json({ status: "error", message: "Patient not found." });
    }

    await logAudit(prisma, {
      actorUserId: BigInt(request.user.id),
      action: "VIEW",
      entityType: "app_users",
      entityId: patientId,
      eventData: { source: "pharmacist_module", purpose: "safety_profile_review" },
    });
    response.json({ status: "ok", patient: patientProfileDto(patient) });
  } catch (error) {
    return reportError(error, response, "Could not load the patient safety profile.");
  }
});

router.post("/prescriptions/:prescriptionId/safety-check", async (request, response) => {
  try {
    const prescriptionId = toId(request.params.prescriptionId, "prescription ID");
    const prescription = await prisma.prescription.findUnique({
      where: { prescriptionId },
      include: {
        patient: {
          select: {
            allergies: {
              select: {
                allergyId: true,
                allergenName: true,
                allergenClassId: true,
                severity: true,
                verificationStatus: true,
              },
            },
            reactions: {
              select: {
                reactionId: true,
                medicineId: true,
                reactionDescription: true,
                severity: true,
                reactionDate: true,
                verificationStatus: true,
              },
            },
          },
        },
        items: {
          include: {
            medicine: {
              include: { drugClass: { select: { classId: true, className: true } } },
            },
          },
        },
      },
    });
    if (!prescription) {
      return response.status(404).json({ status: "error", message: "Prescription not found." });
    }
    if (!prescription.items.length) {
      return response.status(409).json({ status: "error", message: "This prescription has no medicine items to check." });
    }

    const medicineIds = prescription.items.map((item) => item.medicineId);
    const allergyClassIds = prescription.patient.allergies
      .map((allergy) => allergy.allergenClassId)
      .filter((classId) => classId !== null);
    const medicineClassIds = prescription.items
      .map((item) => item.medicine.classId)
      .filter((classId) => classId !== null);
    const [interactions, crossReactivities] = await Promise.all([
      prisma.drugInteraction.findMany({
        where: { medicineId1: { in: medicineIds }, medicineId2: { in: medicineIds } },
        include: {
          medicineOne: true,
          medicineTwo: true,
        },
      }),
      allergyClassIds.length && medicineClassIds.length
        ? prisma.crossReactivity.findMany({
          where: {
            sourceClassId: { in: allergyClassIds },
            relatedClassId: { in: medicineClassIds },
          },
          include: { relatedClass: { select: { className: true } } },
        })
        : Promise.resolve([]),
    ]);

    const findings = buildSafetyFindings({
      prescription,
      allergies: prescription.patient.allergies,
      reactions: prescription.patient.reactions,
      interactions,
      crossReactivities,
    });
    const pharmacistId = BigInt(request.user.id);

    const savedAlerts = await prisma.$transaction(async (transaction) => {
      const alerts = await Promise.all(findings.map((finding) => transaction.safetyAlert.upsert({
        where: {
          prescriptionId_prescriptionItemId_alertType_sourceBasis: {
            prescriptionId,
            prescriptionItemId: finding.prescriptionItemId,
            alertType: finding.alertType,
            sourceBasis: finding.sourceBasis,
          },
        },
        create: {
          prescriptionId,
          prescriptionItemId: finding.prescriptionItemId,
          alertType: finding.alertType,
          severity: finding.severity,
          sourceBasis: finding.sourceBasis,
          message: finding.message,
          patientMessage: finding.patientMessage,
        },
        update: {
          severity: finding.severity,
          message: finding.message,
          patientMessage: finding.patientMessage,
          isResolved: false,
          resolvedByUserId: null,
          resolvedAt: null,
        },
      })));
      if (prescription.status === "uploaded") {
        await transaction.prescription.update({
          where: { prescriptionId },
          data: { status: "under_review" },
        });
      }
      await logAudit(transaction, {
        actorUserId: pharmacistId,
        action: "REVIEW",
        entityType: "prescriptions",
        entityId: prescriptionId,
        eventData: {
          source: "pharmacist_module",
          rulesVersion: "safety-rules-v1",
          findingCount: findings.length,
          alertTypes: [...new Set(findings.map((finding) => finding.alertType))],
        },
      });
      return alerts;
    });

    response.json({
      status: "ok",
      message: findings.length
        ? `${findings.length} safety ${findings.length === 1 ? "alert was" : "alerts were"} found. Pharmacist review is required.`
        : "No rule-based safety alerts were found. Clinical review is still required.",
      checkedAt: new Date().toISOString(),
      rulesVersion: "safety-rules-v1",
      alerts: savedAlerts.map(alertDto),
      checkedRules: ALERT_TYPES,
    });
  } catch (error) {
    return reportError(error, response, "Could not run the prescription safety check.");
  }
});

router.patch("/alerts/:alertId/resolve", async (request, response) => {
  try {
    const alertId = toId(request.params.alertId, "alert ID");
    const pharmacistUserId = BigInt(request.user.id);
    const existing = await prisma.safetyAlert.findUnique({
      where: { alertId },
      select: { alertId: true, prescriptionId: true, isResolved: true },
    });
    if (!existing) return response.status(404).json({ status: "error", message: "Safety alert not found." });

    const alert = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.safetyAlert.update({
        where: { alertId },
        data: {
          isResolved: true,
          resolvedByUserId: pharmacistUserId,
          resolvedAt: new Date(),
        },
      });
      if (!existing.isResolved) {
        await logAudit(transaction, {
          actorUserId: pharmacistUserId,
          action: "UPDATE",
          entityType: "safety_alerts",
          entityId: alertId,
          eventData: { source: "pharmacist_module", action: "resolved", prescriptionId: existing.prescriptionId.toString() },
        });
      }
      return updated;
    });
    response.json({ status: "ok", message: "Safety alert marked as addressed.", alert: alertDto(alert) });
  } catch (error) {
    return reportError(error, response, "Could not resolve this safety alert.");
  }
});

router.post("/prescriptions/:prescriptionId/review", async (request, response) => {
  try {
    const prescriptionId = toId(request.params.prescriptionId, "prescription ID");
    const body = request.body || {};
    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!REVIEW_STATUSES.has(status)) {
      throw new PharmacistInputError("Choose an approved, rejected, escalated, or finalized review status.");
    }
    const notes = cleanOptionalText(body.notes, "Pharmacist notes", 4000);
    if (["rejected", "escalated"].includes(status) && !notes) {
      throw new PharmacistInputError("Pharmacist notes are required when rejecting or escalating a prescription.");
    }
    const prescription = await prisma.prescription.findUnique({
      where: { prescriptionId },
      select: { prescriptionId: true },
    });
    if (!prescription) return response.status(404).json({ status: "error", message: "Prescription not found." });

    if (["approved", "finalized"].includes(status)) {
      const openAlertCount = await prisma.safetyAlert.count({
        where: { prescriptionId, isResolved: false },
      });
      if (openAlertCount) {
        return response.status(409).json({
          status: "error",
          message: `Resolve or escalate the ${openAlertCount} open safety ${openAlertCount === 1 ? "alert" : "alerts"} before approving this prescription.`,
        });
      }
    }

    const pharmacistUserId = BigInt(request.user.id);
    const updatedPrescription = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        CALL review_prescription(${prescriptionId}, ${pharmacistUserId}, ${status}, ${notes})
      `;
      return getPrescriptionResponse(transaction, prescriptionId);
    });

    response.json({
      status: "ok",
      message: `Prescription marked ${status}.`,
      prescription: prescriptionDto(updatedPrescription),
    });
  } catch (error) {
    return reportError(error, response, "Could not record the pharmacist decision.");
  }
});

module.exports = router;
