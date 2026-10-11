const DATE_PATTERN = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})/;
const DOSAGE_PATTERN = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|mL|tablet(?:s)?|capsule(?:s)?)\b/i;
const FREQUENCY_PATTERN = /\b(?:once|twice|thrice|daily|weekly|monthly|every\s+\d+\s*(?:hours?|hrs?|days?)|\d+\s*(?:times?|x)\s*(?:a|per)?\s*day)\b/i;
const DURATION_PATTERN = /\b(?:for\s+)?\d+\s*(?:days?|weeks?|months?)\b/i;
const QUANTITY_PATTERN = /\b(?:qty|quantity)\s*[:#-]?\s*([0-9]+)\b/i;

function valueAfterLabel(lines, labelPattern) {
  const line = lines.find((candidate) => labelPattern.test(candidate));

  if (!line) {
    return "";
  }

  const value = line.replace(labelPattern, "").replace(/^\s*[:#-]\s*/, "").trim();
  return value;
}

function extractDate(lines) {
  const labeledLine = lines.find((line) => /\b(?:date|issued)\b/i.test(line));
  const match = labeledLine ? labeledLine.match(DATE_PATTERN) : null;
  return match ? match[1] : "";
}

function looksLikeMedicineLine(line) {
  return DOSAGE_PATTERN.test(line)
    || FREQUENCY_PATTERN.test(line)
    || /\b(?:tablet|capsule|syrup|injection|cream| ointment)\b/i.test(line);
}

function parseMedicineLine(line) {
  const cleaned = line.replace(/^[-*\d.)\s]+/, "").trim();
  const dosageMatch = cleaned.match(DOSAGE_PATTERN);
  const frequencyMatch = cleaned.match(FREQUENCY_PATTERN);
  const durationMatch = cleaned.match(DURATION_PATTERN);
  const quantityMatch = cleaned.match(QUANTITY_PATTERN);
  const nameEnd = [dosageMatch, frequencyMatch, durationMatch]
    .filter(Boolean)
    .map((match) => match.index)
    .sort((a, b) => a - b)[0];

  const name = (nameEnd === undefined ? cleaned : cleaned.slice(0, nameEnd))
    .replace(/[,:-]+\s*$/, "")
    .trim();

  return {
    name,
    dosage: dosageMatch ? dosageMatch[0] : "",
    frequency: frequencyMatch ? frequencyMatch[0] : "",
    duration: durationMatch ? durationMatch[0] : "",
    quantity: quantityMatch ? quantityMatch[1] : "",
  };
}

function extractMedicines(lines) {
  return lines
    .filter(looksLikeMedicineLine)
    .map(parseMedicineLine)
    .filter((medicine) => medicine.name);
}

function getMissingFields(data) {
  const missingFields = Object.entries(data)
    .filter(([field, value]) => field !== "medicines" && !value)
    .map(([field]) => field);

  if (data.medicines.length === 0) {
    missingFields.push("medicines");
  }

  data.medicines.forEach((medicine, index) => {
    ["name", "dosage", "frequency", "duration", "quantity"].forEach((field) => {
      if (!medicine[field]) {
        missingFields.push(`medicines[${index}].${field}`);
      }
    });
  });

  return missingFields;
}

function extractPrescriptionData(ocrText) {
  if (typeof ocrText !== "string" || !ocrText.trim()) {
    throw new Error("OCR text must be a non-empty string");
  }

  const lines = ocrText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const data = {
    doctorName: valueAfterLabel(lines, /^\s*(?:doctor|dr\.?)(?:\s+name)?\s*/i),
    licenseNumber: valueAfterLabel(lines, /^\s*(?:license|licence|registration|reg\.?)\s*(?:number|no\.?|#)?\s*/i),
    patientName: valueAfterLabel(lines, /^\s*patient(?:\s+name)?\s*/i),
    date: extractDate(lines),
    medicines: extractMedicines(lines),
  };
  const missingFields = getMissingFields(data);
  const warnings = [
    "OCR and rule-based extraction can be inaccurate. Verify every field before using this data clinically.",
  ];

  if (missingFields.length > 0) {
    warnings.push("Some fields were not detected and require manual review.");
  }

  if (data.medicines.some((medicine) => !medicine.name || !medicine.dosage)) {
    warnings.push("One or more medicine entries may be incomplete or incorrectly parsed.");
  }

  const detectedFieldCount = 5 - missingFields.filter((field) => !field.startsWith("medicines[")).length;
  const confidence = {
    overall: missingFields.length === 0 ? "medium" : "low",
    detectedFields: detectedFieldCount,
    totalTopLevelFields: 5,
  };

  return { data, missingFields, confidence, warnings };
}

module.exports = { extractPrescriptionData };