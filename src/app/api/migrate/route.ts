import { NextResponse } from 'next/server'
import { RedisService } from '@/services/redis'

const EVENTS_STORAGE_KEY = 'lifeExtendedEvents'

export async function GET() {
  try {
    // Get data from localStorage via a script injected into the page
    const script = `
      const stored = localStorage.getItem('${EVENTS_STORAGE_KEY}');
      if (stored) {
        const data = JSON.parse(stored);
        data.events = data.events.map(event => ({
          ...event,
          timestamp: new Date(event.timestamp)
        }));
        return data;
      }
      return null;
    `;

    // We need to return instructions for the user since we can't access localStorage directly
    return NextResponse.json({ 
      success: true, 
      message: "Please run this code in your browser's console and send me the result:",
      code: `copy(localStorage.getItem('${EVENTS_STORAGE_KEY}'))`
    })

  } catch (error) {
    console.error('Error migrating data:', error)
    return NextResponse.json({ success: false, error: 'Failed to migrate data' }, { status: 500 })
  }
} 