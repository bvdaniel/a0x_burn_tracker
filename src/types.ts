export interface LifeExtendedEvent {
  agentId: string
  usdcAmount: bigint
  a0xBurned: bigint
  newTimeToDeath: bigint
  useUSDC: boolean
  timestamp: Date
  transactionHash: string
  blockNumber: number
}

export interface AgentStats {
  agentId: string
  totalA0XBurned: number
  lastExtended: Date
  remainingDays: number
  previousRemainingDays: number
  lastExtensionDuration: number
  firstExtension: Date
  status: 'active' | 'inactive' | 'critical'
}

export interface AgentFilters {
  search: string
  status: 'all' | 'active' | 'inactive' | 'critical'
  sortBy: 'rank' | 'totalBurned' | 'name' | 'lastExtended' | 'remainingDays'
  sortDirection: 'asc' | 'desc'
}

export interface AgentProfile {
  name: string
  imageUrl?: string
  socials?: {
    x?: string
    farcaster?: string
  }
}

export interface ContractConfig {
  address: string
  abi: any[]
  eventTopic: string
} 