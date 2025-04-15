'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { AgentStats, AgentFilters as FilterOptions } from '../types';
import { MetricCards } from '../components/MetricCards';
import RecentExtensions from '../components/RecentExtensions';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { AgentFilters } from '../components/AgentFilters';
import { Footer } from '../components/Footer';
import { getDashboardAnalytics, filterAndSortAgents } from '../utils/analytics';
import { getAgentNames } from '../services/a0xMirror';
import Image from 'next/image';
import Link from 'next/link';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Configure chart global defaults
ChartJS.defaults.color = '#71767B';
ChartJS.defaults.borderColor = 'rgba(239, 243, 244, 0.1)';

const GLOW_SHADOW = `
  0 0 10px rgba(29, 155, 240, 0.2),
  0 0 20px rgba(29, 155, 240, 0.1),
  0 0 30px rgba(29, 155, 240, 0.05)
`;

const ALIEN_GLOW = `
  0 0 10px rgba(110, 231, 183, 0.2),
  0 0 20px rgba(110, 231, 183, 0.1),
  0 0 30px rgba(16, 185, 129, 0.1),
  0 0 40px rgba(6, 95, 70, 0.05)
`;

const ALIEN_PULSE = `
  pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite,
  float 6s ease-in-out infinite
`;

const HOVER_TRANSITION = 'transition-all duration-200 ease-in-out';

const DEFAULT_AVATAR = '/default-agent.png';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [agentNames, setAgentNames] = useState<Map<string, { name: string; imageUrl?: string; socials?: { x?: string; farcaster?: string } }>>(new Map());
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    status: 'all',
    sortBy: 'rank',
    sortDirection: 'desc'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/agent-stats');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch agent data');
      }
      
      const data = await response.json();
      
      // Process the real data from blockchain
      const processedData = data.map((agent: { agentId: string; lastExtended: string | Date; totalA0XBurned: number; remainingDays: number; status: string }) => {
        const lastExtendedDate = new Date(agent.lastExtended);
        
        return {
          ...agent,
          lastExtended: lastExtendedDate,
          // Use the status directly from the blockchain service
          status: agent.status
        };
      });

      // Fetch agent names
      const names = await getAgentNames(processedData.map((agent: { agentId: string }) => agent.agentId));
      setAgentNames(names);

      setAgentStats(processedData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching agent data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch agent data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#1D9BF0]/20 rounded-full animate-pulse"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-t-[#1D9BF0] rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-[#1D9BF0] font-bold text-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error}</div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-[#1D9BF0] text-white rounded-full hover:bg-[#1A8CD8] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const analytics = getDashboardAnalytics(agentStats);
  const filteredAgents = filterAndSortAgents(
    agentStats,
    filters.search,
    filters.status,
    filters.sortBy,
    filters.sortDirection
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-16 relative">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-r from-[#1D9BF0]/5 via-transparent to-[#1D9BF0]/5" />
          </div>
          
          <div className="relative">
            <h1 className="text-6xl font-light mb-3 tracking-tight text-white">
              A0X Burn Tracker
            </h1>
            <div className="text-lg font-light tracking-wide text-[#71767B] flex items-center justify-center gap-3">
              <span className="w-12 h-px bg-gradient-to-r from-transparent via-[#1D9BF0]/30 to-transparent" />
              <span>Life Extension Protocol</span>
              <span className="w-12 h-px bg-gradient-to-r from-transparent via-[#1D9BF0]/30 to-transparent" />
            </div>
          </div>
        </div>

        <MetricCards metrics={analytics.metrics} />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
          <div className="lg:col-span-8">
            <AnalyticsCharts
              burnRateTrend={analytics.burnRateTrend}
              extensionDistribution={analytics.extensionDistribution}
            />
          </div>
          <div className="lg:col-span-4 h-full">
            <RecentExtensions extensions={analytics.recentExtensions} agentNames={agentNames} />
          </div>
        </div>

        <AgentFilters filters={filters} onFiltersChange={setFilters} />

        <div className="bg-black rounded-2xl border border-[#2F3336] overflow-hidden mb-8">
          <table className="min-w-full divide-y divide-[#2F3336]">
            <thead>
              <tr className="bg-black/40">
                <th className="px-6 py-3 text-left text-xs font-medium text-[#71767B] uppercase tracking-wider">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#71767B] uppercase tracking-wider">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#71767B] uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#71767B] uppercase tracking-wider">Total Burned</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#71767B] uppercase tracking-wider">Remaining Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#71767B] uppercase tracking-wider">Last Extended</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2F3336]">
              {filteredAgents.map((stat, index) => {
                const agentInfo = agentNames.get(stat.agentId);
                return (
                  <tr key={stat.agentId} className="hover:bg-white/[0.03] transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[15px]">#{index + 1}</span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 text-xs font-bold text-[#1D9BF0] rounded-full border border-[#1D9BF0]">
                            LEADER
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 flex-shrink-0">
                          <Image
                            src={agentInfo?.imageUrl || DEFAULT_AVATAR}
                            alt={agentInfo?.name || 'Agent avatar'}
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[15px]">
                              {agentInfo?.name || 'Unknown Agent'}
                            </span>
                            {agentInfo?.socials && (
                              <div className="flex items-center gap-2 ml-2">
                                {agentInfo.socials.x && (
                                  <Link
                                    href={agentInfo.socials.x}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#71767B] hover:text-[#1D9BF0] transition-colors"
                                    title="View on X"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                    </svg>
                                  </Link>
                                )}
                                {agentInfo.socials.farcaster && (
                                  <Link
                                    href={agentInfo.socials.farcaster}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#71767B] hover:text-purple-400 transition-colors"
                                    title="View on Warpcast"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M11.063 3.505c-4.502 0-8.154 3.61-8.154 8.062 0 4.452 3.652 8.063 8.154 8.063v-2.88c-2.883 0-5.225-2.317-5.225-5.182 0-2.865 2.342-5.182 5.225-5.182 2.883 0 5.225 2.317 5.225 5.182h2.929c0-4.452-3.652-8.062-8.154-8.062zM21.091 12.093h-10.028v8.063h2.929v-5.182h7.099z"/>
                                    </svg>
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="font-mono text-[13px] text-[#71767B] bg-white/5 px-2 py-1 rounded mt-1">
                            {stat.agentId}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        stat.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : stat.status === 'critical'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-[#71767B]/10 text-[#71767B]'
                      }`}>
                        {stat.status.charAt(0).toUpperCase() + stat.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div>
                          <span className="font-bold text-[15px]">{stat.totalA0XBurned.toLocaleString()}</span>
                          <span className="text-[#71767B] ml-1">A0X</span>
                        </div>
                        <div className="text-xs text-[#71767B] mt-0.5">
                          {((stat.totalA0XBurned / 100_000_000_000) * 100).toFixed(6)}% of total
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[15px]">{stat.remainingDays}</span>
                        <span className="text-[#71767B]">days</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[#71767B]">
                      {format(stat.lastExtended, 'MMM d, yyyy')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </div>
  );
}
