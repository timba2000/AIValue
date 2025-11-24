#!/bin/bash
set -e

echo "Seeding migration tracking table (first deployment only)..."
node dist/src/seed-migrations.js || true

echo "Applying any new database migrations..."
node dist/src/migrate.js || true

echo "Starting application..."
node dist/src/index.js
