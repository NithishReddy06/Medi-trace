const fs = require("fs");
const path = require("path");

const MODEL_PATH = path.join(__dirname, "..", "..", "ml", "logistic-regression-synthetic-v1.json");
const MODEL_VERSION = "logistic-regression-synthetic-v1";
const FEATURES = [
  "quantityRatio",
  "extremeQuantity",
  "repeatPrescription30d",
  "controlledMedicine",
  "patientAdverseHistory",
  "prescriberAdverseHistory",
];

function loadModel() {
  const model = JSON.parse(fs.readFileSync(MODEL_PATH, "utf8"));
  if (model.modelVersion !== MODEL_VERSION || !Array.isArray(model.weights) || model.weights.length !== FEATURES.length) {
    throw new Error("Fraud risk model artifact is missing or has an unsupported format.");
  }
  return model;
}

const model = loadModel();

function sigmoid(value) {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const expValue = Math.exp(value);
  return expValue / (1 + expValue);
}

function scoreFraudRisk(features) {
  const values = FEATURES.map((feature) => Number(features[feature]) || 0);
  const logit = model.bias + values.reduce((sum, value, index) => sum + value * model.weights[index], 0);
  const probability = sigmoid(logit);
  const riskScore = Math.round(probability * 10000) / 100;
  const riskLevel = riskScore >= 70 ? "high" : riskScore >= 35 ? "medium" : "low";
  const reasons = [];

  if (features.quantityRatio >= 0.7) reasons.push("Quantity is high relative to the synthetic model's review threshold.");
  if (features.repeatPrescription30d) reasons.push("The same medicine appears in a recent prescription within 30 days.");
  if (features.controlledMedicine) reasons.push("Medicine category matches the configured controlled or monitored category labels.");
  if (features.patientAdverseHistory) reasons.push("The patient has a prior rejected or escalated prescription in the record.");
  if (features.prescriberAdverseHistory) reasons.push("The prescriber has a prior rejected or escalated prescription in the record.");
  if (!reasons.length) reasons.push("No strong non-clinical warning pattern was identified by the synthetic model.");

  return {
    riskScore,
    riskLevel,
    reasons,
    features: Object.fromEntries(FEATURES.map((feature, index) => [feature, values[index]])),
    modelVersion: MODEL_VERSION,
    modelNotice: model.notice,
  };
}

module.exports = { FEATURES, MODEL_VERSION, scoreFraudRisk };
