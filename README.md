# Bhavan Booking Management System

## Background Jobs (Redis + BullMQ)

- The booking expiry scheduler now uses Redis + BullMQ instead of in-process cron execution.
- API instances register the repeatable job in Redis (deduplicated by BullMQ).
- A dedicated worker process consumes jobs, so each job executes only once even with multiple API instances.

### Run commands

- API server: npm run start
- Booking worker: npm run worker:booking
- Boundary check: npm run lint:boundaries

### When to run each command

- `npm run start`: Start the HTTP API process.
- `npm run worker:booking`: Start the background worker process that executes queued booking jobs. Keep this running in parallel with the API in development and production.
- `npm run lint:boundaries`: Run before commits/PRs to ensure service-layer module boundaries are not violated.

### Environment variables

- REDIS_HOST
- REDIS_PORT
- REDIS_PASSWORD (optional)
