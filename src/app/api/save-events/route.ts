import { NextResponse } from 'next/server';
import { RedisService } from '@/services/redis';
import type { LifeExtendedEvent } from '@/types';

const event1: LifeExtendedEvent = {
  agentId: '0bd25758-2a10-0c4a-acc9-e611d4d48356',
  usdcAmount: BigInt('1000000'),
  a0xBurned: BigInt('1279372185396102480319442'),
  newTimeToDeath: BigInt('1745158901'),
  useUSDC: false,
  timestamp: new Date('2025-04-13T14:21:41.000Z'),
  transactionHash: "0x" + "1".repeat(64),
  blockNumber: 29022500
};

const event2: LifeExtendedEvent = {
  agentId: '0bd25758-2a10-0c4a-acc9-e611d4d48356',
  usdcAmount: BigInt('142857'),
  a0xBurned: BigInt('152187521864177231497427'),
  newTimeToDeath: BigInt('1745245300'),
  useUSDC: false,
  timestamp: new Date('2025-04-16T15:02:19.000Z'),
  transactionHash: "0x" + "2".repeat(64),
  blockNumber: 29022519
};

const events: LifeExtendedEvent[] = [event1, event2];

export async function GET() {
  try {
    await RedisService.saveEvents(events);
    await RedisService.saveLastBlock(29022556); // This was the last block number from the logs
    return NextResponse.json({ success: true, message: 'Events saved to Redis' });
  } catch (error) {
    console.error('Error saving events:', error);
    return NextResponse.json({ error: 'Failed to save events' }, { status: 500 });
  }
} 