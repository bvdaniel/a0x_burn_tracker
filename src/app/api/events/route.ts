import { NextResponse } from 'next/server'
import { RedisService } from '../../../services/redis'
import { BlockchainService } from '../../../services/blockchain'
import { LifeExtendedEvent } from '../../../types'

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
      // Wait before retrying, with exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
};

export async function GET() {
  try {
    // First try to get events from Redis
    console.log('Fetching events from Redis...')
    let events: LifeExtendedEvent[] = [];
    let lastBlock = 0;
    
    try {
      [events, lastBlock] = await Promise.all([
        withTimeoutAndRetry(() => RedisService.getEvents(), 3000),
        withTimeoutAndRetry(() => RedisService.getLastBlock(), 3000)
      ]);
      console.log('Got events from Redis:', events.length)
      console.log('Got last block from Redis:', lastBlock)
    } catch (redisError) {
      console.warn('Redis fetch failed, falling back to blockchain:', redisError)
    }

    // If no events in Redis, fetch from blockchain
    if (events.length === 0) {
      console.log('No events in Redis, fetching from blockchain...')
      try {
        const blockchain = new BlockchainService()
        const newEvents = await withTimeoutAndRetry(
          () => blockchain.getLifeExtendedEvents(),
          10000
        )
        console.log('Got events from blockchain:', newEvents.length)
        
        if (newEvents.length > 0) {
          events = newEvents;
          // Save to Redis in the background
          Promise.all([
            RedisService.saveEvents(newEvents),
            blockchain.getCurrentBlock().then(block => {
              lastBlock = block;
              return RedisService.saveLastBlock(block);
            })
          ]).catch(error => {
            console.error('Error saving to Redis:', error)
          });
        }
      } catch (blockchainError: any) {
        console.error('Blockchain fetch failed:', blockchainError)
        // If both Redis and blockchain fail, return error
        if (events.length === 0) {
          return NextResponse.json({ 
            error: 'Failed to fetch events from both Redis and blockchain',
            details: blockchainError?.message || 'Unknown error'
          }, { status: 503 })
        }
      }
    }

    // Serialize events
    const serializedEvents = events.map(event => ({
      ...event,
      usdcAmount: event.usdcAmount.toString(),
      a0xBurned: event.a0xBurned.toString(),
      newTimeToDeath: event.newTimeToDeath.toString(),
      timestamp: event.timestamp instanceof Date ? 
        event.timestamp.toISOString() : 
        new Date(event.timestamp).toISOString()
    }));

    return NextResponse.json({ events: serializedEvents, lastBlock })
  } catch (error: any) {
    console.error('Error in events API route:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch events',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
} 