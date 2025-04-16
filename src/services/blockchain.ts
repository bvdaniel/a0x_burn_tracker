import { ethers } from 'ethers';
import { CONTRACT_CONFIG } from '../config/contract';
import { LifeExtendedEvent, AgentStats } from '../types';

const A0X_DECIMALS = 18;
// Use public Base RPC with network configuration
const BASE_CHAIN_ID = 8453;
const BASE_RPC_URL = 'https://mainnet.base.org';

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;

  constructor() {
    // Configure provider with Base network specifics
    this.provider = new ethers.JsonRpcProvider(BASE_RPC_URL, {
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

  async getLifeExtendedEvents(): Promise<LifeExtendedEvent[]> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      console.log('Current block number:', currentBlock);

      // Look back approximately 30 days
      const blocksPerDay = 5760; // 24 * 60 * 60 / 15
      const lookbackBlocks = blocksPerDay * 30;
      const fromBlock = Math.max(0, currentBlock - lookbackBlocks);

      console.log('Searching from block:', fromBlock);
      console.log('To block:', currentBlock);

      const filter = {
        address: CONTRACT_CONFIG.address,
        topics: [CONTRACT_CONFIG.eventTopic],
        fromBlock,
        toBlock: currentBlock
      };

      // First check if we're connected to Base
      const network = await this.provider.getNetwork();
      console.log('Connected to network:', {
        chainId: network.chainId,
        name: network.name
      });

      // Check if the contract exists
      const code = await this.provider.getCode(CONTRACT_CONFIG.address);
      console.log('Contract code exists:', code !== '0x');
      if (code === '0x') {
        throw new Error('No contract code found at the specified address');
      }

      // Reduce chunk size and add delay between requests
      const CHUNK_SIZE = blocksPerDay / 2; // Half-day chunks
      const DELAY_BETWEEN_CHUNKS = 1000; // 1 second delay between chunks
      const MAX_RETRIES = 3;
      const logs: ethers.Log[] = [];
      
      for (let start = fromBlock; start < currentBlock; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, currentBlock);
        console.log(`Fetching logs for blocks ${start} to ${end}...`);
        
        // Add delay between chunks
        if (start > fromBlock) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
        }

        let retries = 0;
        while (retries < MAX_RETRIES) {
          try {
            const chunkLogs = await this.provider.getLogs({
              ...filter,
              fromBlock: start,
              toBlock: end
            });
            logs.push(...chunkLogs);
            console.log(`Found ${chunkLogs.length} logs in chunk ${start}-${end}`);
            break; // Success, move to next chunk
          } catch (chunkError) {
            retries++;
            console.error(`Error fetching chunk ${start}-${end} (attempt ${retries}):`, chunkError);
            if (retries === MAX_RETRIES) {
              console.error(`Failed to fetch chunk ${start}-${end} after ${MAX_RETRIES} attempts`);
            } else {
              // Exponential backoff with longer delays
              const backoffDelay = Math.pow(2, retries) * 2000; // Start with 2s, then 4s, then 8s
              console.log(`Waiting ${backoffDelay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
          }
        }
      }

      console.log('Total logs found:', logs.length);

      // Process logs in smaller batches to avoid rate limiting
      const BATCH_SIZE = 5;
      const processedEvents: LifeExtendedEvent[] = [];
      
      for (let i = 0; i < logs.length; i += BATCH_SIZE) {
        const batch = logs.slice(i, i + BATCH_SIZE);
        
        // Add delay between batches
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const batchEvents = await Promise.all(batch.map(async log => {
          const block = await this.provider.getBlock(log.blockNumber);
          const decoded = this.contract.interface.decodeEventLog('LifeExtended', log.data, log.topics);
          return {
            agentId: decoded.agentId,
            usdcAmount: decoded.usdcAmount,
            a0xBurned: decoded.a0xBurned,
            newTimeToDeath: decoded.newTimeToDeath,
            useUSDC: decoded.useUSDC,
            timestamp: block?.timestamp ? new Date(Number(block.timestamp) * 1000) : new Date()
          };
        }));

        processedEvents.push(...batchEvents);
      }

      return processedEvents;
    } catch (error) {
      console.error('Error fetching events:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  }

  static aggregateAgentStats(events: LifeExtendedEvent[]): AgentStats[] {
    console.log('Aggregating stats for events:', events.length);
    const agentMap = new Map<string, { 
      stats: AgentStats;
      previousDeathTime?: bigint;
    }>();

    // Sort events by timestamp to process them in chronological order
    const sortedEvents = [...events].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    sortedEvents.forEach(event => {
      const a0xBurned = Number(event.a0xBurned) / Math.pow(10, A0X_DECIMALS);
      const now = new Date();
      const extensionDate = event.timestamp;
      
      // Log raw timestamp value before conversion
      console.log('Raw newTimeToDeath:', event.newTimeToDeath.toString());
      
      // Convert Unix timestamp (seconds) to milliseconds for Date
      const deathTimeMs = Number(event.newTimeToDeath) * 1000;
      const deathTime = new Date(deathTimeMs);
      
      // Calculate remaining days directly from death time
      const remainingDays = Math.floor((deathTimeMs - now.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log('Detailed timestamp info:', {
        agentId: event.agentId,
        rawNewTimeToDeath: event.newTimeToDeath.toString(),
        deathTimeMs,
        deathTimeISO: deathTime.toISOString(),
        nowMs: now.getTime(),
        nowISO: now.toISOString(),
        diffMs: deathTimeMs - now.getTime(),
        diffDays: remainingDays
      });

      // Update status logic to include critical state
      let status: 'active' | 'inactive' | 'critical';
      if (remainingDays <= 0) {
        status = 'inactive';
      } else if (remainingDays <= 5) {
        status = 'critical';
      } else {
        status = 'active';
      }

      if (!agentMap.has(event.agentId)) {
        // First extension for this agent
        agentMap.set(event.agentId, {
          stats: {
            agentId: event.agentId,
            totalA0XBurned: a0xBurned,
            lastExtended: extensionDate,
            remainingDays,
            previousRemainingDays: remainingDays,
            lastExtensionDuration: Math.floor(Number(event.usdcAmount) / 1_000_000 * 7), // Convert micro-USDC to USDC then multiply by 7 days
            firstExtension: extensionDate,
            status
          },
          previousDeathTime: event.newTimeToDeath
        });
      } else {
        const existing = agentMap.get(event.agentId)!;
        existing.stats.totalA0XBurned += a0xBurned;
        
        if (extensionDate > existing.stats.lastExtended) {
          // Calculate extension duration based on USDC amount (in micro-USDC)
          const extensionDuration = Math.floor(Number(event.usdcAmount) / 1_000_000 * 7); // Convert micro-USDC to USDC then multiply by 7 days

          existing.stats.previousRemainingDays = existing.stats.remainingDays;
          existing.stats.lastExtended = extensionDate;
          existing.stats.remainingDays = remainingDays;
          existing.stats.lastExtensionDuration = extensionDuration;
          existing.stats.status = status;
          existing.previousDeathTime = event.newTimeToDeath;
        }
      }
    });

    // Sort by most recent extension first and log final stats
    const stats = Array.from(agentMap.values())
      .map(entry => entry.stats)
      .sort((a, b) => b.lastExtended.getTime() - a.lastExtended.getTime());
    
    stats.forEach(stat => {
      console.log('Final agent stats:', {
        agentId: stat.agentId,
        remainingDays: stat.remainingDays,
        previousRemainingDays: stat.previousRemainingDays,
        lastExtensionDuration: stat.lastExtensionDuration,
        lastExtended: stat.lastExtended.toISOString()
      });
    });
    
    return stats;
  }
} 