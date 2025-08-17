#!/bin/bash

# TaskManagement Monitoring Maintenance Script
# This script performs routine maintenance tasks for the monitoring stack

set -e

echo "🔧 Starting monitoring stack maintenance..."

# Function to check service health
check_service_health() {
    local service_name=$1
    local health_url=$2
    
    echo "🏥 Checking $service_name health..."
    if curl -f -s "$health_url" > /dev/null; then
        echo "✅ $service_name is healthy"
        return 0
    else
        echo "❌ $service_name is unhealthy"
        return 1
    fi
}

# Function to restart unhealthy services
restart_service() {
    local service_name=$1
    echo "🔄 Restarting $service_name..."
    docker-compose restart "$service_name"
    sleep 10
}

# Check and restart services if needed
echo "🔍 Performing health checks..."

# Check Prometheus
if ! check_service_health "Prometheus" "http://localhost:9090/-/healthy"; then
    restart_service "prometheus"
fi

# Check Grafana
if ! check_service_health "Grafana" "http://localhost:3000/api/health"; then
    restart_service "grafana"
fi

# Check AlertManager
if ! check_service_health "AlertManager" "http://localhost:9093/-/healthy"; then
    restart_service "alertmanager"
fi

# Check Jaeger
if ! check_service_health "Jaeger" "http://localhost:16686/"; then
    restart_service "jaeger"
fi

# Clean up old Prometheus data
echo "🧹 Cleaning up old Prometheus data..."
PROMETHEUS_DATA_DIR="./prometheus/data"
if [ -d "$PROMETHEUS_DATA_DIR" ]; then
    # Remove data older than 30 days
    find "$PROMETHEUS_DATA_DIR" -name "*.db" -mtime +30 -delete 2>/dev/null || true
    echo "✅ Old Prometheus data cleaned up"
fi

# Clean up old Jaeger traces
echo "🧹 Cleaning up old Jaeger traces..."
JAEGER_DATA_DIR="./jaeger/data"
if [ -d "$JAEGER_DATA_DIR" ]; then
    # Remove traces older than 7 days
    find "$JAEGER_DATA_DIR" -name "*.json" -mtime +7 -delete 2>/dev/null || true
    echo "✅ Old Jaeger traces cleaned up"
fi

# Optimize Grafana database
echo "🗄️ Optimizing Grafana database..."
docker-compose exec grafana sqlite3 /var/lib/grafana/grafana.db "VACUUM;" 2>/dev/null || echo "⚠️ Could not optimize Grafana database"

# Check disk usage
echo "💾 Checking disk usage..."
MONITORING_USAGE=$(du -sh . | cut -f1)
echo "📊 Current monitoring data usage: $MONITORING_USAGE"

# Check for high disk usage (>80%)
DISK_USAGE=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️ WARNING: Disk usage is at ${DISK_USAGE}%"
    echo "🧹 Consider running cleanup or increasing disk space"
fi

# Update container images
echo "🔄 Updating container images..."
docker-compose pull

# Restart services with updated images
echo "🔄 Restarting services with updated images..."
docker-compose up -d

# Verify all services are running
echo "✅ Verifying all services are running..."
docker-compose ps

# Generate maintenance report
REPORT_FILE="./maintenance-reports/maintenance-$(date +%Y%m%d_%H%M%S).log"
mkdir -p ./maintenance-reports

cat > "$REPORT_FILE" << EOF
TaskManagement Monitoring Maintenance Report
Generated: $(date)

Service Status:
$(docker-compose ps)

Disk Usage:
- Monitoring data: $MONITORING_USAGE
- Disk usage: ${DISK_USAGE}%

Maintenance Actions Performed:
- Health checks completed
- Old data cleaned up
- Container images updated
- Services restarted
- Database optimized

Next Maintenance: $(date -d '+1 week')
EOF

echo "📋 Maintenance report saved to: $REPORT_FILE"

echo ""
echo "✅ Monitoring maintenance completed successfully!"
echo "📊 Service status:"
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"