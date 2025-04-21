import { NextResponse } from 'next/server';
import { RedisService } from '@/services/redis';
import { BlockchainService } from '@/services/blockchain';
import { LifeExtendedEvent } from '@/types';

async function fetchRecentEvents(): Promise<LifeExtendedEvent[]> {
  try {
    // Create a new instance of BlockchainService
    const blockchainService = new BlockchainService();
    // Get the last 48 hours of events from the blockchain
    const events = await blockchainService.getLifeExtendedEvents();
    return events;
  } catch (error) {
    console.error('Error fetching events from blockchain:', error);
    return [];
  }
}

export async function GET() {
  try {
    // Get existing events from Redis
    const existingEvents = await RedisService.getEvents();
    const lastBlock = await RedisService.getLastBlock();
    
    // Fetch new events from the last 48 hours
    const recentEvents = await fetchRecentEvents();
    
    if (recentEvents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new events found in the last 48 hours',
        newEventCount: 0,
        lastBlock
      });
    }
    
    // Create a map of existing events by transaction hash for deduplication
    const existingEventMap = new Map(
      existingEvents.map(event => [event.transactionHash, event])
    );
    
    // Filter out duplicates and merge with existing events
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
    
    return NextResponse.json({
      success: true,
      message: newEvents.length > 0 ? 'Added new events' : 'No new unique events found',
      newEventCount: newEvents.length,
      lastBlock: Math.max(lastBlock, ...recentEvents.map(e => e.blockNumber))
    });
  } catch (error) {
    console.error('Error fetching recent events:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch recent events',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 