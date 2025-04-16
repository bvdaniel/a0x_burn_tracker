import { ethers } from 'ethers';
import { CONTRACT_CONFIG } from '../config/contract';
import { LifeExtendedEvent, AgentStats } from '../types';

const A0X_DECIMALS = 18;
// Use public Base RPC with network configuration
const BASE_CHAIN_ID = 8453;
const BASE_RPC_URL = 'https://mainnet.base.org';

// Storage keys
const EVENTS_STORAGE_KEY = 'lifeExtendedEvents';
const LAST_BLOCK_KEY = 'lastFetchedBlock';

interface StoredEvents {
  events: LifeExtendedEvent[];
  lastBlock: number;
  timestamp: number;
}

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

  private getStoredEvents(): StoredEvents | null {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return null;
    }

    const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!stored) return null;
    
    try {
      const data = JSON.parse(stored);
      // Convert stored dates back to Date objects
      data.events = data.events.map((event: any) => ({
        ...event,
        timestamp: new Date(event.timestamp)
      }));
      return data;
    } catch (error) {
      console.error('Error parsing stored events:', error);
      return null;
    }
  }

  private storeEvents(events: LifeExtendedEvent[], lastBlock: number) {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return;
    }

    const data: StoredEvents = {
      events,
      lastBlock,
      timestamp: Date.now()
    };
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(data));
  }

  async getLifeExtendedEvents(): Promise<LifeExtendedEvent[]> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      console.log('Current block number:', currentBlock);

      // Try to get stored events
      const stored = this.getStoredEvents();
      let fromBlock: number;
      let existingEvents: LifeExtendedEvent[] = [];

      if (stored) {
        console.log('Found stored events up to block:', stored.lastBlock);
        // Start from the last fetched block
        fromBlock = stored.lastBlock + 1;
        existingEvents = stored.events;
        
        // Log specific agents' events from stored data
        const targetAgents = ['0bd25758-2a10-0c4a-acc9-e611d4d48356', '2b9ec976-a43c-06db-be02-a46603f9e372'];
        targetAgents.forEach(agentId => {
          const agentEvents = existingEvents.filter(e => e.agentId === agentId);
          console.log(`Stored events for agent ${agentId}:`, agentEvents);
        });
      } else {
        // Look back 30 days if no stored events
        const blocksPerDay = 5760; // 24 * 60 * 60 / 15
        const lookbackBlocks = blocksPerDay * 30; // Increased from 8 to 30 days
        fromBlock = Math.max(0, currentBlock - lookbackBlocks);
        console.log('No stored events found, looking back from block:', fromBlock);
      }

      // If we're already up to date, return stored events
      if (fromBlock >= currentBlock) {
        console.log('Already up to date');
        return existingEvents;
      }

      console.log('Fetching new events from block:', fromBlock);
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

      // Use half-day chunks for better balance between granularity and performance
      const CHUNK_SIZE = 2880; // Half-day chunks
      const DELAY_BETWEEN_CHUNKS = 2000;
      const MAX_RETRIES = 5;
      const logs: ethers.Log[] = [];
      
      // Track blocks we've successfully fetched
      const fetchedBlocks = new Set<number>();
      
      for (let start = fromBlock; start < currentBlock; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, currentBlock);
        console.log(`Fetching logs for blocks ${start} to ${end}...`);
        
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
            
            // Mark these blocks as fetched
            for (let block = start; block <= end; block++) {
              fetchedBlocks.add(block);
            }
            
            logs.push(...chunkLogs);
            console.log(`Found ${chunkLogs.length} logs in chunk ${start}-${end}`);
            
            // Log if we found events for our target agents
            chunkLogs.forEach(log => {
              try {
                const decoded = this.contract.interface.decodeEventLog('LifeExtended', log.data, log.topics);
                if (['0bd25758-2a10-0c4a-acc9-e611d4d48356', '2b9ec976-a43c-06db-be02-a46603f9e372'].includes(decoded.agentId)) {
                  console.log('Found event for target agent in chunk:', {
                    agentId: decoded.agentId,
                    blockNumber: log.blockNumber,
                    transactionHash: log.transactionHash,
                    newTimeToDeath: decoded.newTimeToDeath.toString()
                  });
                }
              } catch (decodeError) {
                console.error('Error decoding log:', decodeError);
              }
            });
            
            success = true;
          } catch (chunkError) {
            retries++;
            console.error(`Error fetching chunk ${start}-${end} (attempt ${retries}):`, chunkError);
            
            if (retries === MAX_RETRIES) {
              console.error(`Failed to fetch chunk ${start}-${end} after ${MAX_RETRIES} attempts`);
              // Instead of throwing, we'll log the error and continue
              console.error('Skipping this chunk and continuing...');
              break;
            } else {
              const backoffDelay = Math.pow(2, retries) * 2000;
              console.log(`Waiting ${backoffDelay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
          }
        }
      }

      // Log any blocks we might have missed
      const missedBlocks = [];
      for (let block = fromBlock; block < currentBlock; block++) {
        if (!fetchedBlocks.has(block)) {
          missedBlocks.push(block);
        }
      }
      
      if (missedBlocks.length > 0) {
        console.warn('Missed blocks:', missedBlocks);
      }

      console.log('Total new logs found:', logs.length);

      // Process logs in smaller batches
      const BATCH_SIZE = 5;
      const newEvents: LifeExtendedEvent[] = [];
      
      for (let i = 0; i < logs.length; i += BATCH_SIZE) {
        const batch = logs.slice(i, i + BATCH_SIZE);
        
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const batchEvents = await Promise.all(batch.map(async log => {
          try {
            const block = await this.provider.getBlock(log.blockNumber);
            const decoded = this.contract.interface.decodeEventLog('LifeExtended', log.data, log.topics);
            const event = {
              agentId: decoded.agentId,
              usdcAmount: decoded.usdcAmount,
              a0xBurned: decoded.a0xBurned,
              newTimeToDeath: decoded.newTimeToDeath,
              useUSDC: decoded.useUSDC,
              timestamp: block?.timestamp ? new Date(Number(block.timestamp) * 1000) : new Date()
            };
            
            // Log if this is one of our target agents
            if (['0bd25758-2a10-0c4a-acc9-e611d4d48356', '2b9ec976-a43c-06db-be02-a46603f9e372'].includes(event.agentId)) {
              console.log('Found event for target agent:', {
                ...event,
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                newTimeToDeath: event.newTimeToDeath.toString()
              });
            }
            
            return event;
          } catch (error) {
            console.error('Error processing log:', error);
            console.error('Log data:', log);
            throw error;
          }
        }));

        newEvents.push(...batchEvents);
      }

      // Combine existing and new events, store them, and return
      const allEvents = [...existingEvents, ...newEvents];
      this.storeEvents(allEvents, currentBlock);

      // Log final events for the target agents
      const targetAgents = ['0bd25758-2a10-0c4a-acc9-e611d4d48356', '2b9ec976-a43c-06db-be02-a46603f9e372'];
      targetAgents.forEach(agentId => {
        const finalAgentEvents = allEvents.filter(e => e.agentId === agentId);
        console.log(`Final events for agent ${agentId}:`, finalAgentEvents.map(e => ({
          ...e,
          newTimeToDeath: e.newTimeToDeath.toString(),
          timestamp: e.timestamp.toISOString()
        })));
      });

      return allEvents;
    } catch (error) {
      console.error('Error fetching events:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      // If there's an error, return stored events if available
      const stored = this.getStoredEvents();
      if (stored) {
        console.log('Returning stored events due to error');
        return stored.events;
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

    // Log all events for the specific agent
    const agentEvents = sortedEvents.filter(e => e.agentId === '0bd25758-2a10-0c4a-acc9-e611d4d48356');
    console.log('All events for agent 0bd25758-2a10-0c4a-acc9-e611d4d48356:', agentEvents);

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
      
      // Log detailed info for the specific agent
      if (event.agentId === '0bd25758-2a10-0c4a-acc9-e611d4d48356') {
        console.log('Detailed timestamp info for target agent:', {
          agentId: event.agentId,
          rawNewTimeToDeath: event.newTimeToDeath.toString(),
          deathTimeMs,
          deathTimeISO: deathTime.toISOString(),
          nowMs: now.getTime(),
          nowISO: now.toISOString(),
          diffMs: deathTimeMs - now.getTime(),
          diffDays: remainingDays
        });
      }

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
          const extensionDuration = Math.floor(Number(event.usdcAmount) / 1_000_000 * 7);

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
    
    // Log final stats for the specific agent
    const agentStats = stats.find(s => s.agentId === '0bd25758-2a10-0c4a-acc9-e611d4d48356');
    console.log('Final stats for agent 0bd25758-2a10-0c4a-acc9-e611d4d48356:', agentStats);
    
    return stats;
  }
} 