#!/bin/sh
set -e

# Run any pre-start commands here (e.g., database migrations, environment setup)

# Start the application
exec "$@"