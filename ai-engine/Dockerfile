# ========================================
# Stage 1: Build
# ========================================
FROM python:3.11-slim AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --user -r requirements.txt

# ========================================
# Stage 2: Production
# ========================================
FROM python:3.11-slim

# Create non-root user
RUN useradd -m -u 1001 -s /bin/bash aiengine && \
    mkdir -p /app && \
    chown -R aiengine:aiengine /app

# Set working directory
WORKDIR /app

# Copy installed packages from builder
COPY --from=builder --chown=aiengine:aiengine /root/.local /home/aiengine/.local

# Copy application code
COPY --chown=aiengine:aiengine . .

# Update PATH
ENV PATH=/home/aiengine/.local/bin:$PATH
ENV PYTHONPATH=/app

# Switch to non-root user
USER aiengine

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health').raise_for_status()"

# Start the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
