# TaskManagement Monitoring Stack

This directory contains the complete monitoring infrastructure for the TaskManagement application, providing comprehensive observability, alerting, and performance monitoring capabilities.

## Overview

The monitoring stack includes:

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **AlertManager** - Alert routing and notification management
- **Jaeger** - Distributed tracing
- **Node Exporter** - System metrics collection
- **Postgres Exporter** - Database metrics
- **Redis Exporter** - Cache metrics
- **Uptime Kuma** - Uptime monitoring

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Applications  │───▶│   Prometheus    │───▶│     Grafana     │
│  (API, Web,     │    │   (Metrics)     │    │  (Dashboards)   │
│   Admin, Mobile)│    └─────────────────┘    └─────────────────┘
└─────────────────┘             │                       │
                                 │                       │
┌─────────────────┐             ▼                       │
│     Jaeger      │    ┌─────────────────┐             │
│   (Tracing)     │    │  AlertManager   │             │
└─────────────────┘    │  (Alerting)     │             │
                       └─────────────────┘             │
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Notifications   │    │ Admin Dashboard │
                       │ (Email, Slack)  │    │  (Integration)  │
                       └─────────────────┘    └─────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- PowerShell (Windows) or Bash (Linux/macOS)
- At least 4GB RAM available for monitoring stack

### Setup

1. **Run the setup script:**

   **Windows (PowerShell):**
   ```powershell
   .\monitoring\scripts\setup-monitoring.ps1
   ```

   **Linux/macOS (Bash):**
   ```bash
   ./monitoring/scripts/setup-monitoring.sh
   ```

2. **Configure environment variables:**
   
   Update the database connection string in `docker-compose.yml`:
   ```yaml
   postgres-exporter:
     environment:
       - DATA_SOURCE_NAME=postgresql://your_user:your_password@your_host:5432/taskmanagement?sslmode=disable
   ```

3. **Start the monitoring stack:**
   ```bash
   cd monitoring
   docker-compose up -d
   ```

4. **Verify services are running:**
   ```bash
   docker-compose ps
   ```

### Access URLs

Once the stack is running, access the following services:

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3000 | admin / admin123 |
| Prometheus | http://localhost:9090 | - |
| AlertManager | http://localhost:9093 | - |
| Jaeger | http://localhost:16686 | - |
| Uptime Kuma | http://localhost:3001 | Setup required |

## Configuration

### Prometheus Configuration

The Prometheus configuration (`prometheus/prometheus.yml`) includes scrape targets for:

- TaskManagement API (port 3000)
- Web Application (port 3001)  
- Admin Dashboard (port 3002)
- Database metrics (postgres-exporter)
- Cache metrics (redis-exporter)
- System metrics (node-exporter)

### Grafana Dashboards

Pre-configured dashboards are available in `grafana/dashboards/`:

1. **Application Performance** - API response times, request rates, error rates
2. **Business Metrics** - User engagement, feature usage, conversion rates
3. **Infrastructure Monitoring** - CPU, memory, disk, network usage

### Alert Rules

Alert rules are defined in `prometheus/rules/alerting-rules.yml`:

- **Infrastructure Alerts**: High CPU/memory/disk usage
- **Application Alerts**: High response times, error rates
- **Business Alerts**: Low user engagement, feature adoption

### Notification Configuration

AlertManager configuration (`alertmanager/alertmanager.yml`) supports:

- **Email notifications** for all alert severities
- **Slack integration** for critical and warning alerts
- **Alert grouping** and **silence management**

## Admin Dashboard Integration

The admin dashboard provides comprehensive monitoring integration:

### Features

1. **Real-time Metrics Display**
   - System health overview
   - Performance metrics
   - Service status monitoring

2. **Prometheus Integration**
   - Custom query execution
   - Metric visualization
   - Historical data analysis

3. **Grafana Dashboard Embedding**
   - Embedded dashboard views
   - Dashboard selection and configuration
   - Direct links to Grafana

4. **Alert Management**
   - Active alert monitoring
   - Alert silencing capabilities
   - Alert history and details

5. **Performance Monitoring**
   - Response time analysis
   - Throughput monitoring
   - Error rate tracking

### Configuration

Update the admin dashboard environment variables:

```env
# Monitoring Services
NEXT_PUBLIC_PROMETHEUS_URL=http://localhost:9090
NEXT_PUBLIC_GRAFANA_URL=http://localhost:3000
GRAFANA_API_KEY=your-grafana-api-key
NEXT_PUBLIC_ALERTMANAGER_URL=http://localhost:9093
NEXT_PUBLIC_JAEGER_URL=http://localhost:16686
```

## Maintenance

### Backup

Run the backup script to backup monitoring data:

**Windows:**
```powershell
.\monitoring\scripts\backup-monitoring.ps1
```

**Linux/macOS:**
```bash
./monitoring/scripts/backup-monitoring.sh
```

### Maintenance

Run routine maintenance:

**Windows:**
```powershell
.\monitoring\scripts\maintenance-monitoring.ps1
```

**Linux/macOS:**
```bash
./monitoring/scripts/maintenance-monitoring.sh
```

### Data Retention

- **Prometheus**: 200 hours (configurable in docker-compose.yml)
- **Jaeger**: 7 days (cleaned up by maintenance script)
- **Grafana**: Persistent (backed up by backup script)

## Troubleshooting

### Common Issues

1. **Services not starting:**
   - Check Docker daemon is running
   - Verify port availability (9090, 3000, 9093, 16686)
   - Check Docker Compose logs: `docker-compose logs [service-name]`

2. **No metrics in Grafana:**
   - Verify Prometheus is scraping targets: http://localhost:9090/targets
   - Check application metrics endpoints are accessible
   - Verify Prometheus datasource configuration in Grafana

3. **Alerts not firing:**
   - Check alert rules syntax in Prometheus: http://localhost:9090/rules
   - Verify AlertManager configuration: http://localhost:9093
   - Check notification channels (email/Slack configuration)

4. **High resource usage:**
   - Adjust retention periods in prometheus.yml
   - Reduce scrape intervals for non-critical metrics
   - Scale down non-essential exporters

### Logs

View service logs:
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs prometheus
docker-compose logs grafana
docker-compose logs alertmanager
```

### Health Checks

Check service health:
```bash
# Prometheus
curl http://localhost:9090/-/healthy

# Grafana
curl http://localhost:3000/api/health

# AlertManager
curl http://localhost:9093/-/healthy
```

## Security Considerations

1. **Change default passwords** in Grafana and other services
2. **Configure proper authentication** for production deployments
3. **Use HTTPS** for external access
4. **Restrict network access** to monitoring services
5. **Regularly update** container images for security patches

## Performance Optimization

1. **Adjust scrape intervals** based on requirements
2. **Use recording rules** for frequently queried metrics
3. **Configure appropriate retention periods**
4. **Monitor resource usage** of monitoring stack itself
5. **Use external storage** for long-term metric retention

## Production Deployment

For production deployment:

1. **Use external storage** for Prometheus and Grafana data
2. **Configure high availability** for critical components
3. **Set up proper backup and disaster recovery**
4. **Implement proper security measures**
5. **Configure external notification channels**
6. **Set up monitoring for the monitoring stack itself**

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review Docker Compose logs
3. Consult individual service documentation:
   - [Prometheus Documentation](https://prometheus.io/docs/)
   - [Grafana Documentation](https://grafana.com/docs/)
   - [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
   - [Jaeger Documentation](https://www.jaegertracing.io/docs/)

## Contributing

When adding new monitoring capabilities:

1. Update relevant configuration files
2. Add appropriate documentation
3. Test in development environment
4. Update this README with new features
5. Consider backward compatibility