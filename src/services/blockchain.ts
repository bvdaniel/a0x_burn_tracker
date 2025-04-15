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
      const lookbackBlocks = blocksPerDay * 30; // Increased from 7 to 30 days
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

      // Try to get logs in smaller chunks with retries
      const CHUNK_SIZE = blocksPerDay; // 1 day chunks
      const MAX_RETRIES = 3;
      const logs: ethers.Log[] = [];
      
      for (let start = fromBlock; start < currentBlock; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, currentBlock);
        console.log(`Fetching logs for blocks ${start} to ${end}...`);
        
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
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
            }
          }
        }
      }

      console.log('Total logs found:', logs.length);

      if (logs.length === 0) {
        console.log('No events found. This could mean:');
        console.log('1. No events have been emitted in the last 30 days');
        console.log('2. The contract address might be incorrect');
        console.log('3. The event topic might be incorrect');
      }

      // Get block timestamps for all logs
      const events = await Promise.all(logs.map(async log => {
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

      return events;
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

      const status = remainingDays < 36 ? 'critical' : remainingDays < 90 ? 'inactive' : 'active';

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