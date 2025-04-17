import { Redis } from '@upstash/redis'
import { LifeExtendedEvent } from '../types'

const EVENTS_KEY = 'life_extended_events'
const LAST_BLOCK_KEY = 'last_block'

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
          setTimeout(() => reject(new Error('Redis operation timed out')), timeoutMs)
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

export class RedisService {
  private static redis: Redis | null = null;

  private static getClient() {
    if (this.redis) return this.redis;

    // Try both sets of environment variables
    const url = process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
    
    if (!url || !token) {
      console.error('Redis credentials missing:', {
        hasUrl: !!url,
        hasToken: !!token,
        nodeEnv: process.env.NODE_ENV,
        hasPublicUrl: !!process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL,
        hasPublicToken: !!process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN
      });
      throw new Error('Redis credentials not configured')
    }
    
    this.redis = new Redis({ 
      url, 
      token,
      automaticDeserialization: true,
      retry: {
        retries: 3,
        backoff: (retryCount) => Math.min(Math.pow(2, retryCount) * 1000, 10000)
      }
    })
    return this.redis
  }

  static async getEvents(): Promise<LifeExtendedEvent[]> {
    try {
      const redis = this.getClient()
      const events = await withTimeoutAndRetry(
        () => redis.get<any[]>(EVENTS_KEY),
        3000
      )
      if (!events) return []
      
      // Convert string back to BigInt and ensure timestamp is a Date object
      return events.map(event => {
        try {
          // Handle different timestamp formats
          let timestamp: Date;
          if (typeof event.timestamp === 'string') {
            timestamp = new Date(event.timestamp);
            if (isNaN(timestamp.getTime())) {
              timestamp = new Date(Number(event.timestamp));
            }
          } else if (typeof event.timestamp === 'number') {
            timestamp = new Date(event.timestamp);
          } else {
            console.warn('Invalid timestamp format:', event.timestamp);
            timestamp = new Date();
          }

          return {
            ...event,
            usdcAmount: BigInt(event.usdcAmount),
            a0xBurned: BigInt(event.a0xBurned),
            newTimeToDeath: BigInt(event.newTimeToDeath),
            timestamp
          };
        } catch (error) {
          console.error('Error processing event from Redis:', error, event);
          throw error;
        }
      });
    } catch (error) {
      console.error('Error getting events from Redis:', error)
      return []
    }
  }

  static async saveEvents(events: LifeExtendedEvent[]) {
    try {
      const redis = this.getClient()
      const serializedEvents = events.map(event => ({
        ...event,
        usdcAmount: event.usdcAmount.toString(),
        a0xBurned: event.a0xBurned.toString(),
        newTimeToDeath: event.newTimeToDeath.toString(),
        timestamp: event.timestamp.toISOString()
      }));
      
      await withTimeoutAndRetry(
        () => redis.set(EVENTS_KEY, serializedEvents),
        3000
      );
    } catch (error) {
      console.error('Error saving events to Redis:', error)
    }
  }

  static async getLastBlock(): Promise<number> {
    try {
      const redis = this.getClient()
      const block = await withTimeoutAndRetry(
        () => redis.get<number>(LAST_BLOCK_KEY),
        3000
      );
      return block || 0
    } catch (error) {
      console.error('Error getting last block from Redis:', error)
      return 0
    }
  }

  static async saveLastBlock(block: number) {
    try {
      const redis = this.getClient()
      await withTimeoutAndRetry(
        () => redis.set(LAST_BLOCK_KEY, block),
        3000
      );
    } catch (error) {
      console.error('Error saving last block to Redis:', error)
    }
  }

  static async clearCache() {
    try {
      const redis = this.getClient()
      await Promise.all([
        withTimeoutAndRetry(() => redis.del(EVENTS_KEY), 3000),
        withTimeoutAndRetry(() => redis.del(LAST_BLOCK_KEY), 3000)
      ]);
      console.log('Cache cleared successfully')
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  }
} 