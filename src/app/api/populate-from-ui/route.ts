import { NextResponse } from 'next/server';
import { populateRedisFromUI } from '../../../scripts/populate-redis';

export async function POST(request: Request) {
  try {
    const agents = await request.json();
    await populateRedisFromUI(agents);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in populate-from-ui:', error);
    return NextResponse.json({ error: 'Failed to populate Redis' }, { status: 500 });
  }
} 