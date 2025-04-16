import { RedisService } from '@/services/redis'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await RedisService.clearCache()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing cache:', error)
    return NextResponse.json({ success: false, error: 'Failed to clear cache' }, { status: 500 })
  }
} 