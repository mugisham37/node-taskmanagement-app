#!/bin/bash

# TaskManagement Monitoring Backup Script
# This script backs up monitoring data and configurations

set -e

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
RETENTION_DAYS=30

echo "🔄 Starting monitoring backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup Prometheus data
echo "📊 Backing up Prometheus data..."
if [ -d "./prometheus/data" ]; then
    tar -czf "$BACKUP_DIR/prometheus-data.tar.gz" -C ./prometheus data/
    echo "✅ Prometheus data backed up"
else
    echo "⚠️ Prometheus data directory not found"
fi

# Backup Grafana dashboards and config
echo "📈 Backing up Grafana configuration..."
if [ -d "./grafana" ]; then
    tar -czf "$BACKUP_DIR/grafana-config.tar.gz" -C . grafana/
    echo "✅ Grafana configuration backed up"
else
    echo "⚠️ Grafana directory not found"
fi

# Backup AlertManager configuration
echo "🚨 Backing up AlertManager configuration..."
if [ -d "./alertmanager" ]; then
    tar -czf "$BACKUP_DIR/alertmanager-config.tar.gz" -C . alertmanager/
    echo "✅ AlertManager configuration backed up"
else
    echo "⚠️ AlertManager directory not found"
fi

# Backup Jaeger data
echo "🔍 Backing up Jaeger data..."
if [ -d "./jaeger/data" ]; then
    tar -czf "$BACKUP_DIR/jaeger-data.tar.gz" -C ./jaeger data/
    echo "✅ Jaeger data backed up"
else
    echo "⚠️ Jaeger data directory not found"
fi

# Backup Uptime Kuma data
echo "⏰ Backing up Uptime Kuma data..."
if [ -d "./uptime/data" ]; then
    tar -czf "$BACKUP_DIR/uptime-data.tar.gz" -C ./uptime data/
    echo "✅ Uptime Kuma data backed up"
else
    echo "⚠️ Uptime Kuma data directory not found"
fi

# Create backup manifest
echo "📋 Creating backup manifest..."
cat > "$BACKUP_DIR/manifest.txt" << EOF
TaskManagement Monitoring Backup
Created: $(date)
Backup Directory: $BACKUP_DIR

Contents:
- prometheus-data.tar.gz: Prometheus time series data
- grafana-config.tar.gz: Grafana dashboards and configuration
- alertmanager-config.tar.gz: AlertManager rules and configuration
- jaeger-data.tar.gz: Jaeger tracing data
- uptime-data.tar.gz: Uptime Kuma monitoring data

Restore Instructions:
1. Stop monitoring services: docker-compose down
2. Extract backups to respective directories
3. Restore permissions: sudo chown -R 472:472 grafana/ && sudo chown -R 65534:65534 prometheus/ alertmanager/
4. Start services: docker-compose up -d
EOF

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "📦 Backup completed successfully!"
echo "📍 Location: $BACKUP_DIR"
echo "📏 Size: $BACKUP_SIZE"

# Clean up old backups
echo "🧹 Cleaning up old backups (older than $RETENTION_DAYS days)..."
find ./backups -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
echo "✅ Cleanup completed"

echo ""
echo "🎯 Backup Summary:"
echo "- Backup location: $BACKUP_DIR"
echo "- Backup size: $BACKUP_SIZE"
echo "- Retention: $RETENTION_DAYS days"