'use client';

import {
  CategoryScale,
  Chart as ChartJS,
  ChartOptions,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature: number;
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

interface SystemMetricsChartProps {
  metrics: SystemMetrics;
}

interface MetricsHistory {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
}

export function SystemMetricsChart({ metrics }: SystemMetricsChartProps) {
  const [history, setHistory] = useState<MetricsHistory[]>([]);

  // Initialize with some historical data
  useEffect(() => {
    const initialHistory: MetricsHistory[] = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000); // 1 minute intervals
      initialHistory.push({
        timestamp: timestamp.toLocaleTimeString(),
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        disk: Math.random() * 100,
      });
    }
    
    setHistory(initialHistory);
  }, []);

  // Update history with new metrics
  useEffect(() => {
    const newEntry: MetricsHistory = {
      timestamp: new Date().toLocaleTimeString(),
      cpu: metrics.cpu.usage,
      memory: metrics.memory.percentage,
      disk: metrics.disk.percentage,
    };

    setHistory(prev => {
      const updated = [...prev.slice(1), newEntry]; // Keep last 30 entries
      return updated;
    });
  }, [metrics]);

  const chartData = {
    labels: history.map(h => h.timestamp),
    datasets: [
      {
        label: 'CPU Usage (%)',
        data: history.map(h => h.cpu),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: false,
      },
      {
        label: 'Memory Usage (%)',
        data: history.map(h => h.memory),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: false,
      },
      {
        label: 'Disk Usage (%)',
        data: history.map(h => h.disk),
        borderColor: 'rgb(139, 92, 246)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4,
        fill: false,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time',
        },
        ticks: {
          maxTicksLimit: 6,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Usage (%)',
        },
        min: 0,
        max: 100,
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
    elements: {
      point: {
        radius: 2,
        hoverRadius: 4,
      },
    },
  };

  return (
    <div className="h-64">
      <Line data={chartData} options={options} />
    </div>
  );
}