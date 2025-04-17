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

export interface ContractConfig {
  address: string
  abi: any[]
  eventTopic: string
} 