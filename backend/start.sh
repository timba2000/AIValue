#!/bin/bash
set -e

echo "Starting application..."
cd /home/runner/workspace/backend
node dist/src/index.js
