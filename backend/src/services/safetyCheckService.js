const ALLERGY_SEVERITY_TO_ALERT = {
  mild: "moderate",
  moderate: "high",
  severe: "critical",
  unknown: "moderate",
};

const REACTION_SEVERITY_TO_ALERT = {
  mild: "moderate",
  moderate: "high",
  severe: "critical",
  life_threatening: "critical",
  unknown: "moderate",
};

const INTERACTION_SEVERITY_TO_ALERT = {
  minor: "low",
  moderate: "moderate",
  major: "high",
  contraindicated: "critical",
};

const ALERT_TYPES = ["direct_allergy", "cross_reactivity", "reaction_history", "drug_interaction"];

function readable(value) {
  return String(value || "unknown").replaceAll("_", " ");
}

function sourceBasis(record) {
  return record.verificationStatus === "pharmacist_verified"
    ? "pharmacist_verified"
    : "self_reported";
}

function medicineLabel(medicine) {
  return `${medicine.medicineName} (${medicine.genericName} ${medicine.strength})`;
}

function addGroupedFinding(groups, finding) {
  const key = [
    finding.prescriptionItemId.toString(),
    finding.alertType,
    finding.sourceBasis,
  ].join(":");
  const current = groups.get(key);

  if (!current) {
    groups.set(key, { ...finding, details: [finding.detail] });
    return;
  }

  current.details.push(finding.detail);
  const severityOrder = ["low", "moderate", "high", "critical"];
  if (severityOrder.indexOf(finding.severity) > severityOrder.indexOf(current.severity)) {
    current.severity = finding.severity;
  }
}

function finishFinding(finding) {
  const details = [...new Set(finding.details)];
  const joinedDetails = details.join("; ");
  const medicine = medicineLabel(finding.medicine);

  switch (finding.alertType) {
    case "direct_allergy":
      return {
        ...finding,
        message: `Direct allergy match for ${medicine}: ${joinedDetails}. Pharmacist review is required before dispensing.`,
        patientMessage: `Your prescription contains ${finding.medicine.medicineName}, which needs pharmacist review against an allergy in your safety profile.`,
      };
    case "cross_reactivity":
      return {
        ...finding,
        message: `Potential cross-reactivity for ${medicine}: ${joinedDetails}. Pharmacist review is required before dispensing.`,
        patientMessage: `Your prescription contains ${finding.medicine.medicineName}, which needs pharmacist review because of a related allergy in your safety profile.`,
      };
    case "reaction_history":
      return {
        ...finding,
        message: `Previous reaction history matches ${medicine}: ${joinedDetails}. Pharmacist review is required before dispensing.`,
        patientMessage: `Your prescription includes ${finding.medicine.medicineName}, which needs pharmacist review because of a recorded previous reaction.`,
      };
    case "drug_interaction":
      return {
        ...finding,
        message: `Drug interaction review for ${medicine}: ${joinedDetails}. Pharmacist review is required before dispensing.`,
        patientMessage: `Your prescription has a medicine combination that needs pharmacist review before dispensing.`,
      };
    default:
      throw new Error(`Unsupported safety alert type: ${finding.alertType}`);
  }
}

function buildSafetyFindings({ prescription, allergies, reactions, interactions, crossReactivities }) {
  const groups = new Map();
  const medicineIds = new Set(prescription.items.map((item) => item.medicineId.toString()));

  for (const item of prescription.items) {
    const medicine = item.medicine;
    const classId = medicine.classId?.toString();

    for (const allergy of allergies) {
      const allergyClassId = allergy.allergenClassId?.toString();
      if (classId && allergyClassId && classId === allergyClassId) {
        addGroupedFinding(groups, {
          prescriptionItemId: item.prescriptionItemId,
          alertType: "direct_allergy",
          severity: ALLERGY_SEVERITY_TO_ALERT[allergy.severity] || "moderate",
          sourceBasis: sourceBasis(allergy),
          medicine,
          detail: `${allergy.allergenName} (${readable(allergy.severity)}; ${readable(allergy.verificationStatus)})`,
        });
      }

      for (const crossReactivity of crossReactivities) {
        if (
          allergyClassId
          && classId
          && crossReactivity.sourceClassId.toString() === allergyClassId
          && crossReactivity.relatedClassId.toString() === classId
        ) {
          addGroupedFinding(groups, {
            prescriptionItemId: item.prescriptionItemId,
            alertType: "cross_reactivity",
            severity: ALLERGY_SEVERITY_TO_ALERT[crossReactivity.severity] || "moderate",
            sourceBasis: sourceBasis(allergy),
            medicine,
            detail: `${allergy.allergenName} → ${crossReactivity.relatedClass.className}: ${crossReactivity.note}`,
          });
        }
      }
    }

    for (const reaction of reactions) {
      if (reaction.medicineId.toString() === item.medicineId.toString()) {
        addGroupedFinding(groups, {
          prescriptionItemId: item.prescriptionItemId,
          alertType: "reaction_history",
          severity: REACTION_SEVERITY_TO_ALERT[reaction.severity] || "moderate",
          sourceBasis: sourceBasis(reaction),
          medicine,
          detail: `${readable(reaction.severity)} reaction on ${reaction.reactionDate.toISOString().slice(0, 10)}: ${reaction.reactionDescription}`,
        });
      }
    }
  }

  for (const interaction of interactions) {
    const firstId = interaction.medicineId1.toString();
    const secondId = interaction.medicineId2.toString();
    if (!medicineIds.has(firstId) || !medicineIds.has(secondId)) continue;

    for (const item of prescription.items) {
      const itemMedicineId = item.medicineId.toString();
      if (itemMedicineId !== firstId && itemMedicineId !== secondId) continue;
      const pairedMedicine = itemMedicineId === firstId ? interaction.medicineTwo : interaction.medicineOne;
      addGroupedFinding(groups, {
        prescriptionItemId: item.prescriptionItemId,
        alertType: "drug_interaction",
        severity: INTERACTION_SEVERITY_TO_ALERT[interaction.severity] || "moderate",
        sourceBasis: "reference_data",
        medicine: item.medicine,
        detail: `With ${medicineLabel(pairedMedicine)} — ${interaction.description}`,
      });
    }
  }

  return [...groups.values()].map(({ details, detail, ...finding }) => finishFinding({ ...finding, details }));
}

module.exports = { ALERT_TYPES, buildSafetyFindings };
