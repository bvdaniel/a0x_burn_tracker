import { NextResponse } from 'next/server'
import { RedisService } from '../../../services/redis'
import { BlockchainService } from '../../../services/blockchain'

// Make the route dynamic
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Add timeout helper
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
    )
  ])
}

export async function GET() {
  try {
    // Set a timeout for the entire operation
    const result = await withTimeout(
      (async () => {
        // First try to get events from Redis with a timeout
        const events = await withTimeout(RedisService.getEvents(), 5000)
        const lastBlock = await withTimeout(RedisService.getLastBlock(), 5000)
        
        if (events.length > 0) {
          // Convert BigInt to string for JSON serialization
          const serializedEvents = events.map(event => ({
            ...event,
            usdcAmount: event.usdcAmount.toString(),
            a0xBurned: event.a0xBurned.toString(),
            newTimeToDeath: event.newTimeToDeath.toString(),
            timestamp: event.timestamp.toISOString()
          }))
          return { events: serializedEvents, lastBlock }
        }

        // If no events in Redis, fetch from blockchain with a timeout
        const blockchain = new BlockchainService()
        const newEvents = await withTimeout(blockchain.getLifeExtendedEvents(), 15000)
        
        if (newEvents.length > 0) {
          // Save to Redis in the background without waiting
          RedisService.saveEvents(newEvents).catch(console.error)
          const currentBlock = await withTimeout(blockchain.getCurrentBlock(), 5000)
          RedisService.saveLastBlock(currentBlock).catch(console.error)
          
          // Convert BigInt to string for JSON serialization
          const serializedEvents = newEvents.map(event => ({
            ...event,
            usdcAmount: event.usdcAmount.toString(),
            a0xBurned: event.a0xBurned.toString(),
            newTimeToDeath: event.newTimeToDeath.toString(),
            timestamp: event.timestamp.toISOString()
          }))
          return { events: serializedEvents, lastBlock: currentBlock }
        }

        return { events: [], lastBlock: 0 }
      })(),
      30000 // 30 second total timeout
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in events API route:', error)
    // Return cached data if available, even if there was an error
    try {
      const events = await RedisService.getEvents()
      const lastBlock = await RedisService.getLastBlock()
      const serializedEvents = events.map(event => ({
        ...event,
        usdcAmount: event.usdcAmount.toString(),
        a0xBurned: event.a0xBurned.toString(),
        newTimeToDeath: event.newTimeToDeath.toString(),
        timestamp: event.timestamp.toISOString()
      }))
      return NextResponse.json({ events: serializedEvents, lastBlock })
    } catch (cacheError) {
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }
  }
} 