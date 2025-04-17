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
      await this.ensureProvider();
      const currentBlock = await this.provider.getBlockNumber();
      
      // Calculate block range - look back 60 days
      const blocksPerDay = 43200; // ~2s block time
      const lookbackBlocks = blocksPerDay * 60; // 60 days
      const fromBlock = Math.max(0, currentBlock - lookbackBlocks);

      console.log('Fetching events from block', fromBlock, 'to', currentBlock);
      console.log('Contract address:', CONTRACT_CONFIG.address);
      console.log('Event topic:', this.eventTopic);

      // Try a small range first to verify we can get events
      const testFilter = {
        address: CONTRACT_CONFIG.address,
        topics: [this.eventTopic],
        fromBlock: currentBlock - 1000,
        toBlock: currentBlock
      };

      console.log('Testing with recent blocks...');
      const testLogs = await this.provider.getLogs(testFilter);
      console.log('Test query found', testLogs.length, 'events in last 1000 blocks');

      const filter = {
        address: CONTRACT_CONFIG.address,
        topics: [this.eventTopic],
        fromBlock,
        toBlock: currentBlock
      };

      const events = await this.fetchEventsFromBlocks(filter, fromBlock, currentBlock);
      
      if (events.length > 0) {
        console.log('Found', events.length, 'events');
        // Save to Redis in the background
        RedisService.saveEvents(events).catch(error => {
          console.error('Error saving events to Redis:', error);
        });
        RedisService.saveLastBlock(currentBlock).catch(error => {
          console.error('Error saving last block to Redis:', error);
        });
      } else {
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
      // On error, return events from Redis if available
      return RedisService.getEvents();
    }
  }

  private async fetchEventsFromBlocks(
    filter: { address: string; topics: string[]; fromBlock: number; toBlock: number },
    fromBlock: number,
    toBlock: number
  ): Promise<LifeExtendedEvent[]> {
    const CHUNK_SIZE = 2000; // Reduced chunk size
    const DELAY_BETWEEN_CHUNKS = 1000; // Reduced delay
    const MAX_RETRIES = 3;
    const logs: ethers.Log[] = [];
    
    for (let start = fromBlock; start < toBlock; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE, toBlock);
      console.log(`Fetching chunk ${start}-${end}`);
      
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
          console.log(`Found ${chunkLogs.length} logs in chunk`);
          if (chunkLogs.length > 0) {
            console.log('Sample log:', chunkLogs[0]);
          }
          logs.push(...chunkLogs);
          success = true;
        } catch (chunkError) {
          retries++;
          console.warn(`Chunk ${start}-${end} failed (attempt ${retries}):`, chunkError);
          if (retries === MAX_RETRIES) {
            console.error(`Failed to fetch chunk ${start}-${end} after ${MAX_RETRIES} attempts`);
            break;
          } else {
            const backoffDelay = Math.pow(2, retries) * 1000;
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        }
      }
    }

    console.log(`Processing ${logs.length} total logs`);
    const events: LifeExtendedEvent[] = [];
    
    // Process all logs at once instead of batching
    const processedEvents = await Promise.all(logs.map(async log => {
      try {
        const block = await this.provider.getBlock(log.blockNumber);
        const decoded = this.contract.interface.decodeEventLog('LifeExtended', log.data, log.topics);
        console.log('Decoded event:', decoded);
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
        console.error('Log data:', log);
        return null;
      }
    }));

    // Filter out any null events from processing errors
    events.push(...processedEvents.filter((event): event is LifeExtendedEvent => event !== null));
    console.log(`Successfully processed ${events.length} events`);
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