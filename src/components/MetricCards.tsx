import { AgentMetrics } from '../types';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

interface MetricCardsProps {
  metrics: AgentMetrics;
}

export function MetricCards({ metrics }: MetricCardsProps) {
  // Calculate total living agents (active + critical)
  const totalLivingAgents = metrics.activeAgents + metrics.criticalAgents;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-[#2F3336]/50">
        <div className="text-[#71767B] text-sm font-light mb-2">Total Living Agents</div>
        <div className="text-3xl font-light flex items-baseline">
          {totalLivingAgents}
          <span className={`text-sm ml-2 flex items-center ${
            metrics.weeklyGrowth >= 0 ? 'text-emerald-500/90' : 'text-red-500/90'
          }`}>
            {metrics.weeklyGrowth >= 0 ? (
              <ArrowUpIcon className="w-3 h-3 mr-1" />
            ) : (
              <ArrowDownIcon className="w-3 h-3 mr-1" />
            )}
            {Math.abs(metrics.weeklyGrowth).toFixed(1)}%
          </span>
        </div>
        <div className="text-[#71767B] text-xs mt-2 font-light">
          {metrics.criticalAgents} agents need attention
        </div>
      </div>

      <div className="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-[#2F3336]/50">
        <div className="text-[#71767B] text-sm font-light mb-2">Total A0X Burned</div>
        <div className="text-3xl font-light flex items-baseline">
          {metrics.totalBurned.toLocaleString()}
          <span className="text-[#1D9BF0]/90 text-sm ml-2">
            +{metrics.burnedLastWeek.toLocaleString()}
          </span>
        </div>
        <div className="text-[#71767B] text-xs mt-2 font-light flex items-center gap-2">
          <span>{((metrics.totalBurned / 100_000_000_000) * 100).toFixed(6)}% of total supply</span>
          <span className="opacity-50">•</span>
          <span>Across {metrics.totalAgents} agents</span>
        </div>
      </div>

      <div className="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-[#2F3336]/50">
        <div className="text-[#71767B] text-sm font-light mb-2">Average Extension</div>
        <div className="text-3xl font-light">
          {Math.round(metrics.averageLifeExtension)} days
        </div>
        <div className="text-[#71767B] text-xs mt-2 font-light">
          Based on recent extensions
        </div>
      </div>
    </div>
  );
} 