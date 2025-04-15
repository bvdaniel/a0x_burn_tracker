import { AgentFilters as FilterOptions } from '../types';
import { MagnifyingGlassIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';

interface AgentFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
}

export function AgentFilters({ filters, onFiltersChange }: AgentFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-6">
      <div className="relative flex-1 min-w-[240px]">
        <input
          type="text"
          placeholder="Search agents..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="w-full bg-black border border-[#2F3336] rounded-full px-4 py-2 pl-10 text-[15px] focus:outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0] placeholder-[#71767B]"
        />
        <MagnifyingGlassIcon 
          className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#71767B]"
        />
      </div>

      <select
        value={filters.status}
        onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as FilterOptions['status'] })}
        className="bg-black border border-[#2F3336] rounded-full px-4 py-2 text-[15px] focus:outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0] min-w-[140px]"
      >
        <option value="all">All Agents</option>
        <option value="active">Active Only</option>
        <option value="inactive">Inactive</option>
        <option value="critical">Critical</option>
      </select>

      <select
        value={filters.sortBy}
        onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value as FilterOptions['sortBy'] })}
        className="bg-black border border-[#2F3336] rounded-full px-4 py-2 text-[15px] focus:outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0] min-w-[160px]"
      >
        <option value="rank">Sort by Rank</option>
        <option value="burnRate">Sort by Burn Rate</option>
        <option value="remainingTime">Sort by Remaining Time</option>
      </select>

      <button
        onClick={() => onFiltersChange({ ...filters, sortDirection: filters.sortDirection === 'asc' ? 'desc' : 'asc' })}
        className="bg-black border border-[#2F3336] rounded-full p-2 hover:bg-white/[0.03] focus:outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0] transition-colors"
      >
        <ChevronUpDownIcon
          className={`w-5 h-5 text-[#71767B] transition-transform ${
            filters.sortDirection === 'asc' ? 'rotate-180' : ''
          }`}
        />
      </button>
    </div>
  );
} 