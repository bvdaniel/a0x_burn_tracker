import { NextResponse } from 'next/server';
import { BlockchainService } from '../../../services/blockchain';

// Cache the response for 5 minutes
export const revalidate = 300;

export async function GET() {
  try {
    const blockchainService = new BlockchainService();
    const events = await blockchainService.getLifeExtendedEvents();
    const stats = BlockchainService.aggregateAgentStats(events);
    
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent data' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
} 