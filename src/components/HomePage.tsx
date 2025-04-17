'use client';

import { useEffect, useState } from 'react';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { BlockchainService } from '../services/blockchain';
import { A0XService } from '../services/a0x';
import { LifeExtendedEvent, AgentStats, AgentProfile } from '../types';
import { AgentCard } from './AgentCard';
import { AgentFilters } from './AgentFilters';
import { filterAndSortAgents } from '../utils/filters';

export default function HomePage() {
  const [events, setEvents] = useState<LifeExtendedEvent[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<Map<string, AgentProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
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
      const service = new BlockchainService();
      console.log('🔄 Fetching events...');
      const newEvents = await service.getLifeExtendedEvents();
      console.log(`📥 Fetched ${newEvents.length} events`);

      // Get agent stats from blockchain service
      const stats = BlockchainService.aggregateAgentStats(newEvents);
      console.log(`📊 Aggregated stats for ${stats.length} agents`);
      
      // Fetch agent profiles in parallel
      const agentIds = stats.map(agent => agent.agentId);
      console.log(`🔍 Fetching profiles for ${agentIds.length} agents`);
      
      try {
        const profiles = await A0XService.getAgentProfiles(agentIds);
        console.log(`✨ Fetched ${profiles.size} agent profiles`);
        setAgentProfiles(profiles);
      } catch (err) {
        console.error('Error fetching agent profiles:', err);
        // Don't fail the whole operation if profile fetching fails
      }

      // Update states
      setEvents(newEvents);
      setAgentStats(stats);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredAgents = filterAndSortAgents(agentStats, {
    searchQuery: filters.search,
    status: filters.status,
    sortBy: filters.sortBy,
    sortOrder: filters.sortDirection
  });

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
                onLifeExtended={fetchData}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
} 