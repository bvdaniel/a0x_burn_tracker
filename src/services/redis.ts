import { Redis } from '@upstash/redis'
import { LifeExtendedEvent } from '../types'

const EVENTS_KEY = 'life_extended_events'
const LAST_BLOCK_KEY = 'last_block'

export class RedisService {
  private static getClient() {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    
    if (!url || !token) {
      console.error('Redis credentials missing:', {
        hasUrl: !!url,
        hasToken: !!token,
        nodeEnv: process.env.NODE_ENV
      });
      throw new Error('Redis credentials not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.')
    }
    
    return new Redis({ url, token })
  }

  static async getEvents(): Promise<LifeExtendedEvent[]> {
    try {
      const redis = this.getClient()
      const events = await redis.get<any[]>(EVENTS_KEY)
      if (!events) return []
      
      // Convert string back to BigInt and ensure timestamp is a Date object
      return events.map(event => {
        try {
          // Handle different timestamp formats
          let timestamp: Date;
          if (typeof event.timestamp === 'string') {
            // Try parsing ISO string first
            timestamp = new Date(event.timestamp);
            if (isNaN(timestamp.getTime())) {
              // If not ISO string, try parsing as number
              timestamp = new Date(Number(event.timestamp));
            }
          } else if (typeof event.timestamp === 'number') {
            timestamp = new Date(event.timestamp);
          } else {
            console.warn('Invalid timestamp format:', event.timestamp);
            timestamp = new Date(); // Fallback to current time
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
      // Convert BigInt to string and store timestamp as ISO string
      const serializedEvents = events.map(event => {
        try {
          return {
            ...event,
            usdcAmount: event.usdcAmount.toString(),
            a0xBurned: event.a0xBurned.toString(),
            newTimeToDeath: event.newTimeToDeath.toString(),
            timestamp: event.timestamp.toISOString() // Store as ISO string for better compatibility
          };
        } catch (error) {
          console.error('Error serializing event for Redis:', error, event);
          throw error;
        }
      });
      await redis.set(EVENTS_KEY, serializedEvents)
    } catch (error) {
      console.error('Error saving events to Redis:', error)
    }
  }

  static async getLastBlock(): Promise<number> {
    try {
      const redis = this.getClient()
      const block = await redis.get<number>(LAST_BLOCK_KEY)
      return block || 0
    } catch (error) {
      console.error('Error getting last block from Redis:', error)
      return 0
    }
  }

  static async saveLastBlock(block: number) {
    try {
      const redis = this.getClient()
      await redis.set(LAST_BLOCK_KEY, block)
    } catch (error) {
      console.error('Error saving last block to Redis:', error)
    }
  }

  static async clearCache() {
    try {
      const redis = this.getClient()
      await redis.del(EVENTS_KEY)
      await redis.del(LAST_BLOCK_KEY)
      console.log('Cache cleared successfully')
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  }
} 