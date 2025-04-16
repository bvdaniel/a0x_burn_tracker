import { NextResponse } from 'next/server'
import { RedisService } from '../../../services/redis'
import { BlockchainService } from '../../../services/blockchain'

export async function GET() {
  try {
    // First try to get events from Redis
    const events = await RedisService.getEvents()
    const lastBlock = await RedisService.getLastBlock()
    
    if (events.length > 0) {
      // Convert BigInt to string for JSON serialization
      const serializedEvents = events.map(event => ({
        ...event,
        usdcAmount: event.usdcAmount.toString(),
        a0xBurned: event.a0xBurned.toString(),
        newTimeToDeath: event.newTimeToDeath.toString(),
        timestamp: event.timestamp.toISOString()
      }))
      return NextResponse.json({ events: serializedEvents, lastBlock })
    }

    // If no events in Redis, fetch from blockchain and cache
    const blockchain = new BlockchainService()
    const newEvents = await blockchain.getLifeExtendedEvents()
    
    if (newEvents.length > 0) {
      await RedisService.saveEvents(newEvents)
      const currentBlock = await blockchain.getCurrentBlock()
      await RedisService.saveLastBlock(currentBlock)
      
      // Convert BigInt to string for JSON serialization
      const serializedEvents = newEvents.map(event => ({
        ...event,
        usdcAmount: event.usdcAmount.toString(),
        a0xBurned: event.a0xBurned.toString(),
        newTimeToDeath: event.newTimeToDeath.toString(),
        timestamp: event.timestamp.toISOString()
      }))
      return NextResponse.json({ events: serializedEvents, lastBlock: currentBlock })
    }

    return NextResponse.json({ events: [], lastBlock: 0 })
  } catch (error) {
    console.error('Error in events API route:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
} 