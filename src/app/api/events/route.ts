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
        try {
          // First try to get events from Redis with a timeout
          console.log('Fetching events from Redis...')
          const events = await withTimeout(RedisService.getEvents(), 5000)
          console.log('Got events from Redis:', events.length)
          const lastBlock = await withTimeout(RedisService.getLastBlock(), 5000)
          console.log('Got last block from Redis:', lastBlock)
          
          if (events.length > 0) {
            try {
              // Convert BigInt to string and ensure timestamp is ISO string
              const serializedEvents = events.map(event => {
                try {
                  if (!(event.timestamp instanceof Date)) {
                    console.log('Invalid timestamp:', event.timestamp)
                    event.timestamp = new Date(event.timestamp)
                  }
                  return {
                    ...event,
                    usdcAmount: event.usdcAmount.toString(),
                    a0xBurned: event.a0xBurned.toString(),
                    newTimeToDeath: event.newTimeToDeath.toString(),
                    timestamp: event.timestamp.toISOString()
                  }
                } catch (err) {
                  console.error('Error serializing event:', event, err)
                  throw err
                }
              })
              return { events: serializedEvents, lastBlock }
            } catch (err) {
              console.error('Error serializing events from Redis:', err)
              throw err
            }
          }

          // If no events in Redis, fetch from blockchain with a timeout
          console.log('No events in Redis, fetching from blockchain...')
          const blockchain = new BlockchainService()
          const newEvents = await withTimeout(blockchain.getLifeExtendedEvents(), 15000)
          console.log('Got events from blockchain:', newEvents.length)
          
          if (newEvents.length > 0) {
            try {
              // Save to Redis in the background without waiting
              RedisService.saveEvents(newEvents).catch(error => {
                console.error('Error saving events to Redis:', error)
              })
              const currentBlock = await withTimeout(blockchain.getCurrentBlock(), 5000)
              RedisService.saveLastBlock(currentBlock).catch(error => {
                console.error('Error saving last block to Redis:', error)
              })
              
              // Convert BigInt to string and ensure timestamp is ISO string
              const serializedEvents = newEvents.map(event => {
                try {
                  if (!(event.timestamp instanceof Date)) {
                    console.log('Invalid timestamp:', event.timestamp)
                    event.timestamp = new Date(event.timestamp)
                  }
                  return {
                    ...event,
                    usdcAmount: event.usdcAmount.toString(),
                    a0xBurned: event.a0xBurned.toString(),
                    newTimeToDeath: event.newTimeToDeath.toString(),
                    timestamp: event.timestamp.toISOString()
                  }
                } catch (err) {
                  console.error('Error serializing event:', event, err)
                  throw err
                }
              })
              return { events: serializedEvents, lastBlock: currentBlock }
            } catch (err) {
              console.error('Error processing blockchain events:', err)
              throw err
            }
          }

          return { events: [], lastBlock: 0 }
        } catch (err) {
          console.error('Error in main operation:', err)
          throw err
        }
      })(),
      30000 // 30 second total timeout
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in events API route:', error)
    // Return cached data if available, even if there was an error
    try {
      console.log('Attempting to fetch cached data...')
      const events = await RedisService.getEvents()
      const lastBlock = await RedisService.getLastBlock()
      const serializedEvents = events.map(event => {
        try {
          if (!(event.timestamp instanceof Date)) {
            console.log('Invalid timestamp in cached event:', event.timestamp)
            event.timestamp = new Date(event.timestamp)
          }
          return {
            ...event,
            usdcAmount: event.usdcAmount.toString(),
            a0xBurned: event.a0xBurned.toString(),
            newTimeToDeath: event.newTimeToDeath.toString(),
            timestamp: event.timestamp.toISOString()
          }
        } catch (err) {
          console.error('Error serializing cached event:', event, err)
          throw err
        }
      })
      return NextResponse.json({ events: serializedEvents, lastBlock })
    } catch (cacheError: any) {
      console.error('Error fetching cached data:', cacheError)
      return NextResponse.json({ 
        error: 'Failed to fetch events', 
        details: cacheError?.message || 'Unknown error'
      }, { status: 500 })
    }
  }
} 