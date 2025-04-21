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

    // Use event topic from config
    this.eventTopic = CONTRACT_CONFIG.eventTopic;
    console.log('Using event topic from config:', this.eventTopic);
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

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getLifeExtendedEvents(): Promise<LifeExtendedEvent[]> {
    try {
      // Get current block
      const currentBlock = await this.getCurrentBlock();
      console.log('Current block:', currentBlock);
      
      // Calculate block range for last 48 hours
      const blocksPerDay = 5760; // 24 * 60 * 60 / 15 (15 second blocks)
      const fromBlock = Math.max(0, currentBlock - (blocksPerDay * 2)); // Last 48 hours
      
      console.log(`Fetching events from last 48 hours (blocks ${fromBlock} to ${currentBlock})`);

      const BATCH_SIZE = 5000; // Process 5000 blocks at a time
      const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches
      const allEvents: LifeExtendedEvent[] = [];

      // Process in batches
      for (let startBlock = fromBlock; startBlock < currentBlock; startBlock += BATCH_SIZE) {
        const endBlock = Math.min(startBlock + BATCH_SIZE, currentBlock);
        console.log(`Processing blocks ${startBlock} to ${endBlock}...`);

        try {
          const filter = this.contract.filters.LifeExtended();
          const events = await this.contract.queryFilter(filter, startBlock, endBlock);
          console.log(`Found ${events.length} events in this batch`);

          if (events.length > 0) {
            const processedEvents = await Promise.all(events.map(async event => {
              const args = (event as ethers.EventLog).args;
              if (!args) throw new Error('No args in event');
              const [agentId, usdcAmount, a0xBurned, newTimeToDeath, useUSDC] = args;
              
              const block = (event as ethers.Log).blockNumber;
              const eventBlock = await event.getBlock();
              const timestamp = eventBlock ? eventBlock.timestamp : Math.floor(Date.now() / 1000);
              
              return {
                agentId,
                usdcAmount: BigInt(usdcAmount),
                a0xBurned: BigInt(a0xBurned),
                newTimeToDeath: BigInt(newTimeToDeath),
                useUSDC,
                timestamp: new Date(Number(timestamp) * 1000),
                transactionHash: event.transactionHash,
                blockNumber: block
              } as LifeExtendedEvent;
            }));

            allEvents.push(...processedEvents);
          }

          // Add delay between batches
          await this.sleep(DELAY_BETWEEN_BATCHES);
        } catch (error) {
          console.error(`Error processing batch ${startBlock}-${endBlock}:`, error);
          // Continue with next batch despite errors
        }
      }

      if (allEvents.length > 0) {
        console.log(`Total events found: ${allEvents.length}`);
        const uniqueAgents = new Set(allEvents.map(e => e.agentId));
        console.log(`Unique agents: ${uniqueAgents.size}`);
        console.log(`Time range: ${allEvents[0].timestamp.toISOString()} to ${allEvents[allEvents.length - 1].timestamp.toISOString()}`);
      } else {
        console.log('No events found in the specified range');
      }

      return allEvents;
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