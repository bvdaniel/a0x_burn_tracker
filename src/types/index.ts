export interface LifeExtendedEvent {
  agentId: string;
  usdcAmount: bigint;
  a0xBurned: bigint;
  newTimeToDeath: bigint;
  useUSDC: boolean;
  timestamp: Date;
}

export interface AgentStats {
  agentId: string;
  totalA0XBurned: number;
  lastExtended: Date;
  remainingDays: number;
  previousRemainingDays: number;
  lastExtensionDuration: number;
  firstExtension: Date;
  status: 'active' | 'inactive' | 'critical';
}

export interface ContractConfig {
  address: string;
  abi: any[];
  eventTopic: string;
}

export interface ExtensionEvent {
  id: string;
  agentId: string;
  timestamp: Date;
  duration: number;
  a0xBurned: number;
  previousRemainingDays: number;
  remainingDays: number;
}

export interface BurnRatePoint {
  timestamp: Date;
  rate: number;
  movingAverage: number;
}

export interface AgentMetrics {
  totalAgents: number;
  activeAgents: number;
  totalBurned: number;
  burnedLastWeek: number;
  averageLifeExtension: number;
  weeklyGrowth: number;
  criticalAgents: number;
}

export interface AgentFilters {
  search: string;
  status: 'all' | 'active' | 'inactive' | 'critical';
  sortBy: 'rank' | 'burnRate' | 'remainingTime';
  sortDirection: 'asc' | 'desc';
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}

export interface DashboardAnalytics {
  metrics: AgentMetrics;
  recentExtensions: ExtensionEvent[];
  burnRateTrend: BurnRatePoint[];
  extensionDistribution: {
    range: string;
    count: number;
  }[];
}

export interface AgentInfo {
  name: string;
  imageUrl?: string;
  socials?: {
    x?: string;
    farcaster?: string;
    telegram?: string;
  };
}

export interface AgentProfile {
  name: string
  imageUrl: string | null
  socials?: {
    x?: string | null
    farcaster?: string | null
  }
} 