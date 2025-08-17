'use client';

import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    ChartOptions,
    Legend,
    LinearScale,
    Title,
    Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface FeatureUsage {
  feature: string;
  usage: number;
  growth: number;
}

interface FeatureUsageChartProps {
  data: FeatureUsage[];
}

export function FeatureUsageChart({ data }: FeatureUsageChartProps) {
  const chartData = {
    labels: data.map(d => d.feature),
    datasets: [
      {
        label: 'Usage Rate (%)',
        data: data.map(d => d.usage),
        backgroundColor: data.map(d => 
          d.growth >= 0 
            ? 'rgba(16, 185, 129, 0.8)' 
            : 'rgba(239, 68, 68, 0.8)'
        ),
        borderColor: data.map(d => 
          d.growth >= 0 
            ? 'rgb(16, 185, 129)' 
            : 'rgb(239, 68, 68)'
        ),
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          afterLabel: (context) => {
            const dataIndex = context.dataIndex;
            const growth = data[dataIndex].growth;
            return `Growth: ${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Features',
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Usage Rate (%)',
        },
        min: 0,
        max: 100,
      },
    },
  };

  return (
    <div className="h-64">
      <Bar data={chartData} options={options} />
    </div>
  );
}