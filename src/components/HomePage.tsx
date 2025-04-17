'use client';

import { useEffect, useState } from 'react';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { BlockchainService } from '../services/blockchain';
import { A0XService } from '../services/a0x';
import { LifeExtendedEvent, AgentStats, AgentProfile } from '../types';
import { AgentList } from '../app/components/AgentList';
import { Header } from '../app/components/Header';
import { SearchBar } from '../app/components/SearchBar';
import { StatusFilter } from '../app/components/StatusFilter';
import { SortOptions } from '../app/components/SortOptions';
import { AgentList } from './AgentList';
import { Header } from './Header';
import { SearchBar } from './SearchBar';
import { StatusFilter } from './StatusFilter';
import { SortOptions } from './SortOptions';
import { filterAndSortAgents } from '../utils/filters';

export default function HomePage() {
  const [events, setEvents] = useState<LifeExtendedEvent[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [agentNames, setAgentNames] = useState<Map<string, AgentProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'critical' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'lastExtended' | 'remainingDays' | 'totalA0XBurned'>('lastExtended');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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
    searchQuery,
    statusFilter,
    sortBy,
    sortOrder
  });

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <Header
        onConnectWallet={() => open()}
        onRefresh={fetchData}
        refreshing={refreshing}
      />
      
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <StatusFilter value={statusFilter} onChange={setStatusFilter} />
          <SortOptions
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortByChange={setSortBy}
            onSortOrderChange={setSortOrder}
          />
        </div>

        {error ? (
          <div className="text-red-500 text-center py-8">{error}</div>
        ) : loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <AgentList
            agents={filteredAgents}
            agentNames={agentNames}
            events={events}
          />
        )}
      </div>
    </main>
  );
} 