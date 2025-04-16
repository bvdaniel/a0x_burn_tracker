import { Redis } from '@upstash/redis'
import { LifeExtendedEvent } from '../types'

const redis = new Redis({
  url: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL || '',
  token: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN || ''
})

const EVENTS_KEY = 'life_extended_events'
const LAST_BLOCK_KEY = 'last_block'

export class RedisService {
  static async getEvents(): Promise<LifeExtendedEvent[]> {
    try {
      if (!process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL || !process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN) {
        console.error('Redis credentials not configured')
        return []
      }

      const events = await redis.get<any[]>(EVENTS_KEY)
      if (!events) return []
      
      // Convert string back to BigInt
      return events.map(event => ({
        ...event,
        usdcAmount: BigInt(event.usdcAmount),
        a0xBurned: BigInt(event.a0xBurned),
        newTimeToDeath: BigInt(event.newTimeToDeath),
        timestamp: new Date(event.timestamp)
      }))
    } catch (error) {
      console.error('Error getting events from Redis:', error)
      return []
    }
  }

  static async saveEvents(events: LifeExtendedEvent[]) {
    try {
      if (!process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL || !process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN) {
        console.error('Redis credentials not configured')
        return
      }

      // Convert BigInt to string for storage
      const serializedEvents = events.map(event => ({
        ...event,
        usdcAmount: event.usdcAmount.toString(),
        a0xBurned: event.a0xBurned.toString(),
        newTimeToDeath: event.newTimeToDeath.toString(),
        timestamp: event.timestamp.toISOString()
      }))
      await redis.set(EVENTS_KEY, serializedEvents)
    } catch (error) {
      console.error('Error saving events to Redis:', error)
    }
  }

  static async getLastBlock(): Promise<number> {
    try {
      if (!process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL || !process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN) {
        console.error('Redis credentials not configured')
        return 0
      }

      const block = await redis.get<number>(LAST_BLOCK_KEY)
      return block || 0
    } catch (error) {
      console.error('Error getting last block from Redis:', error)
      return 0
    }
  }

  static async saveLastBlock(block: number) {
    try {
      if (!process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL || !process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN) {
        console.error('Redis credentials not configured')
        return
      }

      await redis.set(LAST_BLOCK_KEY, block)
    } catch (error) {
      console.error('Error saving last block to Redis:', error)
    }
  }

  static async clearCache() {
    try {
      if (!process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL || !process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN) {
        console.error('Redis credentials not configured')
        return
      }

      await redis.del(EVENTS_KEY)
      await redis.del(LAST_BLOCK_KEY)
      console.log('Cache cleared successfully')
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  }
} 