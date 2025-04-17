import { ethers } from 'ethers';
import { CONTRACT_CONFIG } from '../config/contract';
import { LifeExtendedEvent, AgentStats } from '../types';
import { RedisService } from './redis';

const A0X_DECIMALS = 18;
// Use public Base RPC with network configuration
const BASE_CHAIN_ID = 8453;
const BASE_RPC_URLS = [
  'https://mainnet.base.org',
  'https://base.blockpi.network/v1/rpc/public',
  'https://1rpc.io/base'
];

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private eventTopic: string;

  constructor() {
    // Try the first RPC URL
    this.provider = new ethers.JsonRpcProvider(BASE_RPC_URLS[0], {
      chainId: BASE_CHAIN_ID,
      name: 'base',
      ensAddress: undefined
    });
    
    this.contract = new ethers.Contract(
      CONTRACT_CONFIG.address,
      CONTRACT_CONFIG.abi,
      this.provider
    );

    // Compute event topic
    const eventFragment = this.contract.interface.getEvent('LifeExtended');
    this.eventTopic = ethers.id(
      'LifeExtended(string,uint256,uint256,uint256,bool)'
    );
    console.log('Computed event topic:', this.eventTopic);
    console.log('Config event topic:', CONTRACT_CONFIG.eventTopic);
  }

  private async ensureProvider() {
    for (const rpcUrl of BASE_RPC_URLS) {
      try {
        await this.provider.getBlockNumber();
        return; // Provider is working
      } catch (error) {
        console.log(`RPC ${rpcUrl} failed, trying next...`);
        // Try next RPC URL
        this.provider = new ethers.JsonRpcProvider(rpcUrl, {
          chainId: BASE_CHAIN_ID,
          name: 'base',
          ensAddress: undefined
        });
        this.contract = new ethers.Contract(
          CONTRACT_CONFIG.address,
          CONTRACT_CONFIG.abi,
          this.provider
        );
      }
    }
    throw new Error('All RPC endpoints failed');
  }

  async getCurrentBlock(): Promise<number> {
    await this.ensureProvider();
    return this.provider.getBlockNumber();
  }

  async getLifeExtendedEvents(): Promise<LifeExtendedEvent[]> {
    try {
      // Get current block
      const currentBlock = await this.getCurrentBlock();
      
      // Calculate lookback (30 days worth of blocks)
      const blocksPerDay = 5760; // 24 * 60 * 60 / 15 (15 second blocks)
      const lookbackBlocks = blocksPerDay * 30; // 30 days
      const fromBlock = Math.max(0, currentBlock - lookbackBlocks);
      
      console.log(`Fetching events from block ${fromBlock} to ${currentBlock}`);

      // Get logs
      const logs = await this.provider.getLogs({
        address: CONTRACT_CONFIG.address,
        topics: [this.eventTopic],
        fromBlock,
        toBlock: currentBlock
      });

      // Parse logs into events
      const events: LifeExtendedEvent[] = logs.map(log => {
        const event = this.contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });
        
        if (!event) {
          throw new Error('Failed to parse event log');
        }

        return {
          agentId: event.args[0],
          usdcAmount: event.args[1],
          a0xBurned: event.args[2],
          newTimeToDeath: event.args[3],
          useUSDC: event.args[4],
          timestamp: new Date((log.blockNumber! * 15 + 1609459200) * 1000), // Approximate timestamp
          transactionHash: log.transactionHash!,
          blockNumber: log.blockNumber!
        };
      });
      
      if (events.length === 0) {
        console.log('No events found in block range');
        // Try without topic filter as a test
        console.log('Testing without topic filter...');
        const noTopicFilter = {
          address: CONTRACT_CONFIG.address,
          fromBlock: currentBlock - 1000,
          toBlock: currentBlock
        };
        const testNoTopicLogs = await this.provider.getLogs(noTopicFilter);
        console.log('Found', testNoTopicLogs.length, 'events without topic filter');
      }

      return events;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error; // Let the caller handle the error
    }
  }

  static aggregateAgentStats(events: LifeExtendedEvent[]): AgentStats[] {
    const agentMap = new Map<string, { 
      stats: AgentStats;
      previousDeathTime?: bigint;
    }>();

    const sortedEvents = [...events].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    sortedEvents.forEach(event => {
      const a0xBurned = Number(event.a0xBurned) / Math.pow(10, A0X_DECIMALS);
      const now = new Date();
      const extensionDate = event.timestamp;
      const deathTimeMs = Number(event.newTimeToDeath) * 1000;
      const deathTime = new Date(deathTimeMs);
      const remainingDays = Math.floor((deathTimeMs - now.getTime()) / (1000 * 60 * 60 * 24));

      let status: 'active' | 'inactive' | 'critical';
      if (remainingDays <= 0) {
        status = 'inactive';
      } else if (remainingDays <= 5) {
        status = 'critical';
      } else {
        status = 'active';
      }

      if (!agentMap.has(event.agentId)) {
        agentMap.set(event.agentId, {
          stats: {
            agentId: event.agentId,
            totalA0XBurned: a0xBurned,
            lastExtended: extensionDate,
            remainingDays,
            previousRemainingDays: remainingDays,
            lastExtensionDuration: Math.floor(Number(event.usdcAmount) / 1_000_000 * 7),
            firstExtension: extensionDate,
            status
          },
          previousDeathTime: event.newTimeToDeath
        });
      } else {
        const existing = agentMap.get(event.agentId)!;
        existing.stats.totalA0XBurned += a0xBurned;
        
        if (extensionDate > existing.stats.lastExtended) {
          const extensionDuration = Math.round(Number(event.usdcAmount) / 1_000_000 * 7);
          existing.stats.previousRemainingDays = existing.stats.remainingDays;
          existing.stats.lastExtended = extensionDate;
          existing.stats.remainingDays = remainingDays;
          existing.stats.lastExtensionDuration = extensionDuration;
          existing.stats.status = status;
          existing.previousDeathTime = event.newTimeToDeath;
        }
      }
    });

    return Array.from(agentMap.values())
      .map(entry => entry.stats)
      .sort((a, b) => b.lastExtended.getTime() - a.lastExtended.getTime());
  }
} 