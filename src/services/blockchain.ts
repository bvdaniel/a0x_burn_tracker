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
  }

  async getCurrentBlock(): Promise<number> {
    await this.ensureProvider();
    return this.provider.getBlockNumber();
  }

  async getLifeExtendedEvents(): Promise<LifeExtendedEvent[]> {
    try {
      await this.ensureProvider();
      
      // First try to get events from Redis
      const events = await RedisService.getEvents();
      const lastBlock = await RedisService.getLastBlock();
      const currentBlock = await this.provider.getBlockNumber();

      // If we have events and last block, only fetch new events
      if (events.length > 0 && lastBlock > 0) {
        const fromBlock = lastBlock + 1;
        
        // If we're already up to date, return cached events
        if (fromBlock >= currentBlock) {
          return events;
        }

        // Fetch only new events
        const filter = {
          address: CONTRACT_CONFIG.address,
          topics: [CONTRACT_CONFIG.eventTopic],
          fromBlock,
          toBlock: currentBlock
        };

        const newEvents = await this.fetchEventsFromBlocks(filter, fromBlock, currentBlock);
        
        if (newEvents.length > 0) {
          const allEvents = [...events, ...newEvents];
          await RedisService.saveEvents(allEvents);
          await RedisService.saveLastBlock(currentBlock);
          return allEvents;
        }

        return events;
      }

      // If no events in Redis, fetch from blockchain with lookback
      const blocksPerDay = 5760; // 24 * 60 * 60 / 15
      const lookbackBlocks = blocksPerDay * 30; // 30 days
      const fromBlock = Math.max(0, currentBlock - lookbackBlocks);

      const filter = {
        address: CONTRACT_CONFIG.address,
        topics: [CONTRACT_CONFIG.eventTopic],
        fromBlock,
        toBlock: currentBlock
      };

      const newEvents = await this.fetchEventsFromBlocks(filter, fromBlock, currentBlock);
      
      if (newEvents.length > 0) {
        await RedisService.saveEvents(newEvents);
        await RedisService.saveLastBlock(currentBlock);
      }

      return newEvents;
    } catch (error) {
      console.error('Error fetching events:', error);
      // On error, return events from Redis if available
      return RedisService.getEvents();
    }
  }

  private async fetchEventsFromBlocks(
    filter: { address: string; topics: string[]; fromBlock: number; toBlock: number },
    fromBlock: number,
    toBlock: number
  ): Promise<LifeExtendedEvent[]> {
    const CHUNK_SIZE = 2880;
    const DELAY_BETWEEN_CHUNKS = 2000;
    const MAX_RETRIES = 5;
    const logs: ethers.Log[] = [];
    
    for (let start = fromBlock; start < toBlock; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE, toBlock);
      
      if (start > fromBlock) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
      }

      let retries = 0;
      let success = false;
      
      while (retries < MAX_RETRIES && !success) {
        try {
          const chunkLogs = await this.provider.getLogs({
            ...filter,
            fromBlock: start,
            toBlock: end
          });
          logs.push(...chunkLogs);
          success = true;
        } catch (chunkError) {
          retries++;
          if (retries === MAX_RETRIES) {
            console.error(`Failed to fetch chunk ${start}-${end} after ${MAX_RETRIES} attempts`);
            break;
          } else {
            const backoffDelay = Math.pow(2, retries) * 2000;
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        }
      }
    }

    // Process logs in smaller batches
    const BATCH_SIZE = 5;
    const events: LifeExtendedEvent[] = [];
    
    for (let i = 0; i < logs.length; i += BATCH_SIZE) {
      const batch = logs.slice(i, i + BATCH_SIZE);
      
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const batchEvents = await Promise.all(batch.map(async log => {
        try {
          const block = await this.provider.getBlock(log.blockNumber);
          const decoded = this.contract.interface.decodeEventLog('LifeExtended', log.data, log.topics);
          return {
            agentId: decoded.agentId,
            usdcAmount: BigInt(decoded.usdcAmount),
            a0xBurned: BigInt(decoded.a0xBurned),
            newTimeToDeath: BigInt(decoded.newTimeToDeath),
            useUSDC: decoded.useUSDC,
            timestamp: block?.timestamp ? new Date(Number(block.timestamp) * 1000) : new Date(),
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber
          };
        } catch (error) {
          console.error('Error processing log:', error);
          throw error;
        }
      }));

      events.push(...batchEvents);
    }

    return events;
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