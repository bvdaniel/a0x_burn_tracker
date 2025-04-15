import { NextResponse } from 'next/server';
import { BlockchainService } from '../../../services/blockchain';

export async function GET() {
  try {
    const blockchainService = new BlockchainService();
    const events = await blockchainService.getLifeExtendedEvents();
    const stats = BlockchainService.aggregateAgentStats(events);
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent data' },
      { status: 500 }
    );
  }
} 