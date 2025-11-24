#!/bin/bash
set -e

echo "Seeding migration tracking table (first deployment only)..."
node dist/src/seed-migrations.js || echo "Migration tracking already set up"

echo "Applying any new database migrations..."
node dist/src/migrate.js

echo "Starting application..."
node dist/src/index.js
