import { NextResponse } from 'next/server';
import { RedisService } from '@/services/redis';
import { BlockchainService } from '@/services/blockchain';

// Edge runtime for better performance and reliability
export const runtime = 'edge';

// Configure the cron schedule (every 24 hours)
export const maxDuration = 300; // 5 minutes timeout
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchAndMergeEvents() {
  try {
    // Get existing events from Redis
    const existingEvents = await RedisService.getEvents();
    const lastBlock = await RedisService.getLastBlock();
    
    // Create blockchain service and fetch new events
    const blockchainService = new BlockchainService();
    const recentEvents = await blockchainService.getLifeExtendedEvents();
    
    if (recentEvents.length === 0) {
      return {
        success: true,
        message: 'No new events found in the last 48 hours',
        newEventCount: 0,
        lastBlock
      };
    }
    
    // Create a map of existing events by transaction hash for deduplication
    const existingEventMap = new Map(
      existingEvents.map(event => [event.transactionHash, event])
    );
    
    // Filter out duplicates
    const newEvents = recentEvents.filter(
      event => !existingEventMap.has(event.transactionHash)
    );
    
    if (newEvents.length > 0) {
      // Merge and sort all events by timestamp
      const allEvents = [...existingEvents, ...newEvents].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
      
      // Update Redis with merged events
      await RedisService.saveEvents(allEvents);
      
      // Update last block if we have new events
      const newLastBlock = Math.max(...recentEvents.map(e => e.blockNumber));
      if (newLastBlock > lastBlock) {
        await RedisService.saveLastBlock(newLastBlock);
      }
    }
    
    return {
      success: true,
      message: newEvents.length > 0 ? 'Added new events' : 'No new unique events found',
      newEventCount: newEvents.length,
      lastBlock: Math.max(lastBlock, ...recentEvents.map(e => e.blockNumber))
    };
  } catch (error) {
    console.error('Error in cron job:', error);
    throw error;
  }
}

export async function GET(request: Request) {
  try {
    // Verify the request is from Vercel's cron system
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const result = await fetchAndMergeEvents();
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ 
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 