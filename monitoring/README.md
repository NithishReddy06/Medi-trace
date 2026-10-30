# MediTrace monitoring

Prometheus scrapes the backend's `/metrics` endpoint every 15 seconds. Grafana provisions the Prometheus datasource and the MediTrace Operations dashboard automatically.

## Start

1. Use the local `monitoring/.env` Grafana credentials (the file is ignored by Git). On a fresh checkout, copy `.env.example` to `.env` and replace its placeholder with a unique local password.
2. Start the backend on port 5000 so Prometheus can scrape it.
3. From this folder, run `docker compose up -d`.
4. Open Grafana at `http://localhost:3000` and sign in with the configured admin username and password. The dashboard is named **MediTrace Operations**.
5. Prometheus is available at `http://localhost:9090`; the backend metrics endpoint is `http://localhost:5000/metrics`.

The dashboard charts request volume, errors, p95 response time, safety alerts by severity, fraud assessments by risk level, and pharmacist decisions by status. Counters are process-local and reset when the backend restarts; use database records for historical audit totals.
