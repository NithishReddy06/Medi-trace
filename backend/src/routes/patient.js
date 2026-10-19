const express = require("express");
const prisma = require("../config/prisma");

const router = express.Router();
const ALLERGY_SEVERITIES = new Set(["mild", "moderate", "severe", "unknown"]);
const REACTION_SEVERITIES = new Set([
  "mild",
  "moderate",
  "severe",
  "life_threatening",
  "unknown",
]);

class PatientInputError extends Error {}

function userIdFromRequest(request) {
  return BigInt(request.user.id);
}

function toId(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized) || normalized === "0") return null;

  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
}

function cleanRequiredText(value, fieldName, maximumLength = 200) {
  if (typeof value !== "string") throw new PatientInputError(`${fieldName} is required.`);
  const cleaned = value.trim();
  if (!cleaned) throw new PatientInputError(`${fieldName} is required.`);
  if (cleaned.length > maximumLength) {
    throw new PatientInputError(`${fieldName} must be ${maximumLength} characters or fewer.`);
  }
  return cleaned;
}

function cleanOptionalText(value, fieldName, maximumLength = 2000) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new PatientInputError(`${fieldName} must be text.`);
  const cleaned = value.trim();
  if (cleaned.length > maximumLength) {
    throw new PatientInputError(`${fieldName} must be ${maximumLength} characters or fewer.`);
  }
  return cleaned || null;
}

function parseDateOnly(value, fieldName, { allowFuture = false } = {}) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PatientInputError(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new PatientInputError(`${fieldName} is not a valid date.`);
  }

  if (!allowFuture && date.getTime() > Date.now()) {
    throw new PatientInputError(`${fieldName} cannot be in the future.`);
  }
  return date;
}

function dateOnly(value) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function profileDto(user) {
  return {
    id: user.userId.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    dateOfBirth: dateOnly(user.dateOfBirth),
  };
}

function allergyDto(allergy) {
  return {
    id: allergy.allergyId.toString(),
    allergenName: allergy.allergenName,
    reactionDescription: allergy.reactionDescription,
    severity: allergy.severity,
    verificationStatus: allergy.verificationStatus,
    recordedAt: allergy.recordedAt.toISOString(),
    allergenClass: allergy.allergenClass
      ? { id: allergy.allergenClass.classId.toString(), name: allergy.allergenClass.className }
      : null,
  };
}

function reactionDto(reaction) {
  return {
    id: reaction.reactionId.toString(),
    medicineId: reaction.medicineId.toString(),
    reactionDescription: reaction.reactionDescription,
    severity: reaction.severity,
    reactionDate: dateOnly(reaction.reactionDate),
    verificationStatus: reaction.verificationStatus,
    recordedAt: reaction.recordedAt.toISOString(),
    medicine: {
      id: reaction.medicine.medicineId.toString(),
      name: reaction.medicine.medicineName,
      genericName: reaction.medicine.genericName,
      strength: reaction.medicine.strength,
      dosageForm: reaction.medicine.dosageForm,
    },
  };
}

function isKnownPrismaConflict(error) {
  return error && error.code === "P2002";
}

function sendPatientError(error, response, fallbackMessage) {
  if (error instanceof PatientInputError) {
    return response.status(400).json({ status: "error", message: error.message });
  }
  console.error(fallbackMessage, error);
  return response.status(500).json({ status: "error", message: fallbackMessage });
}

async function writeAudit(client, { actorUserId, action, entityType, entityId, eventData }) {
  return client.auditLog.create({
    data: { actorUserId, action, entityType, entityId, eventData },
  });
}

router.get("/profile", async (request, response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { userId: userIdFromRequest(request) },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        dateOfBirth: true,
      },
    });

    response.json({ status: "ok", profile: profileDto(user) });
  } catch (error) {
    console.error("Patient profile read failed:", error.message);
    response.status(500).json({ status: "error", message: "Could not load your profile." });
  }
});

router.patch("/profile", async (request, response) => {
  try {
    const body = request.body || {};
    const firstName = cleanRequiredText(body.firstName, "First name", 100);
    const lastName = cleanRequiredText(body.lastName, "Last name", 100);
    const phone = cleanOptionalText(body.phone, "Phone number", 30);
    const dateOfBirth = parseDateOnly(body.dateOfBirth, "Date of birth");
    const patientUserId = userIdFromRequest(request);

    const user = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { userId: patientUserId },
        data: { firstName, lastName, phone, dateOfBirth },
        select: {
          userId: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          dateOfBirth: true,
        },
      });
      await writeAudit(transaction, {
        actorUserId: patientUserId,
        action: "UPDATE",
        entityType: "app_users",
        entityId: patientUserId,
        eventData: { fields: ["firstName", "lastName", "phone", "dateOfBirth"], source: "patient_profile" },
      });
      return updated;
    });

    response.json({ status: "ok", message: "Profile updated.", profile: profileDto(user) });
  } catch (error) {
    return sendPatientError(error, response, "Could not update your profile.");
  }
});

router.get("/allergies", async (request, response) => {
  try {
    const allergies = await prisma.patientAllergy.findMany({
      where: { patientUserId: userIdFromRequest(request) },
      include: { allergenClass: { select: { classId: true, className: true } } },
      orderBy: [{ severity: "desc" }, { recordedAt: "desc" }],
    });
    response.json({ status: "ok", allergies: allergies.map(allergyDto) });
  } catch (error) {
    console.error("Patient allergy read failed:", error.message);
    response.status(500).json({ status: "error", message: "Could not load your allergies." });
  }
});

router.post("/allergies", async (request, response) => {
  try {
    const body = request.body || {};
    const patientUserId = userIdFromRequest(request);
    const allergenName = cleanRequiredText(body.allergenName, "Allergen name", 200);
    const reactionDescription = cleanOptionalText(body.reactionDescription, "Reaction description");
    const severity = typeof body.severity === "string" ? body.severity.trim() : "";
    if (!ALLERGY_SEVERITIES.has(severity)) throw new PatientInputError("Choose a valid allergy severity.");

    const duplicate = await prisma.patientAllergy.findFirst({
      where: { patientUserId, allergenName: { equals: allergenName, mode: "insensitive" } },
      select: { allergyId: true },
    });
    if (duplicate) {
      return response.status(409).json({ status: "error", message: "This allergy is already in your safety profile." });
    }

    const allergy = await prisma.$transaction(async (transaction) => {
      const created = await transaction.patientAllergy.create({
        data: {
          patientUserId,
          allergenName,
          reactionDescription,
          severity,
          verificationStatus: "self_reported",
          reportedByUserId: patientUserId,
        },
        include: { allergenClass: { select: { classId: true, className: true } } },
      });
      await writeAudit(transaction, {
        actorUserId: patientUserId,
        action: "INSERT",
        entityType: "patient_allergies",
        entityId: created.allergyId,
        eventData: { severity, verificationStatus: "self_reported", source: "patient_module" },
      });
      return created;
    });

    response.status(201).json({ status: "ok", message: "Allergy added to your safety profile.", allergy: allergyDto(allergy) });
  } catch (error) {
    if (isKnownPrismaConflict(error)) {
      return response.status(409).json({ status: "error", message: "This allergy is already in your safety profile." });
    }
    return sendPatientError(error, response, "Could not add this allergy.");
  }
});

router.patch("/allergies/:allergyId", async (request, response) => {
  try {
    const allergyId = toId(request.params.allergyId);
    if (!allergyId) throw new PatientInputError("Invalid allergy ID.");
    const patientUserId = userIdFromRequest(request);
    const current = await prisma.patientAllergy.findFirst({
      where: { allergyId, patientUserId },
      select: { allergyId: true, verificationStatus: true },
    });
    if (!current) return response.status(404).json({ status: "error", message: "Allergy not found." });
    if (current.verificationStatus !== "self_reported") {
      return response.status(403).json({ status: "error", message: "A verified allergy cannot be edited by a patient. Ask a pharmacist to review it." });
    }

    const body = request.body || {};
    const allergenName = cleanRequiredText(body.allergenName, "Allergen name", 200);
    const reactionDescription = cleanOptionalText(body.reactionDescription, "Reaction description");
    const severity = typeof body.severity === "string" ? body.severity.trim() : "";
    if (!ALLERGY_SEVERITIES.has(severity)) throw new PatientInputError("Choose a valid allergy severity.");
    const duplicate = await prisma.patientAllergy.findFirst({
      where: {
        patientUserId,
        allergenName: { equals: allergenName, mode: "insensitive" },
        NOT: { allergyId },
      },
      select: { allergyId: true },
    });
    if (duplicate) return response.status(409).json({ status: "error", message: "This allergy is already in your safety profile." });

    const allergy = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.patientAllergy.update({
        where: { allergyId },
        data: { allergenName, reactionDescription, severity },
        include: { allergenClass: { select: { classId: true, className: true } } },
      });
      await writeAudit(transaction, {
        actorUserId: patientUserId,
        action: "UPDATE",
        entityType: "patient_allergies",
        entityId: allergyId,
        eventData: { fields: ["allergenName", "reactionDescription", "severity"], source: "patient_module" },
      });
      return updated;
    });
    response.json({ status: "ok", message: "Allergy updated.", allergy: allergyDto(allergy) });
  } catch (error) {
    if (isKnownPrismaConflict(error)) return response.status(409).json({ status: "error", message: "This allergy is already in your safety profile." });
    return sendPatientError(error, response, "Could not update this allergy.");
  }
});

router.delete("/allergies/:allergyId", async (request, response) => {
  try {
    const allergyId = toId(request.params.allergyId);
    if (!allergyId) throw new PatientInputError("Invalid allergy ID.");
    const patientUserId = userIdFromRequest(request);
    const current = await prisma.patientAllergy.findFirst({
      where: { allergyId, patientUserId },
      select: { allergyId: true, allergenName: true, verificationStatus: true },
    });
    if (!current) return response.status(404).json({ status: "error", message: "Allergy not found." });
    if (current.verificationStatus !== "self_reported") {
      return response.status(403).json({ status: "error", message: "A verified allergy cannot be removed by a patient. Ask a pharmacist to review it." });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.patientAllergy.delete({ where: { allergyId } });
      await writeAudit(transaction, {
        actorUserId: patientUserId,
        action: "DELETE",
        entityType: "patient_allergies",
        entityId: allergyId,
        eventData: { allergenName: current.allergenName, source: "patient_module" },
      });
    });
    response.json({ status: "ok", message: "Allergy removed from your safety profile." });
  } catch (error) {
    return sendPatientError(error, response, "Could not remove this allergy.");
  }
});

router.get("/reactions", async (request, response) => {
  try {
    const reactions = await prisma.reactionHistory.findMany({
      where: { patientUserId: userIdFromRequest(request) },
      include: {
        medicine: { select: { medicineId: true, medicineName: true, genericName: true, strength: true, dosageForm: true } },
      },
      orderBy: [{ reactionDate: "desc" }, { recordedAt: "desc" }],
    });
    response.json({ status: "ok", reactions: reactions.map(reactionDto) });
  } catch (error) {
    console.error("Reaction history read failed:", error.message);
    response.status(500).json({ status: "error", message: "Could not load your reaction history." });
  }
});

async function getExistingMedicine(medicineId) {
  return prisma.medicine.findUnique({
    where: { medicineId },
    select: { medicineId: true },
  });
}

function reactionInput(body) {
  const medicineId = toId(body.medicineId);
  if (!medicineId) throw new PatientInputError("Choose a medicine.");
  const reactionDescription = cleanRequiredText(body.reactionDescription, "Reaction description", 2000);
  const severity = typeof body.severity === "string" ? body.severity.trim() : "";
  if (!REACTION_SEVERITIES.has(severity)) throw new PatientInputError("Choose a valid reaction severity.");
  const reactionDate = parseDateOnly(body.reactionDate, "Reaction date");
  return { medicineId, reactionDescription, severity, reactionDate };
}

router.post("/reactions", async (request, response) => {
  try {
    const patientUserId = userIdFromRequest(request);
    const input = reactionInput(request.body || {});
    const medicine = await getExistingMedicine(input.medicineId);
    if (!medicine) return response.status(404).json({ status: "error", message: "Medicine not found." });

    const reaction = await prisma.$transaction(async (transaction) => {
      const created = await transaction.reactionHistory.create({
        data: { ...input, patientUserId, verificationStatus: "self_reported", reportedByUserId: patientUserId },
        include: { medicine: { select: { medicineId: true, medicineName: true, genericName: true, strength: true, dosageForm: true } } },
      });
      await writeAudit(transaction, {
        actorUserId: patientUserId,
        action: "INSERT",
        entityType: "reaction_history",
        entityId: created.reactionId,
        eventData: { medicineId: input.medicineId.toString(), severity: input.severity, source: "patient_module" },
      });
      return created;
    });
    response.status(201).json({ status: "ok", message: "Reaction history added.", reaction: reactionDto(reaction) });
  } catch (error) {
    if (isKnownPrismaConflict(error)) return response.status(409).json({ status: "error", message: "This reaction entry already exists." });
    return sendPatientError(error, response, "Could not add this reaction.");
  }
});

router.patch("/reactions/:reactionId", async (request, response) => {
  try {
    const reactionId = toId(request.params.reactionId);
    if (!reactionId) throw new PatientInputError("Invalid reaction ID.");
    const patientUserId = userIdFromRequest(request);
    const current = await prisma.reactionHistory.findFirst({
      where: { reactionId, patientUserId },
      select: { reactionId: true, verificationStatus: true },
    });
    if (!current) return response.status(404).json({ status: "error", message: "Reaction entry not found." });
    if (current.verificationStatus !== "self_reported") {
      return response.status(403).json({ status: "error", message: "A verified reaction cannot be edited by a patient. Ask a pharmacist to review it." });
    }
    const input = reactionInput(request.body || {});
    const medicine = await getExistingMedicine(input.medicineId);
    if (!medicine) return response.status(404).json({ status: "error", message: "Medicine not found." });

    const reaction = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.reactionHistory.update({
        where: { reactionId },
        data: input,
        include: { medicine: { select: { medicineId: true, medicineName: true, genericName: true, strength: true, dosageForm: true } } },
      });
      await writeAudit(transaction, {
        actorUserId: patientUserId,
        action: "UPDATE",
        entityType: "reaction_history",
        entityId: reactionId,
        eventData: { fields: ["medicineId", "reactionDescription", "severity", "reactionDate"], source: "patient_module" },
      });
      return updated;
    });
    response.json({ status: "ok", message: "Reaction history updated.", reaction: reactionDto(reaction) });
  } catch (error) {
    if (isKnownPrismaConflict(error)) return response.status(409).json({ status: "error", message: "This reaction entry already exists." });
    return sendPatientError(error, response, "Could not update this reaction.");
  }
});

router.delete("/reactions/:reactionId", async (request, response) => {
  try {
    const reactionId = toId(request.params.reactionId);
    if (!reactionId) throw new PatientInputError("Invalid reaction ID.");
    const patientUserId = userIdFromRequest(request);
    const current = await prisma.reactionHistory.findFirst({
      where: { reactionId, patientUserId },
      select: { reactionId: true, medicineId: true, verificationStatus: true },
    });
    if (!current) return response.status(404).json({ status: "error", message: "Reaction entry not found." });
    if (current.verificationStatus !== "self_reported") {
      return response.status(403).json({ status: "error", message: "A verified reaction cannot be removed by a patient. Ask a pharmacist to review it." });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.reactionHistory.delete({ where: { reactionId } });
      await writeAudit(transaction, {
        actorUserId: patientUserId,
        action: "DELETE",
        entityType: "reaction_history",
        entityId: reactionId,
        eventData: { medicineId: current.medicineId.toString(), source: "patient_module" },
      });
    });
    response.json({ status: "ok", message: "Reaction history removed." });
  } catch (error) {
    return sendPatientError(error, response, "Could not remove this reaction.");
  }
});

router.get("/prescriptions", async (request, response) => {
  try {
    const prescriptions = await prisma.prescription.findMany({
      where: { patientUserId: userIdFromRequest(request) },
      select: {
        prescriptionId: true,
        prescriptionNumber: true,
        issueDate: true,
        status: true,
        pharmacistNotes: true,
        uploadedAt: true,
        prescriber: { select: { firstName: true, lastName: true, specialization: true } },
        items: {
          select: {
            prescriptionItemId: true,
            doseAmount: true,
            doseUnit: true,
            frequency: true,
            route: true,
            durationDays: true,
            quantity: true,
            instructions: true,
            medicine: { select: { medicineId: true, medicineName: true, genericName: true, strength: true, dosageForm: true } },
          },
        },
        safetyAlerts: {
          where: { patientMessage: { not: null } },
          select: { alertId: true, severity: true, patientMessage: true, isResolved: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ issueDate: "desc" }, { uploadedAt: "desc" }],
    });

    response.json({
      status: "ok",
      prescriptions: prescriptions.map((prescription) => ({
        id: prescription.prescriptionId.toString(),
        prescriptionNumber: prescription.prescriptionNumber,
        issueDate: dateOnly(prescription.issueDate),
        status: prescription.status,
        pharmacistNotes: prescription.pharmacistNotes,
        uploadedAt: prescription.uploadedAt.toISOString(),
        prescriber: prescription.prescriber,
        items: prescription.items.map((item) => ({
          id: item.prescriptionItemId.toString(),
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
          },
        })),
        safetyAlerts: prescription.safetyAlerts.map((alert) => ({
          id: alert.alertId.toString(),
          severity: alert.severity,
          message: alert.patientMessage,
          isResolved: alert.isResolved,
          createdAt: alert.createdAt.toISOString(),
        })),
      })),
    });
  } catch (error) {
    console.error("Patient prescription read failed:", error.message);
    response.status(500).json({ status: "error", message: "Could not load your prescriptions." });
  }
});

router.get("/medicines", async (request, response) => {
  try {
    const search = typeof request.query.search === "string" ? request.query.search.trim().slice(0, 100) : "";
    const medicines = await prisma.medicine.findMany({
      where: {
        isActive: true,
        ...(search ? {
          OR: [
            { medicineName: { contains: search, mode: "insensitive" } },
            { genericName: { contains: search, mode: "insensitive" } },
          ],
        } : {}),
      },
      select: { medicineId: true, medicineName: true, genericName: true, strength: true, dosageForm: true, route: true },
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
    console.error("Medicine lookup failed:", error.message);
    response.status(500).json({ status: "error", message: "Could not load medicines." });
  }
});

module.exports = router;
