import { NextResponse } from 'next/server';
import { BlockchainService } from '@/services/blockchain';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const service = new BlockchainService();
    const events = await service.getLifeExtendedEvents();
    const stats = BlockchainService.aggregateAgentStats(events);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    return NextResponse.json({ error: 'Failed to fetch agent stats' }, { status: 500 });
  }
} 