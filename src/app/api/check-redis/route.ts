import { RedisService } from '@/services/redis'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const events = await RedisService.getEvents()
    const lastBlock = await RedisService.getLastBlock()
    return NextResponse.json({ 
      events, 
      lastBlock,
      eventCount: events.length
    })
  } catch (error) {
    console.error('Error checking Redis:', error)
    return NextResponse.json({ error: 'Failed to check Redis' }, { status: 500 })
  }
} 