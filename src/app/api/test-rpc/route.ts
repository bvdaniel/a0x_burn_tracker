import { NextResponse } from 'next/server';
import { BlockchainService } from '@/services/blockchain';

export async function GET() {
  try {
    const blockchainService = new BlockchainService();
    const currentBlock = await blockchainService.getCurrentBlock();
    
    return NextResponse.json({
      success: true,
      currentBlock,
      message: `Current block number: ${currentBlock}`
    });
  } catch (error) {
    console.error('Error getting current block:', error);
    return NextResponse.json({ 
      error: 'Failed to get current block',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 