'use client';

import { useEffect, useState } from 'react';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { BlockchainService } from '../services/blockchain';
import { A0XService } from '../services/a0x';
import { LifeExtendedEvent, AgentStats, AgentProfile, AgentFilters as FilterOptions, AgentMetrics, BurnRatePoint } from '../types';
import AgentCard from './AgentCard';
import { AgentFilters } from './AgentFilters';
import { MetricCards } from './MetricCards';
import RecentExtensions from './RecentExtensions';
import { AnalyticsCharts } from './AnalyticsCharts';
import { filterAndSortAgents } from '@/utils/filters';

export function BurnTracker() {
  const [events, setEvents] = useState<LifeExtendedEvent[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<Map<string, AgentProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    status: 'all',
    sortBy: 'lastExtended',
    sortDirection: 'desc'
  });
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { open } = useWeb3Modal();

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const blockchain = new BlockchainService();
      
      // Fetch events from Redis
      const events = await blockchain.getLifeExtendedEvents();
      setEvents(events);
      
      // Calculate agent stats
      const stats = BlockchainService.aggregateAgentStats(events);
      setAgentStats(stats);
      
      // Fetch agent profiles
      const agentIds = stats.map(agent => agent.agentId);
      const profiles = await A0XService.getAgentProfiles(agentIds);
      const profileMap = new Map<string, AgentProfile>();
      for (const [id, profile] of profiles.entries()) {
        profileMap.set(id, {
          name: profile.name,
          imageUrl: profile.imageUrl || null,
          socials: profile.socials ? {
            x: profile.socials.x || null,
            farcaster: profile.socials.farcaster || null
          } : undefined
        });
      }
      setAgentProfiles(profileMap);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLifeExtended = async () => {
    // Refresh data after life extension
    await fetchData();
  };

  const filteredAgents = filterAndSortAgents(agentStats, {
    searchQuery: filters.search,
    status: filters.status,
    sortBy: filters.sortBy,
    sortOrder: filters.sortDirection
  });

  // Calculate metrics
  const metrics: AgentMetrics = {
    totalAgents: agentStats.length,
    activeAgents: agentStats.filter(agent => agent.remainingDays > 7).length,
    totalBurned: agentStats.reduce((sum, agent) => sum + agent.totalA0XBurned, 0),
    burnedLastWeek: agentStats.reduce((sum, agent) => sum + (agent.lastExtensionDuration || 0), 0),
    averageLifeExtension: agentStats.reduce((sum, agent) => sum + (agent.lastExtensionDuration || 0), 0) / agentStats.length,
    weeklyGrowth: 0, // TODO: Calculate weekly growth
    criticalAgents: agentStats.filter(agent => agent.remainingDays <= 7 && agent.remainingDays > 0).length
  };

  // Calculate burn rate trend
  const burnRateTrend: BurnRatePoint[] = events
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map((event, index, array) => {
      const rate = Number(event.a0xBurned) / 1e18;
      const movingAverage = array
        .slice(Math.max(0, index - 6), index + 1)
        .reduce((sum, e) => sum + Number(e.a0xBurned) / 1e18, 0) / Math.min(7, index + 1);
      return {
        timestamp: event.timestamp,
        rate,
        movingAverage
      };
    });

  // Calculate extension distribution
  const extensionDistribution = [
    { range: '1-7 days', count: agentStats.filter(agent => agent.remainingDays <= 7 && agent.remainingDays > 0).length },
    { range: '8-14 days', count: agentStats.filter(agent => agent.remainingDays <= 14 && agent.remainingDays > 7).length },
    { range: '15-21 days', count: agentStats.filter(agent => agent.remainingDays <= 21 && agent.remainingDays > 14).length },
    { range: '22+ days', count: agentStats.filter(agent => agent.remainingDays > 21).length }
  ];

  // Calculate recent extensions from events
  const recentExtensions = events.map((event, index) => ({
    id: `evt-${index}`,
    agentId: event.agentId,
    timestamp: event.timestamp,
    duration: Number(event.newTimeToDeath) / (24 * 60 * 60), // Convert seconds to days
    a0xBurned: Number(event.a0xBurned) / 1e18,
    previousRemainingDays: 0, // We don't have this info in the event
    remainingDays: Number(event.newTimeToDeath) / (24 * 60 * 60)
  }));

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">A0X Burn Tracker</h1>
        <div className="flex gap-4">
          <button
            onClick={() => open()}
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Connect Wallet
          </button>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto space-y-6">
        <AgentFilters
          filters={filters}
          onFiltersChange={setFilters}
        />

        <MetricCards metrics={metrics} />
        <AnalyticsCharts
          burnRateTrend={burnRateTrend}
          extensionDistribution={extensionDistribution}
        />

        {error ? (
          <div className="text-red-500 text-center py-8">{error}</div>
        ) : loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent: AgentStats) => (
              <AgentCard
                key={agent.agentId}
                agent={agent}
                profile={agentProfiles.get(agent.agentId)}
                onLifeExtended={handleLifeExtended}
              />
            ))}
          </div>
        )}

        <RecentExtensions 
          extensions={recentExtensions} 
          agentNames={new Map(Array.from(agentProfiles.entries()).map(([id, profile]) => [
            id,
            { name: profile.name, imageUrl: profile.imageUrl || undefined }
          ]))} 
        />
      </div>
    </main>
  );
} 