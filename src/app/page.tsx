'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
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
import { AgentStats, AgentFilters as FilterOptions, LifeExtendedEvent, AgentProfile } from '../types';
import { MetricCards } from '../components/MetricCards';
import RecentExtensions from '../components/RecentExtensions';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { AgentFilters } from '../components/AgentFilters';
import { Footer } from '../components/Footer';
import { getDashboardAnalytics, filterAndSortAgents } from '../utils/analytics';
import { getAgentNames } from '../services/a0xMirror';
import Image from 'next/image';
import Link from 'next/link';
import { ExtendLife } from '../components/ExtendLife';
import { BlockchainService } from '../services/blockchain';
import { RedisService } from '../services/redis';
import { formatDistanceToNow } from 'date-fns';
import { A0XService } from '../services/a0x';
import AgentCard from '../components/AgentCard';

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
  const { isConnected } = useAccount()
  const { open } = useWeb3Modal()
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [agentNames, setAgentNames] = useState<Map<string, { name: string; imageUrl?: string; socials?: { x?: string; farcaster?: string } }>>(new Map());
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    status: 'all',
    sortBy: 'rank',
    sortDirection: 'desc'
  });
  const [selectedAgent, setSelectedAgent] = useState<AgentStats | null>(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<`0x${string}` | null>(null);
  const [events, setEvents] = useState<LifeExtendedEvent[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<Map<string, AgentProfile>>(new Map())
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchData = async () => {
    try {
      if (!isInitialized) {
        setLoading(true);
      }
      setError(null);
      
      // Fetch events first
      const response = await fetch('/api/events');
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      
      const { events: newEvents } = await response.json();
      setEvents(newEvents);
      
      // Process events to aggregate agent statistics
      const statsMap: Record<string, AgentStats> = {};
      
      newEvents.forEach((event: LifeExtendedEvent) => {
        const agentId = event.agentId;
        const timestamp = new Date(event.timestamp);
        const a0xBurned = Number(event.a0xBurned) / Math.pow(10, 18); // Convert from wei to A0X
        
        if (!statsMap[agentId]) {
          statsMap[agentId] = {
            agentId,
            totalA0XBurned: a0xBurned,
            lastExtended: timestamp,
            remainingDays: Math.round((Number(event.newTimeToDeath) * 1000 - Date.now()) / (24 * 60 * 60 * 1000)),
            previousRemainingDays: 0,
            lastExtensionDuration: Math.round(Number(event.usdcAmount) / 1_000_000 * 7),
            firstExtension: timestamp,
            status: 'active'
          };
        } else {
          const agent = statsMap[agentId];
          agent.totalA0XBurned += a0xBurned;
          
          if (timestamp > agent.lastExtended) {
            agent.previousRemainingDays = agent.remainingDays;
            agent.lastExtended = timestamp;
            agent.remainingDays = Math.round((Number(event.newTimeToDeath) * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
            agent.lastExtensionDuration = Math.round(Number(event.usdcAmount) / 1_000_000 * 7);
          }
          if (timestamp < agent.firstExtension) {
            agent.firstExtension = timestamp;
          }
          
          // Update status based on remaining days
          if (agent.remainingDays <= 0) {
            agent.status = 'inactive';
          } else if (agent.remainingDays <= 5) {
            agent.status = 'critical';
          } else {
            agent.status = 'active';
          }
        }
      });

      const agentList = Object.values(statsMap);
      setAgentStats(agentList);

      // Fetch agent profiles in parallel with events processing
      const agentIds = agentList.map(agent => agent.agentId);
      const profilesPromise = A0XService.getAgentProfiles(agentIds);
      
      try {
        const profiles = await profilesPromise;
        const convertedProfiles = new Map(
          Array.from(profiles.entries()).map(([id, profile]) => [
            id,
            {
              name: profile.name,
              imageUrl: profile.imageUrl || undefined,
              socials: profile.socials ? {
                x: profile.socials.x || undefined,
                farcaster: profile.socials.farcaster || undefined
              } : undefined
            }
          ])
        );
        setAgentNames(convertedProfiles);
      } catch (err) {
        console.error('Error fetching agent profiles:', err);
        // Don't fail the whole operation if profile fetching fails
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Polling for updates
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isInitialized]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-[#1D9BF0]"></div>
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

  // Transform AgentStats to Leaderboard format
  const leaderboardAgents = agentStats.map(agent => ({
    id: agent.agentId,
    name: agentNames.get(agent.agentId)?.name || agent.agentId,
    imageUrl: agentNames.get(agent.agentId)?.imageUrl || '/default-agent.png',
    totalBurned: agent.totalA0XBurned,
    remainingDays: agent.remainingDays,
    lastExtension: formatDistanceToNow(agent.lastExtended, { addSuffix: true }),
    healthPercentage: Math.min(100, Math.max(0, (agent.remainingDays / 30) * 100))
  }));

  const handleExtendClick = async (agentId: string) => {
    setSelectedAgentId(agentId as `0x${string}`);
    setShowExtendModal(true);
  };

  const handleExtendSuccess = async () => {
    // Wait longer before first attempt to ensure transaction is indexed
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    const maxRetries = 3
    const retryDelay = 5000 // 5 seconds between retries
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch('/api/agent-stats')
        if (!response.ok) {
          throw new Error('Failed to fetch agent stats')
        }
        const newData = await response.json()
        setAgentStats(newData)
        // Success - exit retry loop
        break
      } catch (error) {
        console.error(`Error refreshing agent stats (attempt ${attempt + 1}/${maxRetries}):`, error)
        if (attempt < maxRetries - 1) {
          // Wait before next retry
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }
  }

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
                <th className="px-6 py-3 text-left text-xs font-medium text-[#71767B] uppercase tracking-wider w-[200px]">Rank</th>
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
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[15px]">#{index + 1}</span>
                          {index === 0 && (
                            <span className="px-2 py-0.5 text-xs font-bold text-[#1D9BF0] rounded-full border border-[#1D9BF0]">
                              LEADER
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleExtendClick(stat.agentId)}
                          className="bg-[#1D9BF0] hover:bg-[#1A8CD8] px-3 py-1.5 rounded-full text-white text-sm font-medium transition-colors"
                        >
                          Extend Life
                        </button>
                      </div>
                      {selectedAgent === stat && (
                        <div className="fixed inset-0 z-50">
                          <ExtendLife
                            agentId={stat.agentId as `0x${string}`}
                            onSuccess={() => {
                              setSelectedAgent(null);
                              // Implement logic to refresh data
                            }}
                            onClose={() => setSelectedAgent(null)}
                          />
                        </div>
                      )}
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
                                      <path d="M11.063 3.505c-4.502 0-8.154 3.61-8.154 8.062 0 4.452 3.652 8.063 8.154 8.154v-2.88c-2.883 0-5.225-2.317-5.225-5.182 0-2.865 2.342-5.182 5.225-5.182 2.883 0 5.225 2.317 5.225 5.182h2.929c0-4.452-3.652-8.062-8.154-8.062zM21.091 12.093h-10.028v8.063h2.929v-5.182h7.099z"/>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[#71767B]">
                        {format(stat.lastExtended, 'MMM d, yyyy')}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </main>
      <Footer />
      {showExtendModal && selectedAgentId && (
        <ExtendLife
          agentId={selectedAgentId}
          onSuccess={handleExtendSuccess}
          onClose={() => setShowExtendModal(false)}
        />
      )}
    </div>
  );
}
