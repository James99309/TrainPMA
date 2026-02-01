FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser

# Set Flask app for migrations
ENV FLASK_APP=run.py

# Expose port (default 5005, overridden by PORT env var)
EXPOSE 5005

# Health check (uses PORT env var, defaults to 5005)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://localhost:{os.getenv(\"PORT\",\"5005\")}/api/health')" || exit 1

# Start command via entrypoint script (already copied via COPY . .)
CMD ["sh", "entrypoint.sh"]
