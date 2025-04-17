import { NextResponse } from 'next/server'
import { RedisService } from '@/services/redis'
import { BlockchainService } from '@/services/blockchain'
import { LifeExtendedEvent } from '@/types'

// Make the route dynamic
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Add timeout helper with retry
const withTimeoutAndRetry = async <T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  retries: number = 2
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await Promise.race([
        operation(),
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
        )
      ]);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${i + 1} failed:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
};

// Helper to serialize events for JSON response
const serializeEvents = (events: LifeExtendedEvent[]) => {
  return events.map(event => ({
    ...event,
    usdcAmount: event.usdcAmount.toString(),
    a0xBurned: event.a0xBurned.toString(),
    newTimeToDeath: event.newTimeToDeath.toString(),
    timestamp: event.timestamp.toISOString()
  }));
};

// Helper to merge new events with existing ones
const mergeEvents = (existingEvents: LifeExtendedEvent[], newEvents: LifeExtendedEvent[]): LifeExtendedEvent[] => {
  // Create a map of existing events by transaction hash
  const existingMap = new Map(existingEvents.map(event => [event.transactionHash, event]));
  
  // Add new events that don't exist yet
  for (const event of newEvents) {
    if (!existingMap.has(event.transactionHash)) {
      existingMap.set(event.transactionHash, event);
    }
  }
  
  // Convert back to array and sort by timestamp
  return Array.from(existingMap.values())
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

export async function GET() {
  try {
    // First try to get events from Redis
    console.log('Fetching events from Redis...')
    let events: LifeExtendedEvent[] = [];
    let lastBlock = 0;
    let redisError: Error | null = null;
    
    try {
      [events, lastBlock] = await Promise.all([
        withTimeoutAndRetry(() => RedisService.getEvents(), 3000),
        withTimeoutAndRetry(() => RedisService.getLastBlock(), 3000)
      ]);
      console.log('Got events from Redis:', events.length)
      console.log('Got last block from Redis:', lastBlock)

      // If we have data in Redis, just return it
      if (events.length > 0) {
        return NextResponse.json({ 
          events: serializeEvents(events), 
          lastBlock,
          source: 'redis',
          eventCount: events.length 
        });
      }
    } catch (error) {
      redisError = error as Error;
      console.warn('Redis fetch failed:', error)
    }

    // Only fetch from blockchain if Redis is empty (not if it failed)
    if (events.length === 0 && !redisError) {
      console.log('No events in Redis, fetching from blockchain...')
      try {
        const blockchain = new BlockchainService()
        const [newEvents, currentBlock] = await Promise.all([
          withTimeoutAndRetry(() => blockchain.getLifeExtendedEvents(), 10000),
          withTimeoutAndRetry(() => blockchain.getCurrentBlock(), 3000)
        ]);
        console.log('Got events from blockchain:', newEvents.length)
        
        if (newEvents.length > 0) {
          // Merge new events with existing ones
          const mergedEvents = mergeEvents(events, newEvents);
          events = mergedEvents;
          lastBlock = Math.max(lastBlock, currentBlock);
          
          // Save merged events to Redis
          Promise.all([
            RedisService.saveEvents(mergedEvents),
            RedisService.saveLastBlock(lastBlock)
          ]).catch(error => {
            console.error('Error saving to Redis:', error)
          });
        }
      } catch (blockchainError) {
        console.error('Blockchain fetch failed:', blockchainError)
        return NextResponse.json({ 
          error: 'Failed to fetch events from blockchain',
          details: blockchainError instanceof Error ? blockchainError.message : 'Unknown error'
        }, { status: 503 })
      }
    }

    // Return whatever events we have
    return NextResponse.json({ 
      events: serializeEvents(events), 
      lastBlock,
      source: events.length > 0 ? (redisError ? 'blockchain' : 'redis') : 'none',
      eventCount: events.length 
    })

  } catch (error) {
    console.error('Error in events route:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch events',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 