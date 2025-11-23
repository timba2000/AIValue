#!/bin/bash
set -e

echo "Running database migrations..."
node dist/src/migrate.js || echo "Migrations completed"

echo "Starting application..."
node dist/src/index.js
