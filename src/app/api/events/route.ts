import { NextResponse } from 'next/server'
import { RedisService } from '@/services/redis'
import { LifeExtendedEvent } from '@/types'

// Make the route dynamic
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

export async function GET() {
  try {
    console.log('Fetching events from Redis...')
    const [events, lastBlock] = await Promise.all([
      RedisService.getEvents(),
      RedisService.getLastBlock()
    ]);
    
    console.log('Got events from Redis:', events.length)
    console.log('Got last block from Redis:', lastBlock)

    return NextResponse.json({ 
      events: serializeEvents(events), 
      lastBlock,
      source: 'redis',
      eventCount: events.length 
    });

  } catch (error) {
    console.error('Error fetching from Redis:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch events from Redis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 