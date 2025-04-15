import { BurnRatePoint } from '../types';
import { Line, Doughnut } from 'react-chartjs-2';
import { format } from 'date-fns';

interface AnalyticsChartsProps {
  burnRateTrend: BurnRatePoint[];
  extensionDistribution: {
    range: string;
    count: number;
  }[];
}

export function AnalyticsCharts({ burnRateTrend, extensionDistribution }: AnalyticsChartsProps) {
  const burnRateData = {
    labels: burnRateTrend.map(point => format(point.timestamp, 'MMM d')),
    datasets: [
      {
        label: 'Burn Rate',
        data: burnRateTrend.map(point => point.rate),
        borderColor: '#1D9BF0',
        backgroundColor: 'rgba(29, 155, 240, 0.1)',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Moving Average',
        data: burnRateTrend.map(point => point.movingAverage),
        borderColor: '#10B981',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        borderDash: [5, 5],
      }
    ]
  };

  const distributionData = {
    labels: extensionDistribution.map(d => d.range),
    datasets: [{
      data: extensionDistribution.map(d => d.count),
      backgroundColor: [
        'rgba(29, 155, 240, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(139, 92, 246, 0.8)',
      ],
      borderWidth: 0,
    }]
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#71767B',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
        }
      }
    }
  };

  const burnRateOptions = {
    ...commonOptions,
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: '#71767B',
          maxRotation: 0,
        }
      },
      y: {
        grid: {
          color: '#1F2937',
          drawBorder: false
        },
        ticks: {
          color: '#94A3B8',
          callback: function(this: any, value: string | number) {
            return value.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0
            });
          }
        }
      }
    },
    plugins: {
      ...commonOptions.plugins,
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#E7E9EA',
        bodyColor: '#94A3B8',
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            const value = context.raw;
            const formattedValue = value.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0
            });
            return `${context.dataset.label}: ${formattedValue}`;
          }
        }
      },
      title: {
        display: true,
        text: 'Burn Rate Trends',
        color: '#E7E9EA',
        font: {
          size: 16,
          weight: 700
        },
        padding: { bottom: 20 }
      }
    }
  };

  const distributionOptions = {
    ...commonOptions,
    cutout: '70%',
    plugins: {
      ...commonOptions.plugins,
      title: {
        display: true,
        text: 'Extension Distribution',
        color: '#E7E9EA',
        font: {
          size: 16,
          weight: 700
        },
        padding: { bottom: 20 }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-black p-6 rounded-2xl border border-[#2F3336]">
        <div className="h-[300px]">
          <Line data={burnRateData} options={burnRateOptions} />
        </div>
      </div>
      <div className="bg-black p-6 rounded-2xl border border-[#2F3336]">
        <div className="h-[300px]">
          <Doughnut data={distributionData} options={distributionOptions} />
        </div>
      </div>
    </div>
  );
} 