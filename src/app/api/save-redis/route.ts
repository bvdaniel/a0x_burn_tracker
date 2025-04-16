import { NextResponse } from 'next/server'
import { RedisService } from '@/services/redis'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const parsed = JSON.parse(data)
    
    // Convert timestamps back to Date objects
    const events = parsed.events.map((event: any) => ({
      ...event,
      timestamp: new Date(event.timestamp)
    }))

    await RedisService.saveEvents(events)
    await RedisService.saveLastBlock(parsed.lastBlock)

    return NextResponse.json({ success: true, eventsCount: events.length })
  } catch (error) {
    console.error('Error saving to Redis:', error)
    return NextResponse.json({ success: false, error: 'Failed to save to Redis' }, { status: 500 })
  }
} 