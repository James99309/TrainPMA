#!/bin/sh
# Docker entrypoint script for TrainPMA backend
# Handles database initialization and migrations

set -e

echo "🚀 Starting TrainPMA backend..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
MAX_RETRIES=30
RETRY_COUNT=0
until python -c "
import os, psycopg2
url = os.getenv('DATABASE_URL', 'postgresql://pma:pma_secure_password_2025@pma-postgres:5432/trainpma')
conn = psycopg2.connect(url)
conn.close()
print('PostgreSQL is ready')
" 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ PostgreSQL not available after $MAX_RETRIES retries"
        exit 1
    fi
    echo "  Retry $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done

# Initialize or run migrations
if [ -d "migrations" ]; then
    echo "📦 Running database migrations..."
    flask db upgrade
else
    echo "🆕 First run: initializing database..."
    flask db init
    flask db migrate -m "Initial migration"
    flask db upgrade
fi

echo "✅ Database ready"

# Start gunicorn
PORT=${PORT:-5007}
echo "🌐 Starting gunicorn on port $PORT..."
exec gunicorn --bind "0.0.0.0:$PORT" --workers 2 --timeout 120 run:app
