import { AgentStats } from '../types';

export interface FilterOptions {
  searchQuery: string;
  status: 'all' | 'active' | 'critical' | 'inactive';
  sortBy: 'rank' | 'name' | 'totalBurned' | 'lastExtended' | 'remainingDays';
  sortOrder: 'asc' | 'desc';
}

const CRITICAL_DAYS_THRESHOLD = 7;

export function filterAndSortAgents(agents: AgentStats[], options: FilterOptions): AgentStats[] {
  const { searchQuery, status, sortBy, sortOrder } = options;

  // Filter by search query
  let filteredAgents = agents.filter(agent => {
    const searchLower = searchQuery.toLowerCase();
    return agent.agentId.toLowerCase().includes(searchLower);
  });

  // Filter by status
  if (status !== 'all') {
    filteredAgents = filteredAgents.filter(agent => {
      const remainingDays = agent.remainingDays;
      switch (status) {
        case 'active':
          return remainingDays > CRITICAL_DAYS_THRESHOLD;
        case 'critical':
          return remainingDays <= CRITICAL_DAYS_THRESHOLD && remainingDays > 0;
        case 'inactive':
          return remainingDays <= 0;
        default:
          return true;
      }
    });
  }

  // Sort agents
  filteredAgents.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'rank':
        comparison = (a.totalA0XBurned || 0) - (b.totalA0XBurned || 0);
        break;
      case 'name':
        comparison = (a.agentId || '').localeCompare(b.agentId || '');
        break;
      case 'totalBurned':
        comparison = (a.totalA0XBurned || 0) - (b.totalA0XBurned || 0);
        break;
      case 'lastExtended':
        comparison = (a.lastExtended?.getTime() || 0) - (b.lastExtended?.getTime() || 0);
        break;
      case 'remainingDays':
        comparison = (a.remainingDays || 0) - (b.remainingDays || 0);
        break;
      default:
        comparison = 0;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return filteredAgents;
} 