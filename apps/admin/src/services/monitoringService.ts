import { z } from 'zod';

// Types for monitoring data
export interface PrometheusMetric {
  metric: Record<string, string>;
  value: [number, string];
}

export interface PrometheusQueryResult {
  status: string;
  data: {
    resultType: string;
    result: PrometheusMetric[];
  };
}

export interface GrafanaDashboard {
  id: number;
  uid: string;
  title: string;
  tags: string[];
  url: string;
  folderTitle: string;
}

export interface AlertRule {
  name: string;
  query: string;
  duration: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  state: 'inactive' | 'pending' | 'firing';
  activeAt?: string;
  value?: string;
}

export interface HealthCheck {
  name: string;
  status: 'UP' | 'DOWN' | 'UNKNOWN';
  responseTime: number;
  lastCheck: string;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    inbound: number;
    outbound: number;
  };
}

export interface PerformanceMetrics {
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  requestRate: number;
  errorRate: number;
  throughput: number;
}

// Configuration schema
const MonitoringConfigSchema = z.object({
  prometheus: z.object({
    url: z.string().url(),
    timeout: z.number().default(5000),
  }),
  grafana: z.object({
    url: z.string().url(),
    apiKey: z.string(),
    timeout: z.number().default(5000),
  }),
  alertmanager: z.object({
    url: z.string().url(),
    timeout: z.number().default(5000),
  }),
  jaeger: z.object({
    url: z.string().url(),
    timeout: z.number().default(5000),
  }),
});

type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;

class MonitoringService {
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = MonitoringConfigSchema.parse(config);
  }

  // Prometheus integration methods
  async queryPrometheus(query: string, time?: Date): Promise<PrometheusQueryResult> {
    const url = new URL('/api/v1/query', this.config.prometheus.url);
    url.searchParams.set('query', query);
    
    if (time) {
      url.searchParams.set('time', Math.floor(time.getTime() / 1000).toString());
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.prometheus.timeout),
    });

    if (!response.ok) {
      throw new Error(`Prometheus query failed: ${response.statusText}`);
    }

    return response.json();
  }

  async queryPrometheusRange(
    query: string,
    start: Date,
    end: Date,
    step: string = '15s'
  ): Promise<PrometheusQueryResult> {
    const url = new URL('/api/v1/query_range', this.config.prometheus.url);
    url.searchParams.set('query', query);
    url.searchParams.set('start', Math.floor(start.getTime() / 1000).toString());
    url.searchParams.set('end', Math.floor(end.getTime() / 1000).toString());
    url.searchParams.set('step', step);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.prometheus.timeout),
    });

    if (!response.ok) {
      throw new Error(`Prometheus range query failed: ${response.statusText}`);
    }

    return response.json();
  }

  // System metrics methods
  async getSystemMetrics(): Promise<SystemMetrics> {
    const [cpuResult, memoryResult, diskResult, networkInResult, networkOutResult] = await Promise.all([
      this.queryPrometheus('100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'),
      this.queryPrometheus('(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100'),
      this.queryPrometheus('(1 - (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"})) * 100'),
      this.queryPrometheus('rate(node_network_receive_bytes_total[5m])'),
      this.queryPrometheus('rate(node_network_transmit_bytes_total[5m])'),
    ]);

    return {
      cpu: {
        usage: parseFloat(cpuResult.data.result[0]?.value[1] || '0'),
        cores: 8, // This should come from node_cpu_seconds_total metric
      },
      memory: {
        used: 0, // Calculate from total and available
        total: 0, // Get from node_memory_MemTotal_bytes
        percentage: parseFloat(memoryResult.data.result[0]?.value[1] || '0'),
      },
      disk: {
        used: 0, // Calculate from filesystem metrics
        total: 0, // Get from node_filesystem_size_bytes
        percentage: parseFloat(diskResult.data.result[0]?.value[1] || '0'),
      },
      network: {
        inbound: parseFloat(networkInResult.data.result[0]?.value[1] || '0'),
        outbound: parseFloat(networkOutResult.data.result[0]?.value[1] || '0'),
      },
    };
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const [p50Result, p95Result, p99Result, requestRateResult, errorRateResult] = await Promise.all([
      this.queryPrometheus('histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))'),
      this.queryPrometheus('histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))'),
      this.queryPrometheus('histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))'),
      this.queryPrometheus('sum(rate(http_requests_total[5m]))'),
      this.queryPrometheus('sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))'),
    ]);

    const requestRate = parseFloat(requestRateResult.data.result[0]?.value[1] || '0');

    return {
      responseTime: {
        p50: parseFloat(p50Result.data.result[0]?.value[1] || '0') * 1000, // Convert to ms
        p95: parseFloat(p95Result.data.result[0]?.value[1] || '0') * 1000,
        p99: parseFloat(p99Result.data.result[0]?.value[1] || '0') * 1000,
      },
      requestRate,
      errorRate: parseFloat(errorRateResult.data.result[0]?.value[1] || '0'),
      throughput: requestRate,
    };
  }

  // Grafana integration methods
  async getGrafanaDashboards(): Promise<GrafanaDashboard[]> {
    const response = await fetch(`${this.config.grafana.url}/api/search?type=dash-db`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.grafana.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.grafana.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Grafana dashboards: ${response.statusText}`);
    }

    return response.json();
  }

  async getGrafanaDashboardUrl(uid: string, params?: Record<string, string>): Promise<string> {
    const url = new URL(`/d/${uid}`, this.config.grafana.url);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    return url.toString();
  }

  // AlertManager integration methods
  async getActiveAlerts(): Promise<AlertRule[]> {
    const response = await fetch(`${this.config.alertmanager.url}/api/v1/alerts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.alertmanager.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch alerts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  async silenceAlert(alertId: string, duration: string, comment: string): Promise<void> {
    const response = await fetch(`${this.config.alertmanager.url}/api/v1/silences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        matchers: [{ name: 'alertname', value: alertId }],
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + this.parseDuration(duration)).toISOString(),
        comment,
        createdBy: 'admin-dashboard',
      }),
      signal: AbortSignal.timeout(this.config.alertmanager.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to silence alert: ${response.statusText}`);
    }
  }

  // Health check methods
  async performHealthChecks(): Promise<HealthCheck[]> {
    const services = [
      { name: 'API Server', url: '/health' },
      { name: 'Database', url: '/health/database' },
      { name: 'Redis Cache', url: '/health/cache' },
      { name: 'File Storage', url: '/health/storage' },
    ];

    const healthChecks = await Promise.allSettled(
      services.map(async (service) => {
        const startTime = Date.now();
        try {
          const response = await fetch(service.url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });
          
          const responseTime = Date.now() - startTime;
          const details = response.ok ? await response.json() : null;

          return {
            name: service.name,
            status: response.ok ? 'UP' : 'DOWN',
            responseTime,
            lastCheck: new Date().toISOString(),
            details,
          } as HealthCheck;
        } catch (error) {
          return {
            name: service.name,
            status: 'DOWN',
            responseTime: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
            details: { error: error instanceof Error ? error.message : 'Unknown error' },
          } as HealthCheck;
        }
      })
    );

    return healthChecks
      .filter((result): result is PromiseFulfilledResult<HealthCheck> => result.status === 'fulfilled')
      .map(result => result.value);
  }

  // Jaeger integration methods
  async getTraceServices(): Promise<string[]> {
    const response = await fetch(`${this.config.jaeger.url}/api/services`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.jaeger.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Jaeger services: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  async searchTraces(service: string, operation?: string, limit: number = 20): Promise<any[]> {
    const url = new URL('/api/traces', this.config.jaeger.url);
    url.searchParams.set('service', service);
    url.searchParams.set('limit', limit.toString());
    
    if (operation) {
      url.searchParams.set('operation', operation);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.config.jaeger.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to search traces: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  // Utility methods
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: throw new Error(`Unknown duration unit: ${unit}`);
    }
  }

  // Configuration management
  async updateConfiguration(newConfig: Partial<MonitoringConfig>): Promise<void> {
    this.config = MonitoringConfigSchema.parse({ ...this.config, ...newConfig });
  }

  getConfiguration(): MonitoringConfig {
    return { ...this.config };
  }
}

// Create singleton instance
const monitoringConfig: MonitoringConfig = {
  prometheus: {
    url: process.env.NEXT_PUBLIC_PROMETHEUS_URL || 'http://localhost:9090',
    timeout: 5000,
  },
  grafana: {
    url: process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://localhost:3000',
    apiKey: process.env.GRAFANA_API_KEY || '',
    timeout: 5000,
  },
  alertmanager: {
    url: process.env.NEXT_PUBLIC_ALERTMANAGER_URL || 'http://localhost:9093',
    timeout: 5000,
  },
  jaeger: {
    url: process.env.NEXT_PUBLIC_JAEGER_URL || 'http://localhost:16686',
    timeout: 5000,
  },
};

export const monitoringService = new MonitoringService(monitoringConfig);
export default MonitoringService;