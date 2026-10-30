const REQUEST_BUCKETS_SECONDS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
const requestCounters = new Map();
const errorCounters = new Map();
const durationHistograms = new Map();
const safetyAlertCounters = new Map();
const fraudAssessmentCounters = new Map();
const prescriptionReviewCounters = new Map();

function labelsKey(labels) {
  return JSON.stringify(Object.keys(labels).sort().map((name) => [name, String(labels[name])]));
}

function increment(counter, labels, amount = 1) {
  const key = labelsKey(labels);
  const current = counter.get(key) || { labels, value: 0 };
  current.value += amount;
  counter.set(key, current);
}

function observeDuration(labels, seconds) {
  const key = labelsKey(labels);
  let current = durationHistograms.get(key);
  if (!current) {
    current = { labels, count: 0, sum: 0, buckets: REQUEST_BUCKETS_SECONDS.map(() => 0) };
    durationHistograms.set(key, current);
  }
  current.count += 1;
  current.sum += seconds;
  REQUEST_BUCKETS_SECONDS.forEach((bound, index) => {
    if (seconds <= bound) current.buckets[index] += 1;
  });
}

function escapeLabel(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function renderLabels(labels, extra = {}) {
  const merged = { ...labels, ...extra };
  return `{${Object.keys(merged).sort().map((name) => `${name}="${escapeLabel(merged[name])}"`).join(",")}}`;
}

function renderCounter(name, help, counter) {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`];
  for (const entry of counter.values()) lines.push(`${name}${renderLabels(entry.labels)} ${entry.value}`);
  return lines;
}

function requestMetrics(request, response, next) {
  if (request.path === "/metrics") return next();
  const startedAt = process.hrtime.bigint();
  response.on("finish", () => {
    const routePath = request.route
      ? `${request.baseUrl || ""}${String(request.route.path)}`
      : "unmatched";
    const method = request.method.toUpperCase();
    const status = String(response.statusCode);
    const requestLabels = { method, path: routePath, status };
    increment(requestCounters, requestLabels);
    if (response.statusCode >= 400) increment(errorCounters, requestLabels);
    const elapsedSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    observeDuration({ method, path: routePath }, elapsedSeconds);
  });
  next();
}

function recordSafetyAlerts(alerts) {
  for (const alert of alerts) increment(safetyAlertCounters, { severity: alert.severity || "unknown" });
}

function recordFraudAssessment(riskLevel) {
  increment(fraudAssessmentCounters, { risk_level: riskLevel || "unknown" });
}

function recordPrescriptionReview(status) {
  increment(prescriptionReviewCounters, { status: status || "unknown" });
}

function renderHistogram() {
  const name = "meditrace_http_request_duration_seconds";
  const lines = [`# HELP ${name} HTTP response time in seconds.`, `# TYPE ${name} histogram`];
  for (const entry of durationHistograms.values()) {
    REQUEST_BUCKETS_SECONDS.forEach((bound, index) => {
      lines.push(`${name}_bucket${renderLabels(entry.labels, { le: bound })} ${entry.buckets[index]}`);
    });
    lines.push(`${name}_bucket${renderLabels(entry.labels, { le: "+Inf" })} ${entry.count}`);
    lines.push(`${name}_sum${renderLabels(entry.labels)} ${entry.sum}`);
    lines.push(`${name}_count${renderLabels(entry.labels)} ${entry.count}`);
  }
  return lines;
}

function renderMetrics() {
  return [
    ...renderCounter("meditrace_http_requests_total", "Completed HTTP requests.", requestCounters),
    ...renderCounter("meditrace_http_errors_total", "HTTP responses with a 4xx or 5xx status.", errorCounters),
    ...renderHistogram(),
    ...renderCounter("meditrace_safety_alerts_flagged_total", "Safety alerts returned by pharmacist safety checks, by severity.", safetyAlertCounters),
    ...renderCounter("meditrace_fraud_assessments_total", "Saved fraud-risk assessments, by risk level.", fraudAssessmentCounters),
    ...renderCounter("meditrace_prescription_reviews_total", "Saved pharmacist prescription decisions, by status.", prescriptionReviewCounters),
    "",
  ].join("\n");
}

module.exports = {
  requestMetrics,
  recordSafetyAlerts,
  recordFraudAssessment,
  recordPrescriptionReview,
  renderMetrics,
};
