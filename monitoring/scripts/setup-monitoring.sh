#!/bin/bash

# TaskManagement Monitoring Stack Setup Script
# This script sets up the complete monitoring infrastructure

set -e

echo "🚀 Setting up TaskManagement Monitoring Stack..."

# Create necessary directories
echo "📁 Creating monitoring directories..."
mkdir -p monitoring/{grafana/{dashboards,provisioning/{dashboards,datasources}},prometheus/{rules,data},alertmanager/{templates,data},jaeger/data,elk/{elasticsearch,logstash,kibana},uptime/data}

# Set proper permissions
echo "🔐 Setting up permissions..."
sudo chown -R 472:472 monitoring/grafana/
sudo chown -R 65534:65534 monitoring/prometheus/
sudo chown -R 65534:65534 monitoring/alertmanager/

# Create Grafana provisioning configs
echo "📊 Setting up Grafana provisioning..."
cat > monitoring/grafana/provisioning/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    jsonData:
      timeInterval: "5s"
EOF

cat > monitoring/grafana/provisioning/dashboards/dashboards.yml << EOF
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

# Create Docker Compose for monitoring stack
echo "🐳 Creating Docker Compose configuration..."
cat > monitoring/docker-compose.yml << EOF
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: taskmanagement-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./prometheus/rules:/etc/prometheus/rules
      - ./prometheus/data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    restart: unless-stopped
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: taskmanagement-grafana
    ports:
      - "3000:3000"
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    restart: unless-stopped
    networks:
      - monitoring

  alertmanager:
    image: prom/alertmanager:latest
    container_name: taskmanagement-alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - ./alertmanager/templates:/etc/alertmanager/templates
      - ./alertmanager/data:/alertmanager
    restart: unless-stopped
    networks:
      - monitoring

  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: taskmanagement-jaeger
    ports:
      - "16686:16686"
      - "14268:14268"
      - "14250:14250"
      - "6831:6831/udp"
      - "6832:6832/udp"
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    volumes:
      - ./jaeger/data:/tmp
    restart: unless-stopped
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:latest
    container_name: taskmanagement-node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    restart: unless-stopped
    networks:
      - monitoring

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: taskmanagement-postgres-exporter
    ports:
      - "9187:9187"
    environment:
      - DATA_SOURCE_NAME=postgresql://username:password@postgres:5432/taskmanagement?sslmode=disable
    restart: unless-stopped
    networks:
      - monitoring

  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: taskmanagement-redis-exporter
    ports:
      - "9121:9121"
    environment:
      - REDIS_ADDR=redis://redis:6379
    restart: unless-stopped
    networks:
      - monitoring

  uptime-kuma:
    image: louislam/uptime-kuma:latest
    container_name: taskmanagement-uptime
    ports:
      - "3001:3001"
    volumes:
      - ./uptime/data:/app/data
    restart: unless-stopped
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge
EOF

echo "✅ Monitoring stack setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Update the database connection string in postgres-exporter service"
echo "2. Configure Slack webhook URLs in alertmanager.yml"
echo "3. Update email credentials in alertmanager.yml and uptime-config.yml"
echo "4. Run: cd monitoring && docker-compose up -d"
echo ""
echo "📊 Access URLs:"
echo "- Grafana: http://localhost:3000 (admin/admin123)"
echo "- Prometheus: http://localhost:9090"
echo "- AlertManager: http://localhost:9093"
echo "- Jaeger: http://localhost:16686"
echo "- Uptime Kuma: http://localhost:3001"