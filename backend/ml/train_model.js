const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "synthetic_training_data.csv");
const MODEL_PATH = path.join(__dirname, "logistic-regression-synthetic-v1.json");
const MODEL_VERSION = "logistic-regression-synthetic-v1";
const FEATURE_NAMES = ["quantity_ratio", "extreme_quantity", "repeat_30d", "controlled_category", "patient_history", "prescriber_history"];
const SEED = 20261030;

function randomGenerator(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeDataset() {
  const random = randomGenerator(SEED);
  const rows = [];
  for (let index = 0; index < 600; index += 1) {
    const quantityRatio = Math.round(random() * 100) / 100;
    const extremeQuantity = Number(quantityRatio >= 0.85);
    const repeat30d = Number(random() < 0.16);
    const controlledCategory = Number(random() < 0.13);
    const patientHistory = Number(random() < 0.12);
    const prescriberHistory = Number(random() < 0.1);
    const rawRisk = -4.4 + quantityRatio * 3.0 + extremeQuantity * 1.25 + repeat30d * 1.1
      + controlledCategory * 0.85 + patientHistory * 1.4 + prescriberHistory * 1.0;
    const probability = 1 / (1 + Math.exp(-rawRisk));
    const label = Number(random() < probability);
    rows.push([quantityRatio, extremeQuantity, repeat30d, controlledCategory, patientHistory, prescriberHistory, label]);
  }
  const header = [...FEATURE_NAMES, "synthetic_label"].join(",");
  fs.writeFileSync(DATA_PATH, [header, ...rows.map((row) => row.join(","))].join("\n") + "\n");
  return rows;
}

function sigmoid(value) {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const expValue = Math.exp(value);
  return expValue / (1 + expValue);
}

function train(rows) {
  const shuffled = [...rows];
  const random = randomGenerator(SEED + 1);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  const split = Math.floor(shuffled.length * 0.8);
  const training = shuffled.slice(0, split);
  const testing = shuffled.slice(split);
  const weights = Array(FEATURE_NAMES.length).fill(0);
  let bias = 0;
  const learningRate = 0.08;
  const epochs = 2500;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradients = Array(FEATURE_NAMES.length).fill(0);
    let biasGradient = 0;
    for (const row of training) {
      const features = row.slice(0, FEATURE_NAMES.length);
      const error = sigmoid(bias + features.reduce((sum, value, index) => sum + value * weights[index], 0)) - row[FEATURE_NAMES.length];
      biasGradient += error;
      features.forEach((value, index) => { gradients[index] += error * value; });
    }
    bias -= learningRate * biasGradient / training.length;
    weights.forEach((weight, index) => { weights[index] -= learningRate * gradients[index] / training.length; });
  }

  let correct = 0;
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  for (const row of testing) {
    const probability = sigmoid(bias + row.slice(0, FEATURE_NAMES.length).reduce((sum, value, index) => sum + value * weights[index], 0));
    const predicted = Number(probability >= 0.5);
    const actual = row[FEATURE_NAMES.length];
    if (predicted === actual) correct += 1;
    if (predicted && actual) truePositive += 1;
    if (predicted && !actual) falsePositive += 1;
    if (!predicted && actual) falseNegative += 1;
  }
  const metrics = {
    testRows: testing.length,
    accuracy: Number((correct / testing.length).toFixed(4)),
    precision: Number((truePositive / Math.max(1, truePositive + falsePositive)).toFixed(4)),
    recall: Number((truePositive / Math.max(1, truePositive + falseNegative)).toFixed(4)),
  };
  return { weights, bias, metrics };
}

const rows = makeDataset();
const fitted = train(rows);
const artifact = {
  modelVersion: MODEL_VERSION,
  algorithm: "binary logistic regression; batch gradient descent",
  dataset: "synthetic_training_data.csv",
  datasetRows: rows.length,
  featureNames: FEATURE_NAMES,
  weights: fitted.weights.map((weight) => Number(weight.toFixed(8))),
  bias: Number(fitted.bias.toFixed(8)),
  evaluation: fitted.metrics,
  notice: "Synthetic coursework prototype. Trained only on generated labels; not validated for clinical, fraud, or production use.",
  decisionPolicy: "Risk assessment is advisory. A pharmacist makes every prescription decision.",
};
fs.writeFileSync(MODEL_PATH, JSON.stringify(artifact, null, 2) + "\n");
process.stdout.write(`${JSON.stringify({ modelVersion: MODEL_VERSION, datasetRows: rows.length, evaluation: fitted.metrics })}\n`);
